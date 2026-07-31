-- ═══════════════════════════════════════════════════════════════════════════
-- DALGA 3 — KEŞİF (hiçbir şeyi DEĞİŞTİRMEZ, sadece okur)
-- `docs/COGRAFI_GECIS.md` Dalga 3 · 30 Temmuz 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🚨 NEDEN BU ADIM VAR: radar fonksiyonları `docs/` altında **beş ayrı dosyada**
-- ve birbirlerinin üstüne yazıyorlar:
--     20260604_radar_intelligence_rpc.sql        → get_radar_intelligence
--     20260609_radar_analitik_perf.sql           → get_radar_city_overview + _detail
--     20260609_radar_analitik_counterpart_filter.sql → get_radar_city_detail (tekrar)
--     20260616_radar_analitik_indexes.sql        → get_radar_city_overview (tekrar)
--     20260630_radar_rpc_perf_fix.sql            → get_radar_intelligence (tekrar)
-- Hangisinin canlıda olduğu dosyalardan ANLAŞILMIYOR; ayrıca elle çalıştırılmış
-- ama depoya yazılmamış bir sürüm de olabilir. Yeni sürümü YANLIŞ tabandan
-- yazmak, aradaki performans düzeltmelerini SESSİZCE geri alır — çalışır görünür,
-- sadece yavaşlar veya farklı sonuç döner.
--
-- Bu yüzden Dalga 3 migration'ı canlı gövdeden türetilecek. Aşağıdaki üç sorguyu
-- çalıştırıp çıktıyı olduğu gibi geri ver.
-- ⚠️ Supabase SQL Editor yalnız SON ifadenin sonucunu gösterir — TEK TEK çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1 — Canlı fonksiyon gövdeleri (Dalga 3'ün gerçek tabanı)
-- ───────────────────────────────────────────────────────────────────────────
-- Çıktı uzun olacak; hepsini ver. `prosrc` yerine `pg_get_functiondef` çünkü
-- imza + volatility + security tanımı da lazım (SECURITY DEFINER'ı kaybetmek
-- fonksiyonu sessizce yetkisiz bırakır).

select p.oid::regprocedure                as imza,
       p.provolatile                      as volatility,   -- i/s/v
       p.prosecdef                        as security_definer,
       pg_get_functiondef(p.oid)          as govde
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_radar_intelligence',
    'get_radar_city_overview',
    'get_radar_city_detail',
    'get_nearby_listings_by_city'
  )
order by p.proname, p.oid::regprocedure::text;

-- ⚠️ AYNI ADDA BİRDEN FAZLA SATIR = overload var. `20260616_..._indexes.sql`
-- başlığı bu sorunu bir kez yaşadıklarını yazıyor ("API p_counterpart
-- gönderiyor → overload hataları"). İmza değiştirirken eskiyi DROP etmezsek
-- PostgREST hangisini çağıracağını seçemez.


-- ───────────────────────────────────────────────────────────────────────────
-- 2 — İlgili tablolardaki canlı index'ler
-- ───────────────────────────────────────────────────────────────────────────
-- Dalga 3 metin index'lerini düşürecek. Neyin var olduğunu bilmeden DROP
-- yazmak ya boşa gider ya da hâlâ kullanılan bir index'i alır.

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('listings', 'listing_stops')
order by tablename, indexname;


-- ───────────────────────────────────────────────────────────────────────────
-- 3 — ILIKE '%…%' ne kadar veri topluyor? (kapsama taban ölçümü)
-- ───────────────────────────────────────────────────────────────────────────
-- 🚨 EN BÜYÜK RİSK: `origin_city ILIKE '%Ankara%'` ile
-- `origin_province_id = 6` AYNI KÜMEYİ DÖNDÜRMEYEBİLİR. İki yönlü sapma var:
--   • ILIKE FAZLA yakalıyor olabilir — alt dize eşleşmesi ("Kars" → "Kırıkkars"
--     yok ama "Sinop" ↔ "Sinop Merkez" gibi serbest metinler var).
--   • ILIKE EKSİK yakalıyor olabilir — `province_id` dolu ama metin başka
--     yazılmış satırlar (W5 sınıfı).
-- Bu sorgu ikisini de sayar. Çıktı Dalga 3'ün kabul kriteri olacak.

with ornek(il_adi, il_id) as (
  values ('İstanbul',34), ('Ankara',6), ('İzmir',35), ('Bursa',16),
         ('Antalya',7), ('Konya',42), ('Adana',1), ('Mersin',33),
         ('Kars',36), ('Muş',49)
)
select o.il_adi,
       o.il_id,
       count(*) filter (where l.origin_city ilike '%' || o.il_adi || '%')      as ilike_yakalar,
       count(*) filter (where l.origin_province_id = o.il_id)                  as id_yakalar,
       count(*) filter (where l.origin_city ilike '%' || o.il_adi || '%'
                          and l.origin_province_id is distinct from o.il_id)   as sadece_ilike,
       count(*) filter (where l.origin_province_id = o.il_id
                          and l.origin_city not ilike '%' || o.il_adi || '%')  as sadece_id
from ornek o
cross join public.listings l
group by 1,2
order by id_yakalar desc;

-- BEKLENEN: `sadece_ilike` ve `sadece_id` ikisi de **0**.
--   `sadece_id` > 0  → metin hâlâ bozuk; Dalga 3 kullanıcıya kazanç getirir
--                      (bu satırlar bugün radar/nearby'de GÖRÜNMÜYOR).
--   `sadece_ilike` > 0 → ILIKE alakasız satır topluyor VEYA `province_id` NULL;
--                      hangisi olduğunu ayrıca sorgularız.
