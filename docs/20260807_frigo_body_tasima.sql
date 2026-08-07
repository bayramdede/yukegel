-- =============================================================================
-- frigo/frigorifik/frigolu: type='vehicle' -> type='body'
-- Tarih: 7 Ağustos 2026
-- Bulundu: lib/lane-parser.ts (yeni "yazarak ilan ekle" regex yolu) gerçek
-- alias verisiyle test edilirken. "Frigorifik" bir ÜSTYAPI (kasa tipi) değeri
-- ama bu üç satır ARAÇ TİPİ olarak etiketlenmiş. Etki: findVehicle() bunu
-- "araç tipi" sanıp döndürüyor; form tarafındaki ARAC_TIPLERI beyaz listesi
-- ("TIR"|"Kırkayak"|"Kamyon"|"Kamyonet"|"Panelvan") tanımadığı için sessizce
-- atıyor — zararsız ama üstyapı bilgisi kayboluyor (findBodyType de yakalamıyor,
-- çünkü mevcut tek eşleşen body alias'ı "frigo tır" iki kelime, yalnız "frigo"
-- değil). Aynı `aliases` tablosu canlı WhatsApp hattını (parse-listing, Deno)
-- da besliyor — bu üç satır oradaki findVehicle/findBodyType'ı da etkiliyor.
--
-- BÖLÜM 0 — ÖNCE ÖLÇ
-- =============================================================================

-- 0.1 Değişecek satırlar (id 230/231/232 bekleniyor)
select id, type, alias, normalized, priority, district, is_active
from public.aliases
where lower(alias) in ('frigo', 'frigorifik', 'frigolu')
order by id;
-- beklenen: 3 satır, hepsi type='vehicle', normalized='Frigorifik', priority=80

-- 0.2 Çakışma var mı? (aliases_katlanmis_anahtar_uniq (type, katlanmış_anahtar) WHERE is_active)
-- type='body' + aynı katlanmış anahtarla AKTİF bir satır zaten varsa UPDATE 23505 ile patlar.
select id, type, alias, normalized, is_active
from public.aliases
where type = 'body'
  and translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu')
      in ('frigo', 'frigorifik', 'frigolu')
  and is_active = true;
-- beklenen: 0 satır (7 Ağu 2026'da ölçüldü: 0)

-- 0.3 Mevcut body-tipi öncelik tavanı — yeni priority buna göre seçildi (aşağıda 70)
select normalized, min(priority), max(priority), count(*)
from public.aliases
where type = 'body' and is_active = true
group by normalized
order by normalized;
-- beklenen: hepsi 50-70 aralığında; 80 hiçbirinde yok

-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================
-- 🚨 priority BİLEREK 80'den 70'e ÇEKİLİYOR — 80 kalsaydı bu üç satır tüm
-- `body` tipi alias'lar arasında EN yüksek öncelikli olurdu ve findBodyType()
-- (öncelik sırasına göre tarar, metindeki gerçek konuma göre değil) metinde
-- "tenteli" daha belirgin geçse bile "frigo" varsa onu seçerdi. 70, mevcut
-- Açık Kasa/Damperli/Jumbo/Liftli/Tenteli tavanıyla aynı seviye — hiçbirine
-- haksız öncelik vermiyor.
update public.aliases
set type = 'body', priority = 70
where lower(alias) in ('frigo', 'frigorifik', 'frigolu')
  and type = 'vehicle';

-- =============================================================================
-- BÖLÜM 2 — DOĞRULA
-- =============================================================================
select id, type, alias, normalized, priority, is_active
from public.aliases
where lower(alias) in ('frigo', 'frigorifik', 'frigolu')
order by id;
-- beklenen: 3 satır, hepsi type='body', priority=70

-- Etki alanı doğrulaması: artık `vehicle` tipinde frigo* kalmadı mı?
select count(*) as kalan_vehicle_frigo
from public.aliases
where type = 'vehicle'
  and translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu')
      in ('frigo', 'frigorifik', 'frigolu');
-- beklenen: 0

-- =============================================================================
-- BÖLÜM 3 — GERİ ALMA (gerekirse)
-- =============================================================================
-- update public.aliases
-- set type = 'vehicle', priority = 80
-- where lower(alias) in ('frigo', 'frigorifik', 'frigolu')
--   and type = 'body';

-- =============================================================================
-- ETKİ NOTU
-- =============================================================================
-- Canlı `parse-listing` (Deno) worker'ları bu tabloyu 60 saniyelik TTL ile
-- önbelleğe alıyor (#73) — kod deploy'u GEREKMİYOR, en geç 60 sn içinde yeni
-- veriyi görürler. `lib/lane-parser.ts` (Next.js, /api/parse-text) her
-- istekte taze çekiyor, hemen etkilenir.
