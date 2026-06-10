-- ============================================================
-- Yükegel POI Modülü (Yol Rehberi) — Migration
-- Tarih: 2026-06-10
-- ============================================================

-- 1. PostGIS etkinleştir (Supabase'de genellikle zaten aktif, hata verirse atla)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. pois tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS pois (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  category      text NOT NULL CHECK (category IN (
                  'park_dinlenme',   -- 🅿️ Park & Dinlenme
                  'yemek',           -- 🍲 Yemek
                  'konaklama',       -- 🛏️ Konaklama
                  'tamirci',         -- 🛠️ Tamirci & Usta
                  'tesis_akaryakit', -- ⛽ Tesis & Akaryakıt
                  'kantar_resmi'     -- ⚖️ Kantar & Resmi
                )),
  -- Coğrafi konum (WGS84 - longitude, latitude sırası)
  location      geography(Point, 4326) NOT NULL,
  -- Kolay erişim için ayrı lat/long kolonları
  latitude      double precision NOT NULL,
  longitude     double precision NOT NULL,

  address       text,
  city          text,                     -- Şehir (contextual öneri için)
  phone         text,
  website       text,

  -- Fotoğraflar: ['url1', 'url2', ...]
  photos        text[] DEFAULT '{}',

  -- Özellik etiketleri (esnek)
  -- Örn: ["7/24 Açık", "Tır Park Yeri Var", "Duş İmkanı", "Güvenlik Kameralı"]
  tags          text[] DEFAULT '{}',

  -- Tır uygunluk rozetleri (özel)
  -- Örn: {"dorsesiz_giris": true, "guvenlik_kamerali": true, "agir_vasita_uygun": true}
  badges        jsonb DEFAULT '{}',

  -- Fabrika/depo için tahmini bekleme süresi (dakika)
  estimated_wait_minutes integer,

  -- Nöbetçi tamirci mi? (SOS filtresi için)
  is_emergency  boolean DEFAULT false,

  -- Onay durumu
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Ekleyen kullanıcı (null = admin/sistem)
  added_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ortalama puan (trigger ile güncellenir)
  avg_rating    numeric(3,2) DEFAULT 0,
  review_count  integer DEFAULT 0,

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Coğrafi index (bounding box sorguları için)
CREATE INDEX IF NOT EXISTS pois_location_gix ON pois USING GIST (location);

-- Kategori + durum kombinasyonu (filtreleme)
CREATE INDEX IF NOT EXISTS pois_category_status_idx ON pois (category, status);

-- Şehir bazlı arama (contextual öneri)
CREATE INDEX IF NOT EXISTS pois_city_idx ON pois (city);

-- ============================================================
-- 3. poi_reviews tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS poi_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id          uuid NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Genel puan (1-5)
  rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),

  -- Opsiyonel metin yorum
  comment         text,

  -- Hızlı etiketler (tek tıkla)
  -- Örn: ["Temiz", "Park Yeri Geniş", "Usta Dürüst", "Fiyat Makul"]
  quick_tags      text[] DEFAULT '{}',

  -- Faz 2 hazırlığı: kategoriye özel alt puanlar
  -- Şimdilik boş, Faz 2'de doldurulacak
  -- Örn otel: {"oda_temizligi": 4, "personel": 5}
  -- Örn tamirci: {"fiyat_donuslugu": 3, "is_kalitesi": 5}
  category_ratings jsonb DEFAULT NULL,

  -- Doğrulanmış ziyaret (geo-fence 200m kontrolü)
  is_verified_visit boolean DEFAULT false,

  -- Yorum tipi
  review_type     text DEFAULT 'guest'
                  CHECK (review_type IN ('verified', 'guest')),

  created_at      timestamptz DEFAULT now(),

  -- Aynı kullanıcı aynı POI'ye sadece bir yorum
  UNIQUE (poi_id, user_id)
);

CREATE INDEX IF NOT EXISTS poi_reviews_poi_id_idx ON poi_reviews (poi_id);
CREATE INDEX IF NOT EXISTS poi_reviews_user_id_idx ON poi_reviews (user_id);

