-- =============================================================================
-- POI tarafına coğrafi standardizasyon — 8 Ağustos 2026
-- (Supabase `apply_migration`: `poi_ilce_key_ve_cozucu` + `pois_cografi_standart`)
-- =============================================================================
--
-- İSTEK (Bayram): "Poi tarafına da coğrafi standardı uygula."
--
-- BAĞLAM: `pois` tablosu `docs/COGRAFI_GECIS.md`'nin HİÇBİR dalgasında yer
-- almamıştı — bir gün önce (`docs/20260808_il_ilce_combobox.sql`) POI'nin kendi
-- şehir/ilçe alanları "farklı sistem, kapsam dışı" diye bilinçli olarak
-- bırakılmıştı. Bu dosya o kararı tersine çeviriyor: aynı sözleşme POI'ye de
-- uygulandı (`province_id` smallint FK + `district` metin + `district_official`).
--
-- =============================================================================
-- BÖLÜM 0 — ÖLÇÜM (uygulamadan ÖNCE, canlı veride)
-- =============================================================================
-- 9.178 POI:
--   city:      3 boş, 88 farklı değer (81 il olmalıydı → 7 fazlalık)
--   district: 10 boş, 648 farklı değer
--
-- `il_key()` ile eşleşmeyen city değerleri (11 satır):
--   Afyon(3) · NULL(3) · Mersin (Icel)(1) · Mersin (İçel)(1)
--   Sakarya (Adapazarı)(1) · Tekiğrdağ(1) · Kıbrıs(1)
--
-- İlçe tarafı ilk bakışta felaketti: 4.951 resmî / 4.209 "serbest" (%46).
-- AMA o 4.209'un %89'u GERÇEK serbest metin DEĞİL, üç MEKANİK kalıptı:
--   3.740  "<İl> Merkez"     → "Edirne Merkez", "Denizli Merkezefendi"
--     129  U+0307 bulaşması  → "Osmangazi̇" (docs/20260804_u0307_alias_onarimi.sql'in
--                               alias tablosunda düzelttiği hatanın aynısı)
--     113  ilçe = il adı     → "Düzce"/"Düzce"
--     227  gerçek kalan      → mahalle/semt (Bebek, Sirkeci, Eryaman) + çöp (Cd, Mola)
-- Kaynak: Google Places `address_components` (`app/api/admin/poi-import`).
--
-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================

-- 1.1 🚨 `il_key()` DEĞİŞTİRİLMEDİ — ÜSTÜNE yeni anahtar eklendi.
--     ÜÇ fonksiyonel indeks `il_key()`e bağlı: `provinces_il_key_uniq`,
--     `districts_il_key_uniq`, `districts_ad_key_idx`. IMMUTABLE bir fonksiyonun
--     GÖVDESİNİ değiştirmek o indeksleri REINDEX'e kadar SESSİZCE yanlış sonuç
--     verir hale getirir — "şapkayı da katlayalım" diye il_key'e dokunmak
--     tabloyu bozardı. Bu yüzden `ilce_key()` ayrı bir fonksiyon.
create or replace function public.ilce_key(v text)
returns text language sql immutable parallel safe as $$
  select translate(
           public.il_key(replace(coalesce(v, ''), U&'\0307', '')),
           'âîûêô', 'aiueo')
$$;

-- 1.2 Kademeli ve MUHAFAZAKÂR ilçe çözücü. Tahmin ETMEZ; yalnız üç kalıbı açar.
--     TS ikizi: `lib/poi-lokasyon.ts::poiIlceCoz()` — ⚠️ SENKRON KOPYA.
create or replace function public.poi_ilce_coz(p_province_id smallint, p_district text)
returns text language sql stable parallel safe set search_path to 'public' as $$
  with g as (
    select public.ilce_key(p_district) as k,
           public.ilce_key((select name from public.provinces where id = p_province_id)) as ilk
  )
  select coalesce(
    (select d.name from public.districts d, g
      where d.province_id = p_province_id and public.ilce_key(d.name) = g.k limit 1),
    (select d.name from public.districts d, g
      where d.province_id = p_province_id and g.k like g.ilk || ' %'
        and public.ilce_key(d.name) = btrim(substr(g.k, length(g.ilk) + 2)) limit 1),
    (select d.name from public.districts d, g
      where d.province_id = p_province_id and g.k = g.ilk
        and public.ilce_key(d.name) = 'merkez' limit 1)
  )
