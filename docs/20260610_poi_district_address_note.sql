-- ============================================================
-- pois: district (ilçe) + address_note (adres tarifi) kolonları
-- Tarih: 2026-06-10
-- ============================================================

ALTER TABLE pois ADD COLUMN IF NOT EXISTS district     text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS address_note text;

-- Yorum
COMMENT ON COLUMN pois.district      IS 'İlçe adı (opsiyonel)';
COMMENT ON COLUMN pois.address_note  IS 'Adres tarifi — nasıl gidilir, ne dikkat edilir (opsiyonel)';
