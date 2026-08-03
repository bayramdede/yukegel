-- ============================================================================
-- `ilan_olustur` v4 — RPC METİN İL KOLONLARINA YAZMAYI BIRAKIR
-- Yazım: 31 Tem 2026 · Görev #26 · Dalga 5 BÖLÜM 1'den ayrıştırıldı
--
-- Bu dosya `docs/20260731_dalga5_metin_kolon_drop.sql` BÖLÜM 1'in çalıştırılabilir
-- hâlidir. Ayrı dosya olmasının sebebi: v4 kolon drop'undan GÜNLER ÖNCE, tek
-- başına canlıya çıkar. Drop dosyası ~7 Ağu'yu bekliyor; v4 beklemiyor.
--
-- 🚨 v4 TEK BAŞINA GİTMEZ. `origin_city` kolonu drop'a kadar YERİNDE KALIR ama
--    v4'ten sonra YENİ satırlarda NULL olur. Panel/ilan detayı/moderatör paneli
--    hâlâ o kolonu okuyorsa kullanıcı **boş şehir** görür. Bu yüzden:
--    → BÖLÜM 2 kod temizliği (KOVA B) AYNI RELEASE'te deploy edilir.
--    → Aksi hâlde v4 çalıştırılmaz.
--
-- ✅ RPC'nin JSON GİRDİ anahtarları DEĞİŞMEZ (`p_listing->>'origin_city'`,
--    `t.s->>'city'`). Onlar kolon değil, sözleşme — il çözümlemesi hâlâ onlara
--    dayanıyor. v4'te değişen tek şey: çözülen değer artık KOLONA YAZILMIYOR.
--    Çağıranların (`lib/ilan-yaz.ts`, `app/moderator/actions.ts`,
--    `supabase/functions/parse-listing/index.ts`) hiçbiri değişmez.
-- ============================================================================


-- ============================================================================
-- ADIM 0 — ÖN ÖLÇÜM (ZORUNLU, saf select) 🚨 GUARD'IN GERÇEK MALİYETİ
-- ============================================================================
--
-- v4 iki `raise exception` guard'ı getiriyor. Guard **davranış değişikliğidir**:
-- v3'te başarıyla oluşan bir ilan v4'te REDDEDİLEBİLİR. Reddin doğru karar
-- olduğunu iddia ediyoruz, ama iddiayı ölçmeden çalıştırmıyoruz.
--
-- ⚠️ 31 Tem ölçümü (`20260731_dalga5_olcumler.sql` 3.1) **eksik bir hücre**
--    bıraktı: `pid IS NULL AND metin IS NOT NULL` sayıldı (= 0), ama
--    `pid IS NULL AND metin IS NULL` HİÇ SAYILMADI. Guard ikisini de reddeder.
--    Yani 3.1'in sıfırı guard'ı temize çıkarmaya YETMEZ.
--
-- 🔎 Böyle satırların var olduğuna dair somut işaret var:
--    `app/api/admin/learn-aliases/route.ts:86-93` — "no_lane" sekmesi
--    `.is('origin_city', null)` ile **form ilanlarını listeliyor**. Bu sekme
--    boş değilse, kalkışsız ilan üretilebiliyor demektir.

-- 0.1 — Kalkışsız ilan var mı, ne kadar, hangi kanaldan, ne zamandan beri?
select
  source,
  count(*)                                                   as kalkissiz_toplam,
  count(*) filter (where origin_city is not null)             as metni_olan,
  count(*) filter (where created_at > now() - interval '30 days') as son_30_gun,
  min(created_at)::date                                       as en_eski,
  max(created_at)::date                                       as en_yeni
from public.listings
where origin_province_id is null
group by source
order by 2 desc;
--
-- ✅ ÇALIŞTIRILDI 31 Tem 2026 → **0 SATIR**.
--    `listings` tablosunda `origin_province_id IS NULL` olan TEK BİR satır yok
--    (234.885 satırda). Yani 3.1'in ölçmediği hücre de sıfır: ne "pid yok metin
--    var", ne "pid yok metin de yok". Guard geriye dönük hiçbir akışı kırmıyor.
--    📌 Yan sonuç: `learn-aliases/route.ts:86-93`'teki "Form ilanları — origin_city
--       boş" sekmesi BUGÜN DE BOŞ. Sekme ölü değil ama beslenmiyor; v4 sonrası
--       `.is('origin_city', null)` HER satırı eşleştireceği için o sekme
--       BÖLÜM 2.2 ile `.is('origin_province_id', null)`'a çevrilmezse kuyruğu
--       234 binlik çöple doldurur. (Guard sayesinde yeni satır asla girmez →
--       dönüştürüldüğünde sekme kalıcı olarak boş kalır; doğru davranış.)

