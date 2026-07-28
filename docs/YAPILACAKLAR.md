# Yükegel — Yapılacaklar Listesi

> Son güncelleme: 28 Temmuz 2026 (WhatsApp Import analizi + sertleştirme)  
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


## ⚠️ BUGLAR
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
- [x] **C10 (kısmi)** — `structuredLog` + `duration_ms` telemetrisi eklendi (`whatsapp-import` context). `import_runs` tablosu hâlâ yok.

### Açık kalanlar (öncelik sırasıyla)
- [ ] **⚠️ B2 doğrulama** — `raw_posts` trigger'ının koşulsuz çalıştığı VARSAYILDI. Doğrula: `SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.raw_posts'::regclass AND NOT tgisinternal;` — `WHEN` içinde `is_repost` filtresi varsa repost satırları hiç ilan üretmez, o koşul kaldırılmalı.
- [ ] **`raw_posts` unique constraint kolonlarını dokümante et** — bilinirse A4'teki satır-satır retry yerine `upsert(..., { onConflict, ignoreDuplicates: true })` kullanılabilir (çok daha az sorgu).
- [ ] **B5** — Hata alan kayıtlar `processing_status: 'pending'`de asılı kalıyor; `error` durumu + retry yok.
- [ ] **B1** — Sabit hat numaraları (`0212...`, `0332...`) hiç yakalanmıyor; `isAd` telefon şartına bağlı olduğu için bu ilanların tamamı gate'ten geçemiyor.
- [ ] **B3** — Spam sayacı yükleme içindeki tekrarları görmüyor (sadece DB'deki son 1 saate bakıyor).
- [ ] **C5** — Klasör modunda grup adı tek isme çöküyor, dosya bazlı `source_group` kaybediliyor.
- [ ] **C1** — `no_lane` kalan kayıtlar için LLM (Haiku) fallback yok; "LLM parse" adı yanıltıcı, gerçekte regex.
- [ ] **C6** — Bir chunk hata alınca kalan gruplar iptal (`break` → `continue` olmalı).
- [ ] **C7** — `debugLog` sınırsız büyüyor.
- [ ] **C10** — `import_runs` tablosu (kalıcı import telemetrisi).

## ✅ Düzeltilen Buglar
- [x] **(6 Tem 2026)** Moderatör panelinde çoklu WhatsApp dosyası yüklerken `Unexpected token 'A', "An error o"... is not valid JSON` hatası — sebep: `/api/whatsapp-parse` route'unda `maxDuration` tanımlı değildi, büyük/çoklu dosya gruplarında Vercel'in default timeout'u aşılınca platform kendi HTML/düz-metin hata sayfasını ("An error occurred with your deployment...") dönüyordu; frontend (`WhatsappYukle.tsx`) bunu koşulsuz `res.json()` ile parse etmeye çalışınca patlıyordu. Çözüm: route'a `export const maxDuration = 60` eklendi (learn-aliases route'undaki pattern), frontend `res.json()` öncesi `res.text()` + `JSON.parse` try/catch ile sarmalandı ve 413/504 durumlarına özel Türkçe hata mesajı eklendi.