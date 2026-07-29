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

Bu iki sayı düzeltmeden **önce** alınmazsa yapılan işin etkisi bir daha ölçülemez.

```sql
-- 0.1 Sahte güzergâh sayısı — D4'ün etkisini bununla kanıtlayacağız.
SELECT count(*) AS ayni_sehir_ilan
FROM public.listings
WHERE origin_city = destination_city;

-- 0.2 Bozuk ASCII yazımların listings'teki dağılımı (K BÖLÜM 6 önizlemesi).
SELECT 'origin' AS yon, origin_city AS sehir, count(*) FROM public.listings
WHERE origin_city IN ('Istanbul','Izmir','Mugla','Bingol') GROUP BY 1,2
UNION ALL
SELECT 'destination', destination_city, count(*) FROM public.listings
WHERE destination_city IN ('Istanbul','Izmir','Mugla','Bingol') GROUP BY 1,2
ORDER BY 3 DESC;
```

İki çıktıyı da bir yere kaydet (tarih + sayı yeter).

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

## Adım 8 — K / BÖLÜM 6: geçmiş `listings` onarımı

Alias düzelse de **zaten kaydedilmiş** ilanlar bozuk kalır. Adım 0.2'yi
önizleme olarak zaten aldın; sayı anlamlıysa iki `UPDATE`'i uygula
(`origin_city` ve `destination_city`).

Ardından Adım 0.1'i **tekrar** çalıştır ve ilk değerle karşılaştır:

```sql
SELECT count(*) FROM public.listings WHERE origin_city = destination_city;
```

Bu fark, D4 + veri temizliğinin ölçülebilir çıktısı. Kalan satırlar geçmişte
üretilmiş sahte güzergâhlardır; ne yapılacağına (silme / moderasyona düşürme)
ayrı karar verilmeli — **bu runbook'un kapsamında değil**.

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
| 8 | Geçmiş `listings` onarımı + tekrar ölç | K · BÖLÜM 6 | ✅ |
| 9 | Katlanmış alias kopyalarını pasifleştir | bu dosya | ✅ (D3 önkoşulu) |
| 10 | Trigger + kısmi UNIQUE indeks | `20260729_alias_normalize_trigger.sql` | ✅ |
