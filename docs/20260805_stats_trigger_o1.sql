-- ============================================================================
-- #67 — BULUNDU: `sync_shadow_profile_listing_stats` tek başına 3 SANİYE
-- 5 Ağustos 2026 · ADIM A salt okunur · ADIM B ve C DEĞİŞİKLİK
-- ============================================================================
--
-- ❌ H3 ÇÜRÜDÜ (indeks bakımı hipotezi — benim öne sürdüğüm):
--    tablo 407 MB · indeksler 125 MB · oran 0.31.
--    Yirmi indeks var ama ondokuzu küçük btree. Tek GIN 14 MB.
--    Bu profil 1 400 ms'lik bir INSERT üretmez. Yanıldım.
--
-- ✅ ASIL SEBEP — ADIM 2, tek satırda:
--      Execution Time: 3096.881 ms
--    En yoğun profil (3 556 ilan) için `..._stats` trigger'ının yaptığı
--    toplama sorgusu ÜÇ SANİYE sürüyor. Planı oku:
--
--      Bitmap Index Scan  ...  actual time=25.736    ← indeks HIZLI
--      Bitmap Heap Scan   ...  actual time=..3092    ← HEAP yavaş
--      Heap Blocks: exact=2977 · Buffers: hit=1403 read=1586
--
--    İndeks 26 ms'de doğru satırları buluyor. Ama `max/min(created_at)`
--    indekste YOK — 2 977 heap bloğunu ziyaret etmek gerekiyor, 1 586'sı
--    önbellekte değil, diskten okunuyor. Maliyet indeks değil HEAP erişimi.
--
--    Ve trigger bunu ilan başına ÜÇ KEZ yapıyor (COUNT, MAX, MIN ayrı
--    altsorgular). Maliyet profilin BÜYÜKLÜĞÜYLE ORANTILI.
--
-- 👉 BU, ÖLÇÜMDEKİ İKİ TEPELİ DAĞILIMI AÇIKLIYOR:
--      268 ms'lik aralık  = küçük profillerden gelen ilanlar
--      5 403 ms'lik aralık = çok ilan veren bir telefondan gelen seri
--    Ortalama yanıltıcıydı; dağılım baştan beri iki ayrı rejimdi.
--
-- ❌ BİR İDDİAMI GERİ ALIYORUM — "süre dolumu cron'u da bu trigger'ı
--    tetikliyor, gizli çarpan" demiştim. YANLIŞ. Gerçek tanım:
--        AFTER INSERT OR DELETE OR UPDATE **OF shadow_profile_id**
--    Sütuna özel. Cron `status` ve `updated_at` yazıyor, `shadow_profile_id`
--    yazmıyor → trigger hiç ateşlenmiyor. Çarpan yok. Tanımı okumadan
--    söylemiştim; okuyunca düştü.
--
-- 📌 AÇIKTA KALAN BİR SORU (artık zararsız, ama kaydediyorum):
--    BÖLÜM 20'de 2 311 profil DOĞRUYDU. Trigger çifti her INSERT'te +1
--    ürettiğine göre hepsinin sapmış olması gerekirdi. En olası açıklama:
--    `trg_listings_shadow_profile_count` sonradan eklenmiş, dolayısıyla
--    yalnız o tarihten sonra ilan alan ~1 100 profil etkilenmiş. Bunu
--    ÖLÇMEDİM. Sayaçlar yeniden sayıldı ve trigger düştü, yani sonuç
--    itibarıyla kapandı — ama sebebini bilmiyorum.
--
-- ============================================================================
-- 🚨 KENDİ HATAMI GERİ ALIYORUM — `idx_listings_expire_sweep` GEREKSİZ:
--    ADIM 3b: aktif = 863 · aktif VE süresi dolmuş = 0 · toplam = 236 846.
--    Yani süre dolumu taraması 863 satıra bakıyor, 236 bine değil.
--    `idx_listings_status` zaten yetiyor; EXPLAIN yeni indeksi SEÇMEDİ
--    (idx_scan = 0, boyut 0 bytes). Dün "indeks yok, o yüzden yavaş" dedim —
--    o çıkarım yanlıştı, seçicilik hesabı yapmadan söylenmişti.
--    Bu indeks şu an saf yazma maliyeti. ADIM B onu düşürüyor.
--
-- ⚠️ ÖLÇEMEDİĞİM AMA GÖRDÜĞÜM BİR ŞEY — makine yavaş olabilir:
--      1 586 blok okuması → 3 saniye (blok başına ~2 ms, SSD için çok yavaş)
--      344 blok ÖNBELLEK İSABETİ → 288 ms (bu olmamalı, mikrosaniye olmalı)
--      `aliases` seq scan → 0.575 ms, ama ÜRETİMDE ort 41 ms ölçüldü
--    Sonuncusu en açık kanıt: 0.5 ms'lik sorgu üretimde 41 ms sürüyorsa,
--    aradaki 40 ms SORGU DEĞİL BEKLEME. PostgREST havuzunda sıra var.
--    Bunu iddia olarak yazmıyorum, ölçülmedi — ama trigger düzeltildikten
--    sonra hâlâ duruyorsa örnek boyutu/CPU kredisi konuşulmalı.
-- ============================================================================


