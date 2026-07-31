-- ============================================================================
-- 20260731_index_temizligi.sql — KOPYA VE ÖLÜ INDEX TEMİZLİĞİ
-- ============================================================================
--
-- 🚨 BU DOSYA BAŞTAN SONA ÇALIŞTIRILMAZ. Ölçüm bölümleri (1, 2, 5) `select`;
-- silme bölümleri (3, 4) YORUMDA. Sıra: ölç → çıktıya bak → yorumu kaldır.
--
-- ── NEDEN VAR ───────────────────────────────────────────────────────────────
-- Dalga 3 keşfi sırasında (`docs/COGRAFI_GECIS.md`) iki ayrı bulgu çıktı:
--   1. `listing_stops` üzerinde ÜÇ adet özdeş `(listing_id)` indeksi,
--      `listings` üzerinde ÜÇ adet özdeş `(created_at desc)` indeksi.
--      Sorgu tarafında hiçbir faydası yok — planlayıcı yalnız birini seçer.
--      Maliyet her INSERT/UPDATE'te ödeniyor ve `listings` yazma yoğun bir
--      tablo (234k satır, günlük ilan akışı + moderasyon UPDATE'leri).
--   2. `raw_posts_dedup_idx` mantıksal olarak gereksiz (BÖLÜM 3).
--
-- Dalga 5'in düşüreceği METİN/TRIGRAM indeksleri (`idx_listings_origin_city*`,
-- `listing_stops_city_trgm_idx` …) BU DOSYADA DEĞİL — onlar metin kolonlarıyla
-- birlikte kendi migration'ında gider. BÖLÜM 5 yalnız onların boşta olduğunu
-- ölçüyor, düşürmüyor.
--
-- ── DEĞİŞMEZ KURALLAR ───────────────────────────────────────────────────────
-- K1. 🚨 ÖLÇMEDEN DÜŞÜRME. `pg_stat_user_indexes.idx_scan` sayaçları en son
--     istatistik sıfırlamasından beri birikir. BÖLÜM 2 sayaçla birlikte
--     `stats_reset` zamanını da döndürüyor: pencere bir haftadan kısaysa
--     "0 tarama" hiçbir şey KANITLAMAZ.
--
--     ⚠️ 31 Tem ölçümü K1'in ilk yazımını YALANLADI ve yerine daha keskin bir
--     kural koydu. Pencere kısa değildi — `stats_reset = 30 Mar 2026`, yani
--     **122,6 gün**. Ama Dalga 3 kodu **31 Tem'de** deploy edildi. Yani sayacın
--     ~%99'u DALGA 3 ÖNCESİ trafiği ölçüyor. Doğru kural şu:
--       • `idx_scan = 0` → GEÇERLİ kanıt (122 günde hiç kullanılmadıysa yeni
--         kodda da kullanılmaz; Dalga 3 metinden UZAKLAŞTIRDI, yaklaştırmadı).
--       • `idx_scan > 0` → METİN indeksleri için GEÇERSİZ; eski kod yolundan
--         kalma olabilir. Pencereyi sıfırlayıp yeniden ölç (BÖLÜM 7.A).
--     Kısacası: sayaç penceresinin uzunluğu değil, **kod değişikliğinden bu yana
--     geçen süre** belirleyici.
--
-- K2. 🚨 KISITI DESTEKLEYEN İNDEKS DÜŞÜRÜLMEZ. `drop index` bir PRIMARY KEY /
--     UNIQUE constraint'in indeksine denk gelirse `2BP01` verir. Daha sinsisi:
--     bir FK'nin referans verdiği unique indeksi düşürmek. BÖLÜM 1 sorgusu
--     `indisprimary`, `indisunique` ve `pg_constraint` bağını AÇIKÇA gösteriyor;
--     `kisit_var = true` olan hiçbir satıra dokunma.
--
-- K3. 🚨 `drop index concurrently` TRANSACTION İÇİNDE ÇALIŞMAZ (`25001`).
--     Supabase SQL editöründe birden çok ifadeyi birlikte çalıştırmak örtük tek
--     transaction demektir. CONCURRENTLY'li her satırı **TEK BAŞINA** çalıştır.
--     Alternatif: düz `drop index` — ama o tabloyu ACCESS EXCLUSIVE kilitler;
--     `listings` 234k satır ve canlı trafik alıyor, kilit süresi kısa da olsa
--     yazma yolunu bloklar. CONCURRENTLY tercih edilmeli.
--
-- K4. Kopya grubunda HANGİSİNİN kalacağı önemli: **kısıt destekleyen** ya da
--     en eski/en açıklayıcı adlı olan kalır. `idx_` önekli, elle eklenmiş
--     olanlar gider. BÖLÜM 4 bunu otomatik seçmiyor — sana DDL üretiyor, kararı
--     sen veriyorsun.
--
-- K5. Düşürmeden önce tanımı BİR YERE KAYDET. Geri alma tek yol: aynı
--     `pg_get_indexdef` metnini `create index concurrently` ile geri çalıştırmak.
--     BÖLÜM 4 ürettiği DDL'in yanında geri-alma DDL'ini de veriyor.
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 1 — KOPYA INDEX KEŞFİ  (salt okunur)
-- ───────────────────────────────────────────────────────────────────────────
-- Kopya tanımı: aynı tabloda, aynı kolon listesi + aynı sıralama + aynı kısmi
-- koşul + aynı erişim yöntemi. `pg_get_indexdef` metninden yalnız indeks ADI
-- çıkarılıp kalan imza karşılaştırılıyor.
--
-- ⚠️ `indexrelid::regclass::text` alıntılanmış ad döndürebilir; `format('%I')`
-- ile üretilen DDL zaten doğru alıntılıyor, elle tırnak EKLEME.

