# Coğrafi Veri Standardizasyonu — Geçiş Planı

> Durum: **Dalga 1 kod tarafı hazır, SQL ÇALIŞTIRILMADI.** (30 Tem 2026)
> Strateji: **çift yazım** — metin kolonları yerinde kalır, `province_id` yanlarında birikir,
> okuma yolları doğrulandıktan sonra ayrı bir migration ile drop edilir.

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

İlçe DB tablosu **açılmadı** (spec md.2). Bir ilçe tablosu her okumaya JOIN ekler ve karşılığında
yalnızca "yazım doğru mu" garantisi verir — onu zaten formdaki Searchable Select veriyor.

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

## Dalgalar

### Dalga 1 — şema (⏳ SQL bekliyor)

`docs/20260730_province_id.sql` çalıştırılacak. Koddan **önce** çalıştırılabilir: hiçbir mevcut
kolonu düşürmez, hiçbir mevcut davranışı bozmaz. Adım 5'in ön raporunu **çalıştırmadan önce oku**
ve çıktıyı sakla — kaç satırın id alamayacağını orada görürsün.

Kabul: Adım 8.1 kapsama oranı %98+, Adım 8.2 sıfır satır, Adım 8.4 iki satır.

### Dalga 2 — yazma yolları

`province_id` yazılmaya başlar, **metin kolonları da yazılmaya devam eder**
(`lib/lokasyon.ts::ilCiftYazim()` tek çağrıda ikisini de verir).

| Dosya | Değişiklik | Risk |
|---|---|---|
| `docs/20260729_ilan_olustur_v2.sql` → v3 | RPC'ye `origin_province_id`, `stops[].province_id`, `*_official` alanları | 🔴 **RPC jsonb alıyor — ayrışma derleme zamanında GÖRÜNMEZ, alan sessizce NULL yazılır.** Üç çağıranı birlikte güncelle. |
| `lib/ilan-yaz.ts` | `:228` `ilNormalize(d.sehir)` → `ilCiftYazim()`; `:313`, `:357`, `:409` payload'a id ekle | 🟡 `listings` yazan TEK yol, üç kanalın hepsi buradan geçiyor |
| `app/moderator/actions.ts` | `moderatorIlanOlustur()` RPC'yi doğrudan çağırıyor | 🟡 `ilanYaz()` kullanmıyor, ayrı güncellenmeli |
| `supabase/functions/parse-listing/index.ts` | Deno — TS modülü **import edemez**, `il_key` eşlemesi kopyalanacak | 🔴 `tsconfig.json` `exclude`'unda → `tsc` bu dosyayı **hiç görmez** |
| `app/api/excel-import/route.ts` | Kalkış İli sütunu → id | 🟢 |
| `app/api/whatsapp/route.ts` | Webhook payload'ı | 🟢 |
| `app/panel/actions.ts` | Durak replace bloğu (`:96-157`) + kolon beyaz listesi | 🟡 Beyaz listeye yeni kolonları eklemeyi unutma, yoksa sessizce düşer |

### Dalga 3 — okuma / filtre / moderasyon

| Dosya | Değişiklik | Risk |
|---|---|---|
| `app/_components/HomeClient.tsx` | `:711` `i.kalkis?.includes(kalkis)` ve `:712` `d.sehir?.includes(varis)` → id eşitliği. `:820`/`:825` select'leri `value={34}`'e geçer | 🔴 **Filtre şu an tamamen istemcide** — tüm ilanlar çekilip JS'te süzülüyor. `includes` büyük/küçük harfe duyarlı: `ÇORLU` yazılmış durak "Çorlu" aramasında hiç çıkmıyor. Spec md.5'in istediği SQL filtresi buraya yeni bir sunucu yolu eklemeyi gerektirir. |
| `docs/20260630_radar_rpc_perf_fix.sql` | `ILIKE '%…%'` → `= p_province_id` | 🟡 |
| `docs/20260609_radar_analitik_counterpart_filter.sql` | 6 ayrı `ILIKE` | 🟡 |
| `docs/20260604_radar_intelligence_rpc.sql` | 4 `ILIKE` + trigram index'i **düşür** | 🟡 Trigram index'in varlık sebebi kalmıyor |
| `docs/20260616_radar_analitik_indexes.sql` | `idx_listings_origin_city_created` → province sürümü | 🟢 |
| `docs/20260701_nearby_listings_rpc.sql` | `:63` `origin_city ILIKE p_city` | 🟡 |
| `app/moderator/page.tsx` | İl gösterimi `ilAdi(id)`, filtre `province_id` (spec md.6) | 🟢 |
| `app/admin/radar/*`, `app/api/admin/radar/*` | RPC dönüşleri | 🟢 |
| `app/ilan/[id]/page.tsx`, `app/panel/*`, `app/u/[username]/*` | Salt gösterim | 🟢 |

