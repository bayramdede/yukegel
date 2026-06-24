-- ──────────────────────────────────────────────────────────────
-- Migration: kantar kategorisi → kantar_resmi / kantar_ozel
-- Tarih: 2026-06-24
-- Açıklama:
--   Operasyon Noktaları altındaki "kantar" kategorisi ikiye bölündü:
--     kantar_resmi → Devlet/karayolları resmi tartım istasyonları
--     kantar_ozel  → Özel işletme kantarları
--
--   Eski DB kayıtlarında:
--     • category = 'kantar'       → kantar_ozel'e taşınır
--     • category = 'kantar_resmi' → zaten doğru, değişmez
-- ──────────────────────────────────────────────────────────────

-- 1. Eski 'kantar' kayıtlarını kantar_ozel'e çevir
UPDATE pois
SET category = 'kantar_ozel'
WHERE category = 'kantar';

-- 2. Doğrulama
SELECT category, count(*) AS adet
FROM pois
WHERE category IN ('kantar', 'kantar_resmi', 'kantar_ozel')
GROUP BY category
ORDER BY category;
