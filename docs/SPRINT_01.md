# SPRINT 01 — Landing / Kayıt / Giriş

> Oluşturma: 28 Temmuz 2026
> Kaynak analiz: `docs/LANDING_AUTH_ANALIZ.md`
> Kapsam: `app/page.tsx`, `app/_components/*`, `app/giris`, `app/profil-tamamla`, `app/auth/*`, `app/cikis`, `app/moderator-giris`, `proxy.ts`, `app/layout.tsx`, `app/sitemap.ts`, `public/robots.txt`

**Toplam: 30 madde / 78 puan** · Efor birimi: 1 puan ≈ 30 dk odaklı iş.

---

## Dalga planı

| Dalga | Tema | Maddeler | Puan | Neden bu sırada |
|---|---|---|---|---|
| **W0** ✅ | Yasal + tam kilitleyen buglar | L1, A2, M1, K1 (+L1b, L1c, L1d, L1f, A2b, K1b, A4b-hane) | 17 (+7 keşif) | Ürün şu an yasal risk taşıyor ve iki akış tamamen kırık |
| **W1** ✅ | Auth akış bütünlüğü | A1, A3, A4, A7, K2, R1, C1 (+A1b, A4b, L1e) | 21 | Kullanıcı doğru ekrana gitmiyor / sessiz hata |
| **W2** ✅ | Güvenlik & gözlemlenebilirlik | G1, G2, M2, C2, K2b (+A8, A10, `lib/kota.ts`) | 15 | Kötüye kullanım yüzeyi + kör nokta |
| **W3** | SEO & huni | S1, S2, S3, S4, L2, L3 | 14 | Trafik ve dönüşüm |
| **W4** | UX cila | K3, L4, L5, A5, A6, R2, F1, F2 | 11 | Küçük ama görünür |

---

## W0 — Blocker (17 puan) — ✅ TAMAMLANDI (28 Tem 2026)

> Uygulama sırasında W0 kapsamında olmayan **7 ek blocker** ortaya çıktı ve aynı dalgada
> kapatıldı: L1c, L1d, L1f (aynı sınıf telefon sızıntıları), A2b (merge route çöküyordu),
> A4b-hane (sahiplen OTP 6 hane bekliyordu, Twilio 4 gönderiyor). Ayrıntılar aşağıda.
>
> ~~**Bayram'ın çalıştırması gereken tek şey:** `docs/20260728_kvkk_onay.sql`~~
> ✅ **Çalıştırıldı** (29 Tem 2026).
>
> **Hâlâ açık kalan tek telefon vektörü:** L1e (DB seviyesi) — aşağıda, W1'e taşındı.

### L1 · Telefon numarası RSC payload'ında misafire sızıyor 🔴
- **Dosya:** `app/page.tsx:92` → `tel: ilan.contact_phone`, `:117` `<HomeClient initialIlanlar={...} />`
- **Mekanizma:** `createServiceClient()` (RLS bypass) ile çekilen `contact_phone`, client component prop'u olarak flight payload'a serialize ediliyor. Giriş yapmamış ziyaretçi sayfa kaynağından tüm ilan sahiplerinin telefonunu okuyabiliyor. Aynı sızıntı `HomeClient.tsx:444/486`'daki anon sorguda da var.
- **Etki:** KVKK ihlali + "üye olunca telefon görünür" ürün vaadinin tamamen boşa çıkması (`HomeClient.tsx:261` UyeBanner).
- **Yapılan:** ⚠️ *Plandaki "oturum yoksa `tel: null`" çözümü UYGULANAMADI.* `app/page.tsx` ISR'li
  (`export const revalidate = 30`) — çıktı tüm ziyaretçiler arasında paylaşılıyor, dolayısıyla
  oturuma göre koşullu render mümkün değil; ilk misafir isteğinden gelen cache herkese servis
  edilirdi. Numara payload'dan **tamamen** çıkarıldı: `page.tsx` service-role select'inden ve
  `HomeClient.tsx` anon select'inden `contact_phone` silindi, `tel:` map'i kaldırıldı. "Ara"
  butonu artık tıklama anında `/api/ilan/[id]/telefon`'a gidiyor (`araTikla`), numara hiç
  state'e girmiyor.
- **Kabul kriteri:**
  - [x] Çıkış yapmış tarayıcıda `view-source` + flight payload'da hiçbir `+90`/`05` telefon deseni yok
  - [x] Girişli kullanıcıda telefon hâlâ görünüyor (endpoint üzerinden)
  - [x] `logPhoneAccess` her telefon açılışında kayıt düşüyor
- **Efor:** 5 puan · **Bağımlılık:** yok · **Riskli dosya:** `page.tsx`, `HomeClient.tsx`

### A2 · Google merge akışı 404'e düşüyor 🔴
- **Dosya:** `app/auth/callback/route.ts` → `redirect('/giris/merge?...')`; `app/giris/` altında yalnızca `page.tsx` var
- **Etki:** Aynı e-postayla önceden kaydı olan kullanıcı Google ile girince 404 alıp tamamen kilitleniyor. Geri dönüş yolu yok.
- **Yapılacak:** İki seçenekten biri —
  - (A) `app/giris/merge/page.tsx` oluştur (eski hesap adını göster, "Bu benim / değil" onayı → `/api/auth/merge`)
  - (B) callback'i `/giris?mod=merge_onay&merge_user_id=...` biçimine çevir; `giris/page.tsx` zaten `'merge_onay'` moduna sahip (`type Mod`)
  - **Öneri: (B)** — mevcut mod state'i hazır, yeni route/RLS yüzeyi açmıyor.
- **Yapılan:** **(B)** uygulandı. `callback/route.ts` → `/giris?merge_user_id=…&merge_name=…&merge_email=…`.
  `giris/page.tsx` bu paramları **lazy `useState` initializer** ile okuyor (effect içinde
  `setState` etmek hem bir kare yanlış ekran gösteriyor hem `react-hooks` lint hatası veriyordu).
  Ayrıca `INITIAL_SESSION` handler'ına guard eklendi: merge bekleyen oturumda `signOut()`
  çalışıp merge ekranını kullanıcının elinden alıyordu.
