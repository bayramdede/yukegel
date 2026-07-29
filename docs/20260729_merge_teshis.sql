-- ============================================================================
-- A10 — "Hesabınız başka bir hesabınızla birleştirildi" giriş döngüsü — TEŞHİS
--
-- Bayram: Supabase SQL Editor'de sırayla çalıştır, çıktıları bana ver.
-- BU DOSYA HİÇBİR ŞEY DEĞİŞTİRMEZ — sadece okur.
--
-- DURUM
-- -----
-- Giriş yaptığın auth kimliğinin `public.users` satırında `merged_into` dolu.
-- `proxy.ts` (satır 127-139) bunu görünce sb- cookie'lerini siliyor ve seni
-- `/giris?hesap=tasindi` adresine atıyor. Aynı kimlikle tekrar girince aynı
-- satıra düşüyorsun → sonsuz döngü. Kodda bu durumdan çıkış yolu yok.
--
-- ÖNEMLİ AYRINTI: merge sırasında (`app/api/auth/merge/route.ts` satır 56-59)
-- emekli satırın `email`, `phone`, `username`, `tckn`, `vkn` alanları NULL'lanır.
-- Bu yüzden emekli satırı e-posta ile ARAYAMAZSIN — aşağıdaki sorgular auth
-- tarafından kimlik üzerinden gidiyor.
-- ============================================================================


-- ── 1) Senin auth kimliklerin ───────────────────────────────────────────────
-- Aynı kişiye ait birden fazla auth.users kaydı olabilir (Google + telefon OTP).
-- `son_giris` en son hangisiyle girdiğini gösterir — döngüye sokan o.
select
  a.id                as auth_id,
  a.email             as auth_eposta,
  a.phone             as auth_telefon,
  a.created_at        as olusturma,
  a.last_sign_in_at   as son_giris,
  (select array_agg(i.provider order by i.provider)
     from auth.identities i where i.user_id = a.id) as saglayicilar
from auth.users a
where a.email ilike 'bayramdede@gmail.com'
   or a.id in (
     select id from public.users
     where email ilike 'bayramdede@gmail.com'
        or merged_into is not null
   )
order by a.last_sign_in_at desc nulls last;


-- ── 2) Bu kimliklere karşılık gelen public.users satırları ──────────────────
-- `merged_into` dolu olan = emekli (seni döngüye sokan) satır.
-- `merged_into` boş olan   = canlı hesap. Rol/user_type buradan okunur.
select
  u.id,
  u.email,
  u.phone,
  u.display_name,
  u.user_type,
  u.role,
  u.is_active,
  u.merged_into,
  u.created_at
from public.users u
where u.id in (
  select a.id from auth.users a
  where a.email ilike 'bayramdede@gmail.com'
)
   or u.email ilike 'bayramdede@gmail.com'
   or u.merged_into in (
     select a.id from auth.users a where a.email ilike 'bayramdede@gmail.com'
   )
   or u.id in (
     select m.merged_into from public.users m
     where m.id in (select a.id from auth.users a where a.email ilike 'bayramdede@gmail.com')
   )
order by u.merged_into nulls first, u.created_at;


-- ── 3) Son merge işlemleri (zincir kopuk mu?) ───────────────────────────────
-- `canli_id` dolu ama `canli_var` false ise: merge hedefi silinmiş →
-- emekli satır asla kurtarılamaz, o kullanıcı kalıcı kilitli demektir.
select
  r.id                       as emekli_id,
  r.merged_into              as canli_id,
  (c.id is not null)         as canli_var,
  c.email                    as canli_eposta,
  c.phone                    as canli_telefon,
  c.display_name             as canli_ad,
  c.user_type                as canli_user_type,
  c.role                     as canli_rol,
  r.created_at               as emekli_olusturma
from public.users r
left join public.users c on c.id = r.merged_into
where r.merged_into is not null
order by r.created_at desc
limit 20;


-- ── 4) Admin rolü kimde? ────────────────────────────────────────────────────
-- Merge, emekli satırın rolünü `'user'`a düşürür (merge/route.ts satır 54).
-- Admin yetkisi yanlış satırda kaldıysa burada görünür.
select id, email, phone, display_name, role, is_active, merged_into
from public.users
where role in ('admin', 'moderator')
order by role, created_at;
