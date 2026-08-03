-- =============================================================================
-- aliases: kopya kayıt temizliği — normalized / district tutarlılığı
-- 28 Tem 2026
-- =============================================================================
--
-- KAYNAK: `aliases` tablosunun tam dökümü (1893 satır) analiz edildi.
--   aktif city alias      : 1789
--   benzersiz normalize form: 1192
--   KOPYA grubu           : 538  (toplam 1135 satır)
--
-- NEDEN ÖNEMLİ — `findPlaces` (supabase/functions/parse-listing/index.ts:288)
--   `cityAliases.find(a => trNorm(a.alias) === bg)`
-- ilk eşleşeni alır. Alias listesi `.order('id')` ile çekildiği için
-- KÜÇÜK id KAZANIR. Yani hangi kopyanın kazandığı, alias'ın ne zaman
-- eklendiğine bağlı — tamamen tesadüf.
--
-- İKİNCİ VE DAHA SİNSİ ZARAR: `seen` kümesi `normalized` DEĞERİYLE tutuluyor.
-- 'Istanbul' ve 'İstanbul' AYRI iki değer olduğu için, içinde hem `avcilar`
-- (→'Istanbul') hem `kadıköy` (→'İstanbul') geçen bir mesaj İKİ ŞEHİR bulmuş
-- sayılıyor ve İstanbul→İstanbul diye SAHTE GÜZERGÂH üretiliyor.
--
-- Bu script kopya satırları SİLMEZ. Sadece `normalized` ve `district`
-- kolonlarını tutarlı hale getirir; hangi satırın kazandığı önemsizleşir.
--
-- SIRA: BÖLÜM 1 → 2 → 3 → 4 (elle) → 5 (doğrulama) → 6 (geçmiş listings)
-- Her bölüm ayrı çalıştırılabilir. Hepsi geri alınabilir (silme yok).


-- =============================================================================
-- BÖLÜM 1 — `normalized` içindeki ASCII bozulması
-- =============================================================================
-- Türkçe karakterleri düşmüş il adları. Sadece 4 değer ama 16 satırı etkiliyor
-- ve yukarıdaki SAHTE GÜZERGÂH hatasının doğrudan sebebi.
--   Istanbul → İstanbul  (13 satır)
--   Izmir    → İzmir     (1)
--   Mugla    → Muğla     (1)
--   Bingol   → Bingöl    (1)
-- Kural: ASCII'ye indirgenmiş hali kendisiyle AYNI olan değer bozuktur.

-- 1.1 önizleme:
SELECT id, alias, normalized, district FROM public.aliases
WHERE normalized IN ('Istanbul','Izmir','Mugla','Bingol') ORDER BY normalized, id;

-- 1.2 uygula:
-- UPDATE public.aliases SET normalized = CASE normalized
--   WHEN 'Bingol'   THEN 'Bingöl'
--   WHEN 'Istanbul' THEN 'İstanbul'
--   WHEN 'Izmir'    THEN 'İzmir'
--   WHEN 'Mugla'    THEN 'Muğla'
--   END
-- WHERE normalized IN ('Bingol', 'Istanbul', 'Izmir', 'Mugla');

-- =============================================================================
-- BÖLÜM 2 — `district` içindeki ASCII / yazım bozulması
-- =============================================================================
-- Aynı ilçe iki farklı yazımla kayıtlı. Kanonik seçim: EN ÇOK Türkçe karakter
-- içeren yazım (İnegöl > Inegöl, Kırkağaç > Kirkağaç). 11 çakışmanın tamamı
-- bu kuralla doğru çözülüyor — tek tek kontrol edildi.

-- 2.1 önizleme:
SELECT id, alias, normalized, district FROM public.aliases
WHERE district IN ('Alaçati', 'Avcilar', 'Beylikduzu', 'Cekmekoy', 'Eregli', 'Hadimkoy', 'Inegöl', 'Iscehisar', 'Iskenderun', 'Kirkağaç', 'Ulukisla') ORDER BY district, id;

