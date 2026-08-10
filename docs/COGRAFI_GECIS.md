# Coğrafi Veri Standardizasyonu — Geçiş Planı

> ✅ **Durum (7 Ağu 2026, ölçülerek doğrulandı): GEÇİŞ TAMAMLANDI, Dalga 1-5 hepsi
> canlıda.** Yukarıdaki "Dalga 1 SQL ÇALIŞTIRILMADI" satırı **30 Tem'den beri hiç
> güncellenmemiş** en bayat cümleydi — dosyanın en üstünde durup en son fark edildi.
> Çift yazım stratejisi de artık tarihsel: metin kolonları (`origin_city`,
> `listing_stops.city`) Dalga 5'te **drop edildi** (6 Ağu), il/ilçe artık yalnızca
> `province_id` + `district`/`district_official`. Güncel özet için
> `docs/PROJE_HARITASI.md`'nin en üstüne bak.
>
> ~~Durum: Dalga 1 kod tarafı hazır, SQL ÇALIŞTIRILMADI. (30 Tem 2026)
> Strateji: çift yazım — metin kolonları yerinde kalır, `province_id` yanlarında birikir,
> okuma yolları doğrulandıktan sonra ayrı bir migration ile drop edilir.~~

## Neden

İl adı bugün projede **metin** olarak taşınıyor (`listings.origin_city`, `listing_stops.city`).
Üç somut bedeli var, üçü de canlı verimizde ölçülebilir durumda:

**1. Aynı il iki yazımla birikiyor.** W5'in kök sebebi buydu: `aliases.normalized` içinde
`Istanbul` 13 satır, `İstanbul` 154 satır. `parse-listing/findPlaces` bunları iki ayrı şehir
sayıyor, `sameCity` koruması string eşitliğine baktığı için devreye girmiyor ve sahte
**İstanbul→İstanbul** güzergâhı üretiliyor. ID'ye geçtiğimizde bu sorun tanımı gereği ortadan
kalkar — `il_key()` iki yazımı da 34'e katlar.

**2. Filtreler index kullanamıyor.** Radar ve nearby RPC'lerinin tamamı substring araması
yapıyor:

```sql
-- 20260630_radar_rpc_perf_fix.sql:49
AND (v_from IS NULL OR l.origin_city ILIKE '%' || v_from || '%')
-- 20260609_radar_analitik_counterpart_filter.sql:104
AND ls.city ILIKE '%' || p_counterpart || '%'
```

`ILIKE '%…%'` sol-taraf joker taşıdığı için b-tree index'i **hiç kullanamaz**; bu yüzden
`20260604_radar_intelligence_rpc.sql:212`'de trigram GIN index'i açılmış — yani index'in
maliyetini ödüyoruz ama eşitlik sorgusunun hızını alamıyoruz. Üstelik `ILIKE` büyük/küçük harfe
duyarsız ama **aksana duyarlı**: `'%Istanbul%'` yazılmış bir aramada `İstanbul` ilanları
hiç çıkmaz.

**3. `%…%` yanlış eşleşme üretiyor.** `origin_city ILIKE '%Kars%'` sorgusu `Kırıkkale`yi
kaçırır ama `Karsyaka` gibi bozuk bir kayda takılır. `smallint = 36` böyle bir yüzey taşımaz.

## Ne yapıldı (Dalga 1)

| Dosya | Ne |
|---|---|
| `lib/constants/locations.json` | 81 il + **973 resmî ilçe**. `{id, plate, name, districts[]}`. `id` = plaka kodu. |
| `lib/lokasyon.ts` | `ilId()`, `ilAdi()`, `ilceler()`, `ilceNormalize()`, `ilAra()`, `ilceAra()`, `ilCiftYazim()`. |
| `docs/20260730_province_id.sql` | `public.provinces` (81 satır, FK hedefi) + 4 yeni kolon + backfill + 4 index + GRANT + doğrulama sorguları. |

### Veri kaynağı

İlçe listesi PTT posta kodu veri setinden (`turkey-city-regions@1.0.3`) türetildi, resmî Türkçe
yazıma çevrildi ve iki bağımsız sayımla doğrulandı: **81 il, 973 ilçe**, 51 ilde `Merkez` ilçesi
(= 81 − 30 büyükşehir). `locations.json`'un il sırası `lib/ilan-sabitler.ts::ILLER` ile birebir
aynı; `id = index + 1` sözleşmesi buna dayanıyor.

### Neden il için tablo var, ilçe için yok

> 🔴 **8 Ağu 2026 — BU BAŞLIK BAYAT.** `public.districts` tablosu **açıldı**
> (973 satır, 81 il) — Dalga 5 ile birlikte; bu belgenin 244. satırı bunu zaten
> söylüyor ama buradaki paragraf 30 Tem'den beri güncellenmemişti. `ilce_resmi()`
> ve `poi_ilce_coz()` o tablodan okuyor. Aşağıdaki gerekçe TARİHSEL.