- **Kabul kriteri:**
  - [x] Var olan e-postayla Google girişi → 404 yok, onay ekranı geliyor
  - [x] Onay sonrası `/panel`'e düşüyor, `merged_into` doğru set ediliyor
  - [x] Reddetme yolu da bir yere çıkıyor (çıkış + açıklama)
- **Efor:** 5 puan · **Bağımlılık:** yok

### M1 · `/moderator-giris` çıkış yapmışken erişilemiyor 🔴 *(yeni)*
- **Dosya:** `proxy.ts:19` `KORUNMALI = [... '/moderator']`, `:72` `pathname.startsWith(r)`
- **Mekanizma:** `'/moderator-giris'.startsWith('/moderator') === true`. `ACIK_ROTALAR`'da `/moderator-giris` yok → oturumsuz kullanıcı moderatör giriş sayfasına gidemiyor, `/giris?redirect=/moderator-giris`'e atılıyor.
- **Etki:** Moderatör ekibi kendi giriş ekranına ulaşamıyor.
- **Yapılan:** `ACIK_ROTALAR`'a `/moderator-giris` eklendi **ve** düz `startsWith` yerine
  segment sınırında eşleşen `korunmaliMi()` yazıldı (`pathname === kok || pathname.startsWith(kok + '/')`).
  Aynı tuzak `/profil` ↔ `/profil-tamamla` için de geçerliydi; artık kökten kapalı.
- **Kabul kriteri:**
  - [x] Gizli sekmede `/moderator-giris` açılıyor
  - [x] `/moderator` hâlâ oturumsuz erişime kapalı
- **Efor:** 1 puan · **Bağımlılık:** yok

### K1 · KVKK / açık rıza onayı yok 🔴
- **Dosya:** `app/profil-tamamla/page.tsx` (form gövdesi), `app/giris/page.tsx` kayıt modu
- **Etki:** TCKN/VKN/telefon topluyoruz, aydınlatma metni onayı alınmıyor. `/kvkk` ve `/kullanim-kosullari` sayfaları var ama akışa bağlı değil.
- **Yapılan:** `profil-tamamla/page.tsx`'e zorunlu checkbox (`kvkkOnay` state) eklendi;
  `formGecerli`'ye ve `handleSubmit` guard'ına bağlandı; upsert `kvkk_onay_at: new Date().toISOString()`
  yazıyor. Linkler `/kvkk` ve `/kullanim-kosullari`'na `target="_blank" rel="noopener noreferrer"`.
- **Kabul kriteri:**
  - [x] Onaysız submit engelleniyor
  - [x] `users.kvkk_onay_at` doluyor
  - [x] Metin linkleri yeni sekmede açılıyor
- **Efor:** 4 puan · **Bağımlılık:** K1b migration ⚠️ **HENÜZ ÇALIŞTIRILMADI**
- **DB:** `alter table users add column kvkk_onay_at timestamptz;`

### K1b · Migration: `users.kvkk_onay_at` 🔴 — ⏳ Bayram çalıştıracak
- Dosya hazır: **`docs/20260728_kvkk_onay.sql`** → Supabase SQL Editor.
- Bu kolon açılmadan K1 kodu upsert'te hata verir. **Deploy'dan önce çalıştır.**
- **Efor:** 1 puan · K1'i blokluyor

### L1b · `/api/ilan/[id]/telefon` endpoint'i 🔴 — ✅
- **Dosya:** `app/api/ilan/[id]/telefon/route.ts` *(yeni)*
- Authed + profil tamamlanmış + hesap aktif + ilan yayında/shadow-ban değil kontrolü,
  `logPhoneAccess` kaydı, `Cache-Control: no-store, private`.
- Rate limit: **dk başına 20**, in-memory `Map` ile. ⚠️ Bu sayaç **süreç başına**; çok
  instance'lı deploy'da tam koruma vermez. Kalıcı çözüm (Redis/DB) W2'ye ticket açılmalı.
- **Efor:** 1 puan

### L1c · `/ilan/[id]` detay sayfasında iki ek sızıntı 🔴 *(uygulamada keşfedildi)* — ✅
- **Dosya:** `app/ilan/[id]/page.tsx:253` (wa.me linki), `:462` (`<Aksiyonlar contactPhone=…>`)
- **Mekanizma:** (a) WhatsApp linki numarayı URL'e gömüyor ve HTML'de herkese görünüyordu;
  (b) `Aksiyonlar` bir client component — prop'u flight payload'a serialize oluyordu.
  Sayfanın kendisi `cookies()` kullandığı için **dinamik**; burada L1'in aksine koşullu
  render güvenli.
- **Yapılan:** ikisi de `user && profilTamamlandi` koşuluna bağlandı; misafirde `null`.
- **Efor:** 1 puan

### L1d · `/ilan/[id]/sahiplen` sahiplenilmemiş her ilanın numarasını gösteriyordu 🔴 *(keşif)* — ✅
- **Dosya:** `app/ilan/[id]/sahiplen/page.tsx` (`'use client'`, anon key)
- **Mekanizma:** Sayfa herkese açık ve `id` tahmin edilebilir. Anon key ile `contact_phone`
  çekilip `:235` ve `:250`'de **tam olarak** ekrana yazılıyordu → sahiplenilmemiş tüm
  ilanların numarası tek istekle okunabiliyordu.
- **Yapılan:** Yeni `app/api/ilan/[id]/sahiplen/route.ts`.
  `GET` → yalnızca **maskeli** numara (`0532 *** ** 47`) + uygunluk.
  `POST {adim:'gonder'}` → OTP'yi sunucu gönderir. `POST {adim:'dogrula',kod}` → sunucu
  doğrular, ilanı sahiplendirir, profil satırını açar. Numara istemciye **hiç** gitmiyor.
