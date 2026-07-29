-- ═══════════════════════════════════════════════════════════════════════════
-- W5/D3 — aliases: normalize trigger + katlanmış anahtar üzerinde UNIQUE indeks
-- 29 Temmuz 2026 · Bayram çalıştıracak
--
-- 🚨 ÇALIŞTIRMA SIRASI: BU DOSYA EN SONDUR.
-- Önce `docs/20260729_alias_runbook.md` içindeki Adım 0-9 tamamlanmalı.
-- Özellikle Adım 9 (katlanmış alias kopyalarını pasifleştirme) yapılmadan
-- BÖLÜM 2'deki indeks 23505 ile reddedilir. Sebep: `alias` kolonundaki mevcut
-- unique kısıtı HAM string üzerinde — `Gebze`/`GEBZE`/`gebze` üç ayrı satır
-- olarak duruyor ama katlanmış anahtarları aynı.
--
-- NEDEN VAR: `aliases` tablosunda aynı şehir iki yazımla birikti
-- (`Istanbul` 13 satır / `İstanbul` 154 satır, aynı şekilde `Izmir`/`İzmir`,
-- `Mugla`/`Muğla`, `Bingol`/`Bingöl`). Sonucu sahte `İstanbul→İstanbul`
-- güzergâhları ve eksik şehir filtresiydi. D1 (prompt) ve D2 (yazma yolları)
-- kaynağı kesti; bu dosya bozulmanın **bir daha birikmesini imkânsız** kılar:
--   - trigger  → uygulama katmanı atlanırsa (SQL editor, başka servis, script)
--                bile alan normalizasyonu yine uygulanır.
--   - indeks   → aynı katlanmış anahtarla ikinci bir aktif satır DB seviyesinde
--                reddedilir.
--
-- ⚠️ ASCII'YE ÇEVİRMİYORUZ. Katlama yalnız KARŞILAŞTIRMA anahtarı üretmek için.
-- Saklanan değer Türkçe kalır.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 0 — ÖNKOŞUL KONTROLÜ (önce bunu çalıştır)
--
-- İki sorgu da 0 satır dönmeli. Dönmüyorsa runbook'a geri dön.
-- ───────────────────────────────────────────────────────────────────────────

-- 0.1 Katlanmış anahtarı çakışan AKTİF satırlar kaldı mı? (runbook Adım 9)
--     Satır dönerse BÖLÜM 2'deki indeks kurulamaz.
SELECT translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') AS katlanmis,
       type,
       count(*)                      AS satir,
       array_agg(id ORDER BY id)     AS idler,
       array_agg(alias ORDER BY id)  AS yazimlar
FROM public.aliases
WHERE is_active = true
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY satir DESC, katlanmis;

-- 0.2 `normalized` tarafında bozuk ASCII yazım kaldı mı? (runbook Adım 2)
--     Trigger bu değerleri DÜZELTMEZ (aşağıdaki gerekçeye bak) — temizlik
--     yapılmadıysa bozukluk tabloda kalır.
SELECT normalized, count(*)
FROM public.aliases
WHERE normalized IN ('Istanbul','Izmir','Mugla','Bingol')
GROUP BY 1
ORDER BY 2 DESC;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 1 — NORMALIZE TRIGGER
--
-- Ne yapar:
--   alias       → boşluk temizliği + LOWERCASE
--   normalized  → yalnız boşluk temizliği
--   district    → yalnız boşluk temizliği; boş string ise NULL
--
-- ⚠️ `alias` NEDEN lowercase: eşleşme tarafı (`parse-listing/findPlaces`,
-- `whatsapp-parse`) `trNorm`'lanmış — yani küçük harfli — metinle karşılaştırıyor.
-- Büyük harf içeren bir alias hiçbir zaman tutmaz, yani sessizce ölü kayıt olur.
--
-- ⚠️ `normalized`/`district` NEDEN düzeltilmiyor (büyük harfe çevirme, ASCII
-- katlama vb. YOK): `normalized` her zaman şehir değil. `type='vehicle'`
-- satırlarında `normalized` doğrudan `vehicle_type` olarak ilana yazılıyor;
-- "tir" → "Tir" yapmak eşleşmeyi bozar. Yazım hatasını sessizce düzeltmek
-- yerine `lib/alias-normalize.ts::aliasCakismaBul` yakalayıp admine soruyor.
-- Trigger burada uygulama katmanıyla BİREBİR aynı davranıyor — ikisi ayrışırsa
-- uygulama "temiz" der, DB başka değer yazar.
--
-- Bu trigger `lib/alias-normalize.ts::normalizeAliasFields` fonksiyonunun
-- DB tarafındaki ikizidir. Birini değiştiren diğerini de değiştirmek zorunda.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.aliases_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- btrim + içteki tekrar eden boşlukları teke indir (JS: /\s+/g → ' ')
  IF NEW.alias IS NOT NULL THEN
    NEW.alias := lower(btrim(regexp_replace(NEW.alias, '\s+', ' ', 'g')));
  END IF;

  IF NEW.normalized IS NOT NULL THEN
    NEW.normalized := btrim(regexp_replace(NEW.normalized, '\s+', ' ', 'g'));
  END IF;

  IF NEW.district IS NOT NULL THEN
    NEW.district := btrim(regexp_replace(NEW.district, '\s+', ' ', 'g'));
    -- Boş string NULL olsun: '' ile NULL iki ayrı "ilçe yok" hali olmasın.
    IF NEW.district = '' THEN
      NEW.district := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ⚠️ `lower()` NEDEN GÜVENLİ: burada `İ` özel işlemi YOK çünkü hedef ASCII
