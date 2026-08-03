-- ============================================================================
-- 3 Ağu 2026 — `get_nearby_listings_by_province` CTE'sindeki ÖLÜ `city`
-- referansının temizliği. Dalga 5 / BÖLÜM 2 / KOVA E. Görev #37.
-- ============================================================================
--
-- ── NE OLDU ────────────────────────────────────────────────────────────────
-- Dalga 3 (`docs/20260730_dalga3_radar_province_id.sql`) bu fonksiyonu metin
-- karşılaştırmasından `province_id`'ye çevirdi. RETURN ifadesi doğru çevrildi:
-- `dest_city` artık `pd.name`'den, yani `provinces` join'inden geliyor.
--
-- Ama `son_durak` CTE'sinin SELECT LİSTESİ temizlenmedi:
--
--     with son_durak as (
--       select distinct on (listing_id)
--         listing_id, province_id, city, district      ← `city` hiç okunmuyor
--       from public.listing_stops
--       order by listing_id, stop_order desc
--     )
--
-- `sd.city` fonksiyonun geri kalanında BİR KEZ BİLE geçmiyor. Bugün zararsız:
-- fazladan bir kolon okunuyor, sonuç doğru.
--
-- ── NEDEN ŞİMDİ ────────────────────────────────────────────────────────────
-- Dalga 5 / BÖLÜM 5 `listing_stops.city`'yi DÜŞÜRÜYOR. O an bu fonksiyon
-- 42703 atmaya başlar. Zinciri:
--   public.get_nearby_listings_by_province
--     ← app/api/listings/yakin/route.ts:44
--       ← app/yol-rehberi/YolRehberiClient.tsx ("yakınımdaki yükler" sekmesi)
-- Yani GPS'e dayalı keşif akışının tamamı sessizce ölür.
--
-- 🚨 BU BULGUYU TS TARAMASI ASLA GÖSTEREMEZDİ. BÖLÜM 2'nin envanteri
--    `.ts`/`.tsx` içinde `origin_city` / `city` arıyor. Bu dosyalarda öyle bir
--    şey yok — `YolRehberiClient.tsx:64`'teki `origin_city` alanı RPC'nin ÇIKTI
--    kolonu, tablo kolonu değil; ve o çıktı `provinces.name`'den geliyor, yani
--    drop'tan etkilenmiyor. Bağımlılık yalnızca fonksiyon GÖVDESİNDE.
--    → "Kod temizliği" derken ikinci bir kod tabanı unutulmuştu: Postgres.
--
-- ── RİSK ───────────────────────────────────────────────────────────────────
-- YOK. Kullanılmayan bir kolonu SELECT listesinden çıkarmak. İmza, dönüş tipi,
-- satır kümesi, sıralama — hepsi aynı. Bu yüzden v4'ü veya BÖLÜM 2'yi BEKLEMEZ;
-- tek başına, bugün çıkabilir. Tek koşul: BÖLÜM 5'ten ÖNCE olması.
--
-- ⚠️ `create or replace` GRANT'ları KORUR (drop+create korumaz). Bu yüzden
--    aşağıda grant tekrarı yok; yine de ADIM 2'de doğrulanıyor.
-- ============================================================================


-- ── ADIM 0 — Değiştirmeden önce canlı gövdeyi teyit et ─────────────────────
-- Beklenen: aşağıdaki `create or replace` ile birebir aynı (yalnız `city` fazla).
-- Ayrışmışsa DUR: canlıda bu dosyanın bilmediği bir sürüm var demektir.
--
-- select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname = 'get_nearby_listings_by_province';


-- ── ADIM 1 — Fonksiyonu yeniden yarat ──────────────────────────────────────
create or replace function public.get_nearby_listings_by_province(
  p_province_id integer,
  p_district    text    default null,
  p_limit       integer default 20
)
returns table(
  id uuid,
  listing_type text,
  origin_province_id integer,
  -- ⚠️ `origin_city` / `dest_city` ÇIKTI ADLARI KASITLI OLARAK KALIYOR.
  --    Kaynakları `provinces.name` (po/pd join'i) — düşen metin kolonlarıyla
  --    ilgileri yok. Tüketici `YolRehberiClient.tsx:64` bu adlara bağlı;
  --    yeniden adlandırmak Dalga 5'in kapsamı dışında bir kırılma olurdu.
  origin_city text,
  origin_district text,
  dest_province_id integer,
  dest_city text,
  dest_district text,
  vehicle_type text[],
  body_type text[],
  price_offer numeric,
  price_negotiable boolean,
  available_date text,
  date_flexible boolean,
  created_at timestamp with time zone,
  eslesme text
)
language sql
stable security definer
as $function$
  with son_durak as (
    -- 3 Ağu 2026: `city` bu listeden ÇIKARILDI (Dalga 5 / KOVA E).
    -- Hiç okunmuyordu; `dest_city` aşağıda `pd.name`'den türüyor.
    select distinct on (listing_id)
      listing_id, province_id, district
    from public.listing_stops
    order by listing_id, stop_order desc
  )
  select
    l.id,
    l.listing_type,
    l.origin_province_id,
    po.name  as origin_city,
    l.origin_district,
    sd.province_id as dest_province_id,
    pd.name  as dest_city,
    sd.district as dest_district,
    l.vehicle_type,
    l.body_type,
    l.price_offer,
    l.price_negotiable,
    l.available_date,
    l.date_flexible,
    l.created_at,
    case
      when p_district is not null
       and public.il_key(l.origin_district) = public.il_key(p_district)
      then 'ilce'
      else 'il'
    end as eslesme
  from public.listings l
  join public.provinces po on po.id = l.origin_province_id
  left join son_durak sd on sd.listing_id = l.id
  left join public.provinces pd on pd.id = sd.province_id
  where
    l.origin_province_id = p_province_id
    and l.status = 'active'
    and l.moderation_status in ('approved', 'auto_published')
    and l.is_shadow_banned = false
  order by
    case
      when p_district is not null
       and public.il_key(l.origin_district) = public.il_key(p_district)
      then 0 else 1
    end,
    l.created_at desc
  limit p_limit;
$function$;


-- ── ADIM 2 — DOĞRULAMA ─────────────────────────────────────────────────────

-- 2.1 Gövdede metin kolonu kalmadı mı? Beklenen: 0 satır.
select trim(satir) as kalan_satir
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as satir
 where n.nspname = 'public'
   and p.proname = 'get_nearby_listings_by_province'
   and satir ~* '\mcity\M'
   and satir !~* '(origin_city text|dest_city text|as origin_city|as dest_city|--)';

-- 2.2 GRANT'lar duruyor mu? Beklenen: authenticated + service_role.
select r.rolname, a.privilege_type
  from information_schema.routine_privileges a
  join pg_roles r on r.rolname = a.grantee
 where a.routine_schema = 'public'
   and a.routine_name = 'get_nearby_listings_by_province'
 order by 1;

-- 2.3 Fonksiyon çalışıyor ve AYNI sonucu veriyor mu?
--     İstanbul (34) — değişiklikten önce ve sonra satır sayısı eşit olmalı.
select count(*) as satir, count(distinct id) as ilan
  from public.get_nearby_listings_by_province(34, null, 20);

-- 2.4 Duman testi (canlı, deploy sonrası)
--   [ ] /yol-rehberi → "Yakınımdaki Yükler" sekmesi konum izniyle sonuç veriyor
--   [ ] Listede varış ili (`dest_city`) dolu görünüyor