-- ── KARAR ───────────────────────────────────────────────────────────────────
--   • 0 satır → guard hiçbir canlı akışı kırmıyor. ADIM 1'e geç.
--   • satır var AMA `son_30_gun = 0` → tarihsel kalıntı (v1/v2 dönemi).
--     Guard bugünü kırmaz. ADIM 1'e geç, kalıntılar ayrı bilet.
--   • `son_30_gun > 0` → 🚨 DUR. Canlı bir akış kalkışsız ilan üretiyor ve
--     guard onu kıracak. `source` hangi kanal olduğunu söyler. Guard'ı
--     kaldırma; önce o kanalı düzelt (aş. 0.3'e bak).

-- 0.2 — Aynısı duraklar için.
-- ⚠️ 3.2 bu hücreyi zaten kapattı (`zaten_bos = 0` + `pid_yok_metin_var = 0`,
--    ikisi birlikte "province_id IS NULL hiç yok" demek). Yine de teyit ucuz:
select count(*) as ilsiz_durak
from public.listing_stops
where province_id is null;
-- BEKLENEN: 0.   ✅ ÇALIŞTIRILDI 31 Tem 2026 → **0**. (245.152 durakta)

-- 0.3 — Hangi çağıran korumasız?  (koddan okundu, 31 Tem 2026)
--
--   ✅ lib/ilan-yaz.ts:247            `if (!kalkisIl) return 'Kalkış ili tanınamadı'`
--   ✅ lib/ilan-yaz.ts:271            durak başına aynı kontrol
--   ✅ app/moderator/actions.ts:180   `if (!kalkisIl) return 'Kalkış ili tanınamadı'`
--   ✅ app/moderator/actions.ts:196   durak başına aynı kontrol
--   ❌ supabase/functions/parse-listing/index.ts:836-842 — **KORUMASIZ**
--
-- 🚨 ÖNCEKİ NOTLARDA "iki korumasız yol var" YAZIYORDU — YANLIŞTI.
--    `app/moderator/actions.ts` `ilanYaz()`'ı atlıyor (doğru), ama AYNI
--    KONTROLLERİ kendi içinde tekrarlıyor (satır 180 ve 196). "ilanYaz()'ı
--    atlıyor" ile "korumasız" aynı şey değil; ilki çağrı grafiği, ikincisi
--    davranış. Grafiğe bakıp davranış çıkarmak bu hatayı üretti.
--    Düzeltildi: korumasız yol **BİR TANE**, o da Deno Edge Function.
--
-- Neden o korumasız: `lib/lokasyon.ts`'i Deno import EDEMEZ, bu yüzden
-- `origin_province_id` bile göndermiyor (satır 839: sadece `origin_city`).
-- Tüm il çözümlemesini RPC'ye devretmiş durumda — dolayısıyla **guard'ın tek
-- gerçek müşterisi bu yol**. Değeri `firstLane.from`, yani `aliases.normalized`
-- ham değeri; bir alias'ın `provinces.name`'e katlanacağının garantisi YOK
-- (alias ilçe/semt de olabilir: "İkitelli", "İSTOÇ").
--
-- 📌 Guard'ın anlamı bu yüzden "olmayacak bir şeye karşı sigorta" değil:
--    tek korumasız kanalın tek koruması. 0.1 sıfır dönse bile eklenir —
--    sıfır, alias havuzunun bugünkü içeriğinin tesadüfü, yapısal garanti değil.

-- 0.4 — 🚨 KOD ÖN KOŞULU: parse-listing durum yazımı düzeltilmiş VE DEPLOY EDİLMİŞ
--
-- Guard'ı yazarken ortaya çıkan asıl tehlike guard'ın kendisi değil, ARDINDAN
-- NE OLDUĞUYDU. `supabase/functions/parse-listing/index.ts` RPC hatasında
-- `continue` ediyor, sonra döngü dışında **koşulsuz**
--     update raw_posts set processing_status = 'processed'
-- yazıyordu. Yani hiç ilan oluşmasa bile ham mesaj `processed` işaretlenip
-- `no_lane` kuyruğundan düşüyordu.
--
-- 🚨 v4 bu satırla birleşince guard AMACININ TERSİNİ yapardı:
--      v3: çözülemeyen il → ilan oluşur, `origin_city='İkitelli'`, moderatör
--          `learn-aliases` sekmesinde görür, alias öğretir, düzelir.  (GÖRÜNÜR)
--      v4 + eski satır: RPC 22023 → ilan YOK → raw_post 'processed' → mesaj
--          hiçbir kuyrukta değil.                                     (KAYIP)
--    Guard "sessiz bozulmayı gürültülü yapar" diye eklendi; bu satırla birlikte
--    sessiz bozulmayı SESSİZ KAYBA çevirirdi. Bir katmandaki gürültü, bir üst
--    katman onu yutuyorsa gürültü değildir.
--
-- ✅ Düzeltildi (31 Tem 2026): durum artık sonuca göre yazılıyor —
--    `created > 0 ? 'processed' : 'no_lane'` + WARN log. Böylece çözümsüz mesaj
--    kuyrukta kalır ve alias öğretildikten sonra
--    `app/api/admin/reprocess-no-lane` onu yeniden dener.
--    ⚠️ Bu aslında v4'ten BAĞIMSIZ, ÖNCEDEN VAR OLAN bir bug: bugün de 23514 /
--       22P02 gibi her RPC hatası aynı şekilde mesaj kaybediyor. v4 onu nadir
--       kenar durumdan beklenen akışa çevirdiği için görünür oldu.
--
-- 🚨 SIRA — ihlal edilirse veri kaybı:
--    1) parse-listing düzeltmesi DEPLOY EDİLİR ve deploy DOĞRULANIR
--    2) BÖLÜM 2 kod temizliği (KOVA B) deploy edilir
--    3) ANCAK O ZAMAN ADIM 1 (v4) çalıştırılır
--
-- 🚨 DEPLOY DOĞRULAMASI ATLANAMAZ — `SUPABASE_ACCESS_TOKEN` EKSİK.
--    `~/.config/yukegel/auto-deploy.env` içinde yok; Edge Function deploy'ları
--    **sessizce atlanıyor** (`scripts/auto-deploy.log:19565`). Yani düzeltme
--    commit'lenip "deploy edildi" sanılabilir ve canlıda ESKİ kod kalır.
--    Bu senaryo tam olarak yukarıdaki KAYIP durumudur.
--    → Token eklenmeden v4 çalıştırılmaz. Doğrulama: Supabase Dashboard →
--      Edge Functions → parse-listing → son deploy zamanı bugünü göstermeli.
--
-- ✅ DOĞRULANDI 3 Ağu 2026 — ama ZAMAN DAMGASIYLA DEĞİL, GÖVDEYLE.
--    Dashboard "4 saat önce" diyordu; dosyanın içeriği 31 Tem'de yazılmış,
--    commit'i 3 Ağu 11:04'te atılmıştı — deploy commit'ten ÖNCE görünüyordu.
--    Üç tarih üç ayrı şeyi ölçüyor ve hiçbiri "canlıda hangi kod var" sorusunu
--    cevaplamıyor. Cevabı Code sekmesinde tek bir ayırt edici satır verdi:
--    `created > 0 ? 'processed' : 'no_lane'` VAR, koşulsuz `'processed'` YOK.
--    → Kural: deploy doğrulaması tarih karşılaştırması değil, canlı gövdede
--      ayırt edici satır aramaktır. (DB tarafında `pg_get_functiondef` ile
--      zaten böyle yapılıyordu; Edge Function tarafı da aynı.)


