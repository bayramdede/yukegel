-- ============================================================================
-- Güvenlik takibi madde 3 — public.users.phone_verified UPDATE yetkisini geri al
--
-- ✅ UYGULANDI — 11 Ağu 2026, kod deploy'undan (`58d8c17`) SONRA `apply_migration`
-- ile çalıştırıldı ve canlıda saldırı senaryosu bizzat denenerek doğrulandı
-- (42501 + meşru alanlar bozulmadı). Ayrıntı: `docs/ARSIV_YAPILACAKLAR.md`.
-- Bu dosya artık yalnız KAYIT amaçlı — tekrar ÇALIŞTIRMAYA gerek yok.
--
-- ÖNCE KODU DEPLOY ET, SONRA BUNU ÇALIŞTIR (sıra tersine olursa panelin
-- telefon değiştirme akışı istemciden geri düşer ve 42501 ile patlar).
-- ============================================================================
--
-- SORUN
-- -----
-- `app/panel/PanelClient.tsx` OTP doğrulandıktan SONRA istemciden doğrudan
-- `supabase.from('users').update({ phone, phone_verified: true })` çağırıyordu.
-- Dürüst akışta bu satır gerçekten `auth.verifyOtp()` başarılı olduktan sonra
-- çalışıyordu, ama `authenticated` rolünün bu kolon üzerinde PostgREST UPDATE
-- yetkisi olduğu sürece saldırganın o akışı TAKİP ETMESİ gerekmiyordu — aynı
-- oturumla, OTP'siz, doğrudan aynı `update`i atabiliyordu. Rozet zaten
-- kaldırıldı (10 Ağu, `docs/ARSIV_YAPILACAKLAR.md`) ama kolon MAYIN olarak
-- duruyordu: Faz 3 güven puanı ya da yeni bir yüzey bu bayrağı okumaya
-- başlarsa açık aynen geri gelirdi.
--
-- ÇÖZÜM
-- -----
-- Kod tarafı ÖNCE deploy edildi: `app/api/auth/telefon-degistir/route.ts`
-- (yeni) — `verifyOtp` SSR client'la sunucuda çalışır, `phone_verified` YALNIZ
-- gerçek doğrulama başarısından sonra `getServiceSupabase()` ile yazılır.
-- `PanelClient.tsx`'teki `otpGonder`/`otpDogrula` artık bu route'a fetch atıyor.
--
-- Bu migration DB tarafını kapatıyor: `authenticated`in `phone_verified`
-- üzerindeki UPDATE yetkisi geri alınıyor — kod atlanıp PostgREST'e doğrudan
-- istekle de artık yazılamaz.
--
-- ⚠️ KAPSAM BİLEREK DAR TUTULDU (7 Ağu'daki `public.users` olayının dersi —
-- bkz. `docs/PROJE_HARITASI.md` §9 "8 AĞU 2026 — OLAY"):
--   · SADECE UPDATE geri alınıyor, SELECT'e DOKUNULMUYOR. `anon`/`authenticated`
--     zaten `phone_verified`i SELECT edebiliyordu (7/8 Ağu'daki dar GRANT'ın
--     parçası) ve bu asıl açık DEĞİLDİ — sorun YAZMAYDI. SELECT'i de kapatmak
--     ekstra risk katardı, kazanç getirmezdi.
--   · SADECE `phone_verified` kolonu — `bio`/`company_name`/`display_name`/
--     `phone` UPDATE yetkileri AYNEN KALIYOR (profil formu, telefon numarası
--     yazımı bozulmasın).
--   · Mevcut UPDATE GRANT'ı zaten KOLON BAZLI (`bio, company_name,
--     display_name, phone, phone_verified` — 7/8 Ağu'dan kalma), yani TABLO
--     GENELİ bir GRANT'ın kolon bazlı REVOKE'u EZMESİ riski burada YOK
--     (aksi hâlde `docs/20260728_contact_phone_revoke.sql`'deki gibi önce
--     tüm tabloyu REVOKE edip diğer kolonları tek tek geri vermek gerekirdi).
--
-- ÖN KONTROL — mevcut durum (11 Ağu 2026'da execute_sql ile doğrulandı):
--   authenticated UPDATE: bio, company_name, display_name, phone, phone_verified
--   anon/authenticated SELECT: created_at, display_name, id, is_active,
--     merged_into, phone_verified, role, user_type   (DEĞİŞMİYOR)
--
-- TÜKETİCİ TARAMASI (7 Ağu'nun "20+ yer atlandı" hatasını tekrarlamamak için
-- TAM kod taraması yapıldı — `grep -rn phone_verified app lib`):
--   ✅ app/panel/page.tsx            → getServiceSupabase (SELECT) — etkilenmez
--   ✅ app/panel/PanelClient.tsx:937 → artık /api/auth/telefon-degistir'e gidiyor
--   ✅ app/profil-tamamla/actions.ts → getServiceSupabase (SELECT+UPDATE) — etkilenmez
--   ✅ app/api/auth/merge/route.ts   → getServiceSupabase (UPDATE) — etkilenmez
--   ✅ app/api/ilan/[id]/sahiplen/route.ts → getServiceSupabase (INSERT) — etkilenmez
--   Hiçbir yol `authenticated` rolüyle (istemci/anon key) bu kolona YAZMIYOR.
-- ============================================================================

begin;

-- Mevcut durumu kayda geçir (çıktıyı sakla; geri alman gerekirse lazım olur).
select grantee, privilege_type, string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'users' and grantee in ('anon', 'authenticated')
group by grantee, privilege_type
order by grantee, privilege_type;

-- ── Asıl işlem ──────────────────────────────────────────────────────────────
-- Mevcut GRANT zaten kolon bazlı olduğu için doğrudan kolon bazlı REVOKE yeterli.
revoke update (phone_verified) on public.users from authenticated;

-- Doğrulama: aşağıdaki sorgu SIFIR satır dönmeli.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'users'
  and column_name = 'phone_verified' and privilege_type = 'UPDATE'
  and grantee in ('anon', 'authenticated');

-- Doğrulama 2: diğer dört kolon (bio/company_name/display_name/phone) hâlâ
-- UPDATE edilebilir olmalı — aşağıdaki sorgu DÖRT satır dönmeli.
select column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'users'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;

commit;

-- ============================================================================
-- DEPLOY SONRASI DUMAN TESTİ
-- ============================================================================
-- 1) Panelde profil formu (Ad Soyad / Şirket / Bio) kaydediliyor mu?
--    (Bu kolonlar etkilenmedi, ama regresyon olmadığını teyit et.)
-- 2) Panelde "Telefon Numarası" → "Değiştir" → yeni numara → SMS kodu gönder →
--    kodu gir → "Telefon numarası güncellendi." mesajı çıkıyor mu?
--    (Artık /api/auth/telefon-degistir üzerinden, service role ile yazıyor.)
-- 3) Tarayıcı konsolunda anon key ile dene — HATA dönmeli, veri YAZILMAMALI:
--      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.<herhangi-bir-id>`, {
--        method: 'PATCH',
--        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`,
--                    'Content-Type': 'application/json' },
--        body: JSON.stringify({ phone_verified: true }),
--      }).then(r => r.status)
--    Beklenen: 401/403/404 (RLS + eksik oturum zaten engeller) — GERÇEK testte
--    geçerli bir authenticated oturumla dene, beklenen 42501 (permission denied
--    for column phone_verified).
--
-- GERİ ALMA (bir şey kırılırsa)
-- ----------------------------
--   grant update (phone_verified) on public.users to authenticated;
-- ============================================================================