with idx as (
  select
    i.indexrelid,
    i.indrelid,
    n.nspname                                            as sema,
    c.relname                                            as tablo,
    ic.relname                                           as indeks,
    i.indisprimary                                       as pk_mi,
    i.indisunique                                        as unique_mi,
    exists (
      select 1 from pg_constraint k where k.conindid = i.indexrelid
    )                                                    as kisit_var,
    pg_relation_size(i.indexrelid)                       as boyut_bayt,
    pg_get_indexdef(i.indexrelid)                        as tanim,
    -- İmza: "create [unique] index <ad> on" kısmındaki ADI sil, gerisi kalsın.
    regexp_replace(
      pg_get_indexdef(i.indexrelid),
      '^CREATE (UNIQUE )?INDEX \S+ ON ',
      'CREATE \1INDEX <ad> ON '
    )                                                    as imza
  from pg_index i
  join pg_class      ic on ic.oid = i.indexrelid
  join pg_class      c  on c.oid  = i.indrelid
  join pg_namespace  n  on n.oid  = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
)
select
  sema,
  tablo,
  count(*)                                   as kopya_adedi,
  pg_size_pretty(sum(boyut_bayt))            as toplam_boyut,
  array_agg(indeks order by kisit_var desc, indeks) as indeksler,
  array_agg(kisit_var order by kisit_var desc, indeks) as kisit_var,
  array_agg(pk_mi     order by kisit_var desc, indeks) as pk_mi,
  array_agg(unique_mi order by kisit_var desc, indeks) as unique_mi,
  min(imza)                                  as ortak_tanim
from idx
group by sema, tablo, imza
having count(*) > 1
order by sum(boyut_bayt) desc;

-- BEKLENEN (Dalga 3 keşfine göre):
--   listing_stops · (listing_id)      · 3 adet
--   listings      · (created_at DESC) · 3 adet
-- Başka grup çıkarsa DURAKSA ve incele — bu dosya yalnız yukarıdaki ikisini
-- öngörüyordu, üçüncü bir grup ölçülmemiş bir karar demektir.


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 2 — KULLANIM ÖLÇÜMÜ  (salt okunur)  ⚠️ K1
-- ───────────────────────────────────────────────────────────────────────────
-- `idx_scan = 0` tek başına yeterli DEĞİL; `pencere_gun` sütununa bak.
-- Bir haftadan kısa pencerede sıfır tarama "kullanılmıyor" demek değildir —
-- yalnızca "bu kısa aralıkta kullanılmadı" demektir.

