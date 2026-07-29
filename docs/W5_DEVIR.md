# W5 — Veri bütünlüğü (alias) · DEVİR NOTU

> Yazım: 29 Temmuz 2026 · Devreden: SPRINT_01 W0–W4'ü tamamlayan oturum
> **Bu dosya kendi başına yeterlidir.** Yeni sohbette önce `docs/PROJE_HARITASI.md`
> okunacak (proje kuralı), sonra bu dosya. Başka arkeoloji gerekmiyor.
> Detaylı bilet metinleri: `docs/SPRINT_01.md` → "W5 — Veri bütünlüğü" bölümü.

---

## 1. Durum özeti

SPRINT_01'in özgün kapsamı (landing / kayıt / giriş) **W0–W4 ile bitti**. Kod tarafında
açık iş kalmadı; Bayram'ın kod dışı maddeleri `SPRINT_01.md` → "Bayram'ın yapması
gerekenler" bölümünde.

W5 **bilinçli bir kapsam genişletmesi**: `aliases` tablosundaki bozulma auth'a değil,
ürünün ana verisine (`listings`) dokunuyor. W0–W4 sırasında ortaya çıktığı için ayrı
sprint açmak yerine SPRINT_01'e eklendi.

**Fark şu:** auth bug'ları kullanıcıyı engelliyordu — görünürdü. Bu bug **sessizce yanlış
veri üretiyor**. Kimse hata görmüyor, ilanlar yanlış şehirle kaydediliyor ve her yeni
ilanda hasar büyüyor.

Görev listesi: **#48–#53** (D1, D2, D3, D4, D5, doğrulama). Hepsi `pending`.

---

## 2. Zincirin tamamı — önce bunu anla

Tek kök sorun, üç yerde birden zarar veriyor:

1. **`aliases.normalized` kolonunda aynı şehir iki farklı yazımla duruyor:**
   `Istanbul` (13 satır) ve `İstanbul` (154 satır). Aynısı `Izmir`/`İzmir`,
   `Mugla`/`Muğla`, `Bingol`/`Bingöl`.
2. **`findPlaces` bunları iki ayrı şehir sayıyor.**
   `supabase/functions/parse-listing/index.ts:279` → `const seen = new Set<string>()`,
   satır 289 ve 303'te `seen.has(match.normalized)` — **ham değerle** anahtarlanıyor.
   İçinde hem `avcilar` (→`Istanbul`) hem `kadıköy` (→`İstanbul`) geçen bir mesaj
   **iki şehir bulmuş** oluyor.
3. **Sahte güzergâh üretiliyor.** Satır 619'daki koruma:
   `const sameCity = hits[0].normalized === hits[1].normalized` — string eşitliği.
   `'Istanbul' !== 'İstanbul'` olduğu için koruma **devreye girmiyor** ve
   **İstanbul→İstanbul** diye bir ilan kaydediliyor.

Buna ek olarak şehir filtresi `Istanbul` ile `İstanbul`'u iki ayrı şehir sayar — yani
kullanıcı İstanbul filtresi uyguladığında ilanların bir kısmını **hiç göremiyor**.

### 🚨 Bozulmanın kaynağı (29 Tem 2026'da bulundu)

Eski dokümanlar bunu *"AI aynı yeri farklı yazımla tekrar ekledi"* diye açıklıyordu.
**Doğru değil.** `app/api/admin/learn-aliases/route.ts` içindeki LLM prompt'unun kendi
örneklerinin **hepsi** ASCII'ye indirgenmiş (satır 194-199):

```
- "eskiseh"  => normalized:"Eskisehir", district:null
- "izmit"    => normalized:"Kocaeli",   district:"Izmit"
- "tuzla"    => normalized:"Istanbul",  district:"Tuzla"
- "corlu"    => normalized:"Tekirdag",  district:"Corlu"
```

Üstelik prompt satır 216'da *"district: ilcenin **dogru Turkce adi**"* diyor. LLM kuralı
değil örneği taklit eder. **Bozuk yazımı AI uydurmuyor — biz öğretiyoruz.**

⚠️ Bu bulgu olmadan SQL temizliği yapılsaydı bozulma birkaç hafta içinde aynen geri
gelirdi. Sıranın D1 ile başlamasının sebebi bu.

---

## 3. Doğrulanmış öncüller — tekrar kontrol etmeye gerek yok

Aşağıdakiler 29 Tem 2026'da kaynak kodundan **okunarak** doğrulandı:

