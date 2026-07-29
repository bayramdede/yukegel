-- ============================================================================
-- ILAN_VER_ANALIZ W1+ — `ilan_olustur` v2: OTOMATİK ve PERSONEL yollarını da al
--
-- Bayram: Supabase SQL Editor'de çalıştır.
-- ⚠️ SIRA: `20260729_ilan_olustur_rpc.sql` → `20260729_listings_vehicle_id.sql`
--          → BU DOSYA → kod deploy.
--    Bu dosya fonksiyonu `create or replace` ile yeniden yazar; kolon eklemez.
-- ============================================================================
--
-- SORUN
-- -----
-- V5 `listings` + `listing_stops` yazımını tek transaction'a aldı, ama YALNIZCA
-- `lib/ilan-yaz.ts`'ten geçen iki kanal için (form, Excel). Aynı tabloya yazan
-- ÜÇ yol daha vardı ve üçü de hâlâ kendi iki ayrı INSERT'ini atıyordu:
--
--   1. `app/api/whatsapp/route.ts`               (Twilio webhook)
--   2. `supabase/functions/parse-listing`        (raw_posts trigger'ı, Deno)
--   3. `app/moderator/page.tsx` "Manuel Gir"     (personel eliyle)
--
-- Yani duraksız yetim ilan üretme ihtimali kapanmadı; sadece en görünür yoldan
-- en görünmez yollara taşındı. Üstelik bu üçü insan formundan değil bot/serbest
-- metinden besleniyor — yani en çok doğrulama gereken, en az doğrulaması olan
-- yollar bunlardı.
--
-- (1) `ilanYaz()`'a alındı. (2) ve (3) Deno'da / anon istemcide çalıştığı için
-- `lib/ilan-yaz.ts`'i import EDEMEZ; ortak zemin bu RPC olmak zorunda.
--
-- ÇÖZÜM
-- -----
-- Fonksiyona o iki yolun ihtiyaç duyduğu alanlar eklendi:
--
--   `raw_post_id`        — hangi ham mesajdan üretildi (2 ve 3)
--   `shadow_profile_id`  — kayıtsız gönderici için gölge profil (2)
--   `is_repost`          — tekrar paylaşım bayrağı (2)
--   `reviewed_at`        — personel onayı ile doğan ilan (3)
--
-- ve `listing_stops.vehicle_count` artık ÖNCE durağın kendi değerine bakıyor,
-- yoksa ilan geneline (`arac_adet`) düşüyor. Moderatör paneli durak başına araç
-- adedi girebiliyordu; v1'de bu değer sessizce eziliyordu.
--
-- 🚨 Alanların hepsi OPSİYONEL: `p_listing` içinde yoksa `->>` NULL döner ve
-- kolon NULL kalır. Mevcut iki çağıran (`lib/ilan-yaz.ts`) DEĞİŞMEDEN çalışır.
-- Bu, `PROJE_HARITASI §9`'daki "jsonb RPC ayrışmayı derleme zamanında gizler"
-- kuralının iyi tarafı: eklemek geriye dönük kırmıyor. Kötü tarafı da aynı —
-- yeni alanı çağırana koymayı unutursan sessizce NULL kalır, test et.
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
  v_id     uuid;
  v_sonuc  jsonb;
begin
  -- Duraksız ilan = ana sayfada hiç görünmeyen, moderatör kuyruğunu tıkayan
  -- hayalet kayıt. V5'in tüm sebebi buydu; kapıyı burada tutuyoruz.
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
    user_id, vehicle_id, vehicle_type, body_type,
    raw_post_id, shadow_profile_id, is_repost, reviewed_at
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
    end,
    (p_listing->>'raw_post_id')::uuid,
    (p_listing->>'shadow_profile_id')::uuid,
    coalesce((p_listing->>'is_repost')::boolean, false),
    (p_listing->>'reviewed_at')::timestamptz
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
    -- Durağın kendi araç adedi kazanır; yoksa ilan geneli.
    coalesce((t.s->>'vehicle_count')::int, (p_listing->>'arac_adet')::int),
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

-- ⚠️ `create or replace` yetkileri KORUR, ama açıkça tekrar yazmak ucuz sigorta:
-- bir gün `drop function` + `create` yapılırsa yetkiler sıfırlanır ve fonksiyon
-- `authenticated`'a açık doğar. Bu fonksiyon `moderation_status`/`trust_level`
-- yazabildiği için istemciye AÇILMAMALI.
revoke execute on function public.ilan_olustur(jsonb, jsonb) from public;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from anon;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from authenticated;
grant  execute on function public.ilan_olustur(jsonb, jsonb) to service_role;

commit;

-- ============================================================================
-- DOĞRULAMA
-- ============================================================================
-- 1) Yetki doğru mu? (yalnız service_role satırı dönmeli)
--      select r.rolname, has_function_privilege(r.rolname, 'public.ilan_olustur(jsonb,jsonb)', 'execute')
--      from pg_roles r
--      where r.rolname in ('anon','authenticated','service_role');
--
-- 2) Yeni alanlar gerçekten yazılıyor mu? (geri sarmalı test)
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object(
--          'listing_type','yuk','origin_city','Ankara','source','whatsapp',
--          'moderation_status','pending','status','active','trust_level','social',
--          'is_repost', true, 'arac_adet', 2
--        ),
--        jsonb_build_array(
--          jsonb_build_object('city','İzmir','vehicle_count',5),
--          jsonb_build_object('city','Konya')
--        )
--      );
--      -- durak 1 → vehicle_count 5 (durağın kendi değeri)
--      -- durak 2 → vehicle_count 2 (ilan geneli)
--      select stop_order, city, vehicle_count from public.listing_stops
--      where listing_id = (select id from public.listings order by created_at desc limit 1)
--      order by stop_order;
--      rollback;
--
-- 3) Duraksız çağrı hâlâ reddediliyor mu? (22023 vermeli, ilan OLUŞMAMALI)
--      begin;
--      select public.ilan_olustur('{"listing_type":"yuk","origin_city":"Ankara"}'::jsonb, '[]'::jsonb);
--      rollback;
--
-- DEPLOY SONRASI DUMAN TESTİ
-- --------------------------
-- 1) WhatsApp'tan ilan gönder → ilan `pending` + `passive` olmalı (kanal
--    politikası gereği yayına ÇIKMAZ), durakları dolu olmalı.
-- 2) Moderatör paneli → "Manuel Gir" → Kaydet ve Onayla → ilan + duraklar
--    birlikte oluşmalı, `raw_post_id` dolu, `reviewed_at` dolu olmalı.
-- 3) Yetim ilan kalmadı mı?
--      select l.id, l.source, l.created_at from public.listings l
--      where not exists (select 1 from public.listing_stops s where s.listing_id = l.id)
--      order by l.created_at desc limit 20;
--
-- GERİ ALMA
-- ---------
--   `20260729_listings_vehicle_id.sql` dosyasındaki fonksiyon gövdesini tekrar
--   çalıştır (v1'e döner). Kolon/indeks değişmediği için başka bir şey gerekmez.
--   ⚠️ Ama v1'e dönersen moderatör "Manuel Gir" ve Edge Function `raw_post_id`
--   yazamaz — o iki kanalı da eski INSERT'lerine geri almak gerekir.
-- ============================================================================
