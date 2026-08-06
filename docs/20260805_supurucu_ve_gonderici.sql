-- ============================================================================
-- 5 Ağu 2026 — Teslim edilemeyen parse tetiklemelerinin süpürücüsü
-- Görevler: #74 (gönderici helper) · #75 (ince trigger) · #76 (süpürücü + cron)
--           #77 (yalancı pending durum düzeltmesi)
-- DURUM: CANLIDA UYGULANDI (proje gobepcswwsoswodhaufy)
-- ============================================================================
--
-- SORUN. `on_raw_post_insert` FOR EACH ROW çalışır; 1.500 satırlık bir import
-- 1.500 eşzamanlı pg_net POST'u doğurur. Bir kısmı hiç teslim edilmez ve satır
-- sonsuza kadar `pending` kalır — kimse yeniden denemez. #65 yığınının mekanizması.
--
-- ⚠️ pg_net'in `timeout_milliseconds` (varsayılan 5000) alanını YÜKSELTMEK ÇÖZÜM
--    DEĞİL. Timeout curl handle'ını iptal eder ama edge fonksiyonunu DURDURMAZ;
--    fonksiyon durumunu `durumYaz()` ile kendi yazar. Ölçüm (16:07): 33 isteğin
--    24'ü timeout kaydedildi, 33/33 satır işlendi → `net._http_response` YANLIŞ
--    NEGATİF üretiyor. Üstelik `pg_net.batch_size = 200` slot 15× uzun tutulurdu.
--    İzleme kaynağı `raw_posts.processing_status`'tur.


