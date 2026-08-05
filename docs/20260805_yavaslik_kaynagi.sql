-- ============================================================================
-- #66 — YAVAŞLIĞIN KAYNAĞI: gövdeleri oku, tahmin etme
-- 5 Ağustos 2026 · SALT OKUNUR
-- ============================================================================
--
-- ⚠️ ÖNCE BİR UYARI, KENDİ ÖLÇÜMÜM HAKKINDA:
--    BÖLÜM 14c çıktısındaki şu satırlar ÜRETİM DEĞİL, BİZİM göç sorgularımız:
--      `with hatali as (... aliases ...)`            1 çağrı, 100.9 sn
--      `select il_key(origin_city) ... group by`     2 çağrı, 33.6 sn
--      `update listing_stops set province_id ...`    3 çağrı, 18.5 sn
--      `update listings set origin_province_id ...`  1 çağrı, 43.7 sn
--      `select ... translate(lower(...origin_district...))` 1 çağrı, 28.0 sn
--    Bunları bulgu diye okumak kendi gürültümü kanıt sanmak olur. Hariç tutuldu.
--
-- ÜRETİMDE GERÇEKTEN AĞIR OLANLAR (14b, çağrı sayısı × ortalama):
--   1. UPDATE listings SET status WHERE expires_at < now()
--         7 481 çağrı · ort 1 160 ms · TOPLAM 8 678 sn   ← EN BÜYÜK TÜKETİCİ
--   2. ilan_olustur RPC
--         2 243 çağrı · ort 2 292 ms · en kötü 29 733 ms · toplam 5 141 sn
--   3. INSERT INTO listings (PostgREST yolu)
--         5 003 çağrı · ort 1 022 ms · en kötü 29 758 ms · toplam 5 113 sn
--
-- 👉 3'ün anlamı kritik: `listing_stops` INSERT'i 236 419 çağrıda ort 16.5 ms —
--    yani HIZLI. Yavaş olan `listings` INSERT'inin KENDİSİ. Saf bir INSERT
--    1 saniye sürmez. Aradaki fark TRIGGER'lardır.
--
-- BÖLÜM 14'ün bulduğu trigger'lar:
--   listings  BEFORE INSERT  audit_listing_fn()
--   listings  BEFORE INSERT  set_listing_expires_at()          (expires_at null iken)
--   listings  AFTER  I/U/D   sync_shadow_profile_listing_stats()  ⎫ 🚨 İKİSİ DE
--   listings  AFTER  I/U/D   sync_shadow_profile_listing_count()  ⎭ AYNI KOLONDA
--   raw_posts AFTER  INSERT  trigger_parse_listing()
--
-- 🚨 İKİ HİPOTEZ — İKİSİ DE GÖVDE OKUNMADAN DOĞRULANAMAZ:
--   (H1) `sync_shadow_profile_listing_stats` ve `..._count` AYNI İŞİ iki kez
--        yapıyor. İkisi de `shadow_profiles`taki AYNI SATIRI güncelliyorsa, aynı
--        telefondan gelen her ilan o satırda sıraya girer — hem çift maliyet hem
--        de kilit çekişmesi. Log'daki 55P03 (lock timeout) buraya işaret ediyor.
--   (H2) `audit_listing_fn` her INSERT'te ağır bir tarama yapıyor (mükerrer
--        arama, geçmiş ilan sayımı vb.) ve 1 saniyenin çoğu orada geçiyor.
--
-- VE ZİNCİRİN BAŞI: `on_raw_post_insert` HER SATIR İÇİN edge function tetikliyor.
--   Toplu alım = eşzamanlı N invocation. `max_connections = 60`. Havuz bu yüzden
--   tükeniyor — 4 Ağu 17:00'de tek saatte 214 post işlendi.
-- ============================================================================


-- ============================================================================
-- BÖLÜM 16 — Trigger fonksiyon gövdeleri. H1 ve H2 buradan karara bağlanır.
-- ============================================================================
select 'BÖLÜM 16 — gövdeler' as bolum,
       p.proname                        as fonksiyon,
       pg_get_functiondef(p.oid)        as govde
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'audit_listing_fn',
    'set_listing_expires_at',
    'sync_shadow_profile_listing_stats',
    'sync_shadow_profile_listing_count',
    'trigger_parse_listing'
  )
order by 2;


