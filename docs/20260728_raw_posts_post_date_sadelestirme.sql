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
--   1. ÖNCE bu SQL çalıştırılır (kod hâlâ post_date yazıyor olabilir → 3. adıma
--      kadar `post_date` kolonu DURUYOR, sadece indeks taşınıyor).
--   2. Kod dağıtılır: `post_date: c.msgDate` satırı insert payload'ından çıkarılır
--      ve `select('... post_date ...')` → `message_date` olur.
--      (app/api/whatsapp-parse/route.ts)
--   3. Kod canlıda doğrulandıktan SONRA aşağıdaki 3. ADIM çalıştırılıp kolon düşürülür.
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
-- ADIM 1 — Yeni indeksi message_date üzerine kur (CONCURRENTLY, kilitsiz)
-- =============================================================================
-- NOT: CREATE INDEX CONCURRENTLY transaction bloğu İÇİNDE çalışmaz.
-- Supabase SQL editöründe tek tek çalıştır.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_posts_hash_msgdate
  ON public.raw_posts USING btree (clean_hash, message_date)
  WHERE (clean_hash IS NOT NULL);

-- Başarılı mı? invalid kalmamalı:
SELECT indexrelid::regclass AS indeks, indisvalid
FROM pg_index
WHERE indexrelid = 'public.idx_raw_posts_hash_msgdate'::regclass;

-- =============================================================================
-- ADIM 2 — Eski indeksi düşür
-- =============================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_raw_posts_hash_day;

-- =============================================================================
-- ADIM 3 — Kolonu düşür (SADECE kod dağıtıldıktan ve doğrulandıktan SONRA)
-- =============================================================================
-- Geri alınamaz. Adım 0'daki bağımlılık sorgusu boş dönmüş olmalı.

-- ALTER TABLE public.raw_posts DROP COLUMN post_date;

-- =============================================================================
-- GERİ ALMA (adım 3 çalıştırılmadıysa)
-- =============================================================================
-- CREATE UNIQUE INDEX CONCURRENTLY idx_raw_posts_hash_day
--   ON public.raw_posts USING btree (clean_hash, post_date)
--   WHERE (clean_hash IS NOT NULL);
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_raw_posts_hash_msgdate;