-- ── ADIM 1 (#74) — gönderici helper'ı, TOKEN'A DOKUNMADAN ────────────────────
--
-- 🔐 `trigger_parse_listing()` gövdesinde DÜZ METİN service_role JWT'si var (#70).
--    Fonksiyonu elle yeniden yazmak token'ı migration metnine, log'a ve asistan
--    bağlamına sokardı. Bunun yerine tanım Postgres'in İÇİNDE okunur, string
--    olarak dönüştürülür ve EXECUTE edilir. Token hiçbir yere çıkmaz.
do $mig$
declare
  src  text;
  yeni text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'trigger_parse_listing';

  if src is null then raise exception 'trigger_parse_listing bulunamadi'; end if;

  yeni := src;
  yeni := replace(yeni, 'FUNCTION public.trigger_parse_listing()',
                        'FUNCTION public.parse_listing_gonder(p_raw_post_id uuid)');
  yeni := replace(yeni, 'RETURNS trigger', 'RETURNS void');
  yeni := replace(yeni, 'SECURITY DEFINER',
                        'SECURITY DEFINER' || E'\n SET search_path = pg_catalog, public');
  yeni := replace(yeni, '''raw_post_id'', new.id', '''raw_post_id'', p_raw_post_id');
  yeni := replace(yeni, 'return new;', 'return;');

  -- Dönüşümün TAMAMI tutmazsa hiçbir şey uygulanmaz. Yarım dönüşüm, sessizce
  -- bozuk bir fonksiyondan daha iyi değil.
  if yeni like '%new.id%' or yeni like '%return new;%' or yeni like '%RETURNS trigger%'
     or yeni not like '%parse_listing_gonder(p_raw_post_id uuid)%'
     or yeni not like '%search_path = pg_catalog, public%' then
    raise exception 'donusum eksik kaldi — hicbir sey uygulanmadi';
  end if;

  execute yeni;
end
$mig$;

-- 🚨 PUBLIC varsayılan olarak EXECUTE alır. Revoke edilmezse `anon` kullanıcı
--    service_role token'lı isteği tetikleyebilirdi.
revoke all on function public.parse_listing_gonder(uuid) from public;
revoke all on function public.parse_listing_gonder(uuid) from anon;
revoke all on function public.parse_listing_gonder(uuid) from authenticated;


-- ── ADIM 2 (#75) — trigger artık ince sarmalayıcı ────────────────────────────
-- Token'ın tek sahibi parse_listing_gonder(). #70'in rotasyon yüzeyi 2 → 1.
create or replace function public.trigger_parse_listing()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  perform public.parse_listing_gonder(new.id);
  return new;
end;
$function$;
-- NOT: bu fonksiyonun EXECUTE hakkı bilerek revoke EDİLMEDİ — INSERT yolunu
-- kırma riskine değmez; gövdesinde artık token yok.


-- ── ADIM 3 (#76) — süpürücü ─────────────────────────────────────────────────
alter table public.raw_posts
  add column if not exists parse_attempts        smallint not null default 0,
  add column if not exists last_parse_attempt_at timestamptz;

create or replace function public.parse_listing_supur(p_limit int default 50)
returns int
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  idler uuid[];
  kimlik uuid;
begin
  -- ADIM 0 — RAFA KALDIRMA (6 Ağu 2026, #65). Pencereden düşmüş `pending` satır
  -- bir daha ASLA denenmeyecek; `pending`de asılı kalırsa GÖRÜNMEZ kayıp olur
  -- (repo genelinde `pending` SEÇEN yer yok — bkz. index.ts:34). Terminal duruma
  -- çekiyoruz ki yığın bir daha büyümesin ve pencere ileride genişletilirse
  -- eski yükler DİRİLMESİN. Bayram kuralı: "eski ilan dirilmesin."
  -- processed_at NULL kalır: bu satırlar parse EDİLMEDİ, damgalanamaz.
  -- 500'lük sınır tek turda dev UPDATE olmasın diye; normalde 0 satır eşleşir.
  with raf as (
    select rp.id
    from public.raw_posts rp
    where rp.processing_status = 'pending'
      and rp.processed_at is null
      and rp.created_at < now() - interval '12 hours'
    order by rp.created_at
    limit 500
    for update skip locked
  )
  update public.raw_posts rp
     set processing_status = 'rejected'
    from raf
   where rp.id = raf.id;

  -- ADIM 1 — aday seçimi
  with aday as (
    select rp.id
    from public.raw_posts rp
    where rp.processing_status = 'pending'
      and rp.processed_at is null
      -- ⚠️ Pencere 6 Ağu 2026'da 2 saatten 12 saate ÇIKARILDI (Bayram onayı, #65).
      -- Niye: pencere x hız = tek patlamada taşınabilir TAVAN.
      -- 2sa → ~5.750 (50/dk x 115dk) · 12sa → ~34.500 (50/dk x 715dk).
      -- ANLIK yük değişmez, hız yine p_limit. Genişletme günü ölçümü: 0 satır
      -- süpürüldü (0-12sa kovaları boştu) — hiçbir eski yük dirilmedi.
      -- Eskiyi diriltmeme kuralını artık ADIM 0'ın rafı koruyor.
      and rp.created_at > now() - interval '12 hours'
      -- normal akışın bitmesine fırsat ver; taze satırı boşuna tetikleme
      and rp.created_at < now() - interval '5 minutes'
      and rp.parse_attempts < 3                    -- sonsuz döngü koruması
      and (rp.last_parse_attempt_at is null
           or rp.last_parse_attempt_at < now() - interval '10 minutes')
      and not exists (select 1 from public.listings l where l.raw_post_id = rp.id)
    order by rp.created_at
    limit p_limit
    -- çakışan cron koşuları aynı satırı iki kez göndermesin
    for update skip locked
  ), isaretle as (
    update public.raw_posts rp
       set parse_attempts        = rp.parse_attempts + 1,
           last_parse_attempt_at = now()
      from aday
     where rp.id = aday.id
    returning rp.id
  )
  select array_agg(id) into idler from isaretle;

  if idler is null then return 0; end if;

  foreach kimlik in array idler loop
    perform public.parse_listing_gonder(kimlik);
  end loop;

  return array_length(idler, 1);
end;
$function$;

revoke all on function public.parse_listing_supur(int) from public;
revoke all on function public.parse_listing_supur(int) from anon;
revoke all on function public.parse_listing_supur(int) from authenticated;

create index if not exists raw_posts_supurucu_idx
  on public.raw_posts (created_at)
  where processing_status = 'pending' and processed_at is null;

-- 🚨 Hız sınırı (50/tur) tasarımın merkezinde, süsü değil. Naif bir süpürücü
--    5.723 satırı tek seferde ateşlerdi — kaybı yaratan patlamanın birebir aynısı.
select cron.schedule(
  'parse-listing-retry-sweeper',
  '* * * * *',
  $$select public.parse_listing_supur(50);$$
);


-- ── ADIM 3.5 (#70) — TOKEN VAULT'A TAŞINDI ──────────────────────────────────
--
-- MARUZİYETİN GERÇEK BOYUTU ÖNCE ÖLÇÜLDÜ (abartmamak için):
--   · `anon` rolünün Postgres seviyesinde `pg_proc` SELECT yetkisi VAR (true).
--   · AMA PostgREST `pg_catalog`'u dışarı açmıyor ve `public` şemasında
--     `pg_proc`/`pg_get_functiondef` kullanan view/fonksiyon sayısı SIFIR.
--   → Token internetten çekilebilir DEĞİLDİ. Görebilmek için doğrudan DB
--     bağlantısı gerekiyordu (SQL editor, DBeaver, postgres şifresi).
--   → Bu yüzden JWT rotasyonu ACİL DEĞİL; asıl kusur düz metin durmasıydı.

-- Adım A — çıkarma ve Vault'a yazma, tamamen Postgres'in içinde.
do $mig$
declare
  jeton text;
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'parse_listing_service_role_jwt') then
    raise notice 'sir zaten var — atlandi';
    return;
  end if;

  select (regexp_match(p.prosrc, '(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_.\-+/=]+)'))[1]
    into jeton
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'parse_listing_gonder';

  -- Çıkarma tutmazsa HİÇBİR ŞEY yapma. Yarım göç, düz metinden kötüdür.
  if jeton is null or length(jeton) < 100 or jeton !~ '^eyJ' then
    raise exception 'JWT cikarilamadi (uzunluk: %) — hicbir sey uygulanmadi',
                    coalesce(length(jeton), 0);
  end if;

  perform vault.create_secret(
    jeton,
    'parse_listing_service_role_jwt',
    'parse_listing_gonder() icin service_role JWT — 5 Agu 2026, #70'
  );
end
$mig$;

-- Adım B — fonksiyon artık Vault'tan okur.
create or replace function public.parse_listing_gonder(p_raw_post_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  jeton text;
begin
  select decrypted_secret into jeton
  from vault.decrypted_secrets
  where name = 'parse_listing_service_role_jwt';

  -- 🚨 SESSİZ BAŞARISIZLIĞA İZİN YOK. jeton null kalırsa header 'Bearer ' olur,
  --    edge fonksiyonu 401 döner ve satır sessizce `pending` kalır — yani #65'in
  --    birebir yeniden üretilmesi. Gürültüyle patla.
  if jeton is null then
    raise exception 'vault sirri bulunamadi: parse_listing_service_role_jwt';
  end if;

  perform net.http_post(
    url := 'https://gobepcswwsoswodhaufy.supabase.co/functions/v1/parse-listing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || jeton
    ),
    body := jsonb_build_object('raw_post_id', p_raw_post_id)
  );
  return;
end;
$function$;

revoke all on function public.parse_listing_gonder(uuid) from public;
revoke all on function public.parse_listing_gonder(uuid) from anon;
revoke all on function public.parse_listing_gonder(uuid) from authenticated;

-- DOĞRULAMA (yapıldı, 16:34 UTC):
--   1) Vault sırrı fonksiyondakiyle AYNI mı — değeri göstermeden:
--      select (select p.prosrc like '%'||s.decrypted_secret||'%' from pg_proc p ...)
--      → true (göçten önce çalıştırıldı)
--   2) Düz metin kalmış mı:
--      select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.prosrc like '%eyJ%';   → 0
--   3) Yetkilendirme hâlâ çalışıyor mu — VERİYE DOKUNMADAN:
--      select public.parse_listing_gonder('00000000-...-000000000000'::uuid);
--      → net._http_response: 404 {"error":"raw_post bulunamadı"}
--      🚨 404 İYİ HABER. 401 gelseydi Vault okuması bozuk demekti.
--   4) UÇTAN UCA trigger testi — lane içermeyen bir satır insert edildi
--      (id df1ebf54-5820-4882-85cb-5b1bcf4c39fe, source='whatsapp'):
--      trigger → gonder → vault → pg_net → edge fn → 200 {"lanes":0} → no_lane,
--      0 ilan. Test satırı sonradan `processed` + `slh_scanned_at` yapıldı ki
--      moderatör/AI keşif kuyruğunu kirletmesin. SİLİNMEDİ, izi duruyor.
--
-- ⚠️ `source` CHECK kısıtı yalnız 'whatsapp' ve 'facebook' kabul ediyor —
--    'manual' 23514 ile reddedildi. Test yazarken bilinmesi gerekiyor.
--
-- 🔁 GERİ ALMA: token Vault'ta duruyor, eski düz metin biçim gerekirse
--    `decrypted_secret` okunup fonksiyona gömülerek yeniden kurulabilir.
--
-- ⏭ KALAN: JWT rotasyonu (dashboard işi, Bayram). Eski Supabase şemasında
--    `anon` ve `service_role` AYNI JWT secret'ıyla imzalıdır — secret döndürülürse
--    anon anahtarı da geçersiz olur ve Vercel env'i güncellenene kadar site kırılır.
--    Yeni API anahtarı şemasında (publishable/secret) secret bağımsız döndürülür.
--    Projenin hangi şemada olduğu dashboard'dan doğrulanmalı.


-- ── ADIM 4 (#77) — yalancı pending düzeltmesi ───────────────────────────────
-- İlan ÜRETMİŞ ama `pending` kalmış 2.203 satır (18 May – 5 Ağu).
-- YENİDEN AYRIŞTIRMA YOK (Bayram kararı) → mükerrer riski sıfır.
with dogru as (
  select rp.id,
         (select min(l.created_at) from public.listings l where l.raw_post_id = rp.id) as ilk_ilan
  from public.raw_posts rp
  where rp.processing_status = 'pending'
    and rp.processed_at is null
    and exists (select 1 from public.listings l where l.raw_post_id = rp.id)
)
update public.raw_posts rp
   set processing_status = 'processed',
       processed_at      = d.ilk_ilan
  from dogru d
 where rp.id = d.id;


-- ── DOĞRULAMA (#78) — ilk tur ölçümü, 16:19–16:20 UTC ───────────────────────
-- 30 aday → 30 tetikleme → 28 processed + 2 no_lane, 119 ilan, 0 cron hatası,
-- parse_attempts en fazla 1.
--
-- ⚠️ MÜKERRER ALARMI VERİLDİ VE YANLIŞTI — kayda geçiyor.
--    (raw_post_id, raw_post_segment) ile gruplayınca 12 "mükerrer grup" göründü.
--    Sebep: `raw_post_segment` canlıda HER SATIRDA NULL ve varış bilgisi
--    `listings`'te değil `listing_stops`'ta. Örnek 96dfd5cd: 19 ilanın hepsi
--    Mersin (33) çıkışlı ama 19 FARKLI varış ili — tek mesaj, çok güzergâh.
--    Kesin kanıt: bir raw_post'un tüm ilanları ≤1,18 sn içinde yazılmış (tek
--    çağrı) ve parse_attempts=1; çift gönderim iki ayrı zaman kümesi bırakırdı.
--    DERS: `listings` tek başına mükerrer testi için YETERSİZ.
--
-- Doğru mükerrer sorgusu (varışı dahil eder):
--   with supurulen as (select id from public.raw_posts where last_parse_attempt_at is not null)
--   select l.raw_post_id, count(*)
--   from public.listings l join supurulen s on s.id = l.raw_post_id
--   group by 1
--   having max(l.created_at) - min(l.created_at) > interval '10 seconds';
--   -- >0 satır dönerse ÇİFT GÖNDERİM var; cron'u DERHAL durdur:
--   --   select cron.unschedule('parse-listing-retry-sweeper');
