-- =============================================================================
-- U+0307 ALIAS ONARIMI — 4 Ağustos 2026
-- =============================================================================
-- KÖK SEBEP (#45): `lib/alias-normalize.ts`:82 `normalizeAliasFields` düz
-- `.toLowerCase()` kullanıyor; :38 `aliasKey` ise `.replace(/İ/g,'i')` adımını
-- ÖNCE yapıyor. Büyük harfli bir alias (`İZMİT`) learn-aliases'tan geçince
-- `.toLowerCase()` `İ`yi `i` + U+0307 (birleşen nokta) olarak İKİ karaktere
-- açıyor ve DB'ye `i̇zmit` yazılıyor.
--
-- İKİ AYRI HASAR ÜRETTİ:
--
--  (1) EŞLEŞME ÖLÜMÜ — `trNorm` (parse-listing:118-130) son adımda
--      `[^a-z0-9\s]` → `' '` uyguluyor. U+0307 boşluğa dönüyor:
--      `i̇zmit` → `i zmit`, mesajdaki `izmit` → `izmit`. Asla tutmuyor.
--
--  (2) TEKİLLİK İNDEKSİ BAYPAS — `aliases_katlanmis_anahtar_uniq` ifadesi
--      `translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')`.
--      Saklanan değerde artık büyük `İ` yok, `replace` bir şey bulamıyor,
--      U+0307 hayatta kalıyor → katlanmış anahtar `i̇zmit`, mevcut `izmit`ten
--      FARKLI. İndeks görevini yaptı; uygulama ona ayrışan bir anahtar verdi.
--      ⇒ 24 gölge kopya bu delikten girdi.
--
-- ÖLÇÜM (4 Ağu):
--   • U+0307 içeren alias: 34 satır (33 aktif + 1 pasif), hepsi type='city'
--   • Bunlardan 24'ü, katlanmış anahtarı aktif bir alias'la ÇAKIŞIYOR
--     → gölge kopya, kapsama kaybı YOK
--   • 10'u çakışmıyor → GERÇEK KAPSAMA KAYBI (9 aktif + 1 pasif)
--   • Merge kontrolü: 24 çiftin 24'ünde de `normalized` aynı; `district`
--     yalnız 2650'de ayrışıyor ve ölü tarafta NULL (canlıda `Aliağa`)
--     ⇒ pasifleştirme KAYIPSIZ, hiçbir satırda veri taşıma gerekmiyor.
--
-- ⚠️ SIRA: BÖLÜM 1 (yedek) → BÖLÜM 2 (24 pasifleştir) → BÖLÜM 3 (10 onar)
--    → BÖLÜM 4 (homoglif) → BÖLÜM 5 (doğrulama).
--    Kod tarafı ayrı iş: `lib/alias-normalize.ts`:82 düzeltilmeden bu onarım
--    kalıcı değildir — aynı hata yeniden üretir.
-- =============================================================================


-- =============================================================================
-- BÖLÜM 0 — ÖN KONTROL (çalıştırmadan önce sayıları teyit et)
-- =============================================================================
-- Beklenen: toplam 34, aktif 33, pasif 1, hepsi 'city'
select count(*)                                   as toplam,
       count(*) filter (where is_active)          as aktif,
       count(*) filter (where not is_active)      as pasif,
       array_agg(distinct type)                   as tipler
from public.aliases
where alias like '%' || U&'\0307' || '%';


-- =============================================================================
-- BÖLÜM 1 — YEDEK (Adım 9'un `aliases_adim9_yedek` emsali)
-- =============================================================================
-- Geri alma için TAM satır kopyası. Onarım doğrulandıktan sonra silinebilir.
create table if not exists public.aliases_20260804_u0307_yedek as
select * from public.aliases
where alias like '%' || U&'\0307' || '%';

-- Beklenen: 34
select count(*) as yedeklenen from public.aliases_20260804_u0307_yedek;


-- =============================================================================
-- BÖLÜM 2 — GÖLGE KOPYALARI PASİFLEŞTİR (24 satır)
-- =============================================================================
-- Kural: SİLME YOK. Adım 9'daki gibi `is_active=false`.
-- ℹ️ `is_active`-only UPDATE, trigger kurulsa bile onu TETİKLEMEZ
--    (trigger `UPDATE OF alias, normalized, district` ile sınırlı).
update public.aliases o
set is_active = false
where o.alias like '%' || U&'\0307' || '%'
  and o.is_active
  and exists (
    select 1 from public.aliases a
    where a.id <> o.id
      and a.type = 'city'
      and a.is_active
      and translate(lower(replace(a.alias,'İ','i')),'ıçğöşü','icgosu')
        = translate(lower(replace(replace(o.alias,U&'\0307',''),'İ','i')),'ıçğöşü','icgosu')
  );
-- Beklenen: UPDATE 24


-- =============================================================================
-- BÖLÜM 3 — GERÇEK KAYIPLARI ONAR (9 aktif satır)
-- =============================================================================
-- 🚨 İLK DENEME 23505 İLE PATLADI — `idx_aliases_type_alias`.
--    Sebep: çakışma kontrolünü yalnız `aliases_katlanmis_anahtar_uniq`e karşı
--    yapmıştım. Tabloda ÜÇ ayrı UNIQUE indeks var:
--      • aliases_alias_unique             UNIQUE (alias)              ← kısmi DEĞİL
--      • idx_aliases_type_alias           UNIQUE (type, alias)        ← kısmi DEĞİL
--      • aliases_katlanmis_anahtar_uniq   UNIQUE (type, katlanmış) WHERE is_active
--    İlk ikisi `is_active` filtresi taşımıyor, yani Adım 9'da pasifleştirilen
--    612 satırı da görüyor. Kısmi indekse görünmeyen pasif satırlar bunlara
--    görünüyordu. → Ders: bir tablodaki TÜM unique indeksler listelenmeden
--    çakışma kontrolü eksiktir (`select indexname, indexdef from pg_indexes`).
--    ℹ️ `aliases_alias_unique` global olduğu için `idx_aliases_type_alias`
--       fiilen gereksiz; ayrıca aynı alias metni iki `type`ta var olamıyor.
--
-- ✅ ÖLÇÜLDÜ: ham-alias çakışma sorgusu 21 satır döndürdü ve **21'i de
--    `is_active=false`** — yani BÖLÜM 2'de pasifleştirdiğimiz gölge kopyalar.
--    10 gerçek kayıp satırının HİÇBİRİ çakışmıyor.
--    ⇒ Hata kapsamdaydı: pasif gölge kopyaların yazımını düzeltmeye
--      çalışıyorduk. Onların yazımı okunmuyor; oldukları gibi kalsınlar
--      (yedeklendiler, pasifler, zararsızlar).
--
-- Onarılan 9 (hepsi aktif): yeni̇ mahalle · ş.kochi̇sar · i̇scehisardan ·
--   i̇stoç · kdz ereğli̇ · ni̇zi̇p · i̇skendurun · i̇vedik · deli̇ce
-- ℹ️ 3044 `i̇stoc` pasif → dokunulmuyor (BÖLÜM 2'den önce de pasifti).
update public.aliases
set alias = replace(alias, U&'\0307', '')
where alias like '%' || U&'\0307' || '%'
  and is_active;
-- Beklenen: UPDATE 9


-- =============================================================================
-- BÖLÜM 4 — KİRİL HOMOGLİF (#46) — id 1023 `Torbалı`
-- =============================================================================
-- `а` = U+0430, `л` = U+043B → Kiril. `trNorm`in `[^a-z0-9\s]` kuralı ikisini
-- de boşluğa çeviriyor → bu alias hiçbir Türkçe metinle eşleşemez. Ölü kayıt.
--
-- 4.a ÇALIŞTIRILDI (4 Ağu) — sonuç:
--     1022  Torbali   İzmir / Torbalı   is_active = TRUE   ← kapsama BURADA canlı
--     1276  torbali   İzmir / Torbalı   is_active = false
--     1980  torbalı   İzmir / Torbalı   is_active = false
--   ⇒ `torbalı` zaten çalışıyor. 1023 gölge kopya. → 4.c uygulanacak.
--   (Kayıt için sorgu: select id, alias, normalized, district, is_active
--    from public.aliases where type='city'
--      and translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')='torbali';)

-- 4.c UYGULA — 1023 `Torbалı` pasifleştir (silme yok, 1022 kapsamayı taşıyor)
update public.aliases set is_active = false where id = 1023;
-- Beklenen: UPDATE 1


-- =============================================================================
-- BÖLÜM 5 — DOĞRULAMA
-- =============================================================================
-- 5.a AKTİF tarafta U+0307 kaldı mı? → 0 dönmeli
--     ⚠️ Toplam sayı 0 OLMAYACAK: 25 pasif satırda U+0307 bilerek duruyor
--     (24 gölge kopya + 3044). Pasif satırın yazımı okunmuyor; onarmak
--     `aliases_alias_unique` ile çakışırdı. Doğru beklenti AKTİF = 0.
select count(*) filter (where is_active)     as aktif_u0307,   -- beklenen 0
       count(*) filter (where not is_active) as pasif_u0307,   -- beklenen 25
       count(*)                              as toplam         -- beklenen 25
from public.aliases
where alias like '%' || U&'\0307' || '%';

-- 5.b Latin-dışı karakterli AKTİF satır kaldı mı? → 0 satır dönmeli
select id, alias, type, is_active
from public.aliases
where alias ~ '[^ -ɏ\s]' and is_active;

-- 5.c Aktif katlanmış anahtar çakışması var mı? → 0 satır dönmeli
--     (indeks zaten engelliyor; bu, onarımın indeksi kızdırmadığının teyidi)
select translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') as anahtar,
       type, count(*) as adet, array_agg(id) as idler
from public.aliases
where is_active
group by 1, 2
having count(*) > 1;

-- 5.d Onarılan 9 satır beklenen hâlde mi? (3044 pasif, dokunulmadı)
--     Beklenen yazımlar: yeni mahalle · ş.kochisar · iscehisardan · istoç ·
--     kdz ereğli · nizip · iskendurun · ivedik · delice — hiçbirinde U+0307 yok
select id, alias, length(alias), normalized, district, is_active,
       (alias like '%' || U&'\0307' || '%') as hala_bozuk
from public.aliases
where id in (1267, 2671, 2689, 2843, 2850, 2880, 2884, 2935, 2940, 3044)
order by id;

-- 5.e Pasifleştirilen 24 satır
select count(*) as pasiflestirilen
from public.aliases a
join public.aliases_20260804_u0307_yedek y on y.id = a.id
where y.is_active and not a.is_active;
-- Beklenen: 24


-- =============================================================================
-- 🔁 GERİ ALMA (gerekirse)
-- =============================================================================
-- update public.aliases a
-- set alias = y.alias, is_active = y.is_active
-- from public.aliases_20260804_u0307_yedek y
-- where y.id = a.id;


-- =============================================================================
-- 📌 BU DOSYA TEK BAŞINA YETMEZ — KOD TARAFI
-- =============================================================================
--  1. `lib/alias-normalize.ts`:82 → `.replace(/İ/g,'i')` eklenmeli, yoksa aynı
--     hata yeniden üretilir. (#45)
--  2. Trigger (#43) kurulacaksa `alias` satırındaki `lower()` ÇIKARILMALI —
--     ölçüm gösterdi ki alias okuma anında (`trNorm`) katlanıyor, büyük harfli
--     alias zaten tutuyor. `\s+` sıkıştırma ve `district=''`→NULL bacakları
--     değerli, onlar kalsın.
--  3. İsteğe bağlı savunma: `trNorm`'a `[^a-z0-9\s]` satırından ÖNCE
--     `.replace(/̇/g,'')` eklemek. Onarım sonrası aciliyeti düştü;
--     yine de mesaj metninden gelen U+0307'ye karşı ucuz bir kalkan.


-- =============================================================================
-- ✅ SONUÇ KAYDI — 4 AĞUSTOS 2026, ONARIM TAMAMLANDI
-- =============================================================================
-- BÖLÜM 0  ✅ 34 / aktif 33 / pasif 1 / type=['city']            (beklenen)
-- BÖLÜM 1  ✅ aliases_20260804_u0307_yedek — 34 satır
-- BÖLÜM 2  ✅ UPDATE 24 — gölge kopyalar pasifleştirildi
-- BÖLÜM 3  ⚠️ İLK DENEME 23505 (idx_aliases_type_alias) → tamamen geri sarıldı,
--             kısmi uygulama YOK (5.a hâlâ 34 dönerek bunu teyit etti).
--             `and is_active` eklendikten sonra ✅ UPDATE 9
-- BÖLÜM 4c ✅ UPDATE 1 — id 1023 `Torbалı` pasifleştirildi (1022 canlı taşıyor)
--
-- DOĞRULAMA
--   5.a ✅ aktif_u0307 = 0 · pasif_u0307 = 25 · toplam = 25
--   5.b ✅ 0 satır — aktif tarafta Latin-dışı karakter kalmadı
--   5.c ✅ 0 satır — aktif katlanmış anahtar çakışması yok
--   5.d ✅ 9 satırın 9'unda hala_bozuk = false; 3044 pasif ve dokunulmamış
--       1267 yeni mahalle(12) · 2671 ş.kochisar(10) · 2689 iscehisardan(12)
--       2843 istoç(5) · 2850 kdz ereğli(10) · 2880 nizip(5)
--       2884 iskendurun(10) · 2935 ivedik(6) · 2940 delice(6)
--   5.e ✅ pasiflestirilen = 24
--
-- 🧪 EŞLEŞME DOĞRULAMASI (trNorm, kod tarafı — 9/9 GEÇTİ)
--   "yeni mahalle" → "yeni mahalle"  ← "Yeni Mahalle"
--   "ş.kochisar"   → "s kochisar"    ← "Ş.KOÇHİSAR"
--   "iscehisardan" → "iscehisardan"  ← "İSCEHİSARDAN"
--   "istoç"        → "istoc"         ← "İSTOÇ"
--   "kdz ereğli"   → "kdz eregli"    ← "KDZ EREĞLİ"
--   "nizip"        → "nizip"         ← "NİZİP"
--   "iskendurun"   → "iskendurun"    ← "İSKENDURUN"
--   "ivedik"       → "ivedik"        ← "İVEDİK"
--   "delice"       → "delice"        ← "DELİCE"
--   Onarım öncesi karşılaştırma: "ni̇zi̇p" → "ni zi p" ≠ "nizip". Fark bu.
--
-- =============================================================================
-- 📚 DERS — ÇAKIŞMA KONTROLÜ TEK İNDEKSE BAKMAZ
-- =============================================================================
-- BÖLÜM 3'ün ilk denemesi patladı çünkü çakışmayı yalnız
-- `aliases_katlanmis_anahtar_uniq`e karşı ölçmüştüm. Tabloda ÜÇ unique indeks
-- var ve ikisi KISMİ DEĞİL:
--   aliases_alias_unique            UNIQUE (alias)
--   idx_aliases_type_alias          UNIQUE (type, alias)
--   aliases_katlanmis_anahtar_uniq  UNIQUE (type, katlanmış) WHERE is_active
-- Kısmi indeks Adım 9'da pasifleştirilen 612 satırı görmüyor; diğer ikisi
-- görüyor. Çakışma o pasif satırlardan geldi.
-- ⚠️ Kural: veri onarımından önce `select indexname, indexdef from pg_indexes
--    where tablename='X'` çalıştır ve HER unique indeksi ayrı ayrı kontrol et.
--    "Bildiğim indeks" bir kanıt değil.
-- 🔁 Bu, haftanın kalıbının bir örneği daha — ve bu sefer kaydı BEN ıskaladım:
--    beş indeksin listesi 4 Ağu ön kontrolünün §0'ında zaten elimdeydi.
--
-- ℹ️ Yan bulgu: `aliases_alias_unique` `alias` üzerinde GLOBAL unique olduğu
--    için `idx_aliases_type_alias` fiilen gereksiz (ayrıca aynı alias metni
--    iki farklı `type`ta var olamıyor — bu bilinçli bir tasarım mı?).
--    Dokunulmadı, kayda geçti.
--
-- =============================================================================
-- 📌 KALAN
-- =============================================================================
--  • `lib/alias-normalize.ts`:82 düzeltmesi DEPLOY edilmeli — edilmezse
--    learn-aliases yeni U+0307 satırları üretmeye devam eder ve bu onarım
--    aşınır. (#45)
--  • 25 pasif satırda U+0307 bilerek duruyor. Pasif satırın yazımı okunmuyor;
--    onarmak `aliases_alias_unique` ile çakışırdı. Yedek tablo duruyor.
--  • Veri kalitesi notu (bu onarımın kapsamı dışında, ayrı karar):
--      – 1267 `yeni mahalle` → normalized Ankara, district NULL. Yenimahalle mi?
--      – 2843 `istoç` → district `Beylikdüzü`. İSTOÇ toptancı sitesi Bağcılar/
--        Mahmutbey'de; doğrulanması gereken bir atama.
--      – 3044 `i̇stoc` (pasif) → district `İstoc` — 2843 ile ayrışıyor.
