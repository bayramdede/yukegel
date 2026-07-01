-- ============================================================
-- Yakınımdaki Yükler — RPC (Faz 1: il bazlı)
-- Tarih: 2026-07-01
-- ============================================================
-- Not: docs/20260610_poi_module.sql içindeki eski
-- get_nearby_listings_for_parked_driver fonksiyonu listings.dest_city,
-- listings.title, listings.load_type kolonlarını referans alıyordu —
-- bu kolonlar gerçek şemada YOK (gerçek kolonlar: origin_city,
-- origin_district; varış bilgisi listing_stops'tan gelir). O fonksiyon
-- hâlâ dursun (geriye dönük), ama çağrılırsa hata verir. Bu yeni
-- fonksiyon doğru şema ile yazıldı ve /api/listings/yakin tarafından
-- kullanılıyor.

CREATE OR REPLACE FUNCTION get_nearby_listings_by_city(
  p_city      text,
  p_district  text DEFAULT NULL,
  p_limit     integer DEFAULT 20
)
RETURNS TABLE (
  id                uuid,
  listing_type      text,
  origin_city       text,
  origin_district   text,
  dest_city         text,
  dest_district     text,
  vehicle_type      text[],
  body_type         text[],
  price_offer       numeric,
  price_negotiable  boolean,
  available_date    text,
  date_flexible     boolean,
  created_at        timestamptz,
  eslesme           text  -- 'ilce' | 'il'
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH son_durak AS (
    SELECT DISTINCT ON (listing_id)
      listing_id, city, district
    FROM listing_stops
    ORDER BY listing_id, stop_order DESC
  )
  SELECT
    l.id,
    l.listing_type,
    l.origin_city,
    l.origin_district,
    sd.city  AS dest_city,
    sd.district AS dest_district,
    l.vehicle_type,
    l.body_type,
    l.price_offer,
    l.price_negotiable,
    l.available_date,
    l.date_flexible,
    l.created_at,
    CASE
      WHEN p_district IS NOT NULL AND l.origin_district ILIKE p_district THEN 'ilce'
      ELSE 'il'
    END AS eslesme
  FROM listings l
  LEFT JOIN son_durak sd ON sd.listing_id = l.id
  WHERE
    l.origin_city ILIKE p_city
    AND l.status = 'active'
    AND l.moderation_status IN ('approved', 'auto_published')
    AND l.is_shadow_banned = false
  ORDER BY
    CASE WHEN p_district IS NOT NULL AND l.origin_district ILIKE p_district THEN 0 ELSE 1 END,
    l.created_at DESC
  LIMIT p_limit;
$$;
