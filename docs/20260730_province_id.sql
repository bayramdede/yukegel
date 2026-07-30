-- ============================================================================
-- 20260730_province_id.sql — COĞRAFİ STANDARDİZASYON, DALGA 1 (şema + backfill)
--
-- Bayram: Supabase SQL Editor'de çalıştır. **KODDAN ÖNCE** çalıştırılabilir —
-- bu migration hiçbir mevcut kolonu düşürmez, hiçbir mevcut davranışı bozmaz.
-- Sadece yeni kolonlar ekler ve doldurur. Kod tarafı henüz onları OKUMUYOR.
--
-- 🚦 GEÇİŞ STRATEJİSİ: ÇİFT YAZIM. `origin_city` / `listing_stops.city` metin
-- kolonları YERİNDE KALIR ve yazılmaya devam eder. `province_id` onların yanında
-- birikir. Okuma yolları ID'ye geçip canlıda doğrulandıktan SONRA ayrı bir
-- migration (`2026xxxx_city_metin_drop.sql`) metin kolonlarını düşürür.
-- Sert geçiş bilerek seçilmedi: kod ile DB'nin aynı anda deploy edilmesi gerekirdi
-- ve eşleşmeyen satırlar (bozuk yazım) geri dönülemez biçimde kaybolurdu.
--
-- 🔁 GERİ ALMA: en sondaki blok. Tek işlem `drop column` — veri kaybı yok,
-- çünkü kaynak metin kolonları duruyor.
--
-- 🚨 TEK SEFERDE YAPIŞTIRMA — DÖRT BLOK, SIRAYLA ÇALIŞTIR.
--    Supabase SQL Editor **yalnızca son ifadenin sonucunu** gösterir; hepsini bir
--    kerede çalıştırırsan Adım 5'in ön raporunu ve Adım 8'in doğrulamasını HİÇ
--    GÖRMEZSİN — backfill'in ne yaptığını da bilemezsin.
--      BLOK A → Adım 1-4  (tablo + fonksiyon + kolonlar + GRANT)
--      BLOK B → Adım 5    (ÖN RAPOR — 3 sorgu, TEK TEK çalıştır, çıktıları SAKLA)
--      BLOK C → Adım 6-7  (backfill + indeksler)
--      BLOK D → Adım 8    (doğrulama — 4 sorgu, tek tek)
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK A — şema. Tek başına güvenli, geri alınabilir.                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. public.provinces — 81 il, plaka kodu = birincil anahtar
--
-- ⚠️ İLÇE İÇİN TABLO AÇILMIYOR (spec md.2). İlçeler `lib/constants/locations.json`
-- içinde kalır ve DB'ye METİN olarak yazılır. Sebep: ilçe tablosu her okumaya bir
-- JOIN ekler, karşılığında yalnızca "yazım doğru mu" garantisi verir — onu zaten
-- form tarafındaki Searchable Select veriyor.
--
-- Ama İL için tablo AÇILIYOR. Sebep farklı: `province_id` FK'sız bir integer olsa
-- istemciden gelen 999 ya da -1 sessizce DB'ye girerdi ve okuma tarafında hiçbir
-- yerde patlamazdı — sadece ilan görünmez olurdu. FK bunu yazma anında reddeder.
-- Ayrıca radar/nearby RPC'leri il adını SQL içinde çözebilsin diye lazım.
--
-- 🚨 BU TABLO TÜRETİLMİŞ VERİDİR. Kaynağı `lib/constants/locations.json`.
-- Elle satır ekleme/düzenleme YAPMA — JSON'u değiştir, bu bloğu yeniden üret.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.provinces (
  id    smallint primary key check (id between 1 and 81),
  plate char(2)  not null unique,
  name  text     not null unique
);

comment on table public.provinces is
  'Türetilmiş: lib/constants/locations.json. Elle düzenleme. Kaynak JSON.';

