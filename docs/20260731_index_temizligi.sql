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
--
-- ── 7.C ÖLÇÜM SONUCU (31 Tem 2026) ─────────────────────────────────────────
--   idx_shadow_profiles_listing_count   24 tarama · 240 kB
--   shadow_profiles_listing_count_idx   12 tarama · 160 kB
-- İkisi de kullanımda; beklenen davranış (eşdeğer indeksler arasında planlayıcı
-- keyfî seçer, iş bölünür — B1'deki aynı akıl yürütme). KARAR: en az şişmiş
-- olanı tut.
--   TUT:  shadow_profiles_listing_count_idx   (160 kB)
--   drop index concurrently if exists public.idx_shadow_profiles_listing_count;
--
-- ⚠️ Bu ad iki migration dosyasında `create index` olarak duruyor
--    (`docs/20260610_shadow_profile_listing_count.sql`,
--     `docs/20260630_crm_denormalize_listing_count.sql`) — o dosyalar yeniden
--    çalıştırılırsa indeks DİRİLİR. Zararsız ama tekrar kopya olur.
--
-- ── BONUS: 122 günde hiç kullanılmamış ──────────────────────────────────────
--   drop index concurrently if exists public.shadow_profiles_created_at_idx;  -- 208 kB, 0 tarama
-- (Dalga 3 `shadow_profiles` sorgularına dokunmadı, yani buradaki 0 için
--  S1'deki "eski kod" çekincesi YOK — kanıt temiz.)


-- ───────────────────────────────────────────────────────────────────────────
-- 7.E — 🚨 BÖLÜM 1'İN KÖRLÜĞÜ: "UNIQUE ÜST-KÜMESİ" KOPYALARI
-- ───────────────────────────────────────────────────────────────────────────
-- 7.C çıktısı Bölüm 1'in yakalayamadığı bir kopya sınıfı gösterdi:
--   shadow_profiles_phone_key   48.868 tarama · 240 kB   (UNIQUE — kısıt)
--   shadow_profiles_phone_idx        61 tarama · 232 kB   (düz btree)
--
-- Bölüm 1 bunları kopya SAYMAZ, çünkü imzayı `pg_get_indexdef` metninden
-- çıkarıyor ve "CREATE UNIQUE INDEX …" ile "CREATE INDEX …" farklı metinler.
-- Oysa `(phone)` üzerindeki UNIQUE btree, düz btree'nin yapabildiği HER
-- sorguyu yapar — düz olan işlevsel olarak gereksizdir. Yani Bölüm 1 yalnız
-- METİNSEL kopyayı bulur, İŞLEVSEL kapsamayı bulmaz.
--
-- 🚨 K2 gereği kısıt destekleyen (`_key`) ASLA düşürülmez; düşürülecek olan
--    düz indekstir. Ama önce ikisinin AYNI kolon(lar)da olduğu doğrulanmalı —
--    ad benzerliği kanıt değil.

select
  ic.relname                    as indeks,
  i.indisunique                 as unique_mi,
  exists (select 1 from pg_constraint k where k.conindid = i.indexrelid) as kisit_var,
  i.indpred is not null         as kismi_mi,
  pg_get_indexdef(i.indexrelid) as tanim
from pg_index i
join pg_class ic on ic.oid = i.indexrelid
join pg_class c  on c.oid  = i.indrelid
where c.relname = 'shadow_profiles'
  and ic.relname in ('shadow_profiles_phone_key', 'shadow_profiles_phone_idx')
order by ic.relname;

-- ── 7.E DOĞRULAMA SONUCU (31 Tem 2026) ─────────────────────────────────────
--   shadow_profiles_phone_idx  düz btree (phone)   · kismi_mi=false
--   shadow_profiles_phone_key  UNIQUE btree (phone) · kismi_mi=false · kisit_var=true
-- Aynı kolon, ikisi de tam (kısmi değil), UNIQUE olan kısıt destekliyor.
-- ⇒ Kapsama KANITLANDI. K2 gereği `_key` dokunulmaz, düşürülecek olan düz indeks:
--   drop index concurrently if exists public.shadow_profiles_phone_idx;   -- 232 kB


-- 🚨 ÇALIŞTIRMA TUZAĞI (31 Tem'de yaşandı): aşağıdaki sorgu `with idx as (…)`
--    ile BAŞLIYOR. Supabase editöründe metni fareyle seçip çalıştırırken CTE'yi
--    dışarıda bırakmak kolay — o zaman `42P01: relation "idx" does not exist`
--    gelir. Sorgu HATALI DEĞİL, seçim eksik. `with`'ten `;`ye kadar tamamını al.
--    (BÖLÜM 1 ve BÖLÜM 4 sorguları da CTE'li — aynı tuzak orada da geçerli.)
--
-- ⚠️ Aynı sınıf hata tüm şemada olabilir. Genel tarama (yalnız ADAY listeler,
--    karar VERMEZ). SINIRLARI:
--      • Yalnız kolon ÖNEKİ kapsamasına bakar; `opclass`, `collation`, ASC/DESC
--        ve NULLS FIRST/LAST farkını GÖRMEZ. Aday çıkanı elle `pg_get_indexdef`
--        ile karşılaştır — sıralama farkı varsa kapsama İDDİASI ÇÖKER.
--      • İfade (expression) indekslerini dışlar: onlarda `indkey` 0 içerir ve
--        0'lar birbirine eşit görünüp SAHTE eşleşme üretir.
--      • Kısmi indeksleri dışlar (`indpred is null`) — predikat kapsaması ayrı iş.

with idx as (
  select
    c.relname     as tablo,
    ic.relname    as indeks,
    i.indisunique as unique_mi,
    exists (select 1 from pg_constraint k where k.conindid = i.indexrelid) as kisit_var,
    i.indrelid,
    i.indexrelid,
    -- 🚨 int2vector doğrudan int[]'e cast EDİLEMEZ; metinden geçmek tek güvenli yol.
    string_to_array(i.indkey::text, ' ')::int[] as kolonlar,
    pg_relation_size(i.indexrelid)             as boyut
  from pg_index i
  join pg_class     ic on ic.oid = i.indexrelid
  join pg_class     c  on c.oid  = i.indrelid
  join pg_namespace n  on n.oid  = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and i.indpred is null                        -- kısmi olanları dışla
    and i.indisvalid
    and 0 <> all (string_to_array(i.indkey::text, ' ')::int[])  -- ifade indeksini dışla
    -- 🚨 erişim yöntemi `pg_index`'te DEĞİL, indeksin `pg_class` satırında:
    --    `ic.relam`. (`i.indam` diye bir kolon yok → 42703.) GIN/GiST'i burada
    --    eliyoruz; trigram indeksleri btree kapsamasına girmez.
    and ic.relam = (select oid from pg_am where amname = 'btree')
)
select
  u.tablo,
  u.indeks                as kapsayan_unique,
  d.indeks                as gereksiz_aday,
  pg_size_pretty(d.boyut) as kazanc,
  pg_get_indexdef(u.indexrelid) as kapsayan_tanim,
  pg_get_indexdef(d.indexrelid) as aday_tanim,   -- 🚨 İKİSİNİ ELLE KARŞILAŞTIR
  format('drop index concurrently if exists public.%I;', d.indeks) as dusur_ddl
from idx u
join idx d
  on d.indrelid = u.indrelid
 and u.unique_mi
 and not d.unique_mi
 and not d.kisit_var
 and d.indexrelid <> u.indexrelid
 -- düz indeksin kolonları, unique indeksin kolon ÖNEKİ ise kapsanıyor demektir
 and u.kolonlar[1:array_length(d.kolonlar, 1)] = d.kolonlar
order by d.boyut desc;

-- ── 7.E ŞEMA TARAMASI SONUCU (31 Tem 2026) — 5 ADAY, HEPSİ GEÇERLİ ─────────
-- Beşinin de `aday_tanim`/`kapsayan_tanim` çifti elle karşılaştırıldı: hepsi düz
-- btree, aynı kolon öneki, DESC/opclass/collation farkı YOK. Kapsama geçerli.
--
--   pois            pois_google_place_id_idx   568 kB  ← pois_google_place_id_unique
--   shadow_profiles shadow_profiles_phone_idx  232 kB  ← shadow_profiles_phone_key
--   aliases         idx_aliases_alias          104 kB  ← aliases_alias_unique
--   aliases         idx_aliases_type            56 kB  ← idx_aliases_type_alias
--   poi_reviews     poi_reviews_poi_id_idx       8 kB  ← poi_reviews_poi_id_user_id_key
--
-- 🚨 SIRA TUZAĞI — `aliases`. Tabloda İKİ unique var:
--     aliases_alias_unique   UNIQUE (alias)
--     idx_aliases_type_alias UNIQUE (type, alias)
--   `alias` tek başına tekilse `(type, alias)` zorunlu olarak tekildir; yani
--   `idx_aliases_type_alias` KISIT olarak gereksiz ve ileride "gereksiz unique"
--   diye düşürülmeye aday. AMA `idx_aliases_type`'ı BUGÜN düşürmemizin tek
--   gerekçesi o indeks. İkisi arka arkaya düşerse `type` üzerinde hiç indeks
--   kalmaz. ⇒ `idx_aliases_type_alias` düşürülecekse ÖNCE `type` sorgusu olup
--   olmadığı ölçülmeli. (Pratikte `aliases` ~1900 satır ve uygulama tabloyu
--    `.range()` ile bütün çekiyor — `type` indeksi zaten marjinal.)
--
-- 🚨 ÜÇÜ ESKİ MIGRATION'DA `CREATE INDEX IF NOT EXISTS` OLARAK DURUYOR ve o
--    dosyalar yeniden çalıştırılırsa DİRİLİR. `IF NOT EXISTS` koruma değil —
--    indeks düşürülmüş olduğu için koşul sağlanır ve yeniden yaratılır.
--    31 Tem'de üçü de kaynağında yoruma alındı:
--      docs/20260601_shadow_profiles_crm.sql:21   (phone_idx + created_at_idx)
--      docs/20260615_poi_google_integration.sql:78 (pois_google_place_id_idx)
--      docs/20260610_poi_module.sql:113            (poi_reviews_poi_id_idx)
--    `idx_aliases_alias` / `idx_aliases_type` repoda YOK — panelden elle
--    yaratılmışlar, dolayısıyla dirilme riski taşımıyorlar.


-- ═══════════════════════════════════════════════════════════════════════════
-- 7.F — NİHAİ DÜŞÜRME LİSTESİ (31 Tem 2026 ölçümüyle onaylandı)
-- ═══════════════════════════════════════════════════════════════════════════
-- 🚨 HER SATIR AYRI ÇALIŞTIRILIR (K3). Toplam ≈ 128 MB.
-- 🚨 SIRA: önce bu blok, SONRA 7.A sıfırlama — sıfırlama bu kararların
--    dayandığı 122 günlük kanıtı siler.
--
-- ── Kopya gruplarında hayatta kalan (en az şişmiş olan) ─────────────────────
--   listing_stops (listing_id)      → TUT: listing_stops_listing_id_idx
--   listings      (created_at DESC) → TUT: listings_created_at_idx
--   shadow_profiles (listing_count) → TUT: shadow_profiles_listing_count_idx
--
-- drop index concurrently if exists public.idx_listing_stops_listing_id;        -- 17 MB
-- drop index concurrently if exists public.idx_stops_listing;                   -- 16 MB
-- drop index concurrently if exists public.idx_listings_created;                -- 11 MB
-- drop index concurrently if exists public.idx_listings_created_at;             -- 10 MB
-- drop index concurrently if exists public.idx_shadow_profiles_listing_count;   -- 240 kB
--
-- ── 122 günde sıfır tarama ──────────────────────────────────────────────────
-- drop index concurrently if exists public.idx_listing_stops_city;              -- 21 MB
-- drop index concurrently if exists public.idx_listing_stops_city_listing_id;   -- 18 MB
-- drop index concurrently if exists public.listings_origin_city_created_at_idx; -- 17 MB
-- drop index concurrently if exists public.idx_listings_origin_city_created;    -- 17 MB
-- drop index concurrently if exists public.idx_listings_no_origin;              -- 8 kB
-- drop index concurrently if exists public.shadow_profiles_created_at_idx;      -- 208 kB
--
-- ── UNIQUE kapsaması (7.E) ──────────────────────────────────────────────────
-- drop index concurrently if exists public.pois_google_place_id_idx;            -- 568 kB
-- drop index concurrently if exists public.shadow_profiles_phone_idx;           -- 232 kB
-- drop index concurrently if exists public.idx_aliases_alias;                   -- 104 kB
-- drop index concurrently if exists public.idx_aliases_type;                    -- 56 kB
-- drop index concurrently if exists public.poi_reviews_poi_id_idx;              -- 8 kB
--
-- ── DÜŞÜRÜLMEYECEK (bilerek) ───────────────────────────────────────────────
--   raw_posts_dedup_idx  — kısıt olarak gereksiz AMA 86.319 tarama (S3 / 7.D)
--   Bölüm 5'teki `tarama > 0` metin indeksleri — ölçüm penceresi Dalga 3'ü
--   kapsamıyor, karar ~7 Ağu'ya ertelendi (S1 / 7.A)
--
-- ── SONRASI ────────────────────────────────────────────────────────────────
--   1. BÖLÜM 1'i tekrar → sıfır satır
--   2. BÖLÜM 6.2'yi çalıştır → sıfır satır
--   3. 7.E taramasını tekrar → sıfır satır
--   4. analyze listings; analyze listing_stops; analyze raw_posts;
--      analyze shadow_profiles; analyze pois; analyze poi_reviews; analyze aliases;
--   5. Duman testi (6.3) + POI sayfası + moderatör alias öğrenme
--   6. EN SON 7.A sıfırlama


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


-- ═══════════════════════════════════════════════════════════════════════════
-- BÖLÜM 8 — 7.A SIFIRLAMA REDDEDİLDİ (42501) · TELAFİ YÖNTEMİ
-- ═══════════════════════════════════════════════════════════════════════════
-- 31 Tem 2026: `pg_stat_reset_single_table_counters` → `42501 permission
-- denied`. Supabase'de bu fonksiyon superuser'a bağlı; `postgres` rolü de
-- alamıyor. Yani 7.A ASLA çalışmayacak, "bir hafta bekle" planı olduğu gibi
-- ÇÖKTÜ: sayaç sıfırlanamıyorsa bir hafta beklemek, 122 günlük eski-kod
-- birikintisinin ÜSTÜNE bir hafta yeni veri koymaktan ibaret. Toplamın içinden
-- yeni haftayı ayıklayamazsın.
--
-- ── ÇÖZÜM: SIFIRLAMA YERİNE FARK (DELTA) ──────────────────────────────────
-- Sayacı sıfırlayamıyoruz ama BUGÜNKÜ DEĞERİNİ SAKLAYABİLİRİZ. Bir hafta sonra
-- yeni okumadan bugünkünü çıkarınca elde kalan, yalnız Dalga 3 sonrası trafik.
-- Sıfırlamayla matematiksel olarak aynı sonuç, üstelik yıkıcı değil (başka
-- hiçbir ölçümü bozmuyor) ve superuser istemiyor.


-- ───────────────────────────────────────────────────────────────────────────
-- 8.A — TABAN ÇİZGİSİ (BUGÜN ÇALIŞTIR — hafta buradan başlar)
-- ───────────────────────────────────────────────────────────────────────────
-- Tüm public indekslerini alıyoruz, yalnız metin indekslerini değil: ileride
-- başka bir soru çıkarsa aynı tabandan cevaplanabilsin.
create table if not exists public.idx_taban_20260731 as
select
  now()                                     as alindi,
  s.relname                                 as tablo,
  s.indexrelname                            as indeks,
  s.idx_scan                                as tarama,
  s.idx_tup_read                            as okunan_tuple,
  sd.stats_reset                            as sayac_sifirlama
from pg_stat_user_indexes s
join pg_stat_database sd on sd.datname = current_database()
where s.schemaname = 'public';

-- Kontrol: satır geldi mi?
-- select count(*), min(alindi), min(sayac_sifirlama) from public.idx_taban_20260731;


-- ───────────────────────────────────────────────────────────────────────────
-- 8.B — FARK SORGUSU  (~7 Ağu 2026'da çalıştır)
-- ───────────────────────────────────────────────────────────────────────────
-- 🚨 `sayac_sifirlama` KONTROLÜ ŞART. Postgres yeniden başlarsa veya crash
--    recovery olursa istatistik dosyası sıfırlanır ve sayaç geri sayar; o
--    zaman `simdi - taban` NEGATİF çıkar. Negatif fark "kullanılmadı" DEĞİL,
--    "taban geçersiz" demektir — pencere o an yeniden başlamıştır, `simdi`
--    değerinin kendisi yeni penceredir.
select
  t.tablo,
  t.indeks,
  t.tarama                    as taban_31tem,
  s.idx_scan                  as simdi,
  s.idx_scan - t.tarama       as fark,
  round(extract(epoch from (now() - t.alindi)) / 86400.0, 1) as gecen_gun,
  pg_size_pretty(pg_relation_size(s.indexrelid))             as boyut,
  case
    when sd.stats_reset is distinct from t.sayac_sifirlama
      then '⛔ SAYAÇ ARADA SIFIRLANMIŞ — taban geçersiz, `simdi` sütununu oku'
    when s.idx_scan - t.tarama = 0
      then '✅ Dalga 3 sonrası HİÇ kullanılmadı — Dalga 5 için serbest'
    else '🚨 Dalga 3 sonrası KULLANILIYOR — tüketiciyi bul (8.C), düşürme'
  end                         as karar
from public.idx_taban_20260731 t
join pg_stat_user_indexes s
  on s.schemaname = 'public'
 and s.relname = t.tablo
 and s.indexrelname = t.indeks
join pg_stat_database sd on sd.datname = current_database()
where t.indeks in (
  'idx_listings_origin',
  'idx_listings_origin_city',
  'idx_listings_origin_city_lower',
  'listings_origin_city_trgm_idx',
  'listing_stops_city_idx',
  'listing_stops_city_trgm_idx',
  'idx_listing_stops_city_lower'
)
order by fark desc;


-- ───────────────────────────────────────────────────────────────────────────
-- 8.C — TÜKETİCİ AVI: metin kolonlarına DB İÇİNDEN dokunan ne var?
-- ───────────────────────────────────────────────────────────────────────────
-- Beklemeye gerek yok, bu bugün çalıştırılabilir. Kod taraması yalnız TS/Deno
-- dosyalarını görür; `lower()` ve trigram indekslerini kullanan sorgular büyük
-- ihtimalle DB İÇİNDEKİ fonksiyonlarda (radar/nearby RPC'leri) — onlar
-- repodaki .sql dosyalarının canlı karşılığı olmayabilir (docs ≠ canlı DB).
-- 🚨 31 Tem — BU SORGUNUN İLK SÜRÜMÜ SINIFLANDIRMA YAPIYORDU VE BOZUKTU.
--    `lower\s*\(\s*[a-z_.]*origin_city` deseni `lower((origin_city)::text)`
--    biçimini KAÇIRIYOR: kolon adından önce fazladan bir `(` var ve
--    `[a-z_.]*` parantez eşleştirmiyor. Postgres kaynağı TAM OLARAK böyle
--    yazdırır (indeks tanımına bak: `btree (lower((origin_city)::text), …)`).
--    Yani her fonksiyon sessizce `else` dalına düşüp "düz eşitlik / IN"
--    görünüyordu — yanlış negatif, üstelik güven verici yönde.
--    Ders: fonksiyon gövdesini SINIFLANDIRMA, EŞLEŞEN SATIRI DÖNDÜR.
--    Sınıflandırmada regex hatası sessizce yanlış cevap üretir; ham satırda
--    hata gözle görülür.
select
  p.proname                        as fonksiyon,
  p.provolatile                    as volatilite,
  trim(satir)                      as eslesen_satir
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as satir
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and satir ~* '(origin_city|destination_city|\mcity\M)'
order by p.proname, satir;

-- View'lar ve RLS politikaları da sorgu üretir — onları da tara:
-- select schemaname, viewname from pg_views
--  where schemaname = 'public' and definition ~* '(origin_city|destination_city)';
-- select polrelid::regclass as tablo, polname,
--        pg_get_expr(polqual, polrelid) as kosul
--   from pg_policy
--  where pg_get_expr(polqual, polrelid) ~* '(origin_city|destination_city|\mcity\M)';


-- ───────────────────────────────────────────────────────────────────────────
-- 8.D — KODDAN ÇIKAN İLK TÜKETİCİ (31 Tem 2026, doğrulandı)
-- ───────────────────────────────────────────────────────────────────────────
-- `app/api/admin/learn-aliases/route.ts`:437
--   .from('listings').update({ slh_scanned_at: … })
--   .is('slh_scanned_at', null).in('origin_city', kesfedilenNorm);
--
-- Bu bir UPDATE ... WHERE origin_city IN (…) — `idx_listings_origin` (düz btree,
-- 110 tarama) için birebir uyuyor. Sıklık de uyuyor: yalnız "AI Keşfi Başlat"
-- yeni alias bulduğunda çalışır, yani 122 günde onlarca kez. Bugün panelden
-- keşif çalıştırıldı (Görev #22) — o taramalardan biri muhtemelen bu.
--
-- ⚠️ Ama `lower()` ve trigram indekslerini AÇIKLAMIYOR. Onlar `lower(x)=…` veya
--    `ILIKE '%…%'` ister; TS tarafında böyle bir sorgu YOK. Demek ki kaynak DB
--    içinde — 8.C onu bulacak.
--
-- ── Dalga 5 için anlamı ────────────────────────────────────────────────────
-- Bu satır kolon silinmeden ÖNCE `province_id`'ye çevrilmeli:
--   .in('origin_province_id', kesfedilenNorm.map(il_key))
-- Aksi halde Dalga 5'te kolon düştüğü an AI Keşfi 42703 ile patlar.


-- ───────────────────────────────────────────────────────────────────────────
-- 8.E — 8.C İLK TURU (31 Tem 2026) VE OKUNUŞU
-- ───────────────────────────────────────────────────────────────────────────
-- Metin kolonlarına dokunan DÖRT fonksiyon çıktı:
--   get_nearby_listings_by_province   (STABLE)
--   get_radar_city_detail             (STABLE)
--   get_radar_city_overview           (STABLE)
--   ilan_olustur                      (VOLATILE)
--
-- ⚠️ Aynı turda dönen `kullanim_bicimi` sütunu ÇÖPTÜR — yukarıdaki regex
--    hatası yüzünden dördü de `else` dalına düşmüştü. Fonksiyon LİSTESİ
--    geçerli (o filtre düz kolon adı arıyordu, doğru çalıştı); biçim
--    sınıflandırması geçersiz. Düzeltilmiş satır bazlı sorgu tekrar
--    çalıştırılmalı.
--
-- ── Yine de listenin kendisi çok şey söylüyor ──────────────────────────────
-- Üç radar/nearby fonksiyonu Dalga 3'ün HEDEFİYDİ; ILIKE'tan `province_id`'ye
-- geçirildiler. `ilan_olustur` ise YAZAR — INSERT `idx_scan` ARTIRMAZ, indeks
-- ekleme sayacı ayrıdır. Dolayısıyla `lower()` / trigram indekslerini besleyen
-- CANLI bir tüketici görünmüyor.
--
-- Bu, 122 günlük sayaçlardaki 44 / 29 / 25 / 24 taramanın büyük olasılıkla
-- **Dalga 3 ÖNCESİ ILIKE'lı RPC sürümlerinden kalma kalıntı** olduğu anlamına
-- gelir — tam da S1'in "`> 0` kanıt değildir" dediği durum. Beklenti: 8.B
-- farkı 7 Ağu'da bu dört indekste **0** çıkacak.
--
-- 🚨 TEK BAŞINA YETMEZ, ÇÜNKÜ FONKSİYON HER ŞEY DEĞİL. Tarama üreten üç kaynak
--    daha var ve 8.C onları KAPSAMIYOR:
--      • VIEW tanımları
--      • RLS politikaları (`pg_policy`)
--      • Uygulamadan gelen ham sorgular (PostgREST `or=`, `ilike=` filtreleri —
--        DB'de saklı değildir, koddan gelir)
--    İlk ikisi için aşağıdaki iki sorgu; üçüncüsü için kod taraması (8.D).

-- View'lar:
select schemaname, viewname
from pg_views
where schemaname = 'public'
  and definition ~* '(origin_city|destination_city|\mcity\M)';

-- RLS politikaları:
select polrelid::regclass as tablo,
       polname,
       pg_get_expr(polqual, polrelid)      as using_kosulu,
       pg_get_expr(polwithcheck, polrelid) as with_check_kosulu
from pg_policy
where coalesce(pg_get_expr(polqual, polrelid), '') ~* '(origin_city|destination_city|\mcity\M)'
   or coalesce(pg_get_expr(polwithcheck, polrelid), '') ~* '(origin_city|destination_city|\mcity\M)';


-- ───────────────────────────────────────────────────────────────────────────
-- 8.F — TÜKETİCİ AVI KAPANDI (31 Tem 2026)
-- ───────────────────────────────────────────────────────────────────────────
-- Üç kanalın üçü de tarandı. Sonuç: metin kolonlarını WHERE'de kullanan
-- CANLI tek bir tüketici var, o da uygulamada.
--
-- ── Kanal 1: DB fonksiyonları (8.C, satır bazlı) ───────────────────────────
-- Dört fonksiyon eşleşti, DÖRDÜ DE YANLIŞ POZİTİF ya da yazma:
--   • get_radar_city_detail / get_radar_city_overview
--     Eşleşen satırların tamamı `'city'` jsonb ANAHTARI veya `p.name as city`
--     — yani `provinces.name`. `listings.origin_city` ile ilgisi yok.
--     `\mcity\M` kelime sınırı deseninin yakaladığı gürültü.
--   • get_nearby_listings_by_province
--     `po.name as origin_city` → yine `provinces`, çıktı kolonu ADLANDIRMASI.
--     `RETURNS TABLE(... origin_city text ...)` → imza. Bir de listing_stops
--     projeksiyonunda `city` geçiyor: PROJEKSİYON tarama üretmez, tarama için
--     WHERE gerekir.
--   • ilan_olustur (VOLATILE)
--     `il_key(p.name) = il_key(p_listing->>'origin_city')` → soldaki
--     `provinces`, sağdaki JSON GİRDİSİ. `listings` taranmıyor. Kalanı INSERT
--     kolon listesi. 🚨 INSERT `idx_scan` ARTIRMAZ — indekse yazma ayrı sayaç.
--
-- ── Kanal 2: View'lar ve RLS politikaları (8.E) ────────────────────────────
--   İkisi de SIFIR SATIR.
--
-- ── Kanal 3: Uygulamadan gelen ham PostgREST sorguları ─────────────────────
--   Tüm TS/TSX taraması yapıldı. `origin_city` / `stops.city` geçen her yer
--   ya `select` kolon listesi, ya JSX gösterimi, ya da FETCH SONRASI bellek
--   içi JS filtresi (`moderator/page.tsx`:297,301 · `PanelClient.tsx`:242 —
--   `.toLowerCase().includes()` DB'ye gitmez).
--   TEK İSTİSNA — `app/api/admin/learn-aliases/route.ts`:437
--     .from('listings').update({slh_scanned_at}).in('origin_city', …)
--
-- ── KARAR ──────────────────────────────────────────────────────────────────
-- `idx_listings_origin` (+ muhtemelen kısmi ikizi `idx_listings_origin_city`)
--   → CANLI tüketicisi var: yukarıdaki IN sorgusu. Eşitlik/IN düz btree'ye
--     birebir uyar, seyrekliği de uyar (yalnız AI Keşfi yeni alias bulunca).
-- `idx_listings_origin_city_lower`, `listings_origin_city_trgm_idx`,
-- `idx_listing_stops_city_lower`, `listing_stops_city_trgm_idx`
--   → `lower(x)=…` veya `ILIKE '%…%'` ister; ÜÇ KANALIN HİÇBİRİNDE YOK.
--     44/29/25/24 tarama, Dalga 3 öncesi ILIKE'lı RPC sürümlerinden KALINTI.
--     Beklenti: 8.B farkı 7 Ağu'da bunlarda 0.
--
-- ── learn-aliases:437 BİLEREK ŞİMDİ DEĞİŞTİRİLMEDİ ────────────────────────
-- Dalga 5'ten önce `origin_province_id`'ye çevrilmesi ŞART (kolon düştüğü an
-- 42703). Ama BUGÜN çevirmiyoruz, çünkü 8.B ölçümünün POZİTİF KONTROLÜ o:
-- 7 Ağu'da `idx_listings_origin` farkı > 0 ve diğer dördü 0 çıkarsa, ölçümün
-- gerçekten çalıştığını biliriz. Hepsi birden 0 çıkarsa ayırt edemeyiz —
-- "tüketici yok" ile "ölçüm bozuk/hiç trafik gelmemiş" aynı görünür.
-- Sırası: 8.B okunur → sonra kod çevrilir → sonra Dalga 5.