-- ============================================================================
-- ADIM A — 👉 ÖNCE BUNU KOŞTUR VE ÇIKTIYI BANA VER. ADIM C'yi ONAYLAMADAN
-- ÇALIŞTIRMA. Aşağıdaki yeni gövdeyi mevcut gövdeye BAKARAK yazdım ama
-- gövde şu an elimde değil; kolon adlarını ve TG_OP dallarını doğrulamam gerek.
-- ============================================================================
select pg_get_functiondef(p.oid) as mevcut_govde
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'sync_shadow_profile_listing_stats';

-- Trigger tanımı da lazım (hangi olaylarda, hangi WHEN koşuluyla).
select tgname, pg_get_triggerdef(t.oid) as tanim
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and c.relname = 'listings'
  and tgname = 'listings_sync_shadow_profile_stats';


-- ============================================================================
-- ADIM B — Dünkü hatamı geri al. Bu güvenli ve tek başına çalıştırılabilir.
-- ============================================================================
drop index if exists public.idx_listings_expire_sweep;


-- ============================================================================
-- ADIM C — ✅ ADIM A ÇIKTISIYLA DOĞRULANDI, ÇALIŞTIRILABİLİR.
--
-- Gerçek gövdeye karşı denetlenen dört varsayım:
--   ✅ tarih kolonu `created_at`                        — doğru
--   ✅ listing_count / last_listing_at / first_listing_at — doğru
--   ✅ `security definer` DEĞİL, `language plpgsql`       — doğru
--   ✅ mevcut gövde her dalda `RETURN NULL` — AFTER trigger'da dönüş yok sayılır,
--      yine de sadakat için aynen korundu
--
-- DAVRANIŞ FARKI (kasıtlı, tek fark bu):
--   Mevcut gövde UPDATE dalında, profil DEĞİŞMEMİŞ olsa bile yeni profili
--   yeniden sayıyor. Yeni gövde o durumda hiçbir şey yapmıyor.
--   Trigger `UPDATE OF shadow_profile_id` olduğu için bu dal yalnız kolon
--   SET listesinde geçtiğinde ateşlenir; aynı değere set etmek boş yeniden
--   sayım demekti. Kaldırıldı.
--
-- ⚠️ TAKAS — DÜRÜSTÇE: mevcut gövde her INSERT'te COUNT(*) attığı için
--    KENDİ KENDİNİ ONARIYORDU. Yeni gövde artımlı, yani onarmıyor.
--    BÖLÜM 20'deki -29'un sebebini hâlâ bilmiyoruz; benzeri bir şey
--    yeniden olursa artık sessizce birikir. Karşılığı ADIM E'deki
--    gecelik yeniden sayım işi — o olmadan bu değişikliği yapma.
-- ============================================================================
create or replace function public.sync_shadow_profile_yeniden_say(p_id uuid)
returns void
language sql
as $$
  update public.shadow_profiles sp
  set listing_count    = coalesce(g.n, 0),
      last_listing_at  = g.enson,
      first_listing_at = g.ilk
  from (
    select count(*)::int as n, max(created_at) as enson, min(created_at) as ilk
    from public.listings where shadow_profile_id = p_id
  ) g
  where sp.id = p_id;
