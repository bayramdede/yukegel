-- ============================================================
-- Yükegel POI Modülü — Google Places Entegrasyon Migration
-- Tarih: 2026-06-15
-- ============================================================
-- Mevcut pois tablosuna Google Places verisi için yeni kolonlar
-- ve TIR/Kamyon servis kategorileri ekleniyor.
-- ============================================================

-- ── 1. Yeni kolonlar ──────────────────────────────────────

-- Google Places kimliği (unique — aynı yer iki kez eklenemesin)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS google_place_id    text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS google_maps_url    text;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS google_rating      float4;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS google_review_count int4;

-- Claude API tarafından üretilen Türkçe yorum özeti (maks 3 cümle)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS reviews_summary    text;

-- Admin onayı (Places API'den gelenler false ile başlar)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS verified           boolean NOT NULL DEFAULT false;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS verified_at        timestamptz;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS verified_by        text;  -- admin kullanıcı e-posta

-- Uydu görüntüsünde tır/kamyon teyidi (admin manuel yapar)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS satellite_confirmed boolean NOT NULL DEFAULT false;

-- Son Places API güncelleme zamanı (periyodik sync için)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS last_synced_at     timestamptz;

-- Kullanıcıya gösterilip gösterilmeyeceği
-- (status=approved + is_active=true olunca yayında)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS is_active          boolean NOT NULL DEFAULT true;

-- ── 2. Unique constraint: aynı google_place_id iki kez eklenemesin ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pois_google_place_id_unique'
  ) THEN
    ALTER TABLE pois ADD CONSTRAINT pois_google_place_id_unique
      UNIQUE (google_place_id);
  END IF;
END $$;

-- ── 3. Kategori CHECK constraint genişlet ─────────────────
-- Mevcut 6 kategori korunuyor, 11 yeni TIR-spesifik kategori ekleniyor

ALTER TABLE pois DROP CONSTRAINT IF EXISTS pois_category_check;

ALTER TABLE pois ADD CONSTRAINT pois_category_check
  CHECK (category IN (
    -- Mevcut (geriye uyumluluk)
    'park_dinlenme',
    'yemek',
    'konaklama',
    'tamirci',
    'tesis_akaryakit',
    'kantar_resmi',
    -- Yeni TIR/Kamyon kategorileri
    'motorcu',        -- Motor ustası
    'elektrikci',     -- Elektrikçi
    'kaportaci',      -- Kaportacı
    'lastikci',       -- Lastikçi
    'dorse_branda',   -- Dorse / Branda ustası
    'frigo_ustasi',   -- Frigo ustası
    'tir_parki',      -- Tır parkı
    'lokanta',        -- Kamyoncu lokantası
    'kantar',         -- Kantar noktası
    'yikama'          -- Yıkama / Yağlama
  ));

-- ── 4. İndeksler ──────────────────────────────────────────

-- Google Place ID araması
CREATE INDEX IF NOT EXISTS pois_google_place_id_idx ON pois (google_place_id);

-- is_active filtresi (public listede sık kullanılır)
CREATE INDEX IF NOT EXISTS pois_is_active_idx ON pois (is_active);

-- Admin onay durumu filtresi
CREATE INDEX IF NOT EXISTS pois_verified_idx ON pois (verified);

-- Kombine: kategori + is_active + status (harita sorgusu)
CREATE INDEX IF NOT EXISTS pois_category_active_status_idx ON pois (category, is_active, status);

-- ── 5. RLS politikası güncellemesi ───────────────────────
-- Public select: artık is_active=true da şart

DROP POLICY IF EXISTS "pois_select_approved" ON pois;

CREATE POLICY "pois_select_approved"
  ON pois FOR SELECT
  USING (status = 'approved' AND is_active = true);

-- ── 6. get_pois_in_bbox RPC güncelle ─────────────────────
-- is_active filtresi ekleniyor

CREATE OR REPLACE FUNCTION get_pois_in_bbox(
  p_min_lng      double precision,
  p_min_lat      double precision,
  p_max_lng      double precision,
  p_max_lat      double precision,
  p_category     text DEFAULT NULL,
  p_tags         text[] DEFAULT NULL,
  p_emergency_only boolean DEFAULT false,
  p_user_lat     double precision DEFAULT NULL,
  p_user_lng     double precision DEFAULT NULL,
  p_limit        integer DEFAULT 50
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
    AND p.is_active = true                         -- YENİ: is_active filtresi
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_emergency_only = false OR p.is_emergency = true)
    AND (p_tags IS NULL OR p.tags @> p_tags)
  ORDER BY ranking_score DESC
  LIMIT p_limit;
$$;
