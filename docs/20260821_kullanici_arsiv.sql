-- 20260821_kullanici_arsiv.sql — Kullanıcı loglarını ve sorgularını arşivleme
-- Bayram'ın isteği: "kullanıcıların loglarını ve sorgularını bir yerde arşivlesek".
-- Kapsam (AskUserQuestion ile netleştirildi): arama sorguları + ilan görüntülemeleri
-- + admin/moderatör kullanıcı-yönetimi işlemleri, yeni /admin/loglar sayfasında,
-- süresiz saklama.
--
-- ⚠️ KVKK NOTU: `docs/20260728_auth_events.sql` "ölçülülük gereği 90 günden
-- eskisi silinmeli" diyordu (hiç aktif edilmemiş bir cron önerisiydi). Bayram
-- bu üç tablo için de "süresiz sakla" dedi — bilinçli bir tercih olarak
-- işaretlendi (bkz. PROJE_HARITASI §9), ama retention hâlâ KURULMADI. İleride
-- biri "auth_events'i 90 günde temizle" derse bu üçünü de UNUTMASIN.
--
-- auth_events'teki desenin AYNISI: yazma yalnız service-role
-- (RLS'i bypass eder, insert policy YOK), okuma yalnız admin/moderator.

-- ── 1) search_queries — arama kutusu (il filtre) + GPS yakın-konum sorguları ──
create table if not exists public.search_queries (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users(id) on delete set null,
  kaynak       text        not null,   -- 'il_filtre' (/api/listings/ara) | 'yakin_konum' (/api/listings/yakin)
  kalkis_il_id smallint,
  varis_il_id  smallint,               -- 'yakin_konum'da: GPS'ten ÇÖZÜMLENEN il — ham lat/lng TUTULMAZ
  tip          text,                   -- 'yuk' | 'arac' | null (yalnız il_filtre'de anlamlı)
  sonuc_sayisi int,
  ip_masked    text,
  created_at   timestamptz not null default now()
);
comment on table public.search_queries is
  'Arama kutusu (kalkış/varış il filtresi) ve GPS yakın-konum sorgularının arşivi. KVKK: ham GPS koordinatı hiç yazılmaz, yalnız çözümlenen il_id.';
create index if not exists search_queries_created_at_idx on public.search_queries (created_at desc);
create index if not exists search_queries_user_id_idx    on public.search_queries (user_id);
create index if not exists search_queries_kaynak_idx     on public.search_queries (kaynak, created_at desc);

-- ── 2) listing_views — ilan detay sayfası görüntülemeleri ──────────────────
create table if not exists public.listing_views (
  id             bigint generated always as identity primary key,
  listing_id     uuid        not null references public.listings(id) on delete cascade,
  viewer_user_id uuid        references auth.users(id) on delete set null,
  ip_masked      text,
  created_at     timestamptz not null default now()
);
comment on table public.listing_views is
  'İlan detay sayfası görüntüleme izi. Bilinen arama-motoru botları (Googlebot vb.) route seviyesinde (app/ilan/[id]/page.tsx) elenir, buraya hiç yazılmaz.';
create index if not exists listing_views_listing_id_idx on public.listing_views (listing_id, created_at desc);
create index if not exists listing_views_viewer_idx     on public.listing_views (viewer_user_id);
create index if not exists listing_views_created_at_idx on public.listing_views (created_at desc);

-- ── 3) admin_actions — admin/moderatör panelinde kullanıcı yönetimi izi ────
create table if not exists public.admin_actions (
  id             bigint generated always as identity primary key,
  actor_id       uuid        references auth.users(id) on delete set null,  -- işlemi yapan admin/moderatör
  target_user_id uuid        references auth.users(id) on delete set null,  -- işlemin uygulandığı kullanıcı
  alan           text        not null,   -- 'role' | 'is_active' | 'moderator_sources' | 'ai_listing_quota_daily'
  eski_deger     jsonb,
  yeni_deger     jsonb,
  created_at     timestamptz not null default now()
);
comment on table public.admin_actions is
  'admin/kullanicilar (PATCH /api/admin/kullanici) ve moderatör "askıya al" işlemlerinin izi: kim, kimi, hangi alanı, ne''den ne''ye değiştirdi.';
create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx     on public.admin_actions (target_user_id);
create index if not exists admin_actions_actor_idx      on public.admin_actions (actor_id);

-- ── RLS: auth_events ile BİREBİR aynı desen ─────────────────────────────────
alter table public.search_queries enable row level security;
alter table public.listing_views  enable row level security;
alter table public.admin_actions  enable row level security;

drop policy if exists search_queries_staff_select on public.search_queries;
create policy search_queries_staff_select on public.search_queries
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','moderator'))
  );

drop policy if exists listing_views_staff_select on public.listing_views;
create policy listing_views_staff_select on public.listing_views
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','moderator'))
  );

drop policy if exists admin_actions_staff_select on public.admin_actions;
create policy admin_actions_staff_select on public.admin_actions
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','moderator'))
  );

-- insert/update/delete için policy YOK → anon/authenticated hiçbir şey yazamaz.
-- Uygulama tarafı getServiceSupabase() kullandığı için RLS'i bypass eder.

-- ── Doğrulama ────────────────────────────────────────────────────────────
--   select * from public.search_queries order by created_at desc limit 20;
--   select * from public.listing_views  order by created_at desc limit 20;
--   select * from public.admin_actions  order by created_at desc limit 20;
