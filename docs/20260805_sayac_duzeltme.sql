-- ============================================================================
-- #67 — SAYAÇ DÜZELTME + ÇAKIŞMA GİDERME
-- 5 Ağustos 2026 · 🚨 DEĞİŞİKLİK YAPAR. Sırayla koştur, atlama.
-- ============================================================================
--
-- BÖLÜM 20-21 ÇIKTISI NE DEDİ:
--
-- ✅ H1 DOĞRULANDI, AMA SINIRI VAR:
--    3 414 profil · 2 311 doğru · 1 097 FAZLA · 6 EKSİK
--    en_buyuk_fazla = 1 · yani fazlalık ASLA 1'i geçmiyor.
--
--    Niye birikmiyor: `..._stats` MUTLAK atama yapıyor (`= COUNT(*)`),
--    artırma değil. Her INSERT'te önce doğru değere SIFIRLANIYOR, sonra
--    `..._count` üstüne +1 koyuyor. Sonuç her zaman "gerçek + 1".
--    Bir sonraki INSERT yine sıfırlıyor. Hata birikmiyor, sabit kalıyor.
--    → 1 097 profil = son işlemi INSERT olanlar.
--    → 2 311 doğru  = son işlemi başka bir şey olanlar (muhtemelen */15
--       süre-dolumu cron'unun UPDATE'i sayacı iyileştiriyor: stats yeniden
--       sayıyor, count INSERT dışında artırmıyorsa fark kapanıyor).
--
-- 🚨 6 EKSİK SAYIM MEKANİZMAYLA AÇIKLANMIYOR:
--    -29, -4, -2, -2. Trigger çifti hatayı [-1, +1] aralığında tutar;
--    -29 o aralığın DIŞINDA. Yani İKİNCİ, ayrı bir sebep var — büyük
--    ihtimalle trigger'sız toplu yükleme ya da `shadow_profile_id`
--    yeniden atama. 4 profili ilgilendiriyor, acil değil; aşağıdaki
--    tek seferlik yeniden sayım hepsini zaten düzeltiyor.
--    ⚠️ Ama sebebi bilinmiyor — tekrar edebilir. Not düşüldü.
--
-- ❌ H2 ÇÜRÜDÜ. `audit_listing_fn` masum:
--    9 aktif REGEX · ort desen 154 karakter · taranan metin ort 574 karakter.
--    9 regex × 574 karakter mikrosaniyeler sürer, 1 saniye DEĞİL.
--    1 022 ms'lik INSERT'in kaynağı bu değil.
--
-- 👉 GERİYE KALAN TEK AÇIKLAMA: CPU değil KİLİT BEKLEME.
--    İki trigger da `shadow_profiles`taki AYNI SATIRI güncelliyor.
--    En büyük profilde 3 556 ilan var — o telefondan gelen her ilan
--    o tek satırda sıraya giriyor, üstelik İKİ KEZ. 55P03 buradan,
--    29 733 ms'lik en-kötü süre de buradan.
--    Çakışan trigger'ı düşürmek kilit trafiğini yarıya indirir.
-- ============================================================================


-- ============================================================================
-- ADIM 0 — ÖNCE ŞUNU KOŞTUR. `shadow_profiles` üzerinde trigger var mı?
-- Aşağıdaki toplu UPDATE 3 414 satıra dokunuyor; orada bir trigger varsa
-- ne yapacağını BİLMEDEN çalıştırmam.  Boş dönerse ADIM 1'e geç.
-- ============================================================================
select 'ADIM 0 — shadow_profiles trigger''ları' as adim,
       t.tgname as trigger_adi,
       p.proname as fonksiyon,
       pg_get_triggerdef(t.oid) as tanim
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc  p on p.oid = t.tgfoid
where not t.tgisinternal
  and c.relname = 'shadow_profiles';


