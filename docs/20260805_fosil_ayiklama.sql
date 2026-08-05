-- ============================================================================
-- #42 TAKİBİ — FOSİL AYIKLAMA
-- 5 Ağustos 2026
-- ============================================================================
--
-- ÖN KOŞUL: `olcum42` şeması ayakta. Düşürdüysen önce
-- `docs/20260805_no_lane_format_olcumu.sql`, sonra `20260805_ayrac_envanteri.sql`.
--
-- 🚨 NİYE: BÖLÜM 9b, kova C'nin en büyük parçasını "kod ayracı ZATEN görüyor
--    ama yine de no_lane" (119 satır) olarak verdi. Örneklere bakınca bunların
--    çoğu parse ETMESİ GEREKEN satırlar:
--      "BURSA - KARAHALLI"        → DASH_RE tutar, rel.left çözülür, şerit kurulur
--      "📍 ÇORLU ➜ SAKARYA / HENDEK" → :491 zaten `/` ile çoklu varış açıyor
--      "ANTALYA➡️ANKARA"          → VS16'lı ok, ARROW_RE'de VAR
--      "İzmir Ödemiş→Antalya Korkuteli" → → ARROW_RE'de VAR
--
-- İki açıklama var ve ikisi taban tabana zıt iş listesi doğurur:
--   (1) Bugünkü kodda gerçek bir bug var  → kazı yapılır, kod düzeltilir.
--   (2) Bu satırlar ESKİ ayrıştırıcının fosili → yapılacak hiçbir şey yok.
--
-- ⚠️ BU BENİM ÖLÇÜM HATAM: pencereyi `message_date >= 30 gün` kurdum. O pencere
--    #33 ve v4 deploy'larını İÇERİYOR, yani birden çok kod sürümünün çıktısını
--    tek yığın gibi saydım. `processing_status` mevcut kod hakkında bir iddia
--    değil, İŞLENDİĞİ ANDAKİ kod hakkında bir damga. Bu ayrım yapılmadan
--    BÖLÜM 9b'nin 119'u da, BÖLÜM 4'ün 318'i de okunamaz.
--
-- Duran kural da bunu söylüyor: geçmiş veriler eskidi, ileriye dönük çalışıyoruz.
-- ============================================================================


-- ============================================================================
-- BÖLÜM 10 — Kova C hangi tarihte İŞLENDİ? (message_date değil, işlenme anı)
-- #41 `no_lane` satırlarına `processed_at` damgası ekledi. `processed_at IS NULL`
-- olan satırlar o düzeltmeden ÖNCE işlenmiş demektir — kesin fosil.
-- ============================================================================
select 'BÖLÜM 10 — kova C işlenme tarihi' as bolum,
       coalesce(r.processed_at, r.created_at)::date as islenme_gunu,
       (r.processed_at is null)                     as damgasiz_fosil,
       count(*)                                     as kova_c_satir
from olcum42.olcum o
join public.raw_posts r on r.id = o.id
where o.kume = 'hedef' and o.yer >= 2
group by 2, 3
order by 2 desc;


-- ============================================================================
-- BÖLÜM 10b — 9b'nin üç sınıfı × işlenme tarihi.
-- 👉 `kod_zaten_goruyor` sınıfı SON GÜNLERDE de üretiliyorsa gerçek bir bug var.
--    Yalnız eski tarihlerde birikmişse fosildir ve #42'den düşer.
-- ============================================================================
select 'BÖLÜM 10b — sınıf × işlenme günü' as bolum,
       coalesce(r.processed_at, r.created_at)::date as islenme_gunu,
       count(*) filter (where olcum42.ok_gercek(o.raw_text)
                          or olcum42.tire_var(o.raw_text))          as kod_zaten_goruyor,
       count(*) filter (where not olcum42.ok_gercek(o.raw_text)
                          and not olcum42.tire_var(o.raw_text)
                          and olcum42.ok_tanimsiz(o.raw_text))      as sadece_tanimsiz,
       count(*) filter (where not olcum42.ok_gercek(o.raw_text)
                          and not olcum42.tire_var(o.raw_text)
                          and not olcum42.ok_tanimsiz(o.raw_text))  as hakiki_ayracsiz
from olcum42.olcum o
join public.raw_posts r on r.id = o.id
where o.kume = 'hedef' and o.yer >= 2
group by 2
order by 2 desc;


-- ============================================================================
-- BÖLÜM 10c — parse-listing sürüm sınırı nerede?
-- `no_lane` + `processed_at` damgası olan EN ESKİ satır ≈ #41'in canlıya çıktığı an.
-- O andan SONRAKİ satırlar bugünkü kodun çıktısıdır; ölçümün temiz kesimi budur.
-- ============================================================================
select 'BÖLÜM 10c — damga sınırı' as bolum,
       min(processed_at) filter (where processing_status = 'no_lane') as ilk_damgali_no_lane,
       max(processed_at) filter (where processing_status = 'no_lane') as son_damgali_no_lane,
       count(*) filter (where processing_status = 'no_lane'
                          and processed_at is null)                   as damgasiz_no_lane,
       count(*) filter (where processing_status = 'no_lane'
                          and processed_at is not null)               as damgali_no_lane
from public.raw_posts
where message_date >= current_date - interval '30 days';


-- ============================================================================
-- BÖLÜM 10d — 👉 TEMİZ KESİM: yalnız damgalı (= bugünkü kod) satırlarda
-- BÖLÜM 4'ün tavanı ve 9b'nin üç sınıfı. Karar bu tabloya göre verilecek,
-- fosilli olanlara göre değil.
-- ============================================================================
select 'BÖLÜM 10d — temiz kesim' as bolum,
       count(*)                                                      as no_lane_damgali,
       count(*) filter (where o.yer = 0)                             as kova_a,
       count(*) filter (where o.yer = 1)                             as kova_b,
       count(*) filter (where o.yer >= 2)                            as kova_c,
       count(*) filter (where o.yer >= 2
                          and (olcum42.ok_gercek(o.raw_text)
                               or olcum42.tire_var(o.raw_text)))      as c_kod_zaten_goruyor,
       count(*) filter (where o.yer >= 2
                          and not olcum42.ok_gercek(o.raw_text)
                          and not olcum42.tire_var(o.raw_text)
                          and olcum42.ok_tanimsiz(o.raw_text))        as c_sadece_tanimsiz,
       count(*) filter (where o.yer >= 2
                          and not olcum42.ok_gercek(o.raw_text)
                          and not olcum42.tire_var(o.raw_text)
                          and not olcum42.ok_tanimsiz(o.raw_text))    as c_hakiki_ayracsiz
from olcum42.olcum o
join public.raw_posts r on r.id = o.id
where o.kume = 'hedef' and r.processed_at is not null;


-- ============================================================================
-- BÖLÜM 10e — Temiz kesimde "kod zaten görüyor" satırları. Fosil değillerse
-- bunlar CANLI bug'dır ve tek tek kazılacak. Örnekleri buradan alacağız.
-- ============================================================================
select 'BÖLÜM 10e — canlı bug adayları' as bolum,
       r.processed_at,
       o.yer,
       replace(left(o.raw_text, 200), chr(10), ' ⏎ ') as metin
from olcum42.olcum o
join public.raw_posts r on r.id = o.id
where o.kume = 'hedef' and o.yer >= 2
  and r.processed_at is not null
  and (olcum42.ok_gercek(o.raw_text) or olcum42.tire_var(o.raw_text))
order by r.processed_at desc
limit 25;