~~İlçe DB tablosu **açılmadı** (spec md.2). Bir ilçe tablosu her okumaya JOIN ekler ve karşılığında
yalnızca "yazım doğru mu" garantisi verir — onu zaten formdaki Searchable Select veriyor.~~

`public.provinces` ise açıldı, çünkü verdiği şey farklı: `province_id` FK'sız bir integer olsaydı
istemciden gelen `999` ya da `-1` sessizce DB'ye girer ve **hiçbir yerde patlamazdı** — ilan
sadece görünmez olurdu. FK bunu yazma anında reddeder. Ayrıca radar RPC'lerinin il adını SQL
içinde çözebilmesi için lazım. Tablo **türetilmiş veridir**; elle düzenlenmez, `locations.json`
değişirse yeniden üretilir.

## Serbest ilçe girişi

İlçe alanı Searchable Select **ama serbest girişe kapalı değil** (spec md.7). Sektörde "İkitelli",
"İSTOÇ", "Sanayi" gibi resmî listede olmayan adlar günlük kullanımda; bunları reddetmek kullanıcıyı
formdan kaçırır. Serbest değerler **işaretleniyor**: `origin_district_official` / `district_official`
(boolean). Böylece sık tekrar eden serbest adlar sonradan `aliases` tablosuna terfi edilebilir ve
filtre tarafı "resmî ilçe" ile "serbest etiket"i karıştırmaz.

> 🔴 **8 Ağu 2026 — bu paragraf 30 Tem'den beri UYGULANMAMIŞ bir NİYETTİ, kod
> gerçeği değildi.** Bayram: *"İlçeler şu anda seçenek olarak çıkmıyor. Serbest
> metin. Coğrafi veri standart sürecinde öyle konuşmadık."* — haklıydı. Her ilçe
> alanı (`ilan-ver`, `moderator` düzenleme formu) sıfır önerili düz `<input>`
> idi; "Searchable Select" hiç kurulmamıştı. Aynı taramada il comboboxlarının da
> (RadarClient hariç) plaka sırasında, alfabetik OLMADIĞI görüldü. İkisi de
> `docs/20260808_il_ilce_combobox.sql`'de kapatıldı: yeni paylaşılan
> `app/_components/IlceGirisi.tsx` (`<input list>`+`<datalist>`, `ilceler()`'den
> besleniyor, serbest yazıma hâlâ açık) + tüm il dropdown'ları
> `IL_ADLARI_ALFABETIK`/`ILLER_TAM_ALFABETIK`'e çevrildi.

## POI tarafı (8 Ağu 2026 — geçişin son parçası)

`pois` tablosu bu belgenin Dalga 1-5'inin HİÇBİRİNE dahil edilmemişti; 7 Ağu'da
"farklı sistem" gerekçesiyle bilinçli olarak kapsam dışı bırakılmıştı. Bayram'ın
*"Poi tarafına da coğrafi standardı uygula"* talimatıyla aynı sözleşme buraya da
uygulandı: `province_id` smallint FK + `district` metin + `district_official`.

| | önce | sonra |
|---|---|---|
| `province_id` kapsama | — | **%99,96** (9.174/9.178) |
| resmî ilçe | 4.951 | **8.765** |
| serbest ilçe | 4.209 | 402 |
| farklı `city` değeri | 88 | 82 (81 il + Kıbrıs) |

Ayrıntı ve doğrulama: `docs/20260808_poi_cografi_standart.sql`.
Yeni tek kapı: `lib/poi-lokasyon.ts::poiKonumCoz()` (SQL ikizi
`public.poi_ilce_coz()`, senkronu `npm run test:poi-senkron` koruyor).

> ⚠️ **`il_key()`e DOKUNULMADI.** Üç fonksiyonel indeks ona bağlı
> (`provinces_il_key_uniq`, `districts_il_key_uniq`, `districts_ad_key_idx`);
> IMMUTABLE gövdesini değiştirmek onları REINDEX'e kadar sessizce yanlış
> yapardı. Hoşgörü (U+0307 temizliği, şapkalı ünlü katlama) ÜSTE, ayrı bir
> `ilce_key()` fonksiyonunda.

## Dalgalar

### Dalga 1 — şema (✅ ÇALIŞTIRILDI)

> ✅ **7 Ağu 2026 — başlık düzeltildi, bu satır 30 Tem'den beri bayattı.**
> `docs/20260730_province_id.sql` **30 Tem 2026'da çalıştırıldı.** Backfill %100/%100
> (234.229 ilan + 244.379 durak o gün), çelişki sıfır, GRANT'lar yerinde. 7 Ağu'da
> yeniden ölçüldü: **81 il**, 256.041 ilanın **0**'ı, 268.415 durağın **0**'ı
> `province_id` boş. Dalga 5 ile metin kolonu da düştüğü için artık geri dönüş yok —
> bu dalga kalıcı.

