-- ============================================================================
-- #42 — TABAN `no_lane` FORMAT ÖLÇÜMÜ
-- 5 Ağustos 2026
-- ============================================================================
--
-- NİYE: Taban `no_lane` oranı (~%10–20 hafta içi, %44–50 hafta sonu) v4'ten
-- önce de vardı; sebebi `parse-listing/index.ts`:493 `if (!from) continue` —
-- yani hiç şerit çıkarılamıyor. 4 Ağu'da GÖZLE altı format sınıfı görüldü
-- (oksuz alt alta iller · iki taraf da ilçe · kalkış ilçe · yurt dışı varış ·
-- sınır kapısı · tek kalkış–çok varış). Ama HİÇBİRİ SAYILMADI.
--
-- Bu dosyanın cevapladığı TEK soru, ve ondan önce kod yazılmamalı:
--   👉 `no_lane` yığınının ne kadarı ONARILABİLİR?
-- Metinde hiç yer adı yoksa (sohbet, "hayırlı işler", tek telefon, reklam)
-- ayrıştırıcıya ne yaparsak yapalım o satır şerit üretmez. Onarılabilir kısım
-- #42'nin TAVANIDIR; tavanı bilmeden format desteği yazmak, ne kazandırdığı
-- ölçülemeyen iş demektir.
--
-- 🚨 YAZMA DAVRANIŞI — DÜRÜST HÂLİ:
--    Bu betik ARTIK "salt okunur" değil. `pg_temp` kullanılamıyor: Supabase SQL
--    editörü her ifadeyi AYRI OTURUMDA çalıştırıyor, temp tablolar ifadeler
--    arasında yaşamıyor (ilk denemede `ERROR 42P01: relation "ornek" does not
--    exist` tam olarak bu yüzden alındı). Bu yüzden kendi izole şemasını açar:
--      · `olcum42` şemasını YARATIR ve içine ara tablolar yazar.
--      · Baştaki `drop schema if exists olcum42 cascade` sayesinde tekrar
--        çalıştırılabilir (idempotent).
--      · `public` şemasındaki HİÇBİR şeye yazmaz. `raw_posts` ve `aliases`
--        yalnızca OKUNUR.
--      · İşin sonunda BÖLÜM 8'deki `drop schema` ile temizlenir.
--
-- ⚠️ YÖNTEMİN ZAYIF NOKTASI VE NASIL KORUNDUĞU:
--    Buradaki `yer` sayısı gerçek ayrıştırıcı DEĞİL, onun SQL taklidi. Taklit
--    sapabilir — bu projede "otoriter görünen ama gerçekten sapmış kayıt"
--    kalıbı ~7 kez tekrarladı. Bu yüzden BÖLÜM 2 bir POZİTİF KONTROL: taklit,
--    ayrıştırıcının BAŞARDIĞI satırlarda ≥2 yer bulmak ZORUNDA. Bulamıyorsa
--    bozuk olan ölçüm değil taklittir ve devamı okunmaz. Kontrolü atlama.
--
-- ÇALIŞTIRMA: baştan sona tek seferde. `select` dönen her bölümü aynen yapıştır.
-- Zaman aşımı olursa BÖLÜM 1'deki `PENCERE_GUN` yorumuna bak.
-- ============================================================================

drop schema if exists olcum42 cascade;
create schema olcum42;


-- ============================================================================
-- BÖLÜM 0 — TAKLİT KATMANI
-- `parse-listing/index.ts`:118 `trNorm`, :139 `stripSuffix`,
-- :158 `stripSuffixOnce`, :308 `findPlaces` taklidi.
-- ============================================================================

