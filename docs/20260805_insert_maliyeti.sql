-- ============================================================================
-- #66/#67 — 1.4 SANİYE NEREDE GEÇİYOR? İndeks bakımı hipotezi.
-- 5 Ağustos 2026 · SALT OKUNUR (ADIM 3 hariç, o da ANALYZE)
-- ============================================================================
--
-- 31 DAKİKA 14 SANİYELİK PENCERE NE GÖSTERDİ:
--
-- 📊 TRAFİK YÜKSEK: 474 RPC çağrısı / 31 dk = saatte ~912.
--    Daha önce "patlama" dediğim 4 Ağu 17:00 saatinde 214 post vardı.
--    Şu an ondan dört kat yoğun ve sistem ayakta. Bu bir bulgu.
--
-- 🚨 KENDİ ÇERÇEVEMİ DÜZELTİYORUM — HAVUZ TÜKENMİŞ DEĞİL:
--    pg_stat_activity: 13-14 idle, 1 active, toplam ~16. `max_connections = 60`.
--    Postgres havuzunun yakınına bile gelinmiyor. Yani PGRST003 hatası
--    Postgres'in `max_connections`ından DEĞİL, PostgREST'in KENDİ havuzundan
--    geliyor — o havuz çok daha küçük (Supabase'de tipik 10-15).
--    Sonuç değişmiyor ama SEBEP değişiyor: `max_connections`ı büyütmek
--    bu sorunu ÇÖZMEZ. Çözüm sorguyu hızlandırmak ya da eşzamanlılığı azaltmak.
--    (Not: 107 gündür `idle` duran bir bağlantı var — pooler'ın tuttuğu,
--     `idle in transaction` değil, zararsız. Ama orada durduğunu bilelim.)
--
-- ⚠️ KENDİ GÜRÜLTÜM, YİNE: en pahalı 3-5. sıradaki şu ifadeler ÜRETİM DEĞİL:
--      `SELECT e.name, n.nspname ... default_version`   6 çağrı · 6 715 ms
--      `with f as (... arg_modes ...)`                  6 çağrı · 5 732 ms
--      `SELECT tbl.schemaname ... json_agg(a)`          6 çağrı · 4 740 ms
--    Bunlar Supabase Studio'nun otomatik tamamlama şema taramaları — yani
--    SQL editörünü açık tutmanın bedeli. 18 çağrı, 103 saniye DB zamanı.
--    Ölçüm yaparken editörü açık bırakmak ölçümü kirletiyor. Hariç tutuldu.
--
-- ❌ İNDEKS OLUŞTU AMA KULLANILMIYOR:
--      idx_listings_expire_sweep · btree(expires_at) where status='active'
--      idx_scan = 0
--    Süre dolumu UPDATE'i pencerede 2 kez koştu (*/15 cron ile tutarlı),
--    ort 1 540 ms — tabandaki 1 160 ms'den YAVAŞ. n=2, istatistiksel olarak
--    hiçbir şey söylemez, ama indeksin kullanılmadığı kesin.
--    En olası sebep: planlayıcı `status='active'` satırlarının çoğunun zaten
--    süresi dolmuş olduğunu tahmin ediyor → seq scan daha ucuz görünüyor.
--    ADIM 3 bunu ANALYZE + EXPLAIN ile karara bağlıyor.
--
-- 👉 YENİ VE DAHA GÜÇLÜ HİPOTEZ (H3) — TRIGGER DEĞİL, İNDEKS BAKIMI:
--    BÖLÜM 17'de `listings` üzerinde YİRMİ indeks çıkmıştı, tablo 532 MB.
--    Her INSERT yirmi ayrı B-tree'ye (varsa GIN'e) yazmak zorunda.
--    Karşılaştırma: `listing_stops` INSERT'i 236 419 çağrıda ort 16.5 ms —
--    ve o tablonun indeksi az. Aradaki fark tam da bu olabilir.
--    GIN / trigram / tsvector indeksi varsa saniyenin çoğu oradadır:
--    GIN eklemesi B-tree'den bir büyüklük mertebesi pahalıdır.
--
--    H3 doğruysa çözüm trigger avlamak değil, KULLANILMAYAN İNDEKSLERİ
--    düşürmek. `idx_scan = 0` olan her indeks saf yazma maliyeti demektir.
-- ============================================================================