`docs/20260730_province_id.sql`. Koddan **önce** çalıştırılabilirdi: hiçbir mevcut
kolonu düşürmüyordu, hiçbir mevcut davranışı bozmuyordu. Adım 5'in ön raporu
çalıştırmadan önce okunmuştu — kaç satırın id alamayacağı orada görülmüştü.

Kabul: Adım 8.1 kapsama oranı %98+, Adım 8.2 sıfır satır, Adım 8.4'te `anon → SELECT`
ve `authenticated → SELECT/INSERT/UPDATE` satırlarının bulunması (satır **sayısı** değil;
çıktıda REFERENCES ve postgres/service_role satırları da normal olarak görünür).

### Dalga 2 — yazma yolları (✅ kod hazır, ✅ RPC v3 canlıda, ✅ CANLIDA)

> ✅ **7 Ağu 2026 — "⏳ deploy bekliyor" ibaresi kaldırıldı.** Bu başlık 30 Tem'den beri
> öyle duruyordu. Kanıt iki katmanlı: (1) `git diff origin/main -- app/ lib/` boş, yani
> Vercel'in derlediği kaynak bu ağaç; (2) **davranışsal tanık** — 6 Ağu deploy'undan sonra
> işlenen gerçek WhatsApp dosyasında **303 ilan · 424 durak · `province_id` boş 0 ·
> duraksız ilan 0**. `province_id` yazılmasaydı o kolon 303 satırda NULL olurdu.
> 📌 Tanık kolonu `303`; "boş 0" tek başına okunsa hiçbir şey kanıtlamazdı — hiç ilan
> yazılmamış da olabilirdi.

`province_id` yazılmaya başlar, **metin kolonları da yazılmaya devam eder**
(`lib/lokasyon.ts::ilCiftYazim()` tek çağrıda ikisini de verir).

**Tasarımın kilit kararı:** id'yi çağıranlardan istemek yerine **RPC'nin kendisi
türetiyor.** `ilan_olustur` v3, `origin_city` metnini `il_key()` ile katlayıp
`provinces`'tan çözüyor ve `origin_city`'yi **kanonik ada çevirerek** yazıyor.
Bunun iki sonucu var: (1) jsonb ayrışma tuzağı — "üç çağıranı da güncellemeyi
unutma" varsayımı — devre dışı kalıyor, çağıran unutsa bile id doluyor;
(2) `origin_city='istanbul'` sınıfı bozulma **yapısal olarak** imkânsız oluyor,
disiplinle değil. Çağıran yine de açıkça `province_id` gönderirse o kazanır.

| Dosya | Durum | Not |
|---|---|---|
| `docs/20260730_ilan_olustur_v3.sql` | ✅ **çalıştırıldı 30 Tem 2026** | Duman testi: `'istanbul'` + `'ANKARA'` → `İstanbul \| 34`, `Ankara \| 6`. ⚠️ Testte `source` uydurulamaz (`listings_source_check`). 🚨 Burada "geçerli: `whatsapp\|facebook\|telegram\|manual`" yazıyordu — **yanlış tablo** (düzeltildi 31 Tem 2026): o küme `app/moderator/actions.ts:149`'daki **`raw_posts.source`** beyaz listesi. `listings.source`'a form kanalı `'form'` yazar. |
| `lib/ilan-yaz.ts` | ✅ | `ilNormalize` → `ilCiftYazim` + `ilceNormalize`. `p_listing`'e `origin_province_id`/`origin_district_official`, `p_stops`'a `province_id`/`district_official`. `listings` yazan tek TS yolu; whatsapp + excel-import buradan geçiyor. |
| `app/moderator/actions.ts` | ✅ | `ilanYaz()` kullanmıyor, RPC'yi doğrudan çağırıyor — ayrı güncellendi. |
| `app/panel/actions.ts` | ✅ | RPC'yi **atlayan tek yazma yolu** (`update` + durak replace). 🚨 Buradaki tehlike id'nin boş kalması değil, **eski değerde kalması**: metin Ankara'ya çevrilip id 34'te kalırsa satır kendi kendisiyle çelişir. Bu yüzden id ve metin aynı yerde birlikte hesaplanıyor. Beyaz listeye yeni kolonlar eklendi. |
| `supabase/functions/parse-listing/index.ts` | ✅ (kod değişikliği gerekmedi) | Deno, `lib/lokasyon.ts`'i import **edemez**; `tsconfig.json` `exclude`'unda olduğu için `tsc` bu dosyayı **hiç görmez**. RPC v3 id'yi metinden türettiği için gerek kalmadı — dosyaya bunun *neden* böyle olduğunu anlatan blok eklendi. `district_official` bu yolda ✅ **artık RPC v4.1 (#50) `ilce_resmi()` ile dolduruyor** (bu satır bayattı, 7 Ağu'da düzeltildi). |
| `app/api/excel-import/route.ts` | ✅ (değişiklik gerekmedi) | `sehirCoz()` alias'ı çözüp adı `ilanYaz()`'a veriyor; çift yazım orada oluyor. |
| `app/api/whatsapp/route.ts` | ✅ (değişiklik gerekmedi) | `ilanYaz()` üzerinden geçiyor. |

