-- ============================================================================
-- 3 Ağu 2026 — POSTGRES TARAFINDA `origin_city` / `listing_stops.city`
-- TÜKETİCİSİ KALDI MI? Sistematik tarama. Dalga 5 ön koşulu. Görev #40.
-- ============================================================================
--
-- ── NEDEN BU DOSYA VAR ─────────────────────────────────────────────────────
-- BÖLÜM 2'nin kod temizliği envanteri `.ts` / `.tsx` dosyalarını taradı.
-- Doğru yapıldı ve bitti. Ama envanterin KAPSAMI dile göre daralmıştı:
-- **Postgres ikinci bir kod tabanıdır** ve hiç taranmadı.
--
-- Bunun bedeli bir kez ödendi: `get_nearby_listings_by_province` fonksiyonunun
-- `son_durak` CTE'sinde ölü bir `city` referansı kalmıştı (#37). Drop günü
-- 42703 atacak, `route.ts`:44 → `YolRehberiClient.tsx` zinciri yani GPS'e
-- dayalı keşif akışının tamamı sessizce ölecekti.
--
-- 🚨 O BULGU TESADÜFTÜ. Dosya başka bir sebeple elle okundu ve göze çarptı.
--    Tesadüf bir yöntem değildir. Aynı sınıftan ikinci bir tüketici varsa onu
--    bulmanın yolu katalogdan sormaktır, umut etmek değil.
--
-- ── NEDEN ŞİMDİ, DROP'TAN ÖNCE ─────────────────────────────────────────────
-- `ilan_olustur` v4 3 Ağu'da canlıya çıktı. Yani BUGÜNDEN itibaren yeni
-- satırlarda `origin_city` ve `listing_stops.city` **NULL**. Kolonlar ~7 Ağu'da
-- düşecek. Aradaki pencerede bu kolonları okuyan bir nesne varsa:
--   • bugün → hata YOK, sessizce boş/eksik sonuç (en tehlikeli hâli)
--   • drop'tan sonra → 42703, gürültülü ama geç
-- Yani pencere bir uyarı değil, bir SESSİZLİK dönemi. Şimdi bakılmazsa
-- bulgular 7 Ağu'da hepsi birden ve canlıda çıkar.
--
-- ── YÖNTEM NOTU: YORUM SATIRLARI ELENİYOR ──────────────────────────────────
-- ⚠️ `pg_get_functiondef` gövdeyi YORUMLARIYLA döndürür. 3 Ağu'da bu tuzağa
--    düşüldü: `... ~ 'v_origin_city'` sorgusu v4'te de TRUE döndü, çünkü v4
--    gövdesi üç yerde "v_origin_city KALDIRILDI" diye ANLATIYOR. Sorgu,
--    kaldırıldığını söyleyen yorumu kaldırılmamışlığın kanıtı saydı.
--    → Aşağıdaki her sorguda `satir !~ '^\s*--'` var. Kaldırma.
--
-- ⚠️ `\mcity\M` (kelime sınırı) kasıtlı: `origin_city`, `dest_city`, `p_city`
--    gibi adlarda `city`den önce `_` gelir ve `_` kelime karakteridir, yani
--    eşleşmez. Böylece `listing_stops.city` ile `origin_city` ayrı ayrı
--    aranabiliyor. Yan etki: `pois.city` ve `aliases.type='city'` de eşleşir —
--    YANLIŞ POZİTİF, ama kaçırmaktan iyidir. Sonuçları elle ayıklamak lazım.
--
-- ── RİSK ───────────────────────────────────────────────────────────────────
-- YOK. Altı sorgunun tamamı saf SELECT, yalnız sistem kataloğunu okur.
-- ============================================================================


-- ── 1. FONKSİYONLAR ────────────────────────────────────────────────────────
-- En kritik sorgu. #37'nin bulunduğu yer burasıydı.
select
  p.oid::regprocedure                                     as fonksiyon,
  count(*)                                                as kalan_satir,
  string_agg(trim(t.satir), '  ⏎  ' order by t.sira)      as ornek_satirlar
from pg_proc p
join pg_namespace ns on ns.oid = p.pronamespace
cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n'))
     with ordinality as t(satir, sira)
where ns.nspname = 'public'
  and p.prokind = 'f'
  and t.satir !~ '^\s*--'
  and t.satir ~* '(origin_city|\mcity\M)'