- **Yan fayda:** `verifyOtp` artık SSR client ile çalıştığı için oturum **cookie'si** de
  doğru set oluyor (istemci tarafı sadece localStorage'ı güncelliyordu — proxy döngüsü riski).
- **Yan fayda 2:** sahiplenme update'i `.select()` ile dönüyor; yarış durumunda ikinci
  sahiplenme artık 409 alıyor (eskiden sessizce "başarılı" görünüyordu).
- **Efor:** 3 puan

### L1f · `/u/[username]` profil sayfası da numarayı gömüyordu 🔴 *(keşif)* — ✅
- **Dosya:** `app/u/[username]/page.tsx:48` (anon select), `:211` (`<a href="tel:…">`)
- **Mekanizma:** L1'in birebir aynısı, sadece başka sayfada. Herkese açık.
- **Yapılan:** select'ten `contact_phone` çıkarıldı, `tel:` linki `araTikla` butonuna
  çevrildi (`/api/ilan/[id]/telefon`).
- **Efor:** 1 puan

### A2b · Merge route yeni kimlikte satır yokken profili siliyordu 🔴 *(keşif)* — ✅
- **Dosya:** `app/api/auth/merge/route.ts`
- **Üç ayrı bug:**
  1. `if (yeniProfil)` guard'ı — Google merge akışında yeni auth kimliğinin `users` satırı
     **henüz yoktur** (callback zaten `!profil?.user_type` gördüğü için oraya gelir).
     `yeniProfil` null olunca tüm aktarım atlanıyordu: kullanıcı adını, TCKN'sini,
     `user_type`'ını kaybedip boş profil-tamamla ekranına düşüyordu. → A2 açılınca
     bu bug **her** Google merge'ünde tetiklenecekti.
  2. Emekli satır `email`/`phone`/`username` değerlerini korurken aynı değerler yeni satıra
     yazılıyordu → `users_email_key` unique ihlali. Sıra tersine çevrildi: tekil alanlar
     **önce** boşaltılıyor, sonra aktarım yapılıyor.
  3. `auth_providers`'a `'phone'` hardcode ediliyordu → Google kullanıcısına yanlış metadata.
     Artık `auth.admin.getUserById().identities`'ten gerçek sağlayıcılar okunuyor.
- **Ayrıca:** oturum zaten `keepUserId` ise magic link **üretilmiyor** (dokümante edilmiş
  sonsuz döngü tuzağı). Telefon-OTP yolunda link hâlâ gerekli, o dal korundu.
- **Efor:** 2 puan

### A4b-hane · Sahiplen ekranı 6 haneli OTP bekliyordu 🔴 *(keşif)* — ✅
- **Dosya:** `app/ilan/[id]/sahiplen/page.tsx` (eski `:247`, `:254`)
- Twilio Verify **4 hane** gönderiyor (Bayram doğruladı). Buton `otp.length < 6` ile disabled
  kalıyordu → sahiplenme akışı fiilen **hiç tamamlanamıyordu**. `/giris` zaten 4 kullanıyordu;
  ikisi hizalandı.
- **Efor:** 0.5 puan

---

## W1 — Auth akış bütünlüğü (21 puan + L1e) — ✅ TAMAMLANDI (28 Tem 2026)

> Kod tarafı bitti. **A4 hariç** (Twilio Console erişimi Bayram'da; kod 4 haneye
> sabitlendi ve Bayram "4 hane, çalışıyor" diye teyit etti → kapandı).
>
> **Bayram'ın çalıştırması gereken SQL'ler ve SIRASI:**
> 1. ~~`docs/20260728_kvkk_onay.sql`~~ ✅ çalıştırıldı (29 Tem 2026)
> 2. ~~`docs/20260728_auth_events.sql`~~ ✅ çalıştırıldı (29 Tem 2026)
> 3. `docs/20260728_contact_phone_revoke.sql` — deploy'dan **SONRA** (L1e; ters sırada
>    panel ve moderatör numarayı yazamaz) ← **tek kalan**
>
> **Bu dalgada keşfedilen ek açık:** panel'in istemci tarafı `listings` update'i gövdeyi
> hiç filtrelemiyordu — kullanıcı kendi ilanına `trust_level: 'verified'`,
> `moderation_status: 'approved'` yazabiliyordu (K2 ile aynı sınıf). `app/panel/actions.ts`
> beyaz listesiyle kapandı.

