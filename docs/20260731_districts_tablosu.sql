-- ============================================================================
-- DISTRICTS TABLOSU — ilçeyi metinden veriye çevir
-- 31 Tem 2026 · Dalga 5 ile birlikte değerlendirilecek (COGRAFI_GECIS.md:205-212)
--
-- ✅ BÖLÜM 1-3 ÇALIŞTIRILDI — 4 Ağustos 2026, canlı DB.
--    Doğrulama sonuçları:
--      4.1  973 ilçe / 81 il                                   ✅ beklendiği gibi
--      4.2  ilçesiz il                                          ✅ 0 satır
--      4.4  t1..t9 = true,true,false,false,true,true,true,null,null  ✅ tam isabet
--           t6 ve t7 (Ankara Gölbaşı + Adıyaman Gölbaşı) İKİSİ DE true —
--           fonksiyon "hangi il?" değil "bu il için bu ilçe doğru mu?" sorusunu
--           cevaplıyor; tasarım canlıda doğrulandı.
--    Ayrıca çalıştırmadan önce BÖLÜM 2'nin 973 satırı `lib/constants/locations.json`
--    ile programatik karşılaştırıldı: 973/973 birebir, tekrar yok, tek yönlü fark yok.
--    ✅ Bu karşılaştırma artık OTOMATİK: `npm run test:districts` (bkz. 4.3).
--
-- ✅ FONKSİYON CANLI VERİYE KARŞI ÇAPRAZ DOĞRULANDI (4 Ağu).
--    `district_official` dolu olan 62 durakta kolon ile `ilce_resmi()` yan yana
--    kondu: 58 (true,true) + 4 (false,false), ÇAPRAZ SATIR YOK. Yani fonksiyon
--    üç yazma yolunun bugüne kadar ürettiği bayrakla birebir aynı fikirde.
--    📌 Bu kontrol yalnız ŞİMDİ yapılabilirdi — entegrasyondan sonra kolon ile
--    fonksiyon aynı kaynağa döner ve karşılaştırma anlamını yitirir.
--
-- 📊 4.5 MEVCUT VERİ (4 Ağu):
--    listings : 12.377 resmi · 82 resmi değil (%0,66) · 222.855 belirsiz
--    stops    : 15.583 resmi · 170 resmi değil (%1,08) · 229.882 belirsiz
--    "Belirsiz"in TAMAMI ilçesi boş satır — `origin_province_id is null` olan
--    TEK İLAN YOK. (Dalga 5 için ayrıca iyi haber: il tarafı %100 dolu.)
--    Resmi olmayanlar çoğunlukla mahalle/bölge adı: Avrupa 31 · Hadımköy 26 ·
--    Işıkkent 8 · Selimpasa 7 — bunlarda `false` DOĞRU cevap.
--
-- 🚫 HENÜZ YAPILMADI: `ilan_olustur` v4 entegrasyonu (aşağıdaki "── `ilan_olustur`
--    entegrasyonu" bölümü) ve 4.3 tek-kaynak testi. Yani fonksiyon canlıda DURUYOR
--    ama HENÜZ HİÇBİR YAZMA YOLU ONU ÇAĞIRMIYOR — şu an sadece sorgulanabilir bir
--    doğrulama sözlüğü.
--
-- ── NEDEN ───────────────────────────────────────────────────────────────────
-- `parse-listing` (Deno) kanalında `district_official` NULL kalıyor. Sebep:
-- 973 ilçe `lib/constants/locations.json`'da duruyor, Deno oradan import
-- edemiyor ve DB'de karşılığı yok — yani RPC de türetemiyor. Bugün 4 yazma
-- yolundan 3'ü kolonu dolduruyor, 1'i dolduramıyor.
--
-- 🚨 DALGA 5 BUNU İSTEĞE BAĞLI OLMAKTAN ÇIKARIYOR.
--    Dalga 5 `listings.origin_city` ve `listing_stops.city` metin kolonlarını
--    düşürüyor. `origin_district` ve `listing_stops.district` DÜŞMÜYOR — çünkü
--    karşılıkları yok. Yani Dalga 5'ten sonra **ilçe, sistemde kalan tek metin
--    konum alanı** oluyor. Coğrafi standardizasyonun tamamlanmamış tek ucu bu.
--
-- ── TASARIM KARARI: BU MIGRATION `district_id` KOLONU EKLEMİYOR ─────────────
-- İl için yapılan şey (`origin_province_id` + 5 dalga) ilçe için TEKRARLANMIYOR.
-- Sebep: ilçe adı **tek başına tekil değil**. `Merkez` 51 ilde, ve 24 ad daha
-- iki-üç ile birden düşüyor (aşağıdaki liste). İl için `provinces_il_key_uniq`
-- tek satır garantisi veriyordu; ilçe için o garanti YOK, dolayısıyla
-- "metinden id çöz" adımı ilçede sessizce yanlış il seçebilir.
--
-- Bu migration'ın verdiği şey daha mütevazı ve daha güvenli: **doğrulama
-- sözlüğü**. `(province_id, ilçe adı)` çifti tabloda VAR MI sorusunu cevaplar.
-- `district_official` tam olarak bu sorunun cevabıdır. `district_id` kolonu
-- ayrı bir karar; ihtiyaç kanıtlanınca ayrı dalga olarak açılır.
--
-- ⚠️ ÇAKIŞAN İLÇE ADLARI (Merkez hariç 24 ad) — `district_id` düşünülürse
--    burası tuzak. Bir ilçe adını il bilgisi olmadan çözmeye kalkan her kod
--    bunlarda yanılır:
--      Aksu(Antalya/Isparta) · Altınyayla(Burdur/Sivas) · Aydıncık(Mersin/Yozgat)
--      Ayvacık(Çanakkale/Samsun) · Bayat(Afyonkarahisar/Çorum)
--      Bozkurt(Denizli/Kastamonu) · Edremit(Balıkesir/Van) · Ereğli(Konya/Zonguldak)
--      Gölbaşı(Adıyaman/Ankara) · Gönen(Balıkesir/Isparta) · Kale(Denizli/Malatya)
--      Kemalpaşa(Artvin/İzmir) · Kemer(Antalya/Burdur) · Köprübaşı(Manisa/Trabzon)
--      Ortaköy(Çorum/Aksaray) · Ovacık(Tunceli/Karabük) · Pazar(Rize/Tokat)
--      Pınarbaşı(Kastamonu/Kayseri) · Saray(Tekirdağ/Van) · Ulubey(Ordu/Uşak)
--      Yenice(Çanakkale/Karabük) · Yenipazar(Aydın/Bilecik)
--      Yenişehir(Bursa/Diyarbakır/Mersin) · Yeşilyurt(Malatya/Tokat)
--
-- 📌 Bu liste alias runbook'undaki iki kararı da doğruluyor:
--    `docs/20260729_alias_runbook.md` Adım 6.5 (`gölbaşı` → Ankara/Adıyaman) ve
--    6.6 (`kemalpaşa` → İzmir/Artvin) uydurma belirsizlikler değil, resmi ilçe
--    listesinin kendisinden geliyor. Tablo kurulduktan sonra o kararlar
--    "tercih" olmaktan çıkıp veriyle gerekçelendirilebilir hale gelir.
--
--    ⚠️ Runbook 6.6'da Artvin/Kemalpaşa "belde" diye geçiyor. locations.json onu
--       İLÇE olarak listeliyor — Kemalpaşa 2020'de Hopa'dan ayrılıp Artvin'in
--       ilçesi oldu. Runbook'un gerekçesi eskimiş; karar (normalized aynı kalsın,
--       ayrım district'te olsun) yine de doğru.
-- ============================================================================


-- ── 1. TABLO ────────────────────────────────────────────────────────────────

create table if not exists public.districts (
  id          smallint generated always as identity primary key,
  province_id smallint not null references public.provinces(id),
  name        text     not null
);

-- ⚠️ Tekillik `(province_id, katlanmış ad)` üzerinde. Yalnız `name` üzerinde
--    UNIQUE kurulamaz: 51 `Merkez` + 24 çakışan ad onu anında ihlal eder.
--    `il_key()` katlaması `provinces` ile aynı fonksiyon — "Gölbaşi"/"GÖLBAŞI"
--    aynı satıra düşsün diye. (Fonksiyon adı "il" dese de düz metin katlayıcı;
--    bkz. 20260730_dalga3_radar_province_id.sql:551.)
create unique index if not exists districts_il_key_uniq
  on public.districts (province_id, public.il_key(name));

-- Ada göre arama (hangi illerde bu ilçe var?) için katlanmış indeks.
create index if not exists districts_ad_key_idx
  on public.districts (public.il_key(name));

alter table public.districts enable row level security;

-- ⚠️ `provinces` ile aynı model: referans verisi, herkese açık okuma, yazma yok.
--    Yazma sadece migration'dan (service_role bypass) yapılır.
drop policy if exists districts_okuma on public.districts;
create policy districts_okuma on public.districts for select using (true);

grant select on public.districts to anon, authenticated;


-- ── 2. VERİ — 973 ilçe, kaynak: lib/constants/locations.json ─────────────────
--
-- ⚠️ TEK KAYNAK İKİYE ÇIKIYOR. Bu satırlar `locations.json`'ın kopyası. JSON
--    güncellenip bu tablo güncellenmezse (veya tersi) ikisi sessizce ayrışır ve
--    `district_official` yanlış cevap vermeye başlar. BÖLÜM 4'teki tutarlılık
--    sorgusu bunun için var; yeni ilçe kurulduğunda (2020'de Kemalpaşa oldu)
--    İKİSİ BİRDEN güncellenir.

insert into public.districts (province_id, name) values
  ( 1, 'Aladağ'),
  ( 1, 'Ceyhan'),
  ( 1, 'Çukurova'),
  ( 1, 'Feke'),
  ( 1, 'İmamoğlu'),
  ( 1, 'Karaisalı'),
  ( 1, 'Karataş'),
  ( 1, 'Kozan'),
  ( 1, 'Pozantı'),
  ( 1, 'Saimbeyli'),
  ( 1, 'Sarıçam'),
  ( 1, 'Seyhan'),
  ( 1, 'Tufanbeyli'),
  ( 1, 'Yumurtalık'),
  ( 1, 'Yüreğir'),
  ( 2, 'Besni'),
  ( 2, 'Çelikhan'),
  ( 2, 'Gerger'),
  ( 2, 'Gölbaşı'),
  ( 2, 'Kahta'),
  ( 2, 'Merkez'),
  ( 2, 'Samsat'),
  ( 2, 'Sincik'),
  ( 2, 'Tut'),
  ( 3, 'Başmakçı'),
  ( 3, 'Bayat'),
  ( 3, 'Bolvadin'),
  ( 3, 'Çay'),
  ( 3, 'Çobanlar'),
  ( 3, 'Dazkırı'),
  ( 3, 'Dinar'),
  ( 3, 'Emirdağ'),
  ( 3, 'Evciler'),
  ( 3, 'Hocalar'),
  ( 3, 'İhsaniye'),
  ( 3, 'İscehisar'),
  ( 3, 'Kızılören'),
  ( 3, 'Merkez'),
  ( 3, 'Sandıklı'),
  ( 3, 'Sinanpaşa'),
  ( 3, 'Sultandağı'),
  ( 3, 'Şuhut'),
  ( 4, 'Diyadin'),
  ( 4, 'Doğubayazıt'),
  ( 4, 'Eleşkirt'),
  ( 4, 'Hamur'),
  ( 4, 'Merkez'),
  ( 4, 'Patnos'),
  ( 4, 'Taşlıçay'),
  ( 4, 'Tutak'),
  ( 5, 'Göynücek'),
  ( 5, 'Gümüşhacıköy'),
  ( 5, 'Hamamözü'),
  ( 5, 'Merkez'),
  ( 5, 'Merzifon'),
  ( 5, 'Suluova'),
  ( 5, 'Taşova'),
  ( 6, 'Akyurt'),
  ( 6, 'Altındağ'),
  ( 6, 'Ayaş'),
  ( 6, 'Bala'),
  ( 6, 'Beypazarı'),
  ( 6, 'Çamlıdere'),
  ( 6, 'Çankaya'),
  ( 6, 'Çubuk'),
  ( 6, 'Elmadağ'),
  ( 6, 'Etimesgut'),
  ( 6, 'Evren'),
  ( 6, 'Gölbaşı'),
  ( 6, 'Güdül'),
  ( 6, 'Haymana'),
  ( 6, 'Kahramankazan'),
  ( 6, 'Kalecik'),
  ( 6, 'Keçiören'),
  ( 6, 'Kızılcahamam'),
  ( 6, 'Mamak'),
  ( 6, 'Nallıhan'),
  ( 6, 'Polatlı'),
  ( 6, 'Pursaklar'),
  ( 6, 'Sincan'),
  ( 6, 'Şereflikoçhisar'),
  ( 6, 'Yenimahalle'),
  ( 7, 'Akseki'),
  ( 7, 'Aksu'),
  ( 7, 'Alanya'),
  ( 7, 'Demre'),
  ( 7, 'Döşemealtı'),
  ( 7, 'Elmalı'),
  ( 7, 'Finike'),
  ( 7, 'Gazipaşa'),
  ( 7, 'Gündoğmuş'),
  ( 7, 'İbradı'),
  ( 7, 'Kaş'),
  ( 7, 'Kemer'),
  ( 7, 'Kepez'),
  ( 7, 'Konyaaltı'),
  ( 7, 'Korkuteli'),
  ( 7, 'Kumluca'),
  ( 7, 'Manavgat'),
  ( 7, 'Muratpaşa'),
  ( 7, 'Serik'),
  ( 8, 'Ardanuç'),
  ( 8, 'Arhavi'),
  ( 8, 'Borçka'),
  ( 8, 'Hopa'),
  ( 8, 'Kemalpaşa'),
  ( 8, 'Merkez'),
  ( 8, 'Murgul'),
  ( 8, 'Şavşat'),
  ( 8, 'Yusufeli'),
  ( 9, 'Bozdoğan'),
  ( 9, 'Buharkent'),
  ( 9, 'Çine'),
  ( 9, 'Didim'),
  ( 9, 'Efeler'),
  ( 9, 'Germencik'),
  ( 9, 'İncirliova'),
  ( 9, 'Karacasu'),
  ( 9, 'Karpuzlu'),
  ( 9, 'Koçarlı'),
  ( 9, 'Köşk'),
  ( 9, 'Kuşadası'),
  ( 9, 'Kuyucak'),
  ( 9, 'Nazilli'),
  ( 9, 'Söke'),
  ( 9, 'Sultanhisar'),
  ( 9, 'Yenipazar'),
  (10, 'Altıeylül'),
  (10, 'Ayvalık'),
  (10, 'Balya'),
  (10, 'Bandırma'),
  (10, 'Bigadiç'),
  (10, 'Burhaniye'),
  (10, 'Dursunbey'),
  (10, 'Edremit'),
  (10, 'Erdek'),
  (10, 'Gömeç'),
  (10, 'Gönen'),
  (10, 'Havran'),
  (10, 'İvrindi'),
  (10, 'Karesi'),
  (10, 'Kepsut'),
  (10, 'Manyas'),
  (10, 'Marmara'),
  (10, 'Savaştepe'),
  (10, 'Sındırgı'),
  (10, 'Susurluk'),
  (11, 'Bozüyük'),
  (11, 'Gölpazarı'),
  (11, 'İnhisar'),
  (11, 'Merkez'),
  (11, 'Osmaneli'),
  (11, 'Pazaryeri'),
  (11, 'Söğüt'),
  (11, 'Yenipazar'),
  (12, 'Adaklı'),
  (12, 'Genç'),
  (12, 'Karlıova'),
  (12, 'Kiğı'),
  (12, 'Merkez'),
  (12, 'Solhan'),
  (12, 'Yayladere'),
  (12, 'Yedisu'),
  (13, 'Adilcevaz'),
  (13, 'Ahlat'),
  (13, 'Güroymak'),
  (13, 'Hizan'),
  (13, 'Merkez'),
  (13, 'Mutki'),
  (13, 'Tatvan'),
  (14, 'Dörtdivan'),
  (14, 'Gerede'),
  (14, 'Göynük'),
  (14, 'Kıbrıscık'),
  (14, 'Mengen'),
  (14, 'Merkez'),
  (14, 'Mudurnu'),
  (14, 'Seben'),
  (14, 'Yeniçağa'),
  (15, 'Ağlasun'),
  (15, 'Altınyayla'),
  (15, 'Bucak'),
  (15, 'Çavdır'),
  (15, 'Çeltikçi'),
  (15, 'Gölhisar'),
  (15, 'Karamanlı'),
  (15, 'Kemer'),
  (15, 'Merkez'),
  (15, 'Tefenni'),
  (15, 'Yeşilova'),
  (16, 'Büyükorhan'),
  (16, 'Gemlik'),
  (16, 'Gürsu'),
  (16, 'Harmancık'),
  (16, 'İnegöl'),
  (16, 'İznik'),
  (16, 'Karacabey'),
  (16, 'Keles'),
  (16, 'Kestel'),
  (16, 'Mudanya'),
  (16, 'Mustafakemalpaşa'),
  (16, 'Nilüfer'),
  (16, 'Orhaneli'),
  (16, 'Orhangazi'),
  (16, 'Osmangazi'),
  (16, 'Yenişehir'),
  (16, 'Yıldırım'),
  (17, 'Ayvacık'),
  (17, 'Bayramiç'),
  (17, 'Biga'),
  (17, 'Bozcaada'),
  (17, 'Çan'),
  (17, 'Eceabat'),
  (17, 'Ezine'),
  (17, 'Gelibolu'),
  (17, 'Gökçeada'),
  (17, 'Lapseki'),
  (17, 'Merkez'),
  (17, 'Yenice'),
  (18, 'Atkaracalar'),
  (18, 'Bayramören'),
  (18, 'Çerkeş'),
  (18, 'Eldivan'),
  (18, 'Ilgaz'),
  (18, 'Kızılırmak'),
  (18, 'Korgun'),
  (18, 'Kurşunlu'),
  (18, 'Merkez'),
  (18, 'Orta'),
  (18, 'Şabanözü'),
  (18, 'Yapraklı'),
  (19, 'Alaca'),
  (19, 'Bayat'),
  (19, 'Boğazkale'),
  (19, 'Dodurga'),
  (19, 'İskilip'),
  (19, 'Kargı'),
  (19, 'Laçin'),
  (19, 'Mecitözü'),
  (19, 'Merkez'),
  (19, 'Oğuzlar'),
  (19, 'Ortaköy'),
  (19, 'Osmancık'),
  (19, 'Sungurlu'),
  (19, 'Uğurludağ'),
  (20, 'Acıpayam'),
  (20, 'Babadağ'),
  (20, 'Baklan'),
  (20, 'Bekilli'),
  (20, 'Beyağaç'),
  (20, 'Bozkurt'),
  (20, 'Buldan'),
  (20, 'Çal'),
  (20, 'Çameli'),
  (20, 'Çardak'),
  (20, 'Çivril'),
  (20, 'Güney'),
  (20, 'Honaz'),
  (20, 'Kale'),
  (20, 'Merkezefendi'),
  (20, 'Pamukkale'),
  (20, 'Sarayköy'),
  (20, 'Serinhisar'),
  (20, 'Tavas'),
  (21, 'Bağlar'),
  (21, 'Bismil'),
  (21, 'Çermik'),
  (21, 'Çınar'),
  (21, 'Çüngüş'),
  (21, 'Dicle'),
  (21, 'Eğil'),
  (21, 'Ergani'),
  (21, 'Hani'),
  (21, 'Hazro'),
  (21, 'Kayapınar'),
  (21, 'Kocaköy'),
  (21, 'Kulp'),
  (21, 'Lice'),
  (21, 'Silvan'),
  (21, 'Sur'),
  (21, 'Yenişehir'),
  (22, 'Enez'),
  (22, 'Havsa'),
  (22, 'İpsala'),
  (22, 'Keşan'),
  (22, 'Lalapaşa'),
  (22, 'Meriç'),
  (22, 'Merkez'),
  (22, 'Süloğlu'),
  (22, 'Uzunköprü'),
  (23, 'Ağın'),
  (23, 'Alacakaya'),
  (23, 'Arıcak'),
  (23, 'Baskil'),
  (23, 'Karakoçan'),
  (23, 'Keban'),
  (23, 'Kovancılar'),
  (23, 'Maden'),
  (23, 'Merkez'),
  (23, 'Palu'),
  (23, 'Sivrice'),
  (24, 'Çayırlı'),
  (24, 'İliç'),
  (24, 'Kemah'),
  (24, 'Kemaliye'),
  (24, 'Merkez'),
  (24, 'Otlukbeli'),
  (24, 'Refahiye'),
  (24, 'Tercan'),
  (24, 'Üzümlü'),
  (25, 'Aşkale'),
  (25, 'Aziziye'),
  (25, 'Çat'),
  (25, 'Hınıs'),
  (25, 'Horasan'),
  (25, 'İspir'),
  (25, 'Karaçoban'),
  (25, 'Karayazı'),
  (25, 'Köprüköy'),
  (25, 'Narman'),
  (25, 'Oltu'),
  (25, 'Olur'),
  (25, 'Palandöken'),
  (25, 'Pasinler'),
  (25, 'Pazaryolu'),
  (25, 'Şenkaya'),
  (25, 'Tekman'),
  (25, 'Tortum'),
  (25, 'Uzundere'),
  (25, 'Yakutiye'),
  (26, 'Alpu'),
  (26, 'Beylikova'),
  (26, 'Çifteler'),
  (26, 'Günyüzü'),
  (26, 'Han'),
  (26, 'İnönü'),
  (26, 'Mahmudiye'),
  (26, 'Mihalgazi'),
  (26, 'Mihalıççık'),
  (26, 'Odunpazarı'),
  (26, 'Sarıcakaya'),
  (26, 'Seyitgazi'),
  (26, 'Sivrihisar'),
  (26, 'Tepebaşı'),
  (27, 'Araban'),
  (27, 'İslahiye'),
  (27, 'Karkamış'),
  (27, 'Nizip'),
  (27, 'Nurdağı'),
  (27, 'Oğuzeli'),
  (27, 'Şahinbey'),
  (27, 'Şehitkamil'),
  (27, 'Yavuzeli'),
  (28, 'Alucra'),
  (28, 'Bulancak'),
  (28, 'Çamoluk'),
  (28, 'Çanakçı'),
  (28, 'Dereli'),
  (28, 'Doğankent'),
  (28, 'Espiye'),
  (28, 'Eynesil'),
  (28, 'Görele'),
  (28, 'Güce'),
  (28, 'Keşap'),
  (28, 'Merkez'),
  (28, 'Piraziz'),
  (28, 'Şebinkarahisar'),
  (28, 'Tirebolu'),
  (28, 'Yağlıdere'),
  (29, 'Kelkit'),
  (29, 'Köse'),
  (29, 'Kürtün'),
  (29, 'Merkez'),
  (29, 'Şiran'),
  (29, 'Torul'),
  (30, 'Çukurca'),
  (30, 'Derecik'),
  (30, 'Merkez'),
  (30, 'Şemdinli'),
  (30, 'Yüksekova'),
  (31, 'Altınözü'),
  (31, 'Antakya'),
  (31, 'Arsuz'),
  (31, 'Belen'),
  (31, 'Defne'),
  (31, 'Dörtyol'),
  (31, 'Erzin'),
  (31, 'Hassa'),
  (31, 'İskenderun'),
  (31, 'Kırıkhan'),
  (31, 'Kumlu'),
  (31, 'Payas'),
  (31, 'Reyhanlı'),
  (31, 'Samandağ'),
  (31, 'Yayladağı'),
  (32, 'Aksu'),
  (32, 'Atabey'),
  (32, 'Eğirdir'),
  (32, 'Gelendost'),
  (32, 'Gönen'),
  (32, 'Keçiborlu'),
  (32, 'Merkez'),
  (32, 'Senirkent'),
  (32, 'Sütçüler'),
  (32, 'Şarkikaraağaç'),
  (32, 'Uluborlu'),
  (32, 'Yalvaç'),
  (32, 'Yenişarbademli'),
  (33, 'Akdeniz'),
  (33, 'Anamur'),
  (33, 'Aydıncık'),
  (33, 'Bozyazı'),
  (33, 'Çamlıyayla'),
  (33, 'Erdemli'),
  (33, 'Gülnar'),
  (33, 'Mezitli'),
  (33, 'Mut'),
  (33, 'Silifke'),
  (33, 'Tarsus'),
  (33, 'Toroslar'),
  (33, 'Yenişehir'),
  (34, 'Adalar'),
  (34, 'Arnavutköy'),
  (34, 'Ataşehir'),
  (34, 'Avcılar'),
  (34, 'Bağcılar'),
  (34, 'Bahçelievler'),
  (34, 'Bakırköy'),
  (34, 'Başakşehir'),
  (34, 'Bayrampaşa'),
  (34, 'Beşiktaş'),
  (34, 'Beykoz'),
  (34, 'Beylikdüzü'),
  (34, 'Beyoğlu'),
  (34, 'Büyükçekmece'),
  (34, 'Çatalca'),
  (34, 'Çekmeköy'),
  (34, 'Esenler'),
  (34, 'Esenyurt'),
  (34, 'Eyüpsultan'),
  (34, 'Fatih'),
  (34, 'Gaziosmanpaşa'),
  (34, 'Güngören'),
  (34, 'Kadıköy'),
  (34, 'Kağıthane'),
  (34, 'Kartal'),
  (34, 'Küçükçekmece'),
  (34, 'Maltepe'),
  (34, 'Pendik'),
  (34, 'Sancaktepe'),
  (34, 'Sarıyer'),
  (34, 'Silivri'),
  (34, 'Sultanbeyli'),
  (34, 'Sultangazi'),
  (34, 'Şile'),
  (34, 'Şişli'),
  (34, 'Tuzla'),
  (34, 'Ümraniye'),
  (34, 'Üsküdar'),
  (34, 'Zeytinburnu'),
  (35, 'Aliağa'),
  (35, 'Balçova'),
  (35, 'Bayındır'),
  (35, 'Bayraklı'),
  (35, 'Bergama'),
  (35, 'Beydağ'),
  (35, 'Bornova'),
  (35, 'Buca'),
  (35, 'Çeşme'),
  (35, 'Çiğli'),
  (35, 'Dikili'),
  (35, 'Foça'),
  (35, 'Gaziemir'),
  (35, 'Güzelbahçe'),
  (35, 'Karabağlar'),
  (35, 'Karaburun'),
  (35, 'Karşıyaka'),
  (35, 'Kemalpaşa'),
  (35, 'Kınık'),
  (35, 'Kiraz'),
  (35, 'Konak'),
  (35, 'Menderes'),
  (35, 'Menemen'),
  (35, 'Narlıdere'),
  (35, 'Ödemiş'),
  (35, 'Seferihisar'),
  (35, 'Selçuk'),
  (35, 'Tire'),
  (35, 'Torbalı'),
  (35, 'Urla'),
  (36, 'Akyaka'),
  (36, 'Arpaçay'),
  (36, 'Digor'),
  (36, 'Kağızman'),
  (36, 'Merkez'),
  (36, 'Sarıkamış'),
  (36, 'Selim'),
  (36, 'Susuz'),
  (37, 'Abana'),
  (37, 'Ağlı'),
  (37, 'Araç'),
  (37, 'Azdavay'),
  (37, 'Bozkurt'),
  (37, 'Cide'),
  (37, 'Çatalzeytin'),
  (37, 'Daday'),
  (37, 'Devrekani'),
  (37, 'Doğanyurt'),
  (37, 'Hanönü'),
  (37, 'İhsangazi'),
  (37, 'İnebolu'),
  (37, 'Küre'),
  (37, 'Merkez'),
  (37, 'Pınarbaşı'),
  (37, 'Seydiler'),
  (37, 'Şenpazar'),
  (37, 'Taşköprü'),
  (37, 'Tosya'),
  (38, 'Akkışla'),
  (38, 'Bünyan'),
  (38, 'Develi'),
  (38, 'Felahiye'),
  (38, 'Hacılar'),
  (38, 'İncesu'),
  (38, 'Kocasinan'),
  (38, 'Melikgazi'),
  (38, 'Özvatan'),
  (38, 'Pınarbaşı'),
  (38, 'Sarıoğlan'),
  (38, 'Sarız'),
  (38, 'Talas'),
  (38, 'Tomarza'),
  (38, 'Yahyalı'),
  (38, 'Yeşilhisar'),
  (39, 'Babaeski'),
  (39, 'Demirköy'),
  (39, 'Kofçaz'),
  (39, 'Lüleburgaz'),
  (39, 'Merkez'),
  (39, 'Pehlivanköy'),
  (39, 'Pınarhisar'),
  (39, 'Vize'),
  (40, 'Akçakent'),
  (40, 'Akpınar'),
  (40, 'Boztepe'),
  (40, 'Çiçekdağı'),
  (40, 'Kaman'),
  (40, 'Merkez'),
  (40, 'Mucur'),
  (41, 'Başiskele'),
  (41, 'Çayırova'),
  (41, 'Darıca'),
  (41, 'Derince'),
  (41, 'Dilovası'),
  (41, 'Gebze'),
  (41, 'Gölcük'),
  (41, 'İzmit'),
  (41, 'Kandıra'),
  (41, 'Karamürsel'),
  (41, 'Kartepe'),
  (41, 'Körfez'),
  (42, 'Ahırlı'),
  (42, 'Akören'),
  (42, 'Akşehir'),
  (42, 'Altınekin'),
  (42, 'Beyşehir'),
  (42, 'Bozkır'),
  (42, 'Cihanbeyli'),
  (42, 'Çeltik'),
  (42, 'Çumra'),
  (42, 'Derbent'),
  (42, 'Derebucak'),
  (42, 'Doğanhisar'),
  (42, 'Emirgazi'),
  (42, 'Ereğli'),
  (42, 'Güneysınır'),
  (42, 'Hadim'),
  (42, 'Halkapınar'),
  (42, 'Hüyük'),
  (42, 'Ilgın'),
  (42, 'Kadınhanı'),
  (42, 'Karapınar'),
  (42, 'Karatay'),
  (42, 'Kulu'),
  (42, 'Meram'),
  (42, 'Sarayönü'),
  (42, 'Selçuklu'),
  (42, 'Seydişehir'),
  (42, 'Taşkent'),
  (42, 'Tuzlukçu'),
  (42, 'Yalıhüyük'),
  (42, 'Yunak'),
  (43, 'Altıntaş'),
  (43, 'Aslanapa'),
  (43, 'Çavdarhisar'),
  (43, 'Domaniç'),
  (43, 'Dumlupınar'),
  (43, 'Emet'),
  (43, 'Gediz'),
  (43, 'Hisarcık'),
  (43, 'Merkez'),
  (43, 'Pazarlar'),
  (43, 'Simav'),
  (43, 'Şaphane'),
  (43, 'Tavşanlı'),
  (44, 'Akçadağ'),
  (44, 'Arapgir'),
  (44, 'Arguvan'),
  (44, 'Battalgazi'),
  (44, 'Darende'),
  (44, 'Doğanşehir'),
  (44, 'Doğanyol'),
  (44, 'Hekimhan'),
  (44, 'Kale'),
  (44, 'Kuluncak'),
  (44, 'Pütürge'),
  (44, 'Yazıhan'),
  (44, 'Yeşilyurt'),
  (45, 'Ahmetli'),
  (45, 'Akhisar'),
  (45, 'Alaşehir'),
  (45, 'Demirci'),
  (45, 'Gölmarmara'),
  (45, 'Gördes'),
  (45, 'Kırkağaç'),
  (45, 'Köprübaşı'),
  (45, 'Kula'),
  (45, 'Salihli'),
  (45, 'Sarıgöl'),
  (45, 'Saruhanlı'),
  (45, 'Selendi'),
  (45, 'Soma'),
  (45, 'Şehzadeler'),
  (45, 'Turgutlu'),
  (45, 'Yunusemre'),
  (46, 'Afşin'),
  (46, 'Andırın'),
  (46, 'Çağlayancerit'),
  (46, 'Dulkadiroğlu'),
  (46, 'Ekinözü'),
  (46, 'Elbistan'),
  (46, 'Göksun'),
  (46, 'Nurhak'),
  (46, 'Onikişubat'),
  (46, 'Pazarcık'),
  (46, 'Türkoğlu'),
  (47, 'Artuklu'),
  (47, 'Dargeçit'),
  (47, 'Derik'),
  (47, 'Kızıltepe'),
  (47, 'Mazıdağı'),
  (47, 'Midyat'),
  (47, 'Nusaybin'),
  (47, 'Ömerli'),
  (47, 'Savur'),
  (47, 'Yeşilli'),
  (48, 'Bodrum'),
  (48, 'Dalaman'),
  (48, 'Datça'),
  (48, 'Fethiye'),
  (48, 'Kavaklıdere'),
  (48, 'Köyceğiz'),
  (48, 'Marmaris'),
  (48, 'Menteşe'),
  (48, 'Milas'),
  (48, 'Ortaca'),
  (48, 'Seydikemer'),
  (48, 'Ula'),
  (48, 'Yatağan'),
  (49, 'Bulanık'),
  (49, 'Hasköy'),
  (49, 'Korkut'),
  (49, 'Malazgirt'),
  (49, 'Merkez'),
  (49, 'Varto'),
  (50, 'Acıgöl'),
  (50, 'Avanos'),
  (50, 'Derinkuyu'),
  (50, 'Gülşehir'),
  (50, 'Hacıbektaş'),
  (50, 'Kozaklı'),
  (50, 'Merkez'),
  (50, 'Ürgüp'),
  (51, 'Altunhisar'),
  (51, 'Bor'),
  (51, 'Çamardı'),
  (51, 'Çiftlik'),
  (51, 'Merkez'),
  (51, 'Ulukışla'),
  (52, 'Akkuş'),
  (52, 'Altınordu'),
  (52, 'Aybastı'),
  (52, 'Çamaş'),
  (52, 'Çatalpınar'),
  (52, 'Çaybaşı'),
  (52, 'Fatsa'),
  (52, 'Gölköy'),
  (52, 'Gülyalı'),
  (52, 'Gürgentepe'),
  (52, 'İkizce'),
  (52, 'Kabadüz'),
  (52, 'Kabataş'),
  (52, 'Korgan'),
  (52, 'Kumru'),
  (52, 'Mesudiye'),
  (52, 'Perşembe'),
  (52, 'Ulubey'),
  (52, 'Ünye'),
  (53, 'Ardeşen'),
  (53, 'Çamlıhemşin'),
  (53, 'Çayeli'),
  (53, 'Derepazarı'),
  (53, 'Fındıklı'),
  (53, 'Güneysu'),
  (53, 'Hemşin'),
  (53, 'İkizdere'),
  (53, 'İyidere'),
  (53, 'Kalkandere'),
  (53, 'Merkez'),
  (53, 'Pazar'),
  (54, 'Adapazarı'),
  (54, 'Akyazı'),
  (54, 'Arifiye'),
  (54, 'Erenler'),
  (54, 'Ferizli'),
  (54, 'Geyve'),
  (54, 'Hendek'),
  (54, 'Karapürçek'),
  (54, 'Karasu'),
  (54, 'Kaynarca'),
  (54, 'Kocaali'),
  (54, 'Pamukova'),
  (54, 'Sapanca'),
  (54, 'Serdivan'),
  (54, 'Söğütlü'),
  (54, 'Taraklı'),
  (55, '19 Mayıs'),
  (55, 'Alaçam'),
  (55, 'Asarcık'),
  (55, 'Atakum'),
  (55, 'Ayvacık'),
  (55, 'Bafra'),
  (55, 'Canik'),
  (55, 'Çarşamba'),
  (55, 'Havza'),
  (55, 'İlkadım'),
  (55, 'Kavak'),
  (55, 'Ladik'),
  (55, 'Salıpazarı'),
  (55, 'Tekkeköy'),
  (55, 'Terme'),
  (55, 'Vezirköprü'),
  (55, 'Yakakent'),
  (56, 'Baykan'),
  (56, 'Eruh'),
  (56, 'Kurtalan'),
  (56, 'Merkez'),
  (56, 'Pervari'),
  (56, 'Şirvan'),
  (56, 'Tillo'),
  (57, 'Ayancık'),
  (57, 'Boyabat'),
  (57, 'Dikmen'),
  (57, 'Durağan'),
  (57, 'Erfelek'),
  (57, 'Gerze'),
  (57, 'Merkez'),
  (57, 'Saraydüzü'),
  (57, 'Türkeli'),
  (58, 'Akıncılar'),
  (58, 'Altınyayla'),
  (58, 'Divriği'),
  (58, 'Doğanşar'),
  (58, 'Gemerek'),
  (58, 'Gölova'),
  (58, 'Gürün'),
  (58, 'Hafik'),
  (58, 'İmranlı'),
  (58, 'Kangal'),
  (58, 'Koyulhisar'),
  (58, 'Merkez'),
  (58, 'Suşehri'),
  (58, 'Şarkışla'),
  (58, 'Ulaş'),
  (58, 'Yıldızeli'),
  (58, 'Zara'),
  (59, 'Çerkezköy'),
  (59, 'Çorlu'),
  (59, 'Ergene'),
  (59, 'Hayrabolu'),
  (59, 'Kapaklı'),
  (59, 'Malkara'),
  (59, 'Marmaraereğlisi'),
  (59, 'Muratlı'),
  (59, 'Saray'),
  (59, 'Süleymanpaşa'),
  (59, 'Şarköy'),
  (60, 'Almus'),
  (60, 'Artova'),
  (60, 'Başçiftlik'),
  (60, 'Erbaa'),
  (60, 'Merkez'),
  (60, 'Niksar'),
  (60, 'Pazar'),
  (60, 'Reşadiye'),
  (60, 'Sulusaray'),
  (60, 'Turhal'),
  (60, 'Yeşilyurt'),
  (60, 'Zile'),
  (61, 'Akçaabat'),
  (61, 'Araklı'),
  (61, 'Arsin'),
  (61, 'Beşikdüzü'),
  (61, 'Çarşıbaşı'),
  (61, 'Çaykara'),
  (61, 'Dernekpazarı'),
  (61, 'Düzköy'),
  (61, 'Hayrat'),
  (61, 'Köprübaşı'),
  (61, 'Maçka'),
  (61, 'Of'),
  (61, 'Ortahisar'),
  (61, 'Sürmene'),
  (61, 'Şalpazarı'),
  (61, 'Tonya'),
  (61, 'Vakfıkebir'),
  (61, 'Yomra'),
  (62, 'Çemişgezek'),
  (62, 'Hozat'),
  (62, 'Mazgirt'),
  (62, 'Merkez'),
  (62, 'Nazımiye'),
  (62, 'Ovacık'),
  (62, 'Pertek'),
  (62, 'Pülümür'),
  (63, 'Akçakale'),
  (63, 'Birecik'),
  (63, 'Bozova'),
  (63, 'Ceylanpınar'),
  (63, 'Eyyübiye'),
  (63, 'Halfeti'),
  (63, 'Haliliye'),
  (63, 'Harran'),
  (63, 'Hilvan'),
  (63, 'Karaköprü'),
  (63, 'Siverek'),
  (63, 'Suruç'),
  (63, 'Viranşehir'),
  (64, 'Banaz'),
  (64, 'Eşme'),
  (64, 'Karahallı'),
  (64, 'Merkez'),
  (64, 'Sivaslı'),
  (64, 'Ulubey'),
  (65, 'Bahçesaray'),
  (65, 'Başkale'),
  (65, 'Çaldıran'),
  (65, 'Çatak'),
  (65, 'Edremit'),
  (65, 'Erciş'),
  (65, 'Gevaş'),
  (65, 'Gürpınar'),
  (65, 'İpekyolu'),
  (65, 'Muradiye'),
  (65, 'Özalp'),
  (65, 'Saray'),
  (65, 'Tuşba'),
  (66, 'Akdağmadeni'),
  (66, 'Aydıncık'),
  (66, 'Boğazlıyan'),
  (66, 'Çandır'),
  (66, 'Çayıralan'),
  (66, 'Çekerek'),
  (66, 'Kadışehri'),
  (66, 'Merkez'),
  (66, 'Saraykent'),
  (66, 'Sarıkaya'),
  (66, 'Sorgun'),
  (66, 'Şefaatli'),
  (66, 'Yenifakılı'),
  (66, 'Yerköy'),
  (67, 'Alaplı'),
  (67, 'Çaycuma'),
  (67, 'Devrek'),
  (67, 'Ereğli'),
  (67, 'Gökçebey'),
  (67, 'Kilimli'),
  (67, 'Kozlu'),
  (67, 'Merkez'),
  (68, 'Ağaçören'),
  (68, 'Eskil'),
  (68, 'Gülağaç'),
  (68, 'Güzelyurt'),
  (68, 'Merkez'),
  (68, 'Ortaköy'),
  (68, 'Sarıyahşi'),
  (68, 'Sultanhanı'),
  (69, 'Aydıntepe'),
  (69, 'Demirözü'),
  (69, 'Merkez'),
  (70, 'Ayrancı'),
  (70, 'Başyayla'),
  (70, 'Ermenek'),
  (70, 'Kazımkarabekir'),
  (70, 'Merkez'),
  (70, 'Sarıveliler'),
  (71, 'Bahşılı'),
  (71, 'Balışeyh'),
  (71, 'Çelebi'),
  (71, 'Delice'),
  (71, 'Karakeçili'),
  (71, 'Keskin'),
  (71, 'Merkez'),
  (71, 'Sulakyurt'),
  (71, 'Yahşihan'),
  (72, 'Beşiri'),
  (72, 'Gercüş'),
  (72, 'Hasankeyf'),
  (72, 'Kozluk'),
  (72, 'Merkez'),
  (72, 'Sason'),
  (73, 'Beytüşşebap'),
  (73, 'Cizre'),
  (73, 'Güçlükonak'),
  (73, 'İdil'),
  (73, 'Merkez'),
  (73, 'Silopi'),
  (73, 'Uludere'),
  (74, 'Amasra'),
  (74, 'Kurucaşile'),
  (74, 'Merkez'),
  (74, 'Ulus'),
  (75, 'Çıldır'),
  (75, 'Damal'),
  (75, 'Göle'),
  (75, 'Hanak'),
  (75, 'Merkez'),
  (75, 'Posof'),
  (76, 'Aralık'),
  (76, 'Karakoyunlu'),
  (76, 'Merkez'),
  (76, 'Tuzluca'),
  (77, 'Altınova'),
  (77, 'Armutlu'),
  (77, 'Çınarcık'),
  (77, 'Çiftlikköy'),
  (77, 'Merkez'),
  (77, 'Termal'),
  (78, 'Eflani'),
  (78, 'Eskipazar'),
  (78, 'Merkez'),
  (78, 'Ovacık'),
  (78, 'Safranbolu'),
  (78, 'Yenice'),
  (79, 'Elbeyli'),
  (79, 'Merkez'),
  (79, 'Musabeyli'),
  (79, 'Polateli'),
  (80, 'Bahçe'),
  (80, 'Düziçi'),
  (80, 'Hasanbeyli'),
  (80, 'Kadirli'),
  (80, 'Merkez'),
  (80, 'Sumbas'),
  (80, 'Toprakkale'),
  (81, 'Akçakoca'),
  (81, 'Cumayeri'),
  (81, 'Çilimli'),
  (81, 'Gölyaka'),
  (81, 'Gümüşova'),
  (81, 'Kaynaşlı'),
  (81, 'Merkez'),
  (81, 'Yığılca')
on conflict do nothing;


-- ── 3. `district_official` TÜRETİCİSİ ───────────────────────────────────────
--
-- 🎯 ASIL KAZANÇ BURADA. Deno'nun ilçe listesine erişememesi sorunu, Deno'ya
--    liste vermekle DEĞİL, kararı DB'ye taşımakla çözülüyor. Böylece dört yazma
--    yolunun (form, WhatsApp, moderatör, parse-listing) dördü birden aynı
--    cevabı verir — biri güncellenip diğeri unutulamaz.

create or replace function public.ilce_resmi(p_province_id smallint, p_district text)
returns boolean
language sql
stable
parallel safe
set search_path = public
as $$
  select case
    -- ⚠️ NULL girdi `false` DEĞİL `null` döner. "İlçe girilmemiş" ile
    --    "girilen ilçe resmi değil" farklı bilgiler; ikisini `false`ta
    --    birleştirmek veri kaybıdır. Kolon zaten nullable.
    when p_province_id is null or coalesce(p_district, '') = '' then null
    else exists (
      select 1 from public.districts d
      where d.province_id = p_province_id
        and public.il_key(d.name) = public.il_key(p_district)
    )
  end
$$;

grant execute on function public.ilce_resmi(smallint, text) to anon, authenticated, service_role;

-- ── `ilan_olustur` entegrasyonu ─────────────────────────────────────────────
--
-- 📄 ÇALIŞTIRILABİLİR HÂLİ: `docs/20260804_ilan_olustur_v41_ilce_resmi.sql` (4 Ağu, #50).
--
-- ⚠️ AŞAĞIDAKİ "Dalga 5 ile AYNI ANDA yapılmalı, yoksa fonksiyon iki kez elden
--    geçer" GEREKÇESİ ARTIK GEÇERSİZ (4 Ağu 2026). v4 3 Ağu'da Dalga 5'ten
--    BAĞIMSIZ çıktı (#26); fonksiyon zaten ikinci kez elden geçecek, yani
--    beklemekle kaçınılan bir maliyet kalmadı — yalnız BEDELİ kaldı: o güne
--    kadar WhatsApp hattından giren her ilanda `district_official` NULL.
--    📌 Bu, "bir kararın gerekçesi ölür ama karar yaşamaya devam eder" deseninin
--       bir örneği. Ertelenmiş her iş, ertelenme SEBEBİ hâlâ geçerli mi diye
--       yeniden okunmalı.
--    ✅ Değişiklik `district_official`e dokunur, `origin_city`/`city`ye DEĞİL —
--       kolon drop'undan bağımsızdır, tek başına çıkar.
--
-- Değişen iki satır (v4 gövdesinde,
-- `docs/20260731_dalga5_metin_kolon_drop.sql` BÖLÜM 1 — 4 Ağu'da işlendi):
--
--    listings INSERT'inde:
--      nullif(p_listing->>'origin_district_official','')::boolean
--    →
--      coalesce(
--        nullif(p_listing->>'origin_district_official','')::boolean,
--        public.ilce_resmi(v_origin_pid, p_listing->>'origin_district')
--      )
--
--    listing_stops INSERT'inde:
--      nullif(t.s->>'district_official','')::boolean
--    →
--      coalesce(
--        nullif(t.s->>'district_official','')::boolean,
--        public.ilce_resmi(sp.id, t.s->>'district')
--      )
--
-- ⚠️ `coalesce` sırası kasıtlı: çağıranın AÇIK değeri kazanır. TS tarafı
--    (`lib/lokasyon.ts`) `locations.json` ile zaten doğru cevabı üretiyor;
--    onu ezmek gereksiz davranış değişikliği olur. Fonksiyon yalnız
--    çağıranın hiç göndermediği durumu (Deno) doldurur.


-- ── 4. DOĞRULAMA ────────────────────────────────────────────────────────────

-- 4.1 Sayı tutuyor mu
-- select count(*) as ilce, count(distinct province_id) as il from public.districts;
-- Beklenen: 973 / 81.

-- 4.2 İlsiz ilçe veya ilçesiz il var mı
-- select p.id, p.name from public.provinces p
--  where not exists (select 1 from public.districts d where d.province_id = p.id);
-- Beklenen: 0 satır.

-- 4.3 ✅ TEK KAYNAK KONTROLÜ — YAZILDI (4 Ağu 2026)
--     `npm run test:districts` → `scripts/test-districts.mts`
--     Bu dosyanın 125-1099 satırlarındaki INSERT bloğunu ayrıştırıp
--     `lib/constants/locations.json` ile ÇİFT YÖNLÜ karşılaştırır: 973/973,
--     81 il, kopya yok, `il_key()` katlaması altında il içi çakışma yok, artı
--     8 çapa kontrol (Ömerli mahalle, Gölbaşı iki ilde, Havza/Orhaneli — 4 Ağu
--     alias hatalarının doğru cevapları, Marmaraereğlisi bitişik, 51 Merkez).
--     Kimlik bilgisi istemez, `test-lokasyon.mts` gibi saf Node.
--
--     ⚠️ KAPSAM SINIRI: JSON ile BU DOSYAYI karşılaştırır, CANLI TABLOYU DEĞİL.
--        Tabloya elle satır eklenirse test görmez. `provinces` ile aynı kural:
--        elle satır ekleme YAPMA, JSON'u düzenle ve bloğu yeniden üret.
--        Canlı sayı kontrolü elle: 4.1.
--     ✔️ Negatif doğrulama yapıldı: bir satırın province_id'si bozulunca test
--        3 kontrolde kırıldı ve farkı isim isim yazdırdı.

-- 4.4 Fonksiyon doğru çalışıyor mu
-- select public.ilce_resmi(34::smallint, 'Çekmeköy')  as t1,   -- true  (İstanbul ilçesi)
--        public.ilce_resmi(34::smallint, 'CEKMEKOY')  as t2,   -- true  (katlama çalışıyor)
--        public.ilce_resmi(34::smallint, 'Ömerli')    as t3,   -- false (mahalle, ilçe değil)
--        public.ilce_resmi(34::smallint, 'Gebze')     as t4,   -- false (Kocaeli ilçesi, İstanbul değil)
--        public.ilce_resmi(41::smallint, 'Gebze')     as t5,   -- true
--        public.ilce_resmi(6::smallint,  'Gölbaşı')   as t6,   -- true  (Ankara)
--        public.ilce_resmi(2::smallint,  'Gölbaşı')   as t7,   -- true  (Adıyaman — ikisi de doğru!)
--        public.ilce_resmi(null,         'Çekmeköy')  as t8,   -- null
--        public.ilce_resmi(34::smallint, null)        as t9;   -- null
--
-- 📌 t6/t7 tasarımın özeti: fonksiyon "hangi il?" sorusunu CEVAPLAMIYOR,
--    "bu il için bu ilçe doğru mu?" sorusunu cevaplıyor. İkisi karıştırılırsa
--    `gölbaşı` alias'ı gibi belirsizlikler yanlış çözülür.

-- 4.5 Mevcut veride ne kadar ilçe resmi değil (temizlik önceliği için)
-- select count(*) filter (where public.ilce_resmi(origin_province_id, origin_district) is true)  as resmi,
--        count(*) filter (where public.ilce_resmi(origin_province_id, origin_district) is false) as resmi_degil,
--        count(*) filter (where public.ilce_resmi(origin_province_id, origin_district) is null)  as belirsiz
--   from public.listings;
--
-- select origin_district, count(*) as adet
--   from public.listings
--  where public.ilce_resmi(origin_province_id, origin_district) is false
--  group by 1 order by 2 desc limit 50;
--
-- 📌 Bu ikinci liste W5 runbook Adım 3 (`district` yazım düzeltmesi) ve Adım 8.2
--    için doğrudan iş listesidir: hem yazım hatalarını (`Avcilar`) hem mahalle
--    girişlerini (`Ömerli`, `Kıraç`) hem de tanınmayanları tek yerde gösterir.
--    Adım 0.3'ün `HAVING count(*) > 1` filtresi TEK yazımı olan bozuk değerleri
--    kaçırıyordu; bu sorgu onları da yakalar.


-- ── 5. GERİ ALMA ────────────────────────────────────────────────────────────
--
-- drop function if exists public.ilce_resmi(smallint, text);
-- drop table if exists public.districts;
--
-- ⚠️ `ilan_olustur` v4'e `ilce_resmi` çağrısı eklendikten SONRA tabloyu
--    düşürmek fonksiyonu kırar (plpgsql DDL'de doğrulanmaz — Dalga 5'in aynı
--    tuzağı). Geri alma sırası: önce RPC'yi eski gövdeye döndür, sonra drop.
