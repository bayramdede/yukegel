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
-- ✅ ÇALIŞTIRILDI 3 Ağu 2026 — Bayram, canlı (gobepcswwsoswodhaufy).
--
--   1. Fonksiyonlar   → [x] 4 satır — HİÇBİRİ GERÇEK TÜKETİCİ DEĞİL (aşağıda)
--   2. View'lar       → [ ] ❗ çıktı yapıştırılmadı — TEYİT BEKLİYOR
--   3. İndeksler      → [x] 7 indeks — hepsi drop'ta otomatik düşer, #21 etkilendi
--   4. Kısıtlar       → [x] 1 satır, alakasız (`aliases_type_check`) = temiz
--   4.b NOT NULL      → [x] ikisi de false — bugünkü düzeltme tuttu
--   5. Politikalar    → [ ] ❗ çıktı yapıştırılmadı — TEYİT BEKLİYOR
--   6. Varsayılanlar  → [ ] ❗ çıktı yapıştırılmadı — TEYİT BEKLİYOR
--   7. Trigger'lar    → [x] 4 trigger, hepsi 1. sorguda YOK = temiz
--
-- ⚠️ 2/5/6 boş döndüyse bile yazılmalı; şu an "boş" ile "bakılmadı" ayırt
--    edilemiyor ve bu dosyanın varlık sebebi tam olarak bu ayrımdı.
--    En kritiği BÖLÜM 2: view/matview `drop column`'u fiilen ENGELLER.
--
-- ── GENEL HÜKÜM ──────────────────────────────────────────────────────────────
-- Postgres tarafında metin kolonlarının GERÇEK tüketicisi KALMADI. #37 son
-- taneymiş. Tesadüfle bulunan bulgu, katalogla teyit edildi.
--
-- ── 1. FONKSİYONLAR — 4 eşleşmenin dördü de yanlış pozitif ───────────────────
-- Üç ayrı zararsız sınıf çıktı; üçü de kolon okuması DEĞİL:
--
--   (a) JSONB GİRDİ ANAHTARI — `ilan_olustur`: `p_listing->>'origin_city'`,
--       `t.s->>'city'`, ve hata mesajındaki `origin_city=%` dizgesi.
--       🔑 BU BİLİNÇLİ VE KALICI. v4'ün tasarımı "metin GİRDİ olarak hayati,
--          ÇIKTI olarak saklanmıyor" idi. Kolon düştükten SONRA da çağıranlar
--          JSON'da `origin_city` göndermeye devam edecek ve bu DOĞRU olacak.
--          → Dalga 5'te bu satırlara dokunulmayacak. API sözleşmesi ≠ şema.
--
--   (b) ÇIKTI TAKMA ADI — `get_nearby_listings_by_province`: `RETURNS TABLE
--       (... origin_city text, dest_city text ...)` ve `po.name as origin_city`.
--       Kaynak `provinces.name`. Yani #37'nin düzeltmesi TAM OLARAK BU:
--       isim korundu, kaynak değişti. Frontend sözleşmesi bozulmadı.
--       Aynı sınıf: `get_radar_city_overview` (`p.name as city`),
--       `get_radar_city_detail` (`jsonb_build_object(..., 'city', to_city ...)`).
--       → Dalga 3'ün dört radar fonksiyonunu çevirdiği burada teyit edildi.
--
--   (c) 🚨 SATIR SONU YORUMU — SORGUNUN KENDİ AÇIĞI.
--       `ilan_olustur`ün 8 eşleşmesinden ikisi şu satırlar:
--         `listing_type, origin_district, contact_phone,  -- ⬅️ origin_city çıkarıldı`
--         `listing_id, stop_order, district, province_id,  -- ⬅️ city çıkarıldı`
--       Filtre `l !~ '^\s*--'` yalnızca TAMAMEN yorum olan satırları eler;
--       kodun SONUNA eklenmiş yorumu elemez. Yani "kaldırıldı" diyen yorum,
--       yine "kaldırılmamış" gibi sayıldı.
--       ⚠️ Bu, 3 Ağu'da v4 sürüm tespitinde yapılan hatanın AYNISININ daha
--          ince hâli. O gün "yorum satırlarını at" diye düzeltmiştik; asıl
--          kural "yorumu at" imiş, "yorum satırını at" değil.
--          → İleride: `regexp_replace(l, '--.*$', '')` ile satır içi yorumu da
--            kırp. (Dize içindeki `--` için yanlış pozitif verir; bu tabloda
--            yok, ama körü körüne kopyalanmamalı.)
--
--   ❗ BEKLENİP ÇIKMAYAN: `get_nearby_listings_for_parked_driver`.
--      Dosya beklenen sonuçlarda "çıkacak, sorun değil" diye yazılmıştı
--      (`docs/20260610_poi_module.sql`; hiç var olmamış `listings.dest_city`,
--      `title`, `load_type` kolonlarına bakıyordu). Katalogda YOK.
--      → Demek ki o migration canlıya hiç uygulanmamış ya da sonradan
--        düşürülmüş. Bir eksik iş değil, bir eksik RİSK. Ama repo'da duran
--        SQL ile canlı şemanın ayrıştığı anlamına gelir — #30 (districts)
--        de "yazıldı, hiç çalıştırılmadı" durumunda. Aynı sınıf.
--
-- ── 3. İNDEKSLER — 7 tane, ve #21'in ölçüm planı BUNUNLA DEĞİŞİYOR ───────────
--   listings.origin_city üzerinde 4:
--     · idx_listings_origin              btree(origin_city)                    ← #21 pozitif kontrolü
--     · idx_listings_origin_city         btree(origin_city) WHERE NOT NULL     ← idx_listings_origin'in kopyası
--     · idx_listings_origin_city_lower   btree(lower(origin_city), created_at DESC)
--     · listings_origin_city_trgm_idx    gin trgm
--   listing_stops.city üzerinde 3:
--     · idx_listing_stops_city_lower     btree(lower(city), listing_id)
--     · listing_stops_city_idx           btree(city)
--     · listing_stops_city_trgm_idx      gin trgm
--
--   ✅ DROP'U ENGELLEMEZLER. `alter table ... drop column` kolonu içeren
--      indeksleri kendiliğinden düşürür (view'ların aksine CASCADE gerekmez).
--      → Dalga 5 drop dosyasına ayrıca `drop index` yazmaya gerek YOK.
--
--   ✅ TABAN ZATEN ALINMIŞ — yeni bir t0 ölçümüne GEREK YOK. 31 Tem BÖLÜM 5
--      yedisini birden saymış: 110 · 44 · 29 · 25 · 24 · 11 · 2, ~72 MB
--      (bkz. YAPILACAKLAR #21). Bu tarama o listeyi canlıdan bağımsız
--      doğruladı: aynı yedi indeks, aynı tanımlar, eksik/fazla yok.
--      ⚠️ 31 Tem'deki EK sorgusu `%origin_city%` filtresiyle koşulduğu için
--         iki `listing_stops` indeksini döndürmemişti ve bu "yokluk kanıtı
--         değil" diye not düşülmüştü. Bugünkü tarama filtreyi kolon adına
--         değil kataloğa dayadığı için o boşluk KAPANDI — yedisi de burada.
--
--   🔑 AMA 7 AĞU FARKININ ANLAMI v4 YÜZÜNDEN DEĞİŞTİ.
--      Pencere (31 Tem → 7 Ağu) artık homojen değil: 3 gün v4 öncesi,
--      4 gün v4 sonrası. 3 Ağu'dan itibaren yeni satırların metin kolonu NULL.
--      → "Silinebilir mi" sorusu için fark hâlâ geçerli: tarama taramadır,
--        satırın dolu olup olmaması sayacı etkilemez. Pozitif kontrol
--        (`learn-aliases`:437) de hâlâ indeksi tarıyor, yalnızca daha az
--        satır EŞLEŞTİRİYOR — sayaç bundan etkilenmez, hüküm ayakta.
--      → Fakat fark ikinci bir şey daha söylüyor: `idx_listings_origin`
--        DIŞINDA farkı >0 çıkan her indeks, onu kullanan sorgunun BUGÜN
--        sessizce eksik sonuç döndürdüğü anlamına gelir — #37'nin birebir
--        aynısı, okuma tarafında. 7 Ağu'da beklenen "dördü de 0"; 0 değilse
--        bu bir temizlik değil, bir ARIZA bulgusudur.
--
--   ⚠️ `idx_listings_origin_city` kısmi (WHERE origin_city IS NOT NULL):
--      v4'ten sonra yeni satır ALMIYOR, büyümesi durdu. Bu indeksin taranma
--      sayısı diğerleriyle aynı anlama gelmez, ayrı yorumlanmalı.
--
-- ── 4. KISITLAR — temiz ──────────────────────────────────────────────────────
--   Tek satır `aliases.aliases_type_check`: `type = 'city'` enum değeri,
--   BAŞKA bir tablo, kolonlarla ilgisi yok. `\mcity\M` sınırının bilinen
--   yanlış pozitifi (`pois.city` gibi). İki kolonda kısıt YOK → drop'u
--   engelleyen bir şey yok.
--
-- ── 7. TRIGGER'LAR — temiz, ama sadece 1. sorguyla BİRLİKTE anlamlı ──────────
--   listings üzerinde 4 (audit_listing_fn, set_listing_expires_at,
--   sync_shadow_profile_listing_stats, sync_shadow_profile_listing_count),
--   listing_stops üzerinde 0.
--   Trigger ADI gövdesi hakkında hiçbir şey söylemez. Hüküm şuradan geliyor:
--   dördünün fonksiyonu da 1. sorguda ÇIKMADI → gövdelerinde `city` geçmiyor.
--   Tek başına bu liste bir şey kanıtlamazdı; kesişim kanıtlıyor.