$$;

-- 1.3 Kolonlar + backfill + kanonikleştirme + indeks
--     (tam gövdesi `pois_cografi_standart` migration'ında; özeti:)
--   alter table public.pois
--     add column province_id smallint references public.provinces(id),
--     add column district_official boolean;
--   -- province_id: il_key eşleşmesi + 5 elle alias (yukarıdaki ölçümün tamamı)
--   -- city: province_id'den TÜRETİLDİ (kanonikleştirme — listings Dalga 2 ile aynı)
--   -- district: poi_ilce_coz() ile resmî yazıma çekildi, district_official işaretlendi
--   create index pois_province_id_idx on public.pois (province_id) where province_id is not null;

-- =============================================================================
-- BÖLÜM 2 — SONUÇ (uygulama SONRASI ölçüm)
-- =============================================================================
--   province_id kapsama : 9.174 / 9.178 = %99,96
--   çözülemeyen (4)     : 3 × city NULL (Çerkezköy Park Alanı ×2, Erzurum-Kars Yolu)
--                         1 × "Kıbrıs" — Türkiye'nin 81 ili DIŞINDA, doğru davranış
--   ilçe resmî          : 4.951 → 8.765   (+3.814)
--   ilçe serbest        : 4.209 →   402
--   farklı city değeri  : 88 → 82 (81 il + Kıbrıs)
--
-- ⚠️ ÇÖZÜLMEYEN 402 İLÇE BİLİNÇLİ: çoğu büyükşehirlerin "<İl> Merkez"i
--    (Balıkesir/Ordu/Van/Denizli/Aydın...). Bu illerde 'Merkez' RESMÎ İLÇE
--    DEĞİL — "Balıkesir Merkez" Karesi mi Altıeylül mü BİLİNMEZ. Uydurmak
--    veriyi bozar; `district_official=false` ile serbest bırakmak spec md.7'nin
--    tam olarak öngördüğü davranış. Geri kalanı gerçek mahalle/semt.
--
-- =============================================================================
-- BÖLÜM 3 — KOD TARAFI
-- =============================================================================
-- YENİ: `lib/poi-lokasyon.ts` — `poiKonumCoz(city, district)`; `pois`e il/ilçe
--       yazan HER yol buradan geçer (`lib/ilan-yaz.ts`in listings için oynadığı rol).
--
-- Bağlanan yazma yolları:
--   - app/api/poi/route.ts            POST  (kullanıcı POI ekleme)
--   - app/api/poi/[id]/route.ts       PATCH (admin düzenleme)
--       ⚠️ PATCH KISMİ: yalnız `district` gelirse il MEVCUT SATIRDAN okunur.
--          Yoksa il null sanılır ve backfill'in doğru kurduğu bayrak bozulurdu.
--   - app/api/admin/poi/route.ts      POST  (toplu ekleme, ≤500)
--   - app/api/admin/poi-import/route.ts     (Google Places — "<İl> Merkez"in KAYNAĞI)
--   - app/api/admin/enrich-poi/route.ts     (yazmıyor, öneriyi kanonikleştiriyor)
--
-- Formlar (dünkü `IlceGirisi` bileşeni POI'ye de bağlandı):
--   - app/yol-rehberi/PoiEkleModal.tsx      Şehir: serbest metin → alfabetik select
--   - app/admin/poi-onay/PoiOnayClient.tsx  İlçe : serbest metin → önerili (serbest yazıma AÇIK)
--
-- OKUMA yolları DEĞİŞMEDİ ve değişmesi de gerekmedi: POI okumaları tamamen
-- coğrafi (`get_pois_in_bbox`, lat/lng). Repoda `pois.city`/`district` üzerinde
-- TEK BİR eşitlik/ILIKE filtresi yok (grep'lendi) — `city`i kanonikleştirmek
-- hiçbir sorguyu kırmadı. `city` sıralama seçeneği olarak duruyor (admin listesi).
--
-- =============================================================================
-- BÖLÜM 4 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı)
-- =============================================================================
-- 4.1 Tutarlılık — dördü de 0 dönmeli
select
  (select count(*) from public.pois p join public.provinces pr on p.province_id=pr.id
     where p.city is distinct from pr.name)                                               as celiskili_city,
  (select count(*) from public.pois
     where district_official is true  and not ilce_resmi(province_id::smallint, district)) as yalan_resmi,
  (select count(*) from public.pois
     where district_official is false and     ilce_resmi(province_id::smallint, district)) as kacan_resmi,
  (select count(*) from public.pois
     where province_id is not null and coalesce(btrim(district),'')<>''
       and district_official is null)                                                      as isaretsiz;
-- SONUÇ: 0 · 0 · 0 · 0 ✅

-- 4.2 FK uydurma il id'sini reddediyor mu?
-- begin;
--   insert into public.pois (name, category, location, latitude, longitude, province_id)
--   values ('FK testi','akaryakit_istasyonu','SRID=4326;POINT(29 41)',41,29,999);
-- rollback;
-- SONUÇ: 23503 foreign key violation ✅

-- 4.3 SENKRON KOPYA DENETİMİ — `npm run test:poi-senkron`
--     TS `poiIlceCoz()` ile SQL `poi_ilce_coz()` canlı veride aynı kararı
--     veriyor mu? 9.167 satır → 654 tekil (il,ilçe) çifti, AYRIŞAN: 0 ✅
--     Bu test TEKRAR ÇALIŞTIRILABİLİR ve iki taraftan biri değişirse kırılır.
-- 4.4 `npm run test:poi-lokasyon` → 23/23 ✅ (uydurmama garantileri dahil)
-- 4.5 `test:lokasyon` 23/23 · `test:districts` 18/18 · tsc · next build → temiz ✅

-- =============================================================================
-- BÖLÜM 5 — GERİ ALMA
-- =============================================================================
-- ⚠️ `city`/`district` metinleri YERİNDE kanonikleştirildi; kolonları düşürmek
--    ESKİ YAZIMLARI GERİ GETİRMEZ (zaten istenen de bu değil). Şema geri alma:
-- drop index if exists public.pois_province_id_idx;
-- alter table public.pois drop column if exists district_official;
-- alter table public.pois drop column if exists province_id;
-- drop function if exists public.poi_ilce_coz(smallint, text);
-- drop function if exists public.ilce_key(text);

-- =============================================================================
-- BÖLÜM 6 — YAPILMAYANLAR (bilinçli)
-- =============================================================================
-- 1. `city` metin kolonu DÜŞÜRÜLMEDİ. listings'te bu Dalga 5'ti ve ayrı bir
--    iş; burada `province_id` yetkili kaynak, `city` ondan türetilmiş kopya
--    (çift yazım dönemi). Düşürmek tüm POI okuma yollarını taramayı gerektirir.
-- 2. Türkiye dışı POI'ler için çözüm üretilmedi (`Kıbrıs`, 1 satır).
--    `province_id` NULL kalıyor — FK'lı bir kolonda doğru davranış.
-- 3. 3 NULL city'li POI koordinatlarından ters-coğrafi kodlanabilirdi;
--    yapılmadı (3 satır için dış servis çağrısı, orantısız).
