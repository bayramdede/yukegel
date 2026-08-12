-- ============================================================================
-- `ilan_olustur` v5 — BİRLEŞİK HASH (dedup_hash) ATOMİK INSERT
-- Yazım: 12 Ağu 2026
--
-- Bu dosya `docs/20260804_ilan_olustur_v41_ilce_resmi.sql` üzerinden
-- üretilmiştir. Tek değişiklik: `dedup_hash` sütununun insert içine
-- katılmasıdır.
--
-- ============================================================================

begin;

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
  v_id          uuid;
  v_sonuc       jsonb;
  v_origin_pid  smallint;
begin
  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'ilan_olustur: en az bir durak gerekli'
      using errcode = '22023';
  end if;

  v_origin_pid := coalesce(
    nullif(p_listing->>'origin_province_id', '')::smallint,
    (select p.id from public.provinces p
      where public.il_key(p.name) = public.il_key(p_listing->>'origin_city'))
  );

  if v_origin_pid is null then
    raise exception 'ilan_olustur: kalkış ili çözümlenemedi (origin_city=%, origin_province_id=%)',
      p_listing->>'origin_city', p_listing->>'origin_province_id'
      using errcode = '22023';
  end if;

  insert into public.listings (
    listing_type, origin_district, contact_phone,
    origin_province_id, origin_district_official,
    price_offer, price_negotiable, available_date, date_flexible,
    notes, raw_text, source,
    moderation_status, status, trust_level,
    user_id, vehicle_id, vehicle_type, body_type,
    raw_post_id, shadow_profile_id, is_repost, reviewed_at,
    dedup_hash
  )
  values (
    p_listing->>'listing_type',
    p_listing->>'origin_district',
    p_listing->>'contact_phone',
    v_origin_pid,
    coalesce(
      nullif(p_listing->>'origin_district_official', '')::boolean,
      public.ilce_resmi(v_origin_pid, p_listing->>'origin_district')
    ),
    (p_listing->>'price_offer')::numeric,
    coalesce((p_listing->>'price_negotiable')::boolean, false),
    (p_listing->>'available_date')::date,
    coalesce((p_listing->>'date_flexible')::boolean, false),
    p_listing->>'notes',
    p_listing->>'raw_text',
    p_listing->>'source',
    coalesce(p_listing->>'moderation_status', 'pending'),
    coalesce(p_listing->>'status', 'passive'),
    coalesce(p_listing->>'trust_level', 'social'),
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
    end,
    (p_listing->>'raw_post_id')::uuid,
    (p_listing->>'shadow_profile_id')::uuid,
    coalesce((p_listing->>'is_repost')::boolean, false),
    (p_listing->>'reviewed_at')::timestamptz,
    p_listing->>'dedup_hash'
  )
  returning id into v_id;

  if exists (
    select 1
    from jsonb_array_elements(p_stops) as t(s)
    where coalesce(
      nullif(t.s->>'province_id', '')::smallint,
      (select p2.id from public.provinces p2
        where public.il_key(p2.name) = public.il_key(t.s->>'city'))
    ) is null
  ) then
    raise exception 'ilan_olustur: en az bir durağın ili çözümlenemedi (%)',
      (select string_agg(coalesce(t.s->>'city', '<boş>'), ', ')
       from jsonb_array_elements(p_stops) as t(s))
      using errcode = '22023';
  end if;

  insert into public.listing_stops (
    listing_id, stop_order, district, province_id, district_official,
    vehicle_count, cargo_type, weight_ton, pallet_count, notes
  )
  select
    v_id,
    t.ord::int,
    t.s->>'district',
    sp.id,
    coalesce(
      nullif(t.s->>'district_official', '')::boolean,
      public.ilce_resmi(sp.id, t.s->>'district')
    ),
    coalesce((t.s->>'vehicle_count')::int, (p_listing->>'arac_adet')::int),
    t.s->>'cargo_type',
    (t.s->>'weight_ton')::numeric,
    (t.s->>'pallet_count')::int,
    t.s->>'notes'
  from jsonb_array_elements(p_stops) with ordinality as t(s, ord)
  left join lateral (
    select p.id, p.name
    from public.provinces p
    where p.id = coalesce(
      nullif(t.s->>'province_id', '')::smallint,
      (select p2.id from public.provinces p2
        where public.il_key(p2.name) = public.il_key(t.s->>'city'))
    )
  ) sp on true;

  select to_jsonb(x) into v_sonuc
  from (
    select l.id, l.audit_score, l.moderation_status, l.is_shadow_banned
    from public.listings l
    where l.id = v_id
  ) x;

  return v_sonuc;
end;
$$;

grant execute on function public.ilan_olustur(jsonb, jsonb) to authenticated, service_role;

commit;
