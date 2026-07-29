# Alias veri bütünlüğü — ÇALIŞTIRMA SIRASI (runbook)

> 29 Temmuz 2026 · W5/D5 · **Bayram çalıştıracak**
> Kod tarafı (W5/D1, D2, D4) bu runbook'tan ÖNCE deploy edilmiş olmalı.
> Durum: Bayram'ın 29 Tem beyanı — **iki script'ten hiçbir bölüm çalıştırılmadı.**

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
>    `listing_stops`'a yazıyor (satır ~825); `destination_city`'yi **hiçbir uygulama kodu
>    yazmıyor ve okumuyor** — tüm repoda yalnız bu SQL/doc dosyalarında geçiyor, yani eski
>    ölü kolon. Varış filtresi de `listing_stops.city`'ye bakıyor (`HomeClient.tsx:696`).
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

-- 0.4 `destination_city` gerçekten ölü mü? 0 dönerse kolon boş demektir; Adım 8'de
-- ona dokunmaya gerek yok, ayrı bir "ölü kolonu düşür" bileti açılır.
SELECT count(*) AS dolu_destination_city FROM public.listings WHERE destination_city IS NOT NULL;
```

Çıktıların hepsini bir yere kaydet (tarih + sayı yeter). **0.1 ile 0.2'yi karıştırma:**
0.1 düzeltilecek hasar, 0.2 korunacak gerçek iş.

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

---

## Adım 7 — K / BÖLÜM 5: doğrulama

**İki sorgu da BOŞ dönmeli.** Dönmüyorsa dur, çıktıyı kaydet ve raporla —
sonraki adımlara geçme.

---

## Adım 8 — geçmiş konum verisinin onarımı (K / BÖLÜM 6 **yetersiz**)

> 🚨 **K / BÖLÜM 6'yı olduğu gibi çalıştırmak işi bitirmez.** O bölüm yalnız
> `listings.origin_city` ve `listings.destination_city`'yi onarıyor. Oysa:
>
> - **`listings.destination_city` ölü bir kolon.** Uygulama kodunda tek bir
>   yazma/okuma yok (Adım 0.4 ile teyit et). Onarmak boşa iş.
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

**8.3 — `destination_city`.** Adım 0.4 sıfır döndüyse dokunma. Sıfırdan farklı
döndüyse de onarma: kolonu kimse okumadığı için onarım kullanıcıya hiçbir şey
kazandırmaz. Doğru iş, kolonu düşürmek için ayrı bilet açmak.

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
| 8 | Geçmiş konum onarımı — **4 kolon** (`origin_city`, `origin_district`, `listing_stops.city`, `listing_stops.district`) + tekrar ölç | bu dosya (K · BÖLÜM 6 **eksik**) | ✅ |
| 9 | Katlanmış alias kopyalarını pasifleştir | bu dosya | ✅ (D3 önkoşulu) |
| 10 | Trigger + kısmi UNIQUE indeks | `20260729_alias_normalize_trigger.sql` | ✅ |