-- 2.2 uygula:
-- UPDATE public.aliases SET district = CASE district
--   WHEN 'Alaçati'      THEN 'Alaçatı'
--   WHEN 'Avcilar'      THEN 'Avcılar'
--   WHEN 'Beylikduzu'   THEN 'Beylikdüzü'
--   WHEN 'Cekmekoy'     THEN 'Çekmeköy'
--   WHEN 'Eregli'       THEN 'Ereğli'
--   WHEN 'Hadimkoy'     THEN 'Hadımköy'
--   WHEN 'Inegöl'       THEN 'İnegöl'
--   WHEN 'Iscehisar'    THEN 'İscehisar'
--   WHEN 'Iskenderun'   THEN 'İskenderun'
--   WHEN 'Kirkağaç'     THEN 'Kırkağaç'
--   WHEN 'Ulukisla'     THEN 'Ulukışla'
--   END
-- WHERE district IN ('Alaçati', 'Avcilar', 'Beylikduzu', 'Cekmekoy', 'Eregli', 'Hadimkoy', 'Inegöl', 'Iscehisar', 'Iskenderun', 'Kirkağaç', 'Ulukisla');

-- =============================================================================
-- BÖLÜM 3 — Kopya gruplarında NULL kalan `district` alanlarını doldur
-- =============================================================================
-- 92 satır. Hepsi bir kopya grubunun üyesi ve grubun DİĞER satırlarında ilçe
-- dolu. Grup içinde ilçe konusunda ÇELİŞKİ olan hiçbir satır burada YOK —
-- çelişkililer BÖLÜM 4'e ayrıldı. Yani bu bölüm tamamen mekanik.
-- ÖNCE BÖLÜM 2 çalıştırılmalı (kaynak değerler orada düzeltiliyor).

