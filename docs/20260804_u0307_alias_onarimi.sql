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
-- BÖLÜM 3 — GERÇEK KAYIPLARI ONAR (10 satır)
-- =============================================================================
-- Kalan U+0307 satırları çakışmıyor → noktayı sil, kapsama geri gelsin.
-- Bu 10: yeni̇ mahalle · ş.kochi̇sar · i̇scehisardan · i̇stoç · kdz ereğli̇ ·
--        ni̇zi̇p · i̇skendurun · i̇vedik · deli̇ce · i̇stoc (pasif)
-- ⚠️ İç çakışma kontrolü yapıldı: `i̇stoç`→`istoç` ve `i̇stoc`→`istoc` ikisi de
--    `istoc` anahtarına katlanıyor AMA 3044 pasif; kısmi indeks
--    (WHERE is_active) yalnız 2843'ü sayıyor. Çakışma yok.
update public.aliases
set alias = replace(alias, U&'\0307', '')
where alias like '%' || U&'\0307' || '%';
-- Beklenen: UPDATE 10


-- =============================================================================
-- BÖLÜM 4 — KİRİL HOMOGLİF (#46) — id 1023 `Torbалı`
-- =============================================================================
-- `а` = U+0430, `л` = U+043B → Kiril. `trNorm`in `[^a-z0-9\s]` kuralı ikisini
-- de boşluğa çeviriyor → bu alias hiçbir Türkçe metinle eşleşemez. Ölü kayıt.
--
-- 4.a ÖNCE ÇAKIŞMA KONTROLÜ: `torbalı` zaten aktif mi?
select id, alias, normalized, district, is_active
from public.aliases
where type = 'city'
  and translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') = 'torbali';

-- 4.b BOŞ dönerse (1023 dışında satır yoksa) → düzelt:
-- update public.aliases set alias = 'Torbalı' where id = 1023;
--
-- 4.c Aktif bir `torbalı` VARSA → 1023 gölge kopya, pasifleştir:
-- update public.aliases set is_active = false where id = 1023;
--
-- ⚠️ Hangisi olduğunu 4.a'nın çıktısı söyler; kör çalıştırma.


-- =============================================================================
-- BÖLÜM 5 — DOĞRULAMA
-- =============================================================================
-- 5.a U+0307 tamamen gitti mi? → 0 dönmeli
select count(*) as kalan_u0307
from public.aliases
where alias like '%' || U&'\0307' || '%';

-- 5.b Latin-dışı karakter kaldı mı? → yalnız 1023 (BÖLÜM 4 uygulanmadıysa)
select id, alias, type, is_active
from public.aliases
where alias ~ '[^ -ɏ\s]';

-- 5.c Aktif katlanmış anahtar çakışması var mı? → 0 satır dönmeli
--     (indeks zaten engelliyor; bu, onarımın indeksi kızdırmadığının teyidi)
select translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') as anahtar,
       type, count(*) as adet, array_agg(id) as idler
from public.aliases
where is_active
group by 1, 2
having count(*) > 1;

-- 5.d Onarılan 10 satır beklenen hâlde mi?
select id, alias, length(alias), normalized, district, is_active
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
