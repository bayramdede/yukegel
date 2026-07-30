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
-- ============================================================================

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
