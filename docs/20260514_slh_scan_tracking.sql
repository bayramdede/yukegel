-- SLH: raw_posts tarama takibi
-- 14 Mayıs 2026

ALTER TABLE raw_posts
  ADD COLUMN IF NOT EXISTS slh_scanned_at TIMESTAMPTZ;

-- Henüz taranmamış no_lane kayıtları için index
CREATE INDEX IF NOT EXISTS idx_raw_posts_slh_unscanned
  ON raw_posts (processing_status, slh_scanned_at)
  WHERE processing_status = 'no_lane' AND slh_scanned_at IS NULL;
