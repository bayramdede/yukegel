-- ============================================================================
-- 🗑️ TEK KULLANIMLIK — ÇALIŞTIRDIKTAN SONRA SİL.
--
-- Bu dosya `docs/20260731_ilan_olustur_v4.sql`:147-322'nin BİREBİR kopyasıdır.
-- 3 Ağu 2026'da yalnızca kopyala-yapıştır kolaylığı için çıkarıldı, çünkü ilk
-- denemede ADIM 1 hiç uygulanmamış, canlıda v3 kalmıştı.
--
-- ⚠️ İKİ KOPYA = SESSİZ AYRIŞMA RİSKİ. Bu projede tam olarak bu hata sınıfı
--    #36'da (81 il listesi beş yerde) temizlendi. Kaynak dosya ASIL,
--    burası geçici. Düzeltme gerekirse ASLA burayı değil, v4 dosyasını düzenle.
--    → Çalıştırıp doğruladıktan sonra: git rm docs/20260803_v4_adim1_calistir.sql
-- ============================================================================
-- ADIM 1 — v4 GÖVDESİ
-- ============================================================================
-- (v3'ten farklar ⬅️ ile işaretli. Gerisi birebir aynı.)

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
  -- ⬅️ v_origin_city KALDIRILDI — artık yazılacak bir metin kolonu yok.
begin
  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'ilan_olustur: en az bir durak gerekli'
      using errcode = '22023';
  end if;

  -- ── İL ÇÖZÜMLEMESİ ────────────────────────────────────────────────────────
  -- Değişmedi: açık id kazanır, yoksa metinden `il_key()` ile katlanmış eşleşme.
  -- Metin GİRDİ olarak hâlâ hayati; sadece ÇIKTI olarak saklanmıyor.
  v_origin_pid := coalesce(
    nullif(p_listing->>'origin_province_id', '')::smallint,
    (select p.id from public.provinces p
      where public.il_key(p.name) = public.il_key(p_listing->>'origin_city'))
  );

  -- ⬅️ v3'teki `v_origin_city := coalesce(provinces.name, ham metin)` SİLİNDİ.
  --    O coalesce'in ikinci bacağı bilinçli bir veri koruma kararıydı: il
  --    çözülemezse ham metin korunuyordu. Kolon düşünce o koruma da düşer.

  -- ⬅️ GUARD 1 — kalkış.
  --
  -- 🚨 "Ölçüm sıfır çıktı, guard gereksiz" DENMEZ. Sıfırın sebebi verinin
  --    doğası değil, çağıranların üçünden İKİSİNİN kendi kontrolünü yapması
  --    (`lib/ilan-yaz.ts`:247, `app/moderator/actions.ts`:180). Koruma
  --    UYGULAMA katmanında, DB'de değil — ve üçüncü çağıran
  --    (`supabase/functions/parse-listing/index.ts`) o kontrolü YAPMIYOR,
  --    üstelik `origin_province_id`'yi hiç göndermiyor.
  --    v3'te o yoldan çözülemeyen bir il gelse metin kolona yazılıp korunuyordu.
  --    v4'te aynı çağrı KALKIŞI OLMAYAN bir ilan üretir — ne id, ne metin — ve
  --    hata vermez. Sessiz bozulma, gürültülü bozulmadan pahalıdır.
  --
  -- ⚠️ `22023` (invalid_parameter_value) bilinçli: çağıranlar zaten
  --    `PGRST202`/`23514` gibi kodları ayırt ediyor; yeni bir sınıf değil,
  --    "girdi geçersiz" ailesinden. `raise` transaction'ı geri alır, yani
  --    yarım ilan kalmaz (V5 atomiklik garantisi korunur).
  if v_origin_pid is null then
    raise exception 'ilan_olustur: kalkış ili çözümlenemedi (origin_city=%, origin_province_id=%)',
      p_listing->>'origin_city', p_listing->>'origin_province_id'
      using errcode = '22023';
  end if;

  insert into public.listings (
    listing_type, origin_district, contact_phone,   -- ⬅️ origin_city çıkarıldı
    origin_province_id, origin_district_official,
    price_offer, price_negotiable, available_date, date_flexible,
    notes, raw_text, source,
    moderation_status, status, trust_level,
    user_id, vehicle_id, vehicle_type, body_type,
    raw_post_id, shadow_profile_id, is_repost, reviewed_at
  )
  values (
    p_listing->>'listing_type',
    -- ⬅️ v_origin_city değeri çıkarıldı
    p_listing->>'origin_district',
    p_listing->>'contact_phone',
    v_origin_pid,
    nullif(p_listing->>'origin_district_official', '')::boolean,
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
    (p_listing->>'reviewed_at')::timestamptz
  )
  returning id into v_id;

  -- ── DURAKLAR ──────────────────────────────────────────────────────────────
  -- ⚠️ Veri kaybı riski `listings`tekinden DAHA AĞIR: `listings`in bir
  --    `raw_text` yedeği var, `listing_stops`un YOK. İl çözülemeyen bir durak
  --    v4'te `province_id IS NULL` + metin yok = TAMAMEN BOŞ SATIR olur ve o
  --    ilanın rotası sessizce eksilir.

  -- ⬅️ GUARD 2 — duraklar. Kalkıştakiyle aynı gerekçe, daha sert sonuç: kalkışı
  --    olmayan ilan hiç değilse duraklarından okunabilir, ama durağı boş bir
  --    ilanın eksildiğini fark etmenin bir yolu yoktur.
  --    ⚠️ Kontrol INSERT'ten ÖNCE: sonra bakmak "yazdım, sonra beğenmedim"dir.
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
    listing_id, stop_order, district, province_id, district_official,  -- ⬅️ city çıkarıldı
    vehicle_count, cargo_type, weight_ton, pallet_count, notes
  )
  select
    v_id,
    t.ord::int,
    -- ⬅️ `coalesce(sp.name, t.s->>'city')` çıkarıldı
    t.s->>'district',
    sp.id,
    nullif(t.s->>'district_official', '')::boolean,
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