-- trNorm — 🚨 SIRA HAYATİ: İ/I → i, `lower()`'DAN ÖNCE.
-- Tersi olursa Postgres `lower('İ')` = i + U+0307 üretir, anahtar ayrışır. Bu
-- projede 34 alias satırını sessizce öldüren bug tam olarak buydu.
create function olcum42.trnorm(s text) returns text
language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(
      translate(
        lower(replace(replace(coalesce(s, ''), 'İ', 'i'), 'I', 'i')),
        'çğıöşüâîû', 'cgiosuaiu'
      ),
      '[^a-z0-9[:space:]]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- CASE_SUFFIXES (index.ts:133) — SIRA ÖNEMLİ, ilk eşleşen kazanır.
-- ℹ️ Listedeki `yı`,`nın`,`nun`,`nün`,`ı`,`ü` ASLA tutmaz: `trNorm` token'ı
--    çoktan ASCII'ye katlamıştır. TS'te de öyle. AYNEN bırakıldı — taklit,
--    kodun DOĞRUSUNU değil KENDİSİNİ yansıtmalı; düzeltirsem canlı davranışı
--    değil olması gerekeni ölçmüş olurum.
create function olcum42.ekler() returns text[]
language sql immutable as $$
  select array['dan','den','tan','ten','da','de','ta','te',
               'ya','ye','yi','yı','yu','yü','nin','nın','nun','nün',
               'na','ne','a','e','i','ı','u','ü']
$$;

-- stripSuffixOnce (index.ts:158) — tek tur, ara formu korur (tuzladan → tuzla)
create function olcum42.ek_soy_tek(t text) returns text
language plpgsql immutable as $$
declare suf text;
begin
  if length(t) < 5 then return t; end if;
  foreach suf in array olcum42.ekler() loop
    if right(t, length(suf)) = suf and length(t) - length(suf) >= 3 then
      return left(t, length(t) - length(suf));
    end if;
  end loop;
  return t;
end $$;

-- stripSuffix (index.ts:139) — döngü. ⚠️ `length < 5` kontrolü TS'te de yalnız
-- GİRİŞTE var; döngü içinde yeniden bakılmaz, yani token 5'in altına inse bile
-- soyulmaya devam eder (tuzladan → tuzla → tuzl). Taklit aynı davranıyor.
create function olcum42.ek_soy_tam(t text) returns text
language plpgsql immutable as $$
declare suf text; degisti boolean := true; r text := t;
begin
  if length(r) < 5 then return r; end if;
  while degisti loop
    degisti := false;
    foreach suf in array olcum42.ekler() loop
      if right(r, length(suf)) = suf and length(r) - length(suf) >= 3 then
        r := left(r, length(r) - length(suf));
        degisti := true;
        exit;
      end if;
    end loop;
  end loop;
  return r;
end $$;

-- Alias kümesi — findPlaces yalnız `type='city'` + `is_active` bakar (:316).
create table olcum42.alias_city as
select distinct olcum42.trnorm(alias) as key_alias,
                olcum42.trnorm(normalized) as key_norm
from public.aliases
where is_active and type = 'city' and alias is not null;

create index on olcum42.alias_city (key_alias);
analyze olcum42.alias_city;


-- ============================================================================
-- BÖLÜM 1 — ÖRNEKLEM
-- İki küme TEK boru hattından geçirilir: `kontrol` (ayrıştırıcının BAŞARDIĞI
-- satırlar → pozitif kontrol) ve `hedef` (`no_lane` → asıl ölçüm). Aynı koddan
-- geçmeleri şart; ayrı yollardan geçerlerse kontrol hiçbir şey kanıtlamaz.
--
-- PENCERE_GUN = 30. Zaman aşımı alırsan aşağıdaki `interval '30 days'`
-- ifadesini `'14 days'` yap; oranlar bozulmaz, yalnız güven aralığı daralır.
-- ============================================================================
create table olcum42.ornek as
  select id, 'kontrol'::text as kume, message_date::date as gun, raw_text
  from public.raw_posts
  where processing_status = 'processed' and raw_text is not null
  order by created_at desc
  limit 400;

insert into olcum42.ornek
  select id, 'hedef', message_date::date, raw_text
  from public.raw_posts
  where processing_status = 'no_lane'
    and raw_text is not null
    and message_date >= current_date - interval '30 days';

create index on olcum42.ornek (id);
analyze olcum42.ornek;

-- Token'lar. `length >= 3` filtresi index.ts:310 ile aynı.
-- 🚨 `ord` bilerek YENİDEN numaralanıyor (`row_number`): TS'te bigram'lar
--    `tokens[i]`/`tokens[i+1]` ile FİLTRELENMİŞ dizi üzerinde kuruluyor, yani
--    komşuluk filtre SONRASI sıradır. Ham `with ordinality` değerini kullansaydım
--    kısa token'lar (<3) komşuluğu bozar ve "İstanbul da Ankara" gibi araya iki
--    harfli kelime giren satırlarda bigram sessizce kaçardı.
create table olcum42.tok as
select n.id,
       row_number() over (partition by n.id order by x.ord) as ord,
       x.tok
from olcum42.ornek n,
     regexp_split_to_table(olcum42.trnorm(n.raw_text), ' ')
       with ordinality as x(tok, ord)
where length(x.tok) >= 3;

create index on olcum42.tok (id, ord);
analyze olcum42.tok;

-- 🏎️ Ek soyma DISTINCT token başına BİR KEZ hesaplanır (satır başına değil).
-- Naif hâli milyonlarca plpgsql çağrısı yapıp editörde zaman aşımına düşüyor.
create table olcum42.tok_form as
select d.tok,
       olcum42.ek_soy_tek(d.tok) as f_tek,
       olcum42.ek_soy_tam(d.tok) as f_tam
from (select distinct tok from olcum42.tok) d;

create index on olcum42.tok_form (tok);
analyze olcum42.tok_form;

-- findPlaces adayları: unigram(ham / tek-soy / tam-soy) + bigram(ham / tam-soy).
-- ⚠️ Bigram'da tek-soy YOK — bu bir yazım hatası değil, index.ts:321'in aynen
--    taklidi. Bunun bir HATA olduğu BÖLÜM 7'de ölçülüyor.
create table olcum42.aday as
  select t.id, v.g
  from olcum42.tok t
  join olcum42.tok_form f on f.tok = t.tok
  cross join lateral (values (t.tok), (f.f_tek), (f.f_tam)) v(g)
union all
  select a.id, a.tok || ' ' || b.tok
  from olcum42.tok a join olcum42.tok b on b.id = a.id and b.ord = a.ord + 1
union all
  select a.id, fa.f_tam || ' ' || fb.f_tam
  from olcum42.tok a join olcum42.tok b on b.id = a.id and b.ord = a.ord + 1
  join olcum42.tok_form fa on fa.tok = a.tok
  join olcum42.tok_form fb on fb.tok = b.tok;

create index on olcum42.aday (g);
analyze olcum42.aday;

-- Satır başına tanınan farklı şehirler. Tekilleme katlanmış `normalized`
-- üzerinden — index.ts:314/324 `seen.add(yerKey(...))` ile aynı.
create table olcum42.bulunan as
select distinct a.id, ac.key_norm
from olcum42.aday a join olcum42.alias_city ac on ac.key_alias = a.g;

create index on olcum42.bulunan (id);
analyze olcum42.bulunan;

create table olcum42.olcum as
select o.id, o.kume, o.gun, o.raw_text,
       coalesce(h.yer, 0) as yer
from olcum42.ornek o
left join (select id, count(*) as yer from olcum42.bulunan group by id) h on h.id = o.id;

create index on olcum42.olcum (kume);
analyze olcum42.olcum;


-- ============================================================================
-- BÖLÜM 2 — 🚨 POZİTİF KONTROL. ÖNCE BUNA BAK, SONRA DİĞERLERİNE.
-- Taklit, ayrıştırıcının BAŞARDIĞI satırlarda ≥2 yer bulabiliyor mu?
--
-- 👉 `iki_yer_orani` **≥ 90** DEĞİLSE DUR ve bana yalnız bunu yapıştır.
--    Taklit bozuk demektir; BÖLÜM 4'ün "onarılamaz" sayısı olduğundan büyük
--    çıkar ve #42'yi haksız yere gereksiz gösterir.
-- ============================================================================
select 'BÖLÜM 2 — pozitif kontrol'      as bolum,
       count(*)                          as satir,
       count(*) filter (where yer >= 2)  as en_az_iki_yer,
       count(*) filter (where yer = 1)   as tek_yer,
       count(*) filter (where yer = 0)   as sifir_yer,
       round(100.0 * count(*) filter (where yer >= 2) / nullif(count(*), 0), 1)
                                         as iki_yer_orani
from olcum42.olcum where kume = 'kontrol';


-- ============================================================================
-- BÖLÜM 3 — POPÜLASYON. `no_lane` gerçekte ne kadar, hafta sonu farkı var mı?
-- Eksen `message_date` (mesajın YAZILDIĞI gün) — "trafik ne cinsten" sorusunun
-- ekseni budur. `created_at` (= işleme anı) "hangi sürüm işledi" sorusunun
-- ekseni; ikisini karıştırmak bu projede iki kez yanlış alarm üretti.
-- ============================================================================
select 'BÖLÜM 3 — günlük' as bolum,
       message_date::date                                              as gun,
       to_char(message_date::date, 'Dy')                               as gun_adi,
       extract(isodow from message_date::date) in (6, 7)               as hafta_sonu,
       count(*) filter (where processing_status <> 'pending')          as islenmis,
       count(*) filter (where processing_status = 'no_lane')           as no_lane,
       round(100.0 * count(*) filter (where processing_status = 'no_lane')
             / nullif(count(*) filter (where processing_status <> 'pending'), 0), 1)
                                                                       as no_lane_yuzde
from public.raw_posts
where message_date >= current_date - interval '30 days'
group by 2, 3, 4
order by 2 desc;

-- Hafta içi / hafta sonu tek satırda — "3–4 kat" iddiası doğru mu?
select 'BÖLÜM 3b — hafta sonu farkı' as bolum,
       case when extract(isodow from message_date::date) in (6, 7)
            then 'hafta sonu' else 'hafta içi' end                     as kesim,
       count(*)                                                        as islenmis,
       count(*) filter (where processing_status = 'no_lane')           as no_lane,
       round(100.0 * count(*) filter (where processing_status = 'no_lane')
             / nullif(count(*), 0), 1)                                 as yuzde
from public.raw_posts
where message_date >= current_date - interval '30 days'
  and processing_status <> 'pending'
group by 2
order by 2;


-- ============================================================================
-- BÖLÜM 4 — 🎯 ASIL SORU: `no_lane` yığınının ne kadarı ONARILABİLİR?
--
--   KOVA A (0 yer)  → ayrıştırıcı hatası DEĞİL. Tanınacak yer yok. Format
--                     desteği bunlara dokunamaz; #42'nin dışında.
--   KOVA B (1 yer)  → tek uç var, şerit için ikinci uç yok. Ya bilgi eksik
--                     (onarılamaz) ya ikinci yer alias'ta YOK → bu ALIAS işi,
--                     ayrıştırıcı işi değil (SLH / AI Keşif alanı).
--   KOVA C (≥2 yer) → 👉 #42'NİN ÖDÜLÜ. İki ucu da tanıyor ama şerit kuramıyor.
-- ============================================================================
select 'BÖLÜM 4 — onarılabilirlik tavanı' as bolum,
       count(*)                            as no_lane_toplam,
       count(*) filter (where yer = 0)     as kova_a_sifir_yer,
       count(*) filter (where yer = 1)     as kova_b_tek_yer,
       count(*) filter (where yer >= 2)    as kova_c_iki_ve_ustu,
       round(100.0 * count(*) filter (where yer >= 2) / nullif(count(*), 0), 1)
                                           as tavan_yuzde
from olcum42.olcum where kume = 'hedef';

-- Hafta sonu sıçraması hangi kovadan geliyor? Hipotez: A (yapısız sohbet).
-- Doğrulanırsa hafta sonu oranı #42 kapsamı DIŞINDADIR — yani o "kötü" sayı
-- ayrıştırıcıyla ilgili değildir ve düzeltilmesi beklenmemelidir.
select 'BÖLÜM 4b — hafta sonu hangi kovadan' as bolum,
       case when extract(isodow from gun) in (6, 7)
            then 'hafta sonu' else 'hafta içi' end as kesim,
       count(*)                                    as no_lane,
       count(*) filter (where yer = 0)             as kova_a,
       count(*) filter (where yer = 1)             as kova_b,
       count(*) filter (where yer >= 2)            as kova_c,
       round(100.0 * count(*) filter (where yer = 0) / nullif(count(*), 0), 1)
                                                   as kova_a_yuzde
from olcum42.olcum where kume = 'hedef'
group by 2
order by 2;


-- ============================================================================
-- BÖLÜM 5 — KOVA C'nin YÜZEY BİÇİMİ. Burada taklit YOK, düz regex — yani
-- BÖLÜM 2 kontrolünden bağımsız olarak güvenilir.
-- Ayraçlar `index.ts`:206-210 (BLOCK_RESET_RE / ARROW_RE / DASH_RE / DEN_RE).
-- ⚠️ Sınıflar örtüşür (bir satır hem ok hem çok satırlı olabilir); toplamları
--    kova C'ye eşit ÇIKMAZ, çıkmasını da beklemiyoruz.
-- ============================================================================
select 'BÖLÜM 5 — kova C yüzey biçimi' as bolum,
       count(*)                                                         as kova_c,
       count(*) filter (where raw_text ~ '➡|->|→|⇒|⟶|—>|➜|➔')           as ok_var,
       count(*) filter (where raw_text ~ '[[:space:]][-–—~][[:space:]]') as bosluklu_tire,
       count(*) filter (where raw_text ~ '[[:alpha:]][-–—][[:alpha:]]')  as bosluksuz_tire,
       count(*) filter (where raw_text ~* '[[:alpha:]]{3}[''’]?(dan|den|tan|ten)[[:space:]]')
                                                                         as den_dan,
       count(*) filter (where raw_text like '%' || chr(10) || '%')       as cok_satirli,
       count(*) filter (where raw_text ~ '\+')                           as arti_isareti
from olcum42.olcum where kume = 'hedef' and yer >= 2;

-- Hiçbir ayraç TAŞIMAYAN kova C satırları = "oksuz alt alta" sınıfının boyutu.
-- 4 Ağu'da gözle görülen ilk sınıf buydu; sayısı burada.
select 'BÖLÜM 5b — ayraçsız kova C' as bolum,
       count(*)                                                    as ayracsiz,
       count(*) filter (where raw_text like '%' || chr(10) || '%') as cok_satirli_olan
from olcum42.olcum
where kume = 'hedef' and yer >= 2
  and raw_text !~ '➡|->|→|⇒|⟶|—>|➜|➔'
  and raw_text !~ '[[:space:]][-–—~][[:space:]]'
  and raw_text !~ '[[:alpha:]][-–—][[:alpha:]]';


-- ============================================================================
-- BÖLÜM 6 — ÖRNEK METİNLER. Sayılar "ne kadar", bunlar "ne cinsten" sorusunu
-- cevaplar; ikisi olmadan hangi formatın destekleneceğine karar verilemez.
-- 🔒 `contact_phone` / `sender_name` BİLEREK seçilmiyor — ölçüm için gereksiz.
-- ============================================================================
select 'BÖLÜM 6 — kova C örnekleri' as bolum,
       yer,
       replace(left(raw_text, 260), chr(10), ' ⏎ ') as metin
from olcum42.olcum where kume = 'hedef' and yer >= 2
order by random() limit 40;

select 'BÖLÜM 6b — kova B (tek yer) örnekleri' as bolum,
       replace(left(raw_text, 200), chr(10), ' ⏎ ') as metin
from olcum42.olcum where kume = 'hedef' and yer = 1
order by random() limit 15;

select 'BÖLÜM 6c — kova A (sıfır yer) örnekleri' as bolum,
       replace(left(raw_text, 160), chr(10), ' ⏎ ') as metin
from olcum42.olcum where kume = 'hedef' and yer = 0
order by random() limit 15;


-- ============================================================================
-- BÖLÜM 7 — 🐛 AYRI BİR BULGU: ÇOK KELİMELİ ALIAS + EK = HİÇ TUTMUYOR.
--
-- Bu ölçüm yazılırken, taklit katmanı gerçek `findPlaces` ile karşılaştırılırken
-- ÇIKTI (kod okuyarak değil, çalıştırarak). `findPlaces` unigram'da ÜÇ form
-- deniyor — ham, tek-soy, tam-soy (index.ts:335) — ama bigram'da YALNIZ İKİ:
-- ham ve tam-soy (index.ts:321). `stripSuffixOnce` bigram'a hiç uygulanmıyor.
--
-- Sonuç, `kdz ereğli` alias'ı üzerinde ölçüldü (hedef anahtar `kdz eregli`):
--   "kdz ereğli den"  → ham      = "kdz eregli"    ✅ tutuyor
--   "kdz ereğliden"   → ham      = "kdz eregliden" ❌
--                       tam-soy  = "kdz eregl"     ❌  (bir harf fazla soyuyor)
--                       tek-soy  = "kdz eregli"    ✅  ama HİÇ DENENMİYOR
--   "kdz ereğliye" · "kdz ereğlide" · "yeni mahalleden" → aynı şekilde ❌
--
-- Yani çok kelimeli alias'lar YALNIZ ek almadan yazıldığında tutuyor. Türkçede
-- bitişik ek normal yazım olduğu için bu, sessiz ve sistematik bir kayıp.
-- ⚠️ #45'te onarılan "gerçek kayıp" alias'ların yarısı çok kelimeli:
--    `kdz ereğli` · `yeni mahalle` · `ş.kochisar`. Onarım onları DB'de düzeltti;
--    bu bug ise onları METİNDE bulunamaz bırakıyor — ikisi ayrı katman.
--
-- Düzeltme tek satır ve mevcut unigram'la simetri kuruyor (index.ts:322):
--    const bigram3 = stripSuffixOnce(tokens[i]) + ' ' + stripSuffixOnce(tokens[i+1])
--    for (const bg of [bigram, bigram2, bigram3]) { ... }
-- AMA önce büyüklüğü ölçülmeli — aşağısı tam olarak onu yapıyor.
-- ============================================================================
create table olcum42.aday_bg_teksoy as
select a.id, fa.f_tek || ' ' || fb.f_tek as g
from olcum42.tok a join olcum42.tok b on b.id = a.id and b.ord = a.ord + 1
join olcum42.tok_form fa on fa.tok = a.tok
join olcum42.tok_form fb on fb.tok = b.tok;

create index on olcum42.aday_bg_teksoy (g);
analyze olcum42.aday_bg_teksoy;

-- 7a — Kaç tane çok kelimeli aktif şehir alias'ı var? (Bug'ın etki yüzeyi.)
select 'BÖLÜM 7a — çok kelimeli alias sayısı' as bolum,
       count(*)                                          as toplam_aktif_city,
       count(*) filter (where key_alias like '% %')      as cok_kelimeli
