-- ============================================================================
-- FORM KANALI KAPSAMA DOĞRULAMASI  (#29)  — 31 Tem 2026
-- Coğrafi Veri Standardizasyonu / Dalga 5 ön koşulu
-- ============================================================================
--
-- 🚨 ÖNCE BİR DÜZELTME: BU GÖREV YANLIŞ İSİMLE TAKİP EDİLİYORDU.
--
-- `YAPILACAKLAR.md`, `PROJE_HARITASI.md` ve `20260730_ilan_olustur_v3.sql`
-- "form kanalı = `source='manual'`" yazıyordu. DEĞİL. Kanıt:
--
--   app/ilan-ver/actions.ts:90   → ilanYaz(user.id, formData, 'form')
--   lib/ilan-yaz.ts:84           → IlanKaynak = 'form'|'excel'|'whatsapp'|'moderator'
--   lib/ilan-yaz.ts:341          → source: kaynak            (RPC'ye aynen gider)
--   app/moderator/page.tsx:956   → <option value='form'>Yükegel Form</option>
--   PROJE_HARITASI.md:1171       → "source: 'form' korundu, CHECK karıştırmamak için"
--
-- Karışıklığın kaynağı `app/moderator/actions.ts:149`:
--
--     /** `raw_posts.source` beyaz listesi ... */
--     const KAYNAK_SETI = new Set(['whatsapp','facebook','telegram','manual'])
--
-- Bu küme **`raw_posts.source`** içindir — moderatörün ham mesajı NEREDEN
-- kopyaladığını anlatır. `listings_source_check` ile aynı şey değil. Üç ayrı
-- belgeye "geçerli küme: whatsapp|facebook|telegram|manual" diye bu satırdan
-- alıntılanmış ve `listings`'e ait sanılmış.
--
-- ⚠️ PRATİK SONUCU: `where source='manual'` ile doğrulama yaparsan form
-- kanalında ilan AÇSAN BİLE sıfır satır dönerdi ve "form kanalı kırık" diye
-- yanlış bir sonuca varırdın. Ölçmediğin bir şeyi bozuk sanmak, ölçmediğini
-- unutmaktan daha pahalıdır.
--
-- 24 saatlik ölçümün ASIL bulgusu değişmiyor: dökümde `form` satırı da yoktu,
-- yani form kanalı o pencerede gerçekten ilan üretmedi. Kapsaması hâlâ
-- ÖLÇÜLMEDİ — ama artık doğru etiketle arıyoruz.
--
-- ⚠️ `destination_province_id` DİYE BİR KOLON YOK. Varış noktaları
-- `listing_stops` satırlarıdır (`20260730_province_id.sql:177-183`). Yalnız
-- `listings`'e bakan bir doğrulama, duraklardaki eksiği GÖREMEZ.
-- ============================================================================


-- ── ADIM 0 — Kısıtın gerçek tanımını OKU (çıkarımla yetinme) ────────────────
-- Yukarıdaki gerekçe kod okumasına dayanıyor. Bu sorgu onu canlı şemadan
-- doğrular. `'form'` bu listede yoksa durum çok daha ciddi: her form gönderimi
-- 23514 ile ölüyor demektir.
select conname, pg_get_constraintdef(oid) as tanim
from pg_constraint
where conrelid = 'public.listings'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%source%';


-- ── ADIM 1 — Tarihsel dağılım: form kanalı hiç yazmış mı? ───────────────────
-- 24 saatlik pencere yerine TÜM tabloya bakıyoruz. Amaç kapsama oranı değil,
-- `source` sütununda gerçekte hangi değerlerin bulunduğunu görmek.
select source,
       count(*)                             as toplam,
       count(origin_province_id)            as id_dolu,
       count(*) - count(origin_province_id) as eksik,
       min(created_at)                      as ilk,
       max(created_at)                      as son
from public.listings
group by source
order by toplam desc;


-- ============================================================================
-- ADIM 2 — CANLI TEST:  /ilan-ver üzerinden BİR ilan aç, sonra aşağıyı çalıştır
--          (en az iki duraklı seç; tek durak `listing_stops` tarafını test etmez)
-- ============================================================================

-- 2.a Kalkış tarafı — metin kanonik mi, id dolu mu?
select l.id,
       l.created_at,
       l.source,
       l.origin_city,
       l.origin_province_id,
       p.name as il_adi_beklenen,
       l.origin_district,
       l.origin_district_official
from public.listings l
left join public.provinces p on p.id = l.origin_province_id
where l.source = 'form'
  and l.created_at > now() - interval '1 hour'
order by l.created_at desc;
-- BEKLENEN: `origin_province_id` DOLU · `origin_city` = `il_adi_beklenen`
--           (ör. 34 → "İstanbul"; "istanbul" kalmışsa RPC v3 kanonikleştirmemiş).

-- 2.b Durak tarafı — varış noktaları burada. Asıl atlanan yer.
select s.listing_id,
       s.stop_order,
       s.city,
       s.province_id,
       p.name as il_adi_beklenen,
       s.district,
       s.district_official
from public.listing_stops s
join public.listings l on l.id = s.listing_id
left join public.provinces p on p.id = s.province_id
where l.source = 'form'
  and l.created_at > now() - interval '1 hour'
order by s.listing_id, s.stop_order;
-- BEKLENEN: her satırda `province_id` DOLU · `city` = `il_adi_beklenen`.

-- 2.c Tek satırlık geçti/kaldı — gözle karşılaştırmayı bırak.
-- ⚠️ `count(x)` NULL'ları saymaz; `eksik > 0` ise kapsama BAŞARISIZ.
select
  (select count(*) from public.listings
     where source='form' and created_at > now() - interval '1 hour')                        as ilan,
  (select count(*) from public.listings
     where source='form' and created_at > now() - interval '1 hour'
       and origin_province_id is null)                                                      as ilan_eksik,
  (select count(*) from public.listing_stops s join public.listings l on l.id=s.listing_id
     where l.source='form' and l.created_at > now() - interval '1 hour')                     as durak,
  (select count(*) from public.listing_stops s join public.listings l on l.id=s.listing_id
     where l.source='form' and l.created_at > now() - interval '1 hour'
       and s.province_id is null)                                                           as durak_eksik,
  -- metin ↔ id çelişkisi (Dalga 5 metin kolonlarını düşürünce bu sessizce kaybolur,
  -- o yüzden DROP'tan ÖNCE ölçülmeli)
  (select count(*) from public.listings l join public.provinces p on p.id=l.origin_province_id
     where l.source='form' and l.created_at > now() - interval '1 hour'
       and l.origin_city is distinct from p.name)                                           as ilan_celiski,
  (select count(*) from public.listing_stops s
     join public.listings l on l.id=s.listing_id
     join public.provinces p on p.id=s.province_id
     where l.source='form' and l.created_at > now() - interval '1 hour'
       and s.city is distinct from p.name)                                                  as durak_celiski;
-- GEÇTİ: ilan >= 1 · durak >= 2 · dört `eksik`/`celiski` sütunu da 0.


-- ── ADIM 3 — Test ilanını temizle (id'yi 2.a'dan al) ────────────────────────
-- `listing_stops` FK'si cascade değilse önce duraklar silinmeli.
-- begin;
--   delete from public.listing_stops where listing_id = '<ID>';
--   delete from public.listings      where id         = '<ID>';
-- commit;