-- ============================================================
-- 4. poi_visit_logs — Geo-fence doğrulama için konum geçmişi
-- ============================================================
CREATE TABLE IF NOT EXISTS poi_visit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poi_id      uuid NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  -- Kullanıcının o anki konumu
  user_location geography(Point, 4326) NOT NULL,
  -- POI'ye olan mesafe (metre, trigger ile hesaplanır)
  distance_m  double precision,
  logged_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poi_visit_logs_user_poi_idx ON poi_visit_logs (user_id, poi_id);

-- ============================================================
-- 5. Trigger: pois.avg_rating ve review_count otomatik güncelle
-- ============================================================
CREATE OR REPLACE FUNCTION update_poi_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pois
  SET
    avg_rating   = (SELECT ROUND(AVG(rating)::numeric, 2) FROM poi_reviews WHERE poi_id = COALESCE(NEW.poi_id, OLD.poi_id)),
    review_count = (SELECT COUNT(*) FROM poi_reviews WHERE poi_id = COALESCE(NEW.poi_id, OLD.poi_id)),
    updated_at   = now()
  WHERE id = COALESCE(NEW.poi_id, OLD.poi_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_poi_rating
AFTER INSERT OR UPDATE OR DELETE ON poi_reviews
FOR EACH ROW EXECUTE FUNCTION update_poi_rating();

-- ============================================================
-- 6. RPC: get_pois_in_bbox — Bounding Box sorgusu + akıllı sıralama
-- ============================================================
-- Parametreler:
--   p_min_lng, p_min_lat, p_max_lng, p_max_lat : harita görünüm alanı
--   p_category : null = hepsi, değer varsa filtrele
--   p_tags : gerekli tag'ler (tümü eşleşmeli)
--   p_emergency_only : true = sadece nöbetçi/SOS noktaları
--   p_user_lat, p_user_lng : sıralama için kullanıcı konumu
--   p_limit : sonuç sayısı (default 50)
CREATE OR REPLACE FUNCTION get_pois_in_bbox(
  p_min_lng      double precision,
  p_min_lat      double precision,
  p_max_lng      double precision,
  p_max_lat      double precision,
  p_category     text DEFAULT NULL,
  p_tags         text[] DEFAULT NULL,
  p_emergency_only boolean DEFAULT false,
  p_user_lat     double precision DEFAULT NULL,
  p_user_lng     double precision DEFAULT NULL,
  p_limit        integer DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  name            text,
  category        text,
  latitude        double precision,
  longitude       double precision,
  tags            text[],
  badges          jsonb,
  avg_rating      numeric,
  review_count    integer,
  is_emergency    boolean,
  distance_m      double precision,
  ranking_score   double precision
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.name,
    p.category,
    p.latitude,
    p.longitude,
    p.tags,
    p.badges,
    p.avg_rating,
    p.review_count,
    p.is_emergency,
    -- Kullanıcı konumu varsa mesafeyi metre cinsinden hesapla
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
        )
      ELSE NULL
    END AS distance_m,
    -- Akıllı Sıralama Formülü:
    -- (0.4 * mesafe_skoru) + (0.5 * yıldız_skoru) + (0.1 * doğrulanmış_bonus)
    -- mesafe_skoru: 10km yarıçapta normalize (yakın = yüksek)
    -- yıldız_skoru: avg_rating / 5
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        (
          0.4 * GREATEST(0, 1.0 - (
            ST_Distance(
              p.location,
              ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
            ) / 10000.0
          ))
          +
          0.5 * (COALESCE(p.avg_rating, 0) / 5.0)
          +
          0.1 * CASE WHEN p.status = 'approved' THEN 1.0 ELSE 0.0 END
        )
      ELSE
        COALESCE(p.avg_rating, 0) / 5.0
    END AS ranking_score
  FROM pois p
  WHERE
    -- Bounding Box filtresi
    p.location && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    -- Sadece onaylı POI'ler
    AND p.status = 'approved'
    -- Kategori filtresi
    AND (p_category IS NULL OR p.category = p_category)
    -- SOS / Acil durum filtresi
    AND (p_emergency_only = false OR p.is_emergency = true)
    -- Tag filtresi: gerekli tüm tag'ler mevcut olmalı
    AND (p_tags IS NULL OR p.tags @> p_tags)
  ORDER BY ranking_score DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- 7. RPC: check_poi_visit — Geo-fence doğrulama (200m)
-- ============================================================
CREATE OR REPLACE FUNCTION check_poi_visit(
  p_user_id   uuid,
  p_poi_id    uuid,
  p_user_lat  double precision,
  p_user_lng  double precision
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_distance double precision;
  v_poi_location geography;
  v_result jsonb;
BEGIN
  SELECT location INTO v_poi_location FROM pois WHERE id = p_poi_id;

  IF v_poi_location IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'reason', 'poi_not_found');
  END IF;

  v_distance := ST_Distance(
    v_poi_location,
    ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
  );

  -- Ziyaret logla
  INSERT INTO poi_visit_logs (user_id, poi_id, user_location, distance_m)
  VALUES (
    p_user_id,
    p_poi_id,
    ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography,
    v_distance
  );

  -- 200m içindeyse doğrulanmış
  IF v_distance <= 200 THEN
    RETURN jsonb_build_object('verified', true, 'distance_m', v_distance);
  ELSE
    -- Geçmiş log kontrol et: daha önce 200m içine girmiş mi?
    IF EXISTS (
      SELECT 1 FROM poi_visit_logs
      WHERE user_id = p_user_id AND poi_id = p_poi_id AND distance_m <= 200
    ) THEN
      RETURN jsonb_build_object('verified', true, 'distance_m', v_distance, 'via', 'history');
    END IF;
    RETURN jsonb_build_object('verified', false, 'distance_m', v_distance, 'review_type', 'guest');
  END IF;
END;
$$;

-- ============================================================
-- 8. RLS Politikaları
-- ============================================================

ALTER TABLE pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE poi_visit_logs ENABLE ROW LEVEL SECURITY;

-- pois: herkes onaylı POI'leri okuyabilir
CREATE POLICY "pois_select_approved"
  ON pois FOR SELECT
  USING (status = 'approved');

-- pois: giriş yapmış kullanıcı yeni POI ekleyebilir (pending olarak)
CREATE POLICY "pois_insert_auth"
  ON pois FOR INSERT
  TO authenticated
  WITH CHECK (added_by = auth.uid());

-- pois: admin/moderatör tümünü görebilir ve düzenleyebilir
CREATE POLICY "pois_admin_all"
  ON pois FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- poi_reviews: herkes doğrulanmış yorumları okuyabilir
CREATE POLICY "poi_reviews_select"
  ON poi_reviews FOR SELECT
  USING (true);

-- poi_reviews: giriş yapmış kullanıcı kendi yorumunu ekleyebilir
CREATE POLICY "poi_reviews_insert"
  ON poi_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- poi_reviews: kullanıcı kendi yorumunu güncelleyebilir
CREATE POLICY "poi_reviews_update_own"
  ON poi_reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- poi_visit_logs: kullanıcı kendi loglarını görebilir
CREATE POLICY "poi_visit_logs_select_own"
  ON poi_visit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- poi_visit_logs: kullanıcı kendi logunu ekleyebilir
CREATE POLICY "poi_visit_logs_insert"
  ON poi_visit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 9. Örnek seed verisi (test için, production'da kaldır)
-- ============================================================
-- INSERT INTO pois (name, description, category, location, latitude, longitude, city, tags, badges, status, is_emergency)
-- VALUES
--   ('Güven Tır Parkı', 'Güvenlikli, 200 tır kapasiteli park alanı', 'park_dinlenme',
--    ST_SetSRID(ST_MakePoint(32.8597, 39.9334), 4326)::geography, 39.9334, 32.8597,
--    'Ankara', ARRAY['Güvenlik Kameralı', '7/24 Açık', 'Tır Park Yeri Var'],
--    '{"guvenlik_kamerali": true, "agir_vasita_uygun": true}'::jsonb, 'approved', false),
--   ('Şoför Evi Lokantası', 'Ev yemekleri, nakliyeciye özel fiyat', 'yemek',
--    ST_SetSRID(ST_MakePoint(32.8650, 39.9380), 4326)::geography, 39.9380, 32.8650,
--    'Ankara', ARRAY['Sulu Yemek', 'Kamyoncu Dostu', 'Uygun Fiyat'],
--    '{}'::jsonb, 'approved', false);

-- ============================================================
-- 10. Contextual Yük Önerisi — POI cross-entegrasyon
-- ============================================================
-- Kullanıcı belirli bir şehirdeki POI'de 3 saat+ duruyorsa
-- o şehirden çıkacak yakın tarihli aktif ilanları döner.
--
-- Kullanım: Uygulama katmanı (Next.js cron / Supabase pg_cron)
-- periyodik olarak bu RPC'yi çağırır ve sonuç varsa
-- kullanıcıya push/WhatsApp bildirimi gönderir.
--
-- pg_cron örneği (her 15 dakikada bir kontrol):
--   SELECT cron.schedule(
--     'poi-contextual-check',
--     '*/15 * * * *',
--     $$SELECT notify_parked_drivers()$$
--   );

-- Şehirdeki aktif ilanları dönen yardımcı RPC
CREATE OR REPLACE FUNCTION get_nearby_listings_for_parked_driver(
  p_city      text,
  p_limit     integer DEFAULT 3
)
RETURNS TABLE (
  listing_id  uuid,
  title       text,
  origin_city text,
  dest_city   text,
  load_type   text,
  created_at  timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    l.id,
    COALESCE(l.title, l.origin_city || ' → ' || l.dest_city) AS title,
    l.origin_city,
    l.dest_city,
    l.load_type,
    l.created_at
  FROM listings l
  WHERE
    l.origin_city ILIKE '%' || p_city || '%'
    AND l.status = 'active'
    AND l.moderation_status = 'approved'
    AND l.created_at >= now() - interval '48 hours'
  ORDER BY l.created_at DESC
  LIMIT p_limit;
$$;

-- poi_stay_events: Uzun süreli park takibi (3 saat eşiği için)
-- Uygulama, kullanıcı bir POI'de check-in yaptığında buraya yazar.
-- Cron job check_in_at + 3 saat geçenleri tarar.
CREATE TABLE IF NOT EXISTS poi_stay_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poi_id        uuid NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  poi_city      text,
  check_in_at   timestamptz DEFAULT now(),
  notified_at   timestamptz          -- NULL = bildirim henüz gönderilmedi
);

-- Aynı gün aynı POI'de bir kayıt (ifade içerdiği için ayrı index)
CREATE UNIQUE INDEX IF NOT EXISTS poi_stay_events_user_poi_day_idx
  ON poi_stay_events (user_id, poi_id, (check_in_at::date));

ALTER TABLE poi_stay_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_stay_events_own"
  ON poi_stay_events FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Cron job: 3+ saat park edip henüz bildirilmemiş sürücüleri bul
-- Bu fonksiyon çağrıldığında ilgili kullanıcı + şehir listesini döner.
-- Uygulama bu listeyle push / WhatsApp bildirimini tetikler.
CREATE OR REPLACE FUNCTION get_parked_drivers_for_notification()
RETURNS TABLE (
  user_id   uuid,
  poi_city  text,
  poi_name  text,
  parked_since timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    se.user_id,
    se.poi_city,
    p.name AS poi_name,
    se.check_in_at AS parked_since
  FROM poi_stay_events se
  JOIN pois p ON p.id = se.poi_id
  WHERE
    se.check_in_at <= now() - interval '3 hours'
    AND se.notified_at IS NULL
    AND se.poi_city IS NOT NULL;
$$;
