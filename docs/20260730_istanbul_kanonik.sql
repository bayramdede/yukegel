-- ============================================================================
-- 20260730_istanbul_kanonik.sql
-- `origin_city = 'istanbul'` (22.474 satır) → kanonik `İstanbul`
-- ============================================================================
--
-- BULGU (30 Tem 2026, province_id migration'ının 8.x doğrulamalarından sonra):
--
--   select l.origin_city, p.name, count(*) from listings l
--   join provinces p on p.id = l.origin_province_id
--   where l.origin_city <> p.name group by 1,2;
--   → TEK satır: istanbul | İstanbul | 22474
--
-- Yani `listings` tablosundaki bozuk il yazımının %100'ü bu. Kaynak tek:
-- `source = 'whatsapp'`, ilk 12 May 2026, **son 29 Tem 2026** — yani CANLI.
--
-- NEDEN ÖNEMLİ (asıl zarar sahte güzergâh değil):
--   `app/_components/HomeClient.tsx:711`  →  `i.kalkis?.includes(kalkis)`
--   `.includes` büyük/küçük harfe DUYARLI. Dropdown (satır 823) `ILLER`'den
--   kanonik `İstanbul` veriyor. Kullanıcı Kalkış İli = İstanbul seçince bu
--   22.474 ilan HİÇ GÖRÜNMÜYOR — tüm ilanların ~%9,6'sı, hem de en çok
--   aranan il. Sahte İstanbul→İstanbul güzergâhı (1.565 satır) bunun yanında
--   küçük kalıyor.
--
-- 🔁 BU DOSYA BİR TAVSİYE DÜZELTMESİDİR. `docs/COGRAFI_GECIS.md`'de W5
--    runbook'unun il yazımı adımları "province_id çözer" gerekçesiyle iptal
--    edilmişti. O gerekçe yalnızca YENİ id kolonu için geçerli; metin kolonu
--    Dalga 3'e kadar canlı arayüzü beslemeye devam ediyor. Runbook Adım 2
--    zaten bunu yazıyordu ("şehir filtresi hâlâ ham değere bakıyor").
--
-- 🚨 İKİ BLOK, SIRAYLA. Blok 1 KAYNAĞI kurutur, Blok 2 GEÇMİŞİ onarır.
--    Sırayı ters çevirirsen whatsapp akışı deliği anında yeniden açar.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK 1 — KAYNAK. `aliases.normalized` bozuk yazımları.                   ║
-- ║ = W5 runbook Adım 2 (K/BÖLÜM 1). Buradan gelen değer                     ║
-- ║ `parse-listing/index.ts:818`'de `origin_city`'ye AYNEN yazılıyor.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1.1 ÖNCE BAK — hangi satırlar? (tek tek çalıştır, çıktıyı sakla)
select a.id, a.type, a.alias, a.normalized, p.name as kanonik, a.is_active
from public.aliases a
join public.provinces p on public.il_key(p.name) = public.il_key(a.normalized)
where a.type = 'city'
  and a.normalized <> p.name
order by a.normalized;

-- 1.2 DÜZELT — `normalized`'ı provinces'ten kanonikleştir.
--     `il_key` eşitliği zaten aynı ili garanti ediyor; yanlış ile kayma riski yok.
--
--     ✅ 23505 RİSKİ YOK: `aliases`'taki unique kısıt **`alias`** kolonunda ve HAM
--        string üzerinde (runbook Adım 9: `Gebze`/`GEBZE`/`gebze` üç ayrı satır).
--        Bu update `alias`'a DOKUNMUYOR, yalnızca `normalized`'ı değiştiriyor.
--     ➕ YAN FAYDA: runbook Adım 9'un ölçümündeki `farkli_normalized` sayısını
--        düşürür — yani D3'ün (`20260729_alias_normalize_trigger.sql`) UNIQUE
--        indeks önkoşuluna doğru bir adım. Adım 9'un kopya pasifleştirmesi yine
--        de ayrıca gerekli.
begin;

update public.aliases a
set normalized = p.name
from public.provinces p
where a.type = 'city'
  and public.il_key(p.name) = public.il_key(a.normalized)
  and a.normalized <> p.name;

commit;

-- 1.3 DOĞRULA — 1.1'i tekrar çalıştır, SIFIR satır dönmeli.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK 2 — GEÇMİŞ. Metin kolonunu id'den onar.                             ║
-- ║ Bu, province_id migration'ının ilk somut getirisi: 8.2 doğrulaması       ║
-- ║ id ile metnin HİÇBİR YERDE çelişmediğini kanıtladı, dolayısıyla id       ║
-- ║ artık metni onarmak için güvenilir bir OTORİTE.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 2.1 ÖN SAYIM — kaç satır değişecek? (listings 22.474 beklenir)
select 'listings' as tablo, count(*) as degisecek
from public.listings l
join public.provinces p on p.id = l.origin_province_id
where l.origin_city <> p.name
union all
select 'listing_stops', count(*)
from public.listing_stops s
join public.provinces p on p.id = s.province_id
where s.city <> p.name;

-- 2.2 ONAR
begin;

update public.listings l
set origin_city = p.name
from public.provinces p
where p.id = l.origin_province_id
  and l.origin_city <> p.name;

update public.listing_stops s
set city = p.name
from public.provinces p
where p.id = s.province_id
  and s.city <> p.name;

commit;

-- 2.3 DOĞRULA — 2.1'i tekrar çalıştır, iki satır da 0 dönmeli.

-- 2.4 Sahte güzergâh sayacı: onarım öncesi 1.565 idi, şimdi 0 dönmeli.
--     (Aynı il içi TOPLAM 6.173 satır meşru şehir içi taşımadır, o değişmez.)
select count(*) as farkli_yazimli_ayni_il
from public.listings l
join public.listing_stops s on s.listing_id = l.id
where l.origin_province_id = s.province_id
  and public.il_key(l.origin_city) = public.il_key(s.city)
  and l.origin_city <> s.city;


-- ============================================================================
-- GERİ ALMA
-- ============================================================================
-- Yok — ve gerekmiyor. Her iki blok da veriyi YALNIZCA kanonik yazıma taşıyor,
-- bilgi kaybı olmuyor ('istanbul' ile 'İstanbul' aynı ili gösteriyor). Yanlışlıkla
-- çalıştırılırsa bile sonuç doğru veridir.
--
-- ============================================================================
-- KALICI ÇÖZÜM DEĞİL
-- ============================================================================
-- Bu dosya deliği tıkar ama `learn-aliases` yeni bozuk satır üretmeye devam
-- edebilir. Kalıcı koruma: `docs/20260729_alias_normalize_trigger.sql`
-- (trigger + katlanmış UNIQUE indeks) — önkoşulu runbook Adım 9.
-- Ondan sonra Dalga 2/3 metin kolonunu okuma yolundan tamamen çıkarır.
-- ============================================================================
