-- ============================================================
-- Smart Learning Hub (SLH) — Aliases tablo genişletme
-- 14 Mayıs 2026
-- ============================================================

-- 1. aliases tablosuna AI takip kolonları ekle
ALTER TABLE aliases
  ADD COLUMN IF NOT EXISTS created_by_ai      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_approved        BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llm_confidence     SMALLINT    CHECK (llm_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS source_listing_ids TEXT[]      DEFAULT '{}';
-- source_listing_ids: bu alias'ın hangi no_lane raw_post'larından öğrenildiğini tutar

-- 2. Bekleyen AI önerileri için index
CREATE INDEX IF NOT EXISTS idx_aliases_pending
  ON aliases (created_by_ai, is_approved)
  WHERE created_by_ai = true AND is_approved = false;

-- 3. no_lane raw_posts için index (zaten processing_status kolonu var)
CREATE INDEX IF NOT EXISTS idx_raw_posts_no_lane
  ON raw_posts (processing_status, created_at DESC)
  WHERE processing_status = 'no_lane';

-- 4. listings origin_city NULL için index
CREATE INDEX IF NOT EXISTS idx_listings_no_origin
  ON listings (origin_city, created_at DESC)
  WHERE origin_city IS NULL;

-- ÖNEMLİ:
-- Mevcut aliases kayıtları created_by_ai=false, is_approved=true (default) olarak kalır.
-- Yeni AI önerileri is_approved=false ile INSERT edilir.
-- Admin onayladığında is_approved=true + approved_by + approved_at set edilir.
-- Admin reddettiğinde kaydı siler.
