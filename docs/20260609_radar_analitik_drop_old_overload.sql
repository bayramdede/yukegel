-- Eski 3-parametreli overload'ı kaldır
-- (4-parametreli versiyon 20260609_radar_analitik_counterpart_filter.sql ile eklendi)
DROP FUNCTION IF EXISTS public.get_radar_city_detail(text, text, integer);
