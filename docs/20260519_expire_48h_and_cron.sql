-- ============================================================
-- expires_at: 7 gün → 48 saat + aktif ilan expire cron job
-- Tarih: 19 Mayıs 2026
-- ============================================================

-- 1. listings tablosunun expires_at default'unu 48 saate düşür
ALTER TABLE public.listings
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '48 hours');

-- 2. Mevcut eski aktif ilanları pasife al (tek seferlik migration)
UPDATE public.listings
SET
  status            = 'passive',
  moderation_status = CASE
    WHEN moderation_status IN ('approved', 'auto_published') THEN 'passive'
    ELSE moderation_status
  END,
  updated_at        = now()
WHERE
  status = 'active'
  AND created_at < now() - INTERVAL '48 hours';

-- 3. pg_cron job: her 15 dakikada expires_at geçmiş aktif ilanları pasife al
SELECT cron.unschedule('expire-active-listings')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-active-listings'
);

SELECT cron.schedule(
  'expire-active-listings',
  '*/15 * * * *',
  $$
    UPDATE public.listings
    SET
      status            = 'passive',
      moderation_status = CASE
        WHEN moderation_status IN ('approved', 'auto_published') THEN 'passive'
        ELSE moderation_status
      END,
      updated_at        = now()
    WHERE
      status = 'active'
      AND expires_at < now();
  $$
);

-- 4. Performans indeksi: aktif ilan feed sorgusu için partial index
CREATE INDEX IF NOT EXISTS idx_listings_active_feed
  ON public.listings (moderation_status, created_at DESC)
  WHERE status = 'active' AND is_shadow_banned = false;

-- Doğrulama
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-active-listings';
SELECT count(*) AS aktif_ilan_sayisi FROM listings WHERE status = 'active';
