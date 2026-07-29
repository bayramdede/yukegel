# İlan Verme Süreci — Derin Analiz

> **Tarih:** 29 Temmuz 2026
> **Kapsam:** `app/ilan-ver/*` (page + actions + MetindenIlan + TopluYukle), `app/api/parse-text`,
> `app/api/excel-import`, `docs/20260505_audit_engine.sql`, `docs/20260508_audit_thresholds_and_ai_quota.sql`,
> `docs/20260519_expire_48h_and_cron.sql`, karşılaştırma referansı olarak `app/panel/actions.ts`.
> **Yöntem:** Kaynak kod okuması. DB'ye canlı sorgu atılmadı — DB varsayımı gerektiren maddeler
> `🔬 DOĞRULA` etiketiyle işaretlendi.
> **Bulgu kodları:** `V` = veri bütünlüğü & güvenlik, `B` = bozuk/kırık, `U` = UX & dönüşüm,
> `M` = mimari & kod sağlığı.

---

## 0. Yönetici özeti

SPRINT_01 auth ve telefon gizliliği yüzeylerini ciddi biçimde sertleştirdi. Ancak o sertleştirmenin
üç ana kazanımı — **sunucu tarafı kolon beyaz listesi**, **sunucu tarafı kota**, **sunucu tarafı
sahiplik/doğrulama** — ilan verme akışına hiç uygulanmadı. `app/ilan-ver/actions.ts`, projedeki
en ayrıcalıklı yazma yolu olmasına rağmen (`service-role` ile `listings` INSERT) SPRINT_01 öncesi
`panel` ve `profil-tamamla` neyse hâlâ o durumda: istemciden gelen gövde hiç filtrelenmeden,
hiç doğrulanmadan, hiç sınırlanmadan veritabanına yazılıyor.

Üç bulgu tek başına sprint açmayı hak ediyor:

Birincisi, **toplu yükleme fiilen çalışmıyor**. `TopluYukle.tsx` `/api/excel-import`'a
`{ action: 'preview' | 'commit', rows, userId }` şeklinde JSON gönderiyor; route ise yalnızca
`multipart/form-data` içinde bir `file` bekliyor ve `action` kelimesini hiç tanımıyor. JSON gövde
üzerinde `request.formData()` çağrısı istisna fırlatıyor, Vercel HTML hata sayfası dönüyor,
istemcinin `res.json()` çağrısı "Unexpected token" ile patlıyor — projenin kendi `§9` kuralında
tarif edilen tuzağın birebir örneği. Kullanıcıya çıkan mesaj `alert('❌ ' + err.message)`.

İkincisi, **moderasyon kuyruğu form ilanları için devre dışı**. `ilanKaydet` her ilana
`moderation_status: 'auto_published'` yazıyor. `audit_listing_fn` trigger'ı yalnızca skor
`reject_score_min` (71) ve üzerindeyse `archived`'a çekiyor. Yani tasarım gereği moderatör
kuyruğuna düşmesi gereken **31–70 puanlık bant tamamen atlanıyor**; o ilanlar hiçbir insan
gözünden geçmeden yayına giriyor. Aynı madalyonun diğer yüzü: 71+ puanlı bir ilan sessizce
`archived` + `is_shadow_banned` oluyor ama kullanıcı **"✅ İlanınız yayınlandı! Nakliyeciler
artık ilanınızı görebilir."** ekranını görüyor. `ilanKaydet` `.select().single()` ile trigger
sonrası satırı zaten geri alıyor — sonucu okumuyor.

Üçüncüsü, **AI ilan kotası kapı ile sayacı farklı şeye bakıyor**. Kapı `/api/parse-text`
girişinde; sayaç ise `listings` tablosunda `raw_text IS NOT NULL` olan **kaydedilmiş** ilanları
sayıyor. Ayrıştırıp kaydetmeyen kullanıcının sayacı hiç artmıyor → Anthropic API'sine sınırsız,
ücretli çağrı. Bu, `SPRINT_01 G1/G2`'de SMS için kapatılan deliğin LLM'deki tıpatıp eşi;
`lib/kota.ts` altyapısı hazır ama bu route'ta hiç kullanılmıyor.

Toplam: **30 madde / 87 puan**, 5 dalga.

---

## 1. V — Veri bütünlüğü & güvenlik

### V1 — `ilanKaydet` gövdesi hiç filtrelenmiyor (beyaz liste yok) · **5p** · 🔴 Kritik
`app/ilan-ver/actions.ts:12-70`. Action `formData` nesnesini olduğu gibi alıp `service-role`
istemcisiyle `listings`'e INSERT ediyor. Sahiplik doğrulaması, alan doğrulaması, uzunluk sınırı,
tip kontrolü yok. Karşılaştırma: `app/panel/actions.ts:89-131` aynı tabloya yazarken sahipliği
sunucuda doğruluyor, 10 durak sınırı koyuyor, telefonu regex'ten geçiriyor, `notes`'u 2000
karaktere kırpıyor ve gövdeyi açık bir beyaz listeden geçiriyor. `ilan-ver` bu işlemin hiçbirini
yapmıyor — üstelik **ilanı yaratan** yol burası, düzenleyen değil.

Somut sonuçlar: `duraklar` dizisi sınırsız (10.000 elemanlı istek `listing_stops`'a 10.000 satır
yazar), `genel_not` sınırsız uzunlukta, `fiyat` üst sınırsız (`parseFloat` — `1e308` kabul eder),
`arac_adet` negatif olabilir, `kalkis` herhangi bir metin olabilir.