### Dalga 4 — AI parser

`app/api/parse-text/route.ts` ve `supabase/functions/parse-listing/index.ts` prompt'ları
güncellenir: AI **metin il adı döndürmeye devam eder**, `province_id`'ye çeviriyi
`lib/lokasyon.ts::ilId()` yapar.

> 🚨 **AI'a doğrudan id ürettirme.** Prompt'a 81 satırlık tabloyu koymak token yakar ve model
> plaka kodunu uydurur — "Bursa 16 mı 61 mi" hatası ölçülemez biçimde geçer. Deterministik
> eşleştirme kodda kalmalı. Spec md.4'ün istediği sonuç (DB'ye id yazılması) böyle de sağlanıyor.

### Dalga 5 — metin kolonlarını düşür

Ayrı migration. Ön koşul: Dalga 2 + 3 canlıda, Adım 8.2 çapraz kontrolü **en az bir hafta**
sıfır satır dönüyor.

- `alter table public.listings drop column origin_city;`
- `alter table public.listing_stops drop column city;`
- `listings.destination_city` — zaten **ölü kolon** (uygulamada tek okuma/yazma yok), aynı
  migration'da düşür.
- Eski metin index'lerini (`idx_listings_origin_city*`, `listing_stops_city_trgm_idx` vb.) düşür.

## W5 alias runbook'u ne olacak

**İl yazımıyla ilgili adımları gereksizleşti.** `docs/20260729_alias_runbook.md`'in Adım 3
(yazım düzeltme) ve Adım 8 (geçmiş `listings` onarımı) `Istanbul` → `İstanbul` düzeltmesi
yapıyordu; `province_id` backfill'i `il_key()` ile katladığı için iki yazım da 34'e gidiyor —
düzeltmeye gerek kalmıyor.

**Hâlâ geçerli olan kısım: ilçe.** `aliases.district` metin olarak kalmaya devam ediyor ve orada
aynı ikilik hâlâ mümkün. Runbook'un Adım 4 (NULL ilçe doldurma) ve Adım 6 (elle kararlar) ile
`docs/20260729_alias_normalize_trigger.sql` **korunmalı**.

> ⚠️ Bu bir kayıp değil ama bedava da değil: `aliases` tablosundaki bozuk il yazımı **silinmiyor**,
> yalnızca zararsızlaşıyor. `learn-aliases` yolu hâlâ yeni bozuk satır üretebilir; `parse-listing`
> `findPlaces` içindeki `sameCity` karşılaştırması id'ye geçene kadar (Dalga 2) sahte güzergâh
> üretme ihtimali sürüyor. **Dalga 2 ertelenirse W5 runbook'unu çalıştırmak gerekir.**

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
çağıranı birlikte güncelle.

**Çift yazım döneminde yalnız id yazan bir yol tehlikeli.** Metin kolonu boş kalırsa, henüz metne
bakan okuma yolları (HomeClient varış filtresi, radar RPC'leri) o ilanı **görünmez** yapar.
Dalga 3 bitene kadar her yazma yolu `ilCiftYazim()` kullanmalı.
