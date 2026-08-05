-- ============================================================================
-- #67 — İKİ TRIGGER ÇAKIŞIYOR, İKİ CRON MÜKERRER
-- 5 Ağustos 2026 · BÖLÜM 20-21 SALT OKUNUR · BÖLÜM 22 DEĞİŞİKLİK (onay bekler)
-- ============================================================================
--
-- BÖLÜM 16 gövdeleri okundu. H1 doğrulandı ve tahmin ettiğimden AĞIR:
--
--   trg_listings_shadow_profile_count → sync_shadow_profile_listing_count()
--       UPDATE shadow_profiles SET listing_count = listing_count + 1
--       O(1). Ucuz.
--
--   listings_sync_shadow_profile_stats → sync_shadow_profile_listing_stats()
--       UPDATE shadow_profiles SET
--         listing_count    = (SELECT COUNT(*)  FROM listings WHERE shadow_profile_id = v_id),
--         last_listing_at  = (SELECT MAX(...)  FROM listings WHERE shadow_profile_id = v_id),
--         first_listing_at = (SELECT MIN(...)  FROM listings WHERE shadow_profile_id = v_id)
--       ÜÇ ayrı toplama sorgusu, 259 189 satırlık / 532 MB'lık tablo üzerinde,
--       HER İLAN EKLENİŞİNDE. `listings_shadow_profile_id_idx` var, yani indeksli —
--       ama çok ilan veren bir telefon için yine de büyüyen bir tarama.
--
-- 🚨 İKİSİ DE AYNI KOLONU (`listing_count`) YAZIYOR. Postgres AFTER trigger'ları
--    ADA GÖRE alfabetik çalıştırır:
--        listings_sync_shadow_profile_stats   (l...)  → önce, COUNT(*) atar
--        trg_listings_shadow_profile_count    (t...)  → sonra, üstüne +1 ekler
--    AFTER INSERT'te COUNT(*) yeni satırı ZATEN sayar. Yani her ilanda
--    `listing_count` GERÇEĞİN BİR FAZLASINA gidiyor. DELETE'te bir eksiğine.
--    Bu performans değil DOĞRULUK hatası — ve BÖLÜM 20 onu veriyle sınıyor.
--
-- Ayrıca ikisi de `shadow_profiles`taki AYNI SATIRI güncelliyor: aynı telefondan
-- gelen ilanlar o satırda sıraya giriyor. Log'daki 55P03 (lock timeout) buradan.
--
-- ============================================================================
-- pg_cron (BÖLÜM 18b) — ÜÇ İŞ, İKİSİ AYNI İŞ:
--   #1 expire-listings        `0 2 * * *`     status='active' AND expires_at IS NOT NULL AND expires_at < now()
--   #3 expire-active-listings `*/15 * * * *`  status='active' AND expires_at < now()
--   👉 #3, #1'i TAMAMEN kapsıyor (`expires_at < now()` zaten NULL'ı eler).
--      #1 gereksiz; her gece 02:00'de aynı taramayı bir kez daha yapıyor.
--   #2 archive-expired-pending-listings `0 * * * *`
--      moderation_status='pending' AND created_at < now()-24h → 'archived'
--
-- ⚠️ #2 HAKKINDA BİR UYARI: `parse-listing/index.ts`:855 ürettiği HER ilanı
--    `moderation_status: 'pending'` yazıyor. Yani moderatörün 24 saat içinde
--    dokunmadığı her ilan otomatik arşivleniyor. Bu kasıtlıysa sorun yok, ama
--    #65'teki 2 055 mahsur raw_post'un ürettiği 7 546 ilanın büyük kısmı
--    şu an bu yüzden `archived` olmalı. Kurtarma planı bunu hesaba katmalı.
--
-- ⚠️ İNDEKS YOK: BÖLÜM 17'de `(status, expires_at)` üzerinde indeks çıkmadı.
--    Süre dolumu taraması `idx_listings_status` ile 'active'leri bulup
--    `expires_at`i satır satır eliyor. Ort 1 160 ms, en kötü 14 473 ms.
--
-- 📌 BÜYÜKLÜK DÜRÜSTLÜĞÜ: 7 481 çağrı × 1 160 ms = 8 678 sn, ama sayaçlar
--    107 GÜNLÜK (BÖLÜM 18: reset 2026-04-20). Günde ~81 sn. Yani bu tarama
--    TEK BAŞINA havuzu tüketmiyor. Sorun toplam yük değil ÇAKIŞMA: 15 dakikada
--    bir, saniyenin üstünde `listings` satırlarını kilitliyor.
--
-- 🚨 HAVUZUN ASIL TÜKENME MEKANİZMASI — VERİDEN, TAHMİNDEN DEĞİL:
--    BÖLÜM 12b çıktısında birden çok raw_post AYNI MİKROSANİYEDE oluşmuş:
--        2026-08-04 17:31:03.733901+00  → 5 satır
--        2026-08-04 16:20:09.919665+00  → 3 satır
--        2026-08-04 16:20:08.651215+00  → 4 satır
--    Yani raw_posts TOPLU INSERT ediliyor. `on_raw_post_insert` ise
--    FOR EACH ROW ve gövdesi `net.http_post(...)` — her satır için bir edge
--    function çağrısı, hepsi aynı anda. `max_connections = 60`.
--    Ortalama hız düşük olsa da (saatte 214) ANLIK eşzamanlılık havuzu bitiriyor.
--    Düzeltilecek yer burası; trigger ve cron onu ağırlaştıran ikincil yükler.
--
-- 🔐 AYRI KONU, AMA SÖYLEMEDEN GEÇEMEM: `trigger_parse_listing()` gövdesinde
--    `service_role` JWT'si DÜZ METİN gömülü. `pg_get_functiondef` çağırabilen
--    herkes onu okuyabilir — bu anahtar RLS'i tamamen atlar. Gövde bu sohbette
--    ve muhtemelen başka yerlerde de görüldü. ANAHTARIN DÖNDÜRÜLMESİ ve gövdenin
--    `vault`/`current_setting` üzerinden okuması gerekir. Bunu ben yapmam —
--    kimlik bilgisi işlemi senin elinle yapılmalı.
-- ============================================================================


