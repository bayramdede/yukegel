-- ============================================================
-- CRM View Güncelleme
-- Tarih: 2026-06-30
-- Açıklama: shadow_profile_summary view'ına etiket, ai_analiz,
--            ai_analiz_at kolonları eklendi.
-- NOT: CREATE OR REPLACE mevcut kolon sırasını değiştiremez,
--      bu yüzden önce DROP edip yeniden oluşturuyoruz.
-- ============================================================

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
  sp.ai_analiz,
  sp.ai_analiz_at,
  sp.converted_user_id,
  sp.created_at,
  sp.updated_at,
  COUNT(l.id)::int                              AS listing_count,
  MAX(l.created_at)                             AS last_listing_at,
  MIN(l.created_at)                             AS first_listing_at
FROM public.shadow_profiles sp
LEFT JOIN public.listings l ON l.shadow_profile_id = sp.id
GROUP BY sp.id;

-- Yetkileri koru
GRANT SELECT ON public.shadow_profile_summary TO authenticated;
