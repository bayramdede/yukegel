# Alias veri bütünlüğü — ÇALIŞTIRMA SIRASI (runbook)

> 29 Temmuz 2026 · W5/D5 · **Bayram çalıştıracak**
> Kod tarafı (W5/D1, D2, D4) bu runbook'tan ÖNCE deploy edilmiş olmalı.
> ~~Durum: Bayram'ın 29 Tem beyanı — iki script'ten hiçbir bölüm çalıştırılmadı.~~
> ⬆️ **Bu satır 4 Ağu 2026'da geçersizleşti.** Güncel durum tablosu hemen aşağıda.

## 🟢 DURUM (4 Ağustos 2026 — beyanla değil, ÖLÇÜLEREK)

Kanıt: `docs/20260804_adim3_4_6_on_kontrol.sql` (yalnız SELECT; çıktısı o dosyanın
SONUÇ KAYDI bölümünde duruyor).

| Adım | Durum | Kanıt |
|---|---|---|
| 1 homonim | ✅ | `araç`/`arac`/`olur` üçü de `is_active = false` |
| 2 `normalized` ASCII | ✅ | sorgu 0 satır |
| 3 `district` yazımı | ✅ | sorgu 0 satır; **liste dışı** bozulma da yok |
| 4 NULL `district` (92) | ✅ | 92/92 dolu, **id–alias eşleşmesi bozulmamış** |
| 5 `payas` | ✅ | 1003 → Hatay/Payas aktif, 1844 pasif |
| 6 elle kararlar | ✅ | beşi de uygulanmış (Kahramankazan ×2, Çekmeköy, Esenyurt, Adıyaman pasif, Artvin pasif) |
| 7 doğrulama | ✅ | iki sorgu da boş |
| 9 katlanmış kopyalar | ✅ | dolaylı ama kesin: `aliases_katlanmis_anahtar_uniq` **canlı**, kopya kalsaydı 23505 ile kurulamazdı |
| **8.2 ilçe onarımı** | ⏳ | `listing_stops.district` `KEMALPAŞA` **17 satır** → görev #44 |
| 8.1 / 8.4 şehir kolonları | ⏭️ | bilinçli atlanıyor — Dalga 5'te düşecek kolonlar |
| **10 trigger** | 🚨 | BÖLÜM 2 (indeks) canlı, **BÖLÜM 1 (`aliases_normalize_trg`) YOK** → görev #43 |

📌 **Bu tablo neden var:** 4 Ağu'ya kadar `PROJE_HARITASI.md`, `COGRAFI_GECIS.md` ve
görev listesi "Adım 3/4/6 bekliyor" diyordu — **üçü de yanlıştı**. Aynı belgeler
trigger'ın canlı olduğunu söylüyordu — **o da yanlıştı**. Kayıt iki yönde birden
kaymıştı, çünkü kimse veriye sormamıştı.
⚠️ Bu tabloyu güncellerken **kanıt sütununu doldur**. "Hatırlıyorum" bir kanıt değil;
bu runbook'un 29 Tem'deki "hiçbir bölüm çalıştırılmadı" satırı da bir beyandı.

İki hazır script var ama **aralarındaki sıra hiçbir yerde yazılı değildi**. Yanlış
sıra sessizce zarar verir: `kopya BÖLÜM 3` (NULL ilçeleri doldurma) kaynak olarak
`BÖLÜM 2`'nin düzelttiği değerleri kullanıyor; ters sırada bozuk yazımı yayar.

Dosyalar:

- `docs/20260728_alias_homonim_temizligi.sql` → **H** olarak kısaltıldı
- `docs/20260728_alias_kopya_temizligi.sql` → **K** olarak kısaltıldı

Genel kural: **hiçbir adım satır silmiyor.** Hepsi `UPDATE` ya da
`is_active = false`; her adımın geri alması var. Script'lerdeki `UPDATE`'ler
yorum satırı olarak duruyor — önce önizleme `SELECT`'ini çalıştır, çıktı beklediğin
gibiyse `--` işaretlerini kaldırıp uygula.

---

## Adım 0 — Başlangıç ölçümleri (ATLAMA)

Bu sayılar düzeltmeden **önce** alınmazsa yapılan işin etkisi bir daha ölçülemez.