select
  s.relname                                   as tablo,
  s.indexrelname                              as indeks,
  s.idx_scan                                  as tarama,
  s.idx_tup_read                              as okunan_tuple,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as boyut,
  exists (select 1 from pg_constraint k where k.conindid = s.indexrelid) as kisit_var,
  sd.stats_reset                              as sayac_sifirlama,
  round(extract(epoch from (now() - sd.stats_reset)) / 86400.0, 1) as pencere_gun,
  case
    when sd.stats_reset is null then '❓ sayaç hiç sıfırlanmamış — pencere bilinmiyor'
    when extract(epoch from (now() - sd.stats_reset)) / 86400.0 < 7 then '⛔ PENCERE < 7 GÜN — KARAR VERME'
    when s.idx_scan = 0 then '✅ ölçülen pencerede hiç kullanılmadı'
    else '🟢 kullanımda — DOKUNMA'   -- (eskiden "DÜŞÜRME" yazıyordu; olumsuz
                                     --  emir kipi "düşürme" ile isim "düşürme"
                                     --  karışıp yanlış okunuyordu)
  end                                         as karar
from pg_stat_user_indexes s
join pg_stat_database sd on sd.datname = current_database()
where s.schemaname = 'public'
  and s.relname in ('listings', 'listing_stops', 'raw_posts')
order by s.relname, s.idx_scan, s.indexrelname;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 3 — `raw_posts_dedup_idx`  (mantıksal olarak gereksiz)
-- ───────────────────────────────────────────────────────────────────────────
-- Gerekçe (`docs/YAPILACAKLAR.md`, 28 Tem 2026):
--   `raw_posts_dedup_idx UNIQUE (clean_hash, contact_phone, message_date)`
--   ama `idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date)` DAHA
--   KATI. Üç kolonluk unique, iki kolonluk unique'in dayattığı kuralın üstüne
--   hiçbir şey ekleyemez — iki kolon zaten tekilse üçüncüsü hiçbir zaman
--   ayırt edici olamaz. Sorgu tarafında da karşılığı yok
--   (`idx_raw_posts_clean_hash` ayrıca mevcut). Kalan tek etkisi INSERT maliyeti.
--
-- ⚠️ ÖNCE DOĞRULA — yukarıdaki akıl yürütme İKİ İNDEKSİN DE hâlâ var ve
-- kısmi-olmadığı varsayımına dayanıyor. Kısmi (`WHERE …`) iseler kapsamları
-- ayrışabilir ve gerekçe çöker.

select
  ic.relname                     as indeks,
  i.indisunique                  as unique_mi,
  pg_get_indexdef(i.indexrelid)  as tanim,
  i.indpred is not null          as kismi_mi   -- 🚨 true ise BÖLÜM 3'ü UYGULAMA
from pg_index i
join pg_class ic on ic.oid = i.indexrelid
join pg_class c  on c.oid  = i.indrelid
where c.relname = 'raw_posts'
  and ic.relname in ('raw_posts_dedup_idx', 'idx_raw_posts_hash_msgdate', 'idx_raw_posts_clean_hash')
order by ic.relname;

