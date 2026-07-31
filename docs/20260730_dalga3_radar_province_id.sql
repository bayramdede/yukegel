-- ═══════════════════════════════════════════════════════════════════════════
-- DALGA 3 — Radar / nearby RPC'leri `province_id`'ye geçiş
-- `docs/COGRAFI_GECIS.md` Dalga 3 · 30 Temmuz 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 🚨 BU DOSYA CANLI GÖVDEDEN TÜRETİLDİ, `docs/` DOSYALARINDAN DEĞİL.
-- Keşif (`docs/20260730_dalga3_kesif.sql`) şunu gösterdi: depodaki radar
-- migration'ları CANLI HALİ TEMSİL ETMİYOR. En az iki sürüm elle çalıştırılıp
-- depoya yazılmamış:
--   • `get_radar_city_detail` canlıda `=` (exact) kullanıyor;
--     `20260609_radar_analitik_counterpart_filter.sql`'deki 20 `ILIKE` CANLIDA DEĞİL.
--   • `get_radar_intelligence` canlıda `dest_ids AS MATERIALIZED` CTE'li;
--     `20260630_radar_rpc_perf_fix.sql`'deki correlated `EXISTS` sürümünden YENİ.
-- Aşağıdaki gövdeler canlı `pg_get_functiondef` çıktısının üzerine yazıldı —
-- yalnız konum filtreleri değişti, performans mantığı (MATERIALIZED CTE,
-- `v_arrival_ids` dizisi, `set_config` timeout/work_mem) AYNEN korundu.
--
-- ⚠️ DERS: bu depoda bir SQL dosyasının varlığı onun canlıda olduğunu
-- göstermiyor. Radar fonksiyonlarına bir daha dokunulacaksa ÖNCE
-- `pg_get_functiondef` ile canlı gövde alınmalı.
--
-- ── KAPSAMA ÖLÇÜMÜ (30 Tem 2026, keşif sorgusu 3) ─────────────────────────
-- 10 ilin hepsinde `sadece_ilike = 0` ve `sadece_id = 0`. Yani metin ile id
-- BUGÜN aynı kümeyi döndürüyor (İstanbul kanonikleştirmesi deliği kapattı).
-- Bu geçiş **davranış değiştirmiyor**; kazanç şurada:
--   1. `= integer` karşılaştırması `ILIKE '%…%'` yerine gerçek index kullanır
--      (`listings_province_durum_idx`, `listing_stops_province_idx`).
--   2. Yazım bozulması sınıfı bir daha radar/nearby'yi kör edemez.
--   3. Dalga 5 metin kolonlarını düşürdüğünde bu fonksiyonlar KIRILMAZ.
--
-- ── API SÖZLEŞMESİ KARARI ────────────────────────────────────────────────
-- RPC'ler artık `province_id` (integer) alıyor. HTTP katmanı (`/api/admin/radar/*`,
-- `/api/listings/yakin`) İL ADI almaya DEVAM EDİYOR; çeviriyi route sınırında
-- `lib/lokasyon.ts::ilId()` yapıyor. Sebep: admin arayüzü (`AnalitikClient.tsx`)
-- baştan sona il adı üzerinden çalışıyor (`c.city`, `cp.city`, `detail.city`);
-- onu id'ye çevirmek Dalga 3'ün kapsamını gereksiz büyütürdü. RPC'ler çıktıda
-- HEM `province_id` HEM kanonik `city` adını döndürüyor, arayüz aynen çalışıyor
-- ve id'ye geçmek istediğinde veri zaten orada.
--
-- ⚠️ İMZA DEĞİŞİYOR → ESKİSİ DROP EDİLMELİ. Aksi halde PostgREST iki overload
-- arasında seçim yapamaz. `20260616_radar_analitik_indexes.sql` başlığı bu
-- sorunu bir kez yaşadıklarını yazıyor. DROP'lar BÖLÜM 0'da.
--
-- ⚠️ SIRA: BÖLÜM 0 → 1 → 2 → 3 → 4, sonra KOD deploy'u. Arada RPC'ler eski
-- imzayla çağrılırsa 404 (PGRST202) döner — kısa bir kesinti penceresi var.
-- Bu yüzden SQL ile deploy arasını kısa tut.
-- ⚠️ Supabase SQL Editor yalnız SON ifadenin sonucunu gösterir — TEK TEK çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 0 — Eski imzaları düşür
-- ───────────────────────────────────────────────────────────────────────────
-- Geri alma: bu dosyanın en altındaki "GERİ ALMA" notuna bak — eski gövdeler
-- keşif çıktısında duruyor, kaybolmuş değil.

