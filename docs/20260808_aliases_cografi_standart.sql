-- =============================================================================
-- `aliases` tablosuna coğrafi standart — 8 Ağustos 2026
-- (Supabase `apply_migration`: `aliases_cografi_standart`)
-- =============================================================================
--
-- İSTEK (Bayram): "Coğrafi veri standartlaşmayı buraya da taşı."
--
-- ÖNCE DURUM TESPİTİ — radar zaten standarttı:
--   Radar/analitik'in DB katmanı Dalga 3'te province_id'ye çevrilmiş. Üç radar
--   fonksiyonu da kontrol edildi: `origin_city` YOK, `city ILIKE` YOK,
--   `province_id` VAR. İl adı yalnız HTTP sınırında ve `ilId()` ile çeviriliyor
--   (derin bağlantılar `?from_city=İstanbul` ile çalıştığı için bilinçli).
--   → Radar'da taşınacak bir şey kalmamıştı.
--
-- Bunun üzerine canlı şema tarandı: metin coğrafi kolonu olup `province_id`
-- KARŞILIĞI OLMAYAN yalnız iki yer kaldı:
--   1. `aliases` — `normalized` bir İL ADI ama sadece metin        ← BU DOSYA
--   2. `poi_stay_events.poi_city` — POI şehrinin kopyası (yapılmadı, bkz. BÖLÜM 5)
--
-- =============================================================================
-- BÖLÜM 0 — NEDEN `aliases` ÖNEMLİ (üç ayrı olayın kökü aynı kolonda)
-- =============================================================================
-- `aliases` PARSER'IN İL ÇÖZÜMÜNÜN KAYNAĞI. İli metin tuttuğu için bu projede
-- aynı hata sınıfı ÜÇ KEZ yaşandı:
--   · W5/D1 (29 Tem)  — LLM prompt'unun ÖRNEKLERİ ASCII'ydi; model kuralı değil
--     örneği taklit etti, tablo iki yazımla doldu ("Istanbul" 13 / "İstanbul"
--     154). `findPlaces` bunları İKİ AYRI ŞEHİR saydı → sahte İstanbul→İstanbul
--     güzergâhları ve şehir filtresinin ilanları yok sayması.
--   · 20260804_u0307_alias_onarimi — 'İ' bozuk ayrışmasından kalan U+0307;
--     ekranda 'i' gibi görünüp eşleşmeyen kayıtlar.
--   · #51 (4 Ağu) — ilçe BAŞKA ilin ilçesiydi (orhanli→Sakarya, bigadi→Çanakkale,
--     selimpaşa→Tekirdağ) ve ilanlara yansımıştı.
-- Üçünün kökü tek: İL KİMLİĞİ DOĞRULANMAYAN BİR METİNDİ.
--
-- ⚠️ ÖLÇÜM (uygulamadan ÖNCE): 1.829 `city` alias'ının 1.828'i geçerli bir ile
--    çözülüyordu. Yani VERİ İYİYDİ — bu düzeltme onarım DEĞİL, aynı hata
--    sınıfının bir daha oluşmasını imkânsız kılan yapısal bir kapı.
--    Çözülmeyen tek satır: alias 'erbil' → 'Erbil' (Irak), is_active=false,
--    is_approved=false — reddedilmiş bir AI önerisi; NULL kalması DOĞRU.
--    İlçesi "resmî değil" görünen 32 satır incelendi: neredeyse tamamı MEŞRU
--    mahalle/semt (Merter, Işıkkent, Hadımköy, Selimpaşa, Etlik, Göcek…) —
--    #51'in `ilceHangiIllerde()` ile ayırt ettiği (a) durumu. Dokunulmadı.
--
-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================
alter table public.aliases
  add column if not exists province_id smallint references public.provinces(id);

-- 🚨 TÜRETME TRIGGER'DA, UYGULAMADA DEĞİL.
-- GEREKÇE: `aliases`e yazan DÖRT ayrı yol var (W5/D2'de sayıldı: learn-aliases
-- create / approve / patch + AI keşfi upsert). Türetmeyi uygulama koduna koysam
-- dördünü de doğru yazmam ve gelecekte eklenecek beşincinin de hatırlaması
-- gerekirdi — bu projede tam olarak böyle kaçmış hatalar var. Trigger'da olunca
-- hiçbir yol atlayamaz: Deno fonksiyonu, elle SQL, ileride eklenen route, hepsi.
--
-- Mevcut `aliases_normalize()` (20260804) GENİŞLETİLDİ; tam gövde migration'da.
-- Eklenen kısım:
--   IF NEW.type = 'city' AND NEW.normalized IS NOT NULL THEN
--     SELECT p.id INTO NEW.province_id FROM public.provinces p
--     WHERE public.il_key(p.name) = public.il_key(NEW.normalized) LIMIT 1;
--   ELSE
--     NEW.province_id := NULL;   -- vehicle/body/blacklist'te `normalized` il değil
--   END IF;
--
-- ⚠️ Trigger'ın izlediği kolon listesine `type` EKLENDİ:
--    before insert or update of alias, normalized, district, TYPE
--    Yoksa "type: vehicle → city" güncellemesi province_id'yi tazelemezdi
--    (sessizce NULL kalırdı). Bu, listeye kolon eklemeyi unutma sınıfı bir hata.

