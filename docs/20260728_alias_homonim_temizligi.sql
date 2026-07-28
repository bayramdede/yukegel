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
-- Şüpheli kelimenin son 30 günün mesajlarında kaç kez KELİME olarak geçtiğini
-- sayar. Yüksek sayı = o alias gatekeeper'ı bozuyor demektir.
SELECT a.alias, a.normalized, count(*) AS gecen_mesaj
FROM public.aliases a
JOIN public.raw_posts r
  ON r.raw_text ~* ('(^|[^a-zçğıöşü])' || a.alias || '([^a-zçğıöşü]|$)')
WHERE a.type = 'city'
  AND a.is_active = true
  AND length(a.alias) <= 8
  AND r.created_at > now() - interval '30 days'
GROUP BY a.alias, a.normalized
HAVING count(*) > 50
ORDER BY count(*) DESC
LIMIT 40;

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