drop function if exists public.get_radar_city_detail(text, text, integer, text);
drop function if exists public.get_radar_intelligence(text, text, integer);
drop function if exists public.get_nearby_listings_by_city(text, text, integer);

-- `get_radar_city_overview(integer)` DÜŞÜRÜLMÜYOR — imzası değişmiyor,
-- `create or replace` ile yerinde güncellenecek.


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 1 — get_radar_city_overview  (imza AYNI: p_days int)
-- ───────────────────────────────────────────────────────────────────────────
-- Değişen: `group by origin_city` → `group by origin_province_id`, ad
-- `provinces`'tan geliyor. Çıktıya `province_id` eklendi.
--
-- ⚠️ LIMIT 60 → 81. Eski 60 sınırı serbest metnin sınırsız çeşitlenmesine karşı
-- konmuştu; artık tavan zaten 81 il. Arayüz için bu saf kazanç (daha önce
-- 61-81. sıradaki iller listede HİÇ görünmüyordu).

create or replace function public.get_radar_city_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable security definer
as $function$
begin
  perform set_config('statement_timeout', '30000', true);
  perform set_config('work_mem', '67108864', true); -- 64MB

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'province_id',    province_id,
          'city',           city,
          'listing_count',  listing_count,
          'unique_senders', unique_senders,
          'last_at',        last_at
        )
        order by listing_count desc
      ),
      '[]'::jsonb
    )
    from (
      select
        l.origin_province_id            as province_id,
        p.name                          as city,
        count(distinct l.id)            as listing_count,
        count(distinct l.contact_phone) as unique_senders,
        max(l.created_at)               as last_at
      from public.listings l
      join public.provinces p on p.id = l.origin_province_id
      where
        l.created_at >= now() - (p_days::text || ' days')::interval
        and l.origin_province_id is not null
      group by l.origin_province_id, p.name
      order by listing_count desc
      limit 81
    ) sub
  );
end;
$function$;

grant execute on function public.get_radar_city_overview(integer) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 2 — get_radar_city_detail  (YENİ İMZA)
-- ───────────────────────────────────────────────────────────────────────────
--   ESKİ: (p_city text, p_direction text, p_days int, p_counterpart text)
--   YENİ: (p_province_id int, p_direction text, p_days int, p_counterpart_id int)
--
-- Canlı gövdenin yapısı AYNEN korundu: departure/arrival ayrımı, arrival
-- yönündeki `v_arrival_ids` tek-tarama optimizasyonu, erken dönüş, limitler.
-- Yalnız `origin_city = p_city` → `origin_province_id = p_province_id` ve
-- `ls.city = p_counterpart` → `ls.province_id = p_counterpart_id` oldu.
--
-- Çıktı `city` alanı artık `provinces.name` (kanonik). Arayüz değişmiyor.

create or replace function public.get_radar_city_detail(
  p_province_id     integer,
  p_direction       text    default 'departure',
  p_days            integer default 30,
  p_counterpart_id  integer default null
)
returns jsonb
language plpgsql
stable security definer
as $function$
declare
  v_cutoff        timestamptz := now() - (p_days::text || ' days')::interval;
  v_city_name     text;
  v_total         bigint;
  v_senders       bigint;
  v_counterparts  jsonb;
  v_vehicle_types jsonb;
  v_daily         jsonb;
  v_arrival_ids   uuid[];
