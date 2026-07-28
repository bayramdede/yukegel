-- SPRINT_01 A1b — auth_events tablosu
-- Bayram: Supabase SQL Editor'de çalıştır. K1 (kvkk_onay) ile birlikte deploy'dan ÖNCE.
--
-- Neden: app/giris/page.tsx ve app/profil-tamamla/page.tsx aylardır
-- `fetch('/api/auth/log')` çağırıyordu ama o endpoint HİÇ YAZILMAMIŞTI.
-- Çağrılar `.catch(() => {})` ile susturulduğu için kimse fark etmedi
-- (bkz. PROJE_HARITASI "sessiz catch" tuzağı). Yani:
--   - başarısız giriş denemeleri kayıt altında değil
--   - brute-force / OTP bombardımanı tespit edilemiyor
--   - "hesabıma giremiyorum" destek taleplerinde bakılacak hiçbir iz yok
--
-- KVKK: ham telefon, e-posta, şifre ve TAM IP bu tabloya YAZILMAZ.
-- IP maskelenmiş halde tutulur (lib/logger.ts maskIp) — aynı ağdan gelen
-- yoğunluğu görmeye yeter, kişiyi tekilleştirmeye yetmez.

create table if not exists public.auth_events (
  id          bigint generated always as identity primary key,
  event       text        not null,             -- login_success | login_failed | otp_failed | kayit_tamamlandi ...
  method      text        not null,             -- otp | eposta | google | yuk_sahibi | nakliyeci ...
  reason      text,                             -- hata mesajı (Supabase'ten gelen), opsiyonel
  user_id     uuid        references auth.users(id) on delete set null,
  ip_masked   text,                             -- 88.230.*.*  — TAM IP ASLA
  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table public.auth_events is
  'Auth akışı denetim izi. SPRINT_01 A1. Yazma yalnızca service-role (/api/auth/log), okuma yalnızca admin/moderator.';
comment on column public.auth_events.ip_masked is
  'KVKK gereği maskelenmiş IP. Ham IP kaydedilmez.';

-- Sorgu desenleri: "son 24 saat", "şu kullanıcının geçmişi", "başarısız denemeler"
create index if not exists auth_events_created_at_idx on public.auth_events (created_at desc);
create index if not exists auth_events_user_id_idx    on public.auth_events (user_id);
create index if not exists auth_events_event_idx      on public.auth_events (event, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────
-- Varsayılan: hiç kimse. Service-role zaten RLS'i bypass eder, o yüzden
-- insert için ayrı policy'ye GEREK YOK — policy yazarsak anon da yazabilir hale gelir.
alter table public.auth_events enable row level security;

drop policy if exists auth_events_staff_select on public.auth_events;
create policy auth_events_staff_select on public.auth_events
  for select
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'moderator')
    )
  );

-- insert/update/delete için policy YOK → anon ve authenticated hiçbir şey yazamaz.
-- /api/auth/log getServiceSupabase() kullandığı için etkilenmez.

-- ── Doğrulama ────────────────────────────────────────────────────────
--   select * from public.auth_events order by created_at desc limit 20;
--
--   -- son 1 saatte en çok başarısız deneme yapan ağlar
--   select ip_masked, count(*) from public.auth_events
--   where event like '%_failed' and created_at > now() - interval '1 hour'
--   group by 1 order by 2 desc limit 20;

-- ── Saklama süresi ───────────────────────────────────────────────────
-- KVKK ölçülülük: bu izler süresiz tutulmamalı. 90 günden eskisini sil.
-- pg_cron aktifse (Supabase Dashboard → Database → Extensions):
--   select cron.schedule('auth_events_temizlik', '0 4 * * *', $$
--     delete from public.auth_events where created_at < now() - interval '90 days';
--   $$);
-- Aktif değilse elle çalıştır; W2'de otomatikleştirilecek.