### L1e · Anon key hâlâ `listings.contact_phone`'u doğrudan okuyabiliyor 🔴 *(W0'dan devreden)* — ✅
- **Katman:** DB / PostgREST — **kod değişikliğiyle kapanmaz.**
- **Mekanizma:** W0'da uygulamanın *her* yüzeyinden numara çıkarıldı, ama `contact_phone`
  kolonu üzerinde `anon` rolünün `SELECT` yetkisi duruyor. Yani `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (tanımı gereği herkese açık) ile doğrudan PostgREST'e gidip
  `/rest/v1/listings?select=contact_phone` çekmek hâlâ mümkün. Uygulama tarafındaki
  düzeltmeler **kolay** yolu kapattı, DB yolunu kapatmadı.
- **Etki:** KVKK açısından L1 ile aynı sınıf. W0 "telefon sızıntısı kapandı" diyebilmek için
  bunun da kapanması gerekiyor.
- **Yapılacak (üç seçenek, biri):**
  - (A) `revoke select (contact_phone) on public.listings from anon;` — en dar müdahale,
    ama `authenticated` rolü de tüm satırları okuyabildiği için tek başına yetmez.
  - (B) `contact_phone`'u dışarıda bırakan bir `listings_public` view'ı açıp anon'u ona yönlendir.
  - (C) **Önerilen:** (A) + `authenticated` için de revoke; telefon **yalnızca**
    service-role kullanan `/api/ilan/[id]/telefon` üzerinden dönsün. Uygulama zaten
    W0 sonrası bu şekilde çalışıyor, yani revoke hiçbir ekranı kırmaz.
- **Kabul kriteri:**
  - [ ] Anon key ile `select=contact_phone` isteği hata dönüyor
  - [ ] Girişli kullanıcıda "Ara" hâlâ çalışıyor (endpoint service-role kullanıyor)
  - [ ] `/panel` ve `/moderator` kendi telefon alanlarını görmeye devam ediyor
        (⚠️ bu ikisi anon/authed client ile `contact_phone` çekiyor — revoke öncesi
        `IlanYonetim.tsx`, `panel/page.tsx`, `moderator/page.tsx` service-role'e taşınmalı)
- **Efor:** 3 puan · **Bağımlılık:** panel/moderator sorgularının taşınması · **Sahip:** Bayram (SQL) + kod
- **Yapıldı (C seçeneği):**
  - `app/panel/actions.ts` **(yeni)** — `ilanGuncelle` + `ilanTamamlandiToggle`. Sahiplik
    sunucuda doğrulanıyor (service-role RLS'i bypass ettiği için atlanamaz), gövde kolon
    beyaz listesinden geçiyor.
  - `app/panel/IlanYonetim.tsx` — anon supabase istemcisi **tamamen kaldırıldı**.
  - `app/moderator/actions.ts` **(yeni)** — `ilanTelefonlariGetir` (toplu, `requireStaff`,
    ≤300 kayıt) + `ilanTelefonGuncelle`. Her ikisi `structuredLog('phone-privacy', …)` ile iz bırakıyor.
  - `app/moderator/page.tsx` — `contact_phone` list select'inden, edit update'inden ve
    raw-post insert'inden çıkarıldı; numaralar fetch sonrası action ile birleştiriliyor.
  - `docs/20260728_contact_phone_revoke.sql` **(yeni)** — Bayram deploy **sonrası** çalıştıracak.
- ⚠️ **Tuzak:** Tablo geneline verilmiş `GRANT`, kolon bazlı `REVOKE`'u ezer. Migration bu
  yüzden önce tablo geneli yetkiyi alıyor, sonra `contact_phone` hariç tüm kolonları
  programatik olarak geri veriyor.

### A1 · `/api/auth/log` endpoint'i yok, çağrılar sessizce yutuluyor 🔴 — ✅
- **Dosya:** `app/giris/page.tsx:13-19` `authLog()` → `fetch('/api/auth/log').catch(() => {})`
- **Doğrulama:** `find app/api/auth -type f` → yalnızca `merge`, `switch-account`, `tekil-kontrol`
- **Etki:** Her giriş/kayıt denemesi 404 dönüyor, `.catch()` yuttuğu için kimse fark etmiyor. Auth güvenlik görünürlüğü sıfır: brute-force, merge hataları, OTP başarısızlıkları hiç kaydedilmiyor.
- **Yapılacak:** `app/api/auth/log/route.ts` — service-role ile `auth_events` tablosuna yaz (`event`, `method`, `reason`, `user_id`, `ip`, `user_agent`, `created_at`). Client tarafında `.catch(e => console.warn('authLog', e))`.
- **Kabul kriteri:**
  - [ ] Başarılı giriş, başarısız giriş, OTP gönderim, OTP hata, merge → hepsi tabloda satır üretiyor
  - [ ] Endpoint hiçbir zaman kullanıcı akışını bloklamıyor (fire-and-forget)
  - [ ] IP + UA kaydediliyor, telefon/şifre **kaydedilmiyor**
- **Efor:** 4 puan · **Bağımlılık:** A1b
- **DB:** yeni tablo `auth_events`
- **Yapıldı:** `app/api/auth/log/route.ts` (yeni) — service-role insert, IP + UA yazılıyor,
  telefon/şifre yazılmıyor. İstemcideki `.catch(() => {})` `console.warn`'a çevrildi
  (sessiz yutma tam da bu bug'ı 404 olarak gizlemişti).

### A1b · Migration + RLS: `auth_events` tablosu — ✅ *(SQL hazır, ⏳ Bayram çalıştıracak)*
- Insert yalnız service-role; select yalnız admin/moderator.
- **Efor:** 2 puan
- **Yapıldı:** `docs/20260728_auth_events.sql`. **Deploy'dan ÖNCE çalıştırılmalı.**

### A3 · `?hesap=tasindi` / `?hesap=eslesme` mesajları hiç gösterilmiyor 🟠 — ✅
- **Dosya:** `proxy.ts:94` ve `:128` bu paramlarla yönlendiriyor; `app/giris/page.tsx:42` yalnızca `redirect` param'ını okuyor
- **Ek problem:** `proxy.ts:94` cookie'leri sildiği için `giris/page.tsx:61`'deki `if (!user) return;` erken çıkıyor → hiçbir bilgilendirme yapılmıyor.
- **Etki:** Kullanıcı sebepsizce giriş ekranında buluyor kendini, ne olduğunu anlamıyor → terk.
- **Yapılacak:** `searchParams.get('hesap')` oku, `useEffect` içinde `setBilgi()` ile açıklayıcı metin bas. `tasindi` → "Hesabınız birleştirildi, aynı yöntemle tekrar giriş yapın." `eslesme` → "Bu numara/e-posta zaten kayıtlı bir hesaba ait, o hesapla giriş yapın."
- **Kabul kriteri:** [ ] İki param için de mesaj görünüyor · [ ] Mesaj `!user` durumunda da basılıyor (onAuthStateChange'ten bağımsız)
- **Efor:** 2 puan

### A7 · Yönlendirme sonrası `redirect` param'ı kayboluyor 🟡 — ✅
- `proxy.ts:73` `/giris?redirect=...` kuruyor; merge/switch akışları sonrasında korunmuyor.
- **Kabul kriteri:** [x] `/panel/ilanlarim`'a giriş isteyen kullanıcı, giriş sonrası oraya dönüyor
- **Efor:** 2 puan · **Bağımlılık:** A2, A3
- **Yapıldı:** `lib/redirect.ts` (yeni) — `guvenliRedirect()` yalnızca `/` ile başlayan,
  `//` ve `\` içermeyen yolları kabul ediyor (açık yönlendirme koruması). Merge ve
  switch-account route'ları param'ı taşıyor.

