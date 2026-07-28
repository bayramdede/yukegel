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
-- ADIM 3 — Pasifleştir (SİLME, is_active = false yeterli ve geri alınabilir)
-- =============================================================================
-- ADIM 1/2 çıktısına bakıp listeyi daralttıktan SONRA çalıştır.
--
-- UPDATE public.aliases
-- SET is_active = false
-- WHERE type = 'city'
--   AND lower(alias) IN ('arac','olur','merkez');   -- ← listeyi sen belirle
--
-- GERİ ALMA: aynı WHERE ile is_active = true.

-- =============================================================================
-- NOT — Kalıcı çözüm
-- =============================================================================
-- İlçe adları il adı olmadan tek başına güvenilmez. Uzun vadede ilçe alias'ları
-- yalnızca yanında il geçtiğinde (bigram) eşleşmeli; `findPlaces` bigram desteği
-- zaten var, tekil ilçe eşleşmesini `priority` ile zayıflatmak da bir seçenek.
