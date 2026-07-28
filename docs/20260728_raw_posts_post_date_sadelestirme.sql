-- =============================================================================
-- raw_posts: post_date sadeleştirme
-- 28 Tem 2026
-- =============================================================================
--
-- SORUN
-- -----
-- `raw_posts` tablosunda iki kolon AYNI değeri tutuyor:
--   message_date  ← app/api/whatsapp-parse/route.ts yazıyor
--   post_date     ← aynı satırda, aynı değerle (`post_date: c.msgDate`)
--
-- Üzerlerinde İKİ AYRI kısmi unique indeks var:
--   raw_posts_dedup_idx    UNIQUE (clean_hash, contact_phone, message_date)
--                          WHERE clean_hash IS NOT NULL AND contact_phone IS NOT NULL
--   idx_raw_posts_hash_day UNIQUE (clean_hash, post_date)
--                          WHERE clean_hash IS NOT NULL
--
-- İkincisi birincisinin daha katı hali (telefon içermiyor), yani bağlayıcı kural
-- odur. İki kolonun aynı şeyi tutması, uygulama kodunda "hangisine göre
-- tekilleştiriyoruz" sorusunu belirsiz bırakıyor ve bir kez zaten yanlış cevaba
-- yol açtı (batch-içi dedup anahtarı telefonu içeriyordu → 23505 fırtınası).
--
-- HEDEF
-- -----
-- Tek tarih kolonu: `message_date`. `post_date` düşürülür, hash_day indeksi
-- `message_date` üzerine kurulur.
--
-- =============================================================================
-- ⚠️ UYGULAMADAN ÖNCE — bu migration KOD DEĞİŞİKLİĞİYLE SIRALI çalışmalı
-- =============================================================================
--   1. ÖNCE adım 0 ve 1 çalıştırılır (kod hâlâ post_date yazıyor olabilir → kolon
--      DURUYOR, sadece unique indeks message_date üzerine taşınıyor).
--   2. Kod dağıtılır: `post_date: c.msgDate` satırı insert payload'ından çıkarılır
--      ve `select('... post_date ...')` → `message_date` olur.
--      (app/api/whatsapp-parse/route.ts)
--   3. Kod canlıda doğrulandıktan SONRA aşağıdaki ADIM 2 çalıştırılıp kolon düşürülür.
--
-- Bu sırayı bozmak (kolonu kod dağıtılmadan düşürmek) TÜM içe aktarma insert'lerini
-- PostgREST hatasıyla kırar.

-- =============================================================================
-- ADIM 0 — DOĞRULAMA (önce bunu çalıştır, 0 dönmeli)
-- =============================================================================
-- İki kolonun gerçekten ayrışmadığını teyit et. 0 dönmezse aşağıya DEVAM ETME:
-- ayrışmış satırlar var demektir ve hangisinin doğru olduğuna karar verilmeli.

SELECT count(*) AS ayrisan_satir_sayisi
FROM public.raw_posts
WHERE post_date IS DISTINCT FROM message_date;

-- Ayrıca post_date'e başka bir yerden bağımlılık var mı (view, fonksiyon, trigger):
SELECT DISTINCT c.relname AS nesne, c.relkind
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class c ON c.oid = r.ev_class
WHERE d.refobjid = 'public.raw_posts'::regclass
  AND d.refobjsubid = (
    SELECT attnum FROM pg_attribute
    WHERE attrelid = 'public.raw_posts'::regclass AND attname = 'post_date'
  );

-- =============================================================================
-- ADIM 1 — Yeni indeksi message_date üzerine kur
-- =============================================================================
-- ⚠️ Supabase SQL editörü her çalıştırmayı bir TRANSACTION'a sarar; bu yüzden
--    `CREATE INDEX CONCURRENTLY` orada ÇALIŞMAZ:
--        ERROR: 25001: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
--    İki seçenek var — A veya B, ikisini birden yapma.

-- ── Önce tabloyu ölç: kilit ne kadar sürer? ──────────────────────────────────
SELECT count(*) AS satir_sayisi,
       pg_size_pretty(pg_total_relation_size('public.raw_posts')) AS boyut
FROM public.raw_posts;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEÇENEK A (basit) — CONCURRENTLY olmadan, SQL editöründe
-- ─────────────────────────────────────────────────────────────────────────────
-- `CREATE INDEX` tabloya SHARE kilidi alır: SELECT'ler devam eder, INSERT/UPDATE
-- indeks kurulana kadar BEKLER. Birkaç yüz bin satıra kadar bu saniyeler sürer.
-- İçe aktarma yapılmayan bir anda çalıştır. Yaklaşık 1M satırın üstündeyse
-- Seçenek B'yi tercih et.

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_posts_hash_msgdate
  ON public.raw_posts USING btree (clean_hash, message_date)
  WHERE (clean_hash IS NOT NULL);

DROP INDEX IF EXISTS public.idx_raw_posts_hash_day;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEÇENEK B (kilitsiz) — CONCURRENTLY, transaction DIŞINDA
-- ─────────────────────────────────────────────────────────────────────────────
-- SQL editörü kullanılamaz. Doğrudan psql ile bağlan (Supabase → Project Settings
-- → Database → Connection string) ve aşağıdakileri TEK TEK, ayrı ayrı çalıştır:
--
--   psql "postgresql://postgres:[PAROLA]@[HOST]:5432/postgres"
--
--   CREATE UNIQUE INDEX CONCURRENTLY idx_raw_posts_hash_msgdate
--     ON public.raw_posts USING btree (clean_hash, message_date)
--     WHERE (clean_hash IS NOT NULL);
--
--   DROP INDEX CONCURRENTLY public.idx_raw_posts_hash_day;
--
-- CONCURRENTLY başarısız olursa indeks "invalid" halde kalır ve tekrar
-- denemeden ÖNCE düşürülmesi gerekir:
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_raw_posts_hash_msgdate;

-- ── Doğrulama (hangi seçeneği kullandıysan) ──────────────────────────────────
-- indisvalid = true olmalı, hash_day artık listede olmamalı:
SELECT indexrelid::regclass AS indeks, indisvalid, indisunique
FROM pg_index
WHERE indrelid = 'public.raw_posts'::regclass;

-- =============================================================================
-- ADIM 2 — Kolonu düşür (SADECE kod dağıtıldıktan ve doğrulandıktan SONRA)
-- =============================================================================
-- Geri alınamaz. Adım 0'daki bağımlılık sorgusu boş dönmüş olmalı ve
-- app/api/whatsapp-parse/route.ts artık `post_date` YAZMIYOR olmalı.

-- ALTER TABLE public.raw_posts DROP COLUMN post_date;

-- =============================================================================
-- GERİ ALMA (adım 2 çalıştırılmadıysa)
-- =============================================================================
-- CREATE UNIQUE INDEX idx_raw_posts_hash_day
--   ON public.raw_posts USING btree (clean_hash, post_date)
--   WHERE (clean_hash IS NOT NULL);
-- DROP INDEX IF EXISTS public.idx_raw_posts_hash_msgdate;
