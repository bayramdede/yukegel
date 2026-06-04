-- ============================================================
-- Radar Intelligence RPC: get_radar_intelligence
-- Tarih: 2026-06-04
-- Modül: Admin Radar & İstihbarat Paneli
--
-- Kullanım:
--   SELECT get_radar_intelligence('İzmir', 'İstanbul', 30);
--
-- Parametreler:
--   p_from_city  — kalkış ili (ILIKE ile eşleştirilir)
--   p_to_city    — varış ili  (ILIKE ile eşleştirilir)
--   p_days       — kaç gün geriye bakılsın (default: 30)
--
-- Dönen JSONB:
--   { route_stats: {...}, leads: [{...}] }
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_radar_intelligence(
  p_from_city text,
  p_to_city   text,
  p_days      int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_days::text || ' days')::interval;
  v_stats  jsonb;
  v_leads  jsonb;
BEGIN
  -- ── 1. Route İstatistikleri (son p_days gün) ─────────────────────────────
  SELECT jsonb_build_object(
    'total_listings_last_30_days', COUNT(DISTINCT l.id),
    'unique_publishers',
      COUNT(DISTINCT
        CASE
          WHEN l.contact_phone LIKE '+%' THEN l.contact_phone
          WHEN l.contact_phone LIKE '0%' THEN '+90' || substr(l.contact_phone, 2)
          WHEN l.contact_phone IS NOT NULL THEN '+90' || l.contact_phone
          ELSE NULL
        END
      )
  )
  INTO v_stats
  FROM public.listings l
  WHERE l.created_at >= v_cutoff
    AND l.origin_city ILIKE '%' || p_from_city || '%'
    AND EXISTS (
      SELECT 1 FROM public.listing_stops ls
      WHERE ls.listing_id = l.id
        AND ls.city ILIKE '%' || p_to_city || '%'
    );

  -- ── 2. Lead Analizi (tüm zamanlar + son p_days hacim hesabı) ─────────────
  WITH route_listings AS (
    -- Rota koşulunu sağlayan tüm ilanlar (tüm zamanlar, tüm durum/mod)
    SELECT
      l.id,
      l.created_at,
      l.raw_text,
      l.vehicle_type,
      l.user_id,
      l.shadow_profile_id,
      -- Telefonu +90 formatına normalize et
      CASE
        WHEN l.contact_phone IS NULL     THEN NULL
        WHEN l.contact_phone LIKE '+%'   THEN l.contact_phone
        WHEN l.contact_phone LIKE '0%'   THEN '+90' || substr(l.contact_phone, 2)
        ELSE '+90' || l.contact_phone
      END AS norm_phone
    FROM public.listings l
    WHERE l.origin_city ILIKE '%' || p_from_city || '%'
      AND EXISTS (
        SELECT 1 FROM public.listing_stops ls
        WHERE ls.listing_id = l.id
          AND ls.city ILIKE '%' || p_to_city || '%'
      )
  ),

  phone_groups AS (
    SELECT
      norm_phone,
      -- Toplam (tüm zamanlar)
      COUNT(*)                                                               AS total_loads,
      -- Son p_days içindeki yük sayısı
      COUNT(*) FILTER (WHERE created_at >= v_cutoff)                         AS recent_loads,
      -- Son p_days içinde kaç farklı günde ilan atıldı (frekans tespiti)
      COUNT(DISTINCT DATE(created_at)) FILTER (WHERE created_at >= v_cutoff) AS unique_active_days,
      MAX(created_at)                                                        AS last_listing_at,
      -- Kontrat anahtar kelime tespiti (raw_text NLP)
      BOOL_OR(
        raw_text ILIKE ANY(ARRAY[
          '%düzenli%', '%proje%', '%aylık%', '%haftalık%',
          '%her gün%', '%her hafta%', '%sözleşmeli%',
          '%ihale%', '%kontrat%', '%periyodik%'
        ])
      )                                                                      AS has_contract_keywords,
      -- En son 5 ham mesaj (geçmiş analizi için)
      (ARRAY_AGG(raw_text ORDER BY created_at DESC)
         FILTER (WHERE raw_text IS NOT NULL))[1:5]                           AS recent_raw_texts,
      MAX(shadow_profile_id)                                                 AS shadow_profile_id,
      MAX(user_id)                                                           AS reg_user_id
    FROM route_listings
    WHERE norm_phone IS NOT NULL
    GROUP BY norm_phone
  ),

  enriched AS (
    SELECT
      pg.*,
      sp.id             AS sp_id,
      sp.name           AS sp_name,
      sp.company_name   AS sp_company,
      sp.etiket         AS sp_etiket,
      u.display_name    AS u_display_name,
      u.company_name    AS u_company,
      -- Sınıflandırma: 8+ farklı günde ilan VEYA metinde kontrat kelimesi
      CASE
        WHEN pg.unique_active_days >= 8 OR pg.has_contract_keywords
          THEN 'CONTRACT_POTENTIAL'
        ELSE 'SPOT'
      END AS classification,
      -- Etiketler (tags dizisi olarak döner)
      ARRAY_REMOVE(
        ARRAY[
          CASE WHEN pg.total_loads >= 10 OR pg.unique_active_days >= 5
            THEN '🔥 Yüksek Hacim' END,
          CASE WHEN pg.has_contract_keywords
            THEN '🏷️ Metinde Düzenlilik Var' END,
          CASE WHEN pg.unique_active_days >= 8
            THEN '📅 Sürekli Aktif' END
        ],
        NULL
      ) AS tags
    FROM phone_groups pg
    LEFT JOIN public.shadow_profiles sp ON sp.phone = pg.norm_phone
    LEFT JOIN public.users u ON u.id = pg.reg_user_id::uuid
  )

  SELECT
    jsonb_agg(
      jsonb_build_object(
        'phone',              norm_phone,
        'is_registered',      (reg_user_id IS NOT NULL),
        'display_name',       COALESCE(u_display_name, sp_name),
        'company_name',       COALESCE(u_company, sp_company),
        'etiket',             sp_etiket,
        'shadow_profile_id',  sp_id,
        'route_analytics',    jsonb_build_object(
          'total_loads',         total_loads,
          'recent_loads',        recent_loads,
          'unique_active_days',  unique_active_days,
          'classification',      classification
        ),
        'has_contract_keywords', has_contract_keywords,
        'tags',               to_jsonb(tags),
        'recent_raw_texts',   to_jsonb(COALESCE(recent_raw_texts, ARRAY[]::text[])),
        'last_listing_at',    last_listing_at
      )
      ORDER BY
        CASE WHEN classification = 'CONTRACT_POTENTIAL' THEN 0 ELSE 1 END,
        total_loads DESC
    )
  INTO v_leads
  FROM enriched;

  RETURN jsonb_build_object(
    'route_stats', COALESCE(v_stats, '{}'::jsonb),
    'leads',       COALESCE(v_leads, '[]'::jsonb)
  );
END;
$$;

-- Yetkili kullanıcılara EXECUTE ver (service role bypass eder, bu authenticated için)
GRANT EXECUTE ON FUNCTION public.get_radar_intelligence(text, text, int) TO authenticated;

-- ── İndeks önerileri (performans için çalıştır) ────────────────────────────
-- listing_stops.city üzerinde zaten index yoksa:
CREATE INDEX IF NOT EXISTS listing_stops_city_idx ON public.listing_stops (city);

-- listings.origin_city + created_at bileşik index:
CREATE INDEX IF NOT EXISTS listings_origin_city_created_at_idx
  ON public.listings (origin_city, created_at DESC);

-- listings.contact_phone index:
CREATE INDEX IF NOT EXISTS listings_contact_phone_idx
  ON public.listings (contact_phone)
  WHERE contact_phone IS NOT NULL;
