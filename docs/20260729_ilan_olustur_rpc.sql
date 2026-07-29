-- ============================================================================
-- ILAN_VER_ANALIZ V5 — İlan + duraklar ATOMİK yazma (tek RPC)
--
-- Bayram: Supabase SQL Editor'de çalıştır. ⚠️ ÖNCE BUNU ÇALIŞTIR, SONRA KODU
-- DEPLOY ET. (`20260728_contact_phone_revoke.sql`'in TERSİ sıra: orada kod
-- yetkiden önce gitmeliydi, burada fonksiyon koddan önce var olmalı — yoksa
-- `lib/ilan-yaz.ts` `PGRST202 function not found` alır ve ilan verme durur.)
-- ============================================================================
--
-- SORUN
-- -----
-- `lib/ilan-yaz.ts` bir ilanı İKİ ayrı istekte yazıyordu:
--
--   1) insert into listings ...        → id döner
--   2) insert into listing_stops ...   → duraklar
--
-- PostgREST'te her istek KENDİ transaction'ı. İkincisi patlarsa birincisi
-- kalıcı olur: **duraksız ilan**. Duraksız ilan "nereye?" sorusuna cevap
-- veremez; ana sayfadaki varış filtresi (`listing_stops.city`) onu hiç
-- görmez, ama moderatör kuyruğunda ve kullanıcının panelinde durur.
--
-- Geçici çare olarak koda telafi edici bir `delete` konmuştu. O da yetersiz:
-- silme isteğinin kendisi de başarısız olabilir (ağ koptu, süre doldu, node
-- öldü) ve tam o anda yetim kayıt kalıcı hâle gelir. Telafi ≠ atomiklik.
--
-- ÇÖZÜM
-- -----
-- İki INSERT'i tek `plpgsql` fonksiyonuna al. Fonksiyon gövdesi tek
-- transaction'da çalışır: durak insert'i patlarsa ilan insert'i de geri sarılır.
-- Yetim kayıt üretilemez hâle gelir — telafi mantığına gerek kalmaz.
--
-- ⚠️ `security invoker` (varsayılan) BİLEREK seçildi, `definer` DEĞİL.
-- Bu fonksiyon zaten yalnızca service-role ile çağrılıyor; `definer` yapmak
-- fonksiyonu ele geçirilebilir bir ayrıcalık yükseltme yüzeyine çevirirdi
-- (`anon` çağırabilseydi kolon yetkilerini ve RLS'i baypas ederdi).
-- Ayrıca EXECUTE yetkisi `public`ten alınıp yalnız `service_role`a veriliyor.
--
-- ⚠️ `audit_listing_fn()` BEFORE INSERT trigger'ı bu fonksiyonun İÇİNDE de
-- çalışır — `audit_score`, `is_shadow_banned` ve reddedilme dalı aynen işler.
-- Bu yüzden fonksiyon INSERT sonrası satırı geri okuyup döndürüyor; V3
-- moderasyon kararı (31–70 bandı) uygulama katmanında bu değerlerle veriliyor.
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
    user_id, vehicle_type, body_type
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
    -- `with ordinality` sıra numarasını ÜRETİR; istemciden gelen bir alana
    -- güvenmiyoruz (aynı `stop_order`lı iki durak sıralamayı bozardı).
    t.ord::int,
    t.s->>'city',
    t.s->>'district',
    (p_listing->>'arac_adet')::int,
    t.s->>'cargo_type',
    (t.s->>'weight_ton')::numeric,
    (t.s->>'pallet_count')::int,
    t.s->>'notes'
  from jsonb_array_elements(p_stops) with ordinality as t(s, ord);

  -- Trigger'ın hesapladığı alanları GERİ OKU (V3 kararı bunlara bakıyor).
  select to_jsonb(x) into v_sonuc
  from (
    select l.id, l.audit_score, l.moderation_status, l.is_shadow_banned
    from public.listings l
    where l.id = v_id
  ) x;

  return v_sonuc;
end;
$$;

comment on function public.ilan_olustur(jsonb, jsonb) is
  'ILAN_VER_ANALIZ V5 — ilan + duraklarını tek transaction''da yazar, '
  'trigger''ın hesapladığı audit alanlarıyla birlikte döner. '
  'Yalnız service-role çağırır (lib/ilan-yaz.ts).';

-- ── Yetki: yalnız service-role ──────────────────────────────────────────────
-- `create function` varsayılan olarak PUBLIC'e execute verir; geri alıyoruz.
revoke execute on function public.ilan_olustur(jsonb, jsonb) from public;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from anon;
revoke execute on function public.ilan_olustur(jsonb, jsonb) from authenticated;
grant  execute on function public.ilan_olustur(jsonb, jsonb) to service_role;

commit;

-- ============================================================================
-- DOĞRULAMA
-- ============================================================================
-- 1) Yetki tablosu — yalnız service_role çıkmalı:
--      select grantee, privilege_type
--      from information_schema.routine_privileges
--      where routine_schema = 'public' and routine_name = 'ilan_olustur';
--
-- 2) Atomiklik testi (rollback ile, kalıcı veri bırakmaz):
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object(
--          'listing_type','yuk', 'origin_city','İstanbul', 'origin_district','Tuzla',
--          'contact_phone','05550000000', 'available_date', current_date::text,
--          'source','form', 'moderation_status','auto_published', 'status','active',
--          'trust_level','verified', 'user_id', '<gerçek bir users.id>',
--          'arac_adet', 1),
--        '[{"city":"Ankara","district":"Sincan","cargo_type":"tekstil"}]'::jsonb
--      );
--      -- id + audit_score dönmeli
--      rollback;
--
-- 3) Geri sarma testi — GEÇERSİZ durak ver, İLANIN DA yazılmadığını gör:
--      begin;
--      select public.ilan_olustur( <yukarıdaki listing>, '[]'::jsonb );
--      -- 22023 hatası vermeli; listings'e hiçbir satır girmemeli
--      rollback;
--
-- DEPLOY SONRASI DUMAN TESTİ
-- --------------------------
-- 1) /ilan-ver → tekil form → bir ilan ver. Panelde duraklarıyla görünmeli.
-- 2) /ilan-ver → toplu yükleme → 2 satırlık Excel → ilanlar oluşmalı.
-- 3) Supabase logs: `db-transaction` bağlamında `İlan oluşturuldu` satırı.
-- 4) Yetim kayıt kontrolü — SIFIR dönmeli:
--      select l.id from public.listings l
--      where not exists (select 1 from public.listing_stops s where s.listing_id = l.id)
--        and l.created_at > now() - interval '1 day';
--
-- GERİ ALMA
-- ---------
--   drop function if exists public.ilan_olustur(jsonb, jsonb);
--   (kodu da eski iki-INSERT hâline döndürmen gerekir)
-- ============================================================================
