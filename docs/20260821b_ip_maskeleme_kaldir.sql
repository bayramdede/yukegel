-- 20260821b_ip_maskeleme_kaldir.sql — log tablolarında IP maskelemeyi kaldır
--
-- Bayram'ın bilinçli kararı (21 Ağu 2026): `auth_events`/`search_queries`/
-- `listing_views`de IP artık MASKELENMEDEN yazılıyor. Önceki karar KVKK
-- ölçülülük gerekçesiyle maskelemeyi ZORUNLU kılıyordu (bkz.
-- docs/20260728_auth_events.sql, lib/logger.ts) — bu migration o kararı
-- BİLEREK tersine çeviriyor, unutkanlık değil. Risk kabul edildi.
--
-- Not: `structuredLog` (Vercel stdout logları) HÂLÂ maskeli — bu değişiklik
-- yalnız admin panelinde görünen/DB'de saklanan üç log tablosunu kapsıyor.

alter table public.auth_events    rename column ip_masked to ip;
alter table public.search_queries rename column ip_masked to ip;
alter table public.listing_views  rename column ip_masked to ip;

comment on column public.auth_events.ip is
  'Ham IP adresi. 21 Ağu 2026''dan önce maskeliydi (KVKK) — Bayram''ın bilinçli kararıyla kaldırıldı.';
comment on column public.search_queries.ip is
  'Ham IP adresi. 21 Ağu 2026''dan önce maskeliydi (KVKK) — Bayram''ın bilinçli kararıyla kaldırıldı.';
comment on column public.listing_views.ip is
  'Ham IP adresi. 21 Ağu 2026''dan önce maskeliydi (KVKK) — Bayram''ın bilinçli kararıyla kaldırıldı.';

-- ── Doğrulama ────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name in ('auth_events','search_queries','listing_views')
--   and column_name in ('ip','ip_masked');