**Kabul kriteri:** `ilanKaydet` `panel/actions.ts`'teki `sahipMi()` + beyaz liste kalıbını
birebir uygular; `ARAC_TIPLERI` / `UTSYAPI` / `ILLER` küme kontrolü, `duraklar.length <= 10`,
`notes.slice(0, 2000)`, `0 <= fiyat <= 100_000_000`, `1 <= arac_adet <= 50` sunucuda zorlanır.
İhlalde `{ ok: false, hata }` döner — `throw` değil.

### V2 — `contact_phone` istemciden geliyor · **5p** · 🔴 Kritik
`actions.ts:55` → `contact_phone: formData.tel || null`. Form ekranı kullanıcıya
*"Profilinizdeki numara kullanılacak"* (`page.tsx:601`) yazıyor ama sunucuya giden değer istemci
state'i. Giriş yapmış herhangi bir kullanıcı devtools ile başkasının numarasını taşıyan ilan
yayınlayabilir. Bu, SPRINT_01'in `L1`–`L1f` boyunca kapattığı telefon yüzeyinin **yazma**
tarafındaki karşılığı: numara artık okunamıyor ama **uydurulabiliyor**.

İkinci vektör aynı yerden geliyor: `page.tsx:220` → `if (r.contact_phone && !tel) setTel(...)`.
Profilinde telefon olmayan kullanıcı bir WhatsApp mesajını yapıştırırsa, **mesajın sahibinin**
numarası ilanın iletişim numarası olarak yayınlanır. KVKK açısından da sorunlu.

**Kabul kriteri:** `ilanKaydet` telefonu istemciden almaz; `users.phone`'u sunucuda okur
(`kullanicitelefon()` zaten bu sorguyu yapıyor). Profilde numara yoksa ilan kaydedilmez,
kullanıcı profil tamamlamaya yönlendirilir. `MetindenIlan` çıktısındaki `contact_phone`
tamamen yok sayılır (ekranda "AI bir numara buldu, kullanmak ister misiniz?" bile denmez —
o numara kullanıcının değil).

### V3 — `moderation_status: 'auto_published'` moderasyon bandını atlıyor · **5p** · 🔴 Kritik
`actions.ts:63`. Audit motoru üç bantlı tasarlandı (`PROJE_HARITASI §5`): `<31` yayın,
`31–70` moderatör kuyruğu, `>=71` shadow ban + arşiv. Trigger (`20260508_...sql:137-141`)
yalnızca üçüncü bandı uyguluyor; ilk iki bandın ayrımı **çağıran tarafın sorumluluğunda** ve
`ilanKaydet` koşulsuz `auto_published` yazıyor. Sonuç: orta bant fiilen yok, form kanalından
gelen riskli ilanlar doğrudan yayında.

`/api/excel-import:104` de aynı sabiti yazıyor — aynı hata iki kanalda.