-- ============================================================================
-- ADIM 1 — Çakışan trigger'ı düşür.
-- Hangisi düşüyor: `trg_listings_shadow_profile_count`.
--   Gerekçe: `..._stats` `listing_count` DIŞINDA `last_listing_at` ve
--   `first_listing_at`i de dolduruyor — yani BİLGİ olarak üstün ve
--   `_count`un yaptığı her şeyi zaten yapıyor. `_count` yalnız hatayı ekliyor.
-- Bilgi kaybı: YOK.
-- Geri alma: BÖLÜM 16 çıktısındaki `pg_get_triggerdef` satırını çalıştır.
-- ============================================================================
drop trigger if exists trg_listings_shadow_profile_count on public.listings;


-- ============================================================================
-- ADIM 2 — Tek seferlik yeniden sayım. ADIM 1'DEN SONRA koştur;
-- önce koşarsan araya giren her INSERT hatayı geri getirir.
-- 1 097 + 6 = 1 103 satır düzelecek.
-- ============================================================================
update public.shadow_profiles sp
set listing_count = g.n
from (
  select l.shadow_profile_id as id, count(*)::int as n
  from public.listings l
  where l.shadow_profile_id is not null
  group by 1
) g
where g.id = sp.id
  and sp.listing_count is distinct from g.n;

-- Hiç ilanı olmayıp sayacı sıfırdan farklı kalanlar (yukarıdaki join onları görmez).
update public.shadow_profiles sp
set listing_count = 0
where sp.listing_count is distinct from 0
  and not exists (
    select 1 from public.listings l where l.shadow_profile_id = sp.id
  );


-- ============================================================================
-- ADIM 3 — DOĞRULAMA. BÖLÜM 20'nin aynısı. Beklenen: fazla=0, eksik=0.
-- Bu satır 0/0 dönmezse ADIM 1 ya da 2 tutmamıştır; devam etme.
-- ============================================================================
select 'ADIM 3 — doğrulama' as adim,
       count(*)                                            as profil,
       count(*) filter (where sp.listing_count = g.gercek)  as dogru,
       count(*) filter (where sp.listing_count > g.gercek)  as fazla,
       count(*) filter (where sp.listing_count < g.gercek)  as eksik
from public.shadow_profiles sp
join lateral (
  select count(*)::int as gercek
  from public.listings l
  where l.shadow_profile_id = sp.id
) g on true;


-- ============================================================================
-- ADIM 4 — Mükerrer cron işini düşür.
-- `expire-active-listings` (*/15) zaten `expires_at < now()` süzüyor,
-- bu da NULL'ları eler. `expire-listings` (0 2 * * *) tamamen kapsanıyor.
-- Geri alma: select cron.schedule('expire-listings','0 2 * * *', $$...$$);
--   ⚠️ geri almadan önce BÖLÜM 18b çıktısındaki `command` metnini sakla.
-- ============================================================================
select cron.unschedule('expire-listings');


-- ============================================================================
-- ADIM 5 — Süre dolumu indeksi. ⚠️ TEK BAŞINA KOŞTUR.
-- `create index concurrently` transaction içinde çalışmaz; yukarıdakilerle
-- aynı seçimde göndermeye çalışırsan 25001 alırsın.
-- Beklenen etki: 15 dakikalık taramanın ort 1 160 ms'si düşer, o sırada
-- `listings` üzerinde tuttuğu kilit süresi kısalır.
-- ============================================================================
-- create index concurrently if not exists idx_listings_expire_sweep
--   on public.listings (expires_at)
--   where status = 'active';


-- ============================================================================
-- ADIM 6 — ÖLÇÜM. Değişikliğin işe yarayıp yaramadığını İDDİA ETMEYECEĞİZ.
-- Sayaçları sıfırla, birkaç saat üretim trafiği geçsin, sonra tekrar bak.
-- Karşılaştırma tabanı (107 günlük eski sayaçlardan):
--   INSERT INTO listings   → ort 1 022 ms
--   ilan_olustur RPC       → ort 2 292 ms
-- ============================================================================
-- select pg_stat_statements_reset();
--
-- ... birkaç saat sonra:
-- select calls, round(mean_exec_time::numeric,1) as ort_ms,
--        round(max_exec_time::numeric,1) as en_kotu_ms,
--        left(regexp_replace(query,'\s+',' ','g'),120) as ifade
-- from pg_stat_statements
-- where query ~* 'ilan_olustur|into public\.listings'
-- order by mean_exec_time desc;
