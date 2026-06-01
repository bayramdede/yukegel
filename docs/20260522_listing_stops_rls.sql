-- listing_stops tablosu için anon okuma politikası
-- Sorun: anon client listing_stops'u okuyamadığı için
--   (1) landing page'de varış şehri filtresi çalışmıyordu
--   (2) ilan kartlarında "Kalkış → Varış" formatı görünmüyordu
-- Çözüm: Onaylı + aktif ilanların durakları herkese açık

-- RLS zaten ENABLE durumundaysa bu satır zararsız
ALTER TABLE listing_stops ENABLE ROW LEVEL SECURITY;

-- Anon & authenticated: yalnızca aktif+onaylı ilanların durakları görünür
CREATE POLICY "listing_stops_public_select"
  ON listing_stops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM listings l
      WHERE l.id = listing_stops.listing_id
        AND l.status = 'active'
        AND l.moderation_status IN ('approved', 'auto_published')
        AND l.is_shadow_banned = false
    )
  );
