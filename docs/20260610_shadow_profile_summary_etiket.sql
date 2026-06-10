-- ============================================================
-- shadow_profile_summary view — etiket kolonu eklendi
-- Tarih: 2026-06-10
-- Sorun: View, etiket kolonu shadow_profiles'a eklendikten sonra
--        yeniden oluşturulmadığı için etiket her zaman NULL dönüyordu.
-- ============================================================

-- CREATE OR REPLACE kolon sırasını değiştiremez; DROP + CREATE gerekli
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
  sp.created_at,
  sp.updated_at,
  COUNT(l.id)::int                              AS listing_count,
  MAX(l.created_at)                             AS last_listing_at,
  MIN(l.created_at)                             AS first_listing_at
FROM public.shadow_profiles sp
LEFT JOIN public.listings l ON l.shadow_profile_id = sp.id
GROUP BY sp.id;

GRANT SELECT ON public.shadow_profile_summary TO authenticated;
