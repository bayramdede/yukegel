-- =============================================================================
-- Radar + Radar Analitik hızlandırma — 8 Ağustos 2026
-- =============================================================================
--
-- İSTEK (Bayram): "Radar ve radar analitik sayfalarını da geliştir. Hızlandır."
--
-- =============================================================================
-- BÖLÜM 0 — ÖLÇÜM: ÖNCE YANLIŞ ÖLÇTÜM, SONRA DÜZELTTİM
-- =============================================================================
-- İlk okumalar tutarsızdı: aynı fonksiyon 11.364 ms, sonra 1.348 ms, sonra
-- 7.062 ms, sonra 233 ms. Sebep BUFFER CACHE: tek ölçüm bu tabloda hiçbir şey
-- söylemiyor (`listings` 495 MB, 133 MB'ı `raw_text`).
--
-- Tekrarlı ölçüm gerçeği ortaya çıkardı:
--   get_radar_intelligence, HER YENİ ROTA (soğuk sayfa):
--     34→6: 2.876 ms · 35→16: 5.404 ms · 1→42: 7.304 ms · 7→33: 4.539 ms
--   AYNI rotanın 2./3. çağrısı: 45-250 ms
--
-- 📌 DERS: "sıcak" ölçüm bu sayfalarda YANILTICI. Gerçek kullanım deseni her
-- seferinde farklı rota/il = her seferinde soğuk sayfa. Optimizasyon kararını
-- sıcak sayıya bakarak vermek yanlış yere yatırım yapmak olurdu.
--
-- =============================================================================
-- BÖLÜM 1 — UYGULA: KAPSAYICI İNDEKSLER (kanıtlanmış, sayfa sayısıyla ölçüldü)
-- =============================================================================
-- Sayfa sayısı (Buffers) önbellekten BAĞIMSIZ bir metrik — bu yüzden kararı
-- ona dayandırdım, süreye değil.

-- 1.1 dest_ids CTE'si yalnız `listing_id` okuyor ama indeks onu taşımıyordu →
--     her çağrıda 3.422 heap bloğu. Kapsayıcı hâli Index Only Scan yapar.
create index concurrently if not exists listing_stops_province_listing_idx
  on public.listing_stops (province_id, listing_id)
  where province_id is not null;
-- ÖLÇÜM: dest_ids 3.444 → 194 sayfa · 323 ms → 80 ms

-- 1.2 Analitik özeti (`get_radar_city_overview`) okuduğu TÜM kolonları
--     indeksten alabilir → 495 MB'lık heap'e hiç dokunmaz.
create index concurrently if not exists listings_radar_ozet_idx
  on public.listings (created_at desc)
  include (origin_province_id, contact_phone, id)
  where origin_province_id is not null;
-- ÖLÇÜM (aynı sıcaklıkta, iç sorgu):
--   ÖNCE : Bitmap Heap Scan · 8.974 sayfa (8.772 heap bloğu) · 1.137 ms
--   SONRA: Index Only Scan  · 3.061 sayfa · Heap Fetches: 0   ·   306 ms

-- 1.3 Kalkış ili + tarih filtresi için kapsayıcı indeks (ID fazı index-only olsun)
create index concurrently if not exists listings_radar_kaynak_idx
  on public.listings (origin_province_id, created_at desc)
  include (id)
  where origin_province_id is not null;

vacuum (analyze) public.listings;
vacuum (analyze) public.listing_stops;
-- ⚠️ VACUUM ŞART: Index Only Scan, görünürlük haritası (visibility map) bayatsa
--    "Heap Fetches" ile heap'e düşer ve kazancı yer. Ölçümde 12.804 heap fetch
--    görüp bunu fark ettim; VACUUM sonrası 0.

-- =============================================================================
-- BÖLÜM 2 — DENENDİ VE GERİ ALINDI: iki fazlı `get_radar_intelligence`
-- =============================================================================
-- HİPOTEZ: `route_listings` İstanbul kalkışlı 25.539 satırın TAMAMINI (raw_text
-- TOAST'u dahil) heap'ten okuyor, sonra varış filtresi 1.831'ini bırakıyor —
-- okunan verinin %93'ü çöp. "Önce ID kümesi (index-only), sonra yalnız hayatta
-- kalanlar için geniş kolonlar" diye ikiye bölersek soğuk maliyet düşer.
--
-- SONUÇ: KONTROLLÜ ÖLÇÜM DESTEKLEMEDİ. v1 (tek fazlı) ve v2 (iki fazlı) ayrı
-- soğuk rotalarda karşılaştırıldığında v2 tutarlı biçimde iyi çıkmadı, bazı
-- rotalarda belirgin daha KÖTÜ oldu.
--
-- ⚠️ ÖLÇÜMÜN KENDİSİ NEDEN ZOR: (a) aynı rotayı iki kez ölçemezsin, ilk çağrı
-- sayfaları ısıtır; (b) rota YÖNÜ simetrik değil — varışı İstanbul olan bir
-- sorgu, kalkışı İstanbul olandan yapısal olarak farklı maliyette (dest_ids
-- şişiyor). Bu yüzden "v1'e şu rotalar, v2'ye şu rotalar" karşılaştırması da
-- kirli. Elimde v2'nin daha iyi olduğuna dair KANIT olmadığı için canlıda
-- kanıtlanmamış karmaşıklık bırakmadım: orijinal gövde geri döndü.
-- (migration: `radar_intelligence_iki_fazli_geri_alindi`)
--
-- 📌 DERS: mantıklı görünen bir optimizasyon ölçümle doğrulanmıyorsa
-- geri alınır. "Mantıklı" yeterli değil.

-- =============================================================================
-- BÖLÜM 3 — ASIL ÇÖZÜM: UYGULAMA KATMANINDA ÖNBELLEK (`lib/radar-cache.ts`)
-- =============================================================================
-- Soğuk başlangıç maliyeti tek bir sorgu ayarıyla çözülmüyor: veri 495 MB ve
-- her rota farklı sayfalara dokunuyor. Ama GERÇEK KULLANIM DESENİ tekrarlı —
-- admin aynı rotayı/ili ileri-geri açıyor, `days` filtresini değiştirip geri
-- alıyor, "tümü/kontrat" arasında geçiyor.
--
--   · 90 sn TTL, süreç-içi bellek (`lib/kota.ts` ile aynı desen)
--   · Anahtar: radar → `rota:<fromId>:<toId>:<days>`
--             analitik → `ozet:<days>` / `il:<id>:<yon>:<days>:<karsi>`
--   · `mode` (tümü/kontrat) anahtarın DIŞINDA: filtre önbellekten SONRA
--     uygulanıyor, sekme değiştirmek yeni sorgu tetiklemiyor
--   · HATA ÖNBELLEKLENMEZ (üretici fonksiyon throw ediyor)
--   · Tavan 200 girdi (rota kombinasyonu çok, bellek sızmasın)
--
-- ⚠️ TAZELİK GİZLENMİYOR: yanıt `onbellek`/`yas_sn` döndürüyor, arayüz
--    "⚡ N sn önce hesaplandı" + "↻ Yenile" gösteriyor. Yenile butonu
--    `taze=1` gönderip önbelleği ATLIYOR — göndermeseydi buton aynı önbellekli
--    yanıtı geri alır ve kullanıcıya YALAN söylerdi. (Bu projede sessiz bayat
--    veri tekrarlayan bir hata sınıfı; onu üretmemek için tazelik hep görünür.)

-- =============================================================================
-- BÖLÜM 4 — COĞRAFİ STANDART DURUMU (kontrol edildi)
-- =============================================================================
-- Radar'ın DB katmanı ZATEN tamamen `province_id` tabanlı (Dalga 3). Doğrulandı:
--   select proname,
--     pg_get_functiondef(oid) ilike '%origin_city%' as metin_kolonu_kullaniyor,
--     pg_get_functiondef(oid) ~* 'city\s+ilike'     as city_ilike,
--     pg_get_functiondef(oid) ilike '%province_id%' as province_id
--   from pg_proc where proname like '%radar%';
--   → üç fonksiyonun ÜÇÜ de: metin_kolonu=false, city_ilike=false, province_id=true ✅
-- İl adı yalnız HTTP/arayüz sınırında kullanılıyor ve `ilId()` ile çevriliyor;
-- bu bilinçli (derin bağlantılar `?from_city=İstanbul` ile çalışıyor).

-- =============================================================================
-- BÖLÜM 5 — GERİ ALMA
-- =============================================================================
-- drop index concurrently if exists public.listing_stops_province_listing_idx;
-- drop index concurrently if exists public.listings_radar_ozet_idx;
-- drop index concurrently if exists public.listings_radar_kaynak_idx;
-- (önbellek için: `lib/radar-cache.ts` içindeki TTL_MS = 0 yapılabilir)
