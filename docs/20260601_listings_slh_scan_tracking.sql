-- listings tablosuna SLH tarama takibi
-- raw_posts.slh_scanned_at ile aynı mantık:
-- NULL = SLH hiç taramadı, dolu = LLM gördü, tekrar gönderilmez

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS slh_scanned_at timestamptz;

COMMENT ON COLUMN listings.slh_scanned_at IS
  'Smart Learning Hub tarama zamanı. NULL = taranmadı; dolu = LLM bu ilanı gördü.';

CREATE INDEX IF NOT EXISTS idx_listings_slh_scanned_at
  ON listings (slh_scanned_at)
  WHERE slh_scanned_at IS NULL;