-- 3.1 uygula:
-- UPDATE public.aliases AS a SET district = v.d
-- FROM (VALUES
--   (49, 'İzmit'),   -- izmıt
--   (978, 'Hadımköy'),   -- Hadımköy
--   (982, 'Şile'),   -- Şile
--   (983, 'Beylikdüzü'),   -- Beylikdüzü
--   (990, 'Yatağan'),   -- Yatağan
--   (991, 'Bodrum'),   -- Bodrum
--   (992, 'Milas'),   -- Milas
--   (993, 'Marmaris'),   -- Marmaris
--   (994, 'Fethiye'),   -- Fethiye
--   (995, 'Söke'),   -- Söke
--   (996, 'Çine'),   -- Çine
--   (998, 'Karacasu'),   -- Karacasu
--   (999, 'Buharkent'),   -- Buharkent
--   (1001, 'Söğüt'),   -- Söğüt
--   (1002, 'Pazaryeri'),   -- Pazaryeri
--   (1006, 'Bergama'),   -- Bergama
--   (1007, 'Hendek'),   -- Hendek
--   (1008, 'Sarayönü'),   -- Sarayönü
--   (1009, 'Kartepe'),   -- Kartepe
--   (1010, 'Malkara'),   -- Malkara
--   (1011, 'Ergene'),   -- Ergene
--   (1016, 'Biga'),   -- Biga
--   (1017, 'Hayrabolu'),   -- Hayrabolu
--   (1018, 'Arnavutköy'),   -- Arnavutköy
--   (1019, 'Çayırova'),   -- Çayırova
--   (1020, 'Tuzla'),   -- Tuzla
--   (1022, 'Torbalı'),   -- Torbali
--   (1025, 'Bafra'),   -- Bafra
--   (1026, 'Ezine'),   -- Ezine
--   (1027, 'Beypazarı'),   -- Beypazarı
--   (1028, 'Ceyhan'),   -- Ceyhan
--   (1029, 'Sincan'),   -- Sincan
--   (1031, 'Tepebaşı'),   -- Tepebaşı
--   (1033, 'Soma'),   -- Soma
--   (1034, 'Kırıkhan'),   -- Kırıkhan
--   (1035, 'Göynük'),   -- Göynük
--   (1036, 'Dilovası'),   -- Dilovası
--   (1037, 'Aliağa'),   -- Aliağa
--   (1038, 'Aliağa'),   -- Aliaga
--   (1039, 'Kızıltepe'),   -- Kızıltepe
--   (1041, 'Zeytinburnu'),   -- Zeytinburnu
--   (1042, 'Karacabey'),   -- Karacabey
--   (1043, 'Muratlı'),   -- Muratli
--   (1046, 'Bornova'),   -- Bornova
--   (1049, 'Körfez'),   -- Körfez
--   (1081, 'Lüleburgaz'),   -- Lüleburgaz
--   (1082, 'Lüleburgaz'),   -- Luleburgaz
--   (1090, 'Esenyurt'),   -- Esenyurt
--   (1091, 'Bayrampaşa'),   -- Bayrampaşa
--   (1094, 'Mustafakemalpaşa'),   -- Mustafakemalpaşa
--   (1097, 'Akşehir'),   -- Akşehir
--   (1098, 'Akşehir'),   -- Aksehir
--   (1099, 'Simav'),   -- Simav
--   (1100, 'Gebze'),   -- Gebze
--   (1101, 'Manavgat'),   -- Manavgat
--   (1102, 'Alanya'),   -- Alanya
--   (1103, 'Doğubayazıt'),   -- Doğubayazıt
--   (1104, 'Doğubayazıt'),   -- Doğubeyazıt
--   (1105, 'Doğubayazıt'),   -- Dogubayazit
--   (1106, 'Çifteler'),   -- Çifteler
--   (1114, 'Çiğli'),   -- Çiğli
--   (1116, 'Eyüpsultan'),   -- Eyüp
--   (1117, 'Avcılar'),   -- Avcılar
--   (1118, 'Gönen'),   -- Gönen
--   (1122, 'Çerkezköy'),   -- Çerkezköy
--   (1123, 'Çorlu'),   -- Çorlu
--   (1124, 'Salihli'),   -- Salihli
--   (1125, 'Bozüyük'),   -- Bozüyük
--   (1128, 'Ataşehir'),   -- Ataşehir
--   (1129, 'Kadıköy'),   -- Kadıköy
--   (1132, 'Nurdağı'),   -- Nurdağı
--   (1133, 'Sarıçam'),   -- Sariçam
--   (1134, 'Kuşadası'),   -- Kuşadası
--   (1136, 'Elbistan'),   -- Elbistan
--   (1160, 'Ayancık'),   -- ayancık
--   (1163, 'Çubuk'),   -- çubuk
--   (1167, 'Bozüyük'),   -- bozüyük
--   (1168, 'Ilgın'),   -- ilgın
--   (1171, 'Elmadağ'),   -- elmadağ
--   (1197, 'Emirdağ'),   -- emirdag
--   (1203, 'Vakfıkebir'),   -- vakfikebir
--   (1206, 'Reyhanlı'),   -- reyhanli
--   (1208, 'Karkamış'),   -- karkamış
--   (1212, 'Alaşehir'),   -- alaşehir
--   (1215, 'Darıca'),   -- darıca
--   (1225, 'Şereflikoçhisar'),   -- şereflikoçhisar
--   (1234, 'Orhangazi'),   -- orhangazı
--   (1240, 'Üsküdar'),   -- üsküdar
--   (1247, 'Başiskele'),   -- başiskele
--   (1253, 'Söğüt'),   -- söğüt
--   (1255, 'Seydişehir'),   -- seydişehir
--   (1284, 'Söke')   -- söke
-- ) AS v(id, d)
-- WHERE a.id = v.id AND a.district IS NULL;

-- =============================================================================
-- BÖLÜM 4 — ELLE KARAR GEREKTİRENLER (6 grup)
-- =============================================================================
-- Otomatik kural bunlara UYGULANMAZ: aynı alias GERÇEKTEN farklı yerlere
-- işaret ediyor ya da hangi ilçe adının doğru olduğu bilgi gerektiriyor.
-- Her biri ayrı ayrı, gerekçesiyle. İstemediğini atla.

-- ---------------------------------------------------------------------------
-- 4.1  payas → GERÇEK HATA, bunu mutlaka düzelt
--      Payas 2008'den beri HATAY ilçesi. id=1003 'Adana' diyor ve küçük id
--      olduğu için ŞU AN KAZANAN O — bugün her "payas" ilanı Adana'ya yazılıyor.
-- UPDATE public.aliases SET normalized = 'Hatay', district = 'Payas' WHERE id = 1003;

-- ---------------------------------------------------------------------------
-- 4.2  kazan → Kazan ilçesinin adı 2016'da KAHRAMANKAZAN oldu.
-- UPDATE public.aliases SET district = 'Kahramankazan' WHERE id IN (987, 2752);