-- ============================================================================
-- BÖLÜM 20 — 👉 ÇİFT SAYIM GERÇEK Mİ? İddia değil, veri.
-- Beklenti (çift sayım varsa): `fark` çoğunlukla POZİTİF ve ilan sayısıyla artan.
-- ============================================================================
select 'BÖLÜM 20 — listing_count doğruluğu' as bolum,
       count(*)                                              as profil,
       count(*) filter (where sp.listing_count = g.gercek)   as dogru,
       count(*) filter (where sp.listing_count > g.gercek)   as fazla_sayilmis,
       count(*) filter (where sp.listing_count < g.gercek)   as eksik_sayilmis,
       max(sp.listing_count - g.gercek)                      as en_buyuk_fazla,
       min(sp.listing_count - g.gercek)                      as en_buyuk_eksik
from public.shadow_profiles sp
join lateral (
  select count(*)::int as gercek
  from public.listings l
  where l.shadow_profile_id = sp.id
) g on true;

select 'BÖLÜM 20b — en sapmış profiller' as bolum,
       sp.id,
       sp.listing_count                        as kayitli,
       g.gercek,
       sp.listing_count - g.gercek             as fark
from public.shadow_profiles sp
join lateral (
  select count(*)::int as gercek
  from public.listings l
  where l.shadow_profile_id = sp.id
) g on true
where sp.listing_count <> g.gercek
order by abs(sp.listing_count - g.gercek) desc
limit 20;


-- ============================================================================
-- BÖLÜM 21 — `audit_listing_fn` ne kadar ağır? (H2)
-- Gövde her INSERT'te `safety_rules`taki AKTİF regex'lerin HEPSİNİ
-- `raw_text || notes` üzerinde deniyor. Maliyeti kural sayısı belirler.
-- ============================================================================
select 'BÖLÜM 21 — safety_rules yükü' as bolum,
       rule_type,
       count(*) filter (where is_active)      as aktif,
       count(*)                               as toplam,
       round(avg(length(pattern)))            as ort_desen_uzunlugu,
       max(length(pattern))                   as en_uzun_desen
from public.safety_rules
group by 2;

-- Aday: 259 189 ilanın ortalama raw_text uzunluğu × aktif kural sayısı.
select 'BÖLÜM 21b — taranan metin boyutu' as bolum,
       round(avg(length(coalesce(raw_text,'') || coalesce(notes,'')))) as ort_karakter,
       max(length(coalesce(raw_text,'') || coalesce(notes,'')))        as en_uzun
from public.listings;


-- ============================================================================
-- BÖLÜM 22 — 🚨 DEĞİŞİKLİK. ÇALIŞTIRMADAN ÖNCE BÖLÜM 20'yi OKU.
-- Aşağısı yorumda; kararı BÖLÜM 20 çıktısı verecek.
-- ============================================================================
--
-- 22.1 — Mükerrer cron işini düşür (#1, #3 zaten kapsıyor).
--        Geri alma: `select cron.schedule('expire-listings','0 2 * * *', $$...$$);`
-- select cron.unschedule('expire-listings');
--
-- 22.2 — Süre dolumu için indeks. CONCURRENTLY: tablo kilitlenmez.
--        ⚠️ `create index concurrently` transaction İÇİNDE çalışmaz, tek başına koştur.
-- create index concurrently if not exists idx_listings_expire_sweep
--   on public.listings (expires_at)
--   where status = 'active';
--
-- 22.3 — Çakışan trigger'lardan BİRİNİ düşür.
--        Hangisi? `..._stats` `last_listing_at`/`first_listing_at`i de dolduruyor,
--        `..._count` yalnız sayacı tutuyor. Yani BİLGİ olarak `_stats` üstün,
--        MALİYET olarak `_count` üstün. İkisini birleştiren doğru çözüm:
--        `_count`u düşür, `_stats`ı O(1) hale getir (COUNT(*) yerine ±1,
--        last/first için GREATEST/LEAST). Ama önce BÖLÜM 20 sapmayı göstersin,
--        sonra tek seferlik bir yeniden sayım gerekecek.
-- drop trigger if exists trg_listings_shadow_profile_count on public.listings;
