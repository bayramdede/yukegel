-- ============================================================
-- Radar Analitik RPC Fonksiyonları
-- Tarih: 2026-06-04
-- Modül: Admin Radar Analitik Dashboard
-- ============================================================

-- ── 1. Şehir Genel Bakış ─────────────────────────────────────────────────
-- Tüm kalkış şehirlerini ilan sayısıyla döner (sol panel için)
CREATE OR REPLACE FUNCTION public.get_radar_city_overview(
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'city',           origin_city,
        'listing_count',  listing_count,
        'unique_senders', unique_senders,
        'last_at',        last_at
      )
      ORDER BY listing_count DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      origin_city,
      COUNT(DISTINCT id)            AS listing_count,
      COUNT(DISTINCT contact_phone) AS unique_senders,
      MAX(created_at)               AS last_at
    FROM public.listings
    WHERE
      created_at >= now() - (p_days::text || ' days')::interval
      AND origin_city IS NOT NULL
      AND origin_city <> ''
    GROUP BY origin_city
    ORDER BY listing_count DESC
    LIMIT 60
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_radar_city_overview(int) TO authenticated;


-- ── 2. Şehir Detay ────────────────────────────────────────────────────────
-- Seçili şehrin varış/çıkış dağılımı + araç tipi breakdown
--
-- p_direction:
--   'departure' → Şehirden çıkan ilanlar: varış dağılımını gösterir
--   'arrival'   → Şehre gelen ilanlar: kalkış dağılımını gösterir
CREATE OR REPLACE FUNCTION public.get_radar_city_detail(
  p_city      text,
  p_direction text DEFAULT 'departure',
  p_days      int  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cutoff       timestamptz := now() - (p_days::text || ' days')::interval;
  v_total        bigint;
  v_senders      bigint;
  v_counterparts jsonb;
  v_vehicle_types jsonb;
  v_daily        jsonb;
BEGIN
  IF p_direction = 'departure' THEN
    -- ── Çıkış: Antalya'dan nereye? ──────────────────────────────────────

    SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
    INTO v_total, v_senders
    FROM public.listings l
    WHERE l.origin_city ILIKE '%' || p_city || '%'
      AND l.created_at >= v_cutoff;

    -- Varış şehirleri
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('city', to_city, 'count', cnt, 'senders', snds)
      ORDER BY cnt DESC
    ), '[]'::jsonb)
    INTO v_counterparts
    FROM (
      SELECT
        ls.city                       AS to_city,
        COUNT(DISTINCT l.id)          AS cnt,
        COUNT(DISTINCT l.contact_phone) AS snds
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE l.origin_city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
      GROUP BY ls.city
      ORDER BY cnt DESC
      LIMIT 20
    ) sub;

  ELSE
    -- ── Varış: Antalya'ya nereden geliyor? ──────────────────────────────

    SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
    INTO v_total, v_senders
    FROM public.listings l
    JOIN public.listing_stops ls ON ls.listing_id = l.id
    WHERE ls.city ILIKE '%' || p_city || '%'
      AND l.created_at >= v_cutoff;

    -- Kalkış şehirleri
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('city', from_city, 'count', cnt, 'senders', snds)
      ORDER BY cnt DESC
    ), '[]'::jsonb)
    INTO v_counterparts
    FROM (
      SELECT
        l.origin_city                   AS from_city,
        COUNT(DISTINCT l.id)            AS cnt,
        COUNT(DISTINCT l.contact_phone) AS snds
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE ls.city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
        AND l.origin_city IS NOT NULL
      GROUP BY l.origin_city
      ORDER BY cnt DESC
      LIMIT 20
    ) sub;

  END IF;

  -- ── Araç tipi dağılımı (her iki yönde aynı) ────────────────────────────
  IF p_direction = 'departure' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('type', vt, 'count', cnt)
      ORDER BY cnt DESC
    ), '[]'::jsonb)
    INTO v_vehicle_types
    FROM (
      SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
      FROM public.listings l
      WHERE l.origin_city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
        AND l.vehicle_type IS NOT NULL
      GROUP BY vt
      ORDER BY cnt DESC
      LIMIT 12
    ) sub;
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('type', vt, 'count', cnt)
      ORDER BY cnt DESC
    ), '[]'::jsonb)
    INTO v_vehicle_types
    FROM (
      SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE ls.city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
        AND l.vehicle_type IS NOT NULL
      GROUP BY vt
      ORDER BY cnt DESC
      LIMIT 12
    ) sub;
  END IF;

  -- ── Günlük aktivite (son 30 gün, sparkline için) ───────────────────────
  IF p_direction = 'departure' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('day', day_str, 'count', cnt)
      ORDER BY day_str
    ), '[]'::jsonb)
    INTO v_daily
    FROM (
      SELECT
        TO_CHAR(DATE(l.created_at), 'MM-DD') AS day_str,
        COUNT(DISTINCT l.id)                  AS cnt
      FROM public.listings l
      WHERE l.origin_city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
      GROUP BY DATE(l.created_at)
      ORDER BY DATE(l.created_at)
    ) sub;
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('day', day_str, 'count', cnt)
      ORDER BY day_str
    ), '[]'::jsonb)
    INTO v_daily
    FROM (
      SELECT
        TO_CHAR(DATE(l.created_at), 'MM-DD') AS day_str,
        COUNT(DISTINCT l.id)                  AS cnt
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE ls.city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff
      GROUP BY DATE(l.created_at)
      ORDER BY DATE(l.created_at)
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'city',          p_city,
    'direction',     p_direction,
    'total',         v_total,
    'unique_senders', v_senders,
    'counterparts',  v_counterparts,
    'vehicle_types', v_vehicle_types,
    'daily',         v_daily
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_radar_city_detail(text, text, int) TO authenticated;
