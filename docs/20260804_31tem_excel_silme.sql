-- =====================================================================
-- 31 Temmuz excel partisinin silinmesi
-- Tarih: 4 Ağustos 2026
-- Görev: #47
-- =====================================================================
--
-- ÖNCE ŞUNU OKU — KAPSAM İKİYE AYRILIYOR
-- ---------------------------------------------------------------------
-- "31 Temmuz excel kayıtları" tek bir parti değil. 4 Ağu ölçümünde
-- (200 satır, iki CSV, ilKey katlamasıyla locations.json'a karşı puanlama)
-- 31 Tem yüklemesi iki bloğa ayrıldı:
--
--   BLOK 1  07:54:32 – 07:54:39   23 ilan / 23 durak   TEK duraklı
--           23/23 district_official=true  →  TEMİZ, kaydırma YOK
--           (İzmir/Kemalpaşa grubu; #44'te zaten elle düzeltildi)
--
--   BLOK 2  07:54:40 – 07:54:43   22 ilan / 43 durak   ÇOK duraklı
--           çok duraklı alt küme (31 satır, 10 ilan):
--             olduğu gibi   %48 (10/21)
--             1 satır kaydırılmış  %95 (19/20)
--           →  BOZUK. Excel dosyasında ilçe kolonu ~19. satırdan
--              itibaren bir satır aşağı kaymış ("hücre ekle, aşağı
--              kaydır" kazası). Kayma ilan sınırlarını geçiyor,
--              yani dosya düzeyinde bir bozulma — import kodu değil.
--              (Import kodunun sağlamlığı 4 Ağu dosyasının kusursuz
--              içeri alınmasıyla ayrıca kanıtlandı.)
--
-- ÖNERİ: sadece BLOK 2 silinsin. BLOK 1 temiz ve canlı; silmek
-- 23 sağlam ilanı gereksiz yere yok eder.
-- Yine de karar senin — aşağıda her iki kapsam da ayrı ayrı sayılıyor
-- ve ayrı ayrı çalıştırılabiliyor.
--
-- SİLME YÖNTEMİ: önce YEDEK, sonra ARŞİVLE (soft), gerekirse SİL (hard).
-- Hard delete'i varsayılan yapmadım — arşivleme geri alınabilir, silme
-- alınamaz. FK tarafı temiz çıktı (BÖLÜM 2): tek referans listing_stops
-- ve o da ON DELETE CASCADE, yani hard delete seçilirse duraklar
-- kendiliğinden düşer.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BÖLÜM 1 — Kapsam sayımı (HİÇBİR ŞEY DEĞİŞMEZ, önce bunu çalıştır)
-- ---------------------------------------------------------------------
with p as (
  select l.id, l.created_at
  from public.listings l
  where l.source = 'excel'
    and l.created_at >= '2026-07-31 00:00:00+00'
    and l.created_at <  '2026-08-01 00:00:00+00'
)
select
  'TÜM 31 TEM'                          as kapsam,
  count(*)                              as ilan,
  (select count(*) from public.listing_stops s where s.listing_id in (select id from p)) as durak,
  min(created_at)                       as ilk,
  max(created_at)                       as son
from p
union all
select
  'BLOK 1 — temiz (< 07:54:40)',
  count(*) filter (where created_at < '2026-07-31 07:54:40+00'),
  (select count(*) from public.listing_stops s
    where s.listing_id in (select id from p where created_at < '2026-07-31 07:54:40+00')),
  min(created_at) filter (where created_at < '2026-07-31 07:54:40+00'),
  max(created_at) filter (where created_at < '2026-07-31 07:54:40+00')
from p
union all
select
  'BLOK 2 — bozuk (>= 07:54:40)',
  count(*) filter (where created_at >= '2026-07-31 07:54:40+00'),
  (select count(*) from public.listing_stops s
    where s.listing_id in (select id from p where created_at >= '2026-07-31 07:54:40+00')),
  min(created_at) filter (where created_at >= '2026-07-31 07:54:40+00'),
  max(created_at) filter (where created_at >= '2026-07-31 07:54:40+00')
from p;

-- ÖLÇÜLDÜ (4 Ağu, canlı DB):
--   TÜM 31 TEM   ilan 45   durak 66
--   BLOK 1       ilan 23   durak 23
--   BLOK 2       ilan 22   durak 43
--
-- ⚠️ CSV'den okuduğum ilk tahmin 38/59 ve BLOK 1 için 16/16 idi — YANLIŞTI.
-- Sebep: Supabase sonuç export'u 100 satırda kesiyor. İlk CSV 84 satır
-- 29 Tem + 16 satır 31 Tem = tam 100; o "16" blok büyüklüğü değil KESME
-- SINIRIYDI. BLOK 2 (silinecek küme) her iki ölçümde de 22/43 çıktı.
--
-- Blok saflığı ayrıca ölçüldü (district_official dağılımı):
--   BLOK 1 : 23 durak, hepsi dolu, hepsi true      → %100 temiz
--   BLOK 2 : 18 true / 16 false / 9 NULL           → dolu olanın %53'ü doğru
-- 9 NULL kaydırmanın mekanik izi: bir satır aşağı kaymada son satıra
-- yazacak değer kalmaz. BLOK 1'de sıfır boş ilçe var.
--
-- FK taraması (BÖLÜM 2, ölçüldü): tek referans
--   listing_stops_listing_id_fkey ... ON DELETE CASCADE
-- Yani listings silinince duraklar kendiliğinden düşer.


-- ---------------------------------------------------------------------
-- BÖLÜM 2 — Başka FK var mı? (silmeden önce zorunlu kontrol)
-- ---------------------------------------------------------------------
-- listings'e referans veren TÜM tabloları listeler. listing_stops
-- dışında bir şey çıkarsa hard delete öncesi onu da ele almak gerekir.
select
  con.conname                       as fk_adi,
  src_ns.nspname || '.' || src.relname as kaynak_tablo,
  pg_get_constraintdef(con.oid)     as tanim
from pg_constraint con
join pg_class     src    on src.oid = con.conrelid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
join pg_class     tgt    on tgt.oid = con.confrelid
join pg_namespace tgt_ns on tgt_ns.oid = tgt.relnamespace
where con.contype = 'f'
  and tgt_ns.nspname = 'public'
  and tgt.relname    = 'listings';


-- ---------------------------------------------------------------------
-- BÖLÜM 3 — YEDEK  (silme/arşivleme öncesi ZORUNLU)
-- ---------------------------------------------------------------------
-- Tüm 31 Temmuz partisini yedekler (BLOK 1 dahil). Yedek geniş olsun,
-- silme dar olsun. Yedek tablolar kalıcıdır; işin bitince elle at.

create table if not exists public.listings_20260804_31tem_yedek as
select l.*
from public.listings l
where l.source = 'excel'
  and l.created_at >= '2026-07-31 00:00:00+00'
  and l.created_at <  '2026-08-01 00:00:00+00';

create table if not exists public.listing_stops_20260804_31tem_yedek as
select s.*
from public.listing_stops s
where s.listing_id in (
  select l.id from public.listings l
  where l.source = 'excel'
    and l.created_at >= '2026-07-31 00:00:00+00'
    and l.created_at <  '2026-08-01 00:00:00+00'
);

-- Yedek doğrulama — beklenen: 45 ilan / 66 durak (BÖLÜM 1 "TÜM 31 TEM").
select
  (select count(*) from public.listings_20260804_31tem_yedek)      as yedek_ilan,
  (select count(*) from public.listing_stops_20260804_31tem_yedek) as yedek_durak;


-- ---------------------------------------------------------------------
-- BÖLÜM 4 — YOL A (ÖNERİLEN): sadece BLOK 2'yi arşivle
-- ---------------------------------------------------------------------
-- Silmez, gizler. moderation_status='archived' + status='passive'
-- ikilisi PROJE_HARITASI:1396'ya göre "hiç dikkate alınmasın" demek.
-- Geri almak: aynı where ile eski değerleri yedekten yaz.

begin;

update public.listings l
set moderation_status = 'archived',
    status            = 'passive'
where l.source = 'excel'
  and l.created_at >= '2026-07-31 07:54:40+00'
  and l.created_at <  '2026-08-01 00:00:00+00';
-- Beklenen: UPDATE 22

-- Kontrol: arşivlenmemiş 31 Tem excel ilanı kaç kaldı? Beklenen: 23 (BLOK 1)
select count(*) as arsivlenmemis_kalan
from public.listings l
where l.source = 'excel'
  and l.created_at >= '2026-07-31 00:00:00+00'
  and l.created_at <  '2026-08-01 00:00:00+00'
  and l.moderation_status <> 'archived';

commit;
-- Sayılar beklenenden farklıysa commit yerine: rollback;


-- ---------------------------------------------------------------------
-- BÖLÜM 5 — YOL B: BLOK 2'yi KALICI SİL   ⚠️ GERİ DÖNÜŞÜ YOK
-- ---------------------------------------------------------------------
-- Bu bölümü BÖLÜM 3 yedeği alınmadan ve BÖLÜM 2 çıktısında
-- listing_stops dışında FK görülmediği doğrulanmadan ÇALIŞTIRMA.
-- Bilerek yorum içinde bırakıldı; çalıştırmak isteyen sen aç.
--
-- begin;
--
--   delete from public.listing_stops s
--   where s.listing_id in (
--     select l.id from public.listings l
--     where l.source = 'excel'
--       and l.created_at >= '2026-07-31 07:54:40+00'
--       and l.created_at <  '2026-08-01 00:00:00+00'
--   );
--   -- Beklenen: DELETE 43
--
--   delete from public.listings l
--   where l.source = 'excel'
--     and l.created_at >= '2026-07-31 07:54:40+00'
--     and l.created_at <  '2026-08-01 00:00:00+00';
--   -- Beklenen: DELETE 22
--
--   -- Kontrol: kalan 31 Tem excel ilanı. Beklenen: 23
--   select count(*) as kalan_ilan
--   from public.listings l
--   where l.source = 'excel'
--     and l.created_at >= '2026-07-31 00:00:00+00'
--     and l.created_at <  '2026-08-01 00:00:00+00';
--
-- commit;
-- -- Sayılar tutmuyorsa: rollback;


-- ---------------------------------------------------------------------
-- BÖLÜM 6 — ✅ SEÇİLEN YOL: TÜM 31 TEM PARTİSİNİ KALICI SİL
-- ---------------------------------------------------------------------
-- Karar (Bayram, 4 Ağu): "Tamamen silelim, bunları test datası gibi
-- görebiliriz." Kapsam BLOK 2 değil, 31 Temmuz'un TAMAMI — 45 ilan / 66 durak.
-- BLOK 1'in 23 ilanı teknik olarak temizdi (23/23 district_official=true);
-- silinme sebebi bozukluk değil, partinin bütünüyle test verisi sayılması.
--
-- BÖLÜM 4 ve 5 ÇALIŞTIRILMIYOR — bu bölüm onların YERİNE geçer.
--
-- ⚠️ ÖN KOŞUL: BÖLÜM 3 yedeği alınmış olmalı. Ölçüldü: 45 / 66. ✅
--    Geri alma yolu: yedek tablolardan `insert into ... select *`.
-- ℹ️ listing_stops silmesi AYRI YAZILMADI — tek FK
--    (`listing_stops_listing_id_fkey`) ON DELETE CASCADE, duraklar
--    listings ile birlikte düşer. Yine de sayıyı görmek için silme
--    öncesi/sonrası durak sayısı kontrol ediliyor.

begin;

-- Silme öncesi durak sayısı. Beklenen: 66
select count(*) as durak_once
from public.listing_stops s
where s.listing_id in (
  select l.id from public.listings l
  where l.source = 'excel'
    and l.created_at >= '2026-07-31 00:00:00+00'
    and l.created_at <  '2026-08-01 00:00:00+00'
);

delete from public.listings l
where l.source = 'excel'
  and l.created_at >= '2026-07-31 00:00:00+00'
  and l.created_at <  '2026-08-01 00:00:00+00';
-- Beklenen: DELETE 45

-- Kontrol: 31 Tem'den kalan ilan ve durak. İkisi de 0 olmalı.
select
  (select count(*) from public.listings l
    where l.source = 'excel'
      and l.created_at >= '2026-07-31 00:00:00+00'
      and l.created_at <  '2026-08-01 00:00:00+00')      as kalan_ilan,
  (select count(*) from public.listing_stops s
    join public.listings l on l.id = s.listing_id
    where l.source = 'excel'
      and l.created_at >= '2026-07-31 00:00:00+00'
      and l.created_at <  '2026-08-01 00:00:00+00')      as kalan_durak;

-- Kontrol: 29 Tem ve 4 Ağu partileri DOKUNULMAMIŞ olmalı.
-- Beklenen: 2026-07-29 → 84 durak civarı, 2026-08-04 → 24 durak civarı;
-- önemli olan ikisinin de SIFIR OLMAMASI.
select date_trunc('day', l.created_at)::date as gun, count(*) as ilan
from public.listings l
where l.source = 'excel'
group by 1 order by 1;

commit;
-- Sayılar beklenenden farklıysa commit yerine: rollback;


-- ---------------------------------------------------------------------
-- BÖLÜM 7 — Son doğrulama
-- ---------------------------------------------------------------------
select
  date_trunc('day', l.created_at)::date as gun,
  l.moderation_status,
  l.status,
  count(*) as adet
from public.listings l
where l.source = 'excel'
  and l.created_at >= '2026-07-29 00:00:00+00'
group by 1, 2, 3
order by 1, 2, 3;

-- 29 Tem ve 4 Ağu satırları DEĞİŞMEMİŞ olmalı — onlar temiz partiler.
-- BÖLÜM 6 çalıştıysa 31 Tem HİÇ GÖRÜNMEMELİ (tek satır bile kalmamalı).


-- =====================================================================
-- SONUÇ KAYDI (çalıştırdıktan sonra doldur)
-- =====================================================================
-- Çalıştırma tarihi : 4 Ağustos 2026
-- BÖLÜM 1  TÜM / BLOK1 / BLOK2 (ilan-durak) : 45-66 / 23-23 / 22-43
-- BÖLÜM 2  listing_stops dışı FK var mı     : YOK (tek FK, ON DELETE CASCADE)
-- BÖLÜM 3  yedek_ilan / yedek_durak         : 45 / 66
-- Seçilen yol                                : BÖLÜM 6 — tüm parti KALICI SİLİNDİ
-- Etkilenen satır sayısı                     : 45 ilan + 66 durak (cascade)
-- BÖLÜM 7  son durum                         : 2026-07-29 auto_published/passive 55 ·
--                                              2026-08-03 auto_published/active 13 ·
--                                              2026-08-04 auto_published/active 10 ·
--                                              2026-07-31 SATIRI YOK ✅
-- Not : BLOK 1'in 23 ilanı bozuk değildi (23/23 district_official=true);
--       parti bütünüyle test verisi sayıldığı için birlikte silindi.
--       Yedek tablolar duruyor — işin bitince elle at.
--       ⚠️ BÖLÜM 7 çıktısı ölçülmemiş bir parti gösterdi: 3 Ağu / 13 ilan.
--       İki CSV örneği 29 Tem, 31 Tem ve 4 Ağu'yu kapsıyordu, 3 Ağu'yu DEĞİL.
-- =====================================================================
