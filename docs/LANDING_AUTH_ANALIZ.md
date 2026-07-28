# Landing / Kayıt / Giriş — Analiz

> 28 Temmuz 2026 · Kapsam: `app/page.tsx`, `app/_components/HomeClient.tsx`, `app/giris/page.tsx`,
> `app/profil-tamamla/page.tsx`, `app/auth/callback/route.ts`, `proxy.ts`, `app/api/auth/*`
> Kod okumasına dayalı statik analiz — canlı DB/RLS doğrulaması yapılmadı (sandbox Supabase'e erişemiyor).
> Bulgu kodları: **L**anding, **A**uth, **K**ayıt.

---

## Özet

| Kod | Bulgu | Şiddet |
|---|---|---|
| L1 | Misafire kapalı olması gereken telefon numaraları RSC payload'ında açıkta | 🔴 Kritik |
| A1 | `/api/auth/log` route'u YOK — tüm auth telemetrisi sessizce kayboluyor | 🔴 Kritik |
| A2 | `/giris/merge` sayfası YOK — Google merge akışı 404 | 🔴 Kritik |
| K1 | KVKK / Kullanım Koşulları açık rızası hiç alınmıyor | 🔴 Kritik (yasal) |
| K2 | `users` tablosuna client'tan serbest `upsert` — kolon bazlı RLS'e bağımlı | 🟠 Yüksek |
| A3 | `?hesap=tasindi` / `?hesap=eslesme` hiç okunmuyor — kullanıcı sebebi göremiyor | 🟠 Yüksek |
| K3 | Kullanıcı tipi seçimi, DB'den prefill edilen TCKN/VKN/şirket adını siliyor | 🟠 Yüksek |
| L2 | "İlan Ver" CTA'ları misafiri `/giris`'e atıyor — ana huni sızıntısı | 🟠 Yüksek |
| A4 | OTP 4 hane sabit; Twilio Verify varsayılanı 6 hane | 🟠 Yüksek (doğrula) |
| L3 | İlan sayacı (`totalCount`) ile listelenen ilan seti tutarsız | 🟡 Orta |
| A5 | Şifre kuralı UI'da "sayı + büyük harf" diyor, doğrulama sadece uzunluk | 🟡 Orta |
| A6 | OTP gönderiminde cooldown/tekrar-gönder yok | 🟡 Orta |
| L4 | Auth resolve olana kadar girişli kullanıcıya misafir hero'su gösteriliyor | 🟢 Düşük |
| A7 | `bilgi` mesajı yalnızca telefon sekmesinde ve OTP öncesi render ediliyor | 🟢 Düşük |
| L5 | Filtre barında sekme sırası (`arac`, `yuk`) ile varsayılan state (`yuk`) uyuşmuyor | 🟢 Düşük |

---

## 🔴 L1 — Telefon numaraları misafire açık (RSC payload)

`app/page.tsx:92` sunucu tarafında `tel: ilan.contact_phone` alanını 200 ilan için map'liyor ve
`app/page.tsx:117`'de client component'e prop olarak geçiyor:

```tsx
<HomeClient initialIlanlar={initialIlanlar} totalCount={totalCount} />
```

Next.js client component prop'larını **flight payload olarak HTML'e gömer**. `IlanKart` numarayı
ekrana basmasa da (`HomeClient.tsx:318`, yalnızca `tel:` link'inde kullanılıyor), `view-source`
veya basit bir `curl https://yukegel.com | grep -o '05[0-9]\{9\}'` tüm numaraları döker.

Bu, `UyeBanner`'ın (`HomeClient.tsx:261`) verdiği sözü — *"Telefon numaralarını görmek ve ilan
sahiplerine ulaşmak için üye olun"* — tamamen geçersiz kılıyor. Aynı zamanda KVKK açısından
kişisel veri ifşası: ilanların bir kısmı WhatsApp/Excel kaynaklı, yani sahibi platforma hiç
kayıt olmamış kişiler.

İkinci kanal: `HomeClient.tsx:444` client-side sorgusu **anon key** ile `contact_phone`'u
doğrudan seçiyor. `listings` üzerindeki anon SELECT politikası kolon kısıtlamıyorsa numaralar
DevTools → Network'ten de okunabilir.

**Çözüm:** `contact_phone`'u misafir yanıtından tamamen çıkar. Sunucuda `kullanici` bilinmediği
için en temizi: SSR'de numarayı hiç map'leme, "Ara" aksiyonu için ayrı bir authenticated endpoint
(`GET /api/ilan/[id]/telefon`) aç ve tıklama anında çek. Client-side sorgudan da `contact_phone`
alanını çıkar; anon rolü için kolon bazlı RLS/`GRANT` uygula.

---

## 🔴 A1 — `/api/auth/log` route'u mevcut değil

`app/giris/page.tsx:13-19` ve `app/profil-tamamla/page.tsx:8-14` içindeki `authLog()`,
`POST /api/auth/log`'a istek atıyor. `app/api/auth/` altında yalnızca `merge`, `switch-account`,
`tekil-kontrol` klasörleri var — `log` yok.

Her çağrı `.catch(() => {})` ile sarmalı olduğu için **404 sessizce yutuluyor**. Sonuç:
`login_success`, `login_failed`, `otp_failed`, `kayit_tamamlandi` olaylarının **hiçbiri**
kaydedilmiyor. `docs/LOG_VE_GUVENLIK_SPECLERI.md`'de tanımlı audit trail auth tarafında boş.
Başarısız giriş denemesi tespiti / brute-force alarmı da fiilen çalışmıyor.

**Çözüm:** `app/api/auth/log/route.ts` oluştur; `structuredLog('INFO'|'WARN', 'auth', ...)` çağır,
`user_id`'yi body'den DEĞİL sunucudaki oturumdan al (aksi halde endpoint sahte log enjeksiyonuna
açık olur), IP başına rate limit koy.

---

## 🔴 A2 — `/giris/merge` sayfası mevcut değil

`app/auth/callback/route.ts` (Google/PKCE akışı), aynı e-postayla kayıtlı eski bir profil
bulduğunda şuraya yönlendiriyor:

```ts
return NextResponse.redirect(`${origin}/giris/merge?${params}`)
```

`app/giris/` altında yalnızca `page.tsx` var; `merge/page.tsx` yok → **404**.

Etki: Google ile giriş yapan ve aynı e-postayla eski kaydı bulunan her kullanıcı 404 duvarına
çarpıyor. Bu tam olarak `PROJE_HARITASI` §14'te "çözüldü" denen `users_email_key` senaryosunun
Google ayağı — telefon ayağı `giris/page.tsx`'teki `merge_onay` moduyla çözülmüş ama Google ayağı
var olmayan bir sayfaya bağlanmış.

Ayrıca `merge_user_id` query string'de taşınıyor; hedef sayfa yazılırken bu ID sunucuda
doğrulanmalı (kullanıcı parametreyi değiştirip başka bir hesabı kendine merge etmeye çalışabilir).

**Çözüm:** İki seçenek — (a) `app/giris/merge/page.tsx` yaz, `giris/page.tsx`'teki `merge_onay`
ekranını yeniden kullan; (b) callback'i `/giris?merge_user_id=...`'e yönlendirip mevcut sayfada
handle et. (b) daha az kod, tek merge UI'ı korur.

---

## 🔴 K1 — KVKK / Kullanım Koşulları rızası alınmıyor

Ne `giris/page.tsx`'in kayıt formunda (satır 480-517) ne de `profil-tamamla/page.tsx`'te
KVKK aydınlatma metni, açık rıza kutucuğu veya kullanım koşulları onayı var. `grep -n "kvkk"`
her iki dosyada da sonuçsuz.

`/kvkk` ve `/kullanim-kosullari` sayfaları mevcut ve `sirket_unvani` config'inden besleniyor,
ama kayıt akışına hiç bağlı değil. TCKN/VKN gibi özel nitelikli olabilecek veriler toplanırken
bu, KVKK md. 5/10 açısından savunulabilir değil.

**Çözüm:** `profil-tamamla` submit butonunun üstüne zorunlu onay: "Kullanım Koşulları'nı ve
KVKK Aydınlatma Metni'ni okudum, kabul ediyorum" (linkler yeni sekmede). `formGecerli`'ye ekle.
Rıza zamanını `users` tablosunda sakla (`terms_accepted_at`, `kvkk_accepted_at`) — ispat yükü
platformda.

---

## 🟠 K2 — `users` tablosuna client'tan serbest upsert

`profil-tamamla/page.tsx:223`:

```ts
await supabase.from('users').upsert({ id: user.id, email, display_name, user_type, phone,
  phone_verified: telefonKilitli, is_active: true, ... }, { onConflict: 'id' })
```

Anon/authenticated client doğrudan `users`'a yazıyor. Güvenlik tamamen RLS politikasının kolon
kapsamına bağlı. Eğer politika `USING (auth.uid() = id)` şeklinde satır bazlıysa ve kolon
kısıtlaması yoksa, kullanıcı DevTools'tan `role: 'admin'`, `ai_listing_quota_daily: 99999`,
`is_shadow_banned: false` gibi alanları da gönderebilir.

Ayrıca `phone_verified: telefonKilitli` — bu bayrak **client state'inden** geliyor. `telefonKilitli`
sadece `user.phone` doluysa true oluyor, yani pratikte doğru; ama doğrulama bayrağının değerini
client'ın belirlemesi yapısal olarak yanlış.

**Doğrulanacak:** `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='users';`
ve `information_schema.column_privileges` üzerinden `authenticated` rolünün `UPDATE` izni olan
kolonları listele.

**Çözüm:** Profil kaydını bir server action'a / `POST /api/profil` route'una taşı, alan
whitelist'i sunucuda uygula, `phone_verified`'ı `auth.users.phone`'dan türet. `role`, `is_active`,
`merged_into`, `ai_listing_quota_daily` kolonlarında `authenticated` rolünün UPDATE iznini kaldır.

---

## 🟠 A3 — Yönlendirme sebebi kullanıcıya hiç gösterilmiyor

`proxy.ts:94` ve `proxy.ts:128` iki farklı self-heal senaryosunda kullanıcıyı
`/giris?hesap=tasindi` veya `/giris?hesap=eslesme`'ye yolluyor. `giris/page.tsx` bu parametreyi
**hiç okumuyor** (`searchParams.get('hesap')` yok; sadece `redirect` okunuyor, satır 42).

Daha kötüsü: `hesap=tasindi` dalında proxy `sb-` cookie'lerini siliyor (satır 95-97). Yani sayfa
açıldığında oturum yok → `INITIAL_SESSION` handler'ı `if (!user) return;` ile çıkıyor (satır 61)
→ `setBilgi(...)` hiç çalışmıyor. Kullanıcı `/panel`'e tıklıyor, açıklamasız giriş ekranına
düşüyor. Klasik "neden çıkış yaptım?" şikayeti.

**Çözüm:** `const hesap = searchParams.get('hesap')` oku ve mount'ta `bilgi`'yi set et:
`tasindi` → "Hesabınız birleştirildi, lütfen tekrar giriş yapın."; `eslesme` → "Bu bilgilerle
kayıtlı bir hesabınız var — aynı yöntemle giriş yapın."

---

## 🟠 K3 — Tip seçimi, prefill edilen kimlik bilgilerini siliyor

`profil-tamamla/page.tsx:133-138`:

```ts
useEffect(() => {
  setTckn(''); setVkn(''); ... setSirketAdi('');
}, [userType]);
```

Init effect'i (satır 96-130) DB'den `tckn`, `vkn`, `company_name` değerlerini prefill ediyor.
Ama kullanıcı "Ben bir..." kartlarından birine tıkladığı anda bu effect çalışıp hepsini siliyor.

Mount'ta sorun yok (init `await`li olduğu için temizleme önce koşuyor), ama gerçek kullanım
sırası tam olarak "sayfa açılır → alanlar dolu gelir → tip seçilir → alanlar boşalır". Kullanıcı
zaten girmiş olduğu VKN'yi yeniden yazmak zorunda kalıyor.

**Çözüm:** Temizleme effect'ini yalnızca *kullanıcı kaynaklı* değişimde çalıştır — `setUserType`
çağrısını bir `handleTipSec(v)` fonksiyonuna sar, temizlemeyi orada yap, effect'i kaldır.
Alternatif: `useRef` ile ilk render'ı atla ve önceki `userType` ile karşılaştır.

---

## 🟠 L2 — "İlan Ver" CTA'ları misafiri giriş duvarına çarpıyor

`proxy.ts:19` → `KORUNMALI = ['/panel', '/ilan-ver', ...]`.

Landing'de misafire gösterilen üç ana CTA `/ilan-ver`'e gidiyor:
- Hero ikincil buton — "📦 Yük Vereceğim, İlan Ver" (`HomeClient.tsx:92`)
- `YukVerenBanner` — "İlan Ver →" (`HomeClient.tsx:248`)
- Navbar "+ İlan Ver" (girişliyse)

Hepsi `/giris?redirect=/ilan-ver`'e düşüyor. Ama hemen yanındaki metin *"İlanınızı saniyeler
içinde yayınlayın... Ücretsiz."* (`HomeClient.tsx:246`) diyor. Vaat ile deneyim çelişiyor;
yük sahibi tarafındaki dönüşümün en pahalı kısmı burası.

Not: `shadow_profiles` altyapısı (kayıtsız kullanıcı ilanı) zaten mevcut — yani "önce ilan,
sonra telefon doğrulama" akışı için DB tarafı hazır.

**Çözüm:** `/ilan-ver`'i misafire aç, formu doldurtup **yayınlama anında** SMS OTP iste
(`shadow_profiles` + `upsert_shadow_profile` ile bağla). En azından CTA metnini
"Ücretsiz üye ol, ilan ver" yapıp beklentiyi düzelt.

---

## 🟠 A4 — OTP uzunluğu 4 haneye sabitlenmiş

`giris/page.tsx:430`: `.substring(0, 4)`, `maxLength={4}`, `disabled={otp.length < 4}`,
placeholder "4 haneli kod".

Twilio Verify'ın varsayılan kod uzunluğu **6 hane**. Verify servisinde `codeLength` 4'e
çekilmediyse kullanıcı kodun tamamını giremiyor ve giriş imkânsız hale geliyor.

**Doğrulanacak:** Twilio Console → Verify → Service → Code Length.

**Çözüm:** Ya servisi 4'e ayarla ya da UI'yi 6'ya çıkar. Uzunluğu sabit yazmak yerine
`OTP_UZUNLUK` sabiti çıkarıp tek yerden yönet.

---

## 🟡 L3 — İlan sayacı ile liste tutarsız

`page.tsx` **filtresiz 200** ilan çekiyor (`.limit(200)`), `totalCount` ise **tüm** aktif
ilanları sayıyor. `HomeClient` bunları client-side `tip` (`yuk`/`arac`) filtresinden geçiriyor.

Sonuçlar:
1. Filtre yokken sayaç `{totalCount} aktif ilan` diyor (satır 625) ama liste en fazla 200'ün
   `tip`'e uyan alt kümesini gösteriyor. Sayaç 1.500 derken listede 60 kart olabiliyor.
2. Son 200 ilanın büyük çoğunluğu `yuk` ise "🟢 Araç" sekmesi neredeyse boş görünüyor —
   DB'de yüzlerce araç ilanı olsa bile.
3. Kalkış/varış filtresi de yalnızca yüklenmiş 200 kayıt içinde arıyor → "Filtrelerle eşleşen
   ilan bulunamadı" yanlış negatifi.
4. Client refetch (retry veya SSR verisi boşsa) sadece **30** kayıt çekiyor — aynı sayfada
   iki farklı veri hacmi.

**Çözüm:** Filtreleri sunucuya taşı (`?tip=&kalkis=&varis=` query param + server-side filtreleme),
ya da en azından sayacı `filtered.length` ile hizala ve "son 200 ilan gösteriliyor" ibaresi ekle.

---

## 🟡 A5 — Şifre kuralı UI ile doğrulama uyuşmuyor

`giris/page.tsx:497` kullanıcıya "En az 8 karakter, sayı ve büyük harf içermeli" diyor ve
satır 492'de üç çubuklu bir güç göstergesi çiziyor. Ama `epostaKayit` (satır 258) yalnızca
`sifre.length < 8` kontrolü yapıyor.

Kullanıcı `12345678` ile kayıt olabiliyor; iki çubuk kırmızı kalsa da buton çalışıyor.

**Çözüm:** Ya doğrulamayı metne uydur (`/[0-9]/` ve `/[A-Z]/` şartlarını `epostaKayit`'e ekle),
ya da metni gerçeğe uydur ("En az 8 karakter"). Supabase Auth tarafında da password policy
ayarlanabilir — asıl kontrol orada olmalı.

---

## 🟡 A6 — OTP gönderiminde cooldown yok

`otpGonder` (satır 104-112) art arda çağrılabiliyor; buton yalnızca `yukleniyor` süresince
disabled. OTP ekranındaki "← Telefonu değiştir" ile geri dönüp tekrar göndermek de serbest.
Her deneme bir Twilio SMS'i = doğrudan maliyet.

Supabase'in kendi rate limit'i son savunma hattı olarak var, ama kullanıcıya "60 sn sonra tekrar
deneyin" geri bildirimi verilmiyor; kullanıcı sessiz hata görüyor.

**Çözüm:** 60 saniyelik geri sayım + "Kodu tekrar gönder (0:47)" butonu. Sunucu tarafında
telefon başına saatlik tavan.

---

## 🟢 L4 — Girişli kullanıcıya misafir hero'su flash'lıyor

`HomeClient.tsx:570`: `{!kullanici && <HeroKayitsiz ... />}` — `authHazir` beklenmiyor.
Satır 571-572'deki kişiselleştirilmiş hero'lar ise `authHazir` bekliyor.

Sonuç: giriş yapmış kullanıcı ilk paint'te "Türkiye'nin şoför dostu yük platformu" hero'sunu
ve navbar'da "Giriş Yap / Üye Ol" butonlarını görüyor, ~200-500 ms sonra kendi adını.

**Çözüm:** Auth'u sunucuda çöz (cookie zaten var, `proxy.ts` okuyabiliyor) ve `HomeClient`'a
prop geçir; ya da misafir hero'sunu `authHazir && !kullanici` koşuluna bağla (bu sefer misafir
için boşluk oluşur — sunucu tarafı çözüm daha doğru).

---

## 🟢 A7 — `bilgi` mesajı dar bir koşulda render ediliyor

`bilgi` state'i yalnızca `sekme === 'telefon' && !otpAdim` bloğunda basılıyor (satır 418).
Kullanıcı e-posta sekmesindeyken ya da OTP adımındayken hiçbir bilgilendirme göremiyor.
A3 ile birlikte düzeltilmeli — mesaj kartın üstüne, sekmeden bağımsız bir yere taşınmalı.

---

## 🟢 L5 — Filtre sekmesi sırası ile varsayılan state uyuşmuyor

`HomeClient.tsx:374` → `useState<'yuk'|'arac'>('yuk')`, satır 589 → `(['arac','yuk'] as const).map(...)`.
Soldaki buton "🟢 Araç" ama aktif olan sağdaki "🔴 Yük". Kozmetik ama şaşırtıcı.

---

## Doğru kurgulanmış noktalar

Analiz sırasında karşılaşılan ve **değiştirilmemesi gereken** kararlar:

- `giris/page.tsx`'in `INITIAL_SESSION`'a bağlanması (`getUser` yerine) — magic-link hash'i
  tüketildikten sonra çalıştığı için race condition'ı doğru çözüyor. Yorum satırları bu kararın
  gerekçesini iyi belgelemiş.
- `proxy.ts`'in ölü oturumda `sb-` cookie'lerini silmesi — magic-link geçişinin yarattığı sonsuz
  döngüyü kökünden kesiyor.
- Telefon eşleştirmesinde dört formatın da denenmesi (`+905xx`, `905xx`, `05xx`, `5xx`).
- `tekil-kontrol` endpoint'inin service role ile RLS bypass edip yalnızca `{mevcut: boolean}`
  dönmesi — sızıntı yüzeyi minimal, doğru tasarım.
- TCKN/VKN algoritmik doğrulaması (`tcknGecerli`/`vknGecerli`) — client tarafında ama doğru.
- `maybeSingle()` kullanımının her yerde tutarlı olması.

---

## Önerilen sıra

1. **L1** — telefon sızıntısı (yasal + ürün vaadi ihlali, tek dosyada düzeltilebilir)
2. **A2** — Google merge 404 (kullanıcıyı tamamen kilitliyor)
3. **K1** — KVKK onayı (yasal)
4. **A1** — auth log endpoint'i (güvenlik görünürlüğü sıfır)
5. **K2** doğrulaması — RLS politikası kontrolü (SQL sorgusu, 5 dk)
6. **A3 + A7** — yönlendirme mesajları (küçük, yüksek etki)
7. **A4** — OTP uzunluğu doğrulaması (Twilio Console kontrolü)
8. **K3, L2, L3** — UX/huni düzeltmeleri
