-- ─────────────────────────────────────────────────────────────
-- Migration: get_pois_in_bbox RPC'ye p_categories text[] eklendi
-- Tarih: 2026-06-17
-- Amaç: Çoklu kategori seçiminde IN mantığıyla filtreleme
--   p_category  → tek kategori (mevcut, geriye dönük uyumlu)
--   p_categories → çoklu kategori dizisi (YENİ: = ANY(...) ile filtre)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pois_in_bbox(
  p_min_lng        double precision,
  p_min_lat        double precision,
  p_max_lng        double precision,
  p_max_lat        double precision,
  p_category       text    DEFAULT NULL,
  p_categories     text[]  DEFAULT NULL,
  p_tags           text[]  DEFAULT NULL,
  p_emergency_only boolean DEFAULT false,
  p_user_lat       double precision DEFAULT NULL,
  p_user_lng       double precision DEFAULT NULL,
  p_limit          integer DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  name            text,
  category        text,
  latitude        double precision,
  longitude       double precision,
  tags            text[],
  badges          jsonb,
  avg_rating      numeric,
  review_count    integer,
  is_emergency    boolean,
  distance_m      double precision,
  ranking_score   double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.latitude,
    p.longitude,
    p.tags,
    p.badges,
    p.avg_rating,
    p.review_count,
    p.is_emergency,
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_m,
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        (
          0.4 * GREATEST(0, 1.0 - (
            ST_Distance(
              p.location,
              ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
            ) / 10000.0
          ))
          +
          0.5 * (COALESCE(p.avg_rating, 0) / 5.0)
          +
          0.1 * CASE WHEN p.status = 'approved' THEN 1.0 ELSE 0.0 END
        )
      ELSE
        COALESCE(p.avg_rating, 0) / 5.0
    END AS ranking_score
  FROM pois p
  WHERE
    p.location::geometry && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    AND p.status = 'approved'
    AND p.is_active = true
    -- Tekli kategori filtresi (eski davranış, geriye dönük uyumlu)
    AND (p_category IS NULL OR p.category = p_category)
    -- Çoklu kategori filtresi: IN mantığı (= ANY ile OR)
    AND (p_categories IS NULL OR p.category = ANY(p_categories))
    AND (p_emergency_only = false OR p.is_emergency = true)
    AND (p_tags IS NULL OR p.tags @> p_tags)
  ORDER BY ranking_score DESC
  LIMIT p_limit;
$$;