insert into public.provinces (id, plate, name) values
  (1, '01', 'Adana'),
  (2, '02', 'Adıyaman'),
  (3, '03', 'Afyonkarahisar'),
  (4, '04', 'Ağrı'),
  (5, '05', 'Amasya'),
  (6, '06', 'Ankara'),
  (7, '07', 'Antalya'),
  (8, '08', 'Artvin'),
  (9, '09', 'Aydın'),
  (10, '10', 'Balıkesir'),
  (11, '11', 'Bilecik'),
  (12, '12', 'Bingöl'),
  (13, '13', 'Bitlis'),
  (14, '14', 'Bolu'),
  (15, '15', 'Burdur'),
  (16, '16', 'Bursa'),
  (17, '17', 'Çanakkale'),
  (18, '18', 'Çankırı'),
  (19, '19', 'Çorum'),
  (20, '20', 'Denizli'),
  (21, '21', 'Diyarbakır'),
  (22, '22', 'Edirne'),
  (23, '23', 'Elazığ'),
  (24, '24', 'Erzincan'),
  (25, '25', 'Erzurum'),
  (26, '26', 'Eskişehir'),
  (27, '27', 'Gaziantep'),
  (28, '28', 'Giresun'),
  (29, '29', 'Gümüşhane'),
  (30, '30', 'Hakkari'),
  (31, '31', 'Hatay'),
  (32, '32', 'Isparta'),
  (33, '33', 'Mersin'),
  (34, '34', 'İstanbul'),
  (35, '35', 'İzmir'),
  (36, '36', 'Kars'),
  (37, '37', 'Kastamonu'),
  (38, '38', 'Kayseri'),
  (39, '39', 'Kırklareli'),
  (40, '40', 'Kırşehir'),
  (41, '41', 'Kocaeli'),
  (42, '42', 'Konya'),
  (43, '43', 'Kütahya'),
  (44, '44', 'Malatya'),
  (45, '45', 'Manisa'),
  (46, '46', 'Kahramanmaraş'),
  (47, '47', 'Mardin'),
  (48, '48', 'Muğla'),
  (49, '49', 'Muş'),
  (50, '50', 'Nevşehir'),
  (51, '51', 'Niğde'),
  (52, '52', 'Ordu'),
  (53, '53', 'Rize'),
  (54, '54', 'Sakarya'),
  (55, '55', 'Samsun'),
  (56, '56', 'Siirt'),
  (57, '57', 'Sinop'),
  (58, '58', 'Sivas'),
  (59, '59', 'Tekirdağ'),
  (60, '60', 'Tokat'),
  (61, '61', 'Trabzon'),
  (62, '62', 'Tunceli'),
  (63, '63', 'Şanlıurfa'),
  (64, '64', 'Uşak'),
  (65, '65', 'Van'),
  (66, '66', 'Yozgat'),
  (67, '67', 'Zonguldak'),
  (68, '68', 'Aksaray'),
  (69, '69', 'Bayburt'),
  (70, '70', 'Karaman'),
  (71, '71', 'Kırıkkale'),
  (72, '72', 'Batman'),
  (73, '73', 'Şırnak'),
  (74, '74', 'Bartın'),
  (75, '75', 'Ardahan'),
  (76, '76', 'Iğdır'),
  (77, '77', 'Yalova'),
  (78, '78', 'Karabük'),
  (79, '79', 'Kilis'),
  (80, '80', 'Osmaniye'),
  (81, '81', 'Düzce')
