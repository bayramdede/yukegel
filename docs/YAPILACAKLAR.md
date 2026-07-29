# Yükegel — Yapılacaklar Listesi

> Son güncelleme: 28 Temmuz 2026 (SPRINT_01 **W0 + W1 tamamlandı** — telefon sızıntısı hem uygulama hem DB katmanında kapatıldı, auth denetim izi açıldı, iki ayrı yetki yükseltme açığı kolon beyaz listesiyle giderildi, `/auth/reset` ve `/cikis` sertleştirildi.)
>
> ⏳ **BAYRAM — 3 SQL, sırası önemli:**
> 1. `docs/20260728_kvkk_onay.sql` — deploy'dan **ÖNCE**
> 2. `docs/20260728_auth_events.sql` — deploy'dan **ÖNCE**
> 3. `docs/20260728_contact_phone_revoke.sql` — deploy'dan **SONRA** (ters sırada panel ve moderatör telefonu yazamaz)
>
> Ayrıca kontrol: `public.users.is_active` kolonunun DB default'u `true` mu? İstemci artık bu alanı göndermiyor.
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


## ⚠️ BUGLAR
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
> **Sıradaki → W2** (güvenlik, 15p): **G1** · **G2** · **M2** · **C2** · K2b
> W3 (SEO/huni, 14p): **S1–S4** · L2 · L3  —  W4 (cila, 11p): K3 · **R2** · **F1** · **F2** · L4 · L5 · A5 · A6

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
- [ ] **K1b** ⏳ **BAYRAM:** `docs/20260728_kvkk_onay.sql` çalıştırılmalı — **deploy'dan önce.**
- [x] **A4b-hane** — `sahiplen` OTP girişi 6 hane bekliyordu, Twilio 4 gönderiyor → akış
      fiilen tamamlanamıyordu. 4'e çekildi.

### ✅ W1 — Tamamlandı (28 Tem 2026)
- [x] **L1e** — `contact_phone`'un son istemci yazma yolu kapatıldı. `app/panel/actions.ts` ve
      `app/moderator/actions.ts` *(yeni)*; `IlanYonetim.tsx`'ten anon istemci tamamen kaldırıldı,
      `moderator/page.tsx`'in select/update/insert'lerinden kolon çıkarıldı.
- [ ] **L1e-SQL** ⏳ **BAYRAM:** `docs/20260728_contact_phone_revoke.sql` — **deploy'dan SONRA.**
- [x] **A1** — `app/api/auth/log/route.ts` *(yeni)*. Endpoint aylardır yoktu, 404 `.catch(()=>{})`
      içinde yutuluyordu → auth audit trail'i tamamen boştu.
- [ ] **A1b-SQL** ⏳ **BAYRAM:** `docs/20260728_auth_events.sql` — **deploy'dan ÖNCE.**
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

### 🟠 Diğer yeni bulgular
- [ ] **M2** — `app/moderator-giris/page.tsx:20-30` giriş sonrası rol kontrolü yok; normal
      kullanıcı da giriş yapıp `/moderator`'a itiliyor.
- [ ] **C2** — `/cikis` `sb-` cookie'lerini açıkça temizlemiyor (proxy'deki pattern ile tutarsız).
- [ ] **G1** — Şifreli girişte (özellikle `/moderator-giris`) rate limit / lockout yok.
- [ ] **G2** — OTP gönderiminde bot koruması yok → rastgele numaralara SMS tetiklenebilir (maliyet).
- [ ] **S1** — `app/layout.tsx:22-26` metadata'da `metadataBase`, OpenGraph, Twitter card,
      canonical yok → WhatsApp/sosyal paylaşımda önizleme kartı çıkmıyor.
- [ ] **S2** — `/giris`, `/profil-tamamla`, `/moderator-giris`, `/auth/reset` indekslenebilir
      (`noindex` yok).
- [ ] **S3** — `app/sitemap.ts:29-35` `/yol-rehberi` ve `/u/[username]` profillerini içermiyor.
- [ ] **S4** — `public/robots.txt` tutarsız: ClaudeBot bloğunda `/moderator-giris/` disallow yok;
      `User-agent: *` bloğu `/panel/`, `/admin/`, `/api/`, `/moderator/`'e açık.
- [ ] **R2** — Şifre güç göstergesi 3 kriter gösteriyor, doğrulama yalnız uzunluk uyguluyor
      (`auth/reset/page.tsx:30` vs `:74`; `giris/page.tsx:258` vs `:497`).
- [ ] **F1** — `Footer.tsx:29` "Kayıt Ol" linki `/giris` (mod param yok, `:28` ile birebir aynı).
- [ ] **F2** — `Footer.tsx:20-37` 7 link `<a>` ile → her tıklamada tam sayfa yenilemesi.
- [ ] **K2b** — TCKN/VKN doğrulaması yalnız client'ta; sunucuda tekrarlanmıyor (K2 ile birlikte).

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
- [ ] **`merkez` şüphesi ÇÜRÜDÜ** — `Balıkesir/Elazığ/Sivas/Ağrı` kümesi `merkez`den
      gelmiyor; tabloda öyle bir alias yok. Gerçek alias tablosuyla yerel çalıştırmada
      `KONYA KARATAY YÜKLER TEKİRDAĞ MERKEZ` sadece `Konya,Tekirdağ` üretiyor. Fazlalık
      şehirler mesajın 60 karakterlik önizlemede GÖRÜNMEYEN kısmından geliyor olmalı;
      `cityHits` + 220 karakterlik önizleme dağıtılınca doğrulanacak.

---

## ✅ Düzeltilen Buglar
- [x] **(6 Tem 2026)** Moderatör panelinde çoklu WhatsApp dosyası yüklerken `Unexpected token 'A', "An error o"... is not valid JSON` hatası — sebep: `/api/whatsapp-parse` route'unda `maxDuration` tanımlı değildi, büyük/çoklu dosya gruplarında Vercel'in default timeout'u aşılınca platform kendi HTML/düz-metin hata sayfasını ("An error occurred with your deployment...") dönüyordu; frontend (`WhatsappYukle.tsx`) bunu koşulsuz `res.json()` ile parse etmeye çalışınca patlıyordu. Çözüm: route'a `export const maxDuration = 60` eklendi (learn-aliases route'undaki pattern), frontend `res.json()` öncesi `res.text()` + `JSON.parse` try/catch ile sarmalandı ve 413/504 durumlarına özel Türkçe hata mesajı eklendi.