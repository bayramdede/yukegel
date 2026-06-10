-- ============================================================
-- shadow_profiles.listing_count — denormalize + trigger
-- Tarih: 2026-06-10
-- Sorun: shadow_profile_summary view'ı her sorguda listings
--        tablosunun tamamını tarayıp GROUP BY yapıyordu.
--        Listings büyüdükçe (~8s) Supabase statement timeout aşıldı.
-- Çözüm: listing_count kolonunu shadow_profiles üzerinde tut,
--        trigger ile güncel tut, view'da sp.listing_count kullan.
--        Böylece view GROUP BY yapmaz, index ile anında sıralar.
-- ============================================================

-- ── 1. Kolon ekle ─────────────────────────────────────────────

ALTER TABLE public.shadow_profiles
  ADD COLUMN IF NOT EXISTS listing_count integer NOT NULL DEFAULT 0;

-- ── 2. Backfill ───────────────────────────────────────────────

UPDATE public.shadow_profiles sp
SET listing_count = (
  SELECT COUNT(*)
  FROM public.listings l
  WHERE l.shadow_profile_id = sp.id
);

-- ── 3. İndeks: listing_count DESC sıralaması için ─────────────

CREATE INDEX IF NOT EXISTS idx_shadow_profiles_listing_count
  ON public.shadow_profiles (listing_count DESC);

-- ── 4. Trigger: listings INSERT/DELETE/UPDATE'da sayacı güncelle

CREATE OR REPLACE FUNCTION public.sync_shadow_profile_listing_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.shadow_profile_id IS NOT NULL THEN
      UPDATE public.shadow_profiles
        SET listing_count = listing_count + 1
        WHERE id = NEW.shadow_profile_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.shadow_profile_id IS NOT NULL THEN
      UPDATE public.shadow_profiles
        SET listing_count = GREATEST(0, listing_count - 1)
        WHERE id = OLD.shadow_profile_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- shadow_profile_id değiştiyse eski sayacı azalt, yenisini artır
    IF OLD.shadow_profile_id IS DISTINCT FROM NEW.shadow_profile_id THEN
      IF OLD.shadow_profile_id IS NOT NULL THEN
        UPDATE public.shadow_profiles
          SET listing_count = GREATEST(0, listing_count - 1)
          WHERE id = OLD.shadow_profile_id;
      END IF;
      IF NEW.shadow_profile_id IS NOT NULL THEN
        UPDATE public.shadow_profiles
          SET listing_count = listing_count + 1
          WHERE id = NEW.shadow_profile_id;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_listings_shadow_profile_count ON public.listings;
CREATE TRIGGER trg_listings_shadow_profile_count
  AFTER INSERT OR DELETE OR UPDATE OF shadow_profile_id
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shadow_profile_listing_count();

-- ── 5. View'ı yeniden oluştur ─────────────────────────────────
-- GROUP BY kaldırıldı: listing_count artık sp üzerinden geliyor.
-- last/first_listing_at yalnızca LIMIT 50 sonrası 50 satır için
-- correlated subquery ile hesaplanır — tüm tablo taranmaz.

DROP VIEW IF EXISTS public.shadow_profile_summary;

CREATE VIEW public.shadow_profile_summary AS
SELECT
  sp.id,
  sp.phone,
  sp.name,
  sp.company_name,
  sp.notes,
  sp.status,
  sp.etiket,
  sp.converted_user_id,
  sp.listing_count,
  sp.created_at,
  sp.updated_at,
  (SELECT MAX(l.created_at) FROM public.listings l
     WHERE l.shadow_profile_id = sp.id) AS last_listing_at,
  (SELECT MIN(l.created_at) FROM public.listings l
     WHERE l.shadow_profile_id = sp.id) AS first_listing_at
FROM public.shadow_profiles sp;

GRANT SELECT ON public.shadow_profile_summary TO authenticated;
