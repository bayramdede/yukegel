-- ============================================================================
-- #65 (pending mahsur) + #66 (havuz tükenmesi) — ÖLÇÜM
-- 5 Ağustos 2026 · SALT OKUNUR, hiçbir şey yaratmaz/düşürmez
-- ============================================================================
--
-- ÖNCEKİ ADIMDA NE BULDUK:
--   BÖLÜM 11  → RPC hatası alan 176 postun 110'u hâlâ `pending`.
--   BÖLÜM 11c → damgalı `no_lane`ın 36/36'sı RPC altyapı hatası. Açıklanmayan 0.
--   BÖLÜM 11d → 4 Ağu 17:00'de tek saatte 214 post işlendi. Patlama var.
--   Log       → PGRST003 (havuz) 108 · 57014 (statement timeout) 79 · 55P03 2
--
-- BU DOSYA İKİ SORU SORUYOR:
--   (1) `pending` yığını gerçekte ne kadar? 110 yalnız loglarda GÖRDÜĞÜM kısım;
--       log gezgini 200 satırda kesiyordu, yani taban.
--   (2) 57014'ü NE üretiyor? `ilan_olustur` gövdesi (v4.1) sade duruyor —
--       81 satırlık `provinces` taraması 79 kez timeout ETMEZ. Şüphe
--       `listings` üzerindeki TRIGGER'larda. Tahmin etmeyeceğiz, bakacağız.
-- ============================================================================


-- ============================================================================
-- BÖLÜM 13 — 👉 `pending` yığınının GERÇEK boyutu ve yaşı
-- `pending` bir GEÇİŞ durumu olmalı: mesaj gelir, saniyeler içinde işlenir.
-- Dakikalardan eski her `pending` satır MAHSUR demektir.
-- ============================================================================
select 'BÖLÜM 13 — pending yaş dağılımı' as bolum,
       case
         when created_at > now() - interval '5 minutes'  then '0 — <5 dk (normal)'
         when created_at > now() - interval '1 hour'     then '1 — <1 saat'
         when created_at > now() - interval '1 day'      then '2 — <1 gün'
         when created_at > now() - interval '7 days'     then '3 — <7 gün'
         else                                                 '4 — 7 günden eski'
       end                                               as yas,
       count(*)                                          as satir,
       min(created_at)                                   as en_eski,
       max(created_at)                                   as en_yeni
from public.raw_posts
where processing_status = 'pending'
group by 2
order by 2;


-- ============================================================================
-- BÖLÜM 13b — Tüm durum dağılımı. `pending`i toplamın içinde görelim ki
-- "no_lane oranı %X" cümlelerinin paydası doğru mu anlaşılsın.
-- ============================================================================
select 'BÖLÜM 13b — durum dağılımı' as bolum,
       processing_status,
       count(*)                                              as satir,
       count(*) filter (where processed_at is not null)       as damgali,
       count(*) filter (where created_at > now() - interval '2 days') as son_2_gun
from public.raw_posts
group by 2
order by 3 desc;


-- ============================================================================
-- BÖLÜM 13c — 👉 Mahsur `pending`lerin kaçı zaten ilan üretmiş?
-- Eğer ilanı VARSA: RPC geçti, yalnız durum yazımı düştü → durumu düzeltmek
--   yeter, yeniden işlemek MÜKERRER ilan üretir. 🚨 Bu ayrım kurtarma
--   stratejisini belirler; atlanırsa veri çoğaltılır.
-- İlanı YOKSA: gerçekten kayıp, yeniden işlenmeli.
-- ============================================================================
select 'BÖLÜM 13c — mahsur pending, ilan var mı' as bolum,
       (l.id is not null)                                as ilani_var,
       count(distinct r.id)                              as raw_post,
       count(l.id)                                       as ilan
from public.raw_posts r
left join public.listings l on l.raw_post_id = r.id
where r.processing_status = 'pending'
  and r.created_at < now() - interval '1 hour'
group by 2;


-- ============================================================================
-- BÖLÜM 14 — 👉 57014'ün KAYNAĞI. `ilan_olustur` v4.1 gövdesi sade;
-- yavaşlık büyük ihtimalle `listings` / `listing_stops` üzerindeki TRIGGER'larda
-- (audit_score, is_shadow_banned gibi alanlar bir yerden doluyor).
-- ============================================================================
select 'BÖLÜM 14 — trigger envanteri' as bolum,
       c.relname                                          as tablo,
       t.tgname                                           as trigger_adi,
       p.proname                                          as fonksiyon,
       pg_get_triggerdef(t.oid)                           as tanim
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in ('listings', 'listing_stops', 'raw_posts')
order by 2, 3;


-- ============================================================================
-- BÖLÜM 14b — En yavaş ifadeler. `pg_stat_statements` Supabase'de açık gelir;
-- 42P01 alırsan `create extension pg_stat_statements;` gerekir — o zaman bu
-- bölümü ATLA, BÖLÜM 14 zaten yeterli ipucu verir.
-- ⚠️ Sayaçlar en son sıfırlamadan beri birikir; mutlak değil GÖRECELİ oku.
-- ============================================================================
select 'BÖLÜM 14b — en yavaş ifadeler' as bolum,
       calls,
       round(mean_exec_time::numeric, 1)                  as ort_ms,
       round(max_exec_time::numeric, 1)                   as en_kotu_ms,
       round(total_exec_time::numeric / 1000, 1)          as toplam_sn,
       left(regexp_replace(query, '\s+', ' ', 'g'), 150)  as ifade
from pg_stat_statements
where calls > 5
order by mean_exec_time desc
limit 20;


-- ============================================================================
-- BÖLÜM 14c — `ilan_olustur`a ve onun dokunduğu tablolara ait ifadeler.
-- 14b genel sıralama; bu hedefli bakış.
-- ============================================================================
select 'BÖLÜM 14c — ilan yazma yolu' as bolum,
       calls,
       round(mean_exec_time::numeric, 1)                  as ort_ms,
       round(max_exec_time::numeric, 1)                   as en_kotu_ms,
       left(regexp_replace(query, '\s+', ' ', 'g'), 150)  as ifade
from pg_stat_statements
where query ~* 'ilan_olustur|listing_stops|into public\.listings|il_key|ilce_resmi'
order by total_exec_time desc
limit 20;


-- ============================================================================
-- BÖLÜM 15 — Havuzun ANLIK hâli. Patlama saatinde koşturulursa daha anlamlı;
-- sakin saatte de taban çizgisi verir.
-- ============================================================================
select 'BÖLÜM 15 — bağlantı durumu' as bolum,
       state,
       count(*)                                           as baglanti,
       max(now() - state_change)                          as en_uzun_suredir
from pg_stat_activity
where datname = current_database()
group by 2
order by 3 desc;

select 'BÖLÜM 15b — havuz sınırları' as bolum,
       (select setting from pg_settings where name = 'max_connections')       as max_connections,
       (select setting from pg_settings where name = 'statement_timeout')     as statement_timeout,
       (select setting from pg_settings where name = 'idle_in_transaction_session_timeout') as idle_tx_timeout,
       (select count(*) from pg_stat_activity)                                as su_anki;