begin
  perform set_config('statement_timeout', '30000', true);
  perform set_config('work_mem', '67108864', true); -- 64MB

  select name into v_city_name from public.provinces where id = p_province_id;
  if v_city_name is null then
    return jsonb_build_object('error', 'Geçersiz il kodu: ' || coalesce(p_province_id::text, 'NULL'));
  end if;

  if p_direction = 'departure' then
    -- ── DEPARTURE: kalkış ili = p_province_id ─────────────────────────────

    select count(distinct l.id), count(distinct l.contact_phone)
    into v_total, v_senders
    from public.listings l
    where l.origin_province_id = p_province_id
      and l.created_at >= v_cutoff
      and (
        p_counterpart_id is null
        or exists (
          select 1 from public.listing_stops ls2
          where ls2.listing_id = l.id and ls2.province_id = p_counterpart_id
        )
      );

    select coalesce(jsonb_agg(
      jsonb_build_object('province_id', to_id, 'city', to_city, 'count', cnt, 'senders', snds)
      order by cnt desc
    ), '[]'::jsonb)
    into v_counterparts
    from (
      select
        ls.province_id                  as to_id,
        p.name                          as to_city,
        count(distinct l.id)            as cnt,
        count(distinct l.contact_phone) as snds
      from public.listings l
      join public.listing_stops ls on ls.listing_id = l.id
      join public.provinces p on p.id = ls.province_id
      where l.origin_province_id = p_province_id
        and l.created_at >= v_cutoff
        and (p_counterpart_id is null or ls.province_id = p_counterpart_id)
      group by ls.province_id, p.name
      order by cnt desc
      limit 20
    ) sub;

    select coalesce(jsonb_agg(
      jsonb_build_object('type', vt, 'count', cnt)
      order by cnt desc
    ), '[]'::jsonb)
    into v_vehicle_types
    from (
      select unnest(l.vehicle_type) as vt, count(*) as cnt
      from public.listings l
      where l.origin_province_id = p_province_id
        and l.created_at >= v_cutoff
        and l.vehicle_type is not null
        and (
          p_counterpart_id is null
          or exists (
            select 1 from public.listing_stops ls2
            where ls2.listing_id = l.id and ls2.province_id = p_counterpart_id
          )
        )
      group by vt
      order by cnt desc
      limit 12
    ) sub;

    select coalesce(jsonb_agg(
      jsonb_build_object('day', day_str, 'count', cnt)
      order by day_str
    ), '[]'::jsonb)
    into v_daily
    from (
      select
        to_char(date(l.created_at), 'MM-DD') as day_str,
        count(distinct l.id)                 as cnt
      from public.listings l
      where l.origin_province_id = p_province_id
        and l.created_at >= v_cutoff
        and (
          p_counterpart_id is null
          or exists (
            select 1 from public.listing_stops ls2
            where ls2.listing_id = l.id and ls2.province_id = p_counterpart_id
          )
        )
      group by date(l.created_at)
      order by date(l.created_at)
    ) sub;

  else
    -- ── ARRIVAL: varış ili = p_province_id ────────────────────────────────
    -- listing_stops BİR KEZ taranır, id'ler diziye alınır; sonraki 4 sorgu
    -- diziyi kullanır (canlı gövdedeki optimizasyon, aynen korundu).

    select array_agg(distinct ls.listing_id)
    into v_arrival_ids
    from public.listing_stops ls
    where ls.province_id = p_province_id;  -- listing_stops_province_idx kullanır

    if v_arrival_ids is null then
      return jsonb_build_object(
        'province_id', p_province_id,
        'city', v_city_name, 'direction', p_direction,
        'total', 0, 'unique_senders', 0,
        'counterparts', '[]'::jsonb, 'vehicle_types', '[]'::jsonb,
        'daily', '[]'::jsonb
      );
    end if;

    select count(distinct l.id), count(distinct l.contact_phone)
    into v_total, v_senders
    from public.listings l
    where l.id = any(v_arrival_ids)
      and l.created_at >= v_cutoff
      and (p_counterpart_id is null or l.origin_province_id = p_counterpart_id);

    select coalesce(jsonb_agg(
      jsonb_build_object('province_id', from_id, 'city', from_city, 'count', cnt, 'senders', snds)
      order by cnt desc
    ), '[]'::jsonb)
    into v_counterparts
    from (
      select
        l.origin_province_id            as from_id,
        p.name                          as from_city,
        count(distinct l.id)            as cnt,
        count(distinct l.contact_phone) as snds
      from public.listings l
      join public.provinces p on p.id = l.origin_province_id
      where l.id = any(v_arrival_ids)
        and l.created_at >= v_cutoff
        and (p_counterpart_id is null or l.origin_province_id = p_counterpart_id)
      group by l.origin_province_id, p.name
      order by cnt desc
      limit 20
    ) sub;

    select coalesce(jsonb_agg(
      jsonb_build_object('type', vt, 'count', cnt)
      order by cnt desc
    ), '[]'::jsonb)
    into v_vehicle_types
    from (
      select unnest(l.vehicle_type) as vt, count(*) as cnt
      from public.listings l
      where l.id = any(v_arrival_ids)
        and l.created_at >= v_cutoff
        and l.vehicle_type is not null
        and (p_counterpart_id is null or l.origin_province_id = p_counterpart_id)
      group by vt
      order by cnt desc
      limit 12
    ) sub;

    select coalesce(jsonb_agg(
      jsonb_build_object('day', day_str, 'count', cnt)
      order by day_str
    ), '[]'::jsonb)
    into v_daily
    from (
      select
        to_char(date(l.created_at), 'MM-DD') as day_str,
        count(distinct l.id)                 as cnt
      from public.listings l
      where l.id = any(v_arrival_ids)
        and l.created_at >= v_cutoff
        and (p_counterpart_id is null or l.origin_province_id = p_counterpart_id)
      group by date(l.created_at)
      order by date(l.created_at)
    ) sub;

  end if;

  return jsonb_build_object(
    'province_id',    p_province_id,
    'city',           v_city_name,
    'direction',      p_direction,
    'total',          v_total,
    'unique_senders', v_senders,
    'counterparts',   v_counterparts,
    'vehicle_types',  v_vehicle_types,
    'daily',          v_daily
  );