Doğrulama: `npx tsc --noEmit` temiz, `test:lokasyon` 21/21, `test:parser` 29/29.

### Dalga 3 — okuma / filtre / moderasyon

> ✅ **DALGA 3 TAMAMLANDI (31 Tem 2026).** Migration canlıda çalıştırıldı ve doğrulandı
> (§5.6 sıfır satır = metin ile id il il aynı sayıyı veriyor), kod deploy edildi (`bd0c7d1`).
> Migration: `docs/20260730_dalga3_radar_province_id.sql`. Keşif: `docs/20260730_dalga3_kesif.sql`.
> Son parça olan `HomeClient.tsx` da bitti — aşağıdaki tabloya bak.
>
> 🚨 **Bu dalganın en önemli bulgusu şema değil, süreç:** keşif sorgusu canlı
> `pg_get_functiondef` çıktısını alınca `docs/` altındaki radar migration'larının
> **canlı hali temsil etmediği** ortaya çıktı. `get_radar_city_detail` canlıda `ILIKE`
> değil `=` kullanıyor; `get_radar_intelligence` canlıda `dest_ids AS MATERIALIZED`
> CTE'siyle çalışıyor. Yani en az iki sürüm elle çalıştırılıp depoya yazılmamış.
> Aşağıdaki tabloda "dosya" sütununda yazan migration'lardan yeni sürüm türetilseydi
> bu iyileştirmeler **sessizce geri alınmış** olacaktı.
> **Kural:** radar fonksiyonlarına dokunmadan önce her zaman `pg_get_functiondef`.
>
> 📏 **Kapsama ölçüldü:** 10 örnek ilin hepsinde `sadece_ilike = 0` ve `sadece_id = 0`.
> Metin ile id bugün **aynı kümeyi** döndürüyor (İstanbul kanonikleştirmesi deliği
> kapattı). Dolayısıyla Dalga 3 "görünmeyen ilanı kurtarma" işi DEĞİL; kazancı
> (1) `= integer` gerçek index kullanır, (2) yazım bozulması bir daha radar'ı köreltemez,
> (3) Dalga 5 metin kolonlarını düşürünce bu fonksiyonlar kırılmaz.
>
> 🔀 **API sözleşmesi:** RPC'ler `province_id` alır, HTTP katmanı **il adı almaya devam
> eder**; çeviri route sınırında `ilId()` ile yapılır. Sebep: `AnalitikClient.tsx`
> baştan sona il adıyla çalışıyor. Tanınmayan il adı **400** döner — sessizce `null`
> geçmek RPC tarafında "tüm iller" anlamına gelirdi ve kullanıcı yanlış veriye bakardı.

| Dosya | Değişiklik | Risk |
|---|---|---|
| `app/_components/HomeClient.tsx` | ✅ İl filtresi **sunucuya taşındı**: il seçilince `/api/listings/ara` çağrılıyor, `includes` yerine `province_id` tamsayı eşitliği. Select'ler `value={plaka}`. Elle yazılmış 4. `ILLER` kopyası silindi (artık `lib/ilan-sabitler`) | 🟢 **Ama asıl bulunan hata `includes` değildi.** Filtre 200'lük pencerenin içinde çalışıyordu ve pencere `created_at`e göre kesiliyor, ile göre değil → **Muş'ta ilan olsa bile son 200 ilan büyük illerdense kullanıcı boş liste görüyordu.** Sessiz, kullanıcıya dönük veri kaybı. Ders `PROJE_HARITASI` §tuzaklar'a yazıldı. |
| `app/api/listings/ara/route.ts` | ✅ **YENİ.** Service role; `origin_province_id` + `listing_stops.province_id` filtresi, rozetler yanıtın içinde | 🟢 Varış filtresi iki sorgu: önce `listing_stops!inner` ile **yalnız id**, sonra tam duraklarla gövde. Tek sorguda yapılsaydı `!inner` gömülü durak dizisini de kırpar, çok duraklı ilanın tonaj toplamı yanlış görünürdü. |
| `lib/ilan-liste.ts` | ✅ `ILAN_SELECT` + `ilanNormalize()` eklendi | 🟢 Aynı sorgu artık üç yerden atılıyor (SSR / istemci / filtre). Kolon listesi tek yerde olmasa Dalga 5'te `origin_city`'yi üç ayrı yerden silmek gerekecekti. |
| `docs/20260630_radar_rpc_perf_fix.sql` | `ILIKE '%…%'` → `= p_province_id` | 🟡 |
| `docs/20260609_radar_analitik_counterpart_filter.sql` | 6 ayrı `ILIKE` | 🟡 |
| `docs/20260604_radar_intelligence_rpc.sql` | 4 `ILIKE` + trigram index'i **düşür** | 🟡 Trigram index'in varlık sebebi kalmıyor |
| `docs/20260616_radar_analitik_indexes.sql` | `idx_listings_origin_city_created` → province sürümü | 🟢 |
| `docs/20260701_nearby_listings_rpc.sql` | `:63` `origin_city ILIKE p_city` | 🟡 |
| `app/moderator/page.tsx` | ✅ `duzenleKaydet()` çift yazıma geçti (`origin_province_id` + durak `province_id`), `aliasOgren()` katlama hatası düzeltildi | 🔴 **BULUNAN BUG (KAPANDI, 30 Tem 2026):** düzenleme yolu server action'dan geçmiyordu; metni düzeltip id'yi ESKİ DEĞERDE bırakıyordu. Sol sütundaki düzeltmeyle aynı anda giderildi — bu hücre "ne bulunmuştu"nun kaydı, hâlâ açık değil. |
| `app/api/admin/radar/route.ts` | ✅ `ilId()` ile ada→id, tanınmayan il 400 | 🟢 |
| `app/api/admin/radar/analitik/route.ts` | ✅ `city`+`counterpart` → `p_province_id`/`p_counterpart_id` | 🟢 |
| `app/api/listings/yakin/route.ts` | ✅ `get_nearby_listings_by_city` → `_by_province` | 🟢 `enYakinIl` 81 anahtarı `locations.json` ile birebir doğrulandı |
| `app/admin/radar/analitik/AnalitikClient.tsx` | **Değişmiyor** — RPC hem `province_id` hem kanonik `city` döndürüyor | 🟢 |
| `app/ilan/[id]/page.tsx`, `app/panel/*`, `app/u/[username]/*` | Salt gösterim | 🟢 |

