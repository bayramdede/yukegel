-- =============================================================================
-- Kayıt/giriş güvenlik denetimi — bulunan KRİTİK açıklar
-- Tarih: 7 Ağustos 2026
-- İstek: "Kullanıcı kayıt ve login süreçlerini kontrol et."
-- =============================================================================
--
-- İKİ AYRI, İKİSİ DE CANLIDA AKTİF, İKİSİ DE BAĞIMSIZ OLARAK İSTİSMAR EDİLEBİLİR
-- açık bulundu ve ölçülerek (gerçekten çalıştırılıp) doğrulandı:
--
-- 1) `public.users` — kimliği doğrulanmamış HERKES tüm kullanıcıların TCKN,
--    VKN, email, telefon, rolünü okuyabiliyordu VE her giriş yapmış kullanıcı
--    kendi `role` kolonunu 'admin' yapabiliyordu.
-- 2) `app/api/auth/merge/route.ts` — herhangi bir kullanıcı, herkese açık
--    profil URL'inden (`/u/<uuid>`) aldığı RASTGELE bir kullanıcı id'sini
--    `mergeUserId` yaparak o kullanıcının ilanlarını/araçlarını/TCKN-VKN-
--    telefonunu kendi hesabına aktarabiliyor, kurbanın hesabını devre dışı
--    bırakabiliyordu (tam hesap ele geçirme, kurbandan hiçbir eylem gerekmeden).
--
-- BÖLÜM 0 — ÖNCE ÖLÇ / KANITLA (bu üç test o an gerçekten çalıştırıldı)
-- =============================================================================

-- 0.1 anon rolüyle TÜM kullanıcı tablosu okunabiliyor muydu?
begin;
set local role anon;
select count(*) as okunabilen_satir,
       count(*) filter (where tckn is not null) as tckn_okunabilen,
       count(*) filter (where email is not null) as email_okunabilen
from public.users;
rollback;
-- ÖLÇÜLEN (düzeltmeden önce, 7 Ağu 2026): 104 satır, 8 TCKN, 21 email — HEPSİ okunabiliyordu.

-- 0.2 Kök sebep: tablo düzeyinde GRANT (kolon bazlı değil)
select grantee, privilege_type from information_schema.table_privileges
where table_schema='public' and table_name='users' and grantee in ('anon','authenticated');
-- ÖLÇÜLEN (önce): anon → SELECT,DELETE,TRUNCATE,REFERENCES,TRIGGER
--                 authenticated → SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
-- 📌 SELECT policy'si `using(true)` idi (rozet/herkese açık profil kartı için
-- BİLEREK öyle yazılmıştı) — ama tablo geneli GRANT ile birleşince "herkes her
-- satırın her kolonunu okur" oldu. RLS satır düzeyini korur, KOLON düzeyini
-- korumaz; kolon koruması yalnız GRANT/REVOKE ile sağlanır.

-- 0.3 Rol yükseltme: sıradan bir kullanıcı kendini admin yapabiliyor muydu?
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from public.users where coalesce(role,'user')='user' limit 1), true);
set local role authenticated;
update public.users set role = 'admin' where id = auth.uid() returning id, role;
rollback;
-- ÖLÇÜLEN (önce): UPDATE 1, role='admin' döndü. Düzeltmeden sonra: 42501 permission denied.

-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================

-- 1.1 Tablo düzeyindeki geniş yetkiyi tamamen kaldır.
revoke all on public.users from anon, authenticated;

-- 1.2 Geri ver: yalnız GERÇEKTEN kamuya açık olması gereken 5 kolon (SELECT).
--     Bu 5 kolon kod taranarak belirlendi — public.users'a doğrudan (service
--     role OLMADAN) erişen İKİ meşru okuma noktası:
--       • `lib/ilan-liste.ts::RozetBilgi` — ana sayfa/filtre kartlarındaki
--         "Doğrulanmış"/"Yeni Üye" rozetleri (id, phone_verified, created_at)
--       • `app/u/[username]/page.tsx` — herkese açık profil kartı
--         (id, display_name, user_type)
--     Kullanıcının KENDİ tam profili (email/phone/tckn/vkn dahil) zaten SERVİS
--     ROLÜYLE geliyor (`app/panel/page.tsx:45`, `app/profil-tamamla/actions.ts`)
--     — yani bu kısıtlama o akışları HİÇ etkilemiyor.
grant select (id, display_name, user_type, phone_verified, created_at)
  on public.users to anon, authenticated;

-- 1.3 Geri ver: authenticated kendi satırında (RLS `auth.uid()=id` zaten
--     kısıtlıyor) yalnız `app/panel/PanelClient.tsx`'in GERÇEKTEN doğrudan
--     istemciden yazdığı 5 kolonu güncelleyebilsin.
grant update (display_name, company_name, bio, phone, phone_verified)
  on public.users to authenticated;