end;
$function$;

grant execute on function public.get_radar_city_detail(integer, text, integer, integer) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 3 — get_radar_intelligence  (YENİ İMZA)
-- ───────────────────────────────────────────────────────────────────────────
--   ESKİ: (p_from_city text, p_to_city text, p_days int)
--   YENİ: (p_from_province_id int, p_to_province_id int, p_days int)
--
-- ⚠️ VOLATILE OLARAK BIRAKILDI. Kardeş fonksiyonlar STABLE, bu değil — canlıda
-- da öyle. Aynı migration'da hem konum filtresini hem volatility'yi değiştirmek
-- bir sorun çıkarsa hangisinin sebep olduğunu belirsizleştirir. Ayrı bir iş
-- olarak not edildi (`docs/YAPILACAKLAR.md`).
--
-- ⚠️ `raw_text ILIKE ANY(...)` KORUNDU — o metin araması, konum değil.
--
-- 🔴 GİZLİ DAVRANIŞ DEĞİŞİKLİĞİ (bilinçli): eski gövdede `v_from`/`v_to`
-- `NULLIF(trim(...), '')` ile boş string'i NULL'a çeviriyordu. Artık integer
-- geldiği için boş string kavramı yok; route katmanı tanınmayan il adı için
-- `null` göndermeli. `ilId()` tanımadığı adı `undefined` döndürür → route
-- 400 vermeli, sessizce "tüm iller" olarak DAVRANMAMALI. Kod tarafında
-- `app/api/admin/radar/route.ts` bunu yapıyor.

create or replace function public.get_radar_intelligence(
  p_from_province_id integer default null,
  p_to_province_id   integer default null,
  p_days             integer default 30
)
returns jsonb
language plpgsql
security definer
as $function$
declare
  v_cutoff timestamptz := now() - (p_days::text || ' days')::interval;
  v_from   integer     := p_from_province_id;
  v_to     integer     := p_to_province_id;
  v_stats  jsonb;
  v_leads  jsonb;
