-- ============================================================================
-- `ilan_olustur` v4.1 — `district_official` ARTIK DB'DE TÜRETİLİYOR
-- Yazım: 4 Ağu 2026 · Görev #50 · `ilce_resmi()` entegrasyonu
--
-- Bu dosya `docs/20260731_ilan_olustur_v4.sql` ADIM 1 gövdesinin AYNISIDIR,
-- yalnız İKİ satır değişti (`⬅️ v4.1` ile işaretli). Gövde elle kopyalanmadı,
-- v4 dosyasından programla üretilip iki satırı yamandı — sürüklenme riski yok.
--
-- ============================================================================
-- 🚨 NEDEN AYRI DOSYA VE NEDEN DALGA 5'İ BEKLEMİYOR
-- ============================================================================
-- `docs/20260731_districts_tablosu.sql`:1133 şunu diyordu: "Dalga 5'in v4'ü ile
-- AYNI ANDA yapılmalı, yoksa fonksiyon iki kez elden geçer."
--
-- ⚠️ BU GEREKÇE ARTIK GEÇERSİZ. v4 3 Ağu'da Dalga 5'ten BAĞIMSIZ olarak canlıya
--    çıktı (#26). Yani fonksiyon zaten ikinci kez elden geçecek — bekleyerek
--    kaçınılan bir maliyet kalmadı. Geriye yalnız bekleyişin BEDELİ kaldı:
--    o güne kadar WhatsApp hattından giren her ilanda `district_official` NULL.
--
-- ✅ Kolon drop'undan (Dalga 5 BÖLÜM 5) BAĞIMSIZDIR: bu değişiklik
--    `district_official`e dokunuyor, `origin_city`/`city`ye değil. Tek başına,
--    bugün, güvenle çıkar. Kod tarafında hiçbir değişiklik GEREKTİRMEZ —
--    çağıranların gönderdiği JSON sözleşmesi aynı kalıyor.
--
-- ⚠️ ÖN KOŞUL: `public.ilce_resmi(smallint, text)` canlıda olmalı.
--    ✅ 4 Ağu 2026'da çalıştırıldı (#48, `docs/20260731_districts_tablosu.sql`).
--    Doğrula: `select public.ilce_resmi(41::smallint,'Gebze');`  → `true`
--    Yoksa aşağıdaki `create or replace` 42883 (undefined_function) ATMAZ —
--    plpgsql gövdesi DDL anında doğrulanmaz — ilk ilan denemesinde patlar.
--    ADIM 0 tam bunun için var, ATLAMA.
-- ============================================================================


-- ============================================================================
-- ADIM 0 — ÖN KOŞUL DOĞRULAMASI (zorunlu, saf select)
-- ============================================================================
-- Beklenen: t1=true · t2=true · t3=false · t4=null
select public.ilce_resmi(41::smallint, 'Gebze')     as t1,   -- Kocaeli ilçesi
       public.ilce_resmi(34::smallint, 'CEKMEKOY')  as t2,   -- katlama çalışıyor
       public.ilce_resmi(34::smallint, 'Ömerli')    as t3,   -- mahalle, ilçe değil
       public.ilce_resmi(34::smallint, null)        as t4;   -- ilçe yok → null

-- 🚨 t4 `false` gelirse DUR. Fonksiyonun NULL semantiği bozulmuş demektir ve
--    aşağıdaki `coalesce` "ilçe girilmemiş" satırları `false` ile doldurur —
--    sessiz veri bozulması. `districts_tablosu.sql`:1120'ye bak.


-- ============================================================================
-- ADIM 1 — v4.1 GÖVDESİ
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
    -- ⬅️ v4.1 (#50) — `ilce_resmi()` YEDEK BACAĞI.
    --    Sıra kasıtlı: ÇAĞIRANIN AÇIK DEĞERİ KAZANIR. `lib/ilan-yaz.ts`:364 ve
    --    `app/moderator/actions.ts`:232 `locations.json` üzerinden zaten doğru
    --    cevabı gönderiyor; onu ezmek gereksiz davranış değişikliği olurdu.
    --    Fonksiyon YALNIZ çağıranın hiç göndermediği durumu doldurur.
    --    📌 Bugün o durumun TEK örneği `supabase/functions/parse-listing`:848 —
    --       Deno `locations.json`'a erişemediği için bu alanı hiç göndermiyor
    --       (kodda 4 Ağu öncesi "tek boşluk" diye kayıtlı). WhatsApp hattı
    --       ilanların çoğunu üretiyor, yani bu no-op DEĞİL.
    --    ⚠️ `ilce_resmi` NULL girdide `false` değil NULL döner: "ilçe girilmemiş"
    --       ile "girilen ilçe resmî değil" ayrı bilgiler. İkinci bacak NULL
    --       dönerse kolon NULL kalır — istenen davranış budur.
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
    -- ⬅️ v4.1 (#50) — kalkıştakiyle aynı desen, gerekçe yukarıda.
    --    `sp.id` burada NULL OLAMAZ: GUARD 2 ili çözülemeyen durak varsa
    --    `22023` ile transaction'ı geri alıyor. Yine de `ilce_resmi` NULL
    --    province_id'de NULL döndüğü için ikinci bir kırılma noktası yok.
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

-- ============================================================================
-- ADIM 2 — DOĞRULAMA (çalıştırdıktan SONRA)
-- ============================================================================
--
-- 2.1 Gövde gerçekten değişti mi (DDL sessizce başarısız olmaz ama emin ol)
-- select count(*) as ilce_resmi_gecisi
--   from pg_proc
--  where proname = 'ilan_olustur'
--    and prosrc like '%ilce_resmi%';
-- Beklenen: 1.  0 gelirse ADIM 1 uygulanmamıştır — v4'ün ilk denemesinde
-- tam olarak bu olmuştu (bkz. v4 dosyası ADIM 2 notu), o yüzden bu kontrol var.
--
-- 2.2 Canlı duman testi — /ilan-ver ile bir ilan oluştur, sonra:
-- select origin_province_id, origin_district, origin_district_official
--   from public.listings order by created_at desc limit 1;
-- Beklenen: TS yolu zaten değer gönderdiği için DAVRANIŞ DEĞİŞMEZ.
-- 🚨 Bu testin işi "yeni özellik çalıştı mı" değil, **eski yol bozulmadı mı**.
--
-- 2.3 ASIL TEST — WhatsApp hattı (`source='whatsapp'`), yani coalesce'in
--     ikinci bacağının fiilen çalıştığı tek yol. Bir mesaj işlendikten sonra:
-- select l.origin_province_id, l.origin_district, l.origin_district_official,
--        s.province_id, s.district, s.district_official
--   from public.listings l
--   join public.listing_stops s on s.listing_id = l.id
--  where l.source = 'whatsapp'
--  order by l.created_at desc limit 5;
-- Beklenen: ilçesi DOLU satırlarda `district_official` artık true/false —
-- v4.1 öncesinde hepsi NULL'dı. İlçesi boş satırlarda NULL kalmalı.
--
-- 2.4 Geçmiş satırlar ONARILMAZ (bilinçli, #52 ile aynı gerekçe).
--     Bu bir ileri-yönlü düzeltmedir. Geçmişi merak edersen ölç, onarma:
-- select count(*) filter (where origin_district_official is null
--                           and origin_district is not null) as bos_kalan
--   from public.listings where source = 'whatsapp';


-- ============================================================================
-- ADIM 3 — GERİ ALMA
-- ============================================================================
-- `docs/20260731_ilan_olustur_v4.sql` ADIM 1'i olduğu gibi yeniden çalıştır.
-- `create or replace` olduğu için tek adım, veri kaybı yok, kesinti yok.
