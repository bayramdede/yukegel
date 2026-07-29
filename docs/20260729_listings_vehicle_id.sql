-- ============================================================================
-- ILAN_VER_ANALIZ B3 — Seçilen aracı ilana BAĞLA (listings.vehicle_id)
--
-- Bayram: Supabase SQL Editor'de çalıştır.
-- ⚠️ SIRA: önce `20260729_ilan_olustur_rpc.sql`, sonra BU dosya, sonra kod deploy.
--    (Bu dosya o fonksiyonu `create or replace` ile yeniden yazıyor.)
-- ============================================================================
--
-- SORUN
-- -----
-- `/ilan-ver` "araç ilanı" modunda kullanıcıya kendi araçlarını listeliyor ve
-- birini seçtiriyor (`app/ilan-ver/page.tsx`, `secilenArac`). Seçim formu
-- şekillendiriyor — `vehicle_type` ve `body_types` alanları ondan doluyor —
-- ama **`secilenArac.id` hiçbir yere yazılmıyor.** Yani:
--
--   - Aynı kullanıcının iki tırından HANGİSİ için ilan verildiği kayıtlı değil.
--   - Araç silinince/pasife alınınca ilanla ilişkisi kurulamıyor.
--   - "Bu aracın ilanları" gibi bir ekran yazılamıyor.
--   - Kullanıcının gördüğü seçim ile veritabanındaki gerçek arasında sessiz fark.
--
-- Seçim ekranı kullanıcıya bir söz veriyor, veri modeli o sözü tutmuyor.
--
-- ÇÖZÜM
-- -----
-- `listings.vehicle_id` (nullable FK). Yük ilanlarında NULL kalır — normal.
-- `on delete set null`: araç silinse de ilan geçmişi kaybolmaz.
--
-- 🚨 GRANT ŞART. `public.listings` 28 Tem 2026'dan beri KOLON BAZLI
-- yetkilendirilmiş bir tablodur (`20260728_contact_phone_revoke.sql` tablo geneli
-- yetkiyi alıp kolonları tek tek geri verdi). Yeni kolon `anon`/`authenticated`
-- için YETKİSİZ DOĞAR ve ilk okumada `42501 permission denied for column
-- vehicle_id` ile patlar — üstelik hata uygulamada "ilan bulunamadı" gibi görünür.
-- Bkz. `PROJE_HARITASI §9`.
-- ============================================================================

begin;

-- ── 1) Kolon ────────────────────────────────────────────────────────────────
alter table public.listings
  add column if not exists vehicle_id uuid
  references public.vehicles(id) on delete set null;

comment on column public.listings.vehicle_id is
  'ILAN_VER_ANALIZ B3 — araç ilanlarında ilanı veren SPESİFİK araç. '
  'Yük ilanlarında NULL. Sahiplik doğrulaması lib/ilan-yaz.ts içinde.';

-- ── 2) GRANT (unutulursa 42501) ─────────────────────────────────────────────
grant select (vehicle_id) on public.listings to anon;
grant select (vehicle_id), insert (vehicle_id), update (vehicle_id)
  on public.listings to authenticated;

-- ── 3) İndeks — "bu aracın ilanları" sorgusu için ───────────────────────────
create index if not exists idx_listings_vehicle_id
  on public.listings (vehicle_id)
  where vehicle_id is not null;