| İddia | Kanıt |
|---|---|
| `seen` ham `normalized` ile anahtarlanıyor | `parse-listing/index.ts:279, 289, 303` |
| `sameCity` string eşitliği, katlama yok | `parse-listing/index.ts:619` |
| Alias listesi `id` sırasıyla çekiliyor → **küçük id kazanır** | `parse-listing/index.ts:44`, `whatsapp-parse/route.ts:344` — ikisi de `.eq('is_active', true).order('id')` |
| Prompt örnekleri ASCII | `learn-aliases/route.ts:194-199` |
| Manuel `create` alias'ı lowercase **yapmıyor** | `learn-aliases/route.ts:123-135` (karşılaştır: AI yolu 280, PATCH 385 ve 401 **yapıyor**) |
| `normalized`/`district` hiçbir yolda normalize edilmiyor | `learn-aliases/route.ts` — sadece `.trim()` |
| `araç` alias'ı 3000 mesajın 580'inde (%19) tetikleniyor | `docs/20260728_alias_homonim_temizligi.sql` ADIM 2 sonucu |
| `payas` yanlış ile bağlı | `docs/20260728_alias_kopya_temizligi.sql` BÖLÜM 4.1 |

### Ölçülmemiş / açık sorular

- ~~`listings` tablosunda kaç satır `origin_city = destination_city`?~~ 🚨 **BU SORU
  YANLIŞ KURULMUŞ** (Bayram düzeltti, 29 Tem 2026). Varışlar `listings`'te değil,
  `public.listing_stops` satırlarında; `listings.destination_city` ölü kolon. Ayrıca
  şehir içi taşıma meşru olduğu için "aynı şehir" sahtelik sinyali değil. Doğru soru:
  `listings.origin_city` ile `listing_stops.city`'nin **katlanmış anahtarı eşit ama ham
  yazımı farklı** kaç satır var? Sorgu: `docs/20260729_alias_runbook.md` Adım 0.1
  (meşru şehir içi tabanı 0.2'de, ayrı tutulmalı). **Henüz ölçülmedi** — düzeltmeden
  ÖNCE alınmalı, yoksa D4'ün etkisi ölçülemez.
- Kopya temizlik scriptlerinin hangi bölümlerinin çalıştırıldığı **kesin değil**.
  Yeni oturum işe başlamadan Bayram'a sormalı ya da BÖLÜM 5 doğrulama sorgularını
  çalıştırtıp mevcut duruma bakmalı.

---

## 4. Beş bilet — sıra ve gerekçe

**Sıra:** D1 + D2 (kaynağı kes) → D5 (mevcut veriyi temizle) → D3 (tekrarını DB'de
imkânsızlaştır). D4 bağımsız, her an yapılabilir.

Kaynağı kesmeden temizlemek boşuna emek; temizlemeden indeks kurmak ise **hata verir**
(mevcut kopyalar UNIQUE'i ihlal eder).

### D1 — Prompt bozuk yazım öğretiyor · 2 puan · 🔴
`app/api/admin/learn-aliases/route.ts:181-219`
Sekiz örneği Türkçe doğru yazıma çevir (`"Eskişehir"`, `"İzmit"`, `"İstanbul"`,
`"Tekirdağ"`, `"Çorlu"`); prompt başına açık kural ekle: Türkçe karakterler
(`ı ğ ü ş ö ç İ`) korunacak.
⚠️ Prompt gövdesindeki **talimat** metinleri (`GOREV`, `KURALLAR`) ASCII kalabilir —
onlar veri değil. Yalnız il/ilçe **örnekleri** düzeltilecek.

### D2 — Yazma yolunda normalizasyon yok · 3 puan · 🔴
`app/api/admin/learn-aliases/route.ts:123-135, 279-289, 385-387, 400-404`
Ortak yardımcı (örn. `lib/alias-normalize.ts`), dört yazma noktasında da kullan.
Yazmadan önce **ASCII-katlanmış** forma göre çakışma kontrolü: yeni değer mevcut farklı
bir değerle katlanıyorsa 409 dön ve mevcudu öner — sessizce ezme, admin hangi yazımın
kazandığını görmeli.
⚠️ **`is_active` / `is_approved` tuzağı:** `parse-listing` ve `whatsapp-parse` yalnız
`is_active = true` filtreliyor, `is_approved`'a **bakmıyor**. Şu an güvenli çünkü AI
önerileri `is_active: false` doğuyor — ama bu iki bayrağın senkron kalmasına bağlı,
kırılgan varsayım. **Not düş, davranışı değiştirme** (kapsam dışı).

### D3 — Trigger + UNIQUE indeks · 2 puan · 🟡
Yeni `docs/20260729_alias_normalize_trigger.sql`
`BEFORE INSERT OR UPDATE` trigger + normalize forma UNIQUE indeks:
`(type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu'))`
🚨 **En son çalışır.** D5 temizliği yapılmadan kurulamaz.

### D4 — `findPlaces` katlanmış anahtar · 3 puan · 🔴
`supabase/functions/parse-listing/index.ts:279, 289-291, 303-305, 617-621`
`seen` kümesini ve `sameCity` karşılaştırmasını `trNorm(match.normalized)` üzerinden
yürüt; `hits` içindeki değer **ham kalsın** (ilana yazılan değer o).
Aynı katlamayı lane `from`/`to` karşılaştırmalarına da uygula (~426, 619, 642).
⚠️ Satır 621'deki `diffDist` mantığı **bilinçli** — ilçeler gerçekten farklıysa
(şehiriçi güzergâh) lane korunmalı. Silme.
**Kabul:** `avcilar`+`kadıköy` geçen tek satır hiç lane üretmemeli; gerçek
İstanbul→Ankara metni etkilenmemeli.

### D5 — SQL runbook · 3 puan · 🟡 · **Bayram çalıştıracak**
Yeni `docs/20260729_alias_runbook.md`. İki hazır script var ama **aralarındaki sıra
hiçbir yerde yazılı değil**; yanlış sıra BÖLÜM 3'ü bozar (kaynak değerleri BÖLÜM 2
düzeltiyor).

1. Homonim ADIM 3 — `araç`/`arac`/`olur` pasifleştir
   (`araç` 3000 mesajın 580'inde, Bursa'nın bile üstünde; `olur` yerel testte
   doğrulandı: "…KAMYONDA OLUR" → sahte Erzurum eşleşmesi)
2. Kopya BÖLÜM 1 → 2 → 3
3. Kopya BÖLÜM 4.1 **`payas`** — 🚨 Payas 2008'den beri **Hatay** ilçesi; `id=1003`
   "Adana" diyor ve küçük id kazandığı için **bugün her payas ilanı Adana'ya yazılıyor**.
   Doğru satır (`id=1844`) tabloda zaten var.
4. Kopya BÖLÜM 4.2-4.6
5. Kopya BÖLÜM 5 doğrulama — **iki sorgu da boş dönmeli**; dönmüyorsa dur ve raporla
6. Geçmiş konum onarımı — 🚨 **BÖLÜM 6'yı KULLANMA**, `20260729_alias_runbook.md`
   Adım 8'i kullan. BÖLÜM 6 ölü `destination_city`'yi onarıp canlı `listing_stops.city`
   ile `listing_stops.district` ve `listings.origin_district`'i atlıyor.
7. Sahte güzergâh ölçümü — runbook Adım 0.1 (`listings` ⋈ `listing_stops`, katlanmış
   anahtar eşit + ham yazım farklı). **Düzeltmeden ÖNCE de al**, yoksa D4'ün etkisi
   ölçülemez. Meşru şehir içi taşıma tabanını 0.2 ile ayrı tut.
8. D3 indeksini **en son** kur

⚠️ Hiçbir adım satır **silmiyor** — hepsi `UPDATE` ya da `is_active = false`, geri
alınabilir. `araç`/`olur` pasifleştirmesinin bedeli: Kastamonu/Araç ve Erzurum/Olur
gerçekten geçtiğinde artık yakalanmaz. Bilinçli takas.

---

## 5. Çalışma disiplini — W0–W4'te işe yarayan

- **Her biletin öncülünü uygulamadan önce doğrula.** Beş dalganın her birinde 1-2
  biletin öncülü yanlış çıktı (kod zaten düzeltilmişti, ya da sorun tarif edilenden
  başkaydı). Doküman 28-29 Temmuz tarihli; kod değişmiş olabilir.
- **Yorumlar Türkçe ve *neden*'i anlatır** — *ne* yaptığını değil. Hangi bug'dan
  doğduğu, hangi tuzağın kapatıldığı yazılır. `🚨` kritik, `⚠️` dikkat.
- **Doğrulama:** `tsc --noEmit` temiz olmalı. Lint bir kapı değil (`app/` altında ~318
  eski hata var); doğru yöntem **HEAD ile karşılaştırma**:
  `git show HEAD:<yol> > /tmp/base/<ad>` sonra
  `npx eslint --no-ignore --stdin --stdin-filename <yol> < /tmp/base/<ad>`.
  (`npx next lint --file` **yok**, `git stash` bu repoda sessizce başarısız oluyor.)
- **`next build` bu ortamda çalışmıyor** — doğrulama tavanı budur, dürüstçe söylenmeli.
- **Sohbet sonunda** `docs/PROJE_HARITASI.md` + `docs/YAPILACAKLAR.md` güncellenir
  (proje kuralı, `CLAUDE.md`).

### Devam eden tuzaklar (W0–W4'ten)
- 🚨 `onAuthStateChange` içinde **asla** `await supabase.*` — `navigator.locks` kilidi
  (A8).
- 🚨 Sunucu tarafı oturum devri `properties.hashed_token` + `verifyOtp` ile (A10).
- 🚨 `public.listings` kolon bazlı yetkili — **yeni kolonlar `anon`/`authenticated` için
  yetkisiz doğar**, açıkça `grant` gerekir.
- 🚨 Türkçe büyük harf için `[A-Z]` **yanlış** — `\p{Lu}` + `/u`.

---

## 6. İlk adım

Görev #48'i `in_progress` yap, `app/api/admin/learn-aliases/route.ts`'i oku, prompt
örneklerini düzelt. Ondan önce Bayram'a tek soru: **kopya/homonim scriptlerinin hangi
bölümleri çalıştırıldı?** (D5'in başlangıç noktasını bu belirliyor.)