begin
  perform set_config('statement_timeout', '30000', true);
  perform set_config('work_mem', '67108864', true); -- 64MB

  if v_from is null and v_to is null then
    return jsonb_build_object('error', 'En az kalkış veya varış ili girilmeli');
  end if;

  -- ── 1. Route İstatistikleri ────────────────────────────────────────────
  with dest_ids as materialized (
    select distinct listing_id
    from public.listing_stops
    where v_to is not null
      and province_id = v_to
  )
  select jsonb_build_object(
    'total_listings_last_30_days', count(distinct l.id),
    'unique_publishers',
      count(distinct
        case
          when l.contact_phone like '+%' then l.contact_phone
          when l.contact_phone like '0%' then '+90' || substr(l.contact_phone, 2)
          when l.contact_phone is not null then '+90' || l.contact_phone
          else null
        end
      )
  )
  into v_stats
  from public.listings l
  left join dest_ids d on d.listing_id = l.id
  where l.created_at >= v_cutoff
    and (v_from is null or l.origin_province_id = v_from)
    and (v_to is null or d.listing_id is not null);

  -- ── 2. Lead Analizi ────────────────────────────────────────────────────
  with
  dest_ids as materialized (
    select distinct listing_id
    from public.listing_stops
    where v_to is not null
      and province_id = v_to
  ),

  route_listings as (
    select
      l.id,
      l.created_at,
      l.raw_text,
      l.vehicle_type,
      l.user_id,
      l.shadow_profile_id,
      case
        when l.contact_phone is null   then null
        when l.contact_phone like '+%' then l.contact_phone
        when l.contact_phone like '0%' then '+90' || substr(l.contact_phone, 2)
        else '+90' || l.contact_phone
      end as norm_phone
    from public.listings l
    left join dest_ids d on d.listing_id = l.id
    where
      l.created_at >= now() - interval '365 days'
      and (v_from is null or l.origin_province_id = v_from)
      and (v_to is null or d.listing_id is not null)
  ),

  phone_groups as (
    select
      norm_phone,
      count(*)                                                               as total_loads,
      count(*) filter (where created_at >= v_cutoff)                         as recent_loads,
      count(distinct date(created_at)) filter (where created_at >= v_cutoff) as unique_active_days,
      max(created_at)                                                        as last_listing_at,
      bool_or(
        raw_text ilike any(array[
          '%düzenli%', '%proje%', '%aylık%', '%haftalık%',
          '%her gün%', '%her hafta%', '%sözleşmeli%',
          '%ihale%', '%kontrat%', '%periyodik%'
        ])
      )                                                                      as has_contract_keywords,
      (array_agg(raw_text order by created_at desc)
         filter (where raw_text is not null))[1:5]                           as recent_raw_texts,
      (array_agg(shadow_profile_id) filter (where shadow_profile_id is not null))[1]
                                                                             as shadow_profile_id,
      (array_agg(user_id) filter (where user_id is not null))[1]
                                                                             as reg_user_id
    from route_listings
    where norm_phone is not null
    group by norm_phone
  ),

  enriched as (
    select
      pg.*,
      sp.id           as sp_id,
      sp.name         as sp_name,
      sp.company_name as sp_company,
      sp.etiket       as sp_etiket,
      u.display_name  as u_display_name,
      u.company_name  as u_company,
      case
        when pg.unique_active_days >= 8 or pg.has_contract_keywords
          then 'CONTRACT_POTENTIAL'
        else 'SPOT'
      end as classification,
      array_remove(
        array[
          case when pg.total_loads >= 10 or pg.unique_active_days >= 5
            then '🔥 Yüksek Hacim' end,
          case when pg.has_contract_keywords
            then '🏷️ Metinde Düzenlilik Var' end,
          case when pg.unique_active_days >= 8
            then '📅 Sürekli Aktif' end
        ],
        null
      ) as tags
    from phone_groups pg
    left join public.shadow_profiles sp on sp.phone = pg.norm_phone
    left join public.users u on u.id = pg.reg_user_id
  )

  select
    jsonb_agg(
      jsonb_build_object(
        'phone',             norm_phone,
        'is_registered',     (reg_user_id is not null),
        'display_name',      coalesce(u_display_name, sp_name),
        'company_name',      coalesce(u_company, sp_company),
        'etiket',            sp_etiket,
        'shadow_profile_id', sp_id,
        'route_analytics',   jsonb_build_object(
          'total_loads',        total_loads,
          'recent_loads',       recent_loads,
          'unique_active_days', unique_active_days,
          'classification',     classification
        ),
        'has_contract_keywords', has_contract_keywords,
        'tags',              to_jsonb(tags),
        'recent_raw_texts',  to_jsonb(coalesce(recent_raw_texts, array[]::text[])),
        'last_listing_at',   last_listing_at
      )
      order by
        case when classification = 'CONTRACT_POTENTIAL' then 0 else 1 end,
        total_loads desc
    )
  into v_leads
  from enriched;

  return jsonb_build_object(
    'route_stats', coalesce(v_stats, '{}'::jsonb),
    'leads',       coalesce(v_leads, '[]'::jsonb)
  );
end;
$function$;