**Kabul kriteri:** `moderation_status` istemciden gelmez ve sabit yazılmaz. Ya (a) trigger
`auto_pub_max <= score < reject_min` bandında `moderation_status := 'pending'`, `status := 'passive'`
yazacak şekilde genişletilir (tercih edilen — tek karar noktası DB'de kalır), ya da (b) `ilanKaydet`
`getAuditThresholds()` ile eşikleri okuyup INSERT sonrası dönen `audit_score`'a göre satırı
günceller. Her iki durumda `/api/excel-import` aynı yolu kullanır.

### V4 — Başarı ekranı, arşivlenmiş ilanı "yayınlandı" gösteriyor · **4p** · 🟠 Yüksek
`actions.ts:69` `.select().single()` trigger sonrası satırı döndürüyor; `moderation_status` ve
`is_shadow_banned` elimizde ama `return { success: true, id }` bunları atıyor. `page.tsx:286-306`
koşulsuz *"✅ İlanınız yayınlandı! Nakliyeciler artık ilanınızı görebilir."* basıyor. 71+ puanlı
bir ilan için bu düpedüz yanlış bilgi: ilan `archived` + `is_shadow_banned`, kimse göremiyor,
kullanıcı bekliyor.

**Kabul kriteri:** `ilanKaydet` `{ ok: true, id, durum: 'yayinda' | 'incelemede' | 'reddedildi' }`
döner. Başarı ekranı üç duruma üç ayrı metin gösterir; `incelemede` için tahmini süre,
`reddedildi` için `/api/ilan/duzelt` akışına bağlantı verir.

### V5 — İlan + duraklar atomik değil, hata hâlinde yetim ilan kalıyor · **4p** · 🟠 Yüksek
`actions.ts:49-105`. Önce `listings` INSERT ediliyor, sonra `listing_stops`. İkincisi hata
verirse action `throw` ediyor ve **ilan yayında kalıyor** — kalkışı olan, varışı olmayan bir
kayıt. Kullanıcı hata görüyor, muhtemelen tekrar gönderiyor → ikinci bir ilan. Feed'de varışsız
ilanlar birikiyor.

**Kabul kriteri:** Tek transaction. Tercihen `create_listing_with_stops(...)` adında bir
`SECURITY DEFINER` RPC; mümkün değilse `listing_stops` hatasında `listings` satırı silinir
(telafi edici işlem) ve kullanıcıya tek bir hata gösterilir.

### V6 — İlan verme yolunda kota/hız sınırı ve mükerrer kontrolü yok · **4p** · 🟠 Yüksek
`ilanKaydet` çağrı sıklığına bakmıyor. `lib/kota.ts` (SPRINT_01 G1/G2 ile yazıldı) bu dosyada
hiç kullanılmıyor; `grep kotaDene` yalnızca dört auth/sahiplen route'unu buluyor. Bir betik
dakikada yüzlerce ilan açabilir. `raw_posts` tarafında `(clean_hash, message_date)` üzerinde
mükerrer koruması varken form kanalında hiçbir tekilleştirme yok — aynı ilan 50 kez
gönderilebilir.

**Kabul kriteri:** Kullanıcı başına saatlik ve günlük ilan tavanı (`system_config`'ten okunur,
öneri: 20/saat, 60/gün); `lib/kota.ts` kullanılır. Ek olarak, son 24 saatte aynı
`(user_id, listing_type, origin_city, ilk durak city, available_date)` kombinasyonu varsa
kullanıcıya "Bu ilan zaten yayında, tazelemek ister misiniz?" seçeneği sunulur.

### V7 — AI kotası atlanabiliyor: kapı `parse` anında, sayaç `kayıt` üzerinden · **4p** · 🟠 Yüksek
`app/api/parse-text/route.ts:41-69` kotayı istek başında kontrol ediyor. `countAiListingsLast24h`
(`lib/auditLimits.ts:86-101`) ise `listings` tablosunda `raw_text IS NOT NULL` satırları sayıyor.
Ayrıştırıp kaydetmeyen kullanıcının sayacı **hiç artmıyor** → Haiku'ya sınırsız ücretli çağrı.
Ayrıca IP bazlı hiçbir kova yok; `SPRINT_01`'in *"ücretli veya kaba-kuvvete açık işlemleri
istemciden çağırma, kotayı sunucuda tut"* kuralı SMS'e uygulandı, LLM'e uygulanmadı.

Sayaç yalnızca **atıl** değil, aynı zamanda **kirli**: `app/api/whatsapp/route.ts:191,204`
gerçek bir `user_id` ve `raw_text` ile ilan yazıyor — oradaki yorum bunu açıkça
*"kota sayımı için zorunlu (countAiListingsLast24h)"* diye belirtiyor. Yani WhatsApp
kanalından gelen ilanlar web AI kotasını tüketiyor. Bu, `lib/auditLimits.ts:83-84`'teki
*"WhatsApp ilanlarında `user_id` NULL'dır"* yorumuyla **çelişiyor**; yorum artık yanlış.

**Kabul kriteri:** Kota **çağrı** bazına geçer: `lib/kota.ts` ile kullanıcı başına günlük
`ai_listing_quota_daily` çağrı, ayrıca IP başına saatlik tavan. `§9` kuralına uyulur: önce
`sayma: true` ile bakılır, Anthropic çağrısı **başarılıysa** sayaç işlenir (sağlayıcı arızası
kullanıcıyı kilitlemez). `countAiListingsLast24h` yalnızca raporlama için kalır.

### V8 — `origin_city` / durak şehirleri sunucuda doğrulanmıyor · **3p** · 🟡 Orta
`page.tsx:214` AI çıktısındaki şehri `ILLER` listesinde arıyor ama **bulamazsa ham değeri
kullanıyor** (`setKalkis(eslen || String(r.origin_city))`). Sunucuda ikinci bir kontrol yok.
Sonuç: `listings.origin_city` alanına "istanbul avrupa yakası", "İST", boş dize veya LLM'in
uydurduğu herhangi bir metin girebiliyor. Ana sayfadaki şehir filtresi tam eşleşmeye dayandığı
için bu ilanlar filtrede **hiç görünmüyor** — kullanıcı yayında sanıyor, kimse bulamıyor.

Not: aynı metin `prompt injection` yüzeyi. Kullanıcı metni doğrudan prompt'a giriyor
(`route.ts:105`); modele "tüm alanları şu değerle doldur" dedirtmek mümkün. `vehicle_type` ve
`body_type` istemcide beyaz listeden geçiyor, ama `origin_city`, `stops[].city`, `notes`
geçmiyor. Savunma katmanı sunucuda olmalı.

**Kabul kriteri:** `lib/iller.ts` (yeni, tek kaynak) `ilGecerliMi(x)` ve `ilNormalize(x)` sunar;
`ilanKaydet` normalize edilemeyen şehri reddeder. AI çıktısında eşleşmeyen şehir istemcide
**boş** bırakılır ve alan kırmızı işaretlenir ("Bu şehri tanıyamadık, seçin").

### V9 — `trust_level: 'verified'` koşulsuz yazılıyor · **2p** · 🟡 Orta
`actions.ts:64`. Aynı satırda `user_id: user?.id || null` var — yani oturumsuz bir çağrı geçerse
`user_id` null, `trust_level` yine `'verified'` olur. `/ilan/[id]:183` `dogrulanmamis`'ı
`!user_id || trust_level === 'social'` diye hesapladığı için bugün görünür bir zarar vermiyor,
ama kayıt tutarsız ve rozet mantığı bu alana taşınırsa sessizce yanlış rozet çıkar.

**Kabul kriteri:** `trust_level` yalnızca `user_id` doluysa `'verified'` yazılır.

### V10 — Action'ın kendi auth kapısı yok, tamamen `proxy.ts`'e bağımlı · **2p** · 🟡 Orta
`ilanKaydet` `user`'ı okuyor ama **null olduğunda durmuyor** (`actions.ts:65`). Bugün açık bir
delik değil: `/ilan-ver` `proxy.ts:21` `KORUNMALI` listesinde ve server action POST'u da aynı
rotaya gidiyor, oturumsuz istek `/giris`'e yönleniyor. Ancak bu, tek katmanlı bir savunma ve
projenin kendi tarihçesinde `KORUNMALI` listesi zaten bir kez yanlış eşleşmeyle kırıldı
(`SPRINT_01 M1`, proxy prefix tuzağı). Kritik yazma yolu proxy'nin doğru yapılandırılmasına
bağlı olmamalı.

**Kabul kriteri:** `ilanKaydet` ilk satırda oturumu doğrular, yoksa `{ ok: false }` döner.
Ayrıca `users.is_active !== false` ve `user_type` dolu (profil tamam) kontrolü yapılır.

---

## 2. B — Bozuk / kırık

### B1 — Toplu yükleme çalışmıyor: istemci ile route farklı sözleşme konuşuyor · **5p** · 🔴 Kritik
`TopluYukle.tsx:104-108` ve `:174-178`:
```js
fetch('/api/excel-import', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'preview', rows })        // ve 'commit' + userId
})
// ardından: json.success, json.preview
```
`app/api/excel-import/route.ts:38-41`:
```js
const formData = await request.formData();
const file = formData.get('file') as File | null;
```
Route `action` kelimesini hiç tanımıyor, `preview` diye bir kavramı yok, `{ basarili, hatali,
hatalar, ilanlar }` döndürüyor — istemcinin beklediği `success`/`preview` alanları hiç üretilmiyor.
JSON gövde üzerinde `request.formData()` istisna fırlatır, `try/catch` olmadığı için Next 500 +
HTML döner, istemcideki `res.json()` "Unexpected token" ile patlar ve kullanıcı
`alert('❌ Unexpected token …')` görür. `PROJE_HARITASI §10` bu akışı "✅ kısmi" işaretliyor;
gerçekte **hiç çalışmıyor**.

Bunun üstüne, istemcinin varsaydığı sözleşme kabul edilseydi bile `commit` isteği `userId`'yi
**istemciden** taşıyordu (`:177`) — başkası adına ilan açma yolu. Yeni sözleşme yazılırken bu
alan hiç var olmamalı.

Ve sözleşme ikinci bir yerden daha kırık: istemcinin indirttiği şablon `'Kalkış İli'` sütun
başlığını kullanıyor (`TopluYukle.tsx:43`), route ise `'Kalkış Şehri'` arıyor (`route.ts:67`).
Yani protokol düzeltilse bile sütun eşlemesi ayrıca hizalanmalı — bu iki bağımsız kırık.

**Kabul kriteri:** Route iki modlu hâle gelir: `POST` + JSON `{ action: 'preview' | 'commit', rows }`.
`userId` **istemciden alınmaz**, oturumdan okunur. `preview` hiçbir şey yazmaz; şehir/araç
normalizasyonunu döndürür (`TopluYukle` zaten `kalkisIliNorm`, `aracTipiStatus` gibi alanları
bekliyor — bunlar sunucuda üretilmeli, `ILLER`+`aliases` tek kaynağından). `commit` V1'deki
beyaz listeden geçer ve V3'teki moderasyon kararını uygular. Duman testi: 3 satırlık şablon
yüklenir, önizleme görünür, onaydan sonra 3 ilan `/panel`'de listelenir.

### B2 — `excel-import` ağır route ama süre bütçesi yok · **3p** · 🟠 Yüksek
Route `maxDuration` **tanımlamıyor**; satırları `for` döngüsünde sırayla, her biri için ayrı
`await` ile yazıyor (ilan + N durak = satır başına 2–3 gidiş-dönüş). `PROJE_HARITASI §9`'un
kuralı net: ağır/çoklu-satır işleyen route'larda `export const maxDuration = 60` şart, ayrıca
route kendi süre bütçesini tutmalı ve dolduğunda **geçerli JSON** ile kısmi başarı raporlamalı
(`whatsapp-parse`'taki `SURE_BUTCESI_MS = 45_000` kalıbı). Satır sayısı üst sınırı da yok —
5.000 satırlık bir dosya sessizce timeout'a gider.

**Kabul kriteri:** `maxDuration = 60`, `SURE_BUTCESI_MS = 45_000`, satır tavanı (öneri: 500),
`sirayla(..., ESZAMANLI = 6, ...)` ile eşzamanlılık, dolduğunda `{ tamamlanmadi: true, islenmeyen: N }`.

### B3 — Seçilen araç ilana bağlanmıyor · **3p** · 🟠 Yüksek
`page.tsx:427-448` kullanıcıya araçlarını (plaka, marka, kapasite) seçtiriyor, `secilenArac`
state'e yazılıyor ve **`ilanKaydet`'e hiç gönderilmiyor**. Sunucuya yalnızca `arac_tipi` ve
`utsyapi` gidiyor. Yani araç ilanında plaka, kapasite ve araç kimliği kayboluyor: ilan detayında
plaka gösterilemiyor, aynı araç için çifte ilan engellenemiyor, `vehicles` ↔ `listings` ilişkisi
kurulamıyor. Araç seçimi bugün yalnızca bir "form doldurma kolaylığı" — bilgi taşımıyor.

**Kabul kriteri:** `listings.vehicle_id uuid references vehicles(id)` eklenir; `ilanKaydet`
aracın **sunucuda** çağıran kullanıcıya ait olduğunu doğrular.
🚨 Migration'a `grant select, insert, update (vehicle_id) on public.listings to authenticated;`
+ `grant select (vehicle_id) … to anon;` **eklenmeden** deploy edilmemeli — `listings` kolon
bazlı yetkilendirilmiş bir tablo (`§9`, L1e yan etkisi); yoksa `42501` ile sessizce patlar.

### B4 — AI durak eşlemesi yanlış alana yazıyor · **3p** · 🟠 Yüksek
`page.tsx:248` → `notlar: s.cargo_type ? String(s.cargo_type) : ''`. AI'nin durak bazında bulduğu
**yük cinsi**, durağın **not** alanına yazılıyor. Kayıt sırasında (`actions.ts:88`)
`cargo_type: formData.yuk_cinsi` — yani tüm duraklara **tek bir global** yük cinsi yazılıyor,
`:91` ise `notes: d.notlar` ile yük cinsini not olarak kaydediyor. Çok duraklı bir ilanda
("Ankara'ya tekstil, İzmir'e seramik") her iki durak da `cargo_type = 'tekstil'` oluyor ve
gerçek bilgi not alanına düşüyor. Yük cinsine göre arama/filtreleme yapıldığı anda bu veri
kullanılamaz hâle gelir.

**Kabul kriteri:** Durak formunda ayrı bir "Yük Cinsi" alanı; `cargo_type` durak bazında,
`notes` yalnızca serbest not. AI eşlemesi `cargo_type → cargo_type`.

### B5 — `arac_adet` her durağa kopyalanıyor · **2p** · 🟡 Orta
`actions.ts:87` → `vehicle_count: formData.arac_adet`. Form tek bir "Araç Adedi" alanı sunuyor
(`page.tsx:485`) ama değer N durağın **her birine** yazılıyor. 3 duraklı, 2 araçlık bir ilan
veritabanında "toplam 6 araç" gibi okunuyor. Toplama yapan her rapor (radar, CRM, admin
istatistikleri) bu satırları yanlış sayar.

**Kabul kriteri:** `arac_adet` ilan seviyesinde tutulur (`listings.vehicle_count`) veya durak
bazında girdirilir. İkisinin arası olmaz.

### B6 — Huni analitiği "metin" kanalını "tekil" sayıyor · **2p** · 🟡 Orta
`page.tsx:259` AI çıktısı uygulandıktan sonra `setYontem('tekil')` yapıyor. `:196` ise
`olayGonder('ilan_olustur', { tip, yontem: yontem ?? 'tekil' })` gönderiyor. Sonuç: **Metinden
İlan ile açılan hiçbir ilan `yontem: 'metin'` olarak raporlanmıyor.** `SPRINT_01 L2`'nin persona
huni ölçümü, kanal boyutunda kör. `aiHamMetin` state'i doğru sinyali zaten taşıyor.

**Kabul kriteri:** `yontem` yerine ayrı bir `kanal` state'i tutulur (`'tekil' | 'metin' | 'toplu'`),
görünüm state'iyle karıştırılmaz. `ilan_olustur` olayı gerçek kanalı gönderir.

### B7 — `ai_parsed` parametresi ölü · **1p** · 🟢 Düşük
`actions.ts:34` imzada `ai_parsed?: boolean` var, `:113` yalnızca loga yazıyor, INSERT'e hiç
girmiyor — ve çağıran taraf (`page.tsx:193`) zaten göndermiyor. Hangi ilanların AI ile üretildiği
veritabanında **hiç işaretlenmiyor**; `raw_text IS NOT NULL` dolaylı göstergesi de
`countAiListingsLast24h`'de kullanıldığı için (V7) güvenilmez.

**Kabul kriteri:** Ya `listings.source` `'form_ai'` değerini alır ya da parametre imzadan silinir.

### B8 — `[tip]` effect'i AI çıktısını eziyor · **2p** · 🟡 Orta
`page.tsx:210` AI sonucunu uygularken `setTip('arac')` çağırıyor. Bu, `:146-170`'teki `[tip]`
bağımlı effect'i tetikliyor; kullanıcının **tek** aracı varsa `:162-163` o aracı otomatik seçip
`arac_tipi` ve `utsyapi` değerlerini araçtan yeniden yazıyor. Sonuç: kullanıcı "kırkayak
açık kasa" yazdığı hâlde form profildeki TIR/tenteli ile doluyor, üstelik sessizce. React
effect'i ile imperatif set çağrısının yarışması klasik tuzak; AI dolumu tek bir atomik
"uygula" adımı olmalı.

**Kabul kriteri:** AI dolumu sırasında `[tip]` effect'i bir `aiDolumSuruyor` bayrağı ile
atlanır; ya da otomatik araç seçimi yalnızca `arac_tipi` **boşsa** yazar.

### B9 — Beyaz listeye uymayan AI değerleri sessizce siliniyor · **1p** · 🟢 Düşük
`page.tsx:223` ve `:225` `vehicle_type`/`body_type` değerlerini sabit listeye karşı süzüyor;
eşleşmeyen değer (örn. `"Tır"` vs `"TIR"`, `"frigo"` vs `"Frigorifik"`) hiçbir uyarı olmadan
düşüyor. Kullanıcı metninde belirttiği aracın forma yansımadığını fark etmeden ilanı yayınlıyor.
V8'in şehir için tarif ettiği sorunun araç/üst yapı hâli — çözümü de aynı yere bakıyor.

**Kabul kriteri:** Eşleşmeyen değerler için alias tablosu (`lib/arac.ts`, tek kaynak — M2) ve
normalize edilemeyenler için görünür uyarı: "Metinde 'frigo' geçiyor, üst yapıyı seçin".
Ölü parametre kalmaz.

---

## 3. U — UX & dönüşüm

### U1 — Giriş duvarı ilan yazmadan ÖNCE · **4p** · 🟠 Yüksek
`/ilan-ver` `KORUNMALI` listesinde; ayrıca `page.tsx:129-144` istemcide ikinci bir kontrol yapıp
`window.location.href = '/giris?redirect=…'` diyor. Ziyaretçi ana sayfadaki *"📦 Yük Vereceğim,
İlan Ver"* butonuna basıyor ve **ilan formunu hiç görmeden** giriş ekranına düşüyor. İlan
platformlarında bu, huninin en pahalı noktası: kullanıcı emek yatırmadan hesap açmak istemiyor.

Ek olarak çift kontrol gereksiz maliyet: proxy zaten yönlendiriyor, istemci `getUser()` +
`kullanicitelefon()` server action'ını daha form boyanmadan çağırıyor.

**Kabul kriteri:** Form oturumsuz da açılır ve doldurulabilir; giriş yalnızca **"Yayınla"**
anında istenir, form içeriği `sessionStorage`'da tutulup dönüşte geri yüklenir. `?redirect=`
mevcut davranışı korur (`§9` kuralı). Deneysel olarak ölçülür: `ilan_ver_giris` →
`ilan_olustur` dönüşüm oranı.

### U2 — `?tip=` derin bağlantısı yöntem seçim ekranına düşüyor · **3p** · 🟠 Yüksek
`page.tsx:119-127` `?tip=yuk|arac` parametresini okuyup `tip` state'ini kuruyor, ama
`yontem` `null` olduğu için ekran hâlâ `SecimEkrani`. Kullanıcı persona'ya özel bir CTA'ya
tıklıyor, giriş yapıyor, sonunda **"Nasıl ilan vermek istersiniz?"** menüsüne çıkıyor.
`SPRINT_01 L2`'nin kazanımı son adımda kayboluyor. Bu, `§9`'daki *"URL param'ı ile mod kurarken
render koşulunun TAMAMINI kur"* kuralının (F1'de `giris` sayfası için yazılmıştı) burada tekrar
ihlali.

**Kabul kriteri:** `?tip=` geldiğinde `yontem` da `'tekil'` kurulur. `?yontem=metin|toplu`
desteklenir. Varsayılan yöntem `'tekil'` olur; yöntem seçimi forma bir satırlık sekme olarak
taşınır (ayrı ekran olmaktan çıkar).

### U3 — Profilinde telefon olmayan kullanıcı sonsuza kadar "Yükleniyor..." görüyor · **3p** · 🟠 Yüksek
`page.tsx:600` → `📞 {tel || 'Yükleniyor...'}`. `kullanicitelefon()` null dönerse (admin,
Google ile giren, `users` satırında `phone` boş olan kullanıcı) metin hiç değişmiyor. Kullanıcı
bekliyor, sonra yayınlıyor ve **iletişim numarası olmayan bir ilan** oluşuyor — ilanın tek işlevi
telefonla ulaşılmak olduğu için ilan ölü doğuyor. Hiçbir katmanda (istemci, action, DB) telefon
zorunluluğu yok.

**Kabul kriteri:** Üç durum ayrılır: yükleniyor / numara var / numara yok. Sonuncusunda
"Profilinize telefon ekleyin" bağlantısı gösterilir ve **Yayınla düğmesi kapalı** olur.
V2 ile birlikte sunucu da telefonsuz ilanı reddeder.

### U4 — Geçmiş tarihli ilan verilebiliyor · **2p** · 🟡 Orta
`page.tsx:476` `<input type="date">` — `min` yok, sunucuda da kontrol yok. Kullanıcı dünün
tarihini seçip yayınlayabiliyor. `expires_at` varsayılanı `now() + 48 saat`
(`20260519_...sql:7`) olduğu için ilan yayında kalıyor ama tarihi geçmiş; feed'de gürültü.

**Kabul kriteri:** `min={bugun()}` istemcide, `available_date >= bugün` sunucuda. Üst sınır da
konur (öneri: +90 gün) — "2031" yazan ilanlar filtreleri bozuyor.

### U5 — 48 saatlik ömür kullanıcıya hiç söylenmiyor · **2p** · 🟡 Orta
İlanlar `expires_at` dolunca cron ile `passive`'e çekiliyor (15 dakikada bir). Ne formda ne
başarı ekranında bunun bir yerde yazması var. Kullanıcı ilanının niye kaybolduğunu anlamıyor;
destek yükü ve güven kaybı.

**Kabul kriteri:** Başarı ekranında "İlanınız 48 saat yayında kalacak — süre dolmadan panelden
tazeleyebilirsiniz" + panelde tek tıkla tazeleme.

### U6 — Yöntem değiştirmek tüm formu uyarısız siliyor · **2p** · 🟡 Orta
`geriYontemSec()` (`page.tsx:316-327`) `yontem`'i sıfırlarken **tüm form alanlarını** başlangıç
değerine döndürüyor — AI ile ayrıştırılmış metin dahil. Navbar'daki "← Geri" düğmesi bunu
onaysız yapıyor. 15 alan doldurup yanlışlıkla geri basan kullanıcı her şeyi kaybediyor.

**Kabul kriteri:** Form kirliyse (`dirty`) onay istenir. AI ham metni ("Metni düzenle" akışı
zaten bunu koruyor) her hâlükârda saklanır.

### U7 — Hata gösterimi alan bazlı değil, tek satır · **2p** · 🟡 Orta
`kaliteBariyer()` (`:179-185`) ilk hatayı döndürüp duruyor; mesaj formun **en altında**
gösteriliyor (`:606`) ve ilgili alana ne odaklanılıyor ne kaydırılıyor. Uzun formda kullanıcı
hangi alanın eksik olduğunu görmüyor. Ayrıca `<select required>` ile özel doğrulama çakışıyor:
tarayıcı kendi baloncuğunu önce gösterdiği için `kaliteBariyer` mesajları çoğu senaryoda hiç
görünmüyor — iki farklı hata dili aynı formda.

**Kabul kriteri:** Alan bazlı hata state'i, ilk hatalı alana `scrollIntoView` + `focus`,
`noValidate` ile tek doğrulama dili.

### U8 — Taslak/otomatik kayıt yok · **2p** · 🟡 Orta
Mobilde uzun bir form; sekme kapanması, gelen arama veya sayfa yenilemesi her şeyi siliyor.
Nakliye sektörünün ana kullanım ortamı mobil.

**Kabul kriteri:** `sessionStorage`'a debounce'lu taslak yazımı, dönüşte "Kaldığınız yerden
devam edin?" önerisi. (⚠️ `localStorage` değil — telefon numarası ve yük bilgisi kalıcı
saklanmamalı.)

### U9 — Fiyat rozeti aşırı vaat ediyor · **1p** · 🟢 Düşük
`page.tsx:295-299` fiyat girildiyse *"✓ Fiyat Belli rozeti kazandınız!"* diyor. Rozet ilan
detayında/kartında gerçekten gösteriliyor mu, `fiyat > 0` mı yoksa `'0'` da rozet mi veriyor
belirsiz — `fiyat` bir string ve `fiyat &&` kontrolü `'0'` için **true**. Sıfır TL'ye rozet.

**Kabul kriteri:** `Number(fiyat) > 0` kontrolü; rozetin gerçekten render edildiği yer test edilir.

### U10 — Yöntem seçim ekranı gereksiz bir adım · **1p** · 🟢 Düşük
Kullanıcıların büyük çoğunluğu tekil ilan verecek; herkes önce bir menü ekranı görüyor.
U2 ile birlikte çözülür.

---

## 4. M — Mimari & kod sağlığı

### M1 — `Navbar` bileşen gövdesi içinde tanımlı — projenin kendi anti-pattern'i · **3p** · 🟠 Yüksek
`page.tsx:270-284`: `const Navbar = ({ geri }) => (...)` `IlanVer` fonksiyonunun **içinde**
tanımlanıp `<Navbar />` olarak çağrılıyor. `PROJE_HARITASI §9`, "İnline component anti-pattern"
başlığı altında tam olarak bunu yasaklıyor: her render'da yeni bir bileşen **tipi** doğar,
React ağacı yeniden mount eder, input odağı kaybolur. Burada Navbar'ın kendi input'u olmadığı
için semptom görünmüyor ama her tuş vuruşunda sticky nav ve logo yeniden mount ediliyor.

**Kabul kriteri:** `Navbar` dosya seviyesine (veya ortak bir bileşene) taşınır.

### M2 — `ILLER` 9 dosyada, `ARAC_TIPLERI`/`UTSYAPI` 11 dosyada kopyalanmış · **3p** · 🟠 Yüksek
```
ILLER          → app/{moderator,u/[username],ilan-ver}/…, app/_components/HomeClient.tsx,
                 app/admin/{poi-onay,radar}/…, app/api/admin/poi-import/route.ts,
                 app/ilan-ver/TopluYukle.tsx, lib/il-koordinatlari.ts   (9 kopya)
ARAC_TIPLERI   → app/{profil-tamamla,araclarim,panel×3,moderator,u/[username],ilan-ver}/…,
                 app/_components/HomeClient.tsx, app/api/{parse-text,whatsapp}/route.ts (11 kopya)
```
Bu, projenin `lib/sifre.ts`, `lib/kimlik.ts`, `lib/ilan-liste.ts`, `lib/whatsapp/chatParser.ts`
ile dört kez uyguladığı "tek kaynak" ilkesinin en büyük ihlali. Somut risk: yeni bir üst yapı
("Konteyner") eklendiğinde 11 dosyanın 3'ü unutuluyor; `panel/actions.ts`'teki beyaz liste onu
tanımadığı için kullanıcı ilanını düzenlediğinde alan **sessizce siliniyor**. Bu, `chatParser`
ayrışmasında zaten yaşanmış bir hata sınıfı.

**Kabul kriteri:** `lib/sabitler.ts` (veya `lib/iller.ts` + `lib/arac.ts`) tek kaynak olur;
tüm kopyalar import'a çevrilir. ⚠️ `parse-listing` Deno tarafı import edemez — orada kopya
kalırsa dosyanın başına "buranın ikizi `lib/…`" notu düşülür (`lib/whatsapp/telefon.ts`
kalıbı).

### M3 — `.page.tsx.swp` repoda takip ediliyor · **1p** · 🟢 Düşük
`git ls-files app/ilan-ver/` çıktısında `app/ilan-ver/.page.tsx.swp` var — 16 KB'lık bir vim
swap dosyası versiyonlanmış. Editör çakışması ve gereksiz diff üretir.

**Kabul kriteri:** `git rm --cached` + `.gitignore`'a `*.swp`, `*.swo`, `*~`.

### M4 — 621 satırlık tek client component · **2p** · 🟡 Orta
`page.tsx` içinde: 3 ekran yönlendirmesi, 20 state, 4 `useEffect`, AI çıktı eşleyicisi, inline
stil sözlüğü, inline Navbar ve 280 satırlık JSX. Test edilemez, gözden geçirilemez.
`aiCiktisiniUygula` (`:206-261`) saf bir dönüşüm fonksiyonu ama bileşenin içine gömülü —
oysa V8/B4'teki eşleme hatalarının hepsi tam olarak orada ve birim testiyle yakalanabilirdi.

**Kabul kriteri:** `aiCiktisiniUygula` saf fonksiyon olarak `lib/ilan-ver/ai-eslestir.ts`'e
taşınır ve `npm run test:*` kalıbıyla test edilir (`chatParser` kalıbı). Form parçalara
bölünür: `<TekilForm>`, `<AracSecimi>`, `<DurakListesi>`.

### M5 — Bu akış için hiç test yok · **2p** · 🟡 Orta
Projede `lib/whatsapp/__tests__/chatParser.test.ts` (29 assertion) var — kritik parse mantığı
korunuyor. İlan verme yolunda hiçbir test yok; oysa buradaki doğrulama, beyaz liste ve AI
eşleme kuralları en az o kadar kırılgan.

**Kabul kriteri:** `ilanKaydet` doğrulama katmanı ve AI eşleyici için birim testleri;
`npm run test:ilan-ver`.

---

## 5. Öncelik sırası (dalgalar)

| Dalga | Maddeler | Puan | Neden bu sırada |
|---|---|---|---|
| **W0 — Kanama durdur** | V1, V2, V3, V4 | 19 | En ayrıcalıklı yazma yolu doğrulamasız. V3 olmadan V4 anlamsız; V1 diğer üçünün altyapısı. Kod deploy'u önce, migration (varsa) sonra (`§9` sıralama kuralı). |
| **W1 — Kırıkları onar** | B1, B3, B4, V5 | 15 | B1 ilan edilen bir özellik hiç çalışmıyor. B3/B4 veri kaybı — her gün geçtikçe düzeltilemez kayıt birikiyor. |
| **W2 — Maliyet & kötüye kullanım** | V6, V7, B2 | 11 | V7 doğrudan para (Anthropic). V6 spam. B2 ancak B1 çalışınca tetiklenir. |
| **W3 — Dönüşüm** | U1, U2, U3, U4, U5 | 14 | W0–W2 bittikten sonra huniye trafik akıtmak güvenli. U1 A/B ölçümü ister. |
| **W4 — Sağlamlaştırma** | V8, V9, V10, B5, B6, B7, B8, B9, U6–U10, M1–M5 | 28 | Tek kaynak ihlalleri ve test borcu; sonraki sprintin hız kazancı buradan gelir. |

**Toplam: 30 madde / 87 puan.**

---

## 6. Doğrulanması gerekenler (kod okumasıyla kapatılamayanlar)

🔬 Bu maddeler DB'ye canlı sorgu veya tarayıcıda tek bir tıklama gerektiriyor:

1. **`listings.status` varsayılanı.** `ilanKaydet` `status` alanını **hiç yazmıyor**;
   `/api/excel-import` `'active'` yazıyor. Varsayılan `'active'` değilse form ilanları hiç
   görünmüyor demektir.
   `select column_default from information_schema.columns where table_name='listings' and column_name='status';`
2. **Orta bant gerçekten atlanıyor mu.** 31–70 puanlık bir test ilanı açıp
   `select audit_score, moderation_status, status from listings order by created_at desc limit 1;`
   (V3'ün kanıtı.) — Kod tarafı **doğrulandı**: `audit_listing_fn` yalnızca iki dosyada
   tanımlı (`20260505_audit_engine.sql:7` ve onu ezen `20260508_…:57`); `docs/` altındaki
   50 `.sql` dosyasının hiçbiri sonradan yeniden tanımlamıyor. Üstelik `auto_pub_max`
   `:69-74`'te hesaplanıp `:133`'te loglanıyor ama **hiçbir karar dalında kullanılmıyor** —
   dal yazılmak istenmiş, unutulmuş. Geriye yalnızca canlı teyit kaldı.
3. **B1'in gözlemi.** `/ilan-ver` → Toplu Yükleme → şablonu indir → yükle. Beklenen: alert
   içinde JSON parse hatası. Network sekmesinde `/api/excel-import` isteğinin 500 + `text/html`
   döndüğü teyit edilmeli.
4. **`safety_rules` doluluğu.** Audit skoru bütünüyle `safety_rules` tablosuna bağlı; tablo
   boşsa her ilan 0 puan alır ve V3 pratikte zaten hiçbir şeyi kuyruğa sokmuyordur.
   `select rule_type, count(*) from safety_rules where is_active group by 1;`
5. **`vehicles` kolon adları.** B3'ün migration'ı yazılmadan `vehicles` tablosunun gerçek
   şeması teyit edilmeli.
6. **`expire-active-listings` cron'u canlı mı.**
   `select jobname, schedule, active from cron.job where jobname='expire-active-listings';`
   (U5'in metni buna dayanıyor.)

---

## 7. Bu analizden çıkan kalıcı kurallar (§9'a eklenmeli)

- **İlan yaratma yolu, ilan düzenleme yolundan daha az korunamaz.** `panel/actions.ts` sahiplik +
  beyaz liste + uzunluk sınırı uyguluyor; `ilan-ver/actions.ts` hiçbirini uygulamıyor. Aynı tabloya
  yazan iki yol arasındaki bu asimetri, güvenlik çalışmasının "hata bulunan dosyada" durup
  "aynı hatanın kardeş dosyasında" durmamasından doğuyor. **Bir sınıf hata bulunduğunda, o tabloya
  yazan TÜM yolları tara.**
- **`moderation_status` hiçbir uygulama katmanında sabit yazılmaz.** Karar tek yerde (trigger)
  verilmeli; çağıranın "auto_published" yazması, moderasyon motorunu çağıranın insafına bırakır.
- **Kota, kapının olduğu yerde sayılmalı.** Ücretli çağrıyı `parse` anında kontrol edip `kayıt`
  anında saymak, ikisi arasındaki her adımı bedava yapar (V7). SMS'te öğrenildi, LLM'de
  tekrarlandı.
- **İstemci ile route sözleşmesi tek bir tipte tanımlanmalı.** B1'in tamamı, iki dosyanın
  birbirinden habersiz farklı gövde/yanıt şekli konuşmasından ibaret ve TypeScript bunu
  yakalayamadı çünkü `fetch` gövdesi `any`. Ortak `type` dosyası + `satisfies` ile derleme
  zamanında yakalanabilirdi.
- **`listings`'e kolon ekleyen her migration'a grant satırı eşlik eder** (B3). L1e sonrası tablo
  kolon bazlı yetkilendirilmiş durumda; unutulan grant `42501` ile uygulama katmanında
  "kayıt olmadı" gibi görünür.
