-- =============================================================================
-- "İlanlarım vb sayfalar biraz geç yükleniyor" — 8 Ağustos 2026
-- =============================================================================
--
-- BİLDİRİM (Bayram): "İlanlarım vb sayfalar biraz geç yükleniyor."
--
-- İLK VARSAYIM YANLIŞTI: `app/panel/page.tsx` üç sorgusunu ZATEN `Promise.all`
-- ile paralel atıyor — yani "sıralı istekler" değildi. Sebep tek bir EKSİK
-- İNDEKS'ti.
--
-- =============================================================================
-- BÖLÜM 0 — ÖLÇÜM
-- =============================================================================
-- `listings` üzerinde `user_id` indeksi YOKTU. (`vehicles` tablosunun
-- `vehicles_user_id_idx`'i vardı; `listings` atlanmış.) Panel'in ilan sorgusu
-- tam olarak bu kolonu filtreliyor:
--
--   explain (analyze) select ... from listings
--   where user_id = '<uuid>' order by created_at desc;
--
--   ÖNCE:  Parallel Seq Scan on listings
--          Rows Removed by Filter: 128019 (worker başına)
--          Execution Time: 3684 ms          ← sayfanın gecikmesi buydu
--
-- Tabloda 256.175 satır var ama `user_id` DOLU olan yalnız 139'u (%0,054) —
-- geri kalanı WhatsApp/kazıma kaynaklı sahipsiz ilanlar. Yani her panel
-- açılışında 256 bin satır taranıp 139'u eleniyordu.
--
-- İKİNCİ BULGU (aynı taramada, `pg_stat_statements`): `raw_posts` üzerinde
-- `contact_phone = ANY($1) AND created_at >= $2` sorgusu 5.102 ms ortalama ×
-- 78 çağrı = 398 saniye toplam. Bu WhatsApp ZIP içe aktarımının spam kontrolü
-- (`app/api/whatsapp-parse/route.ts`:543) ve parça parça (batch) atılıyor —
-- yani bir içe aktarımda ONLARCA kez. `raw_posts_dedup_idx` içinde
-- `contact_phone` var ama İKİNCİ kolon olarak; baştan filtrelemede işe yaramaz.
--
--   ÖNCE:  Seq Scan on raw_posts · Rows Removed by Filter: 71776
--          Execution Time: 3784 ms
--
-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================
-- ⚠️ İkisi de CONCURRENTLY: `listings` ve `raw_posts` CANLI ve yazma alıyor.
--    Düz `CREATE INDEX` tabloyu tarama boyunca ShareLock'la kilitler ve o sürede
--    ilan/mesaj yazan her istek bekler.
-- ⚠️ İkisi de PARTIAL (`WHERE ... IS NOT NULL`): filtrelenen sütun satırların
--    çok küçük bir kısmında dolu. `listings` indeksi böylece 16 kB kaldı —
--    tam indeks olsaydı ~8 MB olur ve her INSERT'te boşa bakım maliyeti çıkardı.

create index concurrently if not exists listings_user_id_created_idx
  on public.listings (user_id, created_at desc)
  where user_id is not null;
-- `created_at desc` indekste: panel sorgusu `order by created_at desc` yapıyor,
-- böylece ayrı bir Sort adımı da kalkıyor.

create index concurrently if not exists raw_posts_phone_created_idx
  on public.raw_posts (contact_phone, created_at desc)
  where contact_phone is not null;
-- Kolon SIRASI önemli: sorgu `contact_phone IN (...)` ile eşitlik, `created_at`
-- ile ARALIK filtreliyor. Eşitlik kolonu ÖNCE gelmeli; ters sırada her telefon
-- için aralık taraması yapılırdı.

analyze public.listings;
analyze public.raw_posts;

-- =============================================================================
-- BÖLÜM 2 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı)
-- =============================================================================
-- 2.1 Panel ilan sorgusu — en çok ilanı olan kullanıcı (137 ilan):
--   SONRA: Index Scan using listings_user_id_created_idx
--          Execution Time: 74,6 ms      (3684 ms → ~49× hızlı)
--   İlanı olmayan/az olan kullanıcıda: ~3 ms (~1000×).
--
-- 2.2 raw_posts telefon+saat sorgusu:
--   SONRA: Index Only Scan using raw_posts_phone_created_idx
--          Heap Fetches: 0 · Execution Time: 0,144 ms   (3784 ms → ~26.000×)
--
-- 2.3 UÇTAN UCA sayfa süresi (dev sunucusu, 40 ilanlı geçici kullanıcı,
--     5 istekte medyan — geçici kullanıcı sonra silindi):
--        /panel  medyan 427 ms (en iyi 371, en kötü 928)
--        /       medyan 345 ms
--     Üretimde bundan hızlı olması beklenir (dev derlemesi yok).
--
-- =============================================================================
-- BÖLÜM 3 — GERİ ALMA
-- =============================================================================
-- drop index concurrently if exists public.listings_user_id_created_idx;
-- drop index concurrently if exists public.raw_posts_phone_created_idx;

-- =============================================================================
-- BÖLÜM 4 — DERS
-- =============================================================================
-- `vehicles.user_id` indekslenmiş, `listings.user_id` DEĞİL. Aynı desende
-- ("kullanıcının kendi kayıtları") iki tablodan biri atlanmış ve fark
-- edilmemesinin sebebi şu: tablo küçükken seq scan da hızlıdır. 256 bin satırda
-- ortaya çıktı. KURAL: `.eq('user_id', ...)` ile sorgulanan HER tabloda o kolon
-- indeksli olmalı; büyüme anını beklemek "bir gün yavaşlar" demektir.
-- ⚠️ Ayrıca: `user_id`'si NULL olan satırların oranı çok yüksekse indeks PARTIAL
--    olsun — hem küçük kalır hem yazma maliyeti düşer.
