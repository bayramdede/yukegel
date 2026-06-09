-- ============================================================
-- Radar Analitik — Performans İndeksleri + Optimize RPC
-- Tarih: 2026-06-09
-- Sorun: ILIKE '%city%' → leading wildcard → seq scan → timeout
-- Çözüm: lower() functional index + exact match
-- ============================================================

-- ── 1. İndeksler ─────────────────────────────────────────────────────────

-- listings: lower(origin_city) + created_at composite
CREATE INDEX IF NOT EXISTS idx_listings_origin_city_lower
  ON public.listings (lower(origin_city), created_at DESC);

-- listing_stops: lower(city) + listing_id
CREATE INDEX IF NOT EXISTS idx_listing_stops_city_lower
  ON public.listing_stops (lower(city), listing_id);

-- listing_stops: listing_id (JOIN için)
CREATE INDEX IF NOT EXISTS idx_listing_stops_listing_id
  ON public.listing_stops (listing_id);


-- ── 2. get_radar_city_overview — lower() exact match ─────────────────────
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


-- ── 3. get_radar_city_detail — leading wildcard kaldırıldı ───────────────
CREATE OR REPLACE FUNCTION public.get_radar_city_detail(
  p_city        text,
  p_direction   text DEFAULT 'departure',
  p_days        int  DEFAULT 30,
  p_counterpart text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_cutoff        timestamptz := now() - (p_days::text || ' days')::interval;
  v_city_lower    text        := lower(p_city);
  v_cpart_lower   text        := lower(p_counterpart);
  v_total         bigint;
  v_senders       bigint;
  v_counterparts  jsonb;
  v_vehicle_types jsonb;
  v_daily         jsonb;
BEGIN

  -- ════════════════════════════════════════════════════════════
  -- DEPARTURE
  -- ════════════════════════════════════════════════════════════
  IF p_direction = 'departure' THEN

    IF p_counterpart IS NULL THEN

      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      WHERE lower(l.origin_city) = v_city_lower
        AND l.created_at >= v_cutoff;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('city', to_city, 'count', cnt, 'senders', snds)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_counterparts
      FROM (
        SELECT
          ls.city                         AS to_city,
          COUNT(DISTINCT l.id)            AS cnt,
          COUNT(DISTINCT l.contact_phone) AS snds
        FROM public.listings l
        JOIN public.listing_stops ls ON ls.listing_id = l.id
        WHERE lower(l.origin_city) = v_city_lower
          AND l.created_at >= v_cutoff
        GROUP BY ls.city
        ORDER BY cnt DESC
        LIMIT 20
      ) sub;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', vt, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_vehicle_types
      FROM (
        SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
        FROM public.listings l
        WHERE lower(l.origin_city) = v_city_lower
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

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
        WHERE lower(l.origin_city) = v_city_lower
          AND l.created_at >= v_cutoff
        GROUP BY DATE(l.created_at)
        ORDER BY DATE(l.created_at)
      ) sub;

    ELSE
      -- Rota bazlı: p_city → p_counterpart

      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE lower(l.origin_city) = v_city_lower
        AND lower(ls.city) = v_cpart_lower
        AND l.created_at >= v_cutoff;

      v_counterparts := '[]'::jsonb;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', vt, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_vehicle_types
      FROM (
        SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
        FROM public.listings l
        JOIN public.listing_stops ls ON ls.listing_id = l.id
        WHERE lower(l.origin_city) = v_city_lower
          AND lower(ls.city) = v_cpart_lower
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

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
        WHERE lower(l.origin_city) = v_city_lower
          AND lower(ls.city) = v_cpart_lower
          AND l.created_at >= v_cutoff
        GROUP BY DATE(l.created_at)
        ORDER BY DATE(l.created_at)
      ) sub;

    END IF;

  -- ════════════════════════════════════════════════════════════
  -- ARRIVAL
  -- ════════════════════════════════════════════════════════════
  ELSE

    IF p_counterpart IS NULL THEN

      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE lower(ls.city) = v_city_lower
        AND l.created_at >= v_cutoff;

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
        WHERE lower(ls.city) = v_city_lower
          AND l.created_at >= v_cutoff
          AND l.origin_city IS NOT NULL
        GROUP BY l.origin_city
        ORDER BY cnt DESC
        LIMIT 20
      ) sub;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', vt, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_vehicle_types
      FROM (
        SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
        FROM public.listings l
        JOIN public.listing_stops ls ON ls.listing_id = l.id
        WHERE lower(ls.city) = v_city_lower
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

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
        WHERE lower(ls.city) = v_city_lower
          AND l.created_at >= v_cutoff
        GROUP BY DATE(l.created_at)
        ORDER BY DATE(l.created_at)
      ) sub;

    ELSE
      -- Rota bazlı: p_counterpart → p_city

      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE lower(ls.city) = v_city_lower
        AND lower(l.origin_city) = v_cpart_lower
        AND l.created_at >= v_cutoff;

      v_counterparts := '[]'::jsonb;

      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', vt, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_vehicle_types
      FROM (
        SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
        FROM public.listings l
        JOIN public.listing_stops ls ON ls.listing_id = l.id
        WHERE lower(ls.city) = v_city_lower
          AND lower(l.origin_city) = v_cpart_lower
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

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
        WHERE lower(ls.city) = v_city_lower
          AND lower(l.origin_city) = v_cpart_lower
          AND l.created_at >= v_cutoff
        GROUP BY DATE(l.created_at)
        ORDER BY DATE(l.created_at)
      ) sub;

    END IF;

  END IF;

  RETURN jsonb_build_object(
    'city',           p_city,
    'direction',      p_direction,
    'counterpart',    p_counterpart,
    'total',          v_total,
    'unique_senders', v_senders,
    'counterparts',   v_counterparts,
    'vehicle_types',  v_vehicle_types,
    'daily',          v_daily
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_radar_city_detail(text, text, int, text) TO authenticated;