> 🚨 **ŞEMA DÜZELTMESİ (29 Tem 2026).** Bu bölümün ilk hâli `listings.destination_city`
> üzerinden ölçüyordu. **Yanlıştı, iki sebepten:**
>
> 1. **Varış o kolonda değil.** Kalkış tek (`listings.origin_city`) ama uğramalar çok, o
>    yüzden varışlar `public.listing_stops` satırlarında duruyor (`listing_id`, `stop_order`,
>    `city`, `district`, …). `parse-listing` ilanı `origin_city` ile açıp her varışı
>    `listing_stops`'a yazıyor (satır ~825). Varış filtresi de `listing_stops.city`'ye
>    bakıyor (`HomeClient.tsx:696`).
>    🚨🚨 **İKİNCİ DÜZELTME (31 Tem 2026, #28).** Buraya "`destination_city`'yi hiçbir
>    uygulama kodu yazmıyor ve okumuyor, yani eski **ölü kolon**" yazılmıştı. O da
>    yanlıştı. Doğru gözlem ("tüm repoda yalnız SQL/doc dosyalarında geçiyor") doğru
>    olmayan sonuca bağlanmış: kodda geçmemesinin sebebi kolonun terk edilmiş olması
>    değil, **hiç var olmaması**. `information_schema.columns` boş döndü, sorgu 42703
>    verdi. "Ölü" nitelemesi zararsız görünüyordu ama bir iş kalemi doğurdu — madde
>    Dalga 5 drop listesine, W5 devrine ve iki SQL dosyasına "sonra düşürülecek" diye
>    yazıldı; hepsi 42703 verecekti.
> 2. **Aynı şehirde taşıma MEŞRU.** Şehir içi nakliye gerçek bir iş; `kalkış = varış`
>    olması tek başına sahte güzergâh demek değil. Eşitliği "sahte" saymak gerçek ilanları
>    suçlar.
>
> Bug'ın **gerçek parmak izi** şu: kalkış ile durak **katlanmış anahtar olarak aynı şehir
> AMA ham yazımları farklı** (`Istanbul` → `İstanbul`). Bu kombinasyon meşru şehir içi
> taşımada oluşmaz, çünkü meşru kayıtta iki taraf da aynı yazımı kullanır. Ölçüm buna
> göre yazıldı.

```sql
-- 0.1 🎯 SAHTE GÜZERGÂH ADAYLARI — D4'ün etkisini bununla kanıtlayacağız.
-- Katlanmış hâli aynı, ham yazımı FARKLI olan kalkış/durak çiftleri.
SELECT count(*)            AS sahte_aday_satir,
       count(DISTINCT l.id) AS etkilenen_ilan
FROM public.listings l
JOIN public.listing_stops s ON s.listing_id = l.id
WHERE translate(lower(replace(l.origin_city,'İ','i')),'ıçğöşü','icgosu')
    = translate(lower(replace(s.city,'İ','i')),'ıçğöşü','icgosu')
  AND l.origin_city <> s.city;

-- 0.1b Aynı sorgunun DÖKÜMÜ — ilçelere bakarak gerçekten sahte mi diye karar ver.
-- İki taraf da ilçesizse güçlü sahte sinyali (bug ilçesiz eşleşmelerden doğuyordu).
SELECT l.id, l.origin_city, l.origin_district, s.stop_order, s.city, s.district,
       l.created_at::date AS tarih, l.source, l.moderation_status
FROM public.listings l
JOIN public.listing_stops s ON s.listing_id = l.id
WHERE translate(lower(replace(l.origin_city,'İ','i')),'ıçğöşü','icgosu')
    = translate(lower(replace(s.city,'İ','i')),'ıçğöşü','icgosu')
  AND l.origin_city <> s.city
ORDER BY l.created_at DESC
LIMIT 100;

-- 0.2 ⚖️ KARŞILAŞTIRMA TABANI — MEŞRU şehir içi taşıma (aynı şehir, aynı yazım).
-- Bu sayı SAHTE DEĞİL; 0.1'i yorumlarken ölçek vermesi için alıyoruz.
SELECT count(*)             AS sehir_ici_satir,
       count(DISTINCT l.id) AS sehir_ici_ilan,
       count(*) FILTER (WHERE l.origin_district IS DISTINCT FROM s.district) AS farkli_ilce
FROM public.listings l
JOIN public.listing_stops s ON s.listing_id = l.id
WHERE l.origin_city = s.city;

-- 0.3 Bozuk yazımların DÖRT canlı konum kolonundaki dağılımı (Adım 8 önizlemesi).
-- Parmak izi 0.1 ile aynı: katlanmış anahtarı aynı, ham yazımı FARKLI olan
-- değerler. "Türkçe harf içermiyor" testi kullanılamaz — 'Fatih' zaten doğru.
WITH tum_degerler AS (
  SELECT 'listings.origin_city'     AS kolon, origin_city     AS deger FROM public.listings
  UNION ALL
  SELECT 'listings.origin_district', origin_district          FROM public.listings
  UNION ALL
  SELECT 'listing_stops.city',       city                    FROM public.listing_stops
  UNION ALL
  SELECT 'listing_stops.district',   district                FROM public.listing_stops
), sayim AS (
  SELECT kolon, deger,
         translate(lower(replace(deger,'İ','i')),'ıçğöşü','icgosu') AS anahtar,
         count(*) AS adet
  FROM tum_degerler WHERE deger IS NOT NULL AND deger <> ''
  GROUP BY 1,2,3
)
SELECT kolon, anahtar,
       count(*)                            AS farkli_yazim,
       array_agg(deger ORDER BY adet DESC) AS yazimlar,
       array_agg(adet  ORDER BY adet DESC) AS adetler
FROM sayim
GROUP BY kolon, anahtar
HAVING count(*) > 1
ORDER BY 3 DESC, 2;

-- 🚫 0.4 SORU DÜŞTÜ — ÇALIŞTIRMA (31 Tem 2026, #28). Aşağıdaki sorgu
--    `ERROR: 42703: column "destination_city" does not exist` verir.
--    Soru "kolon ölü mü?" diye sorulmuştu; doğru cevap **kolon hiç yok**.
--    Dolayısıyla "ölü kolonu düşür" bileti de açılmaz — düşürülecek şey yok.
-- SELECT count(*) AS dolu_destination_city FROM public.listings WHERE destination_city IS NOT NULL;
```

Çıktıların hepsini bir yere kaydet (tarih + sayı yeter). **0.1 ile 0.2'yi karıştırma:**
0.1 düzeltilecek hasar, 0.2 korunacak gerçek iş.

---

## ✅ ÖLÇÜM SONUÇLARI — 29 Temmuz 2026 (Adım 0 çalıştırıldı)

| Sorgu | Sonuç |
|---|---|
| **0.1 sahte güzergâh adayı** | **0 satır / 0 ilan** |
| **0.2 meşru şehir içi taşıma** | 6.173 satır / 6.122 ilan; 1.465'i farklı ilçe |
| **0.3 katlanmış anahtar çakışması** | **16 grup / ~88 satır** (4 kolonun tamamında) |
| **0.4 `destination_city`** | 🚫 **SORU DÜŞTÜ (31 Tem 2026) — KOLON YOK.** Sorgu `42703: column "destination_city" does not exist` verdi, `information_schema.columns` teyit etti. Önceki not "hâlâ ölçülmedi, yanlışlıkla `listing_stops.city` sorgulandı" diyordu; asıl mesele o karışıklık değil, **ölçülecek kolonun hiç var olmaması**. Ölçüm de, "düşür" bileti de düştü. |

**0.1 = 0 → geçmişte sahte güzergâh HASARI YOK.** Yazım farkından doğmuş tek bir
bozuk güzergâh bile bulunamadı. D4'ün değeri geriye dönük onarım değil,
**bundan sonrasını önlemek**; ölçülebilir "önce/sonra" farkı olmayacak.
`YAPILACAKLAR.md`'deki "sahte güzergâhlı satırların kaderi" bileti bu ölçümle
kapandı.

**0.2 → 6.122 ilan şehir içi ve bunlar meşru.** 244.379 durak satırının %2,5'i.
Ayrıca 6.173 − 1.465 = **4.708 satırda ilçe de aynı** (ya gerçekten aynı ilçe ya
da iki tarafta da `NULL` — `IS DISTINCT FROM` ikisini ayırmıyor). Bu küme "sahte"
diye elenmemeli; büyük kısmı ilçesi hiç girilmemiş kaba veri.

**0.3 → hasar ilçelerde ve iki AYRI türde.** Beklenen tek türü değil, ikisini
buldu:

| Tür | Örnek | Satır |
|---|---|---|
| ASCII bozulması (W5'in beklediği) | `Istanbul` 3 · `Bingol` 5 · `Cekmekoy` 2 · `Avcilar` 1 · `Eyyubiye` 1 | **~12** |
| 🆕 **TAMAMI BÜYÜK HARF** | `ÇORLU` 42 · `KEMALPAŞA` 17 · `ÇERKEZKÖY` 6 · `NİLÜFER` 3 · `MUDANYA` 2 · `LÜLEBURGAZ` 2 · `KEŞAN`/`MİLAS`/`GELİBOLU`/`OSMANGAZİ` 1'er | **~76** |

> 🆕 **BÜYÜK HARF kategorisi devir notunda yoktu ve zararı gerçek.** Yazım
> Türkçe olarak DOĞRU, yalnız kasası bozuk — ama `HomeClient.tsx:696` filtresi
> `d.sehir?.includes(varis)` ile **büyük/küçük harf duyarlı** çalışıyor, yani
> `ÇORLU` kayıtlı bir durak "Çorlu" aramasında **hiç çıkmıyor**. Adım 8'in
> sözlük yaklaşımı bunu kendiliğinden onarır (ham değer sözlükteki doğru
> yazımdan farklıysa güncellenir); elle `CASE` listesi onaramazdı.
>
> ⚠️ `KEMALPAŞA` (17) doğru yazımdan (11) **daha kalabalık**. Bu yüzden Adım 8
> **çoğunluk yazımını değil `aliases` sözlüğünü** kullanıyor — çoğunluk mantığı
> burada yanlış değeri seçerdi.

**Eski BÖLÜM 6 bu veride ne yapardı:** sabit `('Istanbul','Izmir','Mugla','Bingol')`
listesi 16 grubun **13'ünü ıskalardı** (`Avcilar`, `Cekmekoy`, `Eyyubiye` ve
büyük-harf grubunun tamamı), üstelik `Izmir`/`Mugla` bu veride hiç yok. Sözlük
yaklaşımının somut gerekçesi bu.

**Dağılım kolon bazında:** hasar ağırlıkla **ilçelerde** —
`listing_stops.district` 11 grup, `listings.origin_district` 3, `listing_stops.city`
1, `listings.origin_city` 1 (22.471 `İstanbul`'a karşı 3 `Istanbul`). Çıkış şehri
pratikte temiz.

~~**Sırada:** 0.4'ü doğru sorguyla tekrarla (`FROM public.listings WHERE
destination_city IS NOT NULL`) — ölü kolonu düşürme bileti buna bağlı.~~
🚫 **31 Tem 2026 (#28): tekrarlandı ve `42703` döndü — KOLON YOK.** "Ölü kolonu
düşürme bileti" diye bir iş de yok. Bu satır, yanlış bir varsayımın kendini nasıl
sürdürdüğünün örneği: ilk ölçüm yanlış tabloya gitti, sonuç "ölçülmedi" diye
işaretlendi, ve kolonun VARLIĞI hiç sorgulanmadan "ölü" kabul edildi.

---

## Adım 1 — H / ADIM 3: homonim alias'ları pasifleştir

`araç`, `arac`, `olur` → `is_active = false`.

Neden ilk: bu üç alias **her mesajda** sahte şehir üretiyor, yani sonraki
ölçümleri de kirletiyor. `araç` 3000 mesajın **580'inde** (%19) tetikleniyor —
Bursa'nın (534) bile üstünde. `olur` yerel testte doğrulandı:
`"…KAMYONDA OLUR"` → sahte Erzurum eşleşmesi.

Önce H/ADIM 3'ün önizleme `SELECT`'i, sonra `UPDATE`.

**Bedeli:** Kastamonu/Araç ve Erzurum/Olur gerçekten geçtiğinde artık
yakalanmaz. Bilinçli takas. Geri alma: aynı `WHERE` ile `is_active = true`.

> H/ADIM 1 ve ADIM 2 yalnızca ölçüm sorgusudur; istersen çalıştır, zorunlu değil.
> ADIM 4 bir açıklama bölümü — çalıştırılacak bir şey yok.

---

## Adım 2 — K / BÖLÜM 1: `normalized` ASCII bozulması

`Istanbul → İstanbul` (13 satır), `Izmir → İzmir`, `Mugla → Muğla`,
`Bingol → Bingöl`. Toplam 16 satır.

**Sahte `İstanbul→İstanbul` güzergâhının doğrudan sebebi bu.** Kod tarafı (D4)
artık karşılaştırmayı katlanmış anahtarla yaptığı için bug bir daha çıkmaz, ama
şehir filtresi hâlâ ham değere bakıyor — yani bu adım olmadan kullanıcı İstanbul
filtresinde 13 alias'a bağlı ilanları göremez.

---

## Adım 3 — K / BÖLÜM 2: `district` yazım bozulması

11 ilçe adı (`Avcilar → Avcılar`, `Hadimkoy → Hadımköy`, …).
**BÖLÜM 3'ten önce çalışmak ZORUNDA** — BÖLÜM 3 bu değerleri kaynak alıyor.

---

## Adım 4 — K / BÖLÜM 3: kopya gruplarındaki NULL `district`'leri doldur

92 satır, tamamen mekanik. Çelişkili olanlar bilinçli olarak BÖLÜM 4'e ayrılmış,
burada yok.

---

## Adım 5 — K / BÖLÜM 4.1: `payas` 🚨

```sql
UPDATE public.aliases SET normalized = 'Hatay', district = 'Payas' WHERE id = 1003;
```

**Bu bir gerçek veri hatası, tercih değil.** Payas 2008'den beri **Hatay**
ilçesi. `id = 1003` "Adana" diyor ve alias listesi `.order('id')` ile çekildiği
için **küçük id kazanıyor** → bugün her `payas` ilanı Adana'ya yazılıyor.
Doğru satır (`id = 1844`) tabloda zaten duruyor.

---

## Adım 6 — K / BÖLÜM 4.2–4.6: elle karar gerektirenler

Sırayla bak, istemediğini atla. Her birinin gerekçesi script içinde:

- **4.2 `kazan`** → ilçe adı 2016'da Kahramankazan oldu.
- **4.3 `ömerli`** → mahalle; ilçesi Çekmeköy.
- **4.4 `kıraç`** → mahalle; ilçesi Esenyurt.
- **4.5 `gölbaşı`** → gerçek belirsizlik (Ankara / Adıyaman). Ankara bırakılıp
  Adıyaman pasifleştiriliyor — `araç` ile aynı mantık, aynı takas.
- **4.6 `kemalpaşa`** → İzmir ilçesi vs Artvin beldesi; mevcut davranışı korur.

### 📊 Ölçüme göre öncelik (Adım 0.3 çıktısı, 29 Tem 2026)

Beşinin hepsi alias hijyeni açısından doğru, ama **gerçek `listings` verisine dokunanı
ikisi**. Zaman kısıtlıysan sıra şu:

| Karar | `listings`/`listing_stops` verisinde izi | Öncelik |
|---|---|---|
| **4.6 `kemalpaşa`** | ✅ **28 satır** — `KEMALPAŞA` 17 + `Kemalpaşa` 11 | 🔴 **Zorunlu** |
| **4.3 `ömerli`** | ✅ `Cekmekoy` 2 satır (Ömerli'nin ilçesi) | 🟡 Yap |
| 4.2 `kazan` | ❌ yok | 🟢 İstersen |
| 4.4 `kıraç` | ❌ yok | 🟢 İstersen |
| 4.5 `gölbaşı` | ❌ yok | 🟢 İstersen |

> 🚨 **4.6 Adım 8'i bloke edebilir.** Adım 8'in sözlüğü `HAVING count(DISTINCT normalized) = 1`
> ile korunuyor: `kemalpasa` anahtarında **iki farklı `normalized` yazımı** aktif kalırsa o
> anahtar sözlüğe hiç girmez ve **28 satır onarılmaz**. İki alias'ın (İzmir ilçesi / Artvin
> beldesi) `normalized` değeri **aynı** (`Kemalpaşa`) olduğu sürece sorun yok — ayrıştıkları
> yer `district`. 4.6'yı uygularken `normalized` kolonunu değiştirmemeye dikkat et, ve
> Adım 8'e geçmeden **8.0 ön-kontrolünü** çalıştır.

---

## Adım 7 — K / BÖLÜM 5: doğrulama

**İki sorgu da BOŞ dönmeli.** Dönmüyorsa dur, çıktıyı kaydet ve raporla —
sonraki adımlara geçme.

---

## Adım 8 — geçmiş konum verisinin onarımı (K / BÖLÜM 6 **yetersiz**)

> 🚨 **K / BÖLÜM 6'yı olduğu gibi çalıştırmak işi bitirmez.** O bölüm yalnız
> `listings.origin_city` ve `listings.destination_city`'yi onarıyor. Oysa:
>
> - **`listings.destination_city` diye bir kolon YOK** (31 Tem 2026, #28 — 42703).
>   Buraya önce "ölü bir kolon" yazılmıştı; yanlıştı. Onarmak boşa iş DEĞİL,
>   doğrudan hata: BÖLÜM 6'nın o UPDATE'i ilk satırda patlar.
> - **Varış verisi `public.listing_stops` içinde.** Ana sayfa varış filtresi
>   (`app/_components/HomeClient.tsx:696`) tam olarak `listing_stops.city`'yi
>   okuyor. Yani kullanıcının "İstanbul'a yük" aramasını bozan kolon burada ve
>   BÖLÜM 6 ona **hiç dokunmuyor**.
> - **`listings.origin_district` de onarılmıyor.**
>
> Bu haliyle temizlik bitse bile bozuk varışlar bozuk kalır. Aşağıdaki dört
> kolonu birlikte onar.

Onarım için elle `CASE` listesi yazmak yerine **`aliases` tablosunu sözlük**
olarak kullan: Adım 2-7 bittiğinde `normalized` ve `district` kolonları doğru
yazımı tutuyor. Katlanmış anahtarı eşleşen ama ham yazımı farklı olan her
konum değeri, sözlükteki doğru yazıma çekilir.

**8.0 — Sözlük kapsama ön-kontrolü (8.1'den ÖNCE çalıştır).**
Adım 0.3'te bulunan her çakışma anahtarının sözlükte **tek bir doğru yazımla** karşılığı
var mı? Olmayan anahtar sessizce onarılmadan kalır — 8.1/8.2 hata vermez, sadece o satırlara
dokunmaz. Bu sorgu "onarılamayacak" anahtarları önden listeler:

```sql
WITH tum_degerler AS (
  SELECT 'city'     AS tur, origin_city     AS deger FROM public.listings
  UNION ALL SELECT 'district', origin_district FROM public.listings
  UNION ALL SELECT 'city',     city            FROM public.listing_stops
  UNION ALL SELECT 'district', district        FROM public.listing_stops
), cakisan AS (
  SELECT tur, translate(lower(replace(deger,'İ','i')),'ıçğöşü','icgosu') AS anahtar,
         count(DISTINCT deger) AS farkli_yazim
  FROM tum_degerler WHERE deger IS NOT NULL AND deger <> ''
  GROUP BY 1,2 HAVING count(DISTINCT deger) > 1
), sozluk AS (
  SELECT type AS tur,
         translate(lower(replace(coalesce(normalized,alias),'İ','i')),'ıçğöşü','icgosu') AS anahtar,
         count(DISTINCT coalesce(normalized,alias)) AS sozluk_yazim
  FROM public.aliases
  WHERE is_active = true AND type IN ('city','district')
  GROUP BY 1,2
)
SELECT c.tur, c.anahtar, c.farkli_yazim, s.sozluk_yazim,
       CASE WHEN s.anahtar IS NULL       THEN '❌ sözlükte YOK — elle düzelt'
            WHEN s.sozluk_yazim > 1      THEN '❌ sözlükte ÇOK yazım — Adım 6 eksik'
            ELSE                              '✅ onarılabilir' END AS durum
FROM cakisan c
LEFT JOIN sozluk s ON s.tur = c.tur AND s.anahtar = c.anahtar
ORDER BY 5 DESC, 1, 2;
```

**Beklenen: 16 satırın tamamı `✅ onarılabilir`.** `❌` gören anahtarları 8.1/8.2 atlar;
onları ya `aliases`'a doğru yazımıyla ekle, ya da Adım 6'daki ilgili kararı tamamla
(özellikle `kemalpasa` — bkz. Adım 6 uyarısı).

**8.1 — Şehir kolonları (`listings.origin_city`, `listing_stops.city`).**
Önce `SELECT` ile bak, sonra `UPDATE`'e çevir:

```sql
WITH sozluk AS (
  SELECT translate(lower(replace(normalized,'İ','i')),'ıçğöşü','icgosu') AS anahtar,
         min(normalized) AS dogru
  FROM public.aliases
  WHERE type = 'city' AND is_active = true AND normalized IS NOT NULL
  GROUP BY 1
  HAVING count(DISTINCT normalized) = 1   -- belirsiz anahtarları elle bırak
)
SELECT 'listings.origin_city' AS kolon, l.id, l.origin_city AS mevcut, z.dogru
FROM public.listings l
JOIN sozluk z ON z.anahtar = translate(lower(replace(l.origin_city,'İ','i')),'ıçğöşü','icgosu')
WHERE l.origin_city IS NOT NULL AND l.origin_city <> z.dogru
UNION ALL
SELECT 'listing_stops.city', s.listing_id, s.city, z.dogru
FROM public.listing_stops s
JOIN sozluk z ON z.anahtar = translate(lower(replace(s.city,'İ','i')),'ıçğöşü','icgosu')
WHERE s.city IS NOT NULL AND s.city <> z.dogru;
```

`HAVING count(DISTINCT normalized) = 1` şartı önemli: aynı katlanmış anahtara
iki farklı doğru yazım düşüyorsa (Adım 7 boş dönmediyse olur) o anahtar
sözlüğe **girmez** ve o satırlar onarılmadan kalır — yanlış yazımı yanlış
yazımla değiştirmekten iyidir.

> 🚨 `min(normalized)` **doğru yazımı seçmiyor** — `HAVING` şartı yüzünden grupta
> tek değer kaldığı için no-op. Şartı kaldırıp `min()`'e güvenmeye kalkma:
> C/`en_US` collation'da `'I'` (0x49) < `'İ'` (0xC4B0), yani `min()` tam olarak
> **bozuk ASCII yazımı** seçer. Sözlüğün doğruluğu Adım 2-7'nin `aliases`
> tablosunu temizlemiş olmasına dayanıyor; **Adım 8 Adım 7'den sonra çalışır.**

Liste beklendiği gibiyse uygula:

```sql
-- WITH sozluk AS ( ... yukarıdaki CTE aynen ... )
-- UPDATE public.listings l SET origin_city = z.dogru
-- FROM sozluk z
-- WHERE z.anahtar = translate(lower(replace(l.origin_city,'İ','i')),'ıçğöşü','icgosu')
--   AND l.origin_city IS NOT NULL AND l.origin_city <> z.dogru;

-- WITH sozluk AS ( ... aynı CTE ... )
-- UPDATE public.listing_stops s SET city = z.dogru
-- FROM sozluk z
-- WHERE z.anahtar = translate(lower(replace(s.city,'İ','i')),'ıçğöşü','icgosu')
--   AND s.city IS NOT NULL AND s.city <> z.dogru;
```

**8.2 — İlçe kolonları (`listings.origin_district`, `listing_stops.district`).**
Aynı kalıp, sözlük `aliases.district`'ten kuruluyor:

```sql
WITH sozluk AS (
  SELECT translate(lower(replace(district,'İ','i')),'ıçğöşü','icgosu') AS anahtar,
         min(district) AS dogru
  FROM public.aliases
  WHERE type = 'city' AND is_active = true AND district IS NOT NULL
  GROUP BY 1
  HAVING count(DISTINCT district) = 1
)
SELECT 'listings.origin_district' AS kolon, l.id, l.origin_district AS mevcut, z.dogru
FROM public.listings l
JOIN sozluk z ON z.anahtar = translate(lower(replace(l.origin_district,'İ','i')),'ıçğöşü','icgosu')
WHERE l.origin_district IS NOT NULL AND l.origin_district <> z.dogru
UNION ALL
SELECT 'listing_stops.district', s.listing_id, s.district, z.dogru
FROM public.listing_stops s
JOIN sozluk z ON z.anahtar = translate(lower(replace(s.district,'İ','i')),'ıçğöşü','icgosu')
WHERE s.district IS NOT NULL AND s.district <> z.dogru;
```

`UPDATE` karşılıkları 8.1 ile birebir aynı kalıp — kolon adlarını değiştir.

**8.3 — `destination_city`.** 🚫 **ADIM DÜŞTÜ (31 Tem 2026, #28): KOLON YOK.**
Eski metin "0.4 sıfır döndüyse dokunma, düşürmek için ayrı bilet aç" diyordu —
her iki dal da kolonun var olduğunu varsayıyordu. `information_schema.columns`
teyit etti: `public.listings` içinde böyle bir kolon hiç yok. Ne onarım var,
ne düşürme bileti. Varış verisinin tamamı `listing_stops.city`'de (8.2).

**8.4 — Tekrar ölç.** Adım 0.1'i **aynen** tekrar çalıştır:

```sql
SELECT count(*) AS sahte_aday_satir, count(DISTINCT l.id) AS etkilenen_ilan
FROM public.listings l
JOIN public.listing_stops s ON s.listing_id = l.id
WHERE translate(lower(replace(l.origin_city,'İ','i')),'ıçğöşü','icgosu')
    = translate(lower(replace(s.city,'İ','i')),'ıçğöşü','icgosu')
  AND l.origin_city <> s.city;
```

**Bu sorgu artık 0 dönmeli.** Çünkü 8.1 iki kolonu da aynı sözlüğe çektiğine
göre katlanmış anahtarı eşit olan iki değerin ham yazımı da eşittir. 0
dönmüyorsa 8.1'in sözlüğüne girmeyen (`HAVING` şartına takılan) anahtarlar var
demektir — o satırları listele ve elle karara bırak.

⚠️ Dikkat: 8.4'ün 0 dönmesi "sahte güzergâh kalmadı" demek **değil**. Sadece
"yazım farkından doğan sahteler kalmadı" demek. Adım 0.2 ile ölçtüğün
**şehir içi taşımalar meşrudur** ve 8.1'den sonra da durmaya devam edecek —
onlara dokunma. Geçmişte üretilmiş gerçekten sahte güzergâhların (aynı şehir +
aynı ilçe, tek duraklı, AI üretimi) ne yapılacağı ayrı bir karar; **bu
runbook'un kapsamında değil**.

---

## Adım 9 — 🚨 Katlanmış alias kopyaları (D3'ün ÖNKOŞULU — YENİ BULGU)

> Bu adım devir notunda **yoktu**. D3'ün UNIQUE indeksi yazılırken çıktı ve
> indeksin kurulmasını doğrudan engelliyor.

**Sorun:** `alias` kolonu unique — ama bu **ham** string üzerinde. `Gebze`,
`GEBZE`, `gebze` üç ayrı satır olarak duruyor (H/ADIM 4 bunları listeliyor:
`Çorlu`/`çorlu`/`corlu`, `izmir`/`izmır`, `Torbali`/`torbali`/`torbalı`,
`balıkesir`/`balikesir` …). D3'ün indeksi bunların **hepsini aynı anahtara**
katlıyor. Yani kopyalar durduğu sürece indeks **kurulamaz** (23505).

Kopya script'i bu satırları **silmiyor** — sadece `normalized`/`district`
kolonlarını tutarlı hale getiriyor. Dolayısıyla Adım 1-8 tamamlansa bile D3
önkoşulu karşılanmış olmuyor.

**Önce ölç:**

```sql
-- Katlanmış anahtarı aynı olan AKTİF satır grupları
SELECT translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu') AS katlanmis,
       count(*)                          AS satir,
       array_agg(id ORDER BY id)         AS idler,
       array_agg(alias ORDER BY id)      AS yazimlar,
       count(DISTINCT normalized)        AS farkli_normalized,
       count(DISTINCT coalesce(district,'∅')) AS farkli_district
FROM public.aliases
WHERE type = 'city' AND is_active = true
GROUP BY 1
HAVING count(*) > 1
ORDER BY satir DESC, katlanmis;
```

`farkli_normalized` veya `farkli_district` **1'den büyük** satır kaldıysa
Adım 2-7 eksik kalmış demektir — geri dön, tamamla. Hepsi 1 ise gruplar zararsız
kopyadır ve en küçük id'yi bırakıp gerisini pasifleştirmek güvenli:
`findPlaces` zaten `trNorm` ile eşleştiği ve `.order('id')` yüzünden küçük id'yi
seçtiği için **bugünkü davranış hiç değişmez**.

**Sonra uygula** (önce `SELECT`'e çevirip listeye bak, sonra `UPDATE`):

```sql
-- UPDATE public.aliases SET is_active = false
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id,
--            row_number() OVER (
--              PARTITION BY type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')
--              ORDER BY id
--            ) AS sira
--     FROM public.aliases
--     WHERE is_active = true
--   ) t WHERE sira > 1
-- );
```

Silme yok; geri alma: aynı id listesi ile `is_active = true`.

---

## Adım 10 — D3: trigger + UNIQUE indeks (EN SON)

`docs/20260729_alias_normalize_trigger.sql` — içindeki sırayı takip et.

⚠️ İndeks **kısmi** (`WHERE is_active = true`). Sebebi Adım 9: pasifleştirilmiş
kopyalar tabloda duruyor ve tam indeks onları da ihlal sayardı. Kısmi indeks
"aktif alias'lar arasında katlanmış anahtar tekil" garantisini verir — korunması
gereken de tam olarak bu.

İndeks kurulmuyorsa (23505) Adım 9 tamamlanmamış demektir; hata mesajındaki
anahtar değeri ile yukarıdaki ölçüm sorgusuna bak.

---

## 🚨 DALGA 5 ETKİLEŞİMİ — bu runbook'un son kullanma tarihi var (31 Tem 2026)

Dalga 5 (`docs/20260731_dalga5_metin_kolon_drop.sql`, en erken 7 Ağu) şu kolonları
**düşürüyor**: `listings.origin_city`, `listing_stops.city`.
(🚫 Bu satır önce `listings.destination_city`'yi de sayıyordu — **öyle bir kolon
yok**, 31 Tem 2026 / #28. Drop listesinden çıkarıldı; kalsaydı migration 42703
ile yarıda kesilirdi.)
Bu runbook'un bazı adımları tam olarak o kolonlara dokunuyor. Sıra artık serbest değil.

**Dalga 5'ten SONRA çalıştırılamaz hâle gelenler:**

| Adım | Neden |
|---|---|
| **8.1** şehir kolonu onarımı | Onardığı iki kolon da düşüyor. Drop'tan sonra çalıştırmak 42703 verir. |
| **8.3** `destination_city` | 🚫 Adım zaten düştü — kolon Dalga 5'te düşmüyor, **hiç yok** (#28). |
| **8.4** doğrulama (`l.origin_city <> s.city`) | Her iki taraf da düşüyor; sorgu yazılamaz. |
| **0.1 / 0.1b / 0.2 / 0.3** ölçümleri | Aynı kolonlara dayanıyor; "önce/sonra" karşılaştırması bir daha kurulamaz. |

**Dalga 5'ten sonra da geçerli kalanlar — ve bu yüzden ASIL İŞ olanlar:**

Adım **3, 4, 6** ve **8.2** yalnız `district` alanlarına dokunuyor.
`listings.origin_district` ve `listing_stops.district` Dalga 5'te **düşmüyor** — çünkü
DB'de ilçe tablosu yok, `province_id` gibi bir `district_id` karşılığı da yok. Yani
Dalga 5 sonrasında **ilçe, sistemde kalan tek metin konum alanı** olacak. Yazım kalitesi
oraya kilitleniyor.

Bu, Adım 0.3 ölçümüyle de örtüşüyor: hasarın 16 grubunun **14'ü ilçe kolonlarında**
(`listing_stops.district` 11, `listings.origin_district` 3), yalnız 2'si şehirde. Yani
zaten düzeltilmesi gereken kısım, düşmeyecek olan kısım.

**Karar:**

1. Adım **3 → 4 → 6 → 7 → 8.2** sırası korunarak tamamlanır. Bunların Dalga 5 ile
   yarışı yok, ne zaman yapılırsa yapılsın geçerli.
2. Adım **8.1 + 8.4** yapılacaksa **Dalga 5'ten önce** yapılır. Ama önce şunu tart:
   Dalga 3 sonrası şehir filtresi artık `origin_province_id`/`province_id` tamsayısına
   bakıyor, metnin yazımı kullanıcıya hiçbir şey göstermiyor. Ve Adım 0.3'e göre
   `listings.origin_city`'de toplam **3 satır** bozuk (22.471 `İstanbul`'a karşı
   3 `Istanbul`). **Birkaç gün sonra düşecek bir kolonda 3 satır onarmak** işin
   kendisinden çok işin kaydını tutmaya benziyor — atlanabilir, ama bilinçli atlanır,
   unutularak değil.
3. Adım **9 + 10** (`aliases` katlanmış kopyalar + UNIQUE indeks) Dalga 5'ten tamamen
   bağımsız — `aliases` tablosuna dokunuyorlar, `listings`e değil. Kendi sıralarında.

⚠️ Adım 8.1'i atlama kararı verilirse **Adım 8.4 doğrulaması da düşer**, yani "yazım
farkından doğan sahte güzergâh kalmadı" bir daha kanıtlanamaz. Adım 0.1 zaten **0**
dönmüştü (29 Tem) — kanıt orada duruyor, tekrar üretilemeyecek olan da o.

---

## Özet sıra

| # | Ne | Kaynak | Zorunlu |
|---|---|---|---|
| 0 | Başlangıç ölçümleri | bu dosya | ✅ |
| 1 | Homonim pasifleştir (`araç`/`arac`/`olur`) | H · ADIM 3 | ✅ |
| 2 | `normalized` ASCII düzeltmesi | K · BÖLÜM 1 | ✅ |
| 3 | `district` yazım düzeltmesi | K · BÖLÜM 2 | ✅ |
| 4 | NULL `district` doldur | K · BÖLÜM 3 | ✅ |
| 5 | `payas` → Hatay | K · BÖLÜM 4.1 | ✅ |
| 6 | Elle kararlar | K · BÖLÜM 4.2-4.6 | seçmeli |
| 7 | Doğrulama (boş dönmeli) | K · BÖLÜM 5 | ✅ |
| 8 | Geçmiş konum onarımı — **4 kolon** (`origin_city`, `origin_district`, `listing_stops.city`, `listing_stops.district`) + tekrar ölç | bu dosya (K · BÖLÜM 6 **eksik**) | ✅ · ⏳ 8.1/8.3/8.4 Dalga 5'ten önce, 8.2 her zaman |
| 9 | Katlanmış alias kopyalarını pasifleştir | bu dosya | ✅ (D3 önkoşulu) |
| 10 | Trigger + kısmi UNIQUE indeks | `20260729_alias_normalize_trigger.sql` | ✅ |

> ⏳ sütunu için bkz. bir üstteki **DALGA 5 ETKİLEŞİMİ** bölümü. Kısaca: 3/4/6/8.2
> ilçelere dokunuyor ve süresizdir; 8.1/8.3/8.4 şehir metin kolonlarına dokunuyor ve
> o kolonlar Dalga 5'te düşüyor.