-- anon HİÇBİR satırı güncelleyemez/ekleyemez artık (zaten auth.uid() boş
-- olduğu için RLS engelliyordu, ama GRANT seviyesinde de kapatıldı — savunma
-- katmanları birbirine güvenmesin).

-- =============================================================================
-- BÖLÜM 2 — DOĞRULA (7 Ağu 2026'da gerçekten çalıştırılan testler)
-- =============================================================================

-- 2.1 PII artık okunamıyor mu? (HATA beklenir)
begin;
set local role anon;
select email, tckn, role from public.users limit 1;
rollback;
-- SONUÇ: ERROR 42501 permission denied for table users ✅

-- 2.2 Rol yükseltme kapandı mı? (HATA beklenir)
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from public.users where coalesce(role,'user')='user' limit 1), true);
set local role authenticated;
update public.users set role = 'admin' where id = auth.uid() returning id, role;
rollback;
-- SONUÇ: ERROR 42501 permission denied for table users ✅

-- 2.3 Rozet okuması hâlâ çalışıyor mu? (BAŞARILI beklenir)
begin;
set local role anon;
select id, display_name, user_type, phone_verified, created_at from public.users limit 2;
rollback;
-- SONUÇ: 2 satır döndü ✅ — anasayfa/filtre/profil kartları bozulmadı.

-- 2.4 Kendi profilini güncelleme hâlâ çalışıyor mu? (BAŞARILI beklenir)
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from public.users where coalesce(role,'user')='user' limit 1), true);
set local role authenticated;
update public.users set display_name = display_name where id = auth.uid() returning id;
rollback;
-- SONUÇ: 1 satır döndü ✅ — panel profil formu bozulmadı.

-- =============================================================================
-- BÖLÜM 3 — GERİ ALMA (gerekirse; ACİL DURUM DIŞINDA KULLANILMAMALI)
-- =============================================================================
-- grant all on public.users to anon, authenticated;   -- ❌ eski AÇIK hâle döner, YAPMAYIN

-- =============================================================================
-- KOD TARAFI (ayrı, aynı görevin parçası — bu dosyanın kapsamı dışı)
-- =============================================================================
-- `app/api/auth/merge/route.ts`: sunucu artık `keepUserId`/`mergeUserId`'nin
-- GERÇEKTEN aynı e-postaya ait iki auth kaydı olduğunu (Supabase Auth admin
-- API ile) kendisi doğruluyor — istemcinin (URL parametresinin) beyanına
-- güvenmiyor. Eşleşmezse 403.
--
-- `app/api/auth/tekil-kontrol/route.ts`: IP başına kota eklendi (20/5dk,
-- `lib/kota.ts` — projenin geri kalanıyla aynı desen). Önceden sınırsızdı;
-- TCKN/VKN/telefon enumeration + gizlilik sızıntısı riski taşıyordu.
--
-- =============================================================================
-- MANUEL AKSİYON GEREKİYOR (Bayram, Supabase Dashboard — kod/SQL ile yapılamaz)
-- =============================================================================
-- `auth_leaked_password_protection` KAPALI (Supabase Advisor uyarısı).
-- Authentication → Policies → Password Protection'dan açılabilir; kayıt/şifre
-- değişikliğinde HaveIBeenPwned'e karşı kontrol eder. DB/kod tarafından
-- yönetilemiyor, GoTrue (Auth servisi) ayarı.
--
-- =============================================================================
-- DOKUNULMAYAN, TAKİP GEREKTİREN BULGULAR (bu oturumda düzeltilmedi)
-- =============================================================================
-- • `phone_verified` hâlâ istemciden doğrudan yazılabiliyor
--   (`PanelClient.tsx::otpDogrula` — OTP başarılı DÖNDÜKTEN SONRA client bunu
--   set ediyor). RLS/GRANT bunu engellemiyor; devtools'la OTP adımı atlanıp
--   `phone_verified:true` doğrudan PATCH edilebilir. Düzgün çözüm: bu yazmayı
--   `profil-tamamla/actions.ts` gibi sunucu tarafına (gerçek OTP doğrulamasını
--   kendisi yapan bir route/action) taşımak — bu oturumda YAPILMADI çünkü canlı
--   bir özelliği kırma riski taşıyordu, aceleye getirilmemesi gerekiyordu.
-- • OTP doğrulama (`supabase.auth.verifyOtp`) uygulama tarafında kota/brute-
--   force korumasına tabi değil — yalnız SMS *gönderimi* kotalı. Supabase'in
--   kendi platform seviyesinde bir sınırı olabilir, doğrulanmadı.
-- • Kayıt formunda e-posta enumeration ("bu e-posta zaten kayıtlı" mesajı) —
--   sektörde yaygın bir ödünleşim, düşük öncelik.
-- • `app/api/auth/switch-account/route.ts` eski (implicit-flow) yöntemi
--   kullanıyor; `auth/devir/route.ts` bunun yol açtığı döngüyü ayrı çözmüş —
--   tutarlılık kontrolü ayrı görev.
