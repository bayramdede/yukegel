-- ============================================================================
-- 🔴 KRİTİK — `shadow_profile_summary` view'ı RLS'i BYPASS EDİYOR
-- Supabase linter: "Security Definer View"  ·  29 Tem 2026
--
-- Bayram: Supabase SQL Editor'de çalıştır. Kod deploy'u GEREKTİRMEZ.
-- ============================================================================
--
-- SORUN
-- -----
-- `shadow_profiles` tablosu KAYITSIZ kullanıcıların telefon numaralarını tutuyor
-- (WhatsApp'tan ilan atmış ama siteye üye olmamış kişiler). Doğru şekilde
-- korunmuş:
--
--   ALTER TABLE public.shadow_profiles ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY shadow_profiles_admin_all ... TO authenticated ... (admin only)
--
-- Ama `20260601_shadow_profiles_crm.sql`'de bu tablonun üstüne bir view kondu ve
-- şu satır eklendi:
--
--   GRANT SELECT ON public.shadow_profile_summary TO authenticated;   ← 🚨
--
-- PostgreSQL'de bir view VARSAYILAN olarak SAHİBİNİN yetkileriyle çalışır
-- ("security definer" davranışı). View'ın sahibi `postgres`. Yani:
--
--   • `shadow_profiles` üzerindeki admin-only RLS policy'si DEVREYE GİRMİYOR
--   • view'a SELECT yetkisi olan HERKES tüm satırları görüyor
--   • o yetki `authenticated`'a verilmiş = siteye üye olan HERKES
--   • view `phone`, `name`, `company_name`, `notes`, `ai_analiz` döndürüyor
--
-- PostgREST view'ları da endpoint olarak açar. Somut sömürü, tarayıcı konsolundan:
--
--   fetch('https://<proje>.supabase.co/rest/v1/shadow_profile_summary' +
--         '?select=phone,name,company_name,listing_count&limit=10000',
--         { headers: { apikey: <ANON_KEY>, Authorization: 'Bearer <herhangi bir üyenin JWT>' } })
--
-- Anon key zaten istemci paketinde açık. Herhangi biri 30 saniyede üye olup tüm
-- kayıtsız nakliyeci telefon veritabanını indirebilirdi. **KVKK ihlali** ve aynı
-- zamanda rakibe hazır müşteri listesi.
--
-- 🔁 Bu, `SPRINT_01 L1e`'deki `listings.contact_phone` sızıntısının AYNISI.
-- Oradaki ders şuydu: **"RLS SATIR bazlıdır, KOLON bazlı değildir."** Buradaki
-- ders onun tamamlayıcısı: **RLS view'ın ALTINDA kalır; view onu delip geçer.**
-- Tabloyu kilitlemek, üstüne yetkisiz bir view koyduğun anda anlamsızlaşır.
--
-- ÇÖZÜM — iki katman, ikisi de gerekli
-- -----------------------------------
-- 1. `security_invoker = on` → view artık SORGULAYANIN yetkileriyle çalışır,
--    yani `shadow_profiles` RLS'i tekrar devreye girer.
-- 2. `revoke` → `anon`/`authenticated` view'ı hiç göremesin. Tek başına (1)
--    yeterli görünür ama savunma tek katmana bırakılmaz: ileride policy yanlış
--    yazılırsa (2) hâlâ tutar. `SPRINT_01 M1`'de tek katmanlı savunma bir kez
--    kırıldı, tekrarlamıyoruz.
--
-- ✅ HİÇBİR ŞEY BOZULMAZ. View'ın TEK tüketicisi `app/api/admin/crm/route.ts`
-- ve o `requireAdmin()` kapısından geçip `getServiceSupabase()` kullanıyor.
-- `service_role` RLS'i zaten bypass eder — `authenticated` grant'ına hiç
-- ihtiyacı yoktu. `app/api/admin/crm/[id]/route.ts` view'a değil doğrudan
-- `shadow_profiles` tablosuna gidiyor, o da service-role.
--
-- ⚠️ `security_invoker` PostgreSQL 15+ ister. Supabase projeleri 15 üstünde;
--    yine de aşağıdaki DOĞRULAMA §0 ile teyit et.
-- ============================================================================

begin;

-- 1) View sorgulayanın kimliğiyle çalışsın → alttaki RLS tekrar geçerli olsun.
alter view public.shadow_profile_summary set (security_invoker = on);

-- 2) İstemci rollerinden yetkiyi tamamen al. PostgREST bundan sonra bu view'ı
--    anon/authenticated için hiç açmaz (404 döner, veri değil).
revoke all on public.shadow_profile_summary from public;
revoke all on public.shadow_profile_summary from anon;
revoke all on public.shadow_profile_summary from authenticated;

-- 3) Tek meşru tüketici.
grant select on public.shadow_profile_summary to service_role;

commit;

-- ============================================================================
-- DOĞRULAMA
-- ============================================================================
-- 0) Postgres sürümü 15+ mi? (`alter view ... security_invoker` bunu ister)
--      select current_setting('server_version');
--
-- 1) security_invoker gerçekten açıldı mı? ({security_invoker=true} görmelisin
--    — bayrak yoksa reloptions NULL döner ve düzeltme UYGULANMAMIŞTIR)
--      select c.relname, c.reloptions
--      from pg_class c
--      join pg_namespace n on n.oid = c.relnamespace
--      where n.nspname = 'public' and c.relname = 'shadow_profile_summary';
--
-- 2) Yetkiler doğru mu? (yalnız `service_role` satırı true dönmeli)
--      select r.rolname,
--             has_table_privilege(r.rolname, 'public.shadow_profile_summary', 'select') as select_var
--      from pg_roles r
--      where r.rolname in ('anon','authenticated','service_role');
--
-- 3) Sızıntı gerçekten kapandı mı? (üye JWT'siyle dene — 404/permission denied
--    beklenir, satır DEĞİL)
--      curl 'https://<proje>.supabase.co/rest/v1/shadow_profile_summary?select=phone&limit=1' \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <bir üyenin JWT'si>"
--
-- 4) Admin CRM paneli hâlâ çalışıyor mu?
--      /admin/crm → liste dolu geliyor mu, sayfalama + arama çalışıyor mu,
--      detay drawer açılıyor mu? (service-role kullandığı için etkilenmemeli)
--
-- GERİ ALMA (yalnız /admin/crm kırılırsa — ama kırılmamalı)
-- ---------------------------------------------------------
--   alter view public.shadow_profile_summary set (security_invoker = off);
--   grant select on public.shadow_profile_summary to authenticated;
--   🚨 Bu geri alma SIZINTIYI GERİ AÇAR. Yapmadan önce /admin/crm'in neden
--      service-role yerine kullanıcı oturumuyla sorguladığını bul; asıl hata odur.
--
-- KALICI KURAL (PROJE_HARITASI §9'a işlendi)
-- ------------------------------------------
--   RLS'li bir tablonun üstüne view açarken İKİSİ de zorunlu:
--     create view ... with (security_invoker = on)
--     grant select ... to service_role;    -- authenticated'a DEĞİL
--   Aksi halde view, altındaki RLS'i sessizce delip geçer.
-- ============================================================================