grant execute on function public.get_radar_intelligence(integer, integer, integer) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 4 — get_nearby_listings_by_province  (ADI DEĞİŞTİ)
-- ───────────────────────────────────────────────────────────────────────────
--   ESKİ: get_nearby_listings_by_city(p_city text, p_district text, p_limit int)
--   YENİ: get_nearby_listings_by_province(p_province_id int, p_district text, p_limit int)
--
-- ⚠️ AD NEDEN DEĞİŞTİ: `_by_city` artık yalan söylerdi. Eski ad BÖLÜM 0'da
-- düşürüldü; kodda kalan bir çağrı olursa 404 (PGRST202) ile GÜRÜLTÜLÜ patlar
-- — sessizce yanlış sonuç dönmesinden iyidir.
--
-- ⚠️ İLÇE EŞLEŞMESİ `il_key()` ile katlanıyor. Eski gövde `origin_district
-- ILIKE p_district` kullanıyordu: büyük/küçük harfi çözüyor ama Türkçe ASCII
-- katlamasını ÇÖZMÜYOR — `corlu` yazan kullanıcı `Çorlu` ilçesini yakalayamıyordu.
-- `il_key()` adı "il" dese de düz metin katlama fonksiyonu; `lib/ilan-sabitler.ts::ilKey()`
-- ve `lib/alias-normalize.ts::aliasKey()` ile aynı ifade. Bu bir FİLTRE değil
-- SIRALAMA ipucu (`eslesme` alanı), yani genişlemesi risksiz.
--
-- Çıktıya `origin_province_id` / `dest_province_id` eklendi; `origin_city` ve
-- `dest_city` artık `provinces`'tan kanonik ad.

create or replace function public.get_nearby_listings_by_province(
  p_province_id integer,
  p_district    text    default null,
  p_limit       integer default 20
)
returns table(
  id uuid,
  listing_type text,
  origin_province_id integer,
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
    select distinct on (listing_id)
      listing_id, province_id, city, district
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

-- ⚠️ GRANT: `/api/listings/yakin` service_role ile çağırıyor (route.ts:7-10),
-- ama eski fonksiyonun grant'ını körü körüne taşımak yerine ikisini de veriyoruz;
-- anon'a VERİLMİYOR (eski halinde de yoktu).
grant execute on function public.get_nearby_listings_by_province(integer, text, integer) to authenticated;
grant execute on function public.get_nearby_listings_by_province(integer, text, integer) to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 5 — DOĞRULAMA
-- ───────────────────────────────────────────────────────────────────────────

-- 5.1 İmzalar doğru mu, overload kaldı mı? Beklenen: TAM 4 satır.
select p.oid::regprocedure as imza, p.prosecdef as sec_def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_radar_intelligence','get_radar_city_overview',
                    'get_radar_city_detail','get_nearby_listings_by_province',
                    'get_nearby_listings_by_city')
order by 1;

-- 5.2 Overview çalışıyor mu? İlk 5 il.
select jsonb_pretty(jsonb_agg(x))
from (
  select value from jsonb_array_elements(public.get_radar_city_overview(30)) limit 5
) t(x);

-- 5.3 Detail — departure ve arrival, İstanbul (34).
select public.get_radar_city_detail(34, 'departure', 30, null) -> 'total'        as dep_toplam,
       public.get_radar_city_detail(34, 'arrival',   30, null) -> 'total'        as var_toplam,
       public.get_radar_city_detail(34, 'departure', 30, 6)    -> 'total'        as ist_ank,
       public.get_radar_city_detail(999,'departure', 30, null) -> 'error'        as gecersiz_il;

-- 5.4 Intelligence — İstanbul→Ankara.
select public.get_radar_intelligence(34, 6, 30) -> 'route_stats' as rota;

-- 5.5 Nearby — İstanbul, ilçe ipucu ASCII yazımla.
--     `corlu` Tekirdağ ilçesi, İstanbul'da eşleşmemeli ama HATA da vermemeli.
select count(*) as satir,
       count(*) filter (where eslesme = 'ilce') as ilce_eslesen
from public.get_nearby_listings_by_province(34, 'kadikoy', 20);

-- 5.6 🚨 ESKİ ↔ YENİ SONUÇ KARŞILAŞTIRMASI (asıl kabul kriteri).
--     Eski mantık (`origin_city = provinces.name`) ile yeni mantık
--     (`origin_province_id = id`) 30 günlük pencerede aynı sayıyı vermeli.
--     Beklenen: `fark` kolonu her il için 0.
select p.id,
       p.name,
       count(*) filter (where l.origin_city = p.name)        as eski_metin,
       count(*) filter (where l.origin_province_id = p.id)    as yeni_id,
       count(*) filter (where l.origin_city = p.name)
         - count(*) filter (where l.origin_province_id = p.id) as fark