-- Yukarıdaki çıktıda `idx_raw_posts_hash_msgdate` UNIQUE ve `kismi_mi = false`
-- ise (ya da ikisi de AYNI kısmi koşula sahipse) aşağıdakini TEK BAŞINA çalıştır:
--
--   drop index concurrently if exists public.raw_posts_dedup_idx;
--
-- GERİ ALMA:
--   create unique index concurrently raw_posts_dedup_idx
--     on public.raw_posts (clean_hash, contact_phone, message_date);
--   -- ⚠️ gerçek tanımı BÖLÜM 3'ün ilk sorgusundan KOPYALA; yukarıdaki
--   --    yeniden yazım kısmi koşulu ve kolon sırasını kaçırabilir.


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 4 — KOPYA INDEX DDL ÜRETİCİ  (salt okunur — DDL'i O ÇALIŞTIRMAZ)
-- ───────────────────────────────────────────────────────────────────────────
-- Her kopya grubunda BİR indeks tutulur, gerisi için `drop` + geri-alma DDL'i
-- üretilir. Tutulan seçimi (K4): kısıt destekleyen > PK > UNIQUE > en kısa ad.
--
-- 🚨 ÇIKTIYI OKUMADAN ÇALIŞTIRMA. Bu sorgu METİN döndürür; kopyalayıp
-- BÖLÜM 2'de `karar` sütunu uygun çıkan satırlar için, TEK TEK çalıştır (K3).

with idx as (
  select
    i.indexrelid,
    c.relname                     as tablo,
    ic.relname                    as indeks,
    i.indisprimary                as pk_mi,
    i.indisunique                 as unique_mi,
    exists (select 1 from pg_constraint k where k.conindid = i.indexrelid) as kisit_var,
    pg_relation_size(i.indexrelid) as boyut_bayt,
    pg_get_indexdef(i.indexrelid) as tanim,
    regexp_replace(
      pg_get_indexdef(i.indexrelid),
      '^CREATE (UNIQUE )?INDEX \S+ ON ',
      'CREATE \1INDEX <ad> ON '
    )                             as imza
  from pg_index i
  join pg_class     ic on ic.oid = i.indexrelid
  join pg_class     c  on c.oid  = i.indrelid
  join pg_namespace n  on n.oid  = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
),
grup as (
  select
    idx.*,
    row_number() over (
      partition by tablo, imza
      order by kisit_var desc, pk_mi desc, unique_mi desc, length(indeks), indeks
    ) as sira,
    count(*) over (partition by tablo, imza) as grup_boyu
  from idx
)
select
  tablo,
  indeks,
  pg_size_pretty(boyut_bayt)                       as boyut,
  '-- TUTULAN: ' || (
    select g2.indeks from grup g2
    where g2.tablo = grup.tablo and g2.imza = grup.imza and g2.sira = 1
  )                                                as not_,
  format('drop index concurrently if exists public.%I;', indeks) as dusur_ddl,
  tanim                                            as geri_alma_kaynak,
  -- Geri alma: aynı tanım, CONCURRENTLY eklenmiş hâli.
  regexp_replace(tanim, '^CREATE (UNIQUE )?INDEX ', 'CREATE \1INDEX CONCURRENTLY ')
                                                   as geri_alma_ddl
from grup
where grup_boyu > 1
  and sira > 1          -- 1. sıradaki TUTULUYOR
  and not kisit_var     -- K2: kısıt destekleyen asla listelenmez
order by tablo, boyut_bayt desc;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 5 — DALGA 5 ADAYLARI  (yalnız ÖLÇÜM — burada DÜŞÜRME)
-- ───────────────────────────────────────────────────────────────────────────
-- `origin_city` / `listing_stops.city` metin kolonları Dalga 5'te düşüyor;
-- onlara bağlı indeksler kolonla BİRLİKTE otomatik gider. Bu sorgunun amacı
-- düşürmek değil, Dalga 5 öncesi "bu indeksler gerçekten boşta mı" sorusunu
-- kanıtlamak — çünkü boşta DEĞİLLERSE metin kolonunu okuyan, haritada
-- kayıtlı olmayan bir tüketici var demektir ve Dalga 5 onu kırar.
--
-- 🚨 Buradaki `tarama > 0` bir PERFORMANS bulgusu değil, bir KAPSAM bulgusudur.

select
  s.relname                                        as tablo,
  s.indexrelname                                   as indeks,
  s.idx_scan                                       as tarama,
  pg_size_pretty(pg_relation_size(s.indexrelid))   as boyut,
  pg_get_indexdef(s.indexrelid)                    as tanim,
  case
    when s.idx_scan > 0
      then '🚨 KULLANILIYOR — metin kolonunu okuyan bir tüketici var, Dalga 5 öncesi BUL'
    else '✅ boşta'
  end                                              as karar
from pg_stat_user_indexes s
where s.schemaname = 'public'
  and (
        pg_get_indexdef(s.indexrelid) ilike '%origin_city%'
     or pg_get_indexdef(s.indexrelid) ilike '%destination_city%'
     or (s.relname = 'listing_stops' and pg_get_indexdef(s.indexrelid) ilike '%(city%')
     or pg_get_indexdef(s.indexrelid) ilike '%trgm%'
  )
order by s.idx_scan desc, s.relname;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 6 — DÜŞÜRME SONRASI DOĞRULAMA
-- ───────────────────────────────────────────────────────────────────────────
-- 6.1 — Kopya kalmadı mı? BÖLÜM 1'i tekrar çalıştır: **sıfır satır** dönmeli.
--
-- 6.2 — Hiçbir kısıt indekssiz kalmadı mı? Aşağıdaki sorgu **sıfır satır**
--       dönmeli. Satır dönerse bir kısıt indeksi yanlışlıkla düşürülmüş
--       demektir; BÖLÜM 4'ün `geri_alma_ddl` çıktısından hemen geri kur.

select
  conrelid::regclass as tablo,
  conname            as kisit,
  contype            as tur
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype in ('p', 'u', 'f')
  and conindid = 0;

-- 6.3 — Duman testi (uygulama tarafı, SQL değil):
--       ① ana sayfa açılıyor ve il filtresi sonuç veriyor
--       ② `/admin/radar` bir rota sorgusu tamamlanıyor (30 sn timeout'a takılmadan)
--       ③ WhatsApp ZIP içe aktarma bir dosya işliyor (`raw_posts` INSERT yolu —
--          BÖLÜM 3 uygulandıysa 23505 davranışı değişmemiş olmalı)
--
-- 6.4 — Planlayıcı istatistiklerini tazele (indeks düşürme sonrası ucuz ve faydalı):
--
--   analyze public.listings;
--   analyze public.listing_stops;
--   analyze public.raw_posts;


-- ═══════════════════════════════════════════════════════════════════════════
-- BÖLÜM 7 — 31 TEM 2026 ÖLÇÜM SONUCU VE KARARLAR
-- ═══════════════════════════════════════════════════════════════════════════
-- Bölüm 1/2/3/4/5 canlıda çalıştırıldı. Dört sonuç, dosyanın ilk varsayımlarını
-- değiştirdi. Aşağısı ölçülmüş karardır — yeniden ölçmeden değiştirme.
--
-- ── S1. PENCERE SORUN DEĞİLDİ, KOD DEĞİŞİKLİĞİ SORUNDU ─────────────────────
-- `stats_reset = 2026-03-30`, pencere **122,6 gün**. "6 Ağu'ya kadar bekle"
-- gerekçesi (kısa pencere) ÇÖKTÜ. Ama yerine daha dar bir gerekçe geldi:
-- Dalga 3 kodu 31 Tem'de deploy edildi, sayaç 122 günün 121'inde ESKİ kodu
-- ölçtü. Bu yüzden `> 0` metin indekslerinde kanıt değil, `= 0` hâlâ kanıt (K1).
--
-- ── S2. BEKLENMEYEN ÜÇÜNCÜ KOPYA GRUBU ─────────────────────────────────────
-- `shadow_profiles` üzerinde iki özdeş `(listing_count DESC)` indeksi:
-- `idx_shadow_profiles_listing_count` + `shadow_profiles_listing_count_idx`.
-- BÖLÜM 1'in "üçüncü grup çıkarsa DURAKSA" uyarısı tam da bunun için vardı.
-- 🚨 BÖLÜM 2 `shadow_profiles`'ı SORGULAMADI (where listesinde yok) — yani bu
-- iki indeksin kullanım verisi YOK. Ölçülmeden düşürülmez → BÖLÜM 7.C.
--
-- ── S3. `raw_posts_dedup_idx` KARARI TERSİNE DÖNDÜ ─────────────────────────
-- Kısıt gerekçesi AYAKTA ve ölçümle güçlendi:
--   dedup_idx  UNIQUE (clean_hash, contact_phone, message_date)
--              WHERE clean_hash IS NOT NULL AND contact_phone IS NOT NULL
--   hash_msgdate UNIQUE (clean_hash, message_date) WHERE clean_hash IS NOT NULL
-- İkisi de KISMİ; BÖLÜM 3 "kısmiyse uygulama" diyordu. Ama predikatlar
-- ayrışmıyor, **kapsıyor**: hash_msgdate'in satır kümesi dedup'ınkinin ÜST
-- kümesi. Üst kümede (clean_hash, message_date) tekilse, alt kümede de tekildir;
-- o hâlde (clean_hash, contact_phone, message_date) zorunlu olarak tekil.
-- ⇒ dedup_idx KISIT olarak gerçekten gereksiz.
--
-- 🚨 AMA SORGU OLARAK GEREKSİZ DEĞİL: **86.319 tarama**. Kıyas:
--   idx_raw_posts_clean_hash  83.358   (app: `.in('clean_hash', parca)`)
--   raw_posts_dedup_idx       86.319
--   idx_raw_posts_hash_msgdate 14.942
-- Unique kontrolü `_bt_check_unique` üzerinden gider ve `idx_scan`'i ARTIRMAZ;
-- ayrıca artırsaydı dedup (daha DAR predikat) hash_msgdate'ten AZ tarama
-- görürdü, 5,8 katı değil. Yani bunlar gerçek sorgu taramaları — planlayıcı
-- `clean_hash` öncüllü iki indeks arasında iş bölüştürüyor.
-- ⇒ KARAR: **DÜŞÜRME**. `docs/YAPILACAKLAR.md`:660'taki "sorgu tarafında
--   karşılığı yok" cümlesi ölçümle yanlışlandı. Düşürmek istenirse önce
--   BÖLÜM 7.D'deki EXPLAIN yapılmalı.
--
-- ── S4. BAYAT DOKÜMAN SATIRI (düşük önem) ──────────────────────────────────
-- `docs/YAPILACAKLAR.md`:649 bağlayıcı kuralı hâlâ
-- `idx_raw_posts_hash_day UNIQUE (clean_hash, post_date)` diye yazıyor.
-- Canlıda böyle bir indeks YOK — BÖLÜM 2 `raw_posts`'un tüm indekslerini döktü:
-- slh_unscanned, source, status, no_lane, hash_msgdate, clean_hash, dedup_idx,
-- pkey. Ama bu bir ayrışma değil, bayat satır: aynı dosyanın 661. satırı
-- `post_date` sadeleştirmesinin TAMAMLANDIĞINI ve kuralın `message_date`'e
-- taşındığını zaten yazıyor. 649 ondan önce yazılmış, güncellenmemiş.
-- `app/api/whatsapp-parse/route.ts`:488 yorumu canlıyla uyumlu. 649 düzeltildi.


-- ───────────────────────────────────────────────────────────────────────────
-- 7.A — SAYAÇ PENCERESİNİ SIFIRLA  (metin indeksleri için ön koşul)
-- ───────────────────────────────────────────────────────────────────────────
-- Dalga 5 kararı ancak DALGA 3 SONRASI trafikle verilebilir. Bunlar o üç
-- tablonun ve indekslerinin sayaçlarını sıfırlar; pencere bugünden başlar.
-- Yetki yoksa `42501` döner — o zaman sıfırlama atlanır, S1'deki asimetrik
-- yorum kuralı (0 = kanıt, >0 = kanıt değil) yürürlükte kalır.
--
-- ⚠️ ÖNCE 7.B'yi çalıştır: 7.B'nin dayandığı "122 günde 0 tarama" kanıtı
--    sıfırlamadan SONRA kaybolur.
--
--   select pg_stat_reset_single_table_counters('public.listings'::regclass);
--   select pg_stat_reset_single_table_counters('public.listing_stops'::regclass);
--   select pg_stat_reset_single_table_counters('public.raw_posts'::regclass);
--
-- Sonra ~7 gün bekle (≈ 7 Ağu 2026) ve BÖLÜM 5'i TEKRAR çalıştır.


-- ───────────────────────────────────────────────────────────────────────────
-- 7.B — BUGÜN DÜŞÜRÜLEBİLİR  (122 günlük sıfır tarama = yeterli kanıt)
-- ───────────────────────────────────────────────────────────────────────────
-- 🚨 HER SATIR TEK BAŞINA ÇALIŞTIRILIR (K3 — concurrently + örtük transaction).
-- Toplam kazanç ≈ 127 MB + her INSERT/UPDATE'te daha az indeks bakımı.
--
-- ── B1. Kopya grupları (K4 gereği: ÖLÇÜLEN DEĞİL, EN AZ ŞİŞMİŞ olan tutulur) ─
-- Üç özdeş indeksin üçünde de tarama görülmesi "üçü de gerekli" demek DEĞİL —
-- planlayıcı eşdeğer indeksler arasında keyfî seçer, iş dağılır. Düşürünce
-- yük hayatta kalana toplanır. BÖLÜM 4'ün ürettiği "TUTULAN" önerisi ad
-- uzunluğuna bakıyordu; burada BOYUTA göre EZİLDİ (aynı tanım, farklı boyut =
-- şişme; en küçüğü tut).
--
--   listing_stops (listing_id):  17MB + 13MB + 16MB
--     TUT:  listing_stops_listing_id_idx      (13 MB — en az şişmiş)
--     drop index concurrently if exists public.idx_listing_stops_listing_id;
--     drop index concurrently if exists public.idx_stops_listing;
--
--   listings (created_at DESC):  11MB + 10MB + 10MB
--     TUT:  listings_created_at_idx           (10 MB, 10.532 tarama)
--     drop index concurrently if exists public.idx_listings_created;
--     drop index concurrently if exists public.idx_listings_created_at;
--
-- ── B2. 122 günde HİÇ kullanılmamış metin indeksleri ────────────────────────
-- Bunlar Dalga 5'te kolonla birlikte zaten gidecek; erken düşürmek güvenli,
-- çünkü Dalga 3 sorguları metinden UZAKLAŞTIRDI — talep artamaz.
--
--   drop index concurrently if exists public.idx_listing_stops_city;             -- 21 MB
--   drop index concurrently if exists public.idx_listing_stops_city_listing_id;  -- 18 MB
--   drop index concurrently if exists public.listings_origin_city_created_at_idx;-- 17 MB
--   drop index concurrently if exists public.idx_listings_origin_city_created;   -- 17 MB
--   drop index concurrently if exists public.idx_listings_no_origin;             -- 8 kB
--
-- ⚠️ GERİ ALMA DDL'leri BÖLÜM 4/5 çıktısındaki `tanim` sütunundadır; düşürmeden
--    önce o çıktıyı bir yere yapıştır (K5). Ayrıca bu indekslerin bazıları eski
--    migration dosyalarında `create index` olarak duruyor — o dosyalar yeniden
--    çalıştırılırsa DİRİLİRLER (`docs/20260609_radar_analitik_perf.sql`,
--    `docs/20260610_shadow_profile_listing_count.sql`, `20260630_crm_*`).


-- ───────────────────────────────────────────────────────────────────────────
-- 7.C — `shadow_profiles` KOPYASI: ÖNCE ÖLÇ  (S2)
-- ───────────────────────────────────────────────────────────────────────────
select
  s.relname        as tablo,
  s.indexrelname   as indeks,
  s.idx_scan       as tarama,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as boyut,
  sd.stats_reset   as sayac_sifirlama
from pg_stat_user_indexes s
join pg_stat_database sd on sd.datname = current_database()
where s.schemaname = 'public'
  and s.relname = 'shadow_profiles'
order by s.idx_scan desc;

-- İkisi de özdeş `(listing_count DESC)` olduğu için hangisinin tutulacağı
-- performansı değiştirmez; küçük olanı tut, diğerini düşür (toplam 400 kB,
-- kazanç küçük — asıl fayda yazma yolundan bir indeks bakımı eksilmesi).


-- ───────────────────────────────────────────────────────────────────────────
-- 7.D — `raw_posts_dedup_idx` DÜŞÜRÜLMEK İSTENİRSE ÖNCE BU  (S3)
-- ───────────────────────────────────────────────────────────────────────────
-- 86k taramanın gerçekten `idx_raw_posts_clean_hash`'e devredilebilir olduğunu
-- kanıtla. Uygulamadaki sorgu `app/api/whatsapp-parse/route.ts`:464-465:
--   .select('id, clean_hash, message_date, contact_phone').in('clean_hash', …)
--
--   explain (analyze, buffers)
--   select id, clean_hash, message_date, contact_phone
--   from public.raw_posts
--   where clean_hash = any (array['<gerçek bir hash>']::text[]);
--
-- Plan `raw_posts_dedup_idx` seçiyorsa: düşürmeden önce aynı EXPLAIN'i
-- `set enable_indexscan`/`enable_bitmapscan` oynatarak DEĞİL,
-- `begin; drop index …; explain …; rollback;` ile dene — düz `drop index`
-- transaction içinde çalışır ve rollback geri alır (kilit kısa sürer).
