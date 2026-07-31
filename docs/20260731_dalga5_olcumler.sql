-- ============================================================================
-- DALGA 5 — DROP ÖNCESİ ÖLÇÜMLER  (#28 + #27)  — 31 Tem 2026
-- Hepsi SALT OKUNUR. Hiçbiri veri değiştirmez, hiçbiri geri alınamaz değil.
-- ============================================================================
--
-- 🚨 NEDEN ŞİMDİ, `ilan_olustur` v4'TEN (#26) ÖNCE:
--
-- v4 canlıya çıkınca RPC metin kolonlarına yazmayı bırakır. O andan itibaren HER
-- YENİ SATIR `origin_city IS NULL` / `listing_stops.city IS NULL` olur. Aşağıdaki
-- 3.1 ve 3.2 sayaçları tam olarak "pid yok AMA metin var" satırlarını sayıyor —
-- v4 sonrası açılan ilanlar bu koşula girmez, ama havuzun geri kalanını gürültüye
-- boğar ve "kayıp gerçekten sıfır mıydı, yoksa v4 mi örttü" sorusu bir daha
-- yanıtlanamaz. **Ölçüm, ölçtüğü şeyi değiştiren işlemden önce alınır.**
--
-- ⚠️ Görev listesinde bu bağımlılık bir süre TERS yazılıydı ("#26 → #27").
-- `20260731_dalga5_metin_kolon_drop.sql` BÖLÜM 0'da 0.5 (ölçüm) ile 0.6 (v4)
-- ayrı kutucuklar ve 0.5 önce geliyor. Düzeltildi.
-- ============================================================================


-- ============================================================================
-- ÖLÇÜM 0.4 — `destination_city`   (#28)   → ✅ KAPANDI 31 Tem 2026: KOLON YOK
-- ============================================================================
--
-- İlk deneme şunu döndü:
--
--     ERROR: 42703: column "destination_city" does not exist
--
-- 🚨 SORU YANLIŞTI. Aylardır sorulan "bu ölü kolonun içinde veri var mı?"
-- sorusunun ön kabulü — kolonun VAR olduğu — hiç sınanmamıştı. Kolon yok.
-- Ölçülecek veri de yok, düşürülecek kolon da yok.
--
-- ⚠️ Bu bir "sorun çözüldü" değil, "sorun hiç yoktu" durumu. Farkı önemli:
-- yaklaşık 10 belge (`COGRAFI_GECIS.md:222`, `W5_DEVIR.md:86`, `SPRINT_01.md:657`,
-- `PROJE_HARITASI.md:618,808`, `YAPILACAKLAR.md:1155-1163`, `20260729_alias_runbook.md`
-- ve iki alias temizlik SQL'i) bu kolonu var sayarak yazılmış. İkisi ona `UPDATE`
-- atıyor (`20260728_alias_kopya_temizligi.sql:288`,
-- `20260728_alias_homonim_temizligi.sql:261`) — çalıştırılsalardı 42703 verirlerdi.
-- 29 Tem'de bir "şema düzeltmesi" turu yapılmış ama sonuç "varışlar
-- `listing_stops`'ta, `destination_city` ÖLÜ" olarak yazılmış; doğrusu "YOK" idi.
--
-- DERS: "kodda geçmiyor" ve "içinde veri yok" ayrı sorular demiştik — üçüncü ve
-- daha önce gelen bir soru varmış: **kolon var mı?** Bir nesne hakkında ölçüm
-- planlamadan önce varlığını doğrula; yoksa yokluğu "boş" sanılır ve o yanlış
-- inanç belgeler arasında çoğalır.
--
-- Aşağıdaki sorgu bunu şemadan teyit eder (42703 vermez, boş küme döner):
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('listings', 'listing_stops')
  and column_name in ('destination_city', 'origin_city', 'city',
                      'origin_province_id', 'province_id');
-- BEKLENEN: `destination_city` satırı YOK; `origin_city`, `listing_stops.city`,
--           `origin_province_id`, `listing_stops.province_id` VAR.
-- ⚠️ `origin_city` veya `listing_stops.city` de çıkmıyorsa Dalga 5'in yarısı
--    zaten yapılmış demektir — o zaman BÖLÜM 5'e değil, BÖLÜM 6 doğrulamasına git.


-- ============================================================================
-- ÖLÇÜM 3.1 — İLANLARDA VERİ KAYBI   (#27)
-- ============================================================================
--
-- v3'ün `coalesce(provinces.name, ham metin)` bacağı, il çözülemediğinde ham
-- metni koruyordu (yurt dışı, serbest giriş, yazım hatası). Kolon düşünce O
-- KORUMA DA DÜŞER. Kaç satır olduğunu bilmeden "önemsizdir" denemez.
select
  count(*)                                              as toplam_ilan,
  count(*) filter (where origin_province_id is null
                     and origin_city is not null)       as pid_yok_metin_var,
  count(*) filter (where origin_province_id is null
                     and origin_city is not null
                     and raw_text is not null)          as raw_text_yedegi_olan,
  -- telafisi olmayan kayıp: metin var, id yok, raw_text de yok
  count(*) filter (where origin_province_id is null
                     and origin_city is not null
                     and raw_text is null)              as telafisiz_kayip
from public.listings;
-- OKUMA: `telafisiz_kayip` = 0 ise ilanlar tarafı temiz.
--        > 0 ise 3.3'e bak, karar ağacını uygula.


-- ============================================================================
-- ÖLÇÜM 3.2 — DURAKLARDA VERİ KAYBI   (#27) — DAHA KRİTİK
-- ============================================================================
--
-- 🚨 `listings`in bir `raw_text` yedeği var; `listing_stops`un YOK. İl çözülemeyen
-- bir durak, drop sonrası ne il ne metin içerir — TAMAMEN BOŞ SATIR olur ve o
-- ilanın rotası sessizce eksilir. Burada telafi yok, o yüzden eşik daha sert.
select
  count(*)                                              as toplam_durak,
  count(*) filter (where province_id is null
                     and city is not null)              as pid_yok_metin_var,
  count(*) filter (where province_id is null
                     and city is null)                  as zaten_bos
from public.listing_stops;
-- OKUMA: `pid_yok_metin_var` SIFIR DEĞİLSE drop'a devam EDİLMEZ.
--        `zaten_bos` bilgi amaçlı — sıfırdan büyükse Dalga 5'ten bağımsız,
--        şimdiden var olan bir veri sorunudur; ayrı görev açılır.


-- ============================================================================
-- ÖLÇÜM 3.3 — KAYIP VARSA: HANGİ METİNLER? (karar için gözle bakılacak)
-- ============================================================================
-- Yalnız 3.1/3.2'de sıfırdan büyük bir sayı çıkarsa anlamlı.

-- 3.3.a — ilanlar
select origin_city, count(*) as adet
from public.listings
where origin_province_id is null and origin_city is not null
group by 1 order by 2 desc limit 50;

-- 3.3.b — duraklar (3.2 sıfırdan büyükse)
select city, count(*) as adet
from public.listing_stops
where province_id is null and city is not null
group by 1 order by 2 desc limit 50;

-- ── KARAR AĞACI ─────────────────────────────────────────────────────────────
--   a) Yazım hatası ("istanbull", "ıstanbul", "ızmir") → alias öğret, geriye
--      dönük `origin_province_id`'yi doldur, SONRA drop. En temizi; kayıp sıfıra iner.
--   b) Gerçek yurt dışı / serbest yer ("Rotterdam", "Hamburg", "İSTOÇ") →
--      drop'tan ÖNCE `alter table public.listings add column origin_serbest_metin text;`
--      ekle ve veriyi taşı. `provinces` 81 plakayla sınırlı, bu veriyi TEMSİL EDEMEZ.
--      ⚠️ Aynı kolon `listing_stops` için de gerekir (yedeği yok).
--   c) Çöp ("...", "-", "test") → drop, kayıp kabul. Ama bu kararı liste GÖRÜLMEDEN verme.


-- ============================================================================
-- EK — `idx_listings_origin` TANIMI (BÖLÜM 4'ün açık sorusu)
-- ============================================================================
--
-- 8.A tabanında 110 taramayla listenin en aktifi, ama adı `origin_city`'yi ima
-- ETMİYOR. Drop listesine bilerek konmadı. Tanımını okumak tek satır, ve cevabı
-- ölçümden bağımsız — şimdi alınabilir.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('listings', 'listing_stops')
  and (indexdef ilike '%origin_city%'
    or indexname in ('idx_listings_origin', 'listing_stops_city_idx'));
-- OKUMA: `idx_listings_origin` tanımında
--   `origin_city`        geçiyorsa → BÖLÜM 4 drop listesine EKLENİR.
--   `origin_province_id` geçiyorsa → KALIR. 110 tarama, Dalga 1 indeksinin
--                                    canlı ve çalışıyor olduğunun kanıtıdır.
