-- ============================================================================
-- DALGA 5 — METİN İL KOLONLARINI DÜŞÜR
-- Yazım tarihi: 31 Tem 2026 · ✅ ÇALIŞTIRILDI: 6 Ağu 2026
--
-- ✅ 6 AĞU 2026 — BU RUNBOOK BAŞTAN SONA UYGULANDI VE DOĞRULANDI.
--    BÖLÜM 0'ın sekiz önkoşulu canlıda ölçüldü → BÖLÜM 7 yedek (234.840 / 245.086
--    satır) → BÖLÜM 4'ün yedi indeksi birer birer → BÖLÜM 5'in iki `drop column`'u
--    → BÖLÜM 6'nın altı doğrulaması. `ilan_olustur` drop sonrası `begin; … rollback;`
--    içinde ÇALIŞTIRILARAK kanıtlandı. Tam kayıt: `docs/YAPILACAKLAR.md` başı.
--    ⚠️ Aşağıdaki "henüz çalıştırılmaz" uyarısı yazıldığı günün kaydıdır, tarihsel
--    olarak duruyor; artık geçerli değildir.
--
-- 🚫 (31 TEM 2026 KAYDI) BU DOSYA HENÜZ ÇALIŞTIRILMAZ. Yazılma sebebi çalıştırmak değil, bir hafta
--    önceden GÖZDEN KAÇAN BAĞIMLILIKLARI ÇIKARMAK. Aşağıdaki BÖLÜM 1 ve BÖLÜM 3
--    tam olarak böyle çıktı: `docs/COGRAFI_GECIS.md` satır 214-224'teki Dalga 5
--    maddesi sadece "kolonları ve indeksleri düşür" diyor; ikisinden de söz
--    etmiyor. O listeye göre hareket edilseydi ilan oluşturma tamamen kırılırdı.
--
-- Hedef:
--   listings.origin_city         → düş (yerine origin_province_id, Dalga 1)
--   listing_stops.city           → düş (yerine province_id, Dalga 2)
--   listings.destination_city    → 🚫 HEDEF DEĞİL: **KOLON YOK** (31 Tem 2026'da
--                                  42703 ile öğrenildi; "ölü kolon" sanılıyordu)
--   + bu kolonlara bağlı 7 metin/trigram indeksi (~72 MB)
--
-- ⚠️ SIRA ÖNEMLİ. Kolon drop'u en SONA gelir. Önce yazan taraf (BÖLÜM 1), sonra
--    okuyan taraf (BÖLÜM 2) temizlenir, ARADA CANLI DOĞRULAMA yapılır, en son
--    DDL atılır. Ters sırada her adım geri dönülemez bir kesinti üretir.
-- ============================================================================