### ✅ DALGA 4 TAMAMLANDI (31 Tem 2026)

> ⚠️ **Bu bölümün ilk hâli iki noktada yanlıştı.** Yazan tarafın kaydı olsun diye
> düzeltilerek bırakıldı — plan metnine güvenip dosya açmadan iş yapılmaması için.

**Yanlış 1 — dosyalardan biri hiç LLM kullanmıyor.** Plan
`supabase/functions/parse-listing/index.ts`'i "prompt güncellenecek" diye listeliyordu.
O fonksiyon **saf regex + `aliases` tablosu**; içinde prompt YOK. Güncellenecek bir şey
bulunmadı.

**Yanlış 2 — üçüncü bir prompt kopyası atlanmıştı.** `app/api/whatsapp/route.ts:47`
`parseWithLLM()` aynı şemayı kendi kopyasıyla istiyor (Twilio webhook'u). Plan bunu hiç
saymamıştı; yalnız parse-text güncellenseydi iki AI kanalı sessizce ayrışacaktı.

#### Ölçüm: Dalga 4'ün ne kadarı Dalga 2'de zaten kapanmıştı

Üç AI kanalının **yazma** yolu izlendi; hiçbiri `province_id`'yi kendi yazmıyor:

| Kanal | Yazma yolu | `province_id` | `district_official` |
|---|---|---|---|
| `/api/parse-text` | ⚠️ **DB'ye yazmıyor** → `MetindenIlan.tsx` → `ilan-ver/page.tsx` `aiCiktisiniUygula()` → forma prefill → `ilanYaz()` | ✅ `ilCiftYazim()` | ✅ `ilceNormalize()` |
| `/api/whatsapp` (Twilio) | `ilanYaz()` doğrudan | ✅ `ilCiftYazim()` | ✅ `ilceNormalize()` |
| `parse-listing` (Deno, WhatsApp ZIP) | `ilan_olustur` RPC doğrudan | ✅ RPC v3 `il_key()` ile türetir | ✅ RPC v4.1 (#50) `ilce_resmi()` ile türetir — aşağıdaki "Kapatılmayan tek boşluk" başlığı KAPANDI |

Yani Dalga 2 `ilanYaz()` + RPC v3'ü kapattığı anda id tarafı üç kanalda da bitmişti.
Dalga 4'e kalan tek gerçek iş prompt kalitesiydi.

#### Yapılan: prompt sertleştirmesi (asıl risk yazım hatası değildi)

`ilCiftYazim()` zaten "istanbul", "İSTANBUL", "Istanbul" hepsini katlıyor — yazım
varyansı ölü bir risk. **Ölçülen gerçek risk: AI'ın il alanına İLÇE adı koyması.**
"Çorlu'dan Gebze'ye" metninde model `origin_city:"Çorlu"` döndürüyor; `ilCiftYazim`
null veriyor.

Sonuç kanala göre farklı ve **WhatsApp'ta çok daha pahalı**:

- `/api/parse-text` → `ilNormalize` alanı boş bırakır, kullanıcı formda ili elle seçer. Rahatsızlık.
- `/api/whatsapp` → **form yok.** `ilanYaz()` "Kalkış ili tanınamadı" döner, ilan **hiç oluşmaz**,
  kullanıcı WhatsApp'ta düzeltemez. Sessiz veri kaybı.

Her iki prompt'a aynı kural eklendi: *"SADECE 81 ilden biri; ilçe/belde/semt geldiyse
onu `district`'e koy, `city`'ye BAĞLI OLDUĞU İLİ yaz (`Çorlu` → `Tekirdağ`+`Çorlu`)."*
Modelin ilçe→il eşlemesini zaten bilmesi kullanılıyor; 81 satırlık tablo prompt'a
KONMADI.

> 🚨 **AI'a doğrudan id ürettirme.** Prompt'a plaka tablosunu koymak token yakar ve model
> kodu uydurur — "Bursa 16 mı 61 mi" hatası ölçülemez biçimde geçer. Deterministik
> eşleştirme kodda kalmalı. Spec md.4'ün istediği sonuç (DB'ye id yazılması) böyle de sağlanıyor.

> 🚨 **İKİ PROMPT KOPYALI.** `app/api/parse-text/route.ts` ve `app/api/whatsapp/route.ts`.
> Coğrafi kuralları birini güncelleyip diğerini bırakma; fark yalnızca `province_id` NULL
> sayısında görünür, hiçbir yerde hata vermez. Her iki dosyanın başında karşılıklı uyarı var.

#### ✅ Boşluk KAPANDI (v4.1 / #50) — bu başlık bayattı

7 Ağu 2026'da ölçülerek bulundu: `ilan_olustur` RPC'si **v4.1**'de (`#50`) bir "yedek
bacak" kazanmış — `origin_district_official` / `listing_stops.district_official`
çağıran açıkça göndermezse RPC kendisi `public.ilce_resmi(province_id, district)`
ile türetiyor. `districts` tablosu (973 ilçe) Dalga 5 ile birlikte açılmıştı;
tam da bu boşluğu kapatmak için kullanılmış. Yorum RPC gövdesinde birebir yazılı:
*"Bugün o durumun TEK örneği `parse-listing`:848 — Deno `locations.json`'a
erişemediği için bu alanı hiç göndermiyor."*

**Canlı ölçüm (7 Ağu):** WhatsApp kanalı (Deno), 4 Ağu öncesi/sonrası —

| dönem | ilan | flag dolu | resmi=true | resmi=false |
|---|---|---|---|---|
| v50 öncesi | 12.303 | **0** | 0 | 0 |
| v50 sonrası | 10.306 | **10.092 (%98)** | 9.840 | 252 |

⚠️ `supabase/functions/parse-listing/index.ts`'in kendi yorumu (`:1183-1185`, "DB'de
ilçe tablosu YOK") **hâlâ bayat** — RPC tarafında kapandığı için Deno'nun bunu bilmesine
gerek kalmadı, ama yorum yanlış bilgi veriyor. Kod davranışını etkilemez (salt yorum),
düzeltildi ama henüz deploy edilmedi (sonraki gerçek deploy'a eklensin, tek başına acil değil).

### Dalga 5 — metin kolonlarını düşür

Ayrı migration: **`docs/20260731_dalga5_metin_kolon_drop.sql`** (31 Tem 2026'da yazıldı,
çalıştırılmadı). Ön koşul: Dalga 2 + 3 canlıda, Adım 8.2 çapraz kontrolü **en az bir hafta**
sıfır satır dönüyor.

- `alter table public.listings drop column origin_city;`
- `alter table public.listing_stops drop column city;`
- ~~`listings.destination_city` — uygulamada tek okuma/yazma yok, aynı migration'da düşür.~~
  🚫 **MADDE DÜŞTÜ (31 Tem 2026, #28): ÖYLE BİR KOLON YOK.** `drop column` denemesi
  `42703: column "destination_city" does not exist` verir; `information_schema.columns`
  teyit etti. Bu madde "ölü kolon" varsayımıyla yazılmıştı — kolon ölü değil, hiç
  var olmadı. Varış verisi tek yerde: `listing_stops.city` (yukarıdaki madde).
- Eski metin index'lerini (`idx_listings_origin_city*`, `listing_stops_city_trgm_idx` vb.) düşür.

> 🚨 **YUKARIDAKİ LİSTE EKSİKTİ.** Migration yazılırken iki bağımlılık çıktı; ikisi de bu
> maddelerin hiçbirinde yoktu ve listeye göre hareket edilseydi canlı kırılırdı. Migration'ı
> bir hafta önceden yazmanın tek sebebi buydu.
>
> 1. **`ilan_olustur` hâlâ her iki metin kolonuna INSERT ediyor** (v3, satır 88-99 ve 139-146).
>    plpgsql gövdesi DDL anında doğrulanmaz: `drop column` **hatasız geçer**, fonksiyon geçerli
>    görünmeye devam eder, ilk ilan oluşturma denemesinde 42703 ile patlar. Hata deploy'da değil
>    canlıda, kullanıcıda çıkar — ve ana sayfa/WhatsApp/Edge Function/moderatör hepsi bu tek
>    RPC'den geçtiği için **ilan girişi tamamen durur**. `ilan_olustur` v4 (metin kolonlarına
>    yazmayı bırakan sürüm) drop'tan ÖNCE canlıda olmalı. RPC'nin JSON *girdi* anahtarları
>    (`p_listing->>'origin_city'`, `t.s->>'city'`) değişmez — onlar kolon değil, sözleşme.
> 2. **Çözülemeyen yer adları geri getirilemez şekilde kaybolur.** v3'ün
>    `coalesce(provinces.name, ham metin)` bacağı bilinçli bir veri koruma kararıydı: il
>    çözülemezse (yurt dışı, serbest giriş, yazım hatası) ham metin saklanıyordu. Kolon düşünce
>    o koruma da düşer. `listing_stops`ta durum daha ağır — `listings`in `raw_text` yedeği var,
>    durakların yok, yani çözülemeyen bir durak **tamamen boş satıra** döner. Drop'tan önce
>    migration BÖLÜM 3 ölçümü alınır; sıfırdan büyükse alias öğretme / `origin_serbest_metin`
>    kolonu / kayıp kabul kararlarından biri verilir.

## W5 alias runbook'u ne olacak

### ❌ İlk tavsiye yanlıştı — 30 Tem 2026 düzeltmesi

Bu bölüm önce şunu söylüyordu: *"il yazımı adımları gereksizleşti, `province_id` backfill'i
`il_key()` ile katladığı için iki yazım da 34'e gidiyor."* **Hatalı çıkarım.** Doğru olan kısmı:
iki yazım gerçekten de aynı **id**'ye gidiyor. Atlanan kısım: **metin kolonu Dalga 3'e kadar
canlı arayüzü beslemeye devam ediyor**, dolayısıyla id'nin doğru olması kullanıcının ilanı
görmesini sağlamıyor. Runbook'un kendi Adım 2'si bunu zaten yazmıştı —
*"şehir filtresi hâlâ ham değere bakıyor"*.

Migration sonrası ölçüm hatayı kanıtladı:

| Ölçüm | Sonuç |
|---|---|
| `origin_city <> provinces.name` olan satırlar | **22.474** — hepsi `istanbul` → `İstanbul` |
| Kaynak | **tamamı** `source='whatsapp'` |
| İlk / son | 12 May 2026 / **29 Tem 2026** → akış **canlı** |
| Tüm ilanlara oranı | **~%9,6** |
| Bunun sahte güzergâh üreten alt kümesi | 1.565 |

Zincir: `parse-listing/index.ts:818` `origin_city: firstLane.from` ← `aliases.normalized` ham
değeri, hiç kanonikleştirilmeden. Sonuç: `HomeClient:711` `i.kalkis?.includes(kalkis)`
büyük/küçük harfe duyarlı ve dropdown (`:823`) `ILLER`'den kanonik `İstanbul` verdiği için
**kullanıcı İstanbul filtrelediğinde 22.474 ilan görünmüyor.** Sahte güzergâh bunun yanında
ikincil bir zarar.

**Alınacak ders:** yeni bir kolonun doğru olması, eski kolonu okuyan yolları düzeltmez. Çift
yazım döneminde metin kolonu **birinci sınıf veri olarak kalır** — Dalga 5'te düşene kadar.

### Şu an geçerli plan

- ✅ **`docs/20260730_istanbul_kanonik.sql` çalıştırıldı (30 Tem 2026).** Blok 1 alias kaynağını
  kuruttu (runbook Adım 2 ile aynı iş), Blok 2 metni `province_id`'den onardı. Doğrulama
  **2.4 = 0**. Blok 2'nin güvenliği migration'ın 8.2 çapraz kontrolüne dayanıyordu: id ile metin
  hiçbir yerde çelişmediği için id, metni onaracak **otorite** olarak kullanılabildi. Bu,
  `province_id` migration'ının ilk somut getirisi.
- ⚠️ **Kalıcı koruma YARIM kuruldu (30 Tem 2026 · 🚫 4 Ağu 2026'da düzeltildi).**
  `docs/20260730_alias_adim9_kopya_pasiflestir.sql` çalıştı (612 katlanmış kopya
  `is_active=false`, kayıpsız, yedek `public.aliases_adim9_yedek`) ve
  `docs/20260729_alias_normalize_trigger.sql`'in **BÖLÜM 2'si** çalıştı (kısmi UNIQUE
  `aliases_katlanmis_anahtar_uniq`). 🚫 Burada **BÖLÜM 1'in de** çalıştığı yazıyordu —
  `aliases_normalize_trg` **canlıda yok**, 4 Ağu ön kontrolünde `pg_trigger` 0 satır döndü.
  ✅ Tekillik garantisi ayakta: `learn-aliases` DB seviyesinde katlanmış kopya üretemiyor.
  ✅ **#43 KAPANDI (4 Ağu 2026, trigger seçenek (a)).** Bu satır bayattı —
  `docs/20260804_alias_normalize_trg_a.sql` kuruldu; `lower()` bilerek ÇIKARILDI
  (`lower('İ')` U+0307 üretiyordu), `\s+` sıkıştırma + `district=''`→NULL korundu.
  **7 Ağu'da yeniden ölçüldü, canlı teyit:** `pg_trigger` → `aliases_normalize_trg`
  `tgenabled='O'`; gerçek `insert` (rollback'li) `'  TEST   İĞNE   ALIAS  '` →
  `TEST İĞNE ALIAS` / uzunluk 15, `district='   '` → `NULL`. Normalizasyon artık
  DB seviyesinde garanti, yalnız `learn-aliases` route'una bağlı değil.
- ✅ **İlçe adımları KAPANDI (4 Ağu 2026, #31).** Burada "Adım 3/4/6 **bekliyor**" yazıyordu;
  ölçüm aksini gösterdi — üçü de çalıştırılmış (Adım 3 → 0 satır, Adım 4'ün 92 satırının
  92'si dolu ve **sıfır id kayması**, Adım 6'nın beş kararı uygulanmış), Adım 7 doğrulaması
  boş dönüyor. Kanıt: `docs/20260804_adim3_4_6_on_kontrol.sql`.
  ✅ **Adım 8.2 / #44 KAPANDI — bu satır BAYATMIŞ.** #44 aslında **4 Ağu'da zaten
  kapanmıştı** (`docs/ARSIV_YAPILACAKLAR.md`: "Kemalpaşa UPDATE'i zaten çalıştırılmıştı,
  53/53 kanonik + `district_official=true`") ama bu dosyaya hiç yansıtılmamıştı —
  iki dosyada aynı durum, biri güncel biri bayat kaldı (#41 dersi, tekrar). 7 Ağu'da
  yeniden ölçtüm, teyit: `KEMALPAŞA` (büyük harf) **0** satır, aynı normalize
  karşılaştırmayla (`translate(lower(...),'ıçğöşü','icgosu')='kemalpasa'`) hem
  `listings.origin_district` (69) hem `listing_stops.district` (146) tamamı kanonik
  `Kemalpaşa`. `aliases.district` metin kalmaya devam ediyor — Dalga 5 sonrası
  sistemdeki tek metin konum alanı bu.

## Bilinen tuzaklar

**GRANT.** `docs/20260728_contact_phone_revoke.sql` tablo geneli yetkiyi alıp kolonları tek tek
geri verdi. `public.listings`'e bundan sonra eklenen her kolon `anon`/`authenticated` için
**yetkisiz doğar**. Migration Adım 4 bunu elle veriyor — atlanırsa belirti
`42501 permission denied for column origin_province_id` olur ve **istemci konsolunda kalır**,
sayfa yalnızca "ilan bulunamadı" der.

**`il_key()` üç yerde tekrar ediyor** ve üçü de aynı kalmak zorunda: `lib/ilan-sabitler.ts::ilKey()`,
`lib/alias-normalize.ts::aliasKey()`, `public.il_key(text)`. Birini değiştiren diğer ikisini de
değiştirmeli. `İ` (U+0130) **önce** düz `i`ye çevrilir — aksi hâlde Postgres'in `lower()`'ı onu
`i` + U+0307 olarak iki karaktere açar ve JS `toLowerCase()` ile ayrışır.

**`ilan_olustur` RPC'si jsonb alıyor.** Fonksiyon gövdesi ile çağıran arasındaki ayrışma
**derleme zamanında görünmez**; eksik alan sessizce NULL yazılır. RPC'ye kolon eklerken dört
çağıranı birlikte güncelle. — v3'te `province_id` için bu tuzak **kapatıldı**: RPC id'yi
metinden kendisi türetiyor, çağıran unutsa bile alan doluyor. ✅ **v4.1'de (#50, 7 Ağu 2026
düzeltmesi) `district_official` için de kapandı** — bu satır önce "DB'den türetilemeyen alanlar
hâlâ çağırana bağlı" diyordu, **yanlıştı**: Dalga 5'in açtığı `districts` tablosu sayesinde RPC
artık `ilce_resmi(province_id, district)` ile bunu da kendisi türetiyor, çağıran göndermese
bile. Genel kural hâlâ geçerli — yalnızca bu iki alan (id, official) DB'den türetilebiliyor;
RPC'ye eklenecek YENİ bir alan için aynı güvence otomatik gelmez, elle kurulmalı.

**Çift yazım döneminde yalnız id yazan bir yol tehlikeli.** Metin kolonu boş kalırsa, henüz metne
bakan okuma yolları (HomeClient varış filtresi, radar RPC'leri) o ilanı **görünmez** yapar.
Dalga 3 bitene kadar her yazma yolu `ilCiftYazim()` kullanmalı.
