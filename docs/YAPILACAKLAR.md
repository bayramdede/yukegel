# Yükegel — Yapılacaklar Listesi

> 🗺️ **COĞRAFİ STANDARDİZASYON — DALGA 1 CANLIDA, DALGA 2 KODU HAZIR** (30 Tem 2026,
> tam plan `docs/COGRAFI_GECIS.md`). İl metin olmaktan çıkıp `province_id` (plaka kodu 1-81)
> oluyor; ilçe metin kalıyor ama **seçmeli** (81 il / 973 resmî ilçe `lib/constants/locations.json`).
> Geçiş **çift yazım**: metin kolonları yerinde kalır, Dalga 5'te drop edilir.
>
> ✅ **`docs/20260730_province_id.sql` ÇALIŞTIRILDI — 30 Tem 2026.** Doğrulama çıktısı:
> - 8.1 `listings` 234.229/234.229 = **%100** · `listing_stops` 244.379/244.379 = **%100**.
>   Tek satır bile eşleşmesiz kalmadı; alias köprüsüne (6.B) ihtiyaç olmadı denebilir.
> - 8.2 **sıfır satır** — id ile metin hiçbir yerde çelişmiyor.
> - 8.3 aynı il içi ilan **6.173** (~%2,6). Bunun ne kadarı meşru şehir içi taşıma, ne kadarı
>   W5'in sahte İstanbul→İstanbul'u — **henüz ayrıştırılmadı**, Dalga 2 öncesi ölçülmeli.
> - 8.4 `anon → SELECT`, `authenticated → SELECT/INSERT/UPDATE` yerinde (42501 tuzağı kapandı).
>
> ✅ **`docs/20260730_ilan_olustur_v3.sql` ÇALIŞTIRILDI (30 Tem 2026) — duman testi geçti.**
> Bilerek bozuk yazımla (`origin_city='istanbul'`, durak `'ANKARA'`) çağrıldı; dönen
> `İstanbul | 34` ve `Ankara | 6`. Yani metin kanonikleşiyor **ve** id doluyor, hem kalkışta
> hem durakta. ⚠️ Testte `source` uydurma değer alamaz — `listings_source_check` var, geçerli
> küme `whatsapp|facebook|telegram|manual` (ilk denemede 23514 aldık).
>
> ⏳ **SIRADAKİ: `npm run deploy`.** SQL canlıda ama kod değil; deploy'a kadar RPC'ye eski
> gövde gidiyor (id yine de doluyor — v3 metinden türetiyor, bu tasarımın asıl faydası).
> Deploy'dan **24 saat sonra** v3 dosyasının sonundaki iki kapsama sorgusunu çalıştır:
> `eksik` ≈ 0 ve ikinci sorgu **sıfır satır** olmalı; olmazsa RPC'yi atlayan bir yazma yolu var.
>
> Migration'daki 6.A geri doldurma güncellemesi idempotent — arada oluşmuş NULL'lar için
> tekrar çalıştırılabilir (`where origin_province_id is null` koşulu zaten var).
>
> ✅ **Dalga 2 kodu tamam (30 Tem 2026).** `ilan_olustur` v3 + `lib/ilan-yaz.ts` +
> `app/moderator/actions.ts` + `app/panel/actions.ts` güncellendi; `parse-listing`,
> `excel-import` ve `whatsapp` **kod değişikliği gerektirmedi**.
> `npx tsc --noEmit` temiz · `test:lokasyon` 21/21 · `test:parser` 29/29.
> **Kilit karar:** jsonb ayrışma tuzağını disiplinle değil **tasarımla** kapattık — RPC v3
> `province_id`'yi `origin_city` metninden `il_key()` ile kendisi türetiyor ve metni kanonik ada
> çevirerek yazıyor. Çağıran unutsa bile id doluyor, ve `origin_city='istanbul'` sınıfı bozulma
> bir daha doğamıyor. (Tuzak `district_official` gibi DB'den türetilemeyen alanlar için sürüyor.)
>
> **Kalan dalgalar (kod):**
> - [ ] **Dalga 3 — okuma/filtre/moderasyon.** `HomeClient` (🔴 filtre şu an tamamen istemcide,
>       `includes` büyük/küçük harfe duyarlı — spec md.5'in SQL filtresi yeni sunucu yolu ister)
>       + 5 radar/nearby RPC'sindeki `ILIKE '%…%'` → `= province_id` + moderatör paneli (md.6).
> - [ ] **Dalga 4 — AI parser.** Prompt'lar. 🚨 AI'a **doğrudan plaka kodu ürettirme** — 81 satırlık
>       tabloyu prompt'a koymak token yakar ve model uydurur ("Bursa 16 mı 61 mi"). Eşleştirmeyi
>       `lib/lokasyon.ts::ilId()` yapar; spec md.4'ün istediği sonuç böyle de sağlanır.
> - [ ] **Dalga 5 — drop.** `origin_city`, `listing_stops.city`, ölü `destination_city`, eski
>       metin index'leri (trigram dahil). Ön koşul: Adım 8.2 **bir hafta** sıfır satır.
>
> ❌ **DÜZELTME (30 Tem 2026) — "W5'in il yazımı adımları gereksizleşti" TAVSİYESİ YANLIŞTI.**
> Gerekçe (`il_key()` iki yazımı aynı id'ye katlar) yalnızca **id kolonu** için geçerliydi;
> **metin kolonu Dalga 3'e kadar canlı arayüzü besliyor.** Runbook Adım 2 bunu zaten yazmıştı:
> *"şehir filtresi hâlâ ham değere bakıyor."* Veri doğruladı:
>
> 🔴 **CANLI HATA — `origin_city='istanbul'` 22.474 satır** (tüm ilanların ~%9,6'sı).
> Tamamı `source='whatsapp'`, ilk 12 May, **son 29 Tem** → akış hâlâ üretiyor.
> `HomeClient:711` `i.kalkis?.includes(kalkis)` büyük/küçük harfe duyarlı, dropdown (satır 823)
> `ILLER`'den kanonik `İstanbul` veriyor ⇒ **kullanıcı İstanbul filtrelediğinde bu ilanları
> göremiyor.** Kaynak: `parse-listing/index.ts:818` `origin_city: firstLane.from` —
> `aliases.normalized` ham değeri hiç kanonikleştirilmeden yazılıyor.
> (Sahte İstanbul→İstanbul güzergâhı bunun alt kümesi: 1.565 satır. Aynı il içi 6.173 ilanın
> kalan ~4.600'ü aynı yazımda, yani meşru şehir içi taşıma.)
>
> - [x] ✅ **`docs/20260730_istanbul_kanonik.sql` ÇALIŞTIRILDI — 30 Tem 2026.**
>       Blok 1 alias kaynağını kuruttu, Blok 2 metni `province_id`'den onardı.
>       **Doğrulama 2.4 = 0** → farklı yazımlı aynı il satırı kalmadı, sahte İstanbul→İstanbul
>       güzergâhı (1.565 satır) temizlendi. 22.474 ilan artık İstanbul filtresinde görünüyor.
>       ⚠️ Tek seferlik temizlik: `learn-aliases` yeni bozuk satır üretirse delik geri açılır.
> - [ ] Runbook'un **ilçe** adımları (3, 4, 6) + `20260729_alias_normalize_trigger.sql`
>       hâlâ geçerli — trigger olmadan `learn-aliases` yeni bozuk satır üretebilir.
>
> Son güncelleme: 29 Temmuz 2026 — **ILAN_VER_ANALIZ W0 + W1 tamamlandı** (34p/87). İlan
> verme yolu sertleştirildi ve kırıkları onarıldı: `listings` yazan tek yol `lib/ilan-yaz.ts`,
> ilan+durak yazımı `public.ilan_olustur()` RPC'siyle atomik, aylardır ölü olan toplu yükleme
> ortak sözleşmeyle çalışır hâlde, yük cinsi durak bazlı, seçilen araç ilana bağlı.
> ⚠️ **İki migration bekliyor** (bkz. W1 bölümü). Öncesi:
> (SPRINT_01 **W0 + W1 + W2 + W3 + W4 tamamlandı** — telefon sızıntısı hem uygulama hem DB katmanında kapatıldı, auth denetim izi açıldı, iki ayrı yetki yükseltme açığı kolon beyaz listesiyle giderildi, `/auth/reset` ve `/cikis` sertleştirildi, `merged_into` giriş döngüsü `/auth/devir` ile kapandı, SMS ve şifre tetikleyicileri istemciden alınıp kotalı sunucu route'larına taşındı, paylaşım kartı + sitemap + robots + noindex katmanı kuruldu, iki CTA huni ölçümüyle ayrıştırıldı ve son dalgada kayıt/giriş/landing cilası yapıldı: şifre kuralı ve liste limiti tek kaynağa indi, sekme URL'e yansıdı, doğrulama e-postası tekrar gönderilebilir oldu.)
>
> **SPRINT_01 KODA DAİR KISMI BİTTİ.** Kalan işler: aşağıdaki "Diğer yeni bulgular" +
> Bayram'ın kod dışı maddeleri (`docs/SPRINT_01.md` sonundaki liste).
>
> 🚨 **W5 (alias veri bütünlüğü) — KOD BİTTİ, SQL BAYRAM'DA** (29 Tem 2026, bkz. `docs/W5_DEVIR.md`).
> Beş bilet tamam: **D1** prompt örnekleri Türkçeleşti · **D2** dört yazma yolu
> `lib/alias-normalize.ts` üzerinden geçiyor (409 çakışma) · **D4** `findPlaces` karşılaştırma
> anahtarları katlandı (5/5 kabul testi; HEAD 3/5 başarısız) · **D5** runbook · **D3** trigger+indeks SQL'i.
> ⏳ **BAYRAM — sırayla çalıştırılacak:**
> 0. ✅ **Adım 0 ölçümü ALINDI** (29 Tem 2026, sonuçlar runbook'ta "ÖLÇÜM SONUÇLARI" bölümünde).
>    Özet: sahte güzergâh **0 satır** (geçmiş hasar yok, D4 önleyici) · aynı şehir 6.173 satır
>    (meşru, korunacak) · **16 yazım çakışması ~88 satır** (~12 ASCII + 🆕 ~76 TAMAMI BÜYÜK HARF)
>    · 0.4 hâlâ ölçülmedi (yanlış tablo sorgulandı).
> 1. `docs/20260729_alias_runbook.md` → Adım 1-9. ⚠️ Adım 8 **eski
>    `20260728_alias_kopya_temizligi.sql` BÖLÜM 6'yı geçersiz kılıyor**: o bölüm ölü
>    `destination_city`'yi onarıp canlı `listing_stops`'u atlıyor. Ölçüm bunu doğruladı:
>    BÖLÜM 6'nın elle yazılmış 4 şehirlik listesi 16 grubun **13'ünü** kaçırırdı.
> 2. `docs/20260729_alias_normalize_trigger.sql` → **en son**; runbook Adım 9 yapılmadan indeks
>    23505 ile reddedilir.
> Her adımın önizleme `SELECT`'i var, `UPDATE`'ler yorumda, hiçbir adım satır silmiyor.
>
> ✅ **BAYRAM — 3 SQL'in ÜÇÜ DE ÇALIŞTIRILDI** (29 Tem 2026): `20260728_kvkk_onay.sql`,
> `20260728_auth_events.sql`, `20260728_contact_phone_revoke.sql`.
> ✅ Sonuncusunun **duman testi de geçti**: misafir ana sayfa + `/ilan/[id]` açılıyor,
> `/moderator` listesi telefon kolonuyla yükleniyor, moderatör telefon düzenleme çalışıyor.
> `contact_phone`'a dokunan her yol service-role kullanıyor → kırık yazma yolu yok.
> 🚨 Yeni tuzak: `listings` artık **kolon bazlı** yetkili — sonradan eklenen kolonlar
> `anon`/`authenticated` için yetkisiz doğar (bkz. PROJE_HARITASI §9).
>
> ~~Ayrıca kontrol: `public.users.is_active` DB default'u~~ ✅ doğrulandı: default `true`, NULL satır yok (29 Tem 2026). Opsiyonel sertleştirme: `alter table public.users alter column is_active set not null;`
>
> Bu dosya tüm geçmiş sohbetler taranarak oluşturulmuştur.

---

## ✅ Tamamlananlar (Faz 1)

### Backend & Parse
- [x] Parse bug fix (WhatsApp mesaj ayrıştırma hataları)
- [x] LLM entegrasyonu (Anthropic Haiku)
- [x] "LLM'e Sor" butonu (moderatör paneli)
- [x] Alias öğrenmesi (şehir, araç tipi, kasa tipi)
- [x] `clean_hash` cache (SHA-256 hash, unique index, duplicate atlama)

### Veritabanı Altyapısı
- [x] `system_config` tablosu — `category`, `data_type`, `updated_by` kolonları dahil
- [x] `listings` tablosuna `expires_at` kolonu (30 gün default)
- [x] `pg_cron` expire job (her gece 02:00, süresi dolmuş ilanlar pasife alınır)
- [x] `users.role` kolonu (`user` / `moderator` / `admin`)

### Auth — UI Katmanı
- [x] `/giris` sayfası UI — Telefon + OTP sekmesi tasarımı
- [x] `/giris` sayfası UI — E-posta + Şifre sekmesi (giriş, kayıt, şifremi unuttum)
- [x] `/auth/reset` — Şifre sıfırlama sayfası
- [x] `/auth/callback` — E-posta doğrulama sonrası rol bazlı yönlendirme
- [x] `lib/auth.ts` — `requireAdmin()`, `requireModerator()`, `getCurrentUser()`, `landingForRole()`
- [x] `/moderator` sayfası — Rol koruması (sadece moderatör + admin)
- [x] Telefon OTP sonrası `user_type` yoksa `/profil-tamamla`'ya yönlendirme (`otpDogrula` içinde)
- [x] `/profil-tamamla` sayfası — user_type seçimi, Ad Soyad, Telefon, TCKN/VKN, araç bilgileri (arac_sahibi için)

### Admin Paneli
- [x] `/admin` — Yönetim paneli ana ekranı (kart düzeni)
- [x] `/admin/sistem-ayarlari` — `system_config` UI (kategorili kartlar, inline düzenleme, tip-aware input, service role action)

### İlan Sistemi
- [x] TCKN/VKN format kontrolü (11 / 10 hane) + checksum doğrulama
- [x] "Yeni üye" etiketi (kayıt tarihine göre)
- [x] 3 seçenekli ilan oluşturma karşılama ekranı (`/ilan-olustur`) — Tekil aktif, Excel + Metinden "Yakında"
- [x] Tekil yük ilanı formu (`/ilan-ver`) — 4 adımlı wizard, `listings` + `listing_stops` tablosuna yazar
- [x] Excel toplu yükleme (`TopluYukle.tsx`) — şablon parse + satır bazlı validasyon + onay ekranı + Supabase'e yazma
- [x] "Sahiplen" akışı — `/ilan/[id]/sahiplen` — OTP doğrulama ile doğrulanmamış ilanı sahiplenme
- [x] "Doğrulanmamış İlan" etiketi + tooltip (parse kaynaklı sahipsiz ilanlar)
- [x] "✓ Fiyat Belli" rozeti (yeşil, ana sayfa kartı + detay sayfası)

---

## ⏳ Kalan Görevler — Faz 1

### 🔐 Auth & Üyelik Akışı

- [ ] **E-posta kayıt → profil tamamlama uçtan uca testi**
  - `/auth/callback` `user_type` kontrolü var ama production'da test edilmedi
  - Doğrulama maili → link → callback → profil-tamamla akışı doğrulanacak

- [ ] **İlan verirken profil kontrolü**
  - `/ilan-ver`'e gidildiğinde `user_type` yoksa `/profil-tamamla`'ya yönlendir

### 🛠 Admin & Moderasyon

- [x] **Radar & İstihbarat Paneli** (4 Haziran 2026) — `/admin/radar`: rota bazlı lead tarama, kontratlı iş tespiti, WhatsApp hızlı aksiyon, geçmiş drawer. `get_radar_intelligence` RPC fonksiyonu.

- [ ] **Blacklist kelime yönetimi** — `system_config` üzerinden, admin paneline entegre
- [ ] **Admin moderasyon dashboard** — İlanları onaylama/reddetme, şüpheli ilanları listeleme
- [ ] **"Sonraya Bırak" kalıcılığı** — Moderatör panelinde ertelenen ilan ID'leri şu an bellekte tutuluyor, sayfa yenilenince sıfırlanıyor; `localStorage` veya `listings` tablosuna `deferred_at` kolonu ile kalıcı hale getirilecek

### 📄 İlan Oluşturma

- [ ] **Metinden ilan girme** — LLM parse + önizleme + onay akışı (`/ilan-ver` → metin seçeneği, şu an YAKINDA)
- [ ] **Araç ilanı formu** — Nakliyecinin araç/kapasite ilanı vermesi (tekil, ayrı form)

### 🔄 İş Akışları

- [ ] **"Bu işi aldım" butonu** — Nakliyeci tıklar → müşteriye bildirim → onay/ret → ilan pasife alınır

### 📋 Panel Geliştirme

- [ ] **Müşteri paneli** — "Araç Bulundu" butonu, not ekleme, tekrar aktif etme
- [ ] **Nakliyeci paneli** — Atanan işlerim listesi, durum güncelleme (İşi Aldı → Yükü Aldı → Taşımada → Teslim Etti)

### 📬 Altyapı & İletişim

- [ ] **E-posta bildirimleri** — İlan süresi dolunca, iş onaylandığında, durum güncellemelerinde
- [ ] **Yasal sayfalar** — Kullanım Koşulları, Gizlilik Politikası, KVKK aydınlatma metni

### 🌍 Görünürlük

- [ ] **Landing page** — Kayıtsız kullanıcıya yönelik tanıtım sayfası (değer teklifi, CTA, neden Yükegel)
- [ ] **SEO** — Meta tag'ler, Open Graph, sitemap.xml, robots.txt

---

## 🔮 Faz 2

- [ ] **Doğal dil arama** — Nakliyecinin metin yazarak ilan araması (LLM destekli)
- [ ] **`user_events` tablosu** — Kullanıcı davranış takibi (ilan görüntüleme, arama geçmişi) → öneri sistemi temeli
- [ ] **Trust score algoritması** — Nakliyeci: Puan %40 + Tamamlama %30 + No-show %20 + Kıdem %10 / Müşteri: Puan %50 + Tamamlama %30 + Ulaşılabilirlik %20
- [ ] **WhatsApp grup yönetici paneli** — Hangi gruplardan mesaj çekileceğini admin UI'dan yönetme
- [ ] **MERNİS / GİB entegrasyonu** — TCKN ve VKN'nin resmi sistemlerden doğrulanması + doğrulandı rozeti
- [ ] **Canlı konum takibi** — Nakliyecinin taşıma sırasında konumunun haritada görünmesi
- [ ] **48 saat yanıtsız ilan etiketi** — Nakliyeciden geri dönüş olmayan ilanlar işaretlenir
- [ ] **Ara durum adımları** — Mevcut 4 adımlı iş akışına ek detay adımlar
- [ ] **Ödeme & abonelik sistemi** — Üyelik planları, kredi kartı entegrasyonu (2 yıl sonra)

---

## 📌 Teknik Notlar

| Konu | Not |
|---|---|
| Admin kullanıcısı | `bayramdede@gmail.com` |
| Moderatör kullanıcısı | `bayramdede+supabase@gmail.com` |
| Supabase redirect URL'leri | `/auth/callback`, `/auth/reset` — hem localhost hem Vercel'de tanımlı olmalı |
| `system_config` action | Service role kullanır (RLS bypass) |
| İlan süresi | Kullanıcı ilanları 30 gün, parse ilanları 2 saat (WhatsApp), 7 saat (Excel) |
| Parse pipeline | `raw_posts` → Edge Function `parse-listing` → `listings` + `listing_stops` |

---

## ⚠️ Bilinen Kopukluklar

| # | Sorun | Etki | Çözüm |
|---|---|---|---|
| 1 | Telefon OTP sonrası `user_type` kontrolü yok | Yeni kullanıcı profil tamamlamadan ana sayfaya düşüyor | `yonlendir()` fonksiyonuna `user_type` kontrolü ekle |
| 2 | E-posta kayıt → profil-tamamla akışı test edilmedi | Muhtemelen çalışıyor ama doğrulanmadı | Uçtan uca test gerekli |
| 3 | `users` tablosuna otomatik kayıt mekanizması belirsiz | Profil verisi kaybolabilir | Supabase Auth trigger veya profil-tamamla submit'te açıkça yazılmalı |


## 📦 İlan Verme Akışı — Analiz (29 Tem 2026)

Tam analiz, kabul kriterleri ve dalgalar: `docs/ILAN_VER_ANALIZ.md`
(30 madde / 87 puan; bulgu kodları **V1–V10** veri bütünlüğü & güvenlik, **B1–B9** bozuk,
**U1–U10** UX/dönüşüm, **M1–M5** mimari).

Özet: `app/ilan-ver/actions.ts` projenin en ayrıcalıklı yazma yolu (service-role `listings`
INSERT) ama `SPRINT_01`'in üç kazanımı — sunucu tarafı kolon beyaz listesi, sunucu tarafı kota,
sunucu tarafı sahiplik/doğrulama — bu yola **hiç uygulanmamış**.

### W0 — Kanama durdur (19p) ✅ **TAMAM** (29 Tem 2026)
- [x] **V1** — `ilanKaydet` için kolon beyaz listesi + sınır kontrolleri (`app/panel/actions.ts` kalıbı) · 6p
- [x] **V2** — `contact_phone` istemciden geliyor; oturumun profil telefonundan yazılmalı · 5p
- [x] **V3** — `moderation_status: 'auto_published'` sabiti 31–70 moderasyon bandını öldürüyor · 5p
- [x] **V4** — Başarı ekranı INSERT sonucunu okumuyor; shadow-ban'lı ilana "yayında" diyor · 3p

Yan kazanımlar (migration'sız, aynı yamada): **V9/V10** (action'ın kendi auth kapısı),
**V8/B9** (tanınmayan il/araç değeri artık ham hâliyle forma yazılmıyor), **V5 kısmî**
(durak INSERT'i patlarsa ilan telafi edici `DELETE` ile geri alınıyor — yetim kayıt yok),
**M2 kısmî** (`lib/ilan-sabitler.ts` tek kaynak; istemci ve sunucu beyaz listesi
fiziksel olarak ayrışamıyor), **A2** (istemci `bugun()` de sabit +03:00 kullanıyor).

Kalan: **V5 tam** (tek RPC ile atomik yazma) hâlâ W1'de.

### W1 — Kırıkları onar (15p) ✅ **TAMAM** (29 Tem 2026)
- [x] **B1** — 🔴 **Toplu yükleme fiilen çalışmıyor** — istemci JSON `{action,rows,userId}`, route `formData().get('file')`; ayrıca şablon `'Kalkış İli'` ↔ route `'Kalkış Şehri'` · 5p
- [x] **B3** — Seçilen araç ilana bağlanmıyor (`listings.vehicle_id` yok) · 3p ⚠️ migration'a **grant satırı** şart
- [x] **B4** — AI durak eşlemesi `cargo_type`'ı not alanına yazıyor; kayıtta tek global yük cinsi tüm duraklara kopyalanıyor · 3p
- [x] **V5** — İlan + duraklar atomik değil; durak INSERT'i patlarsa duraksız yetim ilan kalıyor · 4p

**Ne yapıldı.** İki yeni dosya: `lib/ilan-yaz.ts` (`listings` yazan tek yol) ve
`lib/toplu-yukle-sozlesme.ts` (toplu yükleme sözleşmesi). `/api/excel-import` ve
`app/ilan-ver/actions.ts` baştan yazıldı; ikincisi artık yalnızca bir auth kapısı.
B1'in asıl bulgusu protokol uyuşmazlığı değildi: excel-import **ikinci ve
sertleştirilmemiş bir ayrıcalıklı yazma yoluydu** — W0'da kapatılan V1/V3 delikleri
orada açık duruyordu. Sözleşme `satisfies` ile mühürlendi, `userId` sözleşmeden
tamamen çıkarıldı, önizleme `aliases` sözlüğünü kullanıyor (şablonun vaat ettiği
kısaltmalar artık gerçekten çözülüyor). B4'te durak bazlı yük cinsi hem tekil forma
hem AI eşlemesine hem Excel'e geldi. B3'te istemciden gelen `arac_id` sahiplik
(`user_id` + `is_active`) doğrulamasından geçiyor, doğrulanmayan id `WARN` loglanıp
sessizce düşüyor. **Yan kazanım: B2 kısmî** — `maxDuration=60`, `MAX_SATIR=300`,
`MAX_ILAN=50` (kalan: satır bazlı süre bütçesi).

> ⚠️ **BAYRAM — İKİ MIGRATION, SIRAYLA, KODU DEPLOY ETMEDEN ÖNCE:**
> 1. `docs/20260729_ilan_olustur_rpc.sql` — `public.ilan_olustur(jsonb,jsonb)`
> 2. `docs/20260729_listings_vehicle_id.sql` — `listings.vehicle_id` + **grant** + RPC tazeleme
>
> Sıra tersine olursa ilan verme `PGRST202 function not found` ile **tamamen durur**
> (kod artık RPC'siz yazmıyor). Doğrulama ve duman testleri dosyaların sonunda.

**W1 sonrası bağımsız denetimde bulunup düzeltilenler (29 Tem 2026):**
- Türkçe sayı ayrıştırma — `Number("5.000")===5` yüzünden `5.000 TL` **5 TL**'ye kaydoluyordu, `"2,5"` tonaj `NaN` olup düşüyordu → `sayiMetniCoz()` (`lib/toplu-yukle-sozlesme.ts`), önizlemede uygulanıyor ki kullanıcı gerçek değeri görsün.
- Ondalık palet RPC'de `(…)::int` ile `22P02` atıp **tüm ilanı** geri alıyordu → `tamSayiAralik()` (`lib/ilan-yaz.ts`), `palet` ve `arac_adet`e uygulandı.
- Profilinde telefonu olmayan kullanıcı 50 ilanın 50'sinin de tek tek "başarısız" olduğu bir ekran görüyordu → `ilanTelefonu()` kontrolü döngüden ÖNCE, tek ve anlaşılır 400.
- `durumEtiketi()`'nin 3. parametresi iki çağrı yerinde de `false`'tı, `'error'` dalı ulaşılamazdı → parametre kaldırıldı.
- `TopluYukle.tsx` `MAX_ILAN`'a bakmıyordu: 60 gruplu dosyada buton "60 ilan" diyor, sunucu 400 dönüyor, **hiçbir** ilan oluşmuyordu → istemci tarafı uyarı + buton kilidi.

**Canlı DB'de doğrulanacak (W1):**
- [ ] Migration'lar çalıştı mı? → `select routine_name from information_schema.routines where routine_name='ilan_olustur';`
- [ ] Yetkisiz kolon kaldı mı? → `20260729_listings_vehicle_id.sql` DOĞRULAMA §1 (sıfır satır dönmeli)
- [ ] Yetim ilan var mı? → duraksız `listings` sorgusu (aynı dosya, duman testi §4). Eski kayıtlardan kalma varsa temizlenmeli.
- [ ] Araç ilanı verildiğinde `vehicle_id` gerçekten doluyor mu?
- [ ] Toplu yükleme uçtan uca: şablon indir → 2 satır → önizleme → tarih seç → onayla.

### W2 — Maliyet & kötüye kullanım (11p)
- [ ] **V7** — AI kotasının kapısı `parse`, sayacı `kayıt` — Anthropic sınırsız çağrılabiliyor · 4p
- [ ] **V6** — İlan oluşturmada hız limiti / tekrar tespiti yok · 4p
- [ ] **B2 kısmî** — ~~`maxDuration`~~ ✅ (60sn), ~~satır tavanı~~ ✅ (`MAX_SATIR=300`, `MAX_ILAN=50`); kalan: **satır bazlı süre bütçesi** (bütçe dolunca kalanları "işlenmedi" diye dönmek) · 1p
- [x] ~~**Yeni (W1'de keşfedildi)** — `app/moderator/page.tsx:974` `raw_posts`'tan ilan üretirken hâlâ kendi `listings` INSERT'ini + ayrı `listing_stops` INSERT'ini yazıyor~~ ✅ (29 Tem 2026) · 3p
- [x] ~~**Yeni (W1'de keşfedildi)** — İki OTOMATİK yol daha `ilanYaz()`'ı atlıyor: `app/api/whatsapp/route.ts` ve `supabase/functions/parse-listing/index.ts`~~ ✅ (29 Tem 2026) · 5p

**W1+ — Yazma yolu birleştirme ✅ (29 Tem 2026, 8p):**
`listings`'e yazan BEŞ yolun tamamı artık tek zeminden geçiyor:

| Yol | Nasıl |
|-----|-------|
| `/ilan-ver` formu | `ilanYaz()` |
| `/api/excel-import` | `ilanYaz()` |
| `app/api/whatsapp/route.ts` (Twilio) | `ilanYaz()` — **yeni** |
| `app/moderator/actions.ts` `moderatorIlanOlustur()` | `ilan_olustur()` RPC — **yeni** |
| `supabase/functions/parse-listing` (Deno) | `ilan_olustur()` RPC — **yeni** |

- `lib/ilan-yaz.ts`'e `KANAL_POLITIKA` tablosu eklendi: `whatsapp.daimaIncele = true` →
  audit skoru temiz olsa bile ilan yayına çıkmaz, kuyruğa girer. Politika bilerek
  `girdi`nin İÇİNDE değil modülde; istemci gevşetemesin diye.
- Moderatörün "Manuel Gir" akışı tarayıcıdan `moderation_status:'approved'` +
  `trust_level:'social'` yazıyordu — RLS satır bazlı olduğu için kolon düzeyinde
  engellenemiyordu. Artık `requireStaff()` kapısının arkasında.
- Yeni migration: **`docs/20260729_ilan_olustur_v2.sql`** — RPC'ye `raw_post_id`,
  `shadow_profile_id`, `is_repost`, `reviewed_at` (hepsi opsiyonel) eklendi; durak bazlı
  `vehicle_count` artık eziliyor değil, önce durağın kendi değerine bakılıyor.
  ⚠️ **SIRA:** `20260729_ilan_olustur_rpc.sql` → `20260729_listings_vehicle_id.sql` →
  `20260729_ilan_olustur_v2.sql` → kod deploy.
- ⚠️ `supabase/functions/**` `tsconfig.json`'da `exclude`'da: `tsc --noEmit` Edge
  Function'ı HİÇ derlemez. Oradaki RPC çağrısı elle gözden geçirilmeli.

### W3 — Dönüşüm (14p) · W4 — Sağlamlaştırma (28p)
U1–U10 ve V8–V10, B5–B9, M1–M5 için `docs/ILAN_VER_ANALIZ.md` §3–§5.
Öne çıkanlar: **M2** `ILLER` 9 dosyada / `ARAC_TIPLERI`+`UTSYAPI` 11 dosyada kopyalanmış;
**M1** `Navbar` bileşen gövdesi içinde tanımlı (projenin kendi anti-pattern'i);
**M3** `app/ilan-ver/.page.tsx.swp` git'te takip ediliyor — silinmeli.

### 🔬 Canlı DB / tarayıcı ile doğrulanacak
`ILAN_VER_ANALIZ.md` §6'daki 6 madde — özellikle `listings.status` kolon varsayılanı ve
`safety_rules` tablosunun dolu olup olmadığı (boşsa her ilan 0 puan alır, V3 pratikte
zaten hiçbir şeyi kuyruğa sokmuyordur).

W0 sonrası eklenen doğrulamalar:
- [ ] `safety_rules` **dolu mu?** Boşsa V3 kodu doğru ama etkisiz — her ilan 0 puanla `yayinda` döner.
- [ ] Bir ilanı 31–70 bandına düşürüp `moderation_status='pending'` + `status='passive'`
      olduğunu ve **listelerde görünmediğini** doğrula.
- [ ] Google ile kaydolmuş, profilinde telefonu OLMAYAN bir kullanıcıyla ilan ver:
      numara `users.phone`'a geri yazılıyor mu (V2 kendini onaran dal)?
- [ ] Gece 00:00–03:00 arası tarih alanının bugünü gösterdiğini doğrula (A2).

W1+ (yazma yolu birleştirme) sonrası duman testi:
- [ ] WhatsApp'tan ilan gönder → ilan `pending` + `passive`, durakları dolu.
- [ ] Moderatör paneli → Çözümsüz → "Manuel Gir" → Kaydet ve Onayla → ilan + duraklar
      birlikte oluştu mu, `raw_post_id` / `reviewed_at` dolu mu, telefon yazıldı mı,
      `raw_posts.processing_status` `processed` oldu mu?
- [ ] Bir WhatsApp grubundan ham mesaj düş → Edge Function ilanı RPC ile üretiyor mu
      (`shadow_profile_id` + `is_repost` dolu mu)?
- [ ] Yetim ilan kalmadı mı?
      `select l.id, l.source from listings l where not exists (select 1 from listing_stops s where s.listing_id = l.id) order by l.created_at desc limit 20;`
- [ ] `/ilan-ver` hatası: Vercel loglarında `ilanKaydet beklenmeyen istisna` ara —
      `error_message` + `stack` artık kaydediliyor.

### 🔴 "Telefon numarası Yükleniyor..." — sessiz arıza (29 Tem 2026) ✅ kod tarafı tamam

**Belirti (Bayram, canlı):** `/ilan-ver` İLETİŞİM kartı sonsuza kadar "Yükleniyor..."
gösteriyor. Aynı sayfada ilan kaydederken de "An error occurred in the Server Components
render..." çıkıyordu. **İkisi tek kök.**

**Neden görünmüyordu:** `useEffect(() => { init() }, [])` — `init()` bir promise döner,
reddedilirse hiçbir yerde yakalanmaz. Error boundary tetiklenmez, kullanıcı hata görmez,
`setTel` sadece hiç çalışmaz. Ekranda kalan tek iz masum bir yükleme yazısı.
`kullanicitelefon()` üç ayrı sonucu (oturum yok / numara yok / FIRLATTI) tek bir `null`'a
çöküyordu; `📞 {tel || 'Yükleniyor...'}` de üçünü aynı gösteriyordu.

**Yapılanlar:**
- `kullanicitelefon()` artık `TelefonDurumu` ayrık birleşimi dönüyor
  (`var` / `oturum-yok` / `numara-yok` / `hata`), try/catch + `structuredLog('phone-privacy')`.
- `page.tsx` her durumu ayrı gösteriyor; `numara-yok` → `/profil-tamamla` bağlantısı.
  `init().catch(...)` eklendi.
- `getServiceSupabase()` `process.env.X!` yerine açık kontrol yapıyor; eksik değişkenin
  **adını** söyleyerek fırlatıyor.

**Kalan (Bayram):** `SUPABASE_SERVICE_ROLE_KEY` Vercel'de **ada göre var**, ama değeri
dönmüş/yanlış ortama işaretlenmiş olabilir. Kontrol: Settings → Environment Variables →
anahtarın **Production** kutusu işaretli mi + Supabase panelindeki güncel `service_role`
anahtarıyla aynı mı. Deploy sonrası logda `phone-privacy` ara.

### 🔴 `shadow_profile_summary` view'ı RLS bypass ediyor (29 Tem 2026) — SQL BEKLİYOR

Supabase linter: **Security Definer View**. `shadow_profiles` admin-only RLS ile korunuyor
ama üstündeki view'a `GRANT SELECT ... TO authenticated` verilmiş ve view sahibinin
yetkisiyle çalışıyor → **siteye üye olan herkes** PostgREST'ten tüm kayıtsız nakliyeci
telefonlarını (`phone`, `name`, `company_name`, `notes`, `ai_analiz`) çekebiliyor. KVKK.

- [ ] **Bayram:** `docs/20260729_shadow_profile_summary_invoker.sql` çalıştır
      (`security_invoker = on` + yetkiyi yalnız `service_role`a bırak). Kod deploy'u gerekmez.
- [ ] Doğrula: `reloptions` içinde `security_invoker=true` görünüyor mu, `anon`/`authenticated`
      için `has_table_privilege` false mu (SQL dosyasındaki §1–§2 sorguları).
- [ ] `/admin/crm` hâlâ çalışıyor mu? (service-role kullandığı için etkilenmemeli)

### 🚀 Otomatik deploy kapatıldı (29 Tem 2026)

Daemon her kaydetmede push atıyor, Vercel her push'ta build ediyordu → günde ~79 deploy
(Hobby limiti 100/gün, bugün doldu) ve yarım kod canlıda.

- [x] `vercel.json` → `ignoreCommand`: commit mesajı `auto:` ile başlıyorsa build atlanır.
      ⚠️ Vercel şeması bilinmeyen üst düzey anahtar kabul etmiyor — açıklama satırı
      (`_ignoreCommand_neden`) reddedildi, gerekçe `scripts/deploy.sh` başlığında.
- [x] `scripts/deploy.sh` + `npm run deploy` — tek deploy kapısı. `.git/index.lock` bekler,
      `tsc --noEmit` çalıştırır (tip hatası varsa DURDURUR), `deploy:` commit'i atıp push'lar.

### 🔴 …ama `ignoreCommand` YETMEDİ — kota yine bitti (aynı gün 19:00)

**Belirti:** `npm run deploy` çalışıyor, push başarılı, **Vercel'de hiçbir kayıt yok** —
"Canceled" bile değil. Hata yok, e-posta yok, site güncellenmiyor.

**Kök:** Hobby kotası **kayan 24 saatte 100 DEPLOYMENT** ve **`ignoreCommand` ile iptal
edilen "Canceled" deployment'lar da sayılıyor.** `ignoreCommand` build DAKİKASINI
kurtarır, KOTAYI kurtarmaz — deployment zaten oluşturulmuştur. Daemon 24 saatte **266
commit** push'ladı → kota 19:00'da bitti → Vercel `deploy:` commit'leri dahil hiçbir
deployment oluşturmaz oldu.

> 🔍 **Tanı hilesi:** Deployments → Status filtresi varsayılan **6/7**; gizlenen statü
> "Canceled". Onu açmadan tabloya bakarsan `auto:` push'larının iptal edildiğini
> göremezsin ve yanlış yere bakarsın.

**Çözüm — deployment'ın hiç OLUŞTURULMAMASI gerekiyor:**

- [x] `scripts/auto-deploy.sh` → daemon artık `main`'e değil **`HEAD:yedek`**'e push
      ediyor. Yedekleme kaybolmadı, sadece dal değişti; retry `--force-with-lease`.
- [x] `vercel.json` → `git.deploymentEnabled.yedek = false`. ⚠️ Bu şart: Vercel
      varsayılan olarak **her** dala Preview deployment'ı üretir ve **Preview de
      kotadan düşer**.
- [x] `ignoreCommand` ikinci katman olarak duruyor (`deploy.sh` `main`'e push ederken
      yanındaki `auto:` commit'leri de taşır; HEAD `deploy:` olduğu için build 1 kez olur).
- [ ] **Bayram — SIRAYLA:**
      1. Daemon'ı yeniden başlat (çalışan süreç eski scripti tutuyor):
         `launchctl kickstart -k gui/$(id -u)/com.yukegel.autodeploy`
      2. Kota açılınca `npm run deploy` — bekleyen tonaj + telefon düzeltmeleri
         + RPC v2 geçişleri tek deploy'da çıkar. Kota kayan pencere: slotlar
         saat başı azar azar boşalıyor, sabit saatte sıfırlanmıyor.
      3. Deploy sonrası Vercel → Deployments'ta **Status 7/7** ile bak: `yedek`
         dalı için **hiçbir satır** (Canceled dahil) çıkmamalı. Çıkıyorsa
         `deploymentEnabled` uygulanmamıştır.

## ✅ Tonaj: sadece 1. durak gösteriliyordu — TOPLAM'a çevrildi (29 Tem 2026)

**Belirti:** Ana ekranda ilan özeti çok duraklı bir ilanda tek durağın tonajını
gösteriyordu. Mersin 8t + Adana 12t + Hatay 5t olan ilan listede **"⚖ 8 ton"**.

**Kök:** Kart `ilan.duraklar[0]?.ton` okuyordu. Sorgu durakların HEPSİNİ çekiyordu —
kırpma tamamen görüntüleme katmanındaydı, bu yüzden hiçbir hata/uyarı üretmiyordu.
Yükün %68'i ekranda yokken ekran "çalışıyor" görünüyordu. Nakliyeci aracını 8 tona
göre seçip ilana giriyor, gerçek yükü orada öğreniyordu.

**Düzeltme** — toplam tek yerde: `lib/ilan-liste.ts → durakToplami(duraklar, alanlar[])`
(`numeric` alanları `Number()`'la topluyor — PostgREST `"8.50"` STRING döndürebiliyor;
ondalık artığı 2 haneye yuvarlıyor; hiç değer yoksa `0` değil `null`).

- [x] `app/_components/HomeClient.tsx` — ton + palet toplamı; >1 durakta çipe `(3 durak)` eki
- [x] `app/panel/IlanYonetim.tsx` — aynı kopyala-yapıştır hata, aynı düzeltme
- [x] `app/ilan/[id]/page.tsx` — meta `description` ilk dolu durağı yazıyordu; **Google'a
      da eksik tonaj gidiyordu**, artık toplam
- [x] `app/moderator/page.tsx` — kalite skoru `stops[0].weight_ton` bakıyordu; ilk durakta
      tonaj yoksa ilan 5 puanı boş yere kaybediyordu → `stops.some(...)`
- [x] `durakToplami` birim testi: çok durak / string numeric / ondalık artık / boş / 0 / çöp
- [x] `tsc --noEmit` temiz
- [ ] **Bayram:** deploy sonrası ana sayfada çok duraklı bir ilanı gözle doğrula

> **Doğru olan ve DEĞİŞMEYEN:** `/ilan/[id]` durak kartları ve `/u/[username]` durakları
> tek tek listeliyor — orada her satır kendi tonajını gösterir, toplam yanlış olurdu.

## ✅ Giriş sonrası ana sayfaya düşme — gelinen sayfaya dönülüyor (29 Tem 2026)

**Belirti:** Hangi sayfadan giriş yapılırsa yapılsın giriş sonrası **ana sayfa** açılıyordu.
En can yakan hâli: kullanıcı ilanlarını `/u/<id>` bağlantısıyla paylaşıyor, gelen kişi
"Giriş Yap"a basıyor ve o listeyi bir daha bulamıyor — paylaşılan bağlantı boşa gidiyor.

**Kök 1 — kapsam:** `guvenliRedirect` + `yk_redirect` cookie zinciri (A7) doğru çalışıyordu
ama hedefi YALNIZCA `proxy.girisYonlendir()` kuruyordu, o da sadece 5 `KORUNMALI` rota için
(`/panel`, `/ilan-ver`, `/araclarim`, `/profil`, `/moderator`). Diğer ~10 giriş bağlantısı
(header, footer, "Üye Ol", `/hakkimizda`, `/nasil-calisir`, `panel/page.tsx`, `araclarim`,
`profil-tamamla`) ÇIPLAK `/giris` idi. Hata üretmiyor, sadece yanlış yere gidiyordu.

**Kök 2 — sinsi olan:** `/auth/callback` hedefi **yalnız cookie'den** okur, query param'a
hiç bakmaz. Bağlantılara `?redirect=` eklense bile proxy'ye uğramadan gelen kullanıcıda
cookie boş kalıyordu → **telefon/e-posta ile girenler doğru yere, Google ile girenler ana
sayfaya** düşüyordu. Aynı sayfa, iki farklı davranış, sıfır hata sinyali.

**Düzeltme** — hedef tek yerden kuruluyor: `lib/redirect.ts → girisAdresi(yol, mod?)`
(`encodeURIComponent` + `guvenliRedirect` içeride; `/giris`in kendisi hedefse hiç eklenmez).

- [x] `lib/redirect.ts` — yeni `girisAdresi()`
- [x] `app/_components/GirisLink.tsx` — yeni; bulunduğu sayfayı `usePathname()` ile kendisi
      ekler (`useSearchParams()` DEĞİL: Suspense sınırı zorlar, statik render'ı bozar)
- [x] `app/giris/page.tsx` — `?redirect=`'i cookie'ye de yazıyor → Google/e-posta zinciri
- [x] `Footer.tsx` (her sayfada), `HomeClient.tsx` (banner + nav), `hakkimizda`,
      `nasil-calisir`, `u/[username]`, `panel`, `araclarim`, `profil-tamamla`
- [x] 🚨 **Yan bulgu — açık yönlendirme kapatıldı:** `profil-tamamla` "profil zaten tam"
      dalı `redirect`'i HAM kullanıyordu (`?redirect=https://kotu.site` çalışıyordu).
      Aynı dosyanın başka bir dalı zaten `guvenliRedirect`'ten geçiriyordu — bu dal atlanmış.
- [x] `girisAdresi` testi 17/17 (mutlak URL, `//`, `/\`, CR/LF, null, `/giris` döngüsü)
- [x] `tsc --noEmit` temiz
- [ ] **Bayram:** deploy sonrası `/u/<id>` sayfasından "Ara" → giriş → **aynı sayfaya**
      döndüğünü doğrula; ayrıca **Google ile girişte de** döndüğünü ayrıca dene

## ⚠️ BUGLAR
- [x] **A10 — "Hesabınız birleştirildi" sonsuz giriş döngüsü** ✅ (29 Tem 2026)
  Belirti: giriş yapılıyor → "Hesabınız başka bir hesabınızla birleştirildi… tekrar giriş
  yapın" → tekrar giriş → aynı mesaj. **Hiç giriş yapılamıyor.**
  Sebep: emekli (`merged_into` dolu) auth kimliğiyle girildiğinde `proxy.ts` sb- cookie'lerini
  silip `/giris?hesap=tasindi`'ye atıyordu. Kullanıcı aynı kimlikle geri geldiği için yine
  aynı satıra düşüyordu — kodda döngüden çıkış yolu yoktu. `/api/auth/switch-account`
  magic-link'in `action_link`'ini (implicit flow) döndürdüğü için SSR cookie'si hiç
  güncellenmiyor, döngü kapanmıyordu.
  Çözüm: yeni `app/auth/devir/route.ts` — oturumu **sunucuda** canlı hesaba devreder:
  `merged_into` zinciri (maks 5 adım, döngü koruması) → `admin.generateLink` →
  **`hashed_token`** → cookie yazan `createServerClient` üzerinde `verifyOtp` → canlı
  hesabın cookie'leri yazılır → hedefe (`?redirect` / `yk_redirect` / `/panel`) yönlendirir.
  Kurtarılamayan hâllerde (hedef silinmiş, e-posta yok, zincir döngüsü) cookie'leri temizleyip
  `/giris?hesap=tasindi`'ye düşer. `proxy.ts`'teki `merged_into` dalı artık cookie SİLMEZ.
  Yetki: hedef hesap istekten ALINMAZ, yalnız oturumun kendi `merged_into` zincirinden okunur.
- [x] **A9 — SMS girişinde kod girilmeden /admin'e düşme** ✅ (29 Tem 2026) — **güvenlik açığı DEĞİL**
  Belirti: `/giris`'te telefon yazıp SMS iste → kod girilmeden `/admin` açılıyor.
  Sebep: kullanıcının ZATEN geçerli bir oturumu vardı. Sayfa açılışındaki "oturum sağlık
  kontrolü" (INITIAL_SESSION) o oturumu görüp `yonlendir()` çağırıyor. A8 deadlock'u
  yüzünden bu kontrol ~5 sn gecikiyordu (kilit zorla kurtarılana kadar), o yüzden SMS
  gönderildikten SONRA tetikleniyormuş gibi görünüyordu. Oturum `verifyOtp` olmadan
  ASLA oluşmuyor — `otpGonder` yalnızca `signInWithOtp` çağırır.
  Çözüm: `etkilesimRef` — kullanıcı kendi giriş denemesini başlattıysa açılış kontrolü
  yönlendirme yapmaz. Böylece oturumu açıkken başka hesaba geçmek de mümkün.
- [x] **A8 — Ana sayfa navbar'ı giriş yapmış kullanıcıyı görmüyordu** ✅ (29 Tem 2026)
  Belirti: oturum açıkken `yukegel.com` navbar'ı "Giriş Yap / Üye Ol" gösteriyor, ama
  `/admin` çalışıyordu. Sebep: `onAuthStateChange` callback'i içinde `await supabase.from('users')`
  → Supabase auth kilidi deadlock (`Lock "lock:sb-...-auth-token" was not released within 5000ms`).
  Çözüm: DB işi `setTimeout(0)` ile kilidin dışına alındı; gereksiz `getSession()` kaldırıldı
  (`INITIAL_SESSION` zaten tetikleniyor). Aynı desen `app/giris/page.tsx`'te de düzeltildi.
  Ayrıca navbar'a **Çıkış** (POST formu, C1 uyumlu) eklendi ve 👤 adı `/panel?tab=profil`e bağlandı.
- WhatsApp Import yukegel.com üzerinde çalışmıyor. localhost'ta çalışıyor (production ortamı farkı — muhtemelen Edge Function env var veya Supabase webhook URL sorunu)


## 📱 WhatsApp Import — Analiz & Sertleştirme (28 Tem 2026)

Tam analiz: `docs/WHATSAPP_IMPORT_ANALIZ.md` (bulgu kodları A1–A5, B1–B8, C1–C12).

### Kapatılanlar
- [x] **A1** — `/api/whatsapp-parse` yetkisizdi (service-role ile `raw_posts`'a yazan açık endpoint). `requireStaff()` + kullanıcı bazlı rate limit (10 istek/dk) eklendi. *(Not: `excel-import` bu açığa sahip DEĞİLDİ — ilk taslaktaki iddia hatalıydı.)*
- [x] **A2** — Offset'siz `new Date()` host TZ'ye göre kayıyordu (tarayıcı UTC+3 / Vercel UTC). Parser artık sabit `+03:00` ile çözüyor; test `process.env.TZ` değiştirilerek doğruluyor.
- [x] **A3** — `/` ve `-` ayraçlı tarihler, 2 haneli yıl, 12 saatlik format (ÖÖ/ÖS/AM/PM), U+202F dar boşluk hiç tanınmıyordu → dosyanın tamamı 0 mesajla dönüyordu. Artık destekleniyor; çözülemeyen zaman damgası sayısı `unparsed_timestamps` olarak UI'da gösteriliyor.
- [x] **A4** — Chunk INSERT'te tek `23505` 100 satırın tamamını sessizce düşürüyordu. Satır satır retry + `insert_failed` / `errors[]` raporlama.
- [x] **A5** — Repost eşleşmesi dizi indeksine güveniyordu (A4 düzeltmesiyle kesin kayacaktı). Doğal anahtar (`clean_hash|contact_phone|message_date`) bazlı eşleşmeye çevrildi.
- [x] **B2** — Repost akışı çift ilan üretiyordu (trigger→parse-listing + `repostListings()` kopyalama). `repostListings` kaldırıldı; `parse-listing` `is_repost` bayrağını `raw_posts`'tan taşıyor.
- [x] **C9** — Parser kopyası iki dosyada elle senkron tutuluyordu → `lib/whatsapp/chatParser.ts` tek kaynak.
- [x] **C12** — Parser testi yoktu → `lib/whatsapp/__tests__/chatParser.test.ts`, 29 assertion, `npm run test:parser`.
- [x] **60 sn Vercel timeout** — İçe aktarma kısmen ilerleyip "Task timed out after 60 seconds" ile düşüyordu. Kök nedenler: sınırsız `.in()` dizileri (URL'e gömülüyor), gereksiz 3. sorgu (5c), sınırsız eşzamanlı telefon update'leri, ve satır-satır 23505 retry fırtınası (~100 ek istek/chunk) — bunun sebebi batch-içi dedup anahtarının (`hash__telefon__tarih`) DB'nin gerçek unique indeksiyle (`clean_hash, post_date`) uyuşmamasıydı. Çözüm yöntemi: sunucuda `SURE_BUTCESI_MS = 45_000` bütçesi (dolduğunda HTML değil `{tamamlanmadi, islenmeyen}` JSON döner) + `parcala()`/`sirayla()` ile sorgu parçalama ve eşzamanlılık tavanı + 23505'te tek yeniden sorgu; istemcide sıralı döngü yerine **iş kuyruğu + otomatik ikiye bölme** (`dosyayiBol()` dosyayı mesaj başlığı sınırından ayırır, `MAX_BOLUNME = 8`). Detay: `docs/WHATSAPP_IMPORT_ANALIZ.md` §7.
- [x] **C10 (kısmi)** — `structuredLog` + `duration_ms` telemetrisi eklendi (`whatsapp-import` context). `import_runs` tablosu hâlâ yok.

### Açık kalanlar (öncelik sırasıyla)
- [ ] **⚠️ B2 doğrulama** — `raw_posts` trigger'ının koşulsuz çalıştığı VARSAYILDI. Doğrula: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.raw_posts'::regclass AND NOT tgisinternal;` — `WHEN` içinde `is_repost` filtresi varsa repost satırları hiç ilan üretmez, o koşul kaldırılmalı.
- [x] **`raw_posts` unique kuralları dokümante edildi** (28 Tem 2026) — CONSTRAINT değil INDEX olarak tanımlılar. Bağlayıcı kural `idx_raw_posts_hash_day UNIQUE (clean_hash, post_date) WHERE clean_hash IS NOT NULL`. `upsert`'e geçilemiyor: her iki unique indeks de **kısmi**, PostgreSQL kısmi indeksi `ON CONFLICT` hedefi olarak çıkarsayamıyor.
- [x] **23505 fırtınasının asıl sebebi kapatıldı** — batch-içi dedup anahtarı `hash__tarih`'e çekildi (DB indeksiyle birebir); `existingMap` `post_date` üzerinden kuruluyor; kurtarma bloğu artık `(clean_hash, post_date)` çiftine bakıyor (önceden sadece `clean_hash`'e bakıp başka güne ait meşru repost'ları da eliyordu).
- [x] **Telefon geriye-doldurma ayrıldı** — `POST /api/raw-posts/telefon-doldur`. İçe aktarmanın doğruluğunu etkilemiyordu ama satır başına 2 UPDATE ile bütçeyi yiyordu. Telefon regex'i `lib/whatsapp/telefon.ts`'e alındı.
- [x] **Gatekeeper substring eşleşmesi düzeltildi** (28 Tem 2026) — `norm.includes(alias)` yerine token eşitliği + ek soyma. `"lojistik"→İstanbul`, `"getirin"→TIR`, `"balyası"→Balıkesir` gibi sahte eşleşmeler bitti.
- [ ] **Alias tablosunda KOPYA kayıtlar — ÖLÇÜLDÜ, yüzlerce grup** (28 Tem 2026). İki ayrı zarar: (a) `avcilar` ve `hadimkoy` alias'larında `normalized` çelişiyor — `Istanbul` vs `İstanbul`. Şehir doğru ama yazım tutarsız; `normalized` ilana yazılan değer olduğu için şehir filtresi bunları iki ayrı şehir sayıyor. (b) `district` çelişkisi çok daha yaygın: onlarca grupta kopyaların biri dolu diğeri NULL (`gebze`, `çorlu`, `torbalı`, `alanya`, `çiğli`, `sincan`...), ayrıca yazım farkları (`Avcilar`/`Avcılar`, `Kirkağaç`/`Kırkağaç`, `Kazan`/`Kahramankazan`). `findPlaces` ilk eşleşmeyi aldığı için **ilçe bilgisi sıraya bağlı olarak kayboluyor**. Çözüm: kopya SİLİNMEYECEK — `docs/20260728_alias_homonim_temizligi.sql` ADIM 5 ile her gruptaki tüm satırlara aynı doğru `normalized`+`district` yazılacak (5.1 önizleme → 5.2 UPDATE → 5.3 doğrulama). Sonra ADIM 6: geçmiş `listings` satırlarındaki `Istanbul`/`İstanbul` karışıklığı ölçülüp düzeltilmeli. Kalıcı çözüm: `aliases` üzerine normalize trigger + normalize forma UNIQUE indeks, yoksa kopyalar yeniden oluşur.
- [ ] **SAHTE GÜZERGÂH — `Istanbul` vs `İstanbul`** (28 Tem 2026, YENİ BULGU). `findPlaces` içindeki `seen` kümesi `normalized` DEĞERİYLE tutuluyor. `aliases` tablosunda 13 satır `Istanbul` (Türkçe karakteri düşmüş), 154 satır `İstanbul` yazıyor — bunlar AYRI iki değer. İçinde hem `avcilar` (→`Istanbul`) hem `kadıköy` (→`İstanbul`) geçen mesaj İKİ ŞEHİR bulmuş sayılıp **İstanbul→İstanbul güzergâhı** üretiyor. Aynı sorun `Izmir`/`İzmir`, `Mugla`/`Muğla`, `Bingol`/`Bingöl`'de de var. Düzeltme: `docs/20260728_alias_kopya_temizligi.sql` BÖLÜM 1. Sonrasında geçmiş `listings` için BÖLÜM 6 (`origin_city = destination_city` olanları da say).
- [ ] **`payas` yanlış ile yazılıyor** (28 Tem 2026). `aliases` id=1003 `Payas → Adana` diyor; Payas 2008'den beri **Hatay** ilçesi. Doğru satır (id=1844, Hatay) da var ama `findPlaces` küçük id'yi seçtiği için bugün her "payas" ilanı Adana'ya yazılıyor. Düzeltme: aynı dosya BÖLÜM 4.1.
- [ ] **Belirsiz alias'lar: `gölbaşı`, `kemalpaşa`** (28 Tem 2026). İkisi de iki farklı ile ait gerçek yer adı; tek kelimeyle ayırt edilemiyor. `araç` ile aynı mantıkla baskın olmayanı pasifleştirilmeli. Düzeltme: aynı dosya BÖLÜM 4.5 / 4.6.
- [ ] **Alias homonim temizliği — ölçüldü, tek suçlu `araç`** (28 Tem 2026). 3000 mesajın 580'inde (%19) geçiyor, sıralamada Bursa'nın üstünde; `Kastamonu/Araç` ilçesi ama metinde "vasıta" anlamında. `olur`/`merkez`/`pazar` ilk 40'a girmedi. Kalan: `docs/20260728_alias_homonim_temizligi.sql` ADIM 3 ile `is_active = false`.
- [ ] **Gatekeeper düzeltmesi sonrası ölçüm** — düzeltme öncesi `isAd` fiilen "telefon var mı" idi, yani geçmişte kaydedilen bir kısım `raw_posts` aslında ilan değil. Düzeltilmiş kodla aynı dosya yeniden içe aktarılıp `kaydedilen` sayısındaki düşüş ölçülmeli; büyük düşüş varsa eski kayıtlar için temizlik gerekebilir.
- [x] **1000 satır sessiz kesilmesi kapatıldı** (28 Tem 2026) — `aliases` (1887 aktif satır) hem `whatsapp-parse` gatekeeper'ında hem `parse-listing` edge fonksiyonunda tek sorguyla çekiliyordu; PostgREST 1000'de kesiyordu. İkisi de `.range()` + `.order('id')` ile sayfalandı. ⚠️ `parse-listing` bir Edge Function — ayrıca `supabase functions deploy parse-listing` gerekiyor.
- [ ] **`raw_posts_dedup_idx` gereksiz — düşürülebilir** (düşük öncelik, 28 Tem 2026). `UNIQUE (clean_hash, contact_phone, message_date)`; ama `idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date)` daha katı olduğu için bu indeks hiçbir zaman ek bir kural dayatamaz. Sorgu tarafında da karşılığı yok (`idx_raw_posts_clean_hash` mevcut). Yalnızca INSERT maliyeti ekliyor. `DROP INDEX public.raw_posts_dedup_idx;`
- [x] **`post_date` sadeleştirme TAMAMLANDI** (28 Tem 2026). Unique indeks `message_date`'e taşındı (`idx_raw_posts_hash_msgdate`, valid+unique), kod `post_date` yazmayı bıraktı (commit dd02073), kolon düşürüldü. Teşhis özeti: Adım 0 doğrulaması 0 yerine **1543 ayrışmış satır** döndü. ADIM 0b teşhisi (28 Tem 2026): ayrışan satırların **tamamında** `post_date = created_at::date` ve `post_date > message_date` → `post_date` mesajın gününü değil **içe aktarma gününü** tutuyor, yani anlamsız bir kolon; otorite `message_date`. Ayrışma penceresi **kapalı** (12–20 May 2026), bugünkü kod bu hatayı yapmıyor. Her iki kolonda `column_default = NULL`, sebep bir DEFAULT değil eski bir kod sürümü. `(clean_hash, message_date)` kopya sorgusu **boş döndü** → yeni unique indeks hatasız kurulur. Tablo 59.533 satır / 54 MB → **Seçenek A (CONCURRENTLY'siz) yeterli, uygulanabilir**. — `docs/20260728_raw_posts_post_date_sadelestirme.sql`. SIRA ÖNEMLİ: (1) SQL adım 0–2, (2) koddan `post_date` yazımını kaldır + dağıt, (3) SQL adım 3 ile kolonu düşür. Sırayı bozmak tüm insert'leri kırar.
- [ ] **B5** — Hata alan kayıtlar `processing_status: 'pending'`de asılı kalıyor; `error` durumu + retry yok.
- [ ] **B1** — Sabit hat numaraları (`0212...`, `0332...`) hiç yakalanmıyor; `isAd` telefon şartına bağlı olduğu için bu ilanların tamamı gate'ten geçemiyor.
- [ ] **B3** — Spam sayacı yükleme içindeki tekrarları görmüyor (sadece DB'deki son 1 saate bakıyor).
- [ ] **C5** — Klasör modunda grup adı tek isme çöküyor, dosya bazlı `source_group` kaybediliyor.
- [ ] **C1** — `no_lane` kalan kayıtlar için LLM (Haiku) fallback yok; "LLM parse" adı yanıltıcı, gerçekte regex.
- [ ] **C6** — Bir chunk hata alınca kalan gruplar iptal (`break` → `continue` olmalı).
- [ ] **C7** — `debugLog` sınırsız büyüyor.
- [ ] **C10** — `import_runs` tablosu (kalıcı import telemetrisi).

## 🏠 Landing / Kayıt / Giriş — Analiz (28 Tem 2026)

Tam analiz: `docs/LANDING_AUTH_ANALIZ.md` (bulgu kodları L1–L5, A1–A7, K1–K3). Hiçbiri kod
değişikliği içermiyor — yalnızca statik okuma. Canlı DB/RLS doğrulaması yapılmadı.

> **🏃 SPRINT PLANI: `docs/SPRINT_01.md`** — 30 madde / 78 puan, 5 dalgaya (W0–W4) bölünmüş.
> Her maddede dosya:satır, kabul kriteri, efor ve bağımlılık var. Aşağıdaki liste bulgu
> envanteri; **çalışma sırası için SPRINT_01.md'yi kullan.**
>
> ~~W0 (blocker, 17p): L1 · A2 · **M1** · K1~~ **✅ TAMAMLANDI (28 Tem 2026)**
> ~~W1 (auth bütünlüğü, 21p): **L1e** · A1 · A3 · A4 · A7 · K2 · **R1** · **C1**~~ **✅ TAMAMLANDI (28 Tem 2026)**
> ~~W2 (güvenlik, 15p): **G1** · **G2** · **M2** · **C2** · K2b~~ **✅ TAMAMLANDI (29 Tem 2026)**
> ~~W3 (SEO/huni, 14p): **S1–S4** · L2 · L3~~ **✅ TAMAMLANDI (29 Tem 2026)**
> ~~W4 (cila, 11p): K3 · **R2** · **F1** · **F2** · L4 · L5 · A5 · A6~~ **✅ TAMAMLANDI (29 Tem 2026)**
> **Beş dalganın beşi de bitti — sprint'in kod tarafı kapandı.**

### ✅ W0 — Tamamlandı (28 Tem 2026)
- [x] **L1** — Telefon sızıntısı. `app/page.tsx` ISR'li olduğu için "misafirse gizle" yapılamadı;
      numara payload'dan tamamen çıkarıldı, `/api/ilan/[id]/telefon` üzerinden veriliyor.
- [x] **L1b** — `app/api/ilan/[id]/telefon/route.ts` *(yeni)* — authed + `logPhoneAccess` + 20/dk.
- [x] **L1c** — `/ilan/[id]`: wa.me linki ve `Aksiyonlar` prop'u `user && profilTamamlandi`'ya bağlandı.
- [x] **L1d** — `/ilan/[id]/sahiplen` sahiplenilmemiş **her** ilanın numarasını gösteriyordu.
      Yeni `app/api/ilan/[id]/sahiplen/route.ts`: maskeli görüntü + OTP sunucuda.
- [x] **L1f** — `/u/[username]` de `tel:` href ile numarayı gömüyordu; `araTikla`'ya çevrildi.
- [x] **A2** — Google merge 404'ü. Callback artık `/giris?merge_user_id=…`'ye gidiyor.
- [x] **A2b** — Merge route'unda 3 bug: `if (yeniProfil)` guard'ı profili siliyordu,
      tekil alanlar `users_email_key` ihlali yaratıyordu, `auth_providers`'a `'phone'` hardcode'du.
- [x] **M1** — `proxy.ts` artık segment sınırında eşleştiriyor (`korunmaliMi()`).
- [x] **K1** — KVKK açık rıza checkbox'ı + `users.kvkk_onay_at`.
- [x] **K1b** ✅ `docs/20260728_kvkk_onay.sql` çalıştırıldı (Bayram, 29 Tem 2026).
- [x] **A4b-hane** — `sahiplen` OTP girişi 6 hane bekliyordu, Twilio 4 gönderiyor → akış
      fiilen tamamlanamıyordu. 4'e çekildi.

### ✅ W1 — Tamamlandı (28 Tem 2026)
- [x] **L1e** — `contact_phone`'un son istemci yazma yolu kapatıldı. `app/panel/actions.ts` ve
      `app/moderator/actions.ts` *(yeni)*; `IlanYonetim.tsx`'ten anon istemci tamamen kaldırıldı,
      `moderator/page.tsx`'in select/update/insert'lerinden kolon çıkarıldı.
- [x] **L1e-SQL** ✅ `docs/20260728_contact_phone_revoke.sql` çalıştırıldı + duman testi geçti (Bayram, 29 Tem 2026).
      `anon`/`authenticated` artık `listings.contact_phone` kolonunu **hiç göremiyor** —
      numara yalnız service-role yollarından okunuyor. Sızıntı DB katmanında da kapandı.
      Duman testi ✅ (misafir sayfalar + moderatör telefon düzenle/Onayla).
- [x] **A1** — `app/api/auth/log/route.ts` *(yeni)*. Endpoint aylardır yoktu, 404 `.catch(()=>{})`
      içinde yutuluyordu → auth audit trail'i tamamen boştu.
- [x] **A1b-SQL** ✅ `docs/20260728_auth_events.sql` çalıştırıldı (Bayram, 29 Tem 2026).
      Denetim izi artık gerçekten yazılıyor; G1'in kilit olayları da buradan okunabilir.
- [x] **A3** — `?hesap=tasindi` / `?hesap=eslesme` mesajları artık `!user` dalında da basılıyor.
- [x] **A4** — Twilio kod uzunluğu 4 hane olarak teyit edildi (Bayram, 28 Tem 2026).
- [x] **A7** — `lib/redirect.ts` *(yeni)* `guvenliRedirect()` — açık yönlendirme koruması dahil.
- [x] **K2** — `app/profil-tamamla/actions.ts` *(yeni)* + kolon beyaz listesi. `role`, `is_active`,
      `phone_verified`, `merged_into`, `trust_level` istemciden yazılamıyor.
- [x] **R1** — `/auth/reset` 3 durumlu. **Backlog'da yazandan daha kötüsü çıktı:** normal
      (recovery olmayan) bir oturum açıkken `updateUser({password})` çalışıyordu → açık kalmış
      oturuma erişen kişi eski şifreyi bilmeden şifreyi değiştirebiliyordu.
- [x] **C1** — `/cikis` GET kaldırıldı, POST + Origin kontrolü.
- [x] **A4b** — OTP cooldown **sunucuda** (ilan başına 60 sn, 429 + `Retry-After`).
- [x] **Keşif** — panel'in istemci `listings` update'i gövdeyi filtrelemiyordu; kullanıcı kendi
      ilanına `trust_level: 'verified'` / `moderation_status: 'approved'` yazabiliyordu (K2 ile
      aynı sınıf). Beyaz listeyle kapandı.

### ✅ W2 — Tamamlandı (29 Tem 2026)
- [x] **A10** — `merged_into` giriş döngüsü. `app/auth/devir/route.ts` *(yeni)* oturumu
      **sunucuda** canlı hesaba devrediyor (`generateLink` → `hashed_token` → `verifyOtp`).
      Token tarayıcıya hiç gelmiyor. Proxy artık cookie SİLMİYOR — devir onları okumak zorunda.
      Zincir (A→B→C) `MAKS_ADIM=5` + döngü tespitiyle taranıyor; kurtarılamayan hâllerde
      `/giris?hesap=tasindi`'ye temiz çıkış.
- [x] **M2** — `app/moderator-giris/page.tsx` giriş sonrası rol doğruluyor; yetkisizse
      oturum kapatılıp açıklayıcı mesaj gösteriliyor. Admin `/admin`'e, moderatör `/moderator`'a.
- [x] **C2** — Zaten C1 ile gelmişti (`app/cikis/route.ts` `sb-` cookie'lerini açıkça siliyor);
      doğrulandı, ek değişiklik gerekmedi.
- [x] **K2b** — `lib/kimlik.ts` *(yeni)* `tcknGecerli`/`vknGecerli` TEK KAYNAK. İstemci ve
      sunucudaki iki kopya kaldırıldı — ayrışırlarsa istemci "geçerli" derken sunucu reddeder
      (ya da tersi, ki tehlikeli olan o).
- [x] **G2** — SMS gönderimi istemciden alındı. `app/api/auth/otp/route.ts` *(yeni)*: POST +
      Origin, 3 katmanlı kota (numara 1/60sn, IP 5 farklı numara/saat, IP 15 toplam/saat).
      `sahiplen` endpoint'i **aynı** IP kovasını paylaşıyor — iki uç nokta arasında gidip gelerek
      kotayı ikiye katlamak mümkün değil. Kotalar yalnız SMS gerçekten gittiyse işleniyor.
- [x] **G1** — Şifreli giriş istemciden alındı. `app/api/auth/giris/route.ts` *(yeni)*: POST +
      Origin, e-posta başına 5 hata/15 dk, IP başına 20 hata/15 dk. Yalnız **başarısız** denemeler
      sayılır; başarıda `kotaSifirla`. Kilitliyken gelen istek sayacı UZATMAZ. Oturum cookie'si
      sunucuda yazılıyor; `/giris` ve `/moderator-giris` ikisi de bu route'u kullanıyor.
- [x] **Altyapı** — `lib/kota.ts` *(yeni)* ortak kayan pencere sayacı. ⚠️ Process belleğinde:
      çok instance'ta delinir, soğuk başlangıçta sıfırlanır. Redis'e taşıma yolu dosya başında.

### ✅ W3 — Tamamlandı (29 Tem 2026)
- [x] **S1** — `app/layout.tsx`: `metadataBase`, `alternates.canonical`, OpenGraph (`tr_TR`),
      Twitter `summary_large_image`. Kart görseli `app/opengraph-image.jpg` *(yeni,
      Bayram'ın tasarımı)* + `opengraph-image.alt.txt`; 1200×630'a indirilip JPEG q95 /
      134 KB'a sıkıştırıldı (PNG 650 KB ediyordu, WhatsApp büyük dosyada kartı sessizce
      göstermiyor). Geçici `next/og` üreteci silindi — aynı segmentte iki og dosyası olamaz.
      ⚠️ Karttaki "519 aktif ilan" ve "BETA" donmuş metin, elle yenilenmeli.
      🚨 `metadataBase` olmadan Next göreli OG/canonical URL'lerini SESSİZCE üretmez.
      ⏳ Deploy sonrası: WhatsApp'a link atıp kart görünüyor mu bak. `NEXT_PUBLIC_SITE_URL`
      Vercel'de tanımlı mı teyit et (tanımsızsa fallback `yukegel.com`).
- [x] **S2** — `app/giris/layout.tsx`, `app/moderator-giris/layout.tsx`,
      `app/profil-tamamla/layout.tsx`, `app/auth/layout.tsx` *(hepsi yeni)*.
      🚨 `'use client'` sayfası `metadata` export edemez — Next hata vermeden yok sayar.
      `/auth` için sayfa başına değil **segment** layout'u seçildi; yeni `/auth/*` rotaları
      otomatik miras alsın diye (S4'teki "listeler ayrışır" hatasını tekrarlamamak için).
- [x] **S3** — `app/sitemap.ts`: `/yol-rehberi` + profil sayfaları eklendi.
      🚨 `/u/[username]` klasör adı yanıltıcı — param **kullanıcı id'si**. Profil URL'leri
      ayrı `users` sorgusu atmadan, zaten çekilmiş aktif ilan listesinden türetiliyor
      (ilanı olmayan boş profiller "thin content" olarak sitemap'e girmiyor).
- [x] **S4** — `public/robots.txt` dört blok (`*`, GoogleBot, GPTBot, ClaudeBot), disallow
      listeleri birebir aynı. 🚨 İsimli blok `*` bloğunun YERİNE GEÇER, birleşmez — eski
      halde `*` bloğu `Allow: /` dediği için `/panel/`, `/admin/`, `/api/` genel taramaya açıktı.
- [x] **L2** — `lib/analiz.ts` *(yeni, `olayGonder`)* + `/ilan-ver` artık `?tip=` okuyor.
      🚨 HomeClient zaten `?tip=arac` linki veriyordu ama sayfa param'ı hiç okumuyordu —
      link etkisizdi. 🚨 İkinci hata: misafir yönlendirmesi `?tip=`'i kaybediyordu.
- [x] **L3** — Misafirin `🔐 Ara` butonu `/giris?redirect=/ilan/{id}`'e gidiyor + GA olayı.
      🚨 Ticket'ın öncülü yanlıştı: arama sonuçları misafire zaten açıktı (filtre istemcide).
      Gerçek kusur, giriş sonrası kullanıcının baktığı ilana dönememesiydi.
- **Doğrulama:** `tsc --noEmit` temiz; yeni dosyalarda eslint bulgusu yok.
  `next build` bu ortamda çalışmıyor → OG kartı ve robots çıktısı canlıda göz kontrolü ister.

### ✅ W4 — Tamamlandı (29 Tem 2026)
- [x] **K3** — `profil-tamamla/page.tsx`: `ALAN_GORUNUR` haritası + `tipDegistir()`. Yalnız
      yeni tipte GÖRÜNMEYEN alanlar temizlenir; ad/telefon/KVKK asla sıfırlanmaz.
      🚨 Görünmeyen alan temizlenmezse `actions.ts` onu YİNE DE yazıyor (`company_name`
      user_type'tan bağımsız) — ekranda olmayan veri sessizce kaydediliyordu.
      🚨 **İnceleme bulgusu (düzeltildi):** tip butonu, açık TCKN/VKN alanını önce blur ediyor
      (mousedown → blur → click); uçan tekillik isteği dönüşte temizlenmiş state'in üstüne
      yazıyor ve "Kaydet" **kalıcı pasif** kalıyordu — üstelik uyarı da görünmüyordu (blok
      yeni tipte gizli). Çözüm: `tipEpoch` ref guard'ı.
- [x] **R2** — `lib/sifre.ts` *(yeni)*: gösterge ile kapı tek kaynaktan besleniyor.
      🚨 `[A-Z]` Türkçe'de YANLIŞ — "Şifre123" reddediliyordu; `\p{Lu}` + `/u` kullanıldı.
      ⚠️ `epostaGiris` bilerek kapıya bağlanmadı (eski zayıf parolalılar kilitlenmesin).
      ⚠️ İstemci doğrulaması güvenlik değil; asıl kural Supabase Dashboard'da (Bayram listesi).
- [x] **F1** — Footer "Kayıt Ol" → `/giris?mod=kayit`; `giris/page.tsx` **hem `mod` hem
      `sekme`**'yi kuruyor (render koşulu ikisini birden istiyor, tek başına `mod` no-op).
      🚨 **İnceleme bulgusu (düzeltildi):** sekme butonları koşulsuz `setMod('giris')` yapıyordu,
      aktif sekmeye tekrar tıklamak kullanıcıyı kayıt formundan atıyordu.
- [x] **F2** — `Footer.tsx` 8 link `next/link`'e çevrildi; dosya artık **sıfır eslint bulgusu**
      (mevcut `Türkiye'nin` unescaped-entity hatası da düzeltildi).
- [x] **L4** — `lib/ilan-liste.ts` *(yeni, `ILAN_LIMITI`)*. İki kusur birden: SSR 200 / istemci
      30 ayrışması ("yenile"ye basınca liste kısalıyordu) **ve** sayacın platform toplamını
      yazması. 🚨 **İnceleme bulgusu (düzeltildi):** ilk sürüm filtre açıkken "en yeni" ön ekini
      düşürüyordu — oysa filtre 200'lük pencerenin İÇİNDE, istemcide çalışıyor.
- [x] **L5** — Sekme URL'e yansıyor: `pushState` + **`popstate`** (tek başına pushState bozuk).
      Varsayılan için param silinir. 🚨 **İnceleme bulgusu (düzeltildi):** `?tip=abc` sessizce
      varsayılana düşüyor ama adres çubuğunda kalıyordu → `replaceState` ile temizleniyor.
      ⚠️ `useSearchParams` kullanılamaz: ISR sayfasını CSR bailout'a sokar.
- [x] **A5** — `/api/auth/giris` 401 gövdesine makine okunur `kod` eklendi; istemci
      "doğrulanmamış e-posta"yı kırmızı hata yerine `dogrulama_bekle` ekranına yönlendiriyor.
      🚨 Türkçe metne göre dallanma kırılgan. ⚠️ Hesap sayımı zayıflamadı (GoTrue şifreyi
      `Email not confirmed` kontrolünden ÖNCE doğruluyor).
- [x] **A6** — `app/api/auth/dogrulama-tekrar/route.ts` *(yeni)*: Origin + 3 kota (adres 1/60sn,
      IP 5 farklı adres/saat, IP 10 toplam/saat) + `resend()`. İstemcide geri sayımlı buton.
      🚨 `emailRedirectTo` verilmezse link `/auth/callback`'i atlar → "girdim ama giremiyorum".
      ⚠️ Yanıt daima aynı (hesap sayımı). 🚨 **İnceleme bulgusu (düzeltildi):** yorum "sayaç
      yalnız başarıda işlenir" diyordu, kod her durumda işliyor — **kod doğru, yorum yanlıştı**.
- **Doğrulama:** `tsc --noEmit` temiz. Eslint bulgu sayısı HEAD ile karşılaştırıldı:
  `HomeClient` 21→21, `giris` 7→7, `profil-tamamla` 9→8; yeni dosyaların hiç bulgusu yok.
  Tek bilinçli susturma: L5 mount effect'indeki `set-state-in-effect` (alternatifi hidrasyon
  uyuşmazlığı). `next build` bu ortamda çalışmıyor → sekme/URL ve doğrulama e-postası
  canlıda göz kontrolü ister.

### 🟠 Diğer yeni bulgular
- [ ] **`/ilan/[id]` kendi canonical'ını vermiyor** — Next canonical'ı alt sayfalara miras
      bırakmaz. Dinamik OG görseli de yok (kök karta düşüyor). *(S1'den çıkan yeni iş)*
- [ ] **`/panel` ve `/araclarim`'da `noindex` yok** — robots.txt disallow'u var ve içerik auth
      arkasında, o yüzden düşük öncelik. *(S2'den çıkan yeni iş)*
- [ ] **Şifre kuralı Supabase tarafında zorunlu değil** — `lib/sifre.ts` yalnız istemci UX'i.
      Dashboard → Authentication → Policies → Password Requirements ayarlanmalı. *(R2'den)*
- [ ] **`lib/kota.ts` sayaçları process belleğinde** — Vercel'de çok instance olunca gerçek
      limit instance sayısı kadar gevşer. Artık **dört** route buna dayanıyor (`otp`, `giris`,
      `dogrulama-tekrar`, `sahiplen`). Redis/Upstash kararı verilmeli. *(A6 ile ağırlaştı)*
- [ ] **`profil-tamamla`'daki diğer `onBlur` alanları** (telefon) aynı epoch guard'ına sahip
      değil — telefon alanı tipe bağlı gizlenmediği için şu an zararsız, ama alan görünürlüğü
      değişirse aynı yarış geri gelir. *(K3'ten çıkan yeni iş)*
- [x] ~~**Geçmişte üretilmiş sahte güzergâhlı `listings` satırlarının kaderi**~~ —
      **ÖLÇÜMLE KAPANDI** (29 Tem 2026). Runbook Adım 0.1 çalıştırıldı: **0 satır / 0 ilan**.
      Yani katlanmış anahtarı eşit ama ham yazımı farklı (= sahte güzergâh parmak izi) hiç
      satır yok; silinecek/moderasyona düşürülecek bir küme yok. D4'ün değeri **önleme**,
      geriye dönük onarım değil. Kalan 6.173 "aynı şehir" satırı meşru şehir içi taşıma —
      dokunulmayacak. Asıl hasar başka yerde çıktı: **~88 satırda yazım çeşitliliği**
      (~12 ASCII bozulması + ~76 tamamı büyük harf), onarımı runbook Adım 8. *(W5/D5)*
- [ ] **`listings.destination_city` ölü kolon — düşürülmeli** (29 Tem 2026, W5). Uygulama
      kodunda tek bir yazma/okuma yok; varış verisi `listing_stops` satırlarında
      (`supabase/functions/parse-listing/index.ts:825` yazıyor, `HomeClient.tsx:696` okuyor).
      Eski `20260728_alias_kopya_temizligi.sql` BÖLÜM 6 bu ölü kolonu onarmaya çalışıp asıl
      canlı kolonu (`listing_stops.city`) atlıyor — runbook Adım 8 bunu düzeltti. Önce
      `SELECT count(*) WHERE destination_city IS NOT NULL` ile boş olduğu teyit edilsin,
      sonra `ALTER TABLE public.listings DROP COLUMN destination_city;`
      ⏳ Sayım hâlâ alınmadı — 29 Tem'de yanlış tablo sorgulandı (`listing_stops`, 244.379 =
      toplam durak satırı). Doğrusu: `SELECT count(*) FROM public.listings WHERE destination_city IS NOT NULL;`
- [ ] 🆕 **Varış filtresi büyük/küçük harfe duyarlı — katlanmalı** (29 Tem 2026, W5 Adım 0).
      `app/_components/HomeClient.tsx:696` `d.sehir?.includes(varis)` iki tarafı da katlamıyor;
      DB'de tamamı büyük harf yazılmış **~76 durak satırı** ("ÇORLU" 42, "KEMALPAŞA" 17,
      "ÇERKEZKÖY" 6 …) aramada **hiç görünmüyor**. Adım 8 mevcut satırları onaracak ama kod
      tarafı korumasız kalıyor: yeni bir yazım varyantı girdiği an aynı bug geri gelir.
      Çözüm: karşılaştırmayı `lib/alias-normalize.ts` katlama fonksiyonundan geçir
      (kalkış filtresi ve `get_nearby_listings_by_city` de gözden geçirilsin).
- [ ] **`is_active` / `is_approved` desenkronu** — `learn-aliases` `is_approved=false` öneri
      üretiyor ama eşleşme tarafı (`findPlaces`, `whatsapp-parse` gatekeeper) yalnız
      `is_active`'e bakıyor; onaylanmamış alias parse'a giriyor. W0-W4'ten devreden bilinen
      tuzak, W5'te **bilinçli olarak değiştirilmedi** (davranış değişikliği ayrı bilet olmalı).
      Kod içinde belgelendi: `app/api/admin/learn-aliases/route.ts` başı. *(W5/D2)*
- [ ] **`findPlaces` şehir bazında tekilleştiriyor → tek satırda aynı şehrin iki ilçesi lane
      üretmiyor.** `parse-listing` fallback'indeki `sameCity + diffDist` dalı tek satır için
      **ulaşılamaz** (Pass 2/3'te canlı). Temiz veride zaten böyleydi; eski kodda lane üretmesi
      yalnız `Istanbul`/`İstanbul` bozulmasının yan etkisiydi. Şehiriçi güzergâh desteklenecekse
      ayrı bilet — `seen` anahtarını şehir+ilçeye çevirmek kapsam kaçağı olur. *(W5/D4)*

> ⚠️ Aşağıdaki "Kritik / Yüksek / Orta / Düşük" blokları **28 Tem 2026'daki ilk analizin
> bulgu envanteridir** — açıklamaları o günkü kodu tarif eder, W0/W1 sonrası kod değişti.
> Güncel durum yukarıdaki W0/W1 listelerinde ve `docs/SPRINT_01.md`'de. Envanteri silmiyoruz
> çünkü "neden böyle yapmışız" sorusunun cevabı burada.

### 🔴 Kritik
- [x] **L1** ✅ (W0) — Misafire kapalı olması gereken `contact_phone` değerleri RSC payload'ında açıkta.
      `app/page.tsx:92` numarayı map'leyip client component'e prop geçiyor → Next.js flight
      payload'ı HTML'e gömüyor → `curl | grep` ile tüm numaralar okunabiliyor. `UyeBanner`'ın
      "telefonu görmek için üye ol" vaadi geçersiz + KVKK ihlali (numaraların bir kısmı hiç
      kayıt olmamış WhatsApp/Excel kaynaklı kişilere ait). `HomeClient.tsx:444` client sorgusu
      da anon key ile `contact_phone` seçiyor — ikinci kanal.
- [x] **A1** ✅ (W1) — `app/api/auth/log/route.ts` **YOK**. `giris/page.tsx:13` ve
      `profil-tamamla/page.tsx:8` bu endpoint'e POST atıyor, `.catch(()=>{})` 404'ü yutuyor.
      `login_success` / `login_failed` / `otp_failed` / `kayit_tamamlandi` olaylarının hiçbiri
      kaydedilmiyor → auth audit trail'i tamamen boş. (Route yazılırken `user_id` body'den
      DEĞİL sunucudaki oturumdan alınmalı.)
- [x] **A2** ✅ (W0) — `app/giris/merge/page.tsx` **YOK**, ama `auth/callback/route.ts` Google akışında
      aynı e-postayla eski profil bulunca `${origin}/giris/merge?...`'e yönlendiriyor → **404**.
      `users_email_key` senaryosunun telefon ayağı çözülmüş (`merge_onay` modu), Google ayağı
      var olmayan sayfaya bağlanmış. Çözüm: callback'i `/giris?merge_user_id=...`'e çevirip
      mevcut `merge_onay` UI'ını kullan (`merge_user_id` sunucuda doğrulanmalı).
- [x] **K1** ✅ (W0) — Kayıt akışında KVKK aydınlatma / açık rıza / kullanım koşulları onayı **hiç yok**
      (`giris/page.tsx` kayıt formu ve `profil-tamamla` — `grep kvkk` sonuçsuz). `/kvkk` ve
      `/kullanim-kosullari` sayfaları var ama akışa bağlı değil. TCKN/VKN toplanırken savunulamaz.
      `terms_accepted_at` / `kvkk_accepted_at` kolonları da eklenmeli (ispat yükü platformda).

### 🟠 Yüksek
- [x] **K2** ✅ (W1) — `profil-tamamla/page.tsx:223` client'tan doğrudan `users.upsert()`. Güvenlik
      tamamen RLS'in kolon kapsamına bağlı; kolon kısıtlaması yoksa kullanıcı `role`,
      `is_active`, `ai_listing_quota_daily` gönderebilir. Ayrıca `phone_verified` değerini
      client state'i (`telefonKilitli`) belirliyor. **Önce doğrula:**
      `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='users';`
- [x] **A3** ✅ (W1) — `proxy.ts:94/128` `?hesap=tasindi` / `?hesap=eslesme` ile yönlendiriyor ama
      `giris/page.tsx` bu parametreyi hiç okumuyor. `tasindi` dalında proxy cookie'leri sildiği
      için `INITIAL_SESSION` handler'ı da `if (!user) return` ile çıkıyor → `setBilgi` çalışmıyor.
      Kullanıcı hiçbir açıklama görmeden giriş ekranına düşüyor.
- [ ] **K3** — `profil-tamamla/page.tsx:133` `useEffect([userType])` temizleme bloğu, init
      effect'inin DB'den prefill ettiği `tckn`/`vkn`/`company_name` değerlerini kullanıcı tip
      seçtiği anda siliyor. Çözüm: temizlemeyi `handleTipSec()` içine al, effect'i kaldır.
- [ ] **L2** — `/ilan-ver` `KORUNMALI` (`proxy.ts:19`), ama landing'deki üç ana CTA oraya
      gidiyor ve yanındaki metin "saniyeler içinde... Ücretsiz" diyor. Yük sahibi hunisi burada
      sızıyor. `shadow_profiles` altyapısı zaten hazır → misafire açıp yayınlama anında OTP iste.
- [ ] **A4** — OTP `giris/page.tsx:430`'da **4 haneye** sabit (`substring(0,4)`, `maxLength={4}`).
      Twilio Verify varsayılanı **6 hane**. Servis 4'e çekilmediyse giriş fiilen imkânsız.
      Twilio Console → Verify → Service → Code Length ile doğrula.

### 🟡 Orta / 🟢 Düşük
- [ ] **L3** — `totalCount` (tüm aktif ilanlar) ile listelenen set (SSR 200, client refetch 30,
      üstüne client-side `tip` filtresi) tutarsız. Sayaç 1.500 derken listede 60 kart olabiliyor;
      kalkış/varış filtresi yalnızca yüklenmiş 200 kayıtta arıyor → yanlış "bulunamadı".
- [ ] **A5** — Kayıt formu "En az 8 karakter, sayı ve büyük harf içermeli" diyor ama
      `epostaKayit` yalnızca `length >= 8` kontrol ediyor (`giris/page.tsx:258` vs 497).
- [ ] **A6** — OTP gönderiminde cooldown / "tekrar gönder" sayacı yok → Twilio maliyeti + abuse.
- [ ] **L4** — `HomeClient.tsx:570` misafir hero'su `authHazir` beklemiyor → girişli kullanıcı
      ilk paint'te "Giriş Yap / Üye Ol" görüyor. Auth'u sunucuda çözüp prop geçmek doğru çözüm.
- [ ] **A7** — `bilgi` state'i yalnızca `sekme==='telefon' && !otpAdim` bloğunda render ediliyor
      (satır 418) → e-posta sekmesinde ve OTP adımında görünmez. A3 ile birlikte düzelt.
- [ ] **L5** — Filtre sekme sırası `['arac','yuk']` ama varsayılan state `'yuk'` (kozmetik).

### 🔴 WhatsApp alias eşleştirme (28 Tem 2026)
- [x] **NOKTALI ALIAS'LAR ÖLÜYDU** — `tokenKumeleri` mesajı `[\s.>-]+` ile bölüyordu ama
      alias tarafı bölünmüyordu; içinde nokta geçen 14 alias hiçbir zaman eşleşemedi:
      `G.Antep`, `K.Maraş`, `M.Kemalpaşa`, `İst.Avr`, `İst.And`, `İst.Anadolu`, `k.paşa`,
      `13.60` (TIR) — yani ilanlarda en sık kullanılan kısaltmalar. İkinci katman: tek
      harflik token'lar (`g`, `m`, `k`) tekil kümeden atılırken ikili kümeden de düşüyordu,
      bu yüzden `g antep` ikilisi hiç oluşmuyordu. İkisi de düzeltildi (`aliasAnahtari` +
      `tokenlar` filtresinin sadece tekil kümeye uygulanması).
- [ ] **UZUN EŞLEŞME KISAYI BASTIRMALI** — `*BURSA M.KEMALPAŞA YÜKLER*` mesajı artık
      `Bursa←M.Kemalpaşa` buluyor ama `İzmir←Kemalpaşa` ve `Artvin←kemalpaşa` da hâlâ
      ekleniyor. Artvin'i BÖLÜM 4.6 kapatıyor; İzmir için token aralığı bazlı bastırma
      gerekli (uzun alias bir token'ı tükettiyse o token'a dayanan kısa alias sayılmasın).
- [x] **60sn TIMEOUT — bütçe kontrolü yanlış yerdeydi** (29 Tem 2026)
      `SURE_BUTCESI_MS` kontrolü SADECE 8. adımdaki insert döngüsündeydi. Ondan önceki
      aşamalar (dosya okuma, alias çekme, gatekeeper, hash hesaplama, 5a/5b toplu
      sorguları) sınırsızdı; büyük dosyada bunlar tek başına 60sn'i yiyor, Vercel
      fonksiyonu öldürüyor ve JSON yerine HTML dönüyordu. Aşama sınırlarına
      `butceKalanMs()` kapıları eklendi → artık düzgün JSON + `tamamlanmadi: true`.
      Not: `aborted` / `duration_ms: 3` kaydı ayrı bir çağrı — istemci bağlantıyı
      kesince `request.formData()` patlıyor, kendi başına bir bug değil.
- [ ] **Timeout'un KÖK SEBEBİ ölçülmeli** — noktalı alias düzeltmesi kapıyı genişletti
      (`İst.Avr`, `G.Antep` vb. artık eşleşiyor) → `passed_gate` arttı → 5a/5b sorguları
      büyüdü. Bir sonraki içe aktarmada `passed_gate` sayısını öncekiyle karşılaştır.
- [ ] **`merkez` şüphesi ÇÜRÜDÜ** — `Balıkesir/Elazığ/Sivas/Ağrı` kümesi `merkez`den
      gelmiyor; tabloda öyle bir alias yok. Gerçek alias tablosuyla yerel çalıştırmada
      `KONYA KARATAY YÜKLER TEKİRDAĞ MERKEZ` sadece `Konya,Tekirdağ` üretiyor. Fazlalık
      şehirler mesajın 60 karakterlik önizlemede GÖRÜNMEYEN kısmından geliyor olmalı;
      `cityHits` + 220 karakterlik önizleme dağıtılınca doğrulanacak.

---

## ✅ Düzeltilen Buglar
- [x] **(6 Tem 2026)** Moderatör panelinde çoklu WhatsApp dosyası yüklerken `Unexpected token 'A', "An error o"... is not valid JSON` hatası — sebep: `/api/whatsapp-parse` route'unda `maxDuration` tanımlı değildi, büyük/çoklu dosya gruplarında Vercel'in default timeout'u aşılınca platform kendi HTML/düz-metin hata sayfasını ("An error occurred with your deployment...") dönüyordu; frontend (`WhatsappYukle.tsx`) bunu koşulsuz `res.json()` ile parse etmeye çalışınca patlıyordu. Çözüm: route'a `export const maxDuration = 60` eklendi (learn-aliases route'undaki pattern), frontend `res.json()` öncesi `res.text()` + `JSON.parse` try/catch ile sarmalandı ve 413/504 durumlarına özel Türkçe hata mesajı eklendi.