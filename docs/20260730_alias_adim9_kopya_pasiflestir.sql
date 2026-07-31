-- ═══════════════════════════════════════════════════════════════════════════
-- Adım 9 — Katlanmış alias kopyalarını pasifleştirme
-- `docs/20260729_alias_runbook.md` Adım 9 · `20260729_alias_normalize_trigger.sql` ÖNKOŞULU
-- 30 Temmuz 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- NEDEN: `aliases.alias` üzerindeki UNIQUE kısıt HAM string üzerinde. `Çorlu`,
-- `çorlu`, `corlu` üç ayrı satır olarak yaşayabiliyor. BÖLÜM 2'nin kısmi UNIQUE
-- indeksi bunların hepsini TEK katlanmış anahtara indiriyor → kopyalar durduğu
-- sürece indeks 23505 ile reddediliyor.
--   Gözlenen hata: Key (type, translate(...))=(city, cukurova) is duplicated.
--
-- ÖLÇÜM (30 Tem 2026, çalıştırıldı):
--   çatışan grup 552 · toplam satır 1164 · pasiflenecek 612
--   norm_ayrisan_grup 0 · ilce_ayrisan_grup 0
-- Yani HİÇBİR grup içinde `normalized` veya `district` ayrışmıyor — kopyalar
-- zararsız yazım varyantları. Bilgi kaybı YOK.
--
-- ⚠️ NEDEN `is_active=false`, NEDEN `DELETE` DEĞİL: geri alınabilir olsun diye.
-- BÖLÜM 2 indeksi de bu yüzden kısmi (`WHERE is_active = true`) — pasif satırlar
-- tabloda durmaya devam eder ve indeksi ihlal etmez.
--
-- ⚠️ NEDEN `ORDER BY id` (en küçük id kazanır): `parse-listing/index.ts:44`
-- alias'ları `.order('id', {ascending:true})` ile çekiyor ve `findPlaces`
-- `.find()` ile İLK eşleşmeyi alıyor (`:323`, `:337`). Yani bugün de zaten en
-- küçük id kazanıyor. `is_approved`/`priority` ile farklı bir kazanan seçmek
-- ölçülmemiş bir davranış değişikliği olurdu — BU SCRIPT DAVRANIŞI DEĞİŞTİRMEZ.
--
-- ⚠️ Karşılaştırma katlanmış anahtar üzerinden yapıldığı için (`trNorm`,
-- W5/D4) `corlu` satırını pasifleştirmek ASCII yazımlı girdiyi kör etmez —
-- `çorlu` satırı onu da yakalar.
--
-- ⚠️ TRIGGER TETİKLENMEZ: `aliases_normalize_trg` yalnız
-- `BEFORE INSERT OR UPDATE OF alias, normalized, district`. Bu script sadece
-- `is_active` yazıyor.
--
-- SIRA: BÖLÜM 1 (yedek) → BÖLÜM 2 (önizleme) → BÖLÜM 3 (UPDATE) →
--       BÖLÜM 4 (doğrulama) → sonra `20260729_alias_normalize_trigger.sql`
--       BÖLÜM 2 (indeks) + BÖLÜM 3 (testler).
-- ⚠️ Supabase SQL Editor YALNIZ SON ifadenin sonucunu gösterir — bölümleri
--    TEK TEK çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 1 — Geri alma yedeği (ÖNCE BU)
-- ───────────────────────────────────────────────────────────────────────────
-- Pasifleştirilecek id'leri kalıcı bir tabloya yazar. UPDATE'ten SONRA bu
-- id'leri yeniden üretmek İMKÂNSIZ (kaybedenler artık is_active=false, kazanan
-- seçimi sorgusu onları görmez). Yedek olmadan geri alma yok.