-- ============================================================================
-- ADIM 0.5 — 🚨 NOT NULL KISITLARINI DÜŞÜR (ZORUNLU, ADIM 1'DEN ÖNCE)
-- ============================================================================
--
-- 3 Ağu 2026'da CANLIDA ÖĞRENİLDİ: v4 uygulandıktan sonra HER `ilan_olustur`
-- çağrısı `23502` attı —
--   null value in column "origin_city" of relation "listings"
--   violates not-null constraint
-- Yani ilan oluşturma tüm kanallarda (form · Excel · WhatsApp · moderatör ·
-- parse-listing) durdu. Süre kısa tutuldu, kısıt düşürülerek çözüldü.
--
-- 📌 NEDEN KAÇTI — plan iki fiili ayırdı ama arayı düşünmedi. "Kolona yazmayı
--    bırakmak" (v4, bugün) ile "kolonu düşürmek" (BÖLÜM 5, ~7 Ağu) arasında
--    GÜNLERCE bir pencere olacağı doğru kurgulanmıştı; o pencerede kolonun
--    hâlâ DOLU OLMAYI ZORUNLU KILDIĞI sorulmadı. Ne bu dosya ne drop dosyası
--    "NOT NULL" kelimesini bir kez geçiriyordu.
--    → Kural: bir yazma yolunu kesmeden önce hedef kolonun kısıtlarına bak.
--      "Artık yazmıyoruz" ancak kolon bunu KABUL EDİYORSA doğrudur.
--
-- ✅ Güvenli: kolonlar BÖLÜM 5'te zaten tamamen düşüyor; bu onun küçük ön
--    adımı. Katalog değişikliği, tablo taraması yok, anında biter.
--    (`drop column` kısıtı da beraberinde götürür — çakışma olmaz.)

-- 0.5.1 — Durum tespiti
-- select table_name, column_name, is_nullable
--   from information_schema.columns
--  where (table_name, column_name) in
--        (('listings','origin_city'), ('listing_stops','city'))
--    and table_schema = 'public';
--
-- ✅ ÇALIŞTIRILDI 3 Ağu 2026 (kısıt düşürüldükten SONRA) →
--    listings.origin_city = YES · listing_stops.city = YES

-- 0.5.2 — Kısıtları düşür
-- alter table public.listings      alter column origin_city drop not null;
-- alter table public.listing_stops alter column city        drop not null;
--
-- ✅ ÇALIŞTIRILDI 3 Ağu 2026.
-- ⚠️ `listing_stops.city` muhtemelen zaten nullable'dı; ikinci satır o hâlde
--    zararsızca geçer. Yine de körlemesine bırakılmadı — 0.5.1 ikisini de
--    kayda geçiriyor, çünkü "biri patladıysa diğeri de patlar mı" sorusunun
--    cevabı tahmin edilecek bir şey değil.


-- ============================================================================
-- ADIM 1 — v4 GÖVDESİ
-- ============================================================================
-- (v3'ten farklar ⬅️ ile işaretli. Gerisi birebir aynı.)

begin;

create or replace function public.ilan_olustur(
  p_listing jsonb,
  p_stops   jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id          uuid;
  v_sonuc       jsonb;
  v_origin_pid  smallint;
  -- ⬅️ v_origin_city KALDIRILDI — artık yazılacak bir metin kolonu yok.
begin
  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'ilan_olustur: en az bir durak gerekli'
      using errcode = '22023';
  end if;

  -- ── İL ÇÖZÜMLEMESİ ────────────────────────────────────────────────────────
  -- Değişmedi: açık id kazanır, yoksa metinden `il_key()` ile katlanmış eşleşme.
  -- Metin GİRDİ olarak hâlâ hayati; sadece ÇIKTI olarak saklanmıyor.
  v_origin_pid := coalesce(
    nullif(p_listing->>'origin_province_id', '')::smallint,
    (select p.id from public.provinces p
      where public.il_key(p.name) = public.il_key(p_listing->>'origin_city'))
  );

  -- ⬅️ v3'teki `v_origin_city := coalesce(provinces.name, ham metin)` SİLİNDİ.
  --    O coalesce'in ikinci bacağı bilinçli bir veri koruma kararıydı: il
  --    çözülemezse ham metin korunuyordu. Kolon düşünce o koruma da düşer.

  -- ⬅️ GUARD 1 — kalkış.
  --
  -- 🚨 "Ölçüm sıfır çıktı, guard gereksiz" DENMEZ. Sıfırın sebebi verinin
  --    doğası değil, çağıranların üçünden İKİSİNİN kendi kontrolünü yapması
  --    (`lib/ilan-yaz.ts`:247, `app/moderator/actions.ts`:180). Koruma
  --    UYGULAMA katmanında, DB'de değil — ve üçüncü çağıran
  --    (`supabase/functions/parse-listing/index.ts`) o kontrolü YAPMIYOR,
  --    üstelik `origin_province_id`'yi hiç göndermiyor.
  --    v3'te o yoldan çözülemeyen bir il gelse metin kolona yazılıp korunuyordu.
  --    v4'te aynı çağrı KALKIŞI OLMAYAN bir ilan üretir — ne id, ne metin — ve
  --    hata vermez. Sessiz bozulma, gürültülü bozulmadan pahalıdır.
  --
  -- ⚠️ `22023` (invalid_parameter_value) bilinçli: çağıranlar zaten
  --    `PGRST202`/`23514` gibi kodları ayırt ediyor; yeni bir sınıf değil,
  --    "girdi geçersiz" ailesinden. `raise` transaction'ı geri alır, yani
  --    yarım ilan kalmaz (V5 atomiklik garantisi korunur).
  if v_origin_pid is null then
    raise exception 'ilan_olustur: kalkış ili çözümlenemedi (origin_city=%, origin_province_id=%)',
      p_listing->>'origin_city', p_listing->>'origin_province_id'
      using errcode = '22023';
  end if;

  insert into public.listings (
    listing_type, origin_district, contact_phone,   -- ⬅️ origin_city çıkarıldı
    origin_province_id, origin_district_official,
    price_offer, price_negotiable, available_date, date_flexible,
    notes, raw_text, source,
    moderation_status, status, trust_level,
    user_id, vehicle_id, vehicle_type, body_type,
    raw_post_id, shadow_profile_id, is_repost, reviewed_at
  )
  values (
    p_listing->>'listing_type',
    -- ⬅️ v_origin_city değeri çıkarıldı
    p_listing->>'origin_district',
    p_listing->>'contact_phone',
    v_origin_pid,
    nullif(p_listing->>'origin_district_official', '')::boolean,
    (p_listing->>'price_offer')::numeric,
    coalesce((p_listing->>'price_negotiable')::boolean, false),
    (p_listing->>'available_date')::date,
    coalesce((p_listing->>'date_flexible')::boolean, false),
    p_listing->>'notes',
    p_listing->>'raw_text',
    p_listing->>'source',
    coalesce(p_listing->>'moderation_status', 'pending'),
    coalesce(p_listing->>'status', 'passive'),
    coalesce(p_listing->>'trust_level', 'social'),
    (p_listing->>'user_id')::uuid,
    (p_listing->>'vehicle_id')::uuid,
    case
      when jsonb_typeof(p_listing->'vehicle_type') = 'array'
      then array(select jsonb_array_elements_text(p_listing->'vehicle_type'))
      else null
    end,
    case
      when jsonb_typeof(p_listing->'body_type') = 'array'
      then array(select jsonb_array_elements_text(p_listing->'body_type'))
      else null
    end,
    (p_listing->>'raw_post_id')::uuid,
    (p_listing->>'shadow_profile_id')::uuid,
    coalesce((p_listing->>'is_repost')::boolean, false),
    (p_listing->>'reviewed_at')::timestamptz
  )
  returning id into v_id;

  -- ── DURAKLAR ──────────────────────────────────────────────────────────────
  -- ⚠️ Veri kaybı riski `listings`tekinden DAHA AĞIR: `listings`in bir
  --    `raw_text` yedeği var, `listing_stops`un YOK. İl çözülemeyen bir durak
  --    v4'te `province_id IS NULL` + metin yok = TAMAMEN BOŞ SATIR olur ve o
  --    ilanın rotası sessizce eksilir.

  -- ⬅️ GUARD 2 — duraklar. Kalkıştakiyle aynı gerekçe, daha sert sonuç: kalkışı
  --    olmayan ilan hiç değilse duraklarından okunabilir, ama durağı boş bir
  --    ilanın eksildiğini fark etmenin bir yolu yoktur.
  --    ⚠️ Kontrol INSERT'ten ÖNCE: sonra bakmak "yazdım, sonra beğenmedim"dir.
  if exists (
    select 1
    from jsonb_array_elements(p_stops) as t(s)
    where coalesce(
      nullif(t.s->>'province_id', '')::smallint,
      (select p2.id from public.provinces p2
        where public.il_key(p2.name) = public.il_key(t.s->>'city'))
    ) is null
  ) then
    raise exception 'ilan_olustur: en az bir durağın ili çözümlenemedi (%)',
      (select string_agg(coalesce(t.s->>'city', '<boş>'), ', ')
       from jsonb_array_elements(p_stops) as t(s))
      using errcode = '22023';
  end if;

  insert into public.listing_stops (
    listing_id, stop_order, district, province_id, district_official,  -- ⬅️ city çıkarıldı
    vehicle_count, cargo_type, weight_ton, pallet_count, notes
  )
  select
    v_id,
    t.ord::int,
    -- ⬅️ `coalesce(sp.name, t.s->>'city')` çıkarıldı
    t.s->>'district',
    sp.id,
    nullif(t.s->>'district_official', '')::boolean,
    coalesce((t.s->>'vehicle_count')::int, (p_listing->>'arac_adet')::int),
    t.s->>'cargo_type',
    (t.s->>'weight_ton')::numeric,
    (t.s->>'pallet_count')::int,
    t.s->>'notes'
  from jsonb_array_elements(p_stops) with ordinality as t(s, ord)
  left join lateral (
    select p.id, p.name
    from public.provinces p
    where p.id = coalesce(
      nullif(t.s->>'province_id', '')::smallint,
      (select p2.id from public.provinces p2
        where public.il_key(p2.name) = public.il_key(t.s->>'city'))
    )
  ) sp on true;

  select to_jsonb(x) into v_sonuc
  from (
    select l.id, l.audit_score, l.moderation_status, l.is_shadow_banned
    from public.listings l
    where l.id = v_id
  ) x;

  return v_sonuc;
end;
$$;

grant execute on function public.ilan_olustur(jsonb, jsonb) to authenticated, service_role;

commit;


-- ============================================================================
-- ADIM 2 — DOĞRULAMA (canlıda, kolonlar HÂLÂ DURURKEN)
-- ============================================================================
--
-- ⚠️ Bu testi kolon drop'undan ÖNCE yap. Amaç kolonların artık YAZILMADIĞINI
--    görmek. Drop'tan sonra yapmak anlamsız — orada zaten geri dönüş yok.
--
-- ✅✅ ÇALIŞTIRILDI 3 Ağu 2026 — 2.1/2.2/2.3 GEÇTİ.
--     2.2 → origin_city NULL · origin_province_id 34 · city NULL · province_id 6
--     2.3a → 22023 "kalkış ili çözümlenemedi (origin_city=Rotterdam, origin_province_id=<NULL>)"
--     2.3b → 22023 "en az bir durağın ili çözümlenemedi (Rotterdam)"
--     Kalan: 2.5 duman testi (özellikle parse-listing — guard'ın tek müşterisi).
--
-- 🚨 SÜRÜM DOĞRULAMASI İKİ KEZ YANLIŞ CEVAP VERDİ — İKİSİ DE ARAÇ HATASIYDI.
--    (1) İlk denemede ADIM 1 hiç uygulanmamıştı ama bu ancak 2.2 metin
--        döndürünce anlaşıldı. İpucu KASADAN geldi: girdi 'istanbul'/'ANKARA'
--        idi, çıktı 'İstanbul'/'Ankara' — yani KANONİK yazım, `provinces.name`
--        imzası, v3'ün `coalesce(provinces.name, ham metin)` satırı.
--        📌 Ham girdinin kanonikleşmiş hâli, hangi kod yolunun çalıştığını
--           söyleyen bir parmak izidir; "değer geldi" deyip geçilmemeli.
--    (2) Ardından yazılan tespit sorgusu `pg_get_functiondef(...) ~ 'v_origin_city'`
--        idi ve v4'te de TRUE döndü — çünkü `pg_get_functiondef` YORUMLARI da
--        döndürür ve v4 gövdesi üç yerde "v_origin_city KALDIRILDI" diye
--        anlatıyor. Sorgu, kaldırıldığını söyleyen yorumu kaldırılmamışlığın
--        kanıtı saydı.
--        📌 Aynı hata sınıfı `destination_city` mitiyle aynı: "kodda geçiyor"
--           ile "kod bunu yapıyor" farklı şeyler. Gövdede metin ararken yorum
--           satırları ELENMELİ — `20260803_get_nearby_cte_temizligi.sql` 2.1
--           bunu zaten doğru yapıyordu, buraya taşınmamıştı.
--    Doğru hâli:
--      select exists (select 1 from unnest(string_to_array(
--                       pg_get_functiondef(p.oid), E'\n')) as l
--                      where l !~ '^\s*--' and l ~ 'v_origin_city') as v3_mu
--        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname = 'ilan_olustur';

-- 2.1 — Mutlu yol: metin girdisi verildi, id çözüldü, kolonlar boş kaldı.
-- select public.ilan_olustur(
--   jsonb_build_object('listing_type','yuk','origin_city','istanbul','source','excel'),
--   jsonb_build_array(jsonb_build_object('city','ANKARA'))
-- );
-- BEKLENEN: hata yok, jsonb döner.
--
-- ⚠️ `source` olarak 'test_v4' KULLANMA — `listings_source_check` yalnız
--    ('form','excel','whatsapp','facebook') kabul eder, 23514 alırsın.
--    (Bu kısıt 31 Tem'de canlıdan okundu; `lib/ilan-yaz.ts::IlanKaynak` ona
--    birebir eşitlendi.) Ayırt etmek için `notes` alanını işaretle.

-- 2.2 — Kolonlar boş mu, id'ler dolu mu?
-- select l.origin_city, l.origin_province_id, s.city, s.province_id
--   from public.listings l
--   join public.listing_stops s on s.listing_id = l.id
--  where l.id = '<2.1'in döndürdüğü id>';
-- BEKLENEN: origin_city NULL · origin_province_id 34 · city NULL · province_id 6

-- 2.3 — 🚨 GUARD TESTİ. Bu testi ATLAMA: guard'ın çalıştığını görmeden
--       "eklendi" demek, eklenmediğini varsaymakla aynı riski taşır.
-- select public.ilan_olustur(
--   jsonb_build_object('listing_type','yuk','origin_city','Rotterdam','source','whatsapp'),
--   jsonb_build_array(jsonb_build_object('city','ANKARA'))
-- );
-- BEKLENEN: ERROR 22023 — "kalkış ili çözümlenemedi (origin_city=Rotterdam, ...)"
--
-- select public.ilan_olustur(
--   jsonb_build_object('listing_type','yuk','origin_city','istanbul','source','whatsapp'),
--   jsonb_build_array(jsonb_build_object('city','Rotterdam'))
-- );
-- BEKLENEN: ERROR 22023 — "en az bir durağın ili çözümlenemedi (Rotterdam)"
-- ⚠️ Ardından `select count(*) from public.listings where notes = ...` ile
--    YARIM İLAN KALMADIĞINI teyit et. Guard 2 INSERT'ten sonra çalışsaydı
--    listing satırı yazılmış olurdu; `raise` onu geri alır, ama bunu görmek
--    "geri alır" cümlesine güvenmekten iyidir.

-- 2.4 — Temizlik
-- delete from public.listings where id = '<2.1'in id'si>';
--    (listing_stops FK cascade ile gider; değilse önce durakları sil.)

-- 2.5 — Duman testi (dört yazma yolu, canlı)
--   [ ] /ilan-ver formundan ilan oluşuyor           (lib/ilan-yaz.ts)
--   [ ] Excel içe aktarma çalışıyor                 (lib/ilan-yaz.ts)
--   [ ] WhatsApp webhook'undan ilan oluşuyor        (lib/ilan-yaz.ts)
--   [ ] Moderatör panelinden ilan oluşuyor          (app/moderator/actions.ts)
--   [ ] Edge Function parse-listing ilan yazıyor    ← 🚨 GUARD'IN TEK MÜŞTERİSİ
--       ⚠️ Bunu gözle doğrula. Diğer dördü zaten kendi kontrolünü yapıyor,
--          yani v4 onlar için davranış değiştirmez. Bu yol için DEĞİŞTİRİR.


-- ============================================================================
-- ADIM 3 — GERİ ALMA
-- ============================================================================
--
-- v4 yalnızca `create or replace function`. Geri alma = v3'ü yeniden çalıştır:
--   `docs/20260730_ilan_olustur_v3.sql`
--
-- ✅ Şema değişmiyor, veri taşınmıyor → geri alma TAM. v4 döneminde oluşan
--    satırlarda `origin_city`/`stops.city` NULL kalır (v3 geri gelince yeniden
--    yazılmaya başlar, eskiler geriye dönük DOLMAZ).
--
-- ⚠️ Bu, v4'ün "risksiz" olduğu anlamına GELMEZ. Geri alınamayan şey fonksiyon
--    değil, o dönemde NULL doğmuş satırların metni. Onarımı kolay ama elle:
--      update public.listings l set origin_city = p.name
--        from public.provinces p
--       where p.id = l.origin_province_id and l.origin_city is null;
--      update public.listing_stops s set city = p.name
--        from public.provinces p
--       where p.id = s.province_id and s.city is null;
--    (Kolon drop'undan SONRA bu onarım da imkânsızlaşır — asıl dönüşsüz nokta
--     v4 değil, BÖLÜM 5.)
