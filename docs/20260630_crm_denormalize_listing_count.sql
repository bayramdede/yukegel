-- ============================================================
-- CRM Performans Düzeltmesi: listing_count denormalizasyonu
-- Tarih: 2026-06-30
-- Sorun: shadow_profile_summary view'ı her sorguda tüm listings
--        tablosunu GROUP BY ile tarayarak statement timeout'a neden oluyor.
-- Çözüm: listing_count/last_listing_at/first_listing_at kolonlarını
--        shadow_profiles'a ekle, trigger ile güncel tut.
--        View artık basit SELECT — aggregation yok.
-- ============================================================

-- 1. Denormalize kolonlar
ALTER TABLE public.shadow_profiles
  ADD COLUMN IF NOT EXISTS listing_count    int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_listing_at  timestamptz,
  ADD COLUMN IF NOT EXISTS first_listing_at timestamptz;

-- 2. Sıralama için index
CREATE INDEX IF NOT EXISTS shadow_profiles_listing_count_idx
  ON public.shadow_profiles (listing_count DESC);

CREATE INDEX IF NOT EXISTS shadow_profiles_last_listing_at_idx
  ON public.shadow_profiles (last_listing_at DESC);

-- 3. Mevcut verileri backfill et
UPDATE public.shadow_profiles sp
SET
  listing_count    = sub.cnt,
  last_listing_at  = sub.last_at,
  first_listing_at = sub.first_at
FROM (
  SELECT
    shadow_profile_id,
    COUNT(*)::int    AS cnt,
    MAX(created_at)  AS last_at,
    MIN(created_at)  AS first_at
  FROM public.listings
  WHERE shadow_profile_id IS NOT NULL
  GROUP BY shadow_profile_id
) sub
WHERE sp.id = sub.shadow_profile_id;

-- 4. Trigger: listings değişince shadow_profiles'ı güncelle
CREATE OR REPLACE FUNCTION public.sync_shadow_profile_listing_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_id := NEW.shadow_profile_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_id := OLD.shadow_profile_id;
  ELSE
    -- UPDATE: shadow_profile_id değiştiyse eski profili de güncelle
    IF OLD.shadow_profile_id IS DISTINCT FROM NEW.shadow_profile_id
       AND OLD.shadow_profile_id IS NOT NULL THEN
      UPDATE public.shadow_profiles
      SET
        listing_count    = (SELECT COUNT(*)::int FROM public.listings WHERE shadow_profile_id = OLD.shadow_profile_id),
        last_listing_at  = (SELECT MAX(created_at)  FROM public.listings WHERE shadow_profile_id = OLD.shadow_profile_id),
        first_listing_at = (SELECT MIN(created_at)  FROM public.listings WHERE shadow_profile_id = OLD.shadow_profile_id)
      WHERE id = OLD.shadow_profile_id;
    END IF;
    v_id := NEW.shadow_profile_id;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.shadow_profiles
    SET
      listing_count    = (SELECT COUNT(*)::int FROM public.listings WHERE shadow_profile_id = v_id),
      last_listing_at  = (SELECT MAX(created_at)  FROM public.listings WHERE shadow_profile_id = v_id),
      first_listing_at = (SELECT MIN(created_at)  FROM public.listings WHERE shadow_profile_id = v_id)
    WHERE id = v_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS listings_sync_shadow_profile_stats ON public.listings;
CREATE TRIGGER listings_sync_shadow_profile_stats
  AFTER INSERT OR UPDATE OF shadow_profile_id OR DELETE
  ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.sync_shadow_profile_listing_stats();

-- 5. View'ı passthrough'a çevir — GROUP BY yok, aggregation yok
DROP VIEW IF EXISTS public.shadow_profile_summary;

CREATE VIEW public.shadow_profile_summary AS
SELECT
  id,
  phone,
  name,
  company_name,
  notes,
  status,
  etiket,
  ai_analiz,
  ai_analiz_at,
  converted_user_id,
  created_at,
  updated_at,
  listing_count,
  last_listing_at,
  first_listing_at
FROM public.shadow_profiles;

GRANT SELECT ON public.shadow_profile_summary TO authenticated;