-- `create table as` KASITLI: `aliases.id` kolonunun tipi (bigint/uuid) bu depoda
-- hiçbir migration'da yazılı değil. Elle DDL yazmak tip uyuşmazlığı riski taşır;
-- `as select` tipi kaynaktan miras alır. `if not exists` → ikinci çalıştırma
-- yedeği EZMEZ (UPDATE sonrası çalıştırılırsa boş tablo yazardı).

create table if not exists public.aliases_adim9_yedek as
select t.id, t.type, t.alias, t.katlanmis, t.kazanan_id, now() as alindi_at
from (
  select id, type, alias,
         translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') as katlanmis,
         row_number() over (
           partition by type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')
           order by id
         ) as sira,
         first_value(id) over (
           partition by type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')
           order by id
         ) as kazanan_id
  from public.aliases
  where is_active = true
) t
where t.sira > 1;

-- Beklenen: 612
select count(*) as yedeklenen from public.aliases_adim9_yedek;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 2 — Önizleme (UPDATE'ten önce göz gezdir)
-- ───────────────────────────────────────────────────────────────────────────
-- En kalabalık 30 grup: hangi yazım kalıyor, hangileri düşüyor.

select y.katlanmis,
       k.alias                              as kalan_yazim,
       k.normalized                         as kalan_normalized,
       k.district                           as kalan_district,
       array_agg(y.alias order by y.id)     as dusen_yazimlar,
       count(*)                             as dusen_adet
from public.aliases_adim9_yedek y
join public.aliases k on k.id = y.kazanan_id
group by 1,2,3,4
order by dusen_adet desc, y.katlanmis
limit 30;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 3 — Uygula
-- ───────────────────────────────────────────────────────────────────────────
-- Beklenen etkilenen satır: 612

update public.aliases
set is_active = false
where id in (select id from public.aliases_adim9_yedek)
  and is_active = true;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 4 — Doğrulama
-- ───────────────────────────────────────────────────────────────────────────

-- 4.1 — Çatışan grup KALMAMALI. Beklenen: 0 satır.
select translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') as katlanmis,
       count(*) as satir,
       array_agg(alias order by id) as yazimlar
from public.aliases
where is_active = true
group by 1
having count(*) > 1
order by satir desc;

-- 4.2 — Her katlanmış anahtar hâlâ EN AZ BİR aktif satırla temsil ediliyor mu?
--       (Yanlışlıkla bir grubun tamamını pasifleştirmiş olabilir miyiz?)
--       Beklenen: 0 satır.
select y.katlanmis
from public.aliases_adim9_yedek y
where not exists (
  select 1 from public.aliases a
  where a.is_active = true
    and a.type = y.type
    and translate(lower(replace(a.alias,'İ','i')),'ıçğöşü','icgosu') = y.katlanmis
);

-- 4.3 — Sayım. Beklenen: pasiflenen = 612.
select count(*) filter (where is_active) as aktif,
       (select count(*) from public.aliases_adim9_yedek) as pasiflenen
from public.aliases;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 5 — GERİ ALMA (gerekirse)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Önce `aliases_katlanmis_anahtar_uniq` indeksini DÜŞÜR, yoksa geri alma
--    23505 ile patlar (kısmi indeks tam olarak bu durumu yasaklıyor).
--
--   drop index if exists public.aliases_katlanmis_anahtar_uniq;
--   update public.aliases set is_active = true
--   where id in (select id from public.aliases_adim9_yedek);


-- ═══════════════════════════════════════════════════════════════════════════
-- SONRAKİ ADIM
-- ═══════════════════════════════════════════════════════════════════════════
-- `docs/20260729_alias_normalize_trigger.sql`:
--   BÖLÜM 2 → create unique index aliases_katlanmis_anahtar_uniq  (artık geçmeli)
--   BÖLÜM 3 → 3.1 trigger testi · 3.2 indeks testi (23505 BEKLENİYOR) · 3.3 parite
-- Yedek tablosu (`aliases_adim9_yedek`) BÖLÜM 3 doğrulaması geçene kadar DURSUN.
-- ═══════════════════════════════════════════════════════════════════════════
