-- ─────────────────────────────────────────────────────────────
-- Migration: POI Kategorileri 2 Kademeli Yapıya Güncelleme
-- Tarih: 2026-06-17
-- ─────────────────────────────────────────────────────────────
-- Yeni ana-kategori / alt-kategori hiyerarşisi:
--
--   Akaryakıt & Enerji   → akaryakit_istasyonu, elektrik_sarj
--   Park & Konaklama     → tir_parki, otel_pansiyon
--   Tamir & Bakım        → motor_mekanik, lastikci, elektrik_takograf,
--                           branda_dorse, yikama_yaglama, acil_yol_yardim
--   Yeme & İçme          → dinlenme_tesisi, esnaf_lokantasi
--   Operasyon Noktaları  → kantar, nakliyeciler_sitesi, gumruk_sinir, antrepo_depo
--
-- Eski değerler → yeni değerlere güncelleniyor.
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. Eski kategorileri yeni karşılıklarına güncelle
UPDATE pois SET category = 'motor_mekanik'
  WHERE category IN ('motorcu', 'kaportaci', 'frigo_ustasi', 'tamirci');

UPDATE pois SET category = 'lastikci'
  WHERE category = 'lastikci'; -- zaten doğru, no-op

UPDATE pois SET category = 'elektrik_takograf'
  WHERE category = 'elektrikci';

UPDATE pois SET category = 'branda_dorse'
  WHERE category = 'dorse_branda';

UPDATE pois SET category = 'yikama_yaglama'
  WHERE category IN ('yikama', 'tesis_akaryakit');

UPDATE pois SET category = 'tir_parki'
  WHERE category = 'park_dinlenme';

UPDATE pois SET category = 'otel_pansiyon'
  WHERE category = 'konaklama';

UPDATE pois SET category = 'esnaf_lokantasi'
  WHERE category IN ('lokanta', 'yemek');

UPDATE pois SET category = 'kantar'
  WHERE category = 'kantar_resmi';

UPDATE pois SET category = 'akaryakit_istasyonu'
  WHERE category = 'tesis_akaryakit';

-- 2. Etkilenen satır sayısını raporla (Supabase SQL Editor'da manuel çalıştır)
SELECT
  category,
  COUNT(*) AS adet
FROM pois
WHERE category IN (
  'akaryakit_istasyonu', 'elektrik_sarj',
  'tir_parki', 'otel_pansiyon',
  'motor_mekanik', 'lastikci', 'elektrik_takograf',
  'branda_dorse', 'yikama_yaglama', 'acil_yol_yardim',
  'dinlenme_tesisi', 'esnaf_lokantasi',
  'kantar', 'nakliyeciler_sitesi', 'gumruk_sinir', 'antrepo_depo'
)
GROUP BY category
ORDER BY category;

-- 3. Güncellenmemiş (bilinmeyen) eski kategori kontrolü
SELECT id, name, category
FROM pois
WHERE category NOT IN (
  'akaryakit_istasyonu', 'elektrik_sarj',
  'tir_parki', 'otel_pansiyon',
  'motor_mekanik', 'lastikci', 'elektrik_takograf',
  'branda_dorse', 'yikama_yaglama', 'acil_yol_yardim',
  'dinlenme_tesisi', 'esnaf_lokantasi',
  'kantar', 'nakliyeciler_sitesi', 'gumruk_sinir', 'antrepo_depo'
)
LIMIT 20;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- NOT: Bu migration'ı çalıştırmadan önce mevcut kategorileri
-- yedekleyin veya staging ortamında test edin.
--
-- Mevcut pois tablosunda category kolonu text tipinde olduğu için
-- CHECK constraint veya enum değişikliği gerekmez.
--
-- RPC get_pois_in_bbox güncellenmesine gerek yok:
-- p_category = NULL ile tümünü döndürür, frontend categories[] ile
-- post-filter yapıyor (çoklu seçim için /api/poi route güncellendi).
-- ─────────────────────────────────────────────────────────────
