-- =============================================================================
-- ADIM 3/4/6 ÖN KONTROLÜ — "önce ölç, sonra çalıştır"  (#31)
-- 4 Ağustos 2026
-- =============================================================================
-- NEDEN BU DOSYA VAR:
--   `20260728_alias_kopya_temizligi.sql` 28 Tem'de yazıldı ve içindeki id
--   listeleri O GÜNÜN fotoğrafı. Aradan bir hafta geçti; bu sürede
--   `learn-aliases` yeni alias'lar öğretti, moderatör elle düzeltmeler yaptı,
--   üstelik Adım 1/2/5'in çalıştırılıp çalıştırılmadığı HİÇBİR YERDE YAZILI DEĞİL
--   (`docs/W5_DEVIR.md`:96 bunu açıkça itiraf ediyor).
--
--   🚨 Donmuş bir id listesini kör çalıştırmak bu projede DÖRT KEZ ısırdı:
--      `destination_city` (kolon hiç yoktu), `get_nearby_..._parked_driver`
--      (fonksiyon hiç deploy edilmemişti), `processed_at` (kolonu hiçbir şey
--      yazmıyordu), `_aksiyonlar_props.txt` (güvenlik düzeltmesi ÖNCESİNİ
--      donduruyordu). Hepsinin ortak yanı: kaydı kimse doğrulamıyordu.
--
--   Buradaki risk somut: BÖLÜM 3'ün `VALUES` listesi bir **id → ilçe** haritası.
--   Bir id bugün BAŞKA bir alias'ı gösteriyorsa UPDATE sessizce YANLIŞ ilçe yazar
--   ve hata alias tablosunda değil, aylar sonra ilan verisinde görünür.
--
-- BU DOSYA HİÇBİR ŞEY DEĞİŞTİRMEZ. Yalnız SELECT. Çıktıyı olduğu gibi yapıştır.
-- =============================================================================


-- =============================================================================
-- 0. TRIGGER/İNDEKS VAR MI?  (Adım 10 çalıştırıldıysa UPDATE davranışı DEĞİŞİR)
-- =============================================================================
-- `20260729_alias_normalize_trigger.sql` bir BEFORE INSERT/UPDATE trigger'ı ve
-- katlanmış UNIQUE indeks kuruyor. Kuruluysa: (a) yazdığımız değer trigger'dan
-- geçer, (b) BÖLÜM 3'ün 92 satırlık UPDATE'i UNIQUE ihlaliyle PATLAYABİLİR.
-- Yani bu sorgu diğer her şeyden önce çalışmalı.
select 'trigger' as ne, tgname as ad, pg_get_triggerdef(t.oid) as tanim
from pg_trigger t
where t.tgrelid = 'public.aliases'::regclass and not t.tgisinternal
union all
select 'index', indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'aliases'
order by 1, 2;


-- =============================================================================
-- 1. ADIM 1 (homonim) ÇALIŞTIRILDI MI?
-- =============================================================================
-- Beklenen (çalıştırıldıysa): üçü de is_active = false.
select id, alias, normalized, district, is_active
from public.aliases
where lower(alias) in ('araç', 'arac', 'olur')
order by alias, id;


-- =============================================================================
-- 2. ADIM 2 (normalized ASCII) ÇALIŞTIRILDI MI?
-- =============================================================================
-- Beklenen (çalıştırıldıysa): 0 satır.
select normalized, count(*) as adet, min(id) as ilk_id, max(id) as son_id
from public.aliases
where normalized in ('Istanbul', 'Izmir', 'Mugla', 'Bingol')
group by 1
order by 1;


-- =============================================================================
-- 3. ADIM 3 (district yazımı) — 11 DEĞERİN BUGÜNKÜ HÂLİ
-- =============================================================================
-- Beklenen (HENÜZ çalıştırılmadıysa): 11 farklı `district` değeri, toplam ~11+ satır.
-- 0 satır dönerse adım zaten yapılmış demektir — o zaman ADIM 4'e geç.
-- ⚠️ Sayı 11'den FARKLI çıkarsa dur: aradaki hafta yeni bozuk yazım eklemiş olabilir.
select district, count(*) as satir, array_agg(id order by id) as idler,
       array_agg(alias order by id) as aliaslar
from public.aliases
where district in ('Alaçati','Avcilar','Beylikduzu','Cekmekoy','Eregli','Hadimkoy',
                   'Inegöl','Iscehisar','Iskenderun','Kirkağaç','Ulukisla')
group by 1
order by 1;

-- 3.b 🔎 LİSTE DIŞI BOZUK YAZIM VAR MI? (28 Tem'den sonra eklenmiş olabilir)
-- Kural: `district` içinde Türkçe karakter hiç yok AMA katlanmış eşi Türkçe
-- karakterli başka bir değerle çakışıyor → yani "ASCII'ye inmiş ikiz".
-- Beklenen: yalnız yukarıdaki 11'i döndürmeli. FAZLASI varsa CASE listesi eksik.
with k as (
  select district,
         translate(district, 'ıçğöşüİĞÜŞÖÇ', 'icgosuIGUSOC') as katlanmis
  from public.aliases
  where district is not null and is_active = true
  group by 1, 2
)
select katlanmis, array_agg(district order by district) as yazimlar
from k
group by 1
having count(*) > 1
order by 1;


-- =============================================================================
-- 4. ADIM 4 (92 NULL district) — 🚨 ASIL RİSKLİ SORGU
-- =============================================================================
-- Script'in `VALUES` listesi bir id → ilçe haritası. Aşağıdaki sorgu o haritayı
-- CANLI tabloyla karşılaştırıyor. Script'in yorum satırlarındaki alias metnini de
-- taşıdım — id'nin hâlâ AYNI alias'ı gösterdiğini ancak bu doğrular.
--
-- `durum` kolonunun okunuşu:
--   ✅ UYGULANABILIR   → alias eşleşiyor, district hâlâ NULL. Beklenen hâl.
--   ⏭️ ZATEN_DOLU      → biri (script ya da moderatör) doldurmuş.
--        ⤷ `simdiki_district` beklenenle AYNI ise adım zaten yapılmış.
--        ⤷ FARKLI ise 🚨 elle karar: hangisi doğru?
--   🚨 ALIAS_DEGISMIS  → id başka bir alias'ta. UPDATE bu satıra YANLIŞ ilçe yazar.
--   🚨 SATIR_YOK       → id silinmiş. UPDATE sessizce 0 satır günceller.
with beklenen(id, d, alias_28tem) as (values
  (49, 'İzmit', 'izmıt'),
  (978, 'Hadımköy', 'Hadımköy'),
  (982, 'Şile', 'Şile'),
  (983, 'Beylikdüzü', 'Beylikdüzü'),
  (990, 'Yatağan', 'Yatağan'),
  (991, 'Bodrum', 'Bodrum'),
  (992, 'Milas', 'Milas'),
  (993, 'Marmaris', 'Marmaris'),
  (994, 'Fethiye', 'Fethiye'),
  (995, 'Söke', 'Söke'),
  (996, 'Çine', 'Çine'),
  (998, 'Karacasu', 'Karacasu'),
  (999, 'Buharkent', 'Buharkent'),
  (1001, 'Söğüt', 'Söğüt'),
  (1002, 'Pazaryeri', 'Pazaryeri'),
  (1006, 'Bergama', 'Bergama'),
  (1007, 'Hendek', 'Hendek'),
  (1008, 'Sarayönü', 'Sarayönü'),
  (1009, 'Kartepe', 'Kartepe'),
  (1010, 'Malkara', 'Malkara'),
  (1011, 'Ergene', 'Ergene'),
  (1016, 'Biga', 'Biga'),
  (1017, 'Hayrabolu', 'Hayrabolu'),
  (1018, 'Arnavutköy', 'Arnavutköy'),
  (1019, 'Çayırova', 'Çayırova'),
  (1020, 'Tuzla', 'Tuzla'),
  (1022, 'Torbalı', 'Torbali'),
  (1025, 'Bafra', 'Bafra'),
  (1026, 'Ezine', 'Ezine'),
  (1027, 'Beypazarı', 'Beypazarı'),
  (1028, 'Ceyhan', 'Ceyhan'),
  (1029, 'Sincan', 'Sincan'),
  (1031, 'Tepebaşı', 'Tepebaşı'),
  (1033, 'Soma', 'Soma'),
  (1034, 'Kırıkhan', 'Kırıkhan'),
  (1035, 'Göynük', 'Göynük'),
  (1036, 'Dilovası', 'Dilovası'),
  (1037, 'Aliağa', 'Aliağa'),
  (1038, 'Aliağa', 'Aliaga'),
  (1039, 'Kızıltepe', 'Kızıltepe'),
  (1041, 'Zeytinburnu', 'Zeytinburnu'),
  (1042, 'Karacabey', 'Karacabey'),
  (1043, 'Muratlı', 'Muratli'),
  (1046, 'Bornova', 'Bornova'),
  (1049, 'Körfez', 'Körfez'),
  (1081, 'Lüleburgaz', 'Lüleburgaz'),
  (1082, 'Lüleburgaz', 'Luleburgaz'),
  (1090, 'Esenyurt', 'Esenyurt'),
  (1091, 'Bayrampaşa', 'Bayrampaşa'),
  (1094, 'Mustafakemalpaşa', 'Mustafakemalpaşa'),
  (1097, 'Akşehir', 'Akşehir'),
  (1098, 'Akşehir', 'Aksehir'),
  (1099, 'Simav', 'Simav'),
  (1100, 'Gebze', 'Gebze'),
  (1101, 'Manavgat', 'Manavgat'),
  (1102, 'Alanya', 'Alanya'),
  (1103, 'Doğubayazıt', 'Doğubayazıt'),
  (1104, 'Doğubayazıt', 'Doğubeyazıt'),
  (1105, 'Doğubayazıt', 'Dogubayazit'),
  (1106, 'Çifteler', 'Çifteler'),
  (1114, 'Çiğli', 'Çiğli'),
  (1116, 'Eyüpsultan', 'Eyüp'),
  (1117, 'Avcılar', 'Avcılar'),
  (1118, 'Gönen', 'Gönen'),
  (1122, 'Çerkezköy', 'Çerkezköy'),
  (1123, 'Çorlu', 'Çorlu'),
  (1124, 'Salihli', 'Salihli'),
  (1125, 'Bozüyük', 'Bozüyük'),
  (1128, 'Ataşehir', 'Ataşehir'),
  (1129, 'Kadıköy', 'Kadıköy'),
  (1132, 'Nurdağı', 'Nurdağı'),
  (1133, 'Sarıçam', 'Sariçam'),
  (1134, 'Kuşadası', 'Kuşadası'),
  (1136, 'Elbistan', 'Elbistan'),
  (1160, 'Ayancık', 'ayancık'),
  (1163, 'Çubuk', 'çubuk'),
  (1167, 'Bozüyük', 'bozüyük'),
  (1168, 'Ilgın', 'ilgın'),
  (1171, 'Elmadağ', 'elmadağ'),
  (1197, 'Emirdağ', 'emirdag'),
  (1203, 'Vakfıkebir', 'vakfikebir'),
  (1206, 'Reyhanlı', 'reyhanli'),
  (1208, 'Karkamış', 'karkamış'),
  (1212, 'Alaşehir', 'alaşehir'),
  (1215, 'Darıca', 'darıca'),
  (1225, 'Şereflikoçhisar', 'şereflikoçhisar'),
  (1234, 'Orhangazi', 'orhangazı'),
  (1240, 'Üsküdar', 'üsküdar'),
  (1247, 'Başiskele', 'başiskele'),
  (1253, 'Söğüt', 'söğüt'),
  (1255, 'Seydişehir', 'seydişehir'),
  (1284, 'Söke', 'söke')
)
select b.id, b.alias_28tem, b.d as beklenen_district,
       a.alias as simdiki_alias, a.normalized, a.district as simdiki_district,
       a.is_active,
       case
         when a.id is null                       then '🚨 SATIR_YOK'
         when a.alias is distinct from b.alias_28tem then '🚨 ALIAS_DEGISMIS'
         when a.district is null                 then '✅ UYGULANABILIR'
         when a.district = b.d                   then '⏭️ ZATEN_DOLU_AYNI'
         else                                         '🚨 ZATEN_DOLU_FARKLI'
       end as durum
from beklenen b
left join public.aliases a on a.id = b.id
-- ⚠️ Beklenen hâli (alias aynı + district hâlâ NULL) LİSTELEMİYOR — sayısı 4.b'de.
--    Burada yalnız dikkat isteyen satırlar var. BOŞ dönerse 92'nin hepsi temiz.
where a.id is null
   or a.alias is distinct from b.alias_28tem
   or a.district is not null
order by durum, b.id;

-- 4.b Özet sayım — önce buna bak, detay yukarıda.
-- Beklenen (hiç çalıştırılmadıysa): UYGULANABILIR 92, diğerleri 0.
with beklenen(id, d, alias_28tem) as (values
  (49, 'İzmit', 'izmıt'),
  (978, 'Hadımköy', 'Hadımköy'),
  (982, 'Şile', 'Şile'),
  (983, 'Beylikdüzü', 'Beylikdüzü'),
  (990, 'Yatağan', 'Yatağan'),
  (991, 'Bodrum', 'Bodrum'),
  (992, 'Milas', 'Milas'),
  (993, 'Marmaris', 'Marmaris'),
  (994, 'Fethiye', 'Fethiye'),
  (995, 'Söke', 'Söke'),
  (996, 'Çine', 'Çine'),
  (998, 'Karacasu', 'Karacasu'),
  (999, 'Buharkent', 'Buharkent'),
  (1001, 'Söğüt', 'Söğüt'),
  (1002, 'Pazaryeri', 'Pazaryeri'),
  (1006, 'Bergama', 'Bergama'),
  (1007, 'Hendek', 'Hendek'),
  (1008, 'Sarayönü', 'Sarayönü'),
  (1009, 'Kartepe', 'Kartepe'),
  (1010, 'Malkara', 'Malkara'),
  (1011, 'Ergene', 'Ergene'),
  (1016, 'Biga', 'Biga'),
  (1017, 'Hayrabolu', 'Hayrabolu'),
  (1018, 'Arnavutköy', 'Arnavutköy'),
  (1019, 'Çayırova', 'Çayırova'),
  (1020, 'Tuzla', 'Tuzla'),
  (1022, 'Torbalı', 'Torbali'),
  (1025, 'Bafra', 'Bafra'),
  (1026, 'Ezine', 'Ezine'),
  (1027, 'Beypazarı', 'Beypazarı'),
  (1028, 'Ceyhan', 'Ceyhan'),
  (1029, 'Sincan', 'Sincan'),
  (1031, 'Tepebaşı', 'Tepebaşı'),
  (1033, 'Soma', 'Soma'),
  (1034, 'Kırıkhan', 'Kırıkhan'),
  (1035, 'Göynük', 'Göynük'),
  (1036, 'Dilovası', 'Dilovası'),
  (1037, 'Aliağa', 'Aliağa'),
  (1038, 'Aliağa', 'Aliaga'),
  (1039, 'Kızıltepe', 'Kızıltepe'),
  (1041, 'Zeytinburnu', 'Zeytinburnu'),
  (1042, 'Karacabey', 'Karacabey'),
  (1043, 'Muratlı', 'Muratli'),
  (1046, 'Bornova', 'Bornova'),
  (1049, 'Körfez', 'Körfez'),
  (1081, 'Lüleburgaz', 'Lüleburgaz'),
  (1082, 'Lüleburgaz', 'Luleburgaz'),
  (1090, 'Esenyurt', 'Esenyurt'),
  (1091, 'Bayrampaşa', 'Bayrampaşa'),
  (1094, 'Mustafakemalpaşa', 'Mustafakemalpaşa'),
  (1097, 'Akşehir', 'Akşehir'),
  (1098, 'Akşehir', 'Aksehir'),
  (1099, 'Simav', 'Simav'),
  (1100, 'Gebze', 'Gebze'),
  (1101, 'Manavgat', 'Manavgat'),
  (1102, 'Alanya', 'Alanya'),
  (1103, 'Doğubayazıt', 'Doğubayazıt'),
  (1104, 'Doğubayazıt', 'Doğubeyazıt'),
  (1105, 'Doğubayazıt', 'Dogubayazit'),
  (1106, 'Çifteler', 'Çifteler'),
  (1114, 'Çiğli', 'Çiğli'),
  (1116, 'Eyüpsultan', 'Eyüp'),
  (1117, 'Avcılar', 'Avcılar'),
  (1118, 'Gönen', 'Gönen'),
  (1122, 'Çerkezköy', 'Çerkezköy'),
  (1123, 'Çorlu', 'Çorlu'),
  (1124, 'Salihli', 'Salihli'),
  (1125, 'Bozüyük', 'Bozüyük'),
  (1128, 'Ataşehir', 'Ataşehir'),
  (1129, 'Kadıköy', 'Kadıköy'),
  (1132, 'Nurdağı', 'Nurdağı'),
  (1133, 'Sarıçam', 'Sariçam'),
  (1134, 'Kuşadası', 'Kuşadası'),
  (1136, 'Elbistan', 'Elbistan'),
  (1160, 'Ayancık', 'ayancık'),
  (1163, 'Çubuk', 'çubuk'),
  (1167, 'Bozüyük', 'bozüyük'),
  (1168, 'Ilgın', 'ilgın'),
  (1171, 'Elmadağ', 'elmadağ'),
  (1197, 'Emirdağ', 'emirdag'),
  (1203, 'Vakfıkebir', 'vakfikebir'),
  (1206, 'Reyhanlı', 'reyhanli'),
  (1208, 'Karkamış', 'karkamış'),
  (1212, 'Alaşehir', 'alaşehir'),
  (1215, 'Darıca', 'darıca'),
  (1225, 'Şereflikoçhisar', 'şereflikoçhisar'),
  (1234, 'Orhangazi', 'orhangazı'),
  (1240, 'Üsküdar', 'üsküdar'),
  (1247, 'Başiskele', 'başiskele'),
  (1253, 'Söğüt', 'söğüt'),
  (1255, 'Seydişehir', 'seydişehir'),
  (1284, 'Söke', 'söke')
)
select case
         when a.id is null                       then '🚨 SATIR_YOK'
         when a.alias is distinct from b.alias_28tem then '🚨 ALIAS_DEGISMIS'
         when a.district is null                 then '✅ UYGULANABILIR'
         when a.district = b.d                   then '⏭️ ZATEN_DOLU_AYNI'
         else                                         '🚨 ZATEN_DOLU_FARKLI'
       end as durum,
       count(*) as adet
from beklenen b
left join public.aliases a on a.id = b.id
group by 1
order by 2 desc;


-- =============================================================================
-- 5. ADIM 5 (payas) ÇALIŞTIRILDI MI?
-- =============================================================================
-- Beklenen (çalıştırıldıysa): id=1003 → normalized 'Hatay', district 'Payas'.
select id, alias, normalized, district, is_active
from public.aliases
where id in (1003, 1844) or lower(alias) = 'payas'
order by id;


-- =============================================================================
-- 6. ADIM 6 — elle karar gerektiren 6 grubun BUGÜNKÜ hâli
-- =============================================================================
select id, alias, normalized, district, is_active,
       case id
         when 987  then '4.2 kazan → Kahramankazan'
         when 2752 then '4.2 kazan → Kahramankazan'
         when 2249 then '4.3 ömerli → Çekmeköy'
         when 2678 then '4.4 kıraç → Esenyurt'
         when 988  then '4.5 gölbaşı Ankara (BIRAK)'
         when 1316 then '4.5 gölbaşı Adıyaman (PASİFLEŞTİR)'
         when 1021 then '4.6 kemalpaşa İzmir (BIRAK) 🔴'
         when 1441 then '4.6 kemalpaşa Artvin (PASİFLEŞTİR) 🔴'
       end as karar
from public.aliases
where id in (987, 2752, 2249, 2678, 988, 1316, 1021, 1441)
order by id;

-- 6.b 🔴 KEMALPAŞA — Adım 8'i bloke eden koşul
-- Adım 8'in sözlüğü `having count(distinct normalized) = 1` ile korunuyor.
-- `kemalpasa` anahtarında iki FARKLI `normalized` aktif kalırsa o anahtar
-- sözlüğe hiç girmez ve `listings`teki 28 satır ONARILMAZ.
-- Beklenen: `farkli_normalized = 1`. 2 ise 4.6 zorunlu ve `normalized`
-- kolonuna DOKUNULMAMALI — ayrışma `district`te olmalı.
select translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') as katlanmis_alias,
       count(*) filter (where is_active) as aktif_satir,
       count(distinct normalized) filter (where is_active) as farkli_normalized,
       array_agg(distinct normalized) filter (where is_active) as normalized_degerleri,
       array_agg(distinct coalesce(district,'∅')) filter (where is_active) as district_degerleri
from public.aliases
where translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') = 'kemalpasa'
group by 1;

-- 6.c `listings` tarafında kemalpaşa izi hâlâ 28 satır mı?
-- (Adım 0.3'te 28'di: KEMALPAŞA 17 + Kemalpaşa 11)
select 'listings.origin_district' as kolon, origin_district as deger, count(*) as adet
from public.listings
where translate(lower(replace(origin_district,'İ','i')),'ıçğöşü','icgosu') = 'kemalpasa'
group by 1, 2
union all
select 'listing_stops.district', district, count(*)
from public.listing_stops
where translate(lower(replace(district,'İ','i')),'ıçğöşü','icgosu') = 'kemalpasa'
group by 1, 2
order by 1, 3 desc;


-- =============================================================================
-- 7. ADIM 7 doğrulama sorguları — ŞU ANKİ taban
-- =============================================================================
-- Bunlar temizlik BİTTİĞİNDE boş dönmeli. Şimdi çalıştırmanın amacı farklı:
-- "kaç kaldı" sayısını ÖNCEDEN bilmek, ki sonra düşüşü ölçebilelim.
select translate(lower(replace(alias, 'İ', 'i')), 'ıçğöşü', 'icgosu') as norm_alias,
       array_agg(distinct normalized)              as n,
       array_agg(distinct coalesce(district, '∅')) as d
from public.aliases
where type = 'city' and is_active = true
group by 1
having count(distinct normalized) > 1
    or count(distinct coalesce(district, '∅')) > 1
order by 1;


-- =============================================================================
-- SONUÇ KAYDI — 4 Ağustos 2026, çalıştırıldı
-- =============================================================================
--   0.  Trigger/indeks   → [x] 5 indeks, **0 TRIGGER**. ⚠️ Aşağıya bak.
--   1.  Adım 1 homonim   → [x] araç/arac/olur üçü de is_active=false = YAPILMIŞ
--   2.  Adım 2 normalized→ [x] 0 satır = YAPILMIŞ
--   3.  Adım 3 district  → [x] 0 satır = YAPILMIŞ
--   3.b Liste dışı bozuk → [x] 0 satır = bir hafta içinde yeni bozulma OLMAMIŞ
--   4.  Adım 4 92 satır  → [x] 92/92 `⏭️ ZATEN_DOLU_AYNI`. **SIFIR kayma.**
--   5.  Adım 5 payas     → [x] id 1003 → Hatay/Payas aktif, 1844 pasif = YAPILMIŞ
--   6.  Adım 6 kararlar  → [x] beşinin de kararı uygulanmış (Kahramankazan ×2,
--                              Çekmeköy, Esenyurt, Adıyaman pasif, Artvin pasif)
--   6.b kemalpaşa engeli → [x] aktif satır 1, farklı normalized 1 → **Adım 8 AÇIK**
--   6.c listings izi     → [x] 28 değil **54**: stops `Kemalpaşa` 36 + `KEMALPAŞA` 17,
--                              listings.origin_district `Kemalpaşa` 1
--   7.  Adım 7 tabanı    → [x] 0 satır = temiz
--
-- =============================================================================
-- 🟢 HÜKÜM: RUNBOOK ADIM 1–7 VE 9 ZATEN TAMAMLANMIŞ. #31 fiilen bitmiş bir işti.
-- =============================================================================
-- Adım 9'un ayrı kanıtı yok ama gerekmiyor: `aliases_katlanmis_anahtar_uniq`
-- indeksi CANLI. Katlanmış kopya kalsaydı bu indeks 23505 ile kurulamazdı.
-- Yani indeksin varlığı Adım 9'un yapıldığının kanıtı.
--
-- 🔁 **KALIBIN BEŞİNCİ ÖRNEĞİ — ama TERS YÖNDE.**
--    Önceki dördü ("kayıt var diyordu, gerçekte yoktu"): `destination_city`,
--    `get_nearby_..._parked_driver`, `processed_at`, `_aksiyonlar_props.txt`.
--    Bu sefer tersi: **kayıt "yapılmadı" diyordu, gerçekte yapılmıştı.**
--    Kök aynı — kaydı kimse doğrulamıyordu. Bedeli farklı: yanlış bir eylem
--    değil, **hayalet bir engel**. #31 bir haftadır "Dalga 5'ten önce bitmeli"
--    diye listede duruyordu ve aslında yolu kimse kapatmıyordu.
--    ⚠️ Ders: "yapıldı mı?" sorusunun cevabı **görev listesinde değil, veride**.
--
-- =============================================================================
-- 🚨 ASIL BULGU — ADIM 10 YARIM UYGULANMIŞ
-- =============================================================================
-- `docs/20260729_alias_normalize_trigger.sql` iki bölüm:
--   BÖLÜM 1 → `aliases_normalize()` fonksiyonu + `aliases_normalize_trg` trigger
--   BÖLÜM 2 → `aliases_katlanmis_anahtar_uniq` kısmi UNIQUE indeks
-- Canlıda **BÖLÜM 2 var, BÖLÜM 1 YOK** (`pg_trigger` 0 satır döndü).
--
-- Ne korunuyor, ne korunmuyor:
--   ✅ TEKİLLİK korunuyor — indeks duruyor, katlanmış kopya 23505 ile reddedilir.
--      D3'ün asıl amacı buydu ve tutuyor.
--   ❌ NORMALİZASYON korunmuyor — alias'ı küçük harfe indirme, `\s+` sıkıştırma,
--      `''` → NULL çevirme yalnız uygulama tarafında: `lib/alias-normalize.ts`,
--      tek çağıranı `app/api/admin/learn-aliases/route.ts`.
--      → O route'tan GEÇMEYEN her yazma (SQL konsolu, ileride yazılacak başka
--        bir route, moderatör paneli) ham değeri yazar. `W5_DEVIR.md`:79 zaten
--        "manuel `create` alias'ı lowercase YAPMIYOR" diyordu.
--   ⚠️ Trigger olmadığı için indeks bir GÜVENLİK AĞI değil, bir MAYIN: normalize
--      edilmemiş yazma sessizce düzelmez, 23505 ile patlar. Gürültülü hata
--      sessiz bozulmadan iyidir — ama bu tasarlanmış bir tercih değil, kaza.
--
-- ❓ Açık soru: fonksiyon var mı, yoksa BÖLÜM 1 hiç mi çalışmadı? Tek sorgu:
--      select proname from pg_proc where proname = 'aliases_normalize';
--    Fonksiyon VARSA trigger sonradan düşürülmüş demektir (neden?);
--    YOKSA BÖLÜM 1 hiç çalıştırılmamış.
--
-- =============================================================================
-- 📌 KALAN GERÇEK İŞ (bu dosya kapandıktan sonra)
-- =============================================================================
--   • Adım 10 / BÖLÜM 1 → trigger'ı kur (ya da bilinçli atlandığını yaz).
--   • Adım 8.2 → `listing_stops.district` = 'KEMALPAŞA' 17 satır sözlük yazımına
--     çekilecek. NOT: `Kemalpaşa` 11 → 36'ya çıkmış, `KEMALPAŞA` 17'de sabit
--     kalmış. Yani **yeni trafik doğru yazımı yazıyor**; 17 satır eski kalıntı.
--     Alias düzeltmesinin işe yaradığının ölçülmüş kanıtı bu.
--   • Adım 8.1/8.4 (şehir metin kolonları) → Dalga 5'te düşecek kolonlar,
--     bilinçli olarak atlanıyor.

-- =============================================================================
-- 🔬 EK ÖLÇÜM — 4 AĞU: TRIGGER KURULUMU GÜVENLİ Mİ? (3 sorgu, sonuçlar geldi)
-- =============================================================================
-- Fonksiyon sorgusu: `select proname from pg_proc where proname='aliases_normalize'`
--   → **`aliases_normalize` DÖNDÜ.** Yani BÖLÜM 1'in fonksiyon kısmı çalışmış,
--     DROP/CREATE TRIGGER kısmı çalışmamış. En olası sebep kopyala-yapıştır
--     sınırı: fonksiyon gövdesi :104'te bitiyor, :106-111 yorum bloğu geliyor,
--     DROP/CREATE TRIGGER :113 ve :115'te. Seçim yorumda kesilmiş.
--     → Trigger sonradan düşürülmedi; hiç kurulmadı. Gizli bir sebep yok.
--
-- Q1  select lower('İSTANBUL'), length(lower('İSTANBUL')), lower('İSTANBUL')='istanbul'
--   → `i̇stanbul` / **9** / **false**
--   ✅ Postgres `lower()` = JS `.toLowerCase()`. İkisi de `i`+U+0307 üretir.
--      Yani trigger, `normalizeAliasFields` ile AYNI sonucu verir — aralarında
--      ayrışma yok. Ama ikisi birden `aliasKey()` ve indeks ifadesinden ayrışır.
--
-- Q2  trigger'in yeniden yazacagi aktif satirlar → **BOŞ DEĞİL, ~100 satır.**
-- Q3  katlanmis anahtar cakismasi → **0 satır.** Kurulum 23505 riski taşımıyor.
--
-- -----------------------------------------------------------------------------
-- 🚨 BULGU A — `normalizeAliasFields` ile `aliasKey` AYRIŞIYOR (canlı hata)
-- -----------------------------------------------------------------------------
--   lib/alias-normalize.ts:38  aliasKey             → replace(İ→i) ÖNCE, sonra toLowerCase()
--   lib/alias-normalize.ts:82  normalizeAliasFields → sadece toLowerCase()   ← İ dönüşümü YOK
--
--   Aynı dosyanın :30-35 yorumu bu sırayı "birini değiştiren diğerini de
--   değiştirmek zorunda" diye yazıyor — ve :82 o kurala uymuyor.
--
--   Sonuç zinciri (alias'ta İ varsa, ör. "İkitelli"):
--     1. learn-aliases yazar → DB'de i+U+0307 ile 9 karakter
--     2. indeks anahtari = translate(lower(replace(alias,'İ','i')),…):
--        alias'ta artik büyük İ yok, lower no-op, U+0307 duruyor → 9 karakter
--        ama uygulamanin cakisma kontrolü aliasKey() → 8 karakter
--        → **uygulama "cakisma yok" der, DB farkli anahtar görür**
--     3. eslesme tarafi: trNorm (parse-listing:118-130) [^a-z0-9\s] → ' '
--        U+0307'yi BOŞLUĞA çevirir → "i kitelli"
--        mesaj metni "ikitelli" → "ikitelli"  → **HİÇBİR ZAMAN TUTMAZ**
--     ⇒ İ içeren her yeni alias sessizce ÖLÜ KAYIT.
--
--   Düzeltme: :82 → trTemizle(String(girdi.alias)).replace(/İ/g,'i').toLowerCase()
--   Trigger kurulacaksa `lower(NEW.alias)` degil `lower(replace(NEW.alias,'İ','i'))`.
--
--   Mevcut ölü kayit var mi? Tek sorgu:
--     select id, alias, length(alias), type, is_active from public.aliases
--     where alias like '%' || U&'\0307' || '%';
--
-- -----------------------------------------------------------------------------
-- 🚨 BULGU B — alias'i LOWERCASE'E İNDİRME GEREKÇESİ YANLIŞ
-- -----------------------------------------------------------------------------
--   İddia (lib/alias-normalize.ts:80-81 ve 20260729_alias_normalize_trigger.sql:64-66):
--     "eslesme tarafi trNorm'lanmis metinle karsilastiriyor, büyük harfli alias
--      hiç tutmaz → sessizce ölü kayit olur"
--   Ölçüm:
--     parse-listing/index.ts:323  cityAliases.find(a => trNorm(a.alias) === bg)
--     parse-listing/index.ts:337  cityAliases.find(a => trNorm(a.alias) === cand)
--     whatsapp-parse/route.ts:224 aliasAnahtari → trNorm(alias)…
--     whatsapp-parse/route.ts:232 dizin.blacklist.push(trNorm(a.alias))
--   → Alias, OKUMA ANINDA katlaniyor. Büyük harfli alias PEKÂLÂ tutuyor.
--   ⇒ Q2'deki ~100 satir (Söke, Bergama, Kemalpasa, TIR Açik, DANPERLİ…) ölü
--     kayit DEĞİL, bugün çalisan kayitlar. Trigger'in alias-lowercase kismi
--     var olmayan bir sorunu çözüp 100 satiri bedavaya yeniden yazacakti.
--   ⚠️ Bu iddia iki ayri dosyada yaziliydi ve hiç ölçülmemisti — kalibin
--      ALTINCI örnegi.
--
-- -----------------------------------------------------------------------------
-- ⚠️ BULGU C — id 1023 Torbалı KİRİL HOMOGLİF
-- -----------------------------------------------------------------------------
--   `а` (U+0430) ve `л` (U+043B) Kiril. Bu alias hiçbir Türkçe metinle
--   eslesemez — trNorm [^a-z0-9\s] ile ikisini de bosluga çevirir.
--   Ölü kayit. Baska homoglif var mi:
--     select id, alias, type, is_active from public.aliases
--     where alias ~ '[^ -ɏ\s]';
--
-- -----------------------------------------------------------------------------
-- 📌 TRIGGER İÇİN TAVSİYE (karar Bayram'in)
-- -----------------------------------------------------------------------------
--   Dosyadaki hâliyle KURMA. İki degisiklikle kur:
--     1. alias satirindan lower()'i ÇIKAR (Bulgu B) — ya da tutulacaksa
--        lower(replace(NEW.alias,'İ','i')) yap (Bulgu A).
--     2. \s+ sikistirma + district=''→NULL kisimlari degerli, aynen kalsin;
--        asil koruma bunlar (learn-aliases disindan yazma bu ikisini atliyor).
--   Q3 bos oldugu için kurulum 23505 riski tasimiyor; risk yalniz ~100 satirin
--   gereksiz yeniden yazilmasinda.