-- ---------------------------------------------------------------------------
-- 4.3  ömerli → 'Ömerli' bir MAHALLE; ilçesi Çekmeköy. `district` kolonu ilçe
--      tutmalı. (Mardin/Ömerli AYRI bir yer, bu satır İstanbul'u gösteriyor.)
-- UPDATE public.aliases SET district = 'Çekmeköy' WHERE id = 2249;

-- ---------------------------------------------------------------------------
-- 4.4  kıraç → 'Kıraç' bir MAHALLE; ilçesi Esenyurt.
-- UPDATE public.aliases SET district = 'Esenyurt' WHERE id = 2678;

-- ---------------------------------------------------------------------------
-- 4.5  gölbaşı → GERÇEK BELİRSİZLİK. Hem Ankara'nın hem Adıyaman'ın ilçesi.
--      Tek başına "gölbaşı" kelimesi ayırt edilemez. Şu an id=988 (Ankara)
--      kazanıyor. Nakliye trafiğinde Ankara/Gölbaşı baskın olduğu için onu
--      bırakıp diğerini pasifleştirmek makul — `araç` ile aynı mantık.
-- UPDATE public.aliases SET district = 'Gölbaşı' WHERE id = 988;
-- UPDATE public.aliases SET is_active = false WHERE id = 1316;   -- Adıyaman

-- ---------------------------------------------------------------------------
-- 4.6  kemalpaşa → İzmir/Kemalpaşa bir İLÇE; Artvin/Kemalpaşa Hopa'ya bağlı
--      bir BELDE. İzmir kıyasla çok daha yaygın. Şu an zaten İzmir kazanıyor;
--      bu değişiklik mevcut davranışı KORUYUP belirsizliği kaldırır.
-- UPDATE public.aliases SET district = 'Kemalpaşa' WHERE id = 1021;
-- UPDATE public.aliases SET is_active = false WHERE id = 1441;   -- Artvin

-- =============================================================================
-- BÖLÜM 5 — DOĞRULAMA (BÖLÜM 1-4 sonrası çalıştır, İKİSİ DE BOŞ dönmeli)
-- =============================================================================
-- 5.1 kopya grupları içinde çelişki kaldı mı?
SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
       array_agg(DISTINCT normalized)                AS n,
       array_agg(DISTINCT coalesce(district, '∅'))   AS d
FROM public.aliases
WHERE type = 'city' AND is_active = true
GROUP BY 1
HAVING count(DISTINCT normalized) > 1
    OR count(DISTINCT coalesce(district, '∅')) > 1
ORDER BY 1;

-- 5.2 ASCII'ye indirgendiğinde çakışan normalized/district değeri kaldı mı?
SELECT 'normalized' AS kolon, translate(normalized, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC') AS katlanmis,
       array_agg(DISTINCT normalized) AS degerler
FROM public.aliases WHERE type = 'city' AND is_active = true
GROUP BY 2 HAVING count(DISTINCT normalized) > 1
UNION ALL
SELECT 'district', translate(district, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC'),
       array_agg(DISTINCT district)
FROM public.aliases WHERE type = 'city' AND is_active = true AND district IS NOT NULL
GROUP BY 2 HAVING count(DISTINCT district) > 1;

-- =============================================================================
-- BÖLÜM 6 — Geçmiş `listings` satırları  🚨 GEÇERSİZ — ÇALIŞTIRMA
-- =============================================================================
-- 🚨🚨 BU BÖLÜM YANLIŞ TABLOYU ONARIYOR (29 Tem 2026, W5'te tespit edildi).
--
-- İki hata:
--   1) `listings.destination_city` diye bir kolon **YOKTUR**.
--      🚨🚨 DÜZELTME (31 Tem 2026, #28): buraya önce "ÖLÜ KOLON" yazılmıştı.
--      Yanlıştı — kolon ölü değil, HİÇ YOK. Ölçüm denendiğinde Postgres
--      `ERROR: 42703: column "destination_city" does not exist` döndü;
--      `information_schema.columns` teyit etti. Yani aşağıdaki blok
--      "gereksiz iş yapıyor" değil, **ilk UPDATE'te patlıyor**.
--      ⚠️ Bu ayrım önemli: "ölü kolon" denince akla "sonra düşürürüz" gelir ve
--      madde Dalga 5 drop listesine yazılır — nitekim yazıldı, oradan da
--      42703 verecekti. "Kolon yok" denince madde tamamen DÜŞER.
--      Varış verisi `public.listing_stops` satırlarında:
--      yazan  supabase/functions/parse-listing/index.ts:825
--      okuyan app/_components/HomeClient.tsx:696 (ana sayfa varış filtresi)
--      Yani bu bölüm kullanıcıya GÖRÜNEN kolonu (`listing_stops.city`) hiç
--      onarmıyor; onarım bittikten sonra bile varış aramaları bozuk kalır.
--      `listings.origin_district` ve `listing_stops.district` de atlanıyor.
--   2) `origin_city = destination_city` SAHTELİK SİNYALİ DEĞİL. Aynı şehir
--      içinde taşıma meşru bir hizmettir. Sahte güzergâhın parmak izi yazım
--      farkıdır: katlanmış anahtar eşit ama ham string farklı
--      ('Istanbul' vs 'İstanbul').
--
-- ✅ YERİNE KULLAN: docs/20260729_alias_runbook.md → Adım 8.
--    Dört konum kolonunu birlikte onarıyor ve elle CASE listesi yerine
--    `aliases` tablosunu sözlük olarak kullanıyor (belirsiz anahtarlar
--    HAVING count(DISTINCT …) = 1 ile elle bırakılıyor).
--
-- Aşağıdaki blok yalnızca TARİHSEL KAYIT olarak bırakıldı — tamamı yorumda.
-- 🚫 `destination_city` geçen satırlar 42703 verir (kolon yok); yorumdan
--    çıkarılmamalı, "düzeltilip kullanılabilir" bir taslak DEĞİL.
-- ---------------------------------------------------------------------------
-- SELECT 'origin' AS yon, origin_city AS sehir, count(*) FROM public.listings
-- WHERE origin_city IN ('Istanbul','Izmir','Mugla','Bingol') GROUP BY 1,2
-- UNION ALL
-- SELECT 'destination', destination_city, count(*) FROM public.listings   ← 42703
-- WHERE destination_city IN ('Istanbul','Izmir','Mugla','Bingol') GROUP BY 1,2
-- ORDER BY 3 DESC;
--
-- UPDATE public.listings SET origin_city = CASE origin_city
--   WHEN 'Istanbul' THEN 'İstanbul' WHEN 'Izmir' THEN 'İzmir'
--   WHEN 'Mugla' THEN 'Muğla' WHEN 'Bingol' THEN 'Bingöl' END
-- WHERE origin_city IN ('Istanbul','Izmir','Mugla','Bingol');
-- UPDATE public.listings SET destination_city = CASE destination_city   ← 42703
--   WHEN 'Istanbul' THEN 'İstanbul' WHEN 'Izmir' THEN 'İzmir'
--   WHEN 'Mugla' THEN 'Muğla' WHEN 'Bingol' THEN 'Bingöl' END
-- WHERE destination_city IN ('Istanbul','Izmir','Mugla','Bingol');
--
-- SELECT count(*) FROM public.listings WHERE origin_city = destination_city;  ← 42703

-- =============================================================================
-- NOT — Kalıcı çözüm (bu script tekrarı ÖNLEMEZ)
-- =============================================================================
-- Bu script MEVCUT kopyaların zararını keser; YENİSİNİN oluşmasını engellemez.
-- 538 kopya grubunun büyük kısmı AI'ın (`created_by_ai = true`) aynı yeri farklı
-- yazımla tekrar eklemesinden doğdu. Kalıcı çözüm:
--   1) `aliases` üzerine BEFORE INSERT/UPDATE trigger: `alias` yazılırken
--      normalize edilsin.
--   2) Normalize forma UNIQUE indeks:
--      CREATE UNIQUE INDEX ON public.aliases
--        (type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu'));
--      ⚠️ ÖNCE bu script çalışmalı, yoksa indeks kurulmaz.
--   3) `normalized` ve `district` için il/ilçe referans tablosuna FK — AI'ın
--      uydurma/bozuk yazım üretmesi böylece imkânsızlaşır.