from public.provinces p
cross join public.listings l
where l.created_at >= now() - interval '30 days'
group by p.id, p.name
having count(*) filter (where l.origin_city = p.name) <> count(*) filter (where l.origin_province_id = p.id)
order by abs(count(*) filter (where l.origin_city = p.name)
           - count(*) filter (where l.origin_province_id = p.id)) desc;
-- BEKLENEN: 0 satır. Satır dönerse Dalga 3'ü DEPLOY ETME — metin ile id
-- ayrışmış demektir, önce sebebini bul (`docs/20260730_province_id.sql` 8.2).


-- ───────────────────────────────────────────────────────────────────────────
-- BÖLÜM 6 — INDEX'LER (BİLEREK AYRI, ŞİMDİ ÇALIŞTIRILMIYOR)
-- ───────────────────────────────────────────────────────────────────────────
-- `COGRAFI_GECIS.md` "trigram index'i düşür" diyordu. DÜŞÜRMÜYORUM, çünkü
-- `origin_city` / `listing_stops.city` Dalga 5'e kadar CANLI VERİ ve bu
-- fonksiyonlar dışında da okunuyor olabilir. Index'i erken düşürmek sessiz bir
-- yavaşlama üretir — teşhisi zor bir hata sınıfı.
--
-- ÖNCE ÖLÇ (bu dosyayı çalıştırdıktan ~1 hafta sonra):
--
--   select relname as tablo, indexrelname as indeks, idx_scan as tarama
--   from pg_stat_user_indexes
--   where schemaname = 'public'
--     and relname in ('listings','listing_stops')
--   order by idx_scan asc;
--
-- `idx_scan = 0` olan metin index'leri Dalga 5 migration'ında düşürülür:
--   listings_origin_city_trgm_idx, idx_listings_origin_city_lower,
--   listing_stops_city_trgm_idx, idx_listing_stops_city_lower
--
-- ── 🚨 DALGA 3'TEN BAĞIMSIZ BULGU — INDEX KOPYALARI ──────────────────────
-- Keşif çıktısı ciddi bir birikim gösterdi. Bunlar BİREBİR AYNI:
--   listing_stops: idx_listing_stops_listing_id
--                · idx_stops_listing
--                · listing_stops_listing_id_idx        → ÜÇÜ DE (listing_id)
--   listings:      idx_listings_created
--                · idx_listings_created_at
--                · listings_created_at_idx             → ÜÇÜ DE (created_at DESC)
-- Neredeyse aynı olanlar:
--   listing_stops: idx_listing_stops_city (city,listing_id)
--                · idx_listing_stops_city_listing_id (aynısı + WHERE city NOT NULL)
--                · listing_stops_city_idx (city) — (city,listing_id)'nin ÖNEKİ, gereksiz
--   listings:      idx_listings_origin (origin_city)
--                · idx_listings_origin_city (aynısı + WHERE NOT NULL)
--                · idx_listings_origin_city_created / listings_origin_city_created_at_idx
--
-- Bedeli: 234K satırlık, yoğun INSERT alan bir tabloda her yazma bu index'lerin
-- HEPSİNİ güncelliyor — boşa disk ve boşa yazma. Ama bu Dalga 3'ün işi DEĞİL;
-- ayrı bir temizlik migration'ı olarak `docs/YAPILACAKLAR.md`'ye yazıldı.
-- Aynı anda yapmak, bir sorun çıktığında sebebi belirsizleştirir.


-- ═══════════════════════════════════════════════════════════════════════════
-- GERİ ALMA
-- ═══════════════════════════════════════════════════════════════════════════
-- Eski gövdeler `docs/` dosyalarında DEĞİL (bkz. başlık). Geri almak gerekirse
-- 30 Tem 2026 keşif çıktısındaki `pg_get_functiondef` gövdeleri kullanılmalı —
-- sohbet kaydında ve aşağıdaki dosyalarda YAKLAŞIK karşılıkları var, ama birebir
-- değil:
--   get_radar_city_detail   → 20260609_radar_analitik_counterpart_filter.sql (ILIKE'lı, ESKİ)
--   get_radar_intelligence  → 20260630_radar_rpc_perf_fix.sql (EXISTS'li, ESKİ)
-- Geri alma yolu: BÖLÜM 0'daki DROP'ları yeni imzalar için tekrarla, sonra
-- keşif çıktısındaki gövdeleri olduğu gibi çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════
