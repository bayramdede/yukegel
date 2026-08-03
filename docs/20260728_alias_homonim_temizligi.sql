-- =============================================================================
-- aliases: ilçe adı ile günlük kelime çakışması (homonim) temizliği
-- 28 Tem 2026
-- =============================================================================
--
-- SORUN
-- -----
-- Bazı ilçe adları nakliye ilanlarında SÜREKLİ geçen sıradan Türkçe kelimeler:
--
--   "araç"      → Kastamonu/Araç      ama metinde "1 tente araç" = vasıta
--   "olur"      → Erzurum/Olur        ama "kapalı olur" = uygundur
--   "pazar"     → Rize/Pazar          ama "pazar günü"
--   "çarşamba"  → Samsun/Çarşamba     ama haftanın günü
--   "perşembe"  → Ordu/Perşembe       ama haftanın günü
--   "merkez"    → onlarca ilin ilçesi ama "merkez depo"
--
-- Bunlar KELİME olarak eşleştiği için kod tarafındaki substring düzeltmesi
-- (28 Tem 2026) bu satırları TEMİZLEMEZ. Veri tarafında çözülmeli.
--
-- ETKİSİ İKİ YERDE
--   1. app/api/whatsapp-parse → gatekeeper: sahte şehirler `foundCities` sayısını
--      şişirip `isAd` kuralını ("telefon && (araç || şehir>=2)") anlamsızlaştırıyor.
--   2. supabase/functions/parse-listing → findPlaces: ilanın GERÇEK güzergâhına
--      yanlış şehir yazılabiliyor.

-- =============================================================================
-- ADIM 1 — Şüphelileri listele (önce bak, sonra karar ver)
-- =============================================================================
SELECT id, alias, normalized, district, type, priority, is_active, created_by_ai
FROM public.aliases
WHERE type = 'city'
  AND is_active = true
  AND lower(alias) IN (
    'arac','araç','olur','pazar','carsamba','çarşamba','persembe','perşembe',
    'sali','salı','merkez','orta','guney','güney','kuzey','ulus','kale','cay','çay',
    'hani','yeni','buyuk','büyük','ova','yol','ada','koy','köy','bahce','bahçe',
    'saray','sultan','yesil','yeşil','ak','kara','sari','sarı','golbasi','gölbaşı'
  )
ORDER BY alias;

-- =============================================================================
-- ADIM 2 — Ölçüm: hangi alias gerçekte kaç mesajda "şehir" sanılıyor?
-- =============================================================================
-- ⚠️ İLK HALİ ZAMAN AŞIMINA UĞRADI. Sebebi: `JOIN ... ON raw_text ~* alias`
-- her (alias, mesaj) ÇİFTİ için ayrı regex derliyordu → 1887 × N karşılaştırma.
-- Doğru yol: mesajları BİR KEZ kelimelere böl, sonra alias'la EŞİTLİK üzerinden
-- join et (hash join). Aşağıdaki sürüm saniyeler içinde döner.

