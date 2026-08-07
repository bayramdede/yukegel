-- =============================================================================
-- Landing page + ilan detayı performansı — ölçüm ve düzeltme
-- Tarih: 7 Ağustos 2026
-- İstek: "İlanlar çok hızlı gelmeli. İlan detayı da hızlı açılmalı."
-- =============================================================================
--
-- BULUNAN İKİ AYRI SORUN (ikisi de `pg_stat_statements` ile ölçüldü, tahmin değil):
--
-- 1) Ana sayfa/filtre sorgusu (listings + listing_stops lateral join) ORTALAMA
--    1026ms, EN KÖTÜ 21.373ms (355 çağrı, `pg_stat_statements`). Kök sebep:
--    planlayıcı `moderation_status = ANY('{approved,auto_published}')` iki
--    değerli koşulunun satır sayısını 355 tahmin ediyordu, gerçek 2934 (8 kat
--    yanlış). Yanlış tahmin yüzünden created_at DESC sıralı-index taramasını
--    değil, "tara+sırala" planını seçiyor ve `listing_stops` lateral join'ini
--    KAZANAN 200 satır yerine EŞLEŞEN 2934 satırın HEPSİNDE çalıştırıyordu.
--    Kanıt: tek değerli eşitlikte (`moderation_status = 'approved'`) aynı sorgu
--    9.6ms'de bitiyordu — index/veri sorunu değil, İSTATİSTİK sorunu.
--
-- 2) `fetchTotalIlanCount()` (hero rozeti + sayaç) 1269ms. Kök sebep: `listings`
--    HİÇ manuel VACUUM edilmemiş, son autovacuum 7+ gün önce (`n_dead_tup`
--    30.559 / 255.880 = %12 — varsayılan autovacuum eşiği %20, hiç tetiklenmemiş).
--    Visibility map güncel değildi → Index Only Scan 6219 "Heap Fetch"e düşüyordu.
--
-- BÖLÜM 0 — ÖNCE ÖLÇ (bu sorguları tekrar çalıştırıp aynı sonucu görmelisin)
-- =============================================================================

-- 0.1 En pahalı `listings` sorguları (kanıt — düzeltmeden ÖNCEki durumu yansıtır,
--     pg_stat_statements sıfırlanmadıkça tarihsel kalır)
select round(mean_exec_time::numeric,1) as ort_ms, round(max_exec_time::numeric,1) as maks_ms,
       calls, round(total_exec_time::numeric,0) as toplam_ms, left(query, 120) as sorgu
from pg_stat_statements
where query ilike '%listings%' and query not ilike '%pg_stat%'
order by total_exec_time desc limit 10;

-- 0.2 Bozuk satır tahmini (ölçüldüğü hâliyle: 355 tahmin, 2934 gerçek)
explain (analyze, buffers)
select id from listings
where moderation_status = ANY(ARRAY['approved','auto_published'])
  and is_shadow_banned = false and status = 'active'
order by created_at desc limit 200;

-- 0.3 Vacuum/bloat durumu
select n_live_tup, n_dead_tup, last_vacuum, last_autovacuum
from pg_stat_user_tables where relname = 'listings';
-- ölçülen (7 Ağu, düzeltmeden önce): n_dead_tup 30559, last_vacuum NULL,
-- last_autovacuum 2026-07-31 (7+ gün önce)

-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================

-- 1.1 Genişletilmiş istatistik — planlayıcıya "bu üç kolon BAĞIMSIZ değil,
--     birlikte oluşma sıklıkları farklı" der. Yalnız istatistik EKLER, veri/şema
--     değiştirmez, tamamen güvenli ve geri alınabilir (bkz. BÖLÜM 3).
create statistics if not exists listings_aktiflik_korelasyon (dependencies, ndistinct)
  on moderation_status, is_shadow_banned, status
  from public.listings;

-- 1.2 İstatistikleri tazele (yeni CREATE STATISTICS'in etkili olması için şart)
analyze public.listings;

-- 1.3 Birikmiş bloat'u temizle + visibility map'i güncelle (Heap Fetch'leri sıfırlar)
vacuum (analyze, verbose) public.listings;

-- 1.4 Autovacuum eşiğini bu tabloya özel sıkılaştır — varsayılan %20 dead-tuple
--     eşiği bu tablonun yazma hacminde (toplu expire/reject cron'ları) çok gevşek;
--     %12'de bile 7 gün tetiklenmedi. %5'e çekildi.
alter table public.listings set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- =============================================================================
-- BÖLÜM 2 — DOĞRULA (7 Ağu 2026'da ölçülen gerçek sonuçlar)
-- =============================================================================
-- Ana sorgu (soğuk):  1711ms → 307ms (istatistik düzeldi, plan değişti)
-- Ana sorgu (sıcak):   307ms →   4ms  (400 KAT — ikinci koşumdan itibaren kararlı)
-- Sayım sorgusu:      1269ms →   8ms  (158 KAT — VACUUM sonrası Heap Fetches: 0)
--
-- Doğrulama sorgusu (BÖLÜM 0.2'yi tekrar çalıştır — artık "Rows Removed by
-- Filter" birkaç yüzü geçmemeli, "Sort"/heapsort adımı GÖRÜNMEMELİ):
explain (analyze, buffers)
select id from listings
where moderation_status = ANY(ARRAY['approved','auto_published'])
  and is_shadow_banned = false and status = 'active'
order by created_at desc limit 200;

select n_live_tup, n_dead_tup, last_vacuum from pg_stat_user_tables where relname = 'listings';
-- beklenen: n_dead_tup 0, last_vacuum bugünün tarihi

-- =============================================================================
-- BÖLÜM 3 — GERİ ALMA (gerekirse; VACUUM/ANALYZE geri alınamaz ama zararsızdır)
-- =============================================================================
-- drop statistics if exists public.listings_aktiflik_korelasyon;
-- alter table public.listings reset (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor);

-- =============================================================================
-- KOD TARAFI (ayrı commit, bu dosyanın kapsamı dışı ama aynı görevin parçası)
-- =============================================================================
-- `app/ilan/[id]/page.tsx`: `generateMetadata` ve sayfa bileşeni AYNI ilanı iki
-- ayrı sorguyla çekiyordu (her sayfa açılışında 2 DB gidiş-gelişi). `React.cache()`
-- ile TEK sorguya indirildi + auth kontrolü ilan sorgusuyla PARALEL atılmaya
-- başlandı (önceden ardışıktı). `/api/listings/ara` ve `HomeClient.tsx`'in
-- istemci yenilemesi AYNI tabloyu AYNI filtrelerle sorguluyor — kod değişikliği
-- gerekmedi, BÖLÜM 1'in DB düzeltmeleri onlara da otomatik yansıdı.