-- ============================================================================
-- ADIM 1 — 👉 H3'ün sınavı. Yöntem, boyut, TARAMA SAYISI.
-- `tarama = 0` olan indeks: hiç okunmuyor, her INSERT'te yazılıyor.
-- ⚠️ `tarama` sayaçları `pg_stat_reset` ile sıfırlanır, `pg_stat_statements_reset`
--    ile DEĞİL — yani bu sayılar 107 günlük, uzun vadeli ve güvenilir.
--    (idx_listings_expire_sweep'in 0'ı ise 31 dakikalık, ayrı okunmalı.)
-- ============================================================================
select 'ADIM 1 — listings indeks maliyeti' as adim,
       am.amname                                        as yontem,
       i.relname                                        as indeks,
       pg_size_pretty(pg_relation_size(x.indexrelid))   as boyut,
       coalesce(s.idx_scan, 0)                          as tarama,
       x.indisunique                                    as benzersiz,
       pg_get_indexdef(x.indexrelid)                    as tanim
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
join pg_am    am on am.oid = i.relam
left join pg_stat_user_indexes s on s.indexrelid = x.indexrelid
where t.relname = 'listings'
order by coalesce(s.idx_scan, 0) asc, pg_relation_size(x.indexrelid) desc;

-- Tablo mu ağır, indeksler mi? Oran kararı verir.
select 'ADIM 1b — tablo vs indeks' as adim,
       pg_size_pretty(pg_table_size('public.listings'))    as tablo,
       pg_size_pretty(pg_indexes_size('public.listings'))  as indeksler,
       round(pg_indexes_size('public.listings')::numeric
             / nullif(pg_table_size('public.listings'), 0), 2) as indeks_tablo_orani;


-- ============================================================================
-- ADIM 2 — `..._stats` trigger'ı GERÇEKTEN ne kadar sürüyor?
-- Trigger'ın gövdesindeki üç toplama sorgusunun aynısı, EN YOĞUN profil için.
-- Bu sorgu milisaniyelerde dönerse trigger 1.4 saniyenin kaynağı DEĞİLDİR
-- ve H3 tek ayakta kalan açıklama olur.
-- ============================================================================
explain (analyze, buffers, timing)
select count(*), max(l.created_at), min(l.created_at)
from public.listings l
where l.shadow_profile_id = '85f3ad2f-1f45-4c2e-a218-9ecc1f41310e';
-- ↑ 3 556 ilanlı profil, BÖLÜM 20b'deki en büyüğü. En kötü durum bu.


-- ============================================================================
-- ADIM 3 — Süre dolumu indeksi niye kullanılmıyor?
-- Önce istatistikleri tazele (yeni indeks, planlayıcı onu tanımıyor olabilir),
-- sonra planı SOR. ⚠️ `analyze` yazma yapmaz, kilit almaz; güvenli.
-- ============================================================================
analyze public.listings;

explain (analyze, buffers)
update public.listings
set status = 'expired', updated_at = now()
where status = 'active' and expires_at < now();
-- 🚨 DUR — bu EXPLAIN ANALYZE UPDATE'İ GERÇEKTEN ÇALIŞTIRIR.
--    Zaten cron'un 15 dakikada bir yaptığı iş, yani sonuç aynı; ama
--    istemiyorsan şu satırla sar:
--      begin;  explain (analyze, buffers) update ...;  rollback;

-- Planlayıcı ne kadar satır bekliyor? Seq scan seçimi buradan anlaşılır.
select 'ADIM 3b — süzgeç seçiciliği' as adim,
       count(*) filter (where status = 'active')                          as aktif,
       count(*) filter (where status = 'active' and expires_at < now())   as aktif_ve_dolmus,
       count(*)                                                          as toplam
from public.listings;


-- ============================================================================
-- ADIM 4 — `aliases` okuması: 1 201 çağrı · ort 41 ms · en kötü 1 605 ms.
-- 474 ilan için 1 201 alias sorgusu = ilan başına ~2.5 gidiş-dönüş.
-- 41 ms bir tablo taraması gibi kokuyor; 1 898 satırlık tablo için fazla.
-- ============================================================================
explain (analyze, buffers)
select * from public.aliases where is_active = true;

select 'ADIM 4b — aliases indeksleri' as adim,
       i.relname as indeks, coalesce(s.idx_scan,0) as tarama,
       pg_get_indexdef(x.indexrelid) as tanim
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
left join pg_stat_user_indexes s on s.indexrelid = x.indexrelid
where t.relname = 'aliases';
