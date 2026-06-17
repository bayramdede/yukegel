-- ─────────────────────────────────────────────────────────────
-- Migration: pois tablosuna categories text[] kolonu ekle
-- Tarih: 2026-06-17
-- Amaç: Tek bir POI birden fazla alt kategoriye ait olabilsin
--   ör: hem akaryakit_istasyonu hem elektrik_sarj olan bir tesis
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. Yeni kolon ekle
ALTER TABLE pois ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- 2. Mevcut kayıtları doldur: categories = [category]
UPDATE pois
SET categories = ARRAY[category]
WHERE (categories = '{}' OR categories IS NULL)
  AND category IS NOT NULL;

-- 3. Kontrol sorgusunu çalıştır
SELECT
  category,
  categories,
  COUNT(*) AS adet
FROM pois
GROUP BY category, categories
ORDER BY adet DESC
LIMIT 20;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- NOT: Bu migration sonrasında uygulama kodu şunları yapar:
--   INSERT: hem category (birincil) hem categories (dizi) set edilir
--   PATCH:  hem category (categories[0]) hem categories güncellenir
--   GET:    Supabase .overlaps('categories', [...]) ile filtrelenir
--
-- RPC get_pois_in_bbox hâlâ p_category (tekli) alır — birincil
-- kategoriye göre hızlı filtreleme için. Çoklu filtre durumunda
-- RPC null alır, sonuçlar JS tarafında post-filter edilir.
-- ─────────────────────────────────────────────────────────────
