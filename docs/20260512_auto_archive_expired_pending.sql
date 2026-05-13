-- ============================================================
-- Auto-archive expired pending listings
-- 24 saatten eski pending ilanları arşive alır
-- Tarih: 12 Mayıs 2026
-- ============================================================

-- pg_cron aktif değilse etkinleştir (zaten aktifse hata vermez)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Varsa önceki job'ı temizle
SELECT cron.unschedule('archive-expired-pending-listings')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'archive-expired-pending-listings'
);

-- Her saat başı çalışır: pending + 24 saatten eski → archived
SELECT cron.schedule(
  'archive-expired-pending-listings',
  '0 * * * *',  -- her saat başı
  $$
    UPDATE public.listings
    SET
      moderation_status = 'archived',
      updated_at        = now()
    WHERE
      moderation_status = 'pending'
      AND created_at < now() - INTERVAL '24 hours';
  $$
);

-- Doğrulama: job kayıtlı mı?
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'archive-expired-pending-listings';
