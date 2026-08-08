-- =============================================================================
-- OLAY: 7 Ağu güvenlik düzeltmesi login'i kırdı — 8 Ağu'da düzeltildi
-- =============================================================================
--
-- NE OLDU: 7 Ağu 2026'da `public.users` tablosunda bulunan kritik açığı
-- (herkes TCKN/VKN/email/telefon okuyabiliyordu, herkes kendini admin
-- yapabiliyordu) kapatırken uygulanan `REVOKE ALL` + dar `GRANT` çok
-- kısıtlayıcı çıktı. Yalnız İKİ kullanım noktasını (rozet gösterimi, herkese
-- açık profil kartı) tarayıp ona göre allow-list kurulmuştu — ama `role`,
-- `merged_into`, `is_active`, `phone`, `email`, `tckn`, `vkn`, `company_name`
-- kolonlarının PROJE GENELİNDE (giriş akışı, moderatör paneli, admin
-- kontrolleri) `authenticated` client'ıyla DOĞRUDAN okunduğu onlarca yer
-- ATLANMIŞTI. Bunun canlıdaki etkisi 8 Ağu'da Bayram'ın kendi bildirimiyle
-- ortaya çıktı: "Login olamıyorum. Profil tamamlamaya yönlendiriyor. Orada
-- da telefon eksik sıfır ile başlamalı diyor."
--
-- DERS: bir sütunun "kim, hangi amaçla okuyor" taraması `RozetBilgi`/`u/
-- [username]` gibi BİLİNEN tüketicilerle sınırlı kaldı; PROJE GENELİNDE
-- `.from('users')` için tam bir `grep` yapılmadı. Bu tür bir GRANT değişikliği
-- (satır değil KOLON kısıtlaması) tablodaki HER tüketiciyi etkiler — "bulduğum
-- ihtiyaçlar" ile "var olan ihtiyaçlar" aynı şey değildir.
--
-- BÖLÜM 0 — ÖLÇÜM (canlıda gerçekten hangi sorgular patlıyordu)
-- =============================================================================
-- `SET LOCAL ROLE authenticated` ile simüle edilip doğrulandı: `role`,
-- `merged_into`, `is_active` kolonlarını okuyan HER sorgu `42501 permission
-- denied` veriyordu — bunlar proje genelinde en az 20 ayrı yerde (proxy.ts,
-- giris/page.tsx, auth/callback, tüm admin/moderator API route'ları, lib/
-- auth.ts::getCurrentUser) `authenticated` client'ıyla self-check için
-- kullanılıyordu.

-- =============================================================================
-- BÖLÜM 1 — UYGULA (grant genişletmesi — düşük hassasiyetli 3 kolon)
-- =============================================================================
-- `role`/`merged_into`/`is_active` TCKN/VKN/email/telefon kadar hassas DEĞİL —
-- asıl kritik açık (rol YÜKSELTME) bunlardan etkilenmiyor, o hâlâ UPDATE
-- tarafında kapalı (yalnız kendi satırında `display_name, company_name, bio,
-- phone, phone_verified` yazılabiliyor — `role` UPDATE grant'ı YOK).
grant select (role, merged_into, is_active) on public.users to anon, authenticated;

-- =============================================================================
-- BÖLÜM 2 — KOD TARAFI (ayrı, aynı olayın parçası — bu dosyanın kapsamı dışı)
-- =============================================================================
-- `phone`/`email`/`tckn`/`vkn`/`company_name` GERİ AÇILMADI (asıl açığı
-- yeniden açardı). Bunlara ihtiyaç duyan her yer SERVİS ROLÜNE taşındı:
--
-- 1. `proxy.ts` — telefon/email ile "canlı hesap var mı" araması artık
--    service role (middleware zaten sunucu tarafı, güvenli).
-- 2. `app/auth/callback/route.ts` (Google girişi) — aynı desen.
-- 3. `lib/auth.ts::getCurrentUser()` — `email` okuması service role'e taşındı.
-- 4. `app/giris/page.tsx` (telefon OTP girişi) — istemci artık DOĞRUDAN
--    sorgu atmıyor, yeni `POST /api/auth/hesap-eslesme` (service role,
--    arama kriteri İSTEMCİDEN değil çağıranın DOĞRULANMIŞ oturumundan okunuyor).
-- 5. `app/profil-tamamla/page.tsx` — form ön-doldurma artık yeni
--    `profilOnDoldur()` server action'ı (service role) üzerinden;
--    eskiden istemciden doğrudan `phone/tckn/vkn/company_name` okuyordu.
--    ⚠️ Bu SATIR kullanıcının "telefon eksik" şikayetinin doğrudan sebebiydi.
-- 6. `app/moderator/page.tsx` (omnisearch + "ilan sahibi" paneli) — yeni
--    `POST /api/moderator/kullanici-ara` (service role, `requireStaff`
--    deseniyle zaten korunan bir sayfanın İÇİNDE, CLAUDE.md'nin "RLS bypass
--    → sadece admin/mod doğrulandıktan sonra getServiceSupabase()" kuralı
--    burada ilk kez UYGULANDI — eskiden uygulanmamıştı).
-- 7. `app/_components/HomeClient.tsx::profilCek()` — `email` select'ten
--    çıkarıldı (zaten gereksizdi, `session.user.email` fallback yeterliydi).
--
-- =============================================================================
-- BÖLÜM 3 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı)
-- =============================================================================
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.users where coalesce(role,'user')='user' and user_type is not null limit 1), true);
set local role authenticated;
select id, merged_into, is_active, user_type, role from public.users where id = auth.uid();
rollback;
-- SONUÇ: satır döndü, hata yok ✅ — proxy.ts + giris/page.tsx'in kendi-profil
-- kontrolleri artık çalışıyor.

-- PII hâlâ kapalı mı? (HATA beklenir — asıl güvenlik düzeltmesi BOZULMADI)
begin;
set local role anon;
select email, tckn, phone from public.users limit 1;
rollback;
-- SONUÇ: 42501 permission denied ✅ — 7 Ağu'nun kapattığı açık hâlâ kapalı.

-- Kod tarafı: `tsc --noEmit` temiz, gerçek `next build` temiz (8 Ağu 2026).