-- ── 4) RPC'yi yeni kolonla yeniden yaz ──────────────────────────────────────
-- (Gövde `20260729_ilan_olustur_rpc.sql` ile aynı; tek fark `vehicle_id`.)
create or replace function public.ilan_olustur(
  p_listing jsonb,
  p_stops   jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id     uuid;
  v_sonuc  jsonb;
begin
  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'ilan_olustur: en az bir durak gerekli'
      using errcode = '22023';
  end if;

  insert into public.listings (
    listing_type, origin_city, origin_district, contact_phone,
    price_offer, price_negotiable, available_date, date_flexible,
    notes, raw_text, source,
    moderation_status, status, trust_level,
    user_id, vehicle_id, vehicle_type, body_type
  )
  values (
    p_listing->>'listing_type',
    p_listing->>'origin_city',
    p_listing->>'origin_district',
    p_listing->>'contact_phone',
    (p_listing->>'price_offer')::numeric,
    coalesce((p_listing->>'price_negotiable')::boolean, false),
    (p_listing->>'available_date')::date,
    coalesce((p_listing->>'date_flexible')::boolean, false),
    p_listing->>'notes',
    p_listing->>'raw_text',
    p_listing->>'source',
    p_listing->>'moderation_status',
    p_listing->>'status',
    p_listing->>'trust_level',
    (p_listing->>'user_id')::uuid,
    (p_listing->>'vehicle_id')::uuid,
    case
      when jsonb_typeof(p_listing->'vehicle_type') = 'array'
      then array(select jsonb_array_elements_text(p_listing->'vehicle_type'))
      else null
    end,
    case
      when jsonb_typeof(p_listing->'body_type') = 'array'
      then array(select jsonb_array_elements_text(p_listing->'body_type'))
      else null
    end
  )
  returning id into v_id;

  insert into public.listing_stops (
    listing_id, stop_order, city, district,
    vehicle_count, cargo_type, weight_ton, pallet_count, notes
  )
  select
    v_id,
    t.ord::int,
    t.s->>'city',
    t.s->>'district',
    (p_listing->>'arac_adet')::int,
    t.s->>'cargo_type',
    (t.s->>'weight_ton')::numeric,
    (t.s->>'pallet_count')::int,
    t.s->>'notes'
  from jsonb_array_elements(p_stops) with ordinality as t(s, ord);

  select to_jsonb(x) into v_sonuc
  from (
    select l.id, l.audit_score, l.moderation_status, l.is_shadow_banned
    from public.listings l
    where l.id = v_id
  ) x;

  return v_sonuc;
end;
$$;

revoke execute on function public.ilan_olustur(jsonb, jsonb) from public;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from anon;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from authenticated;
grant  execute on function public.ilan_olustur(jsonb, jsonb) to service_role;

commit;

-- ============================================================================
-- DOĞRULAMA
-- ============================================================================
-- 1) Yetkisiz kolon kalmadı mı? (SIFIR satır dönmeli)
--      select c.column_name
--      from information_schema.columns c
--      where c.table_schema = 'public' and c.table_name = 'listings'
--        and c.column_name <> 'contact_phone'
--        and not exists (
--          select 1 from information_schema.column_privileges p
--          where p.table_name = 'listings' and p.column_name = c.column_name
--            and p.grantee = 'authenticated');
--
-- 2) FK yerinde mi?
--      select conname, confrelid::regclass
--      from pg_constraint
--      where conrelid = 'public.listings'::regclass and contype = 'f';
--
-- DEPLOY SONRASI DUMAN TESTİ
-- --------------------------
-- 1) /araclarim → iki araç ekle.
-- 2) /ilan-ver → "Araç ilanı" → ikinci aracı seç → ilan ver.
-- 3)  select id, vehicle_id, vehicle_type from public.listings
--     order by created_at desc limit 1;
--     → vehicle_id seçtiğin aracın id'si OLMALI.
-- 4) Yük ilanı ver → vehicle_id NULL olmalı.
-- 5) Başka bir kullanıcının araç id'sini devtools'tan gönderip dene:
--    ilan yine oluşmalı ama vehicle_id NULL olmalı (sahiplik doğrulaması
--    `lib/ilan-yaz.ts` içinde, sessizce düşürüyor).
--
-- GERİ ALMA
-- ---------
--   drop index if exists idx_listings_vehicle_id;
--   alter table public.listings drop column if exists vehicle_id;
--   -- ardından 20260729_ilan_olustur_rpc.sql'i tekrar çalıştır
-- ============================================================================