### A4 · OTP uzunluğu 4 hardcoded, Twilio 6 hane gönderiyor olabilir 🟠 — ✅ *(Bayram teyit etti: 4 hane)*
- **Dosya:** `app/giris/page.tsx:430` `.substring(0, 4)` + `maxLength={4}`
- **Etki:** Twilio Verify varsayılanı 6 hanedir. Eğer 6 ise SMS OTP girişi **tamamen çalışmıyor** demektir.
- **Yapılacak:** Twilio Console → Verify Service → Code Length kontrol et, kodu ona göre sabitle **veya** input'u 4-8 arası esnek yap ve `maxLength`'i tek yerden sabitle.
- **Kabul kriteri:** [ ] Gerçek telefonla uçtan uca OTP girişi başarılı
- **Efor:** 1 puan · **Bağımlılık:** ⚠️ Twilio Console erişimi gerekiyor (Bayram)

### K2 · `users` upsert'inde RLS/kolon yetkisi doğrulanmadı 🟠 — ✅
- **Dosya:** `app/profil-tamamla/page.tsx:223` — client'tan `supabase.from('users').upsert({... tckn, vkn, phone_verified, is_active ...})`
- **Risk:** Kullanıcı `phone_verified: true`, `is_active`, hatta `role` gibi alanları kendi isteğiyle set edebiliyorsa yetki yükseltme açığı var.
- **Yapılacak:** Aşağıdaki SQL'i çalıştır, sonucu bu dokümana yapıştır. Gerekirse upsert'i `'use server'` server action'a taşı ve yalnız beyaz listedeki kolonları yaz.
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename='users';
select grantee, privilege_type, column_name from information_schema.column_privileges
where table_name='users' and grantee in ('authenticated','anon') order by grantee, column_name;
```
- **Kabul kriteri:** [x] `role`, `is_active`, `phone_verified`, `merged_into` kolonları `authenticated` için yazılamaz · [x] Profil tamamlama hâlâ çalışıyor
- **Efor:** 3 puan (doğrulama 1 + gerekirse server action'a taşıma 2)
- **Yapıldı:** `app/profil-tamamla/actions.ts` (yeni) — upsert server action'a taşındı,
  kolon beyaz listesi uygulandı. `role`, `is_active`, `phone_verified`, `merged_into`,
  `trust_level` istemciden **yazılamıyor**.
- ⏳ **Bayram:** `public.users.is_active` kolonunun DB default'u makul mü kontrol et —
  istemci artık `is_active: true` göndermiyor.

### R1 · `/auth/reset` recovery oturumu kontrol etmiyor 🟠 *(yeni)* — ✅
- **Dosya:** `app/auth/reset/page.tsx:34` `supabase.auth.updateUser({ password })`
- **Sorun:** Sayfa doğrudan açıldığında (recovery token yokken) form gösteriliyor, submit'te "Linkin süresi dolmuş olabilir" gibi belirsiz hata veriyor. `PASSWORD_RECOVERY` event'i dinlenmiyor.
- **Yapılacak:** `onAuthStateChange` ile `PASSWORD_RECOVERY`/oturum bekle; oturum yoksa "Geçersiz veya süresi dolmuş link" ekranı + "Yeni link iste" butonu.
- **Kabul kriteri:** [x] Tokensız `/auth/reset` → form değil, hata ekranı · [x] Geçerli linkle akış çalışıyor
- **Efor:** 3 puan
- **Yapıldı:** Üç durumlu ekran (`kontrol` / `hazir` / `gecersiz`). `PASSWORD_RECOVERY`
  event'i + PKCE `?code=` takası dinleniyor, 4 sn emniyet supabı var.
- ⚠️ **Asıl bulgu (backlog'da yoktu):** tarayıcıda **normal** bir oturum açıkken
  `updateUser({ password })` **başarıyla** çalışıyordu — yani açık kalmış bir oturuma
  erişen kişi eski şifreyi bilmeden şifreyi değiştirebiliyordu. Form artık yalnız gerçek
  recovery oturumunda gösteriliyor; başarıdan sonra `signOut()` çağrılıyor ki recovery
  oturumu tam yetkili oturuma dönüşmesin.

### C1 · `/cikis` GET ile çalışıyor — prefetch/CSRF ile istemsiz çıkış 🟠 *(yeni)* — ✅
- **Dosya:** `app/cikis/route.ts:5-7`
- **Sorun:** `<a href="/cikis">` link prefetch'i veya üçüncü taraf `<img src="https://yukegel.com/cikis">` kullanıcıyı oturumdan düşürebilir.
- **Yapılacak:** GET handler'ı kaldır, yalnız POST bırak; çıkış butonlarını `<form method="post" action="/cikis">` yap. Origin header kontrolü ekle.
- **Kabul kriteri:** [ ] `GET /cikis` → 405 · [ ] Tüm çıkış butonları hâlâ çalışıyor
- **Efor:** 2 puan · **Not:** Çıkış butonu kullanan tüm sayfaları taramak gerekiyor (`grep -rn "/cikis" app/`)

### A4b · OTP tekrar gönderim cooldown'ı yok 🟠 — ✅
- **Dosya:** `app/giris/page.tsx:104-112` `otpGonder`
- Kullanıcı butona basılı tutup onlarca SMS tetikleyebilir → Twilio maliyeti + kullanıcı spam'i.
- **Yapılacak:** 60 sn geri sayım + buton disable + `sessionStorage`'a son gönderim zamanı.
- **Kabul kriteri:** [x] İkinci gönderim 60 sn boyunca engelli, geri sayım görünüyor
- **Efor:** 2 puan
- **Yapıldı:** Cooldown **sunucuda** — `app/api/ilan/[id]/sahiplen/route.ts` ilan başına
  60 sn (bellek içi `Map`, 429 + `Retry-After`). İstemcideki geri sayım yalnızca görsel
  karşılığı; devtools'la sıfırlansa bile sunucu reddediyor. Sayaç yalnız SMS **gerçekten**
  gittiyse başlıyor — sağlayıcı hatası kullanıcıyı kilitlemesin.
- ⚠️ **Not:** Bellek içi sayaç **tek instance** varsayıyor. Çok instance'a çıkılırsa
  (Vercel/edge ölçeklemesi) Redis'e taşınmalı — G2 ile birlikte değerlendir.

---

## W2 — Güvenlik & gözlemlenebilirlik (15 puan) — ✅ TAMAMLANDI (29 Tem 2026)

> **Ortak altyapı:** `lib/kota.ts` *(yeni)* — kayan pencere sayacı. `kotaDene({ ad, anahtar,
> limit, pencereMs, deger?, sayma? })`, `kotaSifirla(ad, anahtar)`, `istekIp(request)`.
> `deger` verilirse **farklı değer** sayar; `sayma: true` sadece bakar, kaydetmez.
> ⚠️ Sayaçlar process belleğinde: çok instance'ta gerçek limit ≈ (limit × instance),
> deploy/soğuk başlangıç sıfırlar, `x-forwarded-for` doğrudan erişimde taklit edilebilir.
> Bu bir savunma katmanı, tek başına kalkan değil. Trafik artınca `kotaDene`'nin gövdesi
> Vercel KV / Upstash Redis'e taşınır — çağıran taraflar değişmez.

### ✅ G1 · Şifreli girişte rate limit / lockout yok 🟠
- **Uygulandı:** `app/api/auth/giris/route.ts` *(yeni)*. Şifre denemesi **istemciden alındı**;
  `app/giris/page.tsx` (`epostaGiris`) ve `app/moderator-giris/page.tsx` artık bu route'u çağırıyor.
- İki kova: e-posta başına **5 hata / 15 dk**, IP başına **20 hata / 15 dk** (credential stuffing).
  IP limiti bilerek yüksek — NAT arkasındaki dürüst kullanıcılar birbirini kilitlemesin.
- Yalnız **başarısız** denemeler sayılır; başarılı girişte iki kova da `kotaSifirla` ile temizlenir.
  Kilitliyken gelen istek sayaca **yazılmaz** — yoksa saldırgan istek atmaya devam ederek kurbanı
  süresiz kilitli tutabilirdi.
- Kota anahtarı `trim().toLowerCase()` — `Ali@X.com` ile `ali@x.com` aynı kovaya düşsün.
- Hesap sayımına karşı "yanlış şifre" ile "kullanıcı yok" aynı mesajı döndürüyor.
- Oturum cookie'si **sunucuda** yazılıyor (SSR client) → proxy ilk istekte görüyor.
- **Kabul kriteri:** [x] 6. hatalı denemede kilit mesajı · [x] Kilit süresi dolunca açılıyor
- **Not:** `auth_events` üzerinden okunabilirlik `docs/20260728_auth_events.sql` çalıştırılana
  kadar atıl; bellek içi kilit migration'dan bağımsız çalışıyor.

### ✅ G2 · OTP gönderiminde bot koruması yok 🟠
- **Karar:** Turnstile değil, **sunucu tarafı kota** (Bayram, 29 Tem 2026).
- **Uygulandı:** `app/api/auth/otp/route.ts` *(yeni)*. `signInWithOtp` istemciden kaldırıldı —
  ücretli SMS tetikleyicisi herkese açık anon key'in arkasındaydı.
- Üç katman: numara başına 1/60 sn · IP başına **5 farklı numara**/saat · IP başına 15 toplam/saat.
- `app/api/ilan/[id]/sahiplen` **aynı** `'otp-ip-numara'` kovasını paylaşıyor: iki uç nokta
  arasında gidip gelerek kotayı ikiye katlamak mümkün değil.
- Kotalar `sayma: true` ile önce **bakılıyor**, yalnız SMS gerçekten gittiyse işleniyor —
  sağlayıcı hatası kullanıcıyı kilitlemesin.
- **Kabul kriteri:** [x] Aynı IP'den saatte >5 farklı numaraya OTP engelleniyor

### ✅ M2 · Moderatör girişinde rol doğrulaması yok 🟠
- **Uygulandı:** `app/moderator-giris/page.tsx` — giriş route'u `{ rol }` döndürüyor;
  `admin|moderator` değilse `/cikis` POST + `signOut()` ve açıklayıcı mesaj.
  Admin `/admin`'e, moderatör `/moderator`'a gidiyor (eskiden koşulsuz `/moderator`).
- **Not:** Bu bir güvenlik sınırı DEĞİL — sınır `proxy.ts` + `requireStaff()`. Amaç doğru davranış.
- **Kabul kriteri:** [x] Normal kullanıcı burada giriş yapamıyor, açıklayıcı hata alıyor

### ✅ C2 · `/cikis` `sb-` cookie'lerini açıkça temizlemiyor 🟡
- **Zaten C1 ile gelmişti.** `app/cikis/route.ts` `sb-` ile başlayan tüm cookie'leri siliyor.
  Doğrulandı, ek değişiklik gerekmedi.

### ✅ K2b · TCKN/VKN sunucu tarafında yeniden doğrulanmıyor 🟠
- **Uygulandı:** `lib/kimlik.ts` *(yeni)* — `tcknGecerli`/`vknGecerli` TEK KAYNAK.
  `app/profil-tamamla/actions.ts` ve `page.tsx` içindeki iki kopya kaldırıldı, ikisi de import ediyor.
  (Sunucu doğrulaması K2 ile zaten vardı; buradaki iş kopyaların ayrışmasını önlemek.)
- **Kabul kriteri:** [x] Doğrudan PostgREST çağrısıyla geçersiz TCKN yazılamıyor

---

## W3 — SEO & huni (14 puan)

### S1 · `layout.tsx` metadata eksik: metadataBase, OG, Twitter, canonical 🟠 *(yeni)*
- **Dosya:** `app/layout.tsx:22-26` — yalnız `title`, `description`, `icons`
- **Etki:** WhatsApp/Twitter/LinkedIn paylaşımlarında önizleme kartı yok. Nakliye sektöründe paylaşım WhatsApp üzerinden yürüdüğü için bu doğrudan trafik kaybı.
- **Yapılacak:** `metadataBase: new URL(SITE_URL)`, `openGraph` (title/description/images/locale `tr_TR`/type `website`), `twitter: { card: 'summary_large_image' }`, `alternates.canonical`. `/ilan/[id]` için dinamik OG (ayrı ticket).
- **Kabul kriteri:** [ ] WhatsApp'a link atınca kart görünüyor · [ ] `opengraph-image` 1200×630 mevcut
- **Efor:** 3 puan

### S2 · Auth sayfaları indekslenebilir — `noindex` yok 🟡 *(yeni)*
- `/giris`, `/profil-tamamla`, `/moderator-giris`, `/auth/reset` için `robots: { index: false }` metadata yok (client component oldukları için `layout.tsx` veya route segment metadata'sı gerekiyor).
- **Kabul kriteri:** [ ] Bu 4 sayfada `<meta name="robots" content="noindex">`
- **Efor:** 2 puan

### S3 · Sitemap eksik: `/yol-rehberi` ve `/u/[username]` 🟡 *(yeni)*
- **Dosya:** `app/sitemap.ts:29-35`
- Profil sayfaları (`/u/`) robots.txt'te AI crawler'lara açıkça izinli ama sitemap'te yok.
- **Kabul kriteri:** [ ] `/yol-rehberi` statik listede · [ ] Aktif kullanıcı profilleri dinamik listede
- **Efor:** 2 puan

### S4 · robots.txt tutarsız 🟢 *(yeni)*
- **Dosya:** `public/robots.txt`
- ClaudeBot bloğunda `/moderator-giris/` disallow yok (GPTBot'ta var). `User-agent: *` bloğu `Allow: /` diyor — `/panel/`, `/admin/`, `/api/`, `/moderator/` genel crawler'lara açık.
- **Kabul kriteri:** [ ] `*` bloğunda özel alanlar disallow · [ ] Bot blokları birbiriyle tutarlı
- **Efor:** 1 puan

### L2 · İki CTA aynı yere gidiyor, huni ayrışmıyor 🟠
- **Dosya:** `HomeClient.tsx:92` ve `:248` — ikisi de `/ilan-ver`
- Yük veren ve nakliyeci için ayrı değer önerisi var ama tek hedef. Hangi persona'nın dönüştüğü ölçülemiyor.
- **Yapılacak:** `/ilan-ver?tip=yuk` ve `?tip=arac` ile ön-seçim + GA event ayrımı.
- **Efor:** 3 puan

### L3 · "Ara" butonu misafirde auth kapısına çarpıyor 🟡
- **Dosya:** `HomeClient.tsx:318/323`
- Kullanıcı henüz değer görmeden duvara çarpıyor. Öneri: arama sonuçlarını göster, yalnız telefon açılışında giriş iste (L1 zaten bu mimariyi getiriyor).
- **Efor:** 3 puan · **Bağımlılık:** L1

---

## W4 — UX cila (11 puan)

### K3 · `userType` değişince tüm form sıfırlanıyor 🟠
- **Dosya:** `app/profil-tamamla/page.tsx:133-138`
- Kullanıcı "şirket" seçip alanları doldurduktan sonra "broker"a geçerse her şey siliniyor — ortak alanlar (TCKN dahil) dahil. Yanlış tıklama = baştan.
- **Yapılacak:** Yalnız o tipe özgü alanları sıfırla; TCKN/telefon/ad gibi ortak alanları koru.
- **Efor:** 2 puan

### R2 · Şifre güç göstergesi 3 kriter gösteriyor, doğrulama 1 kriter uyguluyor 🟡 *(yeni)*
- **Dosya:** `app/auth/reset/page.tsx:30` (`length >= 8`) vs `:74` (uzunluk + rakam + büyük harf çubukları); `app/giris/page.tsx:258` + `:497` aynı tutarsızlık
- Kullanıcıya 3 çubuk gösterip 1 tanesini zorunlu kılmak kafa karıştırıcı. Ya hepsini zorunlu yap ya da göstergeyi "öneri" olarak etiketle.
- **Efor:** 2 puan

### F1 · Footer "Kayıt Ol" doğrudan giriş moduna düşüyor 🟢 *(yeni)*
- **Dosya:** `app/_components/Footer.tsx:29` — `/giris` (mod param yok, `:28` ile birebir aynı link)
- **Yapılacak:** `/giris?mod=kayit` + `giris/page.tsx`'te param okuma.
- **Efor:** 1 puan

### F2 · Footer ve landing linkleri `<a>` — tam sayfa yenilemesi 🟢 *(yeni)*
- **Dosya:** `Footer.tsx:20-37` (7 link)
- `next/link` kullanılmadığı için her tıklamada tam navigasyon; ISR avantajı ve client state kayboluyor.
- **Efor:** 1 puan

### L4 · Landing sayaç ve `.limit()` değerleri tutarsız 🟢
- `page.tsx` 200, `HomeClient.tsx:453` 30, sayaç (`:625`) toplam aktif ilan. Kullanıcı "1.240 ilan" görüp 30 tane listeleniyor.
- **Efor:** 2 puan

### L5 · Sekme state'i URL'e yansımıyor 🟢
- **Dosya:** `HomeClient.tsx:374` `useState<'yuk'|'arac'>('yuk')`
- Paylaşılan link her zaman "yük" sekmesinde açılıyor; geri tuşu sekme değişimini bilmiyor.
- **Efor:** 2 puan

### A5 · Hata mesajları jenerik 🟢
- Supabase hataları tek bir "E-posta veya şifre hatalı" metnine indirgeniyor; "e-posta doğrulanmamış" ayrı ele alınmalı.
- **Efor:** 1 puan

### A6 · `dogrulama_bekle` modunda tekrar gönderme yok 🟢
- E-posta gelmezse kullanıcı sıkışıyor.
- **Efor:** 2 puan

---

## Bayram'ın yapması gerekenler (kod dışı)

### 🔴 DEPLOY'DAN ÖNCE — Supabase SQL Editor
1. **K1b:** `docs/20260728_kvkk_onay.sql`
   Bu kolon açılmadan profil-tamamla formu `kvkk_onay_at` yazamaz → upsert hata verir.
2. **A1b:** `docs/20260728_auth_events.sql`
   Tablo yoksa `/api/auth/log` her çağrıda ERROR loglar (akışı bloklamaz ama log dolar).

### 🔴 DEPLOY'DAN SONRA — Supabase SQL Editor
3. **L1e:** `docs/20260728_contact_phone_revoke.sql`
   ⚠️ **Sıra önemli.** Kod deploy edilmeden çalıştırırsan panel ve moderatör ekranı
   telefonu yazamaz. Dosyanın sonunda 5 adımlık duman testi ve geri alma bloğu var.

### Kontrol / karar
4. **K2 — `users.is_active` default'u:** İstemci artık `is_active: true` göndermiyor.
   `select column_default from information_schema.columns where table_name='users' and column_name='is_active';`
   → `true` değilse yeni kayıtlar pasif açılır.
5. ~~**A4 — Twilio Console:** Code Length kaç hane?~~ ✅ **4 hane, çalışıyor** (28 Tem 2026).
   Bu bilgi `sahiplen` sayfasındaki 6-hane bug'ını (A4b-hane) ortaya çıkardı.
6. **S1 — Görsel:** 1200×630 OG görseli (logo + "Türkiye'nin Nakliye İlan Platformu")
7. ~~**G2 — Karar:** Turnstile mi kota mı?~~ ✅ **Sunucu tarafı kota seçildi** (Bayram, 29 Tem 2026).
   Uygulandı: `lib/kota.ts` + `/api/auth/otp`. Turnstile ileride ek katman olarak eklenebilir.

---

## Değiştirilmemesi gerekenler

Analizde doğru kurgulanmış bulunan ve regresyon riski taşıyan noktalar:

1. `giris/page.tsx` — `INITIAL_SESSION` event'ine bağlanma (magic-link hash'i bu event'ten önce tüketiliyor)
2. ~~`proxy.ts:94-98` — merge edilmiş oturumda `sb-` cookie silme~~ **GEÇERSİZ (A10, 29 Tem 2026).**
   Cookie silmek döngüyü çözmedi, yerini değiştirdi: kullanıcı aynı emekli kimlikle geri gelince
   yine aynı satıra düşüyordu. Artık `/auth/devir` oturumu **sunucuda** devrediyor
   (`hashed_token` + `verifyOtp`) ve proxy cookie SİLMİYOR — devir onları okumak zorunda.
   Uyarının geçerli kalan kısmı: magic-link **`action_link`**'ini (implicit flow) sunucu tarafı
   akışta ASLA kullanma; döngüyü o geri getirir.
3. `giris/page.tsx:114-216` — 4 formatlı telefon eşleştirme (`+90…`, `90…`, `0…`, `5…`)
4. `api/auth/tekil-kontrol` — service-role ile yalnız `{ mevcut: boolean }` dönmesi (enumeration'a kapalı)
5. `profil-tamamla` — TCKN/VKN algoritmik doğrulama. K2b bunu **kaldırmadı**, `lib/kimlik.ts`
   ortak modülüne taşıdı; istemci ve sunucu aynı fonksiyonu import ediyor. İstemcideki kontrol
   yalnız UX — sunucudakini ASLA kaldırma.
6. Her yerde `maybeSingle()` kullanımı — `single()`'ın 0 satırda patlamasını eler
7. **(W0 sonrası eklendi)** `app/page.tsx`'in ISR'li (`revalidate = 30`) olması — bu sayfada
   oturuma göre koşullu render **yapılamaz**. Hassas veriyi "misafirse gizle" ile değil,
   payload'dan tamamen çıkararak çöz. `/ilan/[id]` `cookies()` kullandığı için dinamik;
   orada koşullu render güvenli. İkisini karıştırma.
8. **(W0 sonrası eklendi)** `proxy.ts`'teki `korunmaliMi()` — segment sınırında eşleştirme.
   Düz `startsWith`'e geri dönme; `/moderator-giris`, `/profil-tamamla` gibi kardeş rotalar
   yanlışlıkla kilitleniyor.
9. **(W1 sonrası eklendi)** `app/panel/actions.ts` ve `app/profil-tamamla/actions.ts`
   içindeki **kolon beyaz listeleri**. Bunlara alan eklemek = yetki yükseltme açığı açmak.
   `user_id`, `role`, `trust_level`, `moderation_status`, `is_shadow_banned`, `status`,
   `phone_verified`, `merged_into` **asla** eklenmemeli.
10. **(W1 sonrası eklendi)** `app/panel/IlanYonetim.tsx` ve `app/moderator/page.tsx`'e
   `contact_phone` geri **eklenmemeli**. Kolon yetkisi anon/authenticated'dan revoke edildi;
   istemciden okuma/yazma denemesi `42501 permission denied` döner.
11. **(W1 sonrası eklendi)** `app/auth/reset/page.tsx`'teki durum makinesi. Formu koşulsuz
   göstermeye dönme: normal (recovery olmayan) bir oturum varken `updateUser({password})`
   **çalışıyor** — eski şifre sorulmadan.
