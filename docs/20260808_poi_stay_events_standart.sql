-- =============================================================================
-- `poi_stay_events` coğrafi standardı — COĞRAFİ GEÇİŞİN SON PARÇASI
-- 8 Ağustos 2026 (migration: `poi_stay_events_cografi_standart`)
-- =============================================================================
--
-- BAĞLAM (Bayram): "O tablolar boş. Onu da hallet."
-- Bir önceki turda `poi_stay_events.poi_city` metin coğrafi standardın DIŞINDA
-- kalan son kolon olarak işaretlenmişti.
--
-- =============================================================================
-- BÖLÜM 0 — ÖLÇÜM / TEŞHİS
-- =============================================================================
-- Gerçek satır sayıları alındı (`n_live_tup` tahminî; `count(*)` ile kesinleşti).
-- BOŞ üç tablo, üçü de POI ailesinden:
--   poi_reviews      0 satır   → coğrafi kolonu YOK, kodda KULLANILIYOR
--                                (api/poi/[id] + api/poi/[id]/review) — dokunulmadı
--   poi_visit_logs   0 satır   → coğrafi kolonu YOK (user_location = geography
--                                point, poi_id FK) — standartlaştıracak şey yok
--   poi_stay_events  0 satır   → `poi_city text` VAR                    ← BU DOSYA
--
-- `poi_stay_events` ÖLÜ ŞEMA DEĞİL: TypeScript'ten hiç referans edilmiyor ama
-- `get_parked_drivers_for_notification()` onu okuyor (POI'de 3 saatten uzun park
-- eden sürücüye bildirim). O fonksiyonu çağıran bir route ya da cron job da YOK
-- (`cron.job` tarandı, sıfır sonuç) — yani YARIM KALMIŞ bir özellik.
-- Bu yüzden tabloyu silmedik; standarda uydurduk.
--
-- =============================================================================
-- BÖLÜM 1 — KARAR: `province_id` EKLEMEK DEĞİL, `poi_city`yi KALDIRMAK
-- =============================================================================
-- Fonksiyonun eski gövdesi ZATEN POI'ye join yapıyordu:
--     SELECT se.user_id, se.poi_city, p.name, se.check_in_at
--     FROM poi_stay_events se JOIN pois p ON p.id = se.poi_id
--     WHERE ... AND se.poi_city IS NOT NULL;
--
-- Yani şehir bilgisi her çağrıda `pois` üzerinden ERİŞİLEBİLİRKEN tabloda
-- ikinci bir METİN kopyası tutuluyordu. O kopya kaçınılmaz olarak ayrışır:
-- POI'nin şehri düzeltilince (ki 8 Ağu'da 9.178 POI'nin şehri kanonikleştirildi
-- — bkz. 20260808_poi_cografi_standart.sql) olay kaydı ESKİ şehirde kalırdı.
-- Projede tam bu hata sınıfı tekrarlıyor: aynı olgunun iki yerde iki kopyası.
--
-- `pois.province_id` artık var, kanonik kaynak orada. Denormalize kopyaya gerek
-- yok → kolon DÜŞTÜ. Tablo boş olduğu için taşınacak veri de yoktu.
alter table public.poi_stay_events drop column if exists poi_city;

-- Fonksiyon: şehri `provinces`ten TÜRETİYOR + `province_id` de döndürüyor
-- (tüketici il ADI yerine id ile çalışabilsin — standardın asıl amacı).
-- Dönüş tipi değiştiği için DROP+CREATE zorunlu; güvenli çünkü fonksiyonu
-- çağıran kod/cron YOK (ikisi de tarandı).
--
-- ⚠️ Eski gövdedeki `and se.poi_city is not null` filtresi KALDIRILDI: aynı işi
--    `join provinces` yapıyor (province_id'si NULL olan POI eşleşmez). İki yerde
--    iki ayrı "şehri bilinmeyen" tanımı bırakmıyoruz.
--
-- Tam gövde için: select pg_get_functiondef('get_parked_drivers_for_notification'::regproc)

-- =============================================================================
-- BÖLÜM 2 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı, ROLLBACK'li)
-- =============================================================================
-- Tablo BOŞ olduğu için fonksiyon bugüne kadar HİÇ gerçek veriyle çalışmamıştı.
-- Üç ayrı vaka uydurulup denendi:
-- begin;
--   -- (a) 4 saat önce park etmiş, bildirilmemiş → DÖNMELİ
--   -- (b) 1 saat önce park etmiş (< 3 saat)     → DÖNMEMELİ
--   -- (c) 9 saat önce park etmiş ama notified_at dolu → DÖNMEMELİ
--   select province_id, poi_city, poi_name, parked_since
--   from public.get_parked_drivers_for_notification();
-- rollback;
--
-- SONUÇ: yalnız (a) döndü ✅
--   province_id = 34 · poi_city = 'İstanbul' (provinces'ten kanonik) ·
--   poi_name = 'Beyoğlu Esnaf Lokantası'
-- (b) ve (c) doğru şekilde elendi ✅ · ROLLBACK sonrası tablo yine 0 satır ✅
--
-- =============================================================================
-- BÖLÜM 3 — COĞRAFİ GEÇİŞ ARTIK TAMAMLANDI (şema genelinde doğrulandı)
-- =============================================================================
-- Metin şehir kolonu olup `province_id`/`origin_province_id` KARŞILIĞI OLMAYAN
-- canlı tablo kaldı mı?
select count(*) as standartsiz_kalan
from information_schema.columns c
where c.table_schema = 'public'
  and (c.column_name ilike '%city%' or c.column_name ilike '%sehir%')
  and c.data_type in ('text', 'character varying')
  and c.table_name not like '%yedek%'
  and not exists (
    select 1 from information_schema.columns c2
    where c2.table_schema = 'public' and c2.table_name = c.table_name
      and c2.column_name in ('province_id', 'origin_province_id'));
-- SONUÇ: 0 ✅
--
-- Kalan metin ilçe kolonları (`listings.origin_district`, `listing_stops.district`,
-- `pois.district`, `aliases.district`) BİLİNÇLİ metin: spec md.7 serbest ilçe
-- girişine izin veriyor ve resmîlik `district_official` / `ilceResmiMi()` ile
-- ayrıca işaretleniyor. Bunlar standardın İHLALİ değil, standardın KENDİSİ.
--
-- =============================================================================
-- BÖLÜM 4 — GERİ ALMA
-- =============================================================================
-- alter table public.poi_stay_events add column poi_city text;
-- (+ fonksiyonu eski gövdesine döndür: se.poi_city seç, join provinces'i kaldır,
--    `and se.poi_city is not null` filtresini geri koy)