-- ============================================================================
-- BÖLÜM 17 — 👉 EN BÜYÜK TÜKETİCİ: süre dolumu taraması.
-- 7 481 çağrı × ort 1 160 ms. Bu sorgu bir CRON olmalı; bu sıklık onun her
-- istekte koştuğunu düşündürüyor. Önce ŞU sorulur: taranacak indeks var mı?
-- ============================================================================
select 'BÖLÜM 17 — listings indeksleri' as bolum,
       i.relname                                        as indeks,
       pg_get_indexdef(x.indexrelid)                    as tanim,
       pg_size_pretty(pg_relation_size(x.indexrelid))   as boyut,
       s.idx_scan                                       as tarama
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
left join pg_stat_user_indexes s on s.indexrelid = x.indexrelid
where t.relname = 'listings'
order by 2;

-- 🚨 `(status, expires_at)` üzerinde indeks YOKSA o UPDATE her seferinde
--    tüm `listings`i tarıyor demektir — ve tararken satır kilidi alıyor.
--    `ilan_olustur`un INSERT'i aynı tabloya yazmaya çalışırken bekliyor.
--    İkisi birlikte havuzu tüketiyor. Bu bir tahmin; indeks listesi karar verir.

-- Tabloların boyutu — 1 160 ms'nin makul olup olmadığını anlamak için.
select 'BÖLÜM 17b — tablo boyutları' as bolum,
       relname                                   as tablo,
       n_live_tup                                as canli_satir,
       pg_size_pretty(pg_total_relation_size(relid)) as toplam_boyut
from pg_stat_user_tables
where relname in ('listings', 'listing_stops', 'raw_posts', 'shadow_profiles', 'aliases')
order by 3 desc;


-- ============================================================================
-- BÖLÜM 18 — Süre dolumu UPDATE'ini KİM çağırıyor? Kaynak repoda aranacak,
-- ama önce şu: gerçekten sürekli mi koşuyor, yoksa sayaç eski mi?
-- ============================================================================
select 'BÖLÜM 18 — pg_stat_statements yaşı' as bolum,
       stats_reset                              as sayaclarin_sifirlanma_ani,
       now() - stats_reset                      as kapsanan_sure
from pg_stat_statements_info;

-- 7 481 çağrının kaç günlük olduğu bilinmeden "sürekli koşuyor" DENEMEZ.
-- Kapsanan süre 30 günse günde ~250 çağrı; 1 günse saatte ~310. Çok farklı iki
-- dünya, iki farklı düzeltme.

-- ⚠️ O UPDATE REPODA YOK. `grep -rn "expires_at" app lib supabase` içinde onu
--    yazan tek bir satır çıkmadı — yani çağıran TypeScript değil. Geriye iki
--    ihtimal kalıyor: pg_cron işi, ya da başka bir DB fonksiyonunun içi.
select 'BÖLÜM 18b — pg_cron işleri' as bolum, *
from cron.job;
-- 42P01 gelirse pg_cron kurulu değil → çağıran bir DB fonksiyonudur, alta bak.

select 'BÖLÜM 18c — o UPDATE''i içeren fonksiyonlar' as bolum,
       n.nspname                                as sema,
       p.proname                                as fonksiyon
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ~* 'expires_at\s*<\s*now\(\)'
order by 2, 3;


-- ============================================================================
-- BÖLÜM 19 — `pending` yığınının iki yarısı ayrı ayrı neye benziyor?
-- BÖLÜM 13c: 2 055 satırın İLANI VAR (yalnız durum yazımı düşmüş, yeniden
-- işlenirse 7 546 MÜKERRER ilan doğar) · 5 134 satırın ilanı YOK (gerçek kayıp).
-- Kurtarma yazmadan önce ikinci grubun ne olduğunu görmek gerek: gerçek yük
-- ilanı mı, yoksa sohbet/duyuru mu?
-- ============================================================================
select 'BÖLÜM 19 — ilansız pending, tarih dağılımı' as bolum,
       date_trunc('month', r.created_at)::date   as ay,
       count(*)                                  as satir,
       count(*) filter (where r.is_repost)       as repost,
       round(avg(length(r.raw_text)))            as ort_uzunluk
from public.raw_posts r
left join public.listings l on l.raw_post_id = r.id
where r.processing_status = 'pending'
  and r.created_at < now() - interval '1 hour'
  and l.id is null
group by 2
order by 2;

select 'BÖLÜM 19b — ilansız pending örnekleri' as bolum,
       r.created_at,
       r.is_repost,
       replace(left(r.raw_text, 200), chr(10), ' ⏎ ') as metin
from public.raw_posts r
left join public.listings l on l.raw_post_id = r.id
where r.processing_status = 'pending'
  and r.created_at < now() - interval '1 hour'
  and l.id is null
order by random()
limit 30;