from olcum42.alias_city;

-- 7b — Bigram tek-soy eklenirse KAÇ `no_lane` satırı YENİ bir şehir kazanır?
-- 👉 Asıl sayı bu. `kova_c_ye_gecen` = bugün şerit kuramayan ama düzeltmeden
--    sonra iki uca sahip olacak satırlar; yani tek satırlık düzeltmenin getirisi.
with yeni as (
  select z.id, ac.key_norm
  from olcum42.aday_bg_teksoy z
  join olcum42.alias_city ac on ac.key_alias = z.g
  where not exists (
    select 1 from olcum42.bulunan b where b.id = z.id and b.key_norm = ac.key_norm
  )
),
artan as (
  select o.id, o.yer as eski, o.yer + count(distinct y.key_norm) as yeni_yer
  from olcum42.olcum o join yeni y on y.id = o.id
  where o.kume = 'hedef'
  group by o.id, o.yer
)
select 'BÖLÜM 7b — bigram tek-soy getirisi' as bolum,
       count(*)                                            as etkilenen_satir,
       count(*) filter (where eski < 2 and yeni_yer >= 2)  as kova_c_ye_gecen,
       count(*) filter (where eski >= 2)                   as zaten_kova_c
from artan;

-- 7c — Hangi alias'lar kaçırılıyor? (Düzeltmenin testini bunlardan yazacağız.)
select 'BÖLÜM 7c — kaçırılan çok kelimeli alias' as bolum,
       ac.key_alias                                as alias_anahtari,
       count(distinct z.id)                        as satir
from olcum42.aday_bg_teksoy z
join olcum42.alias_city ac on ac.key_alias = z.g
join olcum42.olcum o on o.id = z.id and o.kume = 'hedef'
where ac.key_alias like '% %'
  and not exists (select 1 from olcum42.bulunan b where b.id = z.id and b.key_norm = ac.key_norm)
group by ac.key_alias
order by satir desc
limit 25;


-- ============================================================================
-- BÖLÜM 8 — TEMİZLİK
-- Sonuçları yapıştırdıktan SONRA aşağıdaki satırı ayrı çalıştır. Şema tekrar
-- çalıştırmada zaten baştan düşüyor, yani unutursan da kirlilik birikmez —
-- ama `public` dışında duran bir şema bırakmamak temiz olan.
-- ============================================================================
-- drop schema if exists olcum42 cascade;
