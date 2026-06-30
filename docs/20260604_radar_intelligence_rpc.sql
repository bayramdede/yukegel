-- ============================================================
-- Radar Intelligence RPC: get_radar_intelligence
-- Tarih: 2026-06-04  (v3: MATERIALIZED CTE + JOIN, timeout fix)
-- Modül: Admin Radar & İstihbarat Paneli
--
-- Kullanım:
--   SELECT get_radar_intelligence('İzmir', 'İstanbul', 30);  -- rota
--   SELECT get_radar_intelligence('Tekirdağ', NULL, 30);     -- sadece kalkış
--   SELECT get_radar_intelligence(NULL, 'İstanbul', 30);     -- sadece varış
--
-- Parametreler:
--   p_from_city  — kalkış ili (NULL veya '' → filtre uygulanmaz)
--   p_to_city    — varış ili  (NULL veya '' → filtre uygulanmaz)
--   p_days       — kaç gün geriye bakılsın (default: 30)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_radar_intelligence(
  p_from_city text DEFAULT NULL,
  p_to_city   text DEFAULT NULL,
  p_days      int  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff    timestamptz := now() - (p_days::text || ' days')::interval;
  v_from      text        := NULLIF(trim(p_from_city), '');
  v_to        text        := NULLIF(trim(p_to_city), '');
  v_stats     jsonb;
  v_leads     jsonb;
BEGIN
  -- En az biri dolu olmalı
  IF v_from IS NULL AND v_to IS NULL THEN
    RETURN jsonb_build_object('error', 'En az kalkış veya varış ili girilmeli');
  END IF;

  -- ── 1. Route İstatistikleri ────────────────────────────────────────────
  -- Varış filtresi için önce matching listing ID'lerini topla (MATERIALIZED)
  -- Böylece her satır için ayrı EXISTS sorgusu gitmez.
  WITH dest_ids AS MATERIALIZED (
    SELECT DISTINCT listing_id
    FROM public.listing_stops
    WHERE v_to IS NOT NULL
      AND city ILIKE '%' || v_to || '%'
  )
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
  LEFT JOIN dest_ids d ON d.listing_id = l.id
  WHERE l.created_at >= v_cutoff
    AND (v_from IS NULL OR l.origin_city ILIKE '%' || v_from || '%')
    AND (v_to IS NULL OR d.listing_id IS NOT NULL);

  -- ── 2. Lead Analizi ────────────────────────────────────────────────────
  WITH
  -- Varış iline uyan listing ID'leri bir kez tara (trgm index kullanır)
  dest_ids AS MATERIALIZED (
    SELECT DISTINCT listing_id
    FROM public.listing_stops
    WHERE v_to IS NOT NULL
      AND city ILIKE '%' || v_to || '%'
  ),

  -- Son 365 gündeki rota ilanları — LEFT JOIN ile EXISTS'ten kurtul
  route_listings AS (
    SELECT
      l.id,
      l.created_at,
      l.raw_text,
      l.vehicle_type,
      l.user_id,
      l.shadow_profile_id,
      CASE
        WHEN l.contact_phone IS NULL   THEN NULL
        WHEN l.contact_phone LIKE '+%' THEN l.contact_phone
        WHEN l.contact_phone LIKE '0%' THEN '+90' || substr(l.contact_phone, 2)
        ELSE '+90' || l.contact_phone
      END AS norm_phone
    FROM public.listings l
    LEFT JOIN dest_ids d ON d.listing_id = l.id
    WHERE
      l.created_at >= now() - interval '365 days'
      AND (v_from IS NULL OR l.origin_city ILIKE '%' || v_from || '%')
      AND (v_to IS NULL OR d.listing_id IS NOT NULL)
  ),

  phone_groups AS (
    SELECT
      norm_phone,
      COUNT(*)                                                               AS total_loads,
      COUNT(*) FILTER (WHERE created_at >= v_cutoff)                         AS recent_loads,
      COUNT(DISTINCT DATE(created_at)) FILTER (WHERE created_at >= v_cutoff) AS unique_active_days,
      MAX(created_at)                                                        AS last_listing_at,
      BOOL_OR(
        raw_text ILIKE ANY(ARRAY[
          '%düzenli%', '%proje%', '%aylık%', '%haftalık%',
          '%her gün%', '%her hafta%', '%sözleşmeli%',
          '%ihale%', '%kontrat%', '%periyodik%'
        ])
      )                                                                      AS has_contract_keywords,
      (ARRAY_AGG(raw_text ORDER BY created_at DESC)
         FILTER (WHERE raw_text IS NOT NULL))[1:5]                           AS recent_raw_texts,
      (ARRAY_AGG(shadow_profile_id) FILTER (WHERE shadow_profile_id IS NOT NULL))[1]
                                                                             AS shadow_profile_id,
      (ARRAY_AGG(user_id) FILTER (WHERE user_id IS NOT NULL))[1]
                                                                             AS reg_user_id
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
      CASE
        WHEN pg.unique_active_days >= 8 OR pg.has_contract_keywords
          THEN 'CONTRACT_POTENTIAL'
        ELSE 'SPOT'
      END AS classification,
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
    LEFT JOIN public.users u ON u.id = pg.reg_user_id
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
          'total_loads',        total_loads,
          'recent_loads',       recent_loads,
          'unique_active_days', unique_active_days,
          'classification',     classification
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

GRANT EXECUTE ON FUNCTION public.get_radar_intelligence(text, text, int) TO authenticated;

-- ── Performans indexleri ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS listing_stops_listing_id_idx
  ON public.listing_stops (listing_id);

CREATE INDEX IF NOT EXISTS listings_origin_city_created_at_idx
  ON public.listings (origin_city, created_at DESC);

CREATE INDEX IF NOT EXISTS listings_contact_phone_idx
  ON public.listings (contact_phone)
  WHERE contact_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS listings_created_at_idx
  ON public.listings (created_at DESC);

-- pg_trgm: ILIKE '%...%' sorgularını hızlandırır
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS listings_origin_city_trgm_idx
  ON public.listings USING GIN (origin_city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS listing_stops_city_trgm_idx
  ON public.listing_stops USING GIN (city gin_trgm_ops);
