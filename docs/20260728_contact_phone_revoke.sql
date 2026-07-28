-- ============================================================================
-- SPRINT_01 L1e — listings.contact_phone kolon yetkisini geri al
--
-- Bayram: Supabase SQL Editor'de çalıştır. ÖNCE KODU DEPLOY ET, SONRA BUNU ÇALIŞTIR.
-- (Sıra tersine olursa panel ve moderatör ekranı numarayı yazamaz.)
-- ============================================================================
--
-- SORUN
-- -----
-- L1 / L1c / L1d / L1f ile numarayı istemciye gönderen TÜM arayüz yollarını
-- kapattık. Ama bu yalnızca "biz göstermiyoruz" demekti. PostgREST'te
-- `anon` ve `authenticated` rollerinin `listings.contact_phone` üzerindeki
-- SELECT yetkisi durduğu sürece, anon key'i olan herkes (yani sayfanın
-- kaynağına bakan herkes) şunu yazabiliyordu:
--
--   GET /rest/v1/listings?select=id,contact_phone&limit=1000
--   apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>
--
-- RLS burada koruma sağlamaz: RLS SATIR bazlıdır, KOLON bazlı değildir.
-- Aktif ilanların satırları zaten herkese açık olduğu için (ilan listesi
-- çalışsın diye) numara da o satırlarla birlikte geliyordu.
--
-- ÇÖZÜM
-- -----
-- Kolon yetkisini rollerden al. Numara artık yalnızca service-role kullanan
-- sunucu yollarından okunur/yazılır:
--   - app/api/ilan/[id]/telefon/route.ts   (giriş yapmış + profili tam kullanıcı)
--   - app/api/ilan/[id]/sahiplen/route.ts  (maskeli + OTP)
--   - app/ilan/[id]/page.tsx               (server component, service-role)
--   - app/panel/page.tsx + app/panel/actions.ts   (kendi ilanların)
--   - app/moderator/actions.ts             (requireStaff ile korunmuş)
--
-- ÖN KOŞUL (deploy edilmiş olmalı)
-- --------------------------------
--   app/panel/actions.ts          (yeni)
--   app/panel/IlanYonetim.tsx     (anon istemci kaldırıldı)
--   app/moderator/actions.ts      (yeni)
--   app/moderator/page.tsx        (contact_phone select/update/insert'ten çıktı)
-- ============================================================================

begin;

-- Mevcut durumu kayda geçir (çıktıyı sakla; geri alman gerekirse lazım olur).
select grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'listings'
  and column_name  = 'contact_phone'
order by grantee, privilege_type;

-- ── Asıl işlem ──────────────────────────────────────────────────────────────
-- Not: tablo geneline verilmiş GRANT varsa kolon bazlı REVOKE onu ezmez.
-- Bu yüzden önce tablo geneli yetkiyi alıp, sonra contact_phone HARİÇ tüm
-- kolonları tek tek geri veriyoruz.

revoke select, insert, update on public.listings from anon;
revoke select, insert, update on public.listings from authenticated;

do $$
declare
  kolonlar text;
begin
  select string_agg(quote_ident(column_name), ', ')
    into kolonlar
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = 'listings'
    and column_name <> 'contact_phone';

  execute format('grant select (%s) on public.listings to anon', kolonlar);
  execute format('grant select (%s) on public.listings to authenticated', kolonlar);
  execute format('grant insert (%s) on public.listings to authenticated', kolonlar);
  execute format('grant update (%s) on public.listings to authenticated', kolonlar);
end $$;

-- Doğrulama: aşağıdaki sorgu SIFIR satır dönmeli.
select grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'listings'
  and column_name  = 'contact_phone'
  and grantee in ('anon', 'authenticated');

commit;

-- ============================================================================
-- DEPLOY SONRASI DUMAN TESTİ
-- ============================================================================
-- 1) Çıkış yapıp ana sayfa + /ilan/[id] açılıyor mu? (anon SELECT hâlâ çalışmalı)
-- 2) Giriş yapıp /panel → bir ilanı düzenle → telefonu değiştir → kaydet.
--    Kaydedilmeli. (Artık app/panel/actions.ts üzerinden gidiyor.)
-- 3) /moderator → liste açılıyor mu, telefon sütunu dolu mu?
-- 4) /moderator → bir ilanı düzenle, telefonu değiştir, "Onayla".
-- 5) Tarayıcı konsolunda şunu dene — HATA dönmeli, veri DÖNMEMELİ:
--      await (await fetch(
--        `${location.origin.replace('yukegel.com','')}` , {}
--      ))  // ya da doğrudan Supabase REST URL'ine:
--      // GET <SUPABASE_URL>/rest/v1/listings?select=contact_phone&limit=1
--      // apikey: <anon key>
--    Beklenen: 42501 permission denied for column contact_phone.
--
-- GERİ ALMA (bir şey kırılırsa)
-- ----------------------------
--   grant select (contact_phone) on public.listings to anon;
--   grant select (contact_phone), insert (contact_phone), update (contact_phone)
--     on public.listings to authenticated;
-- ============================================================================
