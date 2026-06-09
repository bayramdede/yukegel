-- ============================================================
-- Radar Analitik RPC — Counterpart (Rota) Filtresi
-- Tarih: 2026-06-09
-- Modül: Admin Radar Analitik Dashboard
-- Değişiklik: get_radar_city_detail'e p_counterpart eklendi.
--   Seçili varış/kalkış noktasına göre araç tipi dağılımı
--   ve günlük aktivite verisini rota bazlı filtreler.
-- ============================================================

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
  v_total         bigint;
  v_senders       bigint;
  v_counterparts  jsonb;
  v_vehicle_types jsonb;
  v_daily         jsonb;
BEGIN

  -- ════════════════════════════════════════════════════════════
  -- DEPARTURE (çıkış): p_city şehirden çıkan ilanlar
  -- ════════════════════════════════════════════════════════════
  IF p_direction = 'departure' THEN

    IF p_counterpart IS NULL THEN
      -- Tüm çıkışlar
      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      WHERE l.origin_city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff;

      -- Varış şehirleri listesi
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
        WHERE l.origin_city ILIKE '%' || p_city || '%'
          AND l.created_at >= v_cutoff
        GROUP BY ls.city
        ORDER BY cnt DESC
        LIMIT 20
      ) sub;

      -- Araç tipi — şehir geneli
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

      -- Günlük aktivite — şehir geneli
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
      -- Rota bazlı: p_city → p_counterpart
      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE l.origin_city ILIKE '%' || p_city || '%'
        AND ls.city ILIKE '%' || p_counterpart || '%'
        AND l.created_at >= v_cutoff;

      -- Karşı taraf listesi — aynı konumda kalsın (istemci kullanmaz ama boş dönüp hata vermesin)
      v_counterparts := '[]'::jsonb;

      -- Araç tipi — rota bazlı
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', vt, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      INTO v_vehicle_types
      FROM (
        SELECT unnest(l.vehicle_type) AS vt, COUNT(*) AS cnt
        FROM public.listings l
        JOIN public.listing_stops ls ON ls.listing_id = l.id
        WHERE l.origin_city ILIKE '%' || p_city || '%'
          AND ls.city ILIKE '%' || p_counterpart || '%'
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

      -- Günlük aktivite — rota bazlı
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
        WHERE l.origin_city ILIKE '%' || p_city || '%'
          AND ls.city ILIKE '%' || p_counterpart || '%'
          AND l.created_at >= v_cutoff
        GROUP BY DATE(l.created_at)
        ORDER BY DATE(l.created_at)
      ) sub;

    END IF;

  -- ════════════════════════════════════════════════════════════
  -- ARRIVAL (varış): p_city şehre gelen ilanlar
  -- ════════════════════════════════════════════════════════════
  ELSE

    IF p_counterpart IS NULL THEN
      -- Tüm varışlar
      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE ls.city ILIKE '%' || p_city || '%'
        AND l.created_at >= v_cutoff;

      -- Kalkış şehirleri listesi
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

      -- Araç tipi — şehir geneli
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

      -- Günlük aktivite — şehir geneli
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

    ELSE
      -- Rota bazlı: p_counterpart → p_city
      SELECT COUNT(DISTINCT l.id), COUNT(DISTINCT l.contact_phone)
      INTO v_total, v_senders
      FROM public.listings l
      JOIN public.listing_stops ls ON ls.listing_id = l.id
      WHERE ls.city ILIKE '%' || p_city || '%'
        AND l.origin_city ILIKE '%' || p_counterpart || '%'
        AND l.created_at >= v_cutoff;

      v_counterparts := '[]'::jsonb;

      -- Araç tipi — rota bazlı
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
          AND l.origin_city ILIKE '%' || p_counterpart || '%'
          AND l.created_at >= v_cutoff
          AND l.vehicle_type IS NOT NULL
        GROUP BY vt
        ORDER BY cnt DESC
        LIMIT 12
      ) sub;

      -- Günlük aktivite — rota bazlı
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
          AND l.origin_city ILIKE '%' || p_counterpart || '%'
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