-- Backfill + indeks
-- update public.aliases set normalized = normalized where type='city' and normalized is not null;
-- create index aliases_province_id_idx on public.aliases (province_id) where province_id is not null;

-- =============================================================================
-- BÖLÜM 2 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı)
-- =============================================================================
-- 2.1 Backfill sonucu
select
  count(*) filter (where type='city')                             as city_alias,      -- 1829
  count(*) filter (where type='city' and province_id is not null)  as province_id_dolu, -- 1828
  count(*) filter (where type='city' and province_id is null)      as province_id_bos,  -- 1 (Erbil)
  count(*) filter (where type<>'city' and province_id is not null) as yanlis_dolu,      -- 0
  (select count(*) from public.aliases a join public.provinces p on p.id=a.province_id
     where il_key(p.name) <> il_key(a.normalized))                 as celiskili         -- 0
from public.aliases;

-- 2.2 🚨 HATA SINIFI GERÇEKTEN KAPANDI MI? (W5/D1'in birebir senaryosu)
-- begin;
-- insert into public.aliases (alias, normalized, type, is_active, is_approved) values
--   ('test-ascii-1','Istanbul','city',false,false),
--   ('test-ascii-2','ISTANBUL','city',false,false),
--   ('test-ascii-3','istanbul','city',false,false),
--   ('test-u0307',  'İstanbul','city',false,false),
--   ('test-arac',   'TIR','vehicle',false,false),
--   ('test-yabanci','Erbil','city',false,false)
-- returning alias, normalized, type, province_id;
-- rollback;
-- SONUÇ: dört İstanbul yazımının DÖRDÜ de province_id=34 ✅
--        vehicle tipi → NULL ✅ · Erbil (Türkiye dışı) → NULL, reddedilmedi ✅
--   → Bozuk yazım artık KİMLİĞİ bozmuyor: 'Istanbul' ile 'İstanbul' aynı ildir.

-- 2.3 `type` değişimi province_id'yi tazeliyor mu?
-- begin;
-- insert into public.aliases (alias, normalized, type, is_active, is_approved)
--   values ('test-tip','Bursa','vehicle',false,false);
-- update public.aliases set type='city' where alias='test-tip';
-- select alias, normalized, type, province_id from public.aliases where alias='test-tip';
-- rollback;
-- SONUÇ: vehicle→city sonrası province_id=16 ✅ (trigger listesine `type` eklemenin sebebi)

-- =============================================================================
-- BÖLÜM 3 — NE DEĞİŞMEDİ (bilinçli)
-- =============================================================================
-- · `normalized` metin kolonu DURUYOR. Parser (`findPlaces`, `whatsapp-parse`)
--   hâlâ onu okuyor; düşürmek ayrı bir dalga ve senkron kopya (Deno) riski taşır.
--   `province_id` artık YETKİLİ kimlik, `normalized` gösterim/eşleşme kopyası.
-- · `district` metin kalıyor + `district_official` YOK bu tabloda: alias'ın
--   ilçesi zaten çoğu zaman resmî ilçe DEĞİL (mahalle/semt) ve bu normal
--   (spec md.7). Resmîlik sorusu `ilceResmiMi()`/`ilceHangiIllerde()` ile
--   SORGU anında cevaplanıyor.
-- · Uygulama kodu DEĞİŞMEDİ — türetme DB'de olduğu için gerekmedi.

-- =============================================================================
-- BÖLÜM 4 — GERİ ALMA
-- =============================================================================
-- drop index if exists public.aliases_province_id_idx;
-- alter table public.aliases drop column if exists province_id;
-- (+ `aliases_normalize()`i 20260804 sürümüne döndür, trigger kolon listesinden
--    `type`i çıkar)

-- =============================================================================
-- BÖLÜM 5 — KALAN TEK YER: `poi_stay_events.poi_city`
-- =============================================================================
-- Metin şehir tutan ve `province_id` karşılığı olmayan son tablo.
-- YAPILMADI çünkü bu kolon `pois.city`nin OLAY ANINDAKİ KOPYASI (denormalize
-- edilmiş anlık görüntü) — canlı bir coğrafi alan değil, tarihsel kayıt.
-- `pois` artık `province_id` taşıdığına göre (bkz. 20260808_poi_cografi_standart.sql)
-- doğru çözüm bu kolonu `poi_province_id` ile ikizlemek ya da tamamen düşürüp
-- `pois`e JOIN etmek. İkisi de bu turun kapsamı dışı; `docs/YAPILACAKLAR.md`'ye
-- açık madde olarak yazıldı.