$$;

create or replace function public.sync_shadow_profile_listing_stats()
returns trigger
language plpgsql
as $function$
begin
  -- ── INSERT: O(1). Heap'e hiç dokunmaz. 3 096 ms → mikrosaniyeler.
  if TG_OP = 'INSERT' then
    if NEW.shadow_profile_id is not null then
      update public.shadow_profiles sp
      set listing_count    = coalesce(sp.listing_count, 0) + 1,
          last_listing_at  = greatest(coalesce(sp.last_listing_at,  NEW.created_at), NEW.created_at),
          first_listing_at = least   (coalesce(sp.first_listing_at, NEW.created_at), NEW.created_at)
      where sp.id = NEW.shadow_profile_id;
    end if;
    return null;
  end if;

  -- ── DELETE: nadir. max/min artımlı korunamaz, tam yeniden say.
  if TG_OP = 'DELETE' then
    if OLD.shadow_profile_id is not null then
      perform public.sync_shadow_profile_yeniden_say(OLD.shadow_profile_id);
    end if;
    return null;
  end if;

  -- ── UPDATE: yalnız profil GERÇEKTEN değiştiyse iki tarafı da yeniden say.
  if OLD.shadow_profile_id is not distinct from NEW.shadow_profile_id then
    return null;
  end if;
  if OLD.shadow_profile_id is not null then
    perform public.sync_shadow_profile_yeniden_say(OLD.shadow_profile_id);
  end if;
  if NEW.shadow_profile_id is not null then
    perform public.sync_shadow_profile_yeniden_say(NEW.shadow_profile_id);
  end if;
  return null;
end;
$function$;


-- ============================================================================
-- ADIM E — 🚨 ADIM C'NİN ŞARTI. Artımlı sayaç sürüklenirse yakalayacak
-- gecelik iş. Dün `expire-listings`i düşürdük, yerine bu geliyor.
-- 03:00 seçildi: 02:00'deki eski işten ve 15 dakikalık taramadan uzak.
-- ============================================================================
select cron.schedule(
  'shadow-profile-recount',
  '0 3 * * *',
  $job$
    update public.shadow_profiles sp
    set listing_count    = coalesce(g.n, 0),
        last_listing_at  = g.enson,
        first_listing_at = g.ilk
    from (
      select shadow_profile_id as id,
             count(*)::int as n, max(created_at) as enson, min(created_at) as ilk
      from public.listings
      where shadow_profile_id is not null
      group by 1
    ) g
    where g.id = sp.id
      and (sp.listing_count    is distinct from g.n
        or sp.last_listing_at  is distinct from g.enson
        or sp.first_listing_at is distinct from g.ilk);
  $job$
);


-- ============================================================================
-- ADIM D — ADIM C'den SONRA doğrulama. Sayaçlar hâlâ tutuyor mu?
-- Beklenen: fazla 0, eksik 0. Bir süre üretim trafiği geçtikten sonra koştur.
-- ============================================================================
select 'ADIM D — sayaç doğruluğu' as adim,
       count(*)                                            as profil,
       count(*) filter (where sp.listing_count = g.gercek)  as dogru,
       count(*) filter (where sp.listing_count > g.gercek)  as fazla,
       count(*) filter (where sp.listing_count < g.gercek)  as eksik
from public.shadow_profiles sp
join lateral (
  select count(*)::int as gercek
  from public.listings l where l.shadow_profile_id = sp.id
) g on true;