WITH ornek AS (
  -- Örneklem: son 30 günden en fazla 3000 mesaj. Homonim tespiti için fazlasıyla
  -- yeterli; tam tarama gerekmiyor. Yavaşsa LIMIT'i düşür.
  SELECT id,
         translate(lower(replace(raw_text, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS metin
  FROM public.raw_posts
  WHERE created_at > now() - interval '30 days'
    AND raw_text IS NOT NULL
  LIMIT 3000
),
kelimeler AS (
  -- Mesaj başına BENZERSİZ kelimeler → sayım "kaç mesajda geçti" anlamına gelir,
  -- "kaç kez geçti" değil.
  SELECT DISTINCT id, regexp_split_to_table(metin, '[^a-z0-9]+') AS kelime
  FROM ornek
),
sayim AS (
  SELECT kelime, count(*) AS gecen_mesaj
  FROM kelimeler
  WHERE length(kelime) >= 3
  GROUP BY kelime
)
SELECT a.alias, a.normalized, a.district, s.gecen_mesaj
FROM public.aliases a
JOIN sayim s
  ON translate(lower(replace(a.alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') = s.kelime
WHERE a.type = 'city'
  AND a.is_active = true
ORDER BY s.gecen_mesaj DESC
LIMIT 40;

-- Nasıl okunur: listenin TEPESİ şüpheli. Gerçek bir il/ilçe adının 3000 mesajın
-- yüzlercesinde geçmesi normal değildir — "arac", "olur", "merkez" gibi günlük
-- kelimeler oraya çıkar. İl adları (istanbul, mersin, ankara) da yüksek çıkar
-- ama onlar DOĞRU eşleşmedir; ayırt etmek için `district` kolonuna bak:
-- dolu olan satırlar ilçe alias'ıdır ve yüksek sayı orada şüphelidir.

-- =============================================================================
-- ADIM 2 SONUCU (28 Tem 2026) — tek suçlu: `araç`
-- =============================================================================
-- İlk 40'ta homonim olarak SADECE `araç`/`arac` çıktı:
--
--   arac / araç → Kastamonu (ilçe: Araç)   3000 mesajın 580'inde  (%19)
--
-- Sıralamada Bursa'nın (534) ÜSTÜNDE. Bir ilçe adının il adlarını geçmesi tek
-- başına yeterli kanıt. Listedeki diğer yüksek satırlar (Gebze 451, Çorlu 290,
-- Torbalı 238, Esenyurt 233, Tuzla 219) gerçek nakliye merkezleri — meşru.
-- `olur`, `merkez`, `pazar`, `perşembe` ilk 40'a girmedi; ADIM 1 ile ayrıca bak.

-- =============================================================================
-- ADIM 3 — `araç` alias'ını pasifleştir
-- =============================================================================
-- SİLME değil: is_active = false. Geri alınabilir ve alias geçmişi korunur.
-- Kastamonu/Araç gerçekten geçtiğinde artık yakalanmaz; bu kabul edilen bedel.
-- Alternatif (daha iyi ama iş gerektirir): yalnızca "kastamonu arac" bigram'ı
-- olarak eşleşsin diye alias'ı iki kelimeye çevirmek.

-- ⚠️ 28 Tem 2026 EK BULGU: `olur` da DOĞRULANDI. Algoritma gerçek alias
-- tablosuyla yerel olarak çalıştırıldı; şu mesaj Erzurum eşleşmesi üretti:
--   "ANTEP >> SİVAS KOYULHİSAR HAFİF YARIM TIRLIK KAMYONDA OLUR"
--   → Gaziantep ✅ | Sivas ✅ | Erzurum ← 'olur' ❌
-- ADIM 2 ölçümü ilk 40'a bakıyordu, `olur` altta kaldığı için kaçmıştı.

-- Önce gör:
SELECT id, alias, normalized, district, is_active
FROM public.aliases
WHERE type = 'city' AND lower(alias) IN ('arac', 'araç', 'olur');

-- Sonra uygula:
-- UPDATE public.aliases
-- SET is_active = false
-- WHERE type = 'city' AND lower(alias) IN ('arac', 'araç', 'olur');

-- GERİ ALMA: aynı WHERE ile is_active = true.

-- =============================================================================
-- ADIM 4 — Alias tablosundaki KOPYALAR (ayrı sorun, ayrı fayda)
-- =============================================================================
-- ADIM 2 çıktısı aynı alias'ın birden çok yazımla kayıtlı olduğunu gösterdi:
--   Gebze / GEBZE / gebze,  Çorlu / çorlu / corlu,  izmir / izmır,
--   Torbali / torbali / torbalı,  Tuzla / tuzla,  balıkesir / balikesir
--
-- `alias` kolonu unique olduğu için bunlar AYRI satırlar. Eşleşme sırasında
-- `trNorm` hepsini aynı forma indirdiğinden YANLIŞ sonuç üretmezler — ama:
--   • 1887 satırın önemli bir kısmı gereksiz (her mesajda baştan taranıyor),
--   • `district` kolonu kopyalar arasında TUTARSIZ (birinde 'Gebze', diğerinde
--     NULL). `findPlaces` ilk eşleşmeyi alıp `seen`'e eklediği için hangi kopyanın
--     önce geldiğine göre İLÇE BİLGİSİ KAYBOLUYOR. Bu gerçek bir veri kaybı.

-- 4.1 — Kopyaları gör (normalize edilmiş forma göre gruplanmış):
SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
       count(*)                                        AS kopya,
       array_agg(alias ORDER BY alias)                 AS yazimlar,
       array_agg(DISTINCT normalized)                  AS normalized_degerleri,
       array_agg(DISTINCT coalesce(district, '∅'))     AS district_degerleri
FROM public.aliases
WHERE type = 'city' AND is_active = true
GROUP BY 1
HAVING count(*) > 1
ORDER BY count(*) DESC, 1
LIMIT 50;

-- 4.2 — TEHLİKELİ olanlar: kopyalar FARKLI `normalized` gösteriyorsa, hangisinin
--       kazandığı sıraya bağlıdır → şehir yanlış atanabilir. Bu boş dönmeli.
SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
       array_agg(DISTINCT normalized) AS celisen_normalized
FROM public.aliases
WHERE type = 'city' AND is_active = true
GROUP BY 1
HAVING count(DISTINCT normalized) > 1
ORDER BY 1;

-- 4.3 — Birleştirme fikri (ÖNCE 4.1/4.2 çıktısına bak, sonra karar ver):
--   a) Her normalize form için TEK satır bırak; district'i dolu olanı tercih et.
--   b) Kalanları is_active = false yap.
-- Otomatik yazmadım: `normalized` çelişkisi varsa (4.2) elle karar gerekir.

-- =============================================================================
-- ADIM 4 SONUCU (28 Tem 2026) — kopyalar yaygın, iki ayrı zarar var
-- =============================================================================
-- 4.1 yüzlerce grup döndürdü. İki farklı sorun ayrışıyor:
--
-- (a) ÇELİŞEN `normalized` — 4.2'nin boş dönmesini beklemiştim, dönmüyor:
--       avcilar   → {Istanbul, İstanbul}
--       hadimkoy  → {Istanbul, İstanbul}
--     Şehir YANLIŞ değil, YAZIMI tutarsız. `normalized` ilana yazılan değer
--     olduğu için bir kısım ilan 'Istanbul', bir kısmı 'İstanbul' kaydediliyor;
--     şehir filtresi bunları İKİ AYRI ŞEHİR sayar.
--
-- (b) ÇELİŞEN `district` — çok daha yaygın. İki alt tipi var:
--       • NULL vs dolu:  gebze, çorlu, torbalı, alanya, çiğli, sincan, aksehir,
--         aliaga, luleburgaz, kadikoy, beylikduzu ... (onlarca)
--         → `findPlaces` ilk eşleşmeyi alıp `seen`'e eklediği için hangi kopyanın
--           önce geldiğine göre İLÇE KAYBOLUYOR.
--       • Yazım farkı: Avcilar/Avcılar, Hadimkoy/Hadımköy, Kirkağaç/Kırkağaç,
--         Ulukisla/Ulukışla, Alaçati/Alaçatı, Kazan/Kahramankazan.
--
-- KARAR: kopya satırları SİLMİYORUZ. Her gruptaki TÜM satırlara aynı doğru
-- `normalized` + `district` yazıyoruz. Eşleşme zaten `trNorm` ile normalize
-- ettiği için hangi satırın kazandığı böylece önemsizleşir. Satır pasifleştirmeye
-- göre çok daha düşük riskli — hiçbir alias kaybolmaz.

-- =============================================================================
-- ADIM 5 — Kopya gruplarını tek doğru değere hizala
-- =============================================================================
-- Kanonik değer seçimi:
--   normalized → Türkçe karakter İÇEREN yazım tercih edilir. Gerekçe: bir değer
--                ASCII'ye indirgenmiş haliyle AYNI ise ('Istanbul'), zaten
--                bozulmuş demektir; farklıysa ('İstanbul') orijinaldir.
--   district   → önce NOT NULL, sonra aynı Türkçe-karakter kuralı.

-- 5.1 — ÖNCE BAK: ne değişecek? (hiçbir şey yazmaz)
WITH kanonik AS (
  SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
         (array_agg(normalized ORDER BY
            (normalized <> translate(normalized, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC')) DESC,
            normalized))[1] AS y_normalized,
         (array_agg(district ORDER BY
            (district IS NOT NULL) DESC,
            (district <> translate(district, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC')) DESC,
            district))[1] AS y_district
  FROM public.aliases
  WHERE type = 'city' AND is_active = true
  GROUP BY 1
)
SELECT a.id, a.alias,
       a.normalized AS eski_normalized, k.y_normalized,
       a.district   AS eski_district,   k.y_district
FROM public.aliases a
JOIN kanonik k
  ON translate(lower(replace(a.alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') = k.norm_alias
WHERE a.type = 'city' AND a.is_active = true
  AND (a.normalized IS DISTINCT FROM k.y_normalized
    OR a.district   IS DISTINCT FROM k.y_district)
ORDER BY k.norm_alias, a.alias;

-- 5.2 — SONRA UYGULA (5.1 çıktısı mantıklıysa yorumu kaldır):
-- WITH kanonik AS (
--   SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
--          (array_agg(normalized ORDER BY
--             (normalized <> translate(normalized, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC')) DESC,
--             normalized))[1] AS y_normalized,
--          (array_agg(district ORDER BY
--             (district IS NOT NULL) DESC,
--             (district <> translate(district, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC')) DESC,
--             district))[1] AS y_district
--   FROM public.aliases
--   WHERE type = 'city' AND is_active = true
--   GROUP BY 1
-- )
-- UPDATE public.aliases a
-- SET normalized = k.y_normalized,
--     district   = k.y_district
-- FROM kanonik k
-- WHERE translate(lower(replace(a.alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') = k.norm_alias
--   AND a.type = 'city' AND a.is_active = true
--   AND (a.normalized IS DISTINCT FROM k.y_normalized
--     OR a.district   IS DISTINCT FROM k.y_district);

-- 5.3 — DOĞRULAMA: 4.2'yi tekrar çalıştır, artık BOŞ dönmeli.
--       Ayrıca district çelişkisi de kalmamalı:
-- SELECT translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') AS norm_alias,
--        array_agg(DISTINCT normalized) AS n, array_agg(DISTINCT district) AS d
-- FROM public.aliases WHERE type='city' AND is_active = true
-- GROUP BY 1 HAVING count(DISTINCT normalized) > 1 OR count(DISTINCT district) > 1;

-- =============================================================================
-- ADIM 6 — Geçmiş ilanlarda 'Istanbul' / 'İstanbul' karışıklığı
-- =============================================================================
-- Alias düzeltilse bile GEÇMİŞTE kaydedilmiş ilanlar bozuk kalır. Önce ölç:
-- SELECT origin_city, count(*) FROM public.listings
-- WHERE origin_city IN ('Istanbul','İstanbul') GROUP BY 1;
-- 🚫 ESKİ HÂLİ: "(aynısını destination_city için de çalıştır)" — ÇALIŞTIRMA.
--    `listings.destination_city` diye bir kolon YOK (31 Tem 2026, #28 — 42703
--    `column "destination_city" does not exist`). "Ölü kolon" değil, hiç yok.
--    ✅ Varış tarafının doğru karşılığı `public.listing_stops.city`; ilan başına
--    ÇOK satır olduğu için sorgu da farklı yazılır:
--      SELECT city, count(*) FROM public.listing_stops
--      WHERE city IN ('Istanbul','İstanbul') GROUP BY 1;
-- Sayı anlamlıysa UPDATE ile 'İstanbul'a çevrilmeli. ⚠️ ÖNCE ölç, sonra karar ver.

-- =============================================================================
-- NOT — Kalıcı çözüm
-- =============================================================================
-- İlçe adları il adı olmadan tek başına güvenilmez. Uzun vadede ilçe alias'ları
-- yalnızca yanında il geçtiğinde (bigram) eşleşmeli; `findPlaces` bigram desteği
-- zaten var, tekil ilçe eşleşmesini `priority` ile zayıflatmak da bir seçenek.
-- Ayrıca alias yazımı DB'ye girerken normalize edilmeli ki kopyalar hiç oluşmasın:
-- `aliases` üzerine BEFORE INSERT/UPDATE trigger + normalize edilmiş forma UNIQUE
-- indeks konursa 'Gebze'/'GEBZE'/'gebze' üçlüsü bir daha oluşamaz. ADIM 5 mevcut
-- kopyaların ZARARINI keser ama YENİSİNİN oluşmasını engellemez.