on conflict (id) do update set plate = excluded.plate, name = excluded.name;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Katlama fonksiyonu — lib/ilan-sabitler.ts::ilKey() ile BİREBİR aynı
--
-- 🚨 Bu ifade üç yerde tekrar ediyor ve üçü de aynı kalmak ZORUNDA:
--    - lib/ilan-sabitler.ts :: ilKey()
--    - lib/alias-normalize.ts :: aliasKey()
--    - docs/20260729_alias_normalize_trigger.sql :: aliases_katlanmis_anahtar_uniq
-- Sıra kritik: `İ` (U+0130) ÖNCE düz `i`ye çevrilir. Aksi hâlde Postgres'in
-- lower()'ı onu `i` + birleşen nokta (U+0307) olarak İKİ karaktere açar ve JS
-- toLowerCase() ile ayrışır — eşleşme sessizce başarısız olur.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.il_key(v text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(lower(replace(coalesce(v, ''), 'İ', 'i')), 'ıçğöşü', 'icgosu')
$$;

-- Backfill ve gelecekteki metin→id çözümlemesi için katlanmış indeks.
create unique index if not exists provinces_il_key_uniq
  on public.provinces (public.il_key(name));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yeni kolonlar
--
-- Hepsi NULLABLE. `not null` YAPMA: eşleşmeyen eski satırlar var (Adım 5'in
-- raporu bunları listeliyor) ve çift yazım döneminde yeni satırların bir kısmı
-- henüz eski kod yolundan gelebilir.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.listings
  add column if not exists origin_province_id smallint references public.provinces(id),
  add column if not exists origin_district_official boolean;

alter table public.listing_stops
  add column if not exists province_id smallint references public.provinces(id),
  add column if not exists district_official boolean;

comment on column public.listings.origin_province_id is
  'Plaka kodu (1-81). origin_city metin kolonunun yerini alacak — bkz. docs/COGRAFI_GECIS.md';
comment on column public.listings.origin_district_official is
  'true = locations.json''daki resmî ilçe, false = kullanıcının serbest girdisi (İkitelli, İSTOÇ...), null = bilinmiyor (eski satır)';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. GRANT — 🚨 BU ADIMI ATLAMA
--
-- `docs/20260728_contact_phone_revoke.sql` tablo geneli yetkiyi alıp kolonları
-- TEK TEK geri verdi. Dolayısıyla `public.listings`'e bundan sonra eklenen her
-- kolon `anon`/`authenticated` için YETKİSİZ DOĞAR ve okuma tarafında
-- `42501 permission denied for column origin_province_id` ile patlar.
-- Belirti sinsi: hata istemci konsolunda kalır, sayfa "ilan bulunamadı" der.
-- ────────────────────────────────────────────────────────────────────────────

grant select (origin_province_id, origin_district_official)
  on public.listings to anon;
grant select (origin_province_id, origin_district_official),
      insert (origin_province_id, origin_district_official),
      update (origin_province_id, origin_district_official)
  on public.listings to authenticated;

-- provinces herkese açık okunur: dropdown'ın DB'den beslenmesi gerekmez ama
-- moderasyon/rapor sorguları join atacak.
grant select on public.provinces to anon, authenticated;
alter table public.provinces enable row level security;
drop policy if exists provinces_okuma on public.provinces;
create policy provinces_okuma on public.provinces for select using (true);

-- listing_stops tablo geneli grant'a dokunulmamıştı; yine de garantiye al.
grant select on public.listing_stops to anon, authenticated;

commit;
-- ▲ BLOK A BİTTİ. Buraya kadar hiçbir satır değişmedi — sadece şema büyüdü.
--   Devam etmeden `provinces` tablosunda 81 satır olduğunu doğrula.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK B — ÖN RAPOR. Transaction YOK. Üç sorguyu TEK TEK çalıştır ve       ║
-- ║ çıktılarını sakla; hepsini birden çalıştırırsan Editor yalnızca          ║
-- ║ sonuncusunu gösterir ve ilk ikisini kaybedersin.                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ────────────────────────────────────────────────────────────────────────────
-- 5. ÖN RAPOR — backfill'den ÖNCE oku, çıktıyı SAKLA
--
-- Bu üç sorgu "kaç satır id alamayacak" sorusunu cevaplar. Sayı beklediğinden
-- büyükse backfill'i çalıştırma, önce `aliases` tarafına bak.
-- ────────────────────────────────────────────────────────────────────────────

-- 5.1 listings: eşleşmeyecek kalkış illeri
select 'listings.origin_city' as kaynak, origin_city, count(*) as adet
from public.listings
where origin_city is not null
  and btrim(origin_city) <> ''
  and not exists (
    select 1 from public.provinces p
    where public.il_key(p.name) = public.il_key(origin_city)
  )
group by 2 order by 3 desc;

-- 5.2 listing_stops: eşleşmeyecek durak illeri
select 'listing_stops.city' as kaynak, city, count(*) as adet
from public.listing_stops
where city is not null
  and btrim(city) <> ''
  and not exists (
    select 1 from public.provinces p
    where public.il_key(p.name) = public.il_key(city)
  )
group by 2 order by 3 desc;

-- 5.3 W5 TEŞHİSİ: aynı ile ait kaç FARKLI yazım var?
--     `adet_yazim > 1` olan her satır, ID'ye geçişin tam olarak çözdüğü hasardır.
select public.il_key(origin_city) as katlanmis,
       count(distinct origin_city) as adet_yazim,
       array_agg(distinct origin_city) as yazimlar,
       count(*) as ilan
from public.listings
where origin_city is not null and btrim(origin_city) <> ''
group by 1
having count(distinct origin_city) > 1
order by 4 desc;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK C — backfill + indeksler. BLOK B'nin çıktısını OKUMADAN çalıştırma. ║
-- ║ 5.1/5.2'deki eşleşmeyen sayısı beklediğinden büyükse dur, önce alias'a   ║
-- ║ bak. Buradan itibaren satırlar değişiyor.                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. BACKFILL
--
-- Aşama A: doğrudan katlanmış eşleşme (satırların büyük çoğunluğu).
-- Aşama B: kalanları `aliases` üzerinden çöz (type='city', is_active).
-- ────────────────────────────────────────────────────────────────────────────

-- 6.A listings
update public.listings l
set origin_province_id = p.id
from public.provinces p
where l.origin_province_id is null
  and l.origin_city is not null
  and public.il_key(p.name) = public.il_key(l.origin_city);

-- 6.A listing_stops
update public.listing_stops s
set province_id = p.id
from public.provinces p
where s.province_id is null
  and s.city is not null
  and public.il_key(p.name) = public.il_key(s.city);

-- 6.B alias köprüsü — listings
--     `aliases.normalized`'daki bozuk yazım (Istanbul/İstanbul) burada SORUN
--     DEĞİL: il_key ikisini de aynı anahtara katlıyor. W5 runbook'unun il yazımı
--     adımlarının gereksizleşmesinin sebebi tam olarak bu.
update public.listings l
set origin_province_id = p.id
from public.aliases a
join public.provinces p on public.il_key(p.name) = public.il_key(a.normalized)
where l.origin_province_id is null
  and l.origin_city is not null
  and a.type = 'city'
  and a.is_active is true
  and public.il_key(a.alias) = public.il_key(l.origin_city);

-- 6.B alias köprüsü — listing_stops
update public.listing_stops s
set province_id = p.id
from public.aliases a
join public.provinces p on public.il_key(p.name) = public.il_key(a.normalized)
where s.province_id is null
  and s.city is not null
  and a.type = 'city'
  and a.is_active is true
  and public.il_key(a.alias) = public.il_key(s.city);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. İNDEKSLER — asıl kazanç burada
--
-- Eski filtre `where origin_city ilike 'istanbul'` idi; `ilike` sol-tarafı
-- fonksiyona sokmasa bile büyük/küçük harf duyarsızlığı yüzünden düz b-tree'yi
-- kullanamıyordu. smallint eşitliği hem index'li hem sabit maliyetli.
-- Kısmi indeks (`where ... is not null`) ölü satırları indekse sokmuyor.
-- ────────────────────────────────────────────────────────────────────────────

create index if not exists listings_origin_province_idx
  on public.listings (origin_province_id)
  where origin_province_id is not null;

-- Ana listeleme sorgusunun gerçek şekli: il + yayında + tarihe göre sıralı.
create index if not exists listings_province_durum_idx
  on public.listings (origin_province_id, status, created_at desc)
  where origin_province_id is not null;

create index if not exists listing_stops_province_idx
  on public.listing_stops (province_id)
  where province_id is not null;

-- Varış filtresi: "İstanbul'a giden ilanlar" → stops üzerinden listing_id'ye.
create index if not exists listing_stops_province_listing_idx
  on public.listing_stops (province_id, listing_id)
  where province_id is not null;

commit;
-- ▲ BLOK C BİTTİ.


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOK D — DOĞRULAMA. Transaction YOK. Dört sorguyu TEK TEK çalıştır.      ║
-- ║ Kabul ölçütü: 8.1 ≥ %98 · 8.2 SIFIR satır · 8.4 anon+authenticated var.  ║
-- ║ 8.2 satır döndürüyorsa geri alma (Adım 9) hâlâ ücretsiz — kullan.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- 8. DOĞRULAMA (commit sonrası çalıştır, çıktıyı sakla)
-- ============================================================================

-- 8.1 Kapsama oranı — hedef %98+. Düşükse Adım 5.1'in çıktısına dön.
select count(*)                                              as toplam,
       count(origin_province_id)                             as eslesen,
       count(*) - count(origin_province_id)                  as eslesmeyen,
       round(100.0 * count(origin_province_id) / nullif(count(*), 0), 2) as yuzde
from public.listings
where origin_city is not null and btrim(origin_city) <> '';

select count(*)                                    as toplam,
       count(province_id)                          as eslesen,
       count(*) - count(province_id)               as eslesmeyen,
       round(100.0 * count(province_id) / nullif(count(*), 0), 2) as yuzde
from public.listing_stops
where city is not null and btrim(city) <> '';

-- 8.2 ÇAPRAZ KONTROL: id ile metin ÇELİŞİYOR mu? Sıfır satır dönmeli.
--     Dönerse backfill'de değil, uygulama kodunda bir yazma yolu bozuk demektir.
select l.id, l.origin_city, l.origin_province_id, p.name
from public.listings l
join public.provinces p on p.id = l.origin_province_id
where public.il_key(p.name) <> public.il_key(l.origin_city)
limit 50;

-- 8.3 Sahte güzergâh sayacı (aynı il içi taşıma MEŞRU — bu yalnızca ölçüm).
select count(*) as ayni_il_ici
from public.listings l
join public.listing_stops s on s.listing_id = l.id
where l.origin_province_id is not null
  and l.origin_province_id = s.province_id;

-- 8.4 Kolon yetkisi gerçekten verildi mi? İki satır dönmeli (anon + authenticated).
select grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'listings'
  and column_name = 'origin_province_id'
order by grantee, privilege_type;

-- ============================================================================
-- 9. GERİ ALMA
-- ============================================================================
-- Metin kolonları duruyor, veri kaybı yok:
--
--   alter table public.listings
--     drop column if exists origin_province_id,
--     drop column if exists origin_district_official;
--   alter table public.listing_stops
--     drop column if exists province_id,
--     drop column if exists district_official;
--   drop table if exists public.provinces;
--   drop function if exists public.il_key(text);
--
-- ============================================================================
-- 10. SONRAKİ ADIM — BU MIGRATION TEK BAŞINA HİÇBİR ŞEY DEĞİŞTİRMEZ
-- ============================================================================
-- Kod hâlâ metin kolonlarını okuyup yazıyor. Sıradaki dalgalar ve dokunulacak
-- dosyalar: docs/COGRAFI_GECIS.md
--   Dalga 2 → yazma yolları (ilan_olustur RPC, lib/ilan-yaz.ts, ilan-ver formu,
--             excel-import, whatsapp webhook, parse-listing edge function)
--   Dalga 3 → okuma/filtre (HomeClient, radar + nearby RPC'leri, moderatör paneli)
--   Dalga 4 → metin kolonlarını drop
-- ============================================================================