-- katlama değil, sadece küçük harfe indirme. Postgres `lower('İSTANBUL')`
-- sonucu "i̇stanbul" (i + U+0307) olur ve bu, aşağıdaki indeks ifadesinde
-- `replace(alias,'İ','i')` ADIMININ ÖNCE gelmesinin sebebidir. Alias zaten
-- trigger'dan küçük harfli çıktığı için pratikte `İ` içeren alias kalmaz;
-- yine de indeks ifadesi kendi başına doğru olmak zorunda.

DROP TRIGGER IF EXISTS aliases_normalize_trg ON public.aliases;

CREATE TRIGGER aliases_normalize_trg
  BEFORE INSERT OR UPDATE OF alias, normalized, district
  ON public.aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.aliases_normalize();

-- Geri alma:
--   DROP TRIGGER IF EXISTS aliases_normalize_trg ON public.aliases;
--   DROP FUNCTION IF EXISTS public.aliases_normalize();


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 2 — KATLANMIŞ ANAHTAR ÜZERİNDE KISMİ UNIQUE İNDEKS
--
-- 🚨 İfade `lib/alias-normalize.ts::aliasKey` ile BİREBİR aynı olmak zorunda:
--     translate(lower(replace(alias,'İ','i')), 'ıçğöşü', 'icgosu')
-- Sıra kritik: `İ` (U+0130) ÖNCE düz `i`ye çevrilir. Aksi halde `lower()` onu
-- `i` + birleşen nokta (U+0307) olarak iki karaktere açar ve JS
-- `toLowerCase()` ile aynı sonucu VERMEZ → uygulama "çakışma yok" derken DB
-- 23505 ile patlar.
--
-- ⚠️ NEDEN KISMİ (`WHERE is_active = true`): runbook Adım 9 kopyaları
-- SİLMİYOR, `is_active = false` yapıyor (geri alınabilir olsun diye). Tam
-- indeks o pasif satırları da ihlal sayar ve kurulamaz. Kısmi indeks
-- "aktif alias'lar arasında katlanmış anahtar tekildir" garantisini verir —
-- korunması gereken tam olarak bu, çünkü eşleşme tarafı zaten
-- `.eq('is_active', true)` ile okuyor.
--
-- ⚠️ `type` neden PARTITION'da: `araç` hem şehir (Kastamonu/Araç) hem araç tipi
-- olabilir; farklı `type` altında aynı anahtar meşru.
--
-- ⚠️ `is_approved` FİLTRESİ YOK ve olmamalı: eşleşme tarafı `is_approved`e
-- bakmıyor (W0-W4'ten devreden bilinen tuzak, bilinçli olarak değiştirilmedi).
-- Onaylanmamış bir satır da eşleşmeye girdiği için tekillik ona da lazım.
-- ───────────────────────────────────────────────────────────────────────────

-- ÖNCE ÖLÇ: bu sorgu 0 satır dönmeli (BÖLÜM 0.1'in aynısı, son kontrol).
-- Satır dönüyorsa AŞAĞIDAKİ CREATE'i çalıştırma.

CREATE UNIQUE INDEX IF NOT EXISTS aliases_katlanmis_anahtar_uniq
  ON public.aliases (
    type,
    translate(lower(replace(alias,'İ','i')), 'ıçğöşü', 'icgosu')
  )
  WHERE is_active = true;

-- Geri alma:
--   DROP INDEX IF EXISTS public.aliases_katlanmis_anahtar_uniq;

-- 23505 alırsan: hata mesajındaki anahtar değerini al ve BÖLÜM 0.1 sorgusunda
-- ara — hangi id'lerin çakıştığını gösterir. Runbook Adım 9'a dön.
--
-- ℹ️ Üretimde tablo kilitlemek istemiyorsan `CREATE UNIQUE INDEX CONCURRENTLY`
-- kullanılabilir; ama transaction içinde çalışmaz ve başarısız olursa INVALID
-- indeks bırakır (elle DROP gerekir). `aliases` küçük bir tablo (~200 satır
-- mertebesi), o yüzden normal CREATE tercih edildi.


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 3 — DOĞRULAMA
-- ───────────────────────────────────────────────────────────────────────────

-- 3.1 Trigger çalışıyor mu? (yaz-oku-geri al; hiçbir kalıcı iz bırakmaz)
BEGIN;
  INSERT INTO public.aliases (type, alias, normalized, district, is_active, is_approved)
  VALUES ('city', '  TRIGGER   TESTI  ', '  Test Ili  ', '   ', false, false);

  -- Beklenen: alias='trigger testi', normalized='Test Ili', district=NULL
  SELECT alias, normalized, district
  FROM public.aliases
  WHERE alias = 'trigger testi';
ROLLBACK;

-- 3.2 İndeks gerçekten engelliyor mu? (beklenen: 23505 hatası)
BEGIN;
  INSERT INTO public.aliases (type, alias, normalized, is_active, is_approved)
  VALUES ('city', 'indekstesti', 'Test', true, false);
  -- Bu ikincisi PATLAMALI — 'İNDEKSTESTİ' aynı katlanmış anahtara düşer:
  INSERT INTO public.aliases (type, alias, normalized, is_active, is_approved)
  VALUES ('city', 'İNDEKSTESTİ', 'Test', true, false);
ROLLBACK;

-- 3.3 Uygulama ↔ DB anahtar ifadesi uyumu.
-- Bu sorgunun çıktısını `aliasKey()`'in aynı girdiler için döndürdüğüyle
-- karşılaştır; hepsi eşleşmeli. Eşleşmiyorsa `lib/alias-normalize.ts`
-- düzeltilmeli (ifade DB'de doğru olan).
SELECT s.g AS girdi,
       translate(lower(replace(s.g,'İ','i')),'ıçğöşü','icgosu') AS db_anahtar
FROM (VALUES ('İstanbul'),('Istanbul'),('istanbul'),('İSTANBUL'),
             ('Muğla'),('Mugla'),('Çorlu'),('corlu'),
             ('Bingöl'),('Bingol'),('Kahramankazan')) AS s(g);


-- ───────────────────────────────────────────────────────────────────────────
-- BUNDAN SONRA
--
-- Bu indeks kurulduktan sonra `lib/alias-normalize.ts::aliasCakismaBul`
-- artık "son savunma" değil, "önce sor" katmanı: 409 dönmesi kullanıcıya
-- anlamlı mesaj vermek için, tekilliği DB garanti ediyor. İkisi de kalmalı —
-- indeks tek başına admine hangi yazımın kazandığını söylemiyor.
--
-- Kalan bilinen açık (bu dosyanın kapsamı DIŞINDA):
--   - `is_active`/`is_approved` desenkronu (eşleşme tarafı onaya bakmıyor).
--   - Geçmişte üretilmiş sahte güzergâhlı `listings` satırlarının kaderi
--     (silme / moderasyona düşürme) — runbook Adım 8 sonunda not edildi.
-- ───────────────────────────────────────────────────────────────────────────