group by 1
order by 2 desc;
--
-- BEKLENEN — bu üç grup ÇIKARSA sorun yok, tanı ve geç:
--   ✅ `ilan_olustur(jsonb,jsonb)` → ÇIKMAMALI. Çıkıyorsa v4 uygulanmamış
--      demektir (yorumlar zaten eleniyor). Çıkarsa DUR.
--   ✅ `get_nearby_listings_by_province(...)` → ÇIKMAMALI (#37 temizledi).
--      Yalnız `origin_city text` / `dest_city text` dönüş tipi satırları
--      kalmış olabilir; onlar ÇIKTI ADI, kolon değil, kaynakları
--      `provinces.name`. Zararsız.
--   ⚠️ `get_nearby_listings_for_parked_driver(...)` → ÇIKMASI BEKLENİYOR ve
--      ZATEN BOZUK. `docs/20260610_poi_module.sql`'deki bu eski fonksiyon
--      `listings.dest_city` / `title` / `load_type` gibi HİÇ VAR OLMAYAN
--      kolonlara bakıyor — bugün çağrılsa da hata verir, kullanılmıyor,
--      belge amaçlı duruyor. Drop onu daha bozuk yapmaz.
--      📌 Yine de bu turda KARAR VER: ya sil, ya "ölü" diye işaretle.
--         `destination_city` mitinin kaynağı tam olarak buydu — kimsenin
--         çağırmadığı bir tanım, yıllarca "kolon varmış" izlenimi üretti.
--
-- 🚨 BUNLARIN DIŞINDA HERHANGİ BİR AD ÇIKARSA: dur, çıktıyı kaydet, incele.
--    Dalga 3 dört radar fonksiyonunu çevirmişti
--    (`get_radar_city_overview`, `get_radar_city_detail`,
--     `get_radar_intelligence`, `get_nearby_listings_by_province`);
--    bunlardan biri listede görünüyorsa Dalga 3 o fonksiyonda EKSİK kalmış.


-- ── 2. VIEW / MATERIALIZED VIEW ────────────────────────────────────────────
-- View'lar drop'u AKTİF OLARAK ENGELLER: bağımlı bir view varsa
-- `drop column` "cannot drop ... because other objects depend on it" der.
-- Yani bu sorgu boş dönmezse BÖLÜM 5 çalıştırıldığında migration ORTADA durur.
select schemaname, viewname as nesne, 'view' as tur
  from pg_views
 where schemaname = 'public'
   and definition ~* '(origin_city|\mcity\M)'
union all
select schemaname, matviewname, 'matview'
  from pg_matviews
 where schemaname = 'public'
   and definition ~* '(origin_city|\mcity\M)'
order by 3, 2;
-- BEKLENEN: 0 satır. (`pois` üzerinde bir view varsa yanlış pozitif olabilir.)


-- ── 3. İNDEKSLER ───────────────────────────────────────────────────────────
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('listings', 'listing_stops')
   and indexdef ~* '(origin_city|\mcity\M)'
 order by 1;
--
-- BEKLENEN: SATIR ÇIKAR ve bu NORMAL. Metin indeksleri bilerek duruyor —
-- `docs/20260731_index_temizligi.sql` ve BÖLÜM 4'ün drop listesi onlar için.
-- 📌 `idx_listings_origin` (110 tarama ile en aktifi) #21'in FARK ÖLÇÜMÜNÜN
--    POZİTİF KONTROLÜ. ~7 Ağu ölçümünden ÖNCE düşürülmemeli; ayrıca #24
--    (`learn-aliases`:454) da ölçümden önce çevrilmemeli, yoksa kontrol ölür.
-- ⚠️ `drop column` bu indeksleri kendiliğinden götürür. Buradaki liste
--    "silinecekler" değil, ölçüm bitene kadar "korunacaklar" listesi.


-- ── 4. KISITLAR (CHECK / UNIQUE / EXCLUDE) ─────────────────────────────────
-- 🚨 BU SORGU 3 AĞU DERSİNİN DOĞRUDAN SONUCU. v4 canlıya çıktığında
--    `origin_city` NOT NULL olduğu için her ilan oluşturma `23502` attı ve
--    servis durdu. Kısıt hiçbir plan belgesinde geçmiyordu.
--    NOT NULL `pg_constraint`'te GÖRÜNMEZ (attnotnull'dadır) — o yüzden
--    aşağıda iki ayrı sorgu var. İkincisini atlama.
select conrelid::regclass as tablo, conname as kisit,
       pg_get_constraintdef(oid) as tanim
  from pg_constraint
 where connamespace = 'public'::regnamespace
   and pg_get_constraintdef(oid) ~* '(origin_city|\mcity\M)'
 order by 1, 2;
