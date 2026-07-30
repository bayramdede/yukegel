-- ============================================================================
-- COĞRAFİ GEÇİŞ Dalga 2 — `ilan_olustur` v3: `province_id` yaz + metni kanonikleştir
--
-- Bayram: Supabase SQL Editor'de çalıştır.
-- ⚠️ SIRA: `20260730_province_id.sql` (kolonlar) → `20260730_istanbul_kanonik.sql`
--          (temizlik) → BU DOSYA → kod deploy.
--    Kolon eklemez, yalnız fonksiyonu `create or replace` ile yeniden yazar.
-- ============================================================================
--
-- TASARIM KARARI — NEDEN ÇAĞIRANDAN `province_id` İSTEMİYORUZ
-- ------------------------------------------------------------
-- Bu RPC `jsonb` alıyor. `PROJE_HARITASI §9`'daki kural: çağıran ile gövde
-- arasındaki ayrışma **derleme zamanında görünmez**, eksik alan sessizce NULL
-- yazılır. Üç çağıran var (`lib/ilan-yaz.ts`, `app/moderator/actions.ts`,
-- `parse-listing` Edge Function) ve üçü de birbirinden farklı alan kümesi
-- gönderiyor — yani "hepsine `origin_province_id` eklemeyi unutmam" varsayımı
-- bu kod tabanında zaten bir kez yanlış çıkmış bir varsayım.
--
-- Bu yüzden `province_id`'yi RPC **kendisi türetiyor**:
--
--     açıkça gönderilmişse o kullanılır      (Dalga 3'te formlar id gönderecek)
--     gönderilmemişse `origin_city` metninden `il_key()` ile çözülür
--
-- Sonuç: **hiçbir çağıranın değişmesine gerek yok**, bu dosya çalıştığı anda
-- üç yol da doğru id yazmaya başlıyor. Çağıranlar sonra teker teker açık id
-- göndermeye geçebilir; geçmeyen de bozulmuyor.
--
-- BONUS — 'istanbul' HATASI ARTIK YAPISAL OLARAK İMKÂNSIZ
-- -------------------------------------------------------
-- v3 metin kolonunu da çözülen ilin **kanonik adıyla** yazıyor. 30 Tem 2026'da
-- temizlediğimiz 22.474 satırlık `origin_city='istanbul'` hasarının sebebi
-- `parse-listing/index.ts:818`'in `aliases.normalized` ham değerini aynen
-- yazmasıydı. Artık ham değer ne gelirse gelsin DB kanonikleştiriyor; alias
-- tablosu tekrar bozulsa bile `listings` bozulmuyor.
--
-- 🚨 `district_official` ÇAĞIRANDAN GELMEK ZORUNDA. 973 ilçe `lib/constants/
--    locations.json`'da duruyor, DB'de ilçe tablosu YOK (spec md.2 böyle
--    istedi). Gönderilmezse NULL kalır — tanımlı anlamı "bilinmiyor", bozuk
--    veri değil. Yani unutmak veri kirletmiyor, sadece bilgi eksik bırakıyor.
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
  v_origin_city text;
begin
  -- Duraksız ilan = ana sayfada hiç görünmeyen, moderatör kuyruğunu tıkayan
  -- hayalet kayıt. V5'in tüm sebebi buydu; kapıyı burada tutuyoruz.
  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'ilan_olustur: en az bir durak gerekli'
      using errcode = '22023';
  end if;

  -- ── İL ÇÖZÜMLEMESİ ────────────────────────────────────────────────────────
  -- Açık id kazanır; yoksa metinden katlanmış eşleşme.
  -- `provinces_il_key_uniq` kısmi olmayan UNIQUE indeks olduğu için bu arama
  -- indeksli ve tek satır garantili.
  -- ⚠️ Geçersiz açık id (99, -1) burada sessizce geçmez: kolondaki
  --    `references provinces(id)` FK'si INSERT'i 23503 ile reddeder. Kasıtlı —
  --    yanlış id ile yazılan ilan hiçbir yerde patlamaz, sadece görünmez olur.
  v_origin_pid := coalesce(
    nullif(p_listing->>'origin_province_id', '')::smallint,
    (select p.id from public.provinces p
      where public.il_key(p.name) = public.il_key(p_listing->>'origin_city'))
  );

  -- Metni kanonikleştir. Çözülemezse ham değeri KORU — bilinmeyen bir yer adını
  -- (serbest giriş, yurt dışı, yazım hatası) silmek veri kaybı olurdu.
  v_origin_city := coalesce(
    (select p.name from public.provinces p where p.id = v_origin_pid),
    p_listing->>'origin_city'
  );

  insert into public.listings (
    listing_type, origin_city, origin_district, contact_phone,
    origin_province_id, origin_district_official,
    price_offer, price_negotiable, available_date, date_flexible,
    notes, raw_text, source,
    moderation_status, status, trust_level,
    user_id, vehicle_id, vehicle_type, body_type,
    raw_post_id, shadow_profile_id, is_repost, reviewed_at
  )
  values (
    p_listing->>'listing_type',
    v_origin_city,
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
    -- ⚠️ `coalesce`: RPC her koşulda kolona YAZAR, yani alan gönderilmezse kolon
    -- DEFAULT'unu değil NULL'ı alır. Eski INSERT'lerde bu alanları hiç yazmayan
    -- çağıranlar (Edge Function) vardı; onlar RPC'ye geçerken sessizce NULL
    -- `status` doğurmasın diye en muhafazakâr değere düşüyoruz.
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
  -- Aynı çözümleme her durak için `lateral` ile tekrarlanıyor.
  insert into public.listing_stops (
    listing_id, stop_order, city, district, province_id, district_official,
    vehicle_count, cargo_type, weight_ton, pallet_count, notes
  )
  select
    v_id,
    t.ord::int,
    coalesce(sp.name, t.s->>'city'),
    t.s->>'district',
    sp.id,
    nullif(t.s->>'district_official', '')::boolean,
    -- Durağın kendi araç adedi kazanır; yoksa ilan geneli.
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
-- DOĞRULAMA — hepsi `rollback` ile biter, veri bırakmaz
-- ============================================================================
--
-- ⚠️ `source` DEĞERİ SERBEST DEĞİL. `listings_source_check` kısıtı var; testte
-- 'test' gibi uydurma bir değer verirsen 23514 alırsın ve fonksiyonu değil
-- kısıtı test etmiş olursun. Geçerli küme (bkz. `app/moderator/actions.ts`
-- KAYNAK_SETI): 'whatsapp', 'facebook', 'telegram', 'manual'.
--
-- 1) ESKİ ÇAĞIRAN (yalnız metin gönderiyor) id yazıyor mu? + bozuk yazım
--    kanonikleşiyor mu? Bu, Dalga 2'nin tüm iddiasının testi.
--
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object('listing_type','yuk','origin_city','istanbul','source','whatsapp'),
--        jsonb_build_array(jsonb_build_object('city','ANKARA'))
--      );
--      select origin_city, origin_province_id from public.listings
--        order by created_at desc limit 1;
--      -- BEKLENEN: 'İstanbul' | 34   ← metin kanonikleşti, id doğru
--      select city, province_id from public.listing_stops
--        where listing_id = (select id from public.listings order by created_at desc limit 1);
--      -- BEKLENEN: 'Ankara' | 6
--      rollback;
--
-- 2) AÇIK ID gönderilirse o kazanıyor mu? (Dalga 3'te formlar böyle gönderecek)
--
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object('listing_type','yuk','origin_province_id',35,
--                           'origin_city','bilinmeyen yer','source','whatsapp'),
--        jsonb_build_array(jsonb_build_object('city','Bursa','province_id',16))
--      );
--      select origin_city, origin_province_id from public.listings
--        order by created_at desc limit 1;
--      -- BEKLENEN: 'İzmir' | 35   ← açık id metni EZDİ
--      rollback;
--
-- 3) ÇÖZÜLEMEYEN yer adı korunuyor mu? (veri kaybı olmamalı)
--
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object('listing_type','yuk','origin_city','Rotterdam','source','whatsapp'),
--        jsonb_build_array(jsonb_build_object('city','Hamburg'))
--      );
--      select origin_city, origin_province_id from public.listings
--        order by created_at desc limit 1;
--      -- BEKLENEN: 'Rotterdam' | NULL   ← metin duruyor, id boş
--      rollback;
--
-- 4) GEÇERSİZ açık id reddediliyor mu? (23503 vermeli, ilan OLUŞMAMALI)
--
--      begin;
--      select public.ilan_olustur(
--        jsonb_build_object('listing_type','yuk','origin_province_id',99,'source','whatsapp'),
--        jsonb_build_array(jsonb_build_object('city','Ankara'))
--      );
--      rollback;
--
-- 5) Duraksız çağrı hâlâ reddediliyor mu? (22023 vermeli)
--
--      begin;
--      select public.ilan_olustur('{"listing_type":"yuk","origin_city":"Ankara"}'::jsonb, '[]'::jsonb);
--      rollback;
--
-- ============================================================================
-- DEPLOY SONRASI — 24 SAAT SONRA ÇALIŞTIR
-- ============================================================================
-- Yeni ilanların id'si gerçekten doluyor mu? `eksik` 0'a yakın olmalı.
-- Sıfırdan büyükse ya çözülemeyen yer adları var (3. testteki meşru durum) ya da
-- RPC'yi ATLAYAN bir yazma yolu kalmış — `app/panel/actions.ts` doğrudan
-- `.insert()` ile durak yazıyor, oraya ayrıca bakılmalı.
--
--   select source,
--          count(*)                                  as toplam,
--          count(origin_province_id)                 as id_dolu,
--          count(*) - count(origin_province_id)      as eksik
--   from public.listings
--   where created_at > now() - interval '24 hours'
--   group by 1 order by 4 desc;
--
-- Metin tekrar bozuluyor mu? SIFIR satır dönmeli — dönerse RPC'yi atlayan bir
-- yol var demektir.
--
--   select l.origin_city, p.name, count(*)
--   from public.listings l join public.provinces p on p.id = l.origin_province_id
--   where l.origin_city <> p.name
--     and l.created_at > now() - interval '24 hours'
--   group by 1,2;
--
-- ============================================================================
-- GERİ ALMA
-- ============================================================================
--   `docs/20260729_ilan_olustur_v2.sql` dosyasını tekrar çalıştır → v2'ye döner.
--   Kolon/indeks değişmediği için başka bir şey gerekmez. v2 yeni kolonlara hiç
--   dokunmadığı için geri dönüşte NULL kalırlar; yazılmış veriler bozulmaz.
-- ============================================================================