-- ============================================================================
-- BÖLÜM 0 — ÖN KOŞULLAR (hepsi ✅ olmadan aşağısı çalıştırılmaz)
-- ============================================================================
--
-- [ ] 0.1  BÖLÜM 8.B delta ölçümü YEŞİL.
--          `docs/20260731_index_temizligi.sql` BÖLÜM 8.B'yi çalıştır. 7 metin
--          indeksinin `fark` değeri 0 olmalı. `⛔ SAYAÇ ARADA SIFIRLANMIŞ`
--          çıkarsa taban geçersizdir; yeni taban al, bir hafta daha bekle.
--          `fark > 0` çıkarsa Dalga 3 sonrası GERÇEK bir tüketici var — 8.C ile
--          bul, burayı çalıştırma.
--
-- [ ] 0.2  learn-aliases pozitif kontrolü OKUNDU.
--          `app/api/admin/learn-aliases/route.ts:437` bilerek dönüştürülmedi;
--          8.B'de `idx_listings_origin_city*` üzerinde SIFIRDAN BÜYÜK bir fark
--          üretmesi beklenen tek tüketici odur. Her şey 0 çıkarsa "tüketici yok"
--          ile "ölçüm bozuk / trafik yok" ayırt edilemez. Önce 8.B okunur,
--          SONRA BÖLÜM 2.1'deki dönüşüm yapılır. Ters sıra ölçümü öldürür.
--
-- [ ] 0.3  24 saatlik kapsama sorgusu TEMİZ.
--          `docs/20260730_ilan_olustur_v3.sql` sonundaki iki sorgu. İkincisi
--          (origin_city <> provinces.name) SIFIR SATIR dönmeli. Dönmüyorsa
--          metin ile id birbirini tutmuyor demektir; metni silmek o uyuşmazlığı
--          çözmez, sadece görünmez yapar.
--
-- [x] 0.4  destination_city — ✅ KAPANDI 31 Tem 2026. **KOLON YOK.**
--          Ölçüm denendi, dönen: `ERROR: 42703: column "destination_city"
--          does not exist`. Yani sorunun ön kabulü ("ölü ama var") yanlıştı;
--          ölçülecek veri de, düşürülecek kolon da yok.
--          🚨 BU DOSYADAKİ İKİ SATIR BUNA GÖRE DÜZELTİLDİ: BÖLÜM 5'teki
--          `drop column destination_city` ve BÖLÜM 7'deki yedek sorgusu —
--          ikisi de çalıştırılsa 42703 verirdi.
--          Ayrıntı ve ders: `docs/20260731_dalga5_olcumler.sql` ÖLÇÜM 0.4.
--
-- [x] 0.5  BÖLÜM 3 veri kaybı ölçümü ALINDI — ✅ 31 Tem 2026, KAYIP SIFIR.
--          listings: 234.885 satır · pid_yok_metin_var 0 · telafisiz_kayip 0
--          listing_stops: 245.152 satır · pid_yok_metin_var 0 · zaten_bos 0
--          3.3.a ve 3.3.b sıfır satır. Karar: `origin_serbest_metin` kolonuna
--          GEREK YOK; drop veri kaybettirmiyor.
--
--          🚨 AMA "BUGÜN SIFIR" ≠ "YARIN DA SIFIR". Sayı sıfır çünkü çağıranlar
--          ili çözemezse ilanı RPC'ye HİÇ göndermiyor ("Kalkış ili tanınamadı").
--          Yani v3'ün `coalesce(provinces.name, ham metin)` bacağı çoktan ölü
--          koddu. Koruma UYGULAMA katmanında, DB'de değil.
--
--          ❌ BURADA ÖNCE "İKİ KORUMASIZ YOL VAR" YAZIYORDU — YANLIŞTI.
--             Kod okundu (31 Tem 2026), gerçek şu:
--               ✅ lib/ilan-yaz.ts:247,271            kontrol VAR
--               ✅ app/moderator/actions.ts:180,196   kontrol VAR
--               ❌ supabase/functions/parse-listing/index.ts:836  kontrol YOK
--             `moderator/actions.ts` `ilanYaz()`'ı atlıyor ama aynı kontrolleri
--             kendi içinde tekrarlıyor. **"ilanYaz()'ı atlıyor" ≠ "korumasız"**
--             — ilki çağrı grafiği, ikincisi davranış; grafiğe bakıp davranış
--             çıkarmak bu hatayı üretti. Korumasız yol BİR TANE: Edge Function
--             (Deno `lib/lokasyon.ts`'i import edemiyor, `origin_province_id`
--             bile göndermiyor, tüm çözümlemeyi RPC'ye devretmiş).
--
--          v3'te o yoldan çözülemeyen bir il gelse metin KORUNUYORDU. v4'te aynı
--          çağrı KALKIŞI OLMAYAN ilan üretir, sessizce. Ölçüm bugünü temize
--          çıkarıyor, geleceği değil. → BÖLÜM 1'e guard eklendi (⬅️ GUARD).
--
--          ⚠️ 3.1 BİR HÜCREYİ ÖLÇMEDİ: `pid IS NULL AND metin IS NULL`.
--             Guard onu da reddeder. Ön ölçüm `20260731_ilan_olustur_v4.sql`
--             ADIM 0.1'de; v4 ondan önce çalıştırılmaz.
--
-- [ ] 0.6  BÖLÜM 1 (ilan_olustur v4) canlıda ve doğrulandı.
--          📄 Çalıştırılabilir hâli AYRI DOSYADA: `docs/20260731_ilan_olustur_v4.sql`
--             (31 Tem 2026, #26). Sebep: v4 drop'u beklemez, drop'tan günler
--             önce ve BÖLÜM 2 koduyla aynı release'te çıkar. Aşağıdaki BÖLÜM 1
--             gövdesi referans olarak duruyor; **çalıştırılacak olan o dosya**.
--             İkisi ayrışmasın: değişiklik önce v4 dosyasına, sonra buraya.
--          🔄 4 Ağu 2026 — BÖLÜM 1 gövdesi GÜNCELLENDİ (#50): `district_official`
--             iki yerde `coalesce(..., public.ilce_resmi(...))` oldu.
--             📄 Çalıştırılabilir hâli: `docs/20260804_ilan_olustur_v41_ilce_resmi.sql`
--             ⚠️ Bu ön koşulu BLOKE ETMEZ — değişiklik `district_official`e
--                dokunuyor, `origin_city`/`city`ye değil, yani kolon drop'undan
--                bağımsız. v4.1 çıkmadan da drop güvenli; sadece WhatsApp
--                hattındaki ilanlarda `district_official` NULL kalmaya devam eder.
-- [ ] 0.7  BÖLÜM 2 (kod temizliği) deploy edildi ve duman testi geçti.
--
-- [ ] 0.8  🚨 FONKSİYON GÖVDESİ TARAMASI — **DROP'TAN ÖNCE** çalıştırıldı ve
--          kalan her eşleşme GÖZLE sınıflandırıldı.
--          Sorgu BÖLÜM 6.2'nin AYNISI; fark yalnızca ZAMANLAMA.
--
--          NEDEN AYRI BİR ÖN KOŞUL: 6.2 aynı taramayı drop'tan SONRA yapıyor.
--          Bir eşleşme bulursa artık "uyarı" değil, canlıda kırık fonksiyon
--          raporudur. 3 Ağu 2026'da bu tarama statik olarak (grep ile, 5 dakika)
--          yapıldı ve `get_nearby_listings_by_province` içinde ölü bir
--          `listing_stops.city` referansı çıktı — bkz. BÖLÜM 2 / KOVA E.
--          O bulgu, taramanın drop'tan önce de gerektiğinin kanıtı.
--
--          ⚠️ False positive'ler beklenir (`->>'city'`, `provinces.name as city`,
--             `returns table(... origin_city text ...)`). Sınıflandırma regex'i
--             YAZILMAZ — 31 Tem'de tam olarak o hata yapılmıştı.


-- ============================================================================
-- BÖLÜM 1 — 🚨 ASIL BLOKER: `ilan_olustur` HÂLÂ HER İKİ METİN KOLONUNA YAZIYOR
-- ============================================================================
--
-- `docs/20260730_ilan_olustur_v3.sql` satır 88-99:
--     insert into public.listings (listing_type, origin_city, ...) values (..., v_origin_city, ...)
-- ve satır 139-146:
--     insert into public.listing_stops (..., city, ...) select ..., coalesce(sp.name, t.s->>'city'), ...
--
-- ⚠️ plpgsql gövdesi DDL anında DOĞRULANMAZ. `drop column origin_city` HATASIZ
--    geçer, fonksiyon "geçerli" görünmeye devam eder, ve İLK İLAN OLUŞTURMA
--    DENEMESİNDE 42703 (column does not exist) ile patlar. Yani hata deploy'da
--    değil, canlıda, kullanıcıda çıkar. Ana sayfa, WhatsApp webhook'u, Edge
--    Function parse-listing, moderatör paneli — hepsi bu tek RPC'den geçiyor,
--    dolayısıyla ilan girişi TAMAMEN durur.
--
-- ✅ RPC'nin JSON GİRDİ anahtarları (`p_listing->>'origin_city'`, `t.s->>'city'`)
--    DEĞİŞMEZ. Onlar kolon değil, sözleşme. `lib/ilan-yaz.ts:330,381,433` ve
--    Edge Function `parse-listing/index.ts:839` bu anahtarları göndermeye devam
--    eder — metinden il çözümlemesi (`il_key`) hâlâ onlara dayanıyor.
--    v4'te değişen tek şey: çözülen metin artık KOLONA YAZILMIYOR.
--
-- ⚠️ v4 CANLIYA ÇIKTIKTAN SONRA kolon drop'una kadar geçen sürede yeni satırlar
--    `origin_city IS NULL` olur. Bu ARA DÖNEMDE BÖLÜM 2 kodu deploy edilmiş
--    olmalı, yoksa panel/ilan detayı boş şehir gösterir. Bu yüzden BÖLÜM 1 ve
--    BÖLÜM 2 AYNI RELEASE'te gider.

-- ── v4 gövdesi ──────────────────────────────────────────────────────────────
-- (v3'ten farklar aşağıda ⬅️ ile işaretli. Gerisi birebir aynı.)

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
  --    çözülemezse ham metin (yurt dışı, serbest giriş, yazım hatası) korunuyordu.
  --    Kolon düşünce O KORUMA DA DÜŞÜYOR. BÖLÜM 3 ölçümü (31 Tem 2026) bugün
  --    kayıp olmadığını gösterdi: her iki tabloda da `pid_yok_metin_var = 0`.

  -- ⬅️ GUARD (31 Tem 2026 — ölçümün ORTAYA ÇIKARDIĞI eksik).
  --
  -- 🚨 Ölçüm sıfır çıktı diye guard'sız bırakma. Sıfırın sebebi verinin doğası
  --    değil, çağıranların kendi kontrolü. Koruma UYGULAMA katmanında, DB'de
  --    değil — ve üç çağırandan BİRİ o kontrolü yapmıyor:
  --      ✅ lib/ilan-yaz.ts:247,271
  --      ✅ app/moderator/actions.ts:180,196  (ilanYaz()'ı atlar ama kontrolü var)
  --      ❌ supabase/functions/parse-listing/index.ts:836  — KORUMASIZ
  --    v3'te o yoldan çözülemeyen bir il gelse metin kolona yazılıp korunuyordu.
  --    v4'te aynı çağrı KALKIŞI OLMAYAN bir ilan üretir — ne id, ne metin — ve
  --    hata vermez. Sessiz bozulma, gürültülü bozulmadan pahalıdır.
  --
  -- ⚠️ `22023` (invalid_parameter_value) bilinçli: `lib/ilan-yaz.ts` ve çağıranlar
  --    zaten `PGRST202`/`23514` gibi kodları ayırt ediyor; yeni bir sınıf değil,
  --    "girdi geçersiz" ailesinden. `raise` transaction'ı geri alır, yani yarım
  --    ilan kalmaz (V5 atomiklik garantisi korunur).
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
    -- ⬅️ #50 (4 Ağu 2026) — `ilce_resmi()` YEDEK BACAĞI EKLENDİ.
    --    Sıra kasıtlı: çağıranın AÇIK değeri kazanır. TS tarafı (`lib/lokasyon.ts`)
    --    `locations.json` ile zaten doğru cevabı üretiyor; onu ezmek gereksiz
    --    davranış değişikliği olurdu. Fonksiyon YALNIZCA çağıranın hiç
    --    göndermediği durumu doldurur — bugün pratikte tek örneği
    --    `supabase/functions/parse-listing` (Deno ilçe listesine erişemiyor).
    --    ⚠️ `ilce_resmi` NULL girdide `false` değil NULL döner; yani "ilçe
    --    girilmemiş" ile "girilen ilçe resmî değil" ayrımı korunur. `coalesce`
    --    ikinci bacak NULL dönerse kolon NULL kalır — istenen davranış bu.
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
  -- ⚠️ Burada veri kaybı riski `listings`tekinden DAHA AĞIR. `listings`in bir
  --    `raw_text` yedeği var; `listing_stops`un yok. İl çözülemeyen bir durak
  --    v4'te `province_id IS NULL` + metin yok = TAMAMEN BOŞ SATIR olur.
  --    BÖLÜM 3.2 ölçümü bunun için (31 Tem 2026: 245.152 satırda 0).

  -- ⬅️ GUARD — duraklar. Kalkıştakiyle aynı gerekçe, daha sert sonuç: kalkışı
  --    olmayan ilan hiç değilse duraklarından okunabilir, ama durağı boş bir ilan
  --    rotasını sessizce eksiltir ve bunu fark etmenin bir yolu yoktur.
  --    ⚠️ Kontrol INSERT'ten ÖNCE: sonra bakmak "yazdım, sonra beğenmedim"dir;
  --    transaction geri alsa bile sequence/trigger yan etkileri boşa çalışır.
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
    -- ⬅️ #50 (4 Ağu 2026) — kalkıştakiyle aynı desen, gerekçe yukarıda.
    --    `sp.id` burada NULL OLAMAZ: hemen yukarıdaki guard, ili çözülemeyen
    --    durak varsa `22023` ile transaction'ı geri alıyor. Yine de `ilce_resmi`
    --    NULL province_id'de NULL döndüğü için ikinci bir kırılma noktası yok.
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

-- ── v4 doğrulaması (canlıda, drop'tan ÖNCE) ─────────────────────────────────
-- ⚠️ Bu testi kolonlar HÂLÂ DURURKEN yap. Amaç kolonların artık YAZILMADIĞINI
--    görmek. Kolon düşürüldükten sonra bu testi yapmak anlamsız — o noktada
--    zaten geri dönüş yok.
--
--   select public.ilan_olustur(
--     jsonb_build_object('listing_type','yuk','origin_city','istanbul','source','test_v4'),
--     jsonb_build_array(jsonb_build_object('city','ANKARA'))
--   );
--   -- Beklenen: origin_province_id=34, origin_city=NULL
--   select origin_city, origin_province_id from public.listings where source='test_v4';
--   -- Beklenen: city=NULL, province_id=6
--   select s.city, s.province_id from public.listing_stops s
--     join public.listings l on l.id = s.listing_id where l.source='test_v4';
--   delete from public.listings where source='test_v4';


-- ============================================================================
-- BÖLÜM 2 — KOD TEMİZLİĞİ (BÖLÜM 1 ile AYNI RELEASE)
-- ============================================================================
--
-- 31 Tem 2026 taraması: `origin_city` repoda 30 dosyada 97 kez geçiyor. Hepsi
-- kolon referansı DEĞİL. Dört kovaya ayrılır (aşağıdaki düzeltmeye bak):
--
-- 🚨 3 AĞU 2026 DÜZELTMESİ — KOVA SAYISI ÜÇ DEĞİL, DÖRT.
--    Aşağıdaki ilk tasnif `origin_city`'yi geçtiği yere göre ayırmıştı:
--    "predikat / gösterim / prompt". Ama **gösterim ile yazma aynı kovaya
--    düşmüştü**: `app/panel/actions.ts:135` ve `app/moderator/page.tsx:580`
--    KOVA B'de "SELECT listesi + gösterim" başlığı altında duruyor — oysa
--    ikisi de `listings.update({ origin_city: ... })` ÇAĞIRIYOR.
--
--    Fark önemsiz değil: KOVA B'nin bir maddesini atlarsan bir ekran boş şehir
--    gösterir. KOVA D'nin bir maddesini atlarsan **panelde ilan düzenleyen her
--    kullanıcı 42703 yer** — ve BÖLÜM 1'in guard'ı bunu GÖRMEZ, çünkü guard
--    `ilan_olustur` içinde; bu yollar RPC'yi hiç çağırmıyor.
--    → yeni kova aşağıda: KOVA D.
--
-- ── KOVA A — DB PREDİKATI (drop kırar, MUTLAKA dönüştürülür) ────────────────
--   app/api/admin/learn-aliases/route.ts:89   .is('origin_city', null)
--   app/api/admin/learn-aliases/route.ts:437  .in('origin_city', kesfedilenNorm)
--   app/moderator/page.tsx:301                ilan.origin_city !== filtreKalkis  ← bellekte ama kolondan gelen veriye bağlı
--
--   2.1 — learn-aliases:437 (Görev #24):
--         `.in('origin_city', kesfedilenNorm)` → keşfedilen normalized il
--         adlarını `il_key()`/plaka koduna çevirip
--         `.in('origin_province_id', plakalar)` yap.
--         ⚠️ 0.2'yi oku: bu dönüşüm 8.B ÖLÇÜMÜNDEN SONRA yapılır.
--   2.2 — learn-aliases:89 `.is('origin_city', null)` →
--         `.is('origin_province_id', null)`. Sekmenin adı "form ilanları, il
--         çözülememiş" — anlam birebir korunuyor.
--
-- ── KOVA B — SELECT LİSTESİ + GÖSTERİM (drop 42703 verir, dönüştürülür) ─────
--
--   ✅ 3 AĞU 2026 — KOVA B TAMAMLANDI (Görev #35). Aşağıdaki dosya listesinin
--      tamamı `ilAdi(province_id)` kalıbına çevrildi, `tsc --noEmit` temiz,
--      `test:lokasyon` + `test:parser` (29/29) geçiyor. İki istisna, ikisi de
--      BİLEREK:
--        · `app/yol-rehberi/YolRehberiClient.tsx:64,723` — DOKUNULMADI.
--          Oradaki `origin_city` tablo kolonu değil, RPC'nin ÇIKIŞ kolonu ve
--          kaynağı `provinces.name`. Drop'tan etkilenmiyor; değiştirmek
--          çalışan bir sözleşmeyi kırardı. (Bkz. KOVA E dosyası.)
--        · `app/u/[username]/IlanListesi.tsx:23,29` — DOKUNULMADI, ÖLÜ DOSYA.
--          Canlı profil listesi `app/u/[username]/page.tsx` içinde ve zaten
--          çevrilmişti (:103, :107). Ölü kodu çevirmek onu canlı gösterir.
--      Ayrıca iki ÖLÜ SELECT ALANI çevrilmek yerine SİLİNDİ — aynı gerekçe:
--        · `app/api/admin/crm/[id]/analiz/route.ts:83` (LLM prompt'una hiç
--          girmiyordu) · `app/api/admin/learn-aliases/route.ts:88` (tüketici
--          basmıyor, predikat gereği zaten hep NULL).

--
--   ✅ ÇÖZÜM JOIN DEĞİL — `lib/lokasyon.ts:83` `ilAdi(id)`.
--      İlk plan "`provinces!origin_province_id(name)` gömülü sorgusu" diyordu.
--      Gereksiz: 81 satırlık il tablosu zaten `lib/constants/locations.json`
--      içinde (25 KB) ve `ilAdi()` id→ad haritasını bellekte tutuyor. Üstelik
--      `app/moderator/page.tsx` gibi İSTEMCİ bileşenleri bu modülü BUGÜN
--      import ediyor — yeni paket ağırlığı yok.
--
--      Join tercih edilseydi bedeli: her liste sorgusuna bir gömülü ilişki,
--      PostgREST'te ek `provinces` okuması, ve dönen JSON'da `origin_city`
--      (metin) yerine `provinces:{name}` (nesne) — yani tüm tüketicilerin
--      yine de değişmesi. Aynı işi yapıp daha pahalıya mal oluyordu.
--
--      Dönüşüm kalıbı, her satır için:
--        SELECT'te   `origin_city`      → `origin_province_id`
--        gösterimde  `ilan.origin_city` → `ilAdi(ilan.origin_province_id)`
--        duraklarda  `s.city`           → `ilAdi(s.province_id)`
--      Tel üzerinden giden veri de küçülür (smallint ⟵ text).
--
--   ⚠️ `ilAdi()` `null` dönebilir (id NULL ise). Gösterimde `?? '—'` şart;
--      `origin_city` metni boşsa bugün de aynı boşluk görünüyordu, davranış
--      değişmiyor — ama `undefined` basmamak için açıkça yazılır.
--
--   lib/ilan-liste.ts:46,78
--   app/panel/page.tsx:34,37        · app/panel/PanelClient.tsx:258,259,381,410,499
--   app/panel/IlanYonetim.tsx:131,137,208,212,248,267,328
--   app/ilan/[id]/page.tsx:21,24,41,47,61,119,125,203,206,207,259,261,328,344
--   app/ilan/[id]/sahiplen/page.tsx:15,19,57,59,210,216
--   app/u/[username]/page.tsx:82,86,102,106 · app/u/[username]/IlanListesi.tsx:23,29
--   app/moderator/page.tsx:49,243,247,297,301,302,508,516,647,1092,1150,1156
--   app/yol-rehberi/YolRehberiClient.tsx:64,723
--   app/admin/radar/RadarClient.tsx:37,866 · app/api/admin/radar/route.ts:125
--   app/admin/crm/CrmClient.tsx:38,495 · app/api/admin/crm/[id]/route.ts
--   app/api/admin/crm/[id]/analiz/route.ts:83
--   app/api/ilanlar/[id]/route.ts:26,77,106   ⚠️ PUBLIC API — yanıt sözleşmesi.
--       `rota.kalkis.sehir` alan adı KORUNUR, kaynağı `ilAdi(province_id)` olur.
--       Dış tüketici için hiçbir şey değişmez — değişirse sözleşme kırılır.
--   app/admin/ogrenme-merkezi/OgrenmeMerkeziClient.tsx:31,576
--
-- ── KOVA D — RPC'Yİ ATLAYAN DOĞRUDAN YAZMALAR (3 Ağu 2026'da eklendi) ───────
--
--   Bunlar `ilan_olustur`'u ÇAĞIRMAZ; `listings` / `listing_stops` üzerine
--   doğrudan `update`/`insert` atar. Dolayısıyla BÖLÜM 1'in guard'ı bu yolları
--   KORUMAZ ve BÖLÜM 5 drop'u bunları 42703 ile kırar.
--
--   ✅ app/moderator/page.tsx:580   listings.update({ origin_city: … })   → SİLİNDİ
--   ✅ app/moderator/page.tsx:606   listing_stops.update/insert({ city: }) → SİLİNDİ
--   ⚰️ app/panel/actions.ts:135     listings.update({ origin_city: … })   → ULAŞILAMAZ
--   ⚰️ app/panel/actions.ts:167     listing_stops.insert({ city: … })     → ULAŞILAMAZ
--
--   Dönüşüm: `origin_city` / `city` anahtarını patch nesnesinden SİL. `*_id`
--   zaten yan yana yazılıyor (çift yazım) — tek yapılacak metin anahtarını
--   düşürmek. Moderatörde `:606`'daki `konum` nesnesi hem UPDATE hem INSERT
--   dalında kullanıldığı için tek satırlık silme iki yolu birden kapattı.
--
--
--   🚨🚨 3 AĞU 2026 — BU KOVANIN "ASIL MESELE"Sİ YANLIŞTI. DÖRT DEĞİL, İKİ YOL.
--
--   Bu blok ilk yazıldığında `app/panel/actions.ts`'i kovanın en tehlikeli
--   maddesi ilan ediyor ve buradan bir KARAR türetiyordu ("reddet mi, NULL mü").
--   O karar YOK HÜKMÜNDE: **`ilanGuncelle` ULAŞILAMAZ KOD.**
--
--     app/panel/actions.ts::ilanGuncelle
--       ← tek import eden: app/panel/IlanYonetim.tsx
--           ← IlanYonetim.tsx'i import eden: HİÇ KİMSE
--     Panelin canlı düzenleme yolu `/api/ilan/duzelt`; o uç nokta yalnız
--     `notes, vehicle_type, body_type, moderation_status, status,
--      is_shadow_banned, audit_score, internal_audit_logs, reviewed_at`
--     yazıyor — TEK BİR konum alanı bile yok. Kullanıcı panelden ilanının
--     ilini bugün zaten DEĞİŞTİREMİYOR.
--
--   Yani "drop'tan sonra kalkış bilgisi büsbütün kaybolur" senaryosunun
--   tetiklenebileceği bir kullanıcı akışı YOK. Kalan tek canlı doğrudan yazma
--   yolu moderatör paneliydi ve o zaten `:543-548` / `:558-564`'te çözülemeyen
--   ili REDDEDİYOR (`alert('Kalkış ili tanınamadı…')`), üstelik il girdileri
--   serbest metin değil `<select>`. Yani sorulacak bir soru da kalmıyor:
--   KOVA D salt mekanik anahtar silmeye indi ve 3 Ağu'da tamamlandı.
--
--   ── NEDEN YANLIŞ TASNİF ETTİM (asıl ders) ──────────────────────────────
--   Envanteri çıkarırken sorduğum soru şuydu: "bu dosya kolona YAZIYOR MU?"
--   Sorulmayan soru: "bu dosya ÇALIŞIYOR MU?" Erişilebilirlik hiç kontrol
--   edilmedi — `grep` bir çağrı grafiği değildir, yalnızca bir metin eşleşmesi.
--   Sonuç: ölü bir dosya, runbook'un en kritik maddesi ve bir "ürün kararı"
--   olarak üç ayrı belgeye yazıldı.
--
--   Bu KOVA E ile aynı kökten: orada kapsam DİLE göre (yalnız .ts/.tsx),
--   burada ULAŞILABİLİRLİĞE göre daralmıştı. İkisi de "envanter tamam"
--   dedirtip yanlış tarafta bıraktı.
--
--   → KURAL: bir yazma yolunu kovaya koymadan önce importer zincirini sonuna
--     kadar sür. Zincir bir yerde kopuyorsa madde "dönüştürülecek" değil,
--     "ölü — silinecek" kovasına gider.
--
--   ⚠️ `app/panel/actions.ts` ve `app/panel/IlanYonetim.tsx` ÖLÜ DOSYA olarak
--     duruyor (silme kararı Bayram'da). IlanYonetim 3 Ağu'da yine de KOVA B
--     kalıbına çevrildi — o an ölü olduğu bilinmiyordu; zararsız ama gereksiz.
--     `app/u/[username]/IlanListesi.tsx` de aynı durumda ve ÇEVRİLMEDİ:
--     tespit ondan sonra yapıldığı için başına ölü-dosya başlığı yazıldı.
--
-- ── KOVA C — LLM JSON ANAHTARI / DOKÜMANTASYON (DOKUNULMAZ) ─────────────────
--   Bunlar kolon değil; prompt sözleşmesi ve RPC girdi anahtarı. Değiştirmek
--   ayrıştırmayı bozar, drop'un onlarla ilgisi yok:
--   app/api/whatsapp/route.ts:77,93,95,103,199,239,257,265
--   app/api/parse-text/route.ts:40,125,141,143,154,203
--   app/api/llm-parse/route.ts:26
--   app/ilan-ver/page.tsx:246 · app/ilan-ver/MetindenIlan.tsx:6
--   lib/ilan-yaz.ts:361,412,464 (RPC girdisi)
--   app/moderator/actions.ts:135,179,195,229 (tip + guard + RPC girdisi), 302 (log alanı)
--   supabase/functions/parse-listing/index.ts:815,818,824,839 (RPC girdisi)
--
--   ⚠️ `origin_city` RPC GİRDİSİ OLARAK KALIR. v4 kolona yazmayı bırakıyor ama
--      `p_listing->>'origin_city'`'yi HÂLÂ OKUYOR — `origin_province_id`
--      gelmediğinde `il_key()` ile çözümlemek için. Tek çağıranı bu yedeğe
--      gerçekten muhtaç: `parse-listing` (Deno `lib/lokasyon.ts`'i import
--      edemiyor, yalnız metin gönderiyor). Bu anahtarı payload'dan silmek
--      WhatsApp kanalını tamamen kapatır.
--   lib/lokasyon.ts:3,7,164 · app/_components/HomeClient.tsx:607,743
--     app/api/listings/ara/route.ts:11,13,22 (yorum satırları)
--
-- ⚠️ Drop'tan sonra `lib/lokasyon.ts:164`'teki "çift yazım dönemi" yorumu ve
--    `app/_components/HomeClient.tsx:743`'teki "Dalga 5'te düşünce" uyarısı
--    tarihe karışır — güncellenir.
--
-- ✅ `destination_city` için kod temizliği YOK — ama sebebi sanıldığı gibi
--    "kimse okumuyor" değil, **kolon hiç yok** (31 Tem 2026, 42703).
--    `.ts`/`.tsx` içinde sıfır eşleşme olması zaten bunun beklenen sonucuydu;
--    o gözlem "ölü kolon" olarak yorumlanmıştı, oysa yokluğun kanıtıydı.
--
-- ── KOVA E — SQL FONKSİYONLARINDA KALAN METİN REFERANSI (3 Ağu 2026'da bulundu)
--
--   🚨 BU KOVA BAŞTA HİÇ YOKTU, ÇÜNKÜ BÖLÜM 2 "KOD" DEYİNCE `.ts`/`.tsx`
--      ANLAŞILMIŞTI. Oysa metin kolonunu okuyan ikinci bir kod tabanı var:
--      Postgres fonksiyonlarının gövdeleri. BÖLÜM 1 bunlardan yalnız BİRİNİ
--      (`ilan_olustur`) ele alıyor — çünkü o, YAZAN taraftı ve göze batıyordu.
--      OKUYAN fonksiyonlar için hiçbir kova açılmamıştı.
--
--   BULUNAN (statik grep, 3 Ağu 2026):
--     docs/20260730_dalga3_radar_province_id.sql:586
--       → `public.get_nearby_listings_by_province` içindeki `son_durak` CTE'si:
--           select distinct on (listing_id)
--             listing_id, province_id, city, district      ← `city` ÖLÜ
--           from public.listing_stops
--         `sd.city` fonksiyonun HİÇBİR YERİNDE okunmuyor; `dest_city` zaten
--         `pd.name`'den (provinces join'i) geliyor. Dalga 3 fonksiyonu
--         province_id'ye çevirirken RETURN ifadesini düzeltmiş ama CTE'nin
--         select listesini temizlemeyi atlamış — sonuç bugün DOĞRU, ama kolona
--         bir bağımlılık bırakıyor.
--
--   ETKİ: BÖLÜM 5 kolonu düşürdüğü an bu fonksiyon 42703 atar. Çağıranı
--   `app/api/listings/yakin/route.ts:44`, onun da tüketicisi `/yol-rehberi`
--   "yakınımdaki yükler" sekmesi. Yani drop, GPS'e dayalı tüm keşif akışını
--   sessizce öldürür — TS tarafında tek satır `origin_city` geçmediği için
--   BÖLÜM 2'nin `.ts` taramaları bunu ASLA göstermez.
--
--   DÜZELTME: CTE'den `city`'yi çıkar, fonksiyonu yeniden yarat. Davranış
--   değişmiyor (kullanılmayan bir kolonu select'ten çıkarmak), bu yüzden
--   BÖLÜM 5'ten önce TEK BAŞINA güvenle çıkar — v4 ile aynı release'i beklemez.
--
--   ⚠️ ASIL DERS, BU TEK SATIRDAN DAHA ÖNEMLİ:
--      BÖLÜM 6.2 zaten "kırık fonksiyon kaldı mı" taraması içeriyor ve bu satırı
--      YAKALARDI. Ama 6.2 **DROP'TAN SONRA** çalışıyor. Yani tasarım gereği bu
--      hatayı ancak canlıda 42703 aldıktan sonra öğrenirdik. Aynı sorgu
--      DROP'TAN ÖNCE de çalıştırılabilirdi ve çalıştırılmalıydı:
--
--        select p.proname, trim(satir)
--          from pg_proc p
--          join pg_namespace n on n.oid = p.pronamespace
--          cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as satir
--         where n.nspname='public' and p.prokind in ('f','p')
--           and satir ~* '(origin_city|destination_city|\mcity\M)'
--         order by 1, 2;
--
--      → BÖLÜM 0'a ön koşul olarak eklendi (0.8). "Doğrulama" adımını drop'un
--        SONRASINA koymak, onu doğrulama değil OTOPSİ yapar.


-- ============================================================================
-- BÖLÜM 3 — VERİ KAYBI ÖLÇÜMÜ (drop'tan ÖNCE, karar gerektirir)
-- ============================================================================
--
-- v3'ün `coalesce(provinces.name, ham metin)` bacağı çözülemeyen yer adlarını
-- koruyordu. Kolon düşünce o veri geri getirilemez. Kaç satır olduğunu bilmeden
-- "önemsizdir" denemez.

-- 3.1 — İl çözülememiş ama metni olan ilanlar
select
  count(*)                                              as toplam_ilan,
  count(*) filter (where origin_province_id is null
                     and origin_city is not null)       as pid_yok_metin_var,
  count(*) filter (where origin_province_id is null
                     and origin_city is not null
                     and raw_text is not null)          as bunlarin_raw_text_yedegi_olan
from public.listings;
-- Okuma: `pid_yok_metin_var` = drop ile kaybedilecek kalkış bilgisi.
--        `bunlarin_raw_text_yedegi_olan` çıkarılınca kalan = TELAFİSİ OLMAYAN kayıp.
--        Kalan 0 ise sorun yok. Değilse → BÖLÜM 3.3.

-- 3.2 — Aynısı duraklar için (raw_text yedeği YOK, o yüzden daha kritik)
select
  count(*)                                              as toplam_durak,
  count(*) filter (where province_id is null
                     and city is not null)              as pid_yok_metin_var
from public.listing_stops;
-- Okuma: `pid_yok_metin_var > 0` ise o kadar durak drop sonrası tamamen boş
--        satıra döner (ne il, ne metin). Sıfır değilse drop'a devam EDİLMEZ.

-- 3.3 — Kayıp varsa: hangi metinler? (karar için gözle bakılacak liste)
select origin_city, count(*) as adet
from public.listings
where origin_province_id is null and origin_city is not null
group by 1 order by 2 desc limit 50;
--
-- KARAR AĞACI:
--   a) Liste yazım hatası dolu ("istanbull", "ıstanbul") → alias öğret, geriye
--      dönük `origin_province_id`'yi doldur, sonra drop. En temizi.
--   b) Liste gerçek yurt dışı / serbest yer ("Rotterdam", "Hamburg") → kolonu
--      düşürmeden önce `alter table public.listings add column origin_serbest_metin text;`
--      ekleyip veriyi taşı. `provinces` 81 plakayla sınırlı, bu veriyi
--      temsil edemez.
--   c) Liste çöp → drop, kayıp kabul.


-- ============================================================================
-- BÖLÜM 4 — İNDEKS DROP'LARI
-- ============================================================================
--
-- ⚠️ K3: `drop index concurrently` TRANSACTION İÇİNDE ÇALIŞMAZ (25001). Supabase
--    SQL editörü çok-ifadeli çalıştırmayı örtük transaction'a sarar. Bu yüzden
--    aşağıdaki satırlar TEK TEK, ayrı ayrı çalıştırılır. Hepsini seçip Run'a
--    basmak 25001 verir.
--
-- ⚠️ `CREATE INDEX IF NOT EXISTS` koruma DEĞİLDİR. Bu indeksleri doğuran eski
--    migration dosyaları (`20260604_radar_analitik_rpc.sql`,
--    `20260604_radar_intelligence_rpc.sql`, `20260616_radar_analitik_indexes.sql`)
--    yeniden çalıştırılırsa indeksler DİRİLİR. Drop sonrası o dosyaların
--    ilgili satırları yorum satırına alınır.
--
-- 31 Tem 2026 taban taramaları (8.A) — 8.B'de bu sayıların FARKI 0 olmalı:
--   idx_listings_origin            110   ← ✅ ÇÖZÜLDÜ: origin_city indeksi (aş. bkz.)
--   idx_listings_origin_city_lower  44
--   listings_origin_city_trgm_idx   29
--   listing_stops_city_trgm_idx     25
--   idx_listing_stops_city_lower    24
--   idx_listings_origin_city        11
--   listing_stops_city_idx           2

-- ✅ `idx_listings_origin` TANIMI OKUNDU — 31 Tem 2026:
--      CREATE INDEX idx_listings_origin ON public.listings USING btree (origin_city)
--    Yani `origin_province_id` değil, düpedüz `origin_city` indeksi. Adı yanıltıcı.
--    → DROP LİSTESİNE EKLENDİ (aşağıda).
--
-- 🚨 BUNUN 8.B İÇİN SONUCU, drop listesine eklenmesinden DAHA ÖNEMLİ:
--    110 tarama ile yedi indeksin EN AKTİFİ ve artık biliyoruz ki `origin_city`
--    metnini tarıyor. Yani "Dalga 3'ten sonra metin kolonunu okuyan kalmadı"
--    varsayımının en güçlü karşı adayı bu indeks. 8.B'de (#21, ~7 Ağu) farkı
--    SIFIRDAN BÜYÜK çıkarsa canlı bir tüketici var demektir ve BÖLÜM 5
--    çalıştırılmaz — 8.C ile tüketici bulunur.
--    ⚠️ `learn-aliases:437` (0.2 pozitif kontrolü) da bu indeksi kullanıyor
--    olabilir. Fark > 0 çıkarsa önce onu ele: 2.1 dönüşümü yapılıp bir hafta
--    daha ölçülür. İkisini ayırt etmeden "tüketici var" deme.

-- ⚠️ Aşağıdakiler TEK TEK çalıştırılır:

-- drop index concurrently if exists public.idx_listings_origin;
-- drop index concurrently if exists public.idx_listings_origin_city_lower;
-- drop index concurrently if exists public.listings_origin_city_trgm_idx;
-- drop index concurrently if exists public.idx_listing_stops_city_lower;
-- drop index concurrently if exists public.listing_stops_city_trgm_idx;
-- drop index concurrently if exists public.idx_listings_origin_city;
-- drop index concurrently if exists public.listing_stops_city_idx;

-- ✅ Diğer tanımlar da doğrulandı (31 Tem 2026) — hepsi gerçekten metin indeksi:
--   listing_stops_city_idx          btree (city)
--   idx_listings_origin_city_lower  btree (lower(origin_city), created_at DESC)
--   idx_listings_origin_city        btree (origin_city) WHERE origin_city IS NOT NULL
--   listings_origin_city_trgm_idx   gin (origin_city gin_trgm_ops)
-- ⚠️ `idx_listing_stops_city_lower` ve `listing_stops_city_trgm_idx` bu turda
--    LİSTELENMEDİ — sorgunun filtresi `%origin_city%` idi, `listing_stops.city`
--    indekslerini yakalamadı. Yokluk kanıtı DEĞİL. Drop öncesi tanımlarını
--    `20260731_index_temizligi.sql:279` sorgusuyla teyit et.
--
-- 💡 Kolon drop'u (BÖLÜM 5) o kolona bağlı indeksleri ZATEN otomatik düşürür.
--    Bu bölüm yine de ayrı duruyor çünkü `concurrently` tablo kilidi almaz;
--    `drop column` alır. Büyük indeksleri önceden temizlemek BÖLÜM 5'in kilit
--    süresini kısaltır.


-- ============================================================================
-- BÖLÜM 5 — KOLON DROP'LARI
-- ============================================================================
--
-- ⚠️ `drop column` ACCESS EXCLUSIVE kilit alır. Postgres'te kolon düşürmek
--    tabloyu yeniden yazmaz (kolon sadece `attisdropped` işaretlenir), yani
--    kilit kısadır — ama sıfır değildir. Yine de düşük trafikli saatte yapılır.
--
-- ⚠️ Bu noktadan sonra GERİ DÖNÜŞ YOK. `add column` kolonu geri getirir ama
--    VERİYİ getirmez. Öncesinde BÖLÜM 7'deki yedek alınır.

-- begin;
--
-- alter table public.listings      drop column origin_city;
-- alter table public.listing_stops drop column city;
--
-- commit;

-- 🚨 `alter table public.listings drop column destination_city;` BURADAN
--    ÇIKARILDI (31 Tem 2026). O kolon YOK — sorgu 42703 verir ve transaction'ı
--    komple geri alır, yani yanındaki iki meşru drop da yapılmamış olurdu.
--    Kanıt ve ders: `docs/20260731_dalga5_olcumler.sql` ÖLÇÜM 0.4.
--    ⚠️ `if exists` ekleyip geçiştirme; o, hatayı susturur ama belgelerdeki
--    yanlış inancı yerinde bırakır.


-- ============================================================================
-- BÖLÜM 6 — DROP SONRASI DOĞRULAMA
-- ============================================================================

-- 6.1 — Kolonlar gerçekten gitti mi
-- select table_name, column_name
--   from information_schema.columns
--  where table_schema='public'
--    and (   (table_name='listings'      and column_name in ('origin_city','destination_city'))
--         or (table_name='listing_stops' and column_name='city'));
-- Beklenen: 0 satır.

-- 6.2 — 🚨 EN KRİTİK: kırık fonksiyon kaldı mı
-- plpgsql DDL'de doğrulanmadığı için bu tarama drop sonrası ZORUNLU. Kalan
-- her eşleşme canlıda 42703 demektir.
-- select p.proname, trim(satir) as eslesen_satir
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as satir
--  where n.nspname='public' and p.prokind in ('f','p')
--    and satir ~* '(origin_city|destination_city|\mcity\M)'
--  order by 1, 2;
-- ⚠️ False positive'ler beklenir (jsonb anahtarı `->>'city'`, `provinces.name as city`,
--    RETURNS TABLE imzası). Sınıflandırma regex'i YAZILMAZ — 31 Tem'de tam olarak
--    o hata yapıldı ve dört fonksiyonu yanlış "temiz" gösterdi. Satırlar GÖZLE okunur.

-- 6.3 — View ve RLS politikaları
-- select viewname from pg_views
--  where schemaname='public' and definition ~* '(origin_city|destination_city)';
-- select polname from pg_policy
--  where pg_get_expr(polqual, polrelid) ~* '(origin_city|destination_city)';
-- Beklenen: ikisi de 0 satır (31 Tem'de zaten 0'dı).

-- 6.4 — Duman testi (canlı)
--   [ ] Ana sayfa il filtresi sonuç veriyor
--   [ ] /ilan-ver ile yeni ilan oluşuyor  ← BÖLÜM 1'in asıl testi
--   [ ] WhatsApp webhook'undan ilan oluşuyor
--   [ ] Edge Function parse-listing ilan yazıyor
--   [ ] /admin/radar rota sorgusu timeout'suz bitiyor
--   [ ] Moderatör panelinde ilan düzenleme kaydediyor
--   [ ] /ilan/[id] detay sayfası kalkış ilini gösteriyor
--   [ ] /api/ilanlar/[id] yanıtında `rota.kalkis.sehir` dolu (public API sözleşmesi)


-- ============================================================================
-- BÖLÜM 7 — GERİ ALMA
-- ============================================================================
--
-- Aşamaya göre değişir. "Tek bir rollback script'i" YOK — bu bilinçli.
--
-- BÖLÜM 1'den sonra, BÖLÜM 5'ten önce (GERİ ALINABİLİR):
--   `docs/20260730_ilan_olustur_v3.sql`'i tekrar çalıştır. Fonksiyon v3'e döner,
--   metin kolonlarına yazmaya devam eder. Ara dönemde NULL yazılmış satırlar
--   kalır; şu sorgu ile doldurulur:
--     update public.listings l set origin_city = p.name
--       from public.provinces p
--      where p.id = l.origin_province_id and l.origin_city is null;
--     update public.listing_stops s set city = p.name
--       from public.provinces p
--      where p.id = s.province_id and s.city is null;
--   ⚠️ Bu telafi SADECE province_id çözülmüş satırlar için çalışır. Çözülememiş
--      olanların metni v4 döneminde hiç yazılmadı, geri gelmez. Ara dönemi kısa
--      tut (aynı gün içinde karar ver).
--
-- BÖLÜM 5'ten sonra (GERİ ALINAMAZ — sadece yeniden inşa):
--   1. `alter table ... add column origin_city text;` (boş kolon)
--   2. Yukarıdaki iki `update` ile provinces.name'den yeniden türet.
--   3. Kaybedilen: çözülememiş serbest metinler. Geri gelmez.
--   4. İndeksler `create index concurrently` ile yeniden kurulur (~72 MB, uzun sürer).
--
-- ✅ BU YÜZDEN BÖLÜM 5'TEN ÖNCE YEDEK:
--   ✅ ÇALIŞTIRILDI 6 AĞU 2026. Tablo adları burada `_20260807` yazıyordu; gerçek
--      çalıştırma tarihiyle `_20260806` olarak alındı ve bu blok ona göre düzeltildi.
--      Yanlış tarihli bir yedek, 30 gün sonra "bu silinebilir mi" kararını veren
--      kişiyi yanıltır — runbook'taki tahmini tarih değil, GERÇEK tarih kullanılır.
--
--   create table public.dalga5_yedek_20260806 as
--   select l.id, l.origin_city, l.origin_province_id
--     from public.listings l
--    where l.origin_city is not null;          -- ➜ 234.840 satır
--   (⬅️ `destination_city` çıkarıldı — kolon yok, 42703 verirdi.)
--
--   create table public.dalga5_yedek_stops_20260806 as
--   select s.id, s.listing_id, s.stop_order, s.city, s.province_id
--     from public.listing_stops s
--    where s.city is not null;                 -- ➜ 245.086 satır
--
--   📌 `where ... is not null` FİLTRESİNE DİKKAT: yedek satır sayısı kaynak tablonun
--      TOPLAMINDAN AZDIR (234.840 < 243.644). Fark = metin kolonu boş satırlar, yani
--      `ilan_olustur` v4'ün 3 Ağu'dan sonra yazdıkları. Bu bir eksiklik değil, ama
--      ileride biri sayıları karşılaştırırsa paniğe kapılmasın diye buraya yazıldı.
--
--   ⚠️ Yedek tabloları en az 30 gün tutulur → **6 EYL 2026'DAN ÖNCE SİLİNMEZ.**
--      Silme kararı ayrı bir görevdir, "drop başarılı görünüyor" o kararın gerekçesi
--      değildir — bozulmalar genelde ilk günde değil, aylık raporlar çalışınca fark edilir.