-- BEKLENEN: 0 satır (CHECK/UNIQUE tarafında).

-- 4.b NOT NULL — ayrı katalog, ayrı sorgu.
select c.relname as tablo, a.attname as kolon, a.attnotnull as not_null
  from pg_attribute a
  join pg_class c  on c.oid = a.attrelid
  join pg_namespace ns on ns.oid = c.relnamespace
 where ns.nspname = 'public'
   and (c.relname, a.attname) in
       (('listings','origin_city'), ('listing_stops','city'))
 order by 1;
-- BEKLENEN: ikisi de `false`. (3 Ağu'da düşürüldü — v4 ADIM 0.5.)


-- ── 5. RLS POLİTİKALARI ────────────────────────────────────────────────────
-- Politika ifadesinde geçen bir kolon drop'u engeller ve — daha kötüsü —
-- sessizce YANLIŞ SATIR KÜMESİ döndürebilir: v4'ten sonra kolon NULL olduğu
-- için `origin_city = ...` biçimindeki her koşul bugün zaten FALSE üretir.
select schemaname, tablename, policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
       ~* '(origin_city|\mcity\M)'
 order by 2, 3;
-- BEKLENEN: 0 satır.


-- ── 6. VARSAYILAN DEĞERLER / ÜRETİLMİŞ KOLONLAR ────────────────────────────
-- Başka bir kolonun DEFAULT'u ya da GENERATED ifadesi bu kolonlara bakıyorsa
-- drop yine engellenir.
select c.relname as tablo, a.attname as kolon,
       pg_get_expr(d.adbin, d.adrelid) as ifade
  from pg_attrdef d
  join pg_class c     on c.oid = d.adrelid
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  join pg_namespace ns on ns.oid = c.relnamespace
 where ns.nspname = 'public'
   and pg_get_expr(d.adbin, d.adrelid) ~* '(origin_city|\mcity\M)'
 order by 1, 2;
-- BEKLENEN: 0 satır.


-- ── 7. TRIGGER'LAR ─────────────────────────────────────────────────────────
-- Gövdeleri 1. sorguda zaten taranıyor, ama hangi trigger'ın bu iki tabloya
-- bağlı olduğunu görmek ayrı bir bilgi: 1'de çıkan bir fonksiyon buradaysa
-- HER INSERT'te çalışıyor demektir, yani etkisi bir RPC'den geniştir.
select c.relname as tablo, t.tgname as trigger_adi,
       p.oid::regprocedure as fonksiyon
  from pg_trigger t
  join pg_class c      on c.oid = t.tgrelid
  join pg_proc p       on p.oid = t.tgfoid
  join pg_namespace ns on ns.oid = c.relnamespace
 where ns.nspname = 'public'
   and not t.tgisinternal
   and c.relname in ('listings', 'listing_stops')
 order by 1, 2;
-- BEKLENEN: trigger'lar çıkabilir (audit/normalize gibi). Kritik olan:
-- bunlardan biri 1. sorguda da göründü mü? Görünmediyse sorun yok.


-- ============================================================================
-- SONUÇ KAYDI
-- ============================================================================
-- Çıktılar buraya yazılacak (tarih + kim çalıştırdı).
-- Boş dönmeyen her sorgu için: nesne adı · niye orada · karar (çevir / sil /
-- bilerek bırak) · hangi göreve bağlandı.
--
--   1. Fonksiyonlar   → [ ]
--   2. View'lar       → [ ]
--   3. İndeksler      → [ ]
--   4. Kısıtlar       → [ ]
--   4.b NOT NULL      → [ ]
--   5. Politikalar    → [ ]
--   6. Varsayılanlar  → [ ]
--   7. Trigger'lar    → [ ]
--
-- ⚠️ "Boş döndü" de bir sonuçtur ve yazılmalı. Bu dosyanın varlık sebebi
--    #37'nin tesadüfen bulunmuş olmasıydı; bir dahaki sefere "baktık mı?"
--    sorusunun cevabı hatırlamaya değil kayda dayanmalı.
