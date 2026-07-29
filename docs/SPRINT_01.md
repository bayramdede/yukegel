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
| **W3** ✅ | SEO & huni | S1, S2, S3, S4, L2, L3 (+`lib/analiz.ts`, `opengraph-image.tsx`) | 14 | Trafik ve dönüşüm |
| **W4** ✅ | UX cila | K3, L4, L5, A5, A6, R2, F1, F2 (+`lib/sifre.ts`, `lib/ilan-liste.ts`, `api/auth/dogrulama-tekrar`) | 11 | Küçük ama görünür |
| **W5** 📋 | Veri bütünlüğü (alias) | D1, D2, D3, D4, D5 | 13 | **Şu an aktif hasar veriyor** — ilan verisi bozuk kaydediliyor |

> **W5 kapsam notu:** SPRINT_01'in özgün kapsamı landing/kayıt/giriş idi ve o kısım W0–W4
> ile **bitti**. W5 bilinçli bir kapsam genişletmesi: `aliases` tablosundaki bozulma
> auth'a değil, ürünün ana verisine (`listings`) dokunuyor ve her yeni ilanda büyüyor.
> Ayrı bir sprint açmak yerine buraya eklendi çünkü bulgular W0–W4 sırasında çıktı.

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

### K1b · Migration: `users.kvkk_onay_at` 🔴 — ✅ çalıştırıldı (Bayram, 29 Tem 2026)
- Dosya: **`docs/20260728_kvkk_onay.sql`** → Supabase SQL Editor. Idempotent
  (`add column if not exists`), tekrar çalıştırmak zararsız.
- Bu kolon açılmadan K1 kodu upsert'te hata verirdi. **Deploy'dan önce** çalışması gerekiyordu.
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
> 3. ~~`docs/20260728_contact_phone_revoke.sql`~~ ✅ çalıştırıldı (29 Tem 2026,
>    doğrulama select'i 0 satır döndü) — **duman testi geçti**, kırık yol yok.
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

### A1b · Migration + RLS: `auth_events` tablosu — ✅ *(çalıştırıldı, Bayram, 29 Tem 2026)*
- Insert yalnız service-role; select yalnız admin/moderator.
- **Efor:** 2 puan
- **Yapıldı:** `docs/20260728_auth_events.sql`. **Deploy'dan ÖNCE** çalışması gerekiyordu;
  idempotent (`create table if not exists`), tekrar çalıştırmak zararsız.

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
- ✅ **Bayram doğruladı** (29 Tem 2026): `public.users.is_active` default `true`, kolon
  nullable, NULL satır sayısı 0 → istemci artık `is_active: true` göndermese de sorun yok.
  Opsiyonel sertleştirme: `alter table public.users alter column is_active set not null;`
  (Nullable kaldığı sürece `.eq('is_active', true)` NULL satırları sessizce atlar.)

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
- **Gözlemlenebilirlik:** `docs/20260728_auth_events.sql` ✅ çalıştırıldı (29 Tem 2026), yani
  `login_failed` olayları gerçekten birikiyor. Kilit tetiklendiğinde ayrıca
  `structuredLog('WARN','auth','Giriş kilidi …')` düşer.

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

## W3 — SEO & huni (14 puan) — ✅ TAMAMLANDI (29 Tem 2026)

> **Doğrulama:** `npx tsc --noEmit` temiz. Eslint: yeni dosyaların (`lib/analiz.ts`,
> `app/opengraph-image.tsx`, 4 adet `layout.tsx`, `app/sitemap.ts`) **hiç bulgusu yok**.
> `app/ilan-ver/page.tsx`'te tek yeni bulgu `react-hooks/set-state-in-effect` (satır 123) —
> depoda bu kuraldan zaten 18 ihlal var ve alternatifi (lazy `useState` içinde `window`
> okumak) SSR hidrasyon uyuşmazlığı üretirdi; bilinçli bırakıldı.
> `next build` bu ortamda çalışmıyor; OG kartı ve robots çıktısı canlıda göz kontrolü ister.

### S1 · `layout.tsx` metadata eksik: metadataBase, OG, Twitter, canonical 🟠 ✅
- **Dosya:** `app/layout.tsx:22-26` — yalnız `title`, `description`, `icons`
- **Etki:** WhatsApp/Twitter/LinkedIn paylaşımlarında önizleme kartı yok. Nakliye sektöründe paylaşım WhatsApp üzerinden yürüdüğü için bu doğrudan trafik kaybı.
- **Yapılacak:** `metadataBase: new URL(SITE_URL)`, `openGraph` (title/description/images/locale `tr_TR`/type `website`), `twitter: { card: 'summary_large_image' }`, `alternates.canonical`. `/ilan/[id]` için dinamik OG (ayrı ticket).
- **Kabul kriteri:** [x] `opengraph-image` 1200×630 mevcut · [ ] WhatsApp'a link atınca kart görünüyor *(canlıda göz kontrolü — deploy sonrası)*
- **Efor:** 3 puan
- **Yapıldı:** `app/layout.tsx`'e `metadataBase`, `alternates.canonical: '/'`, `openGraph` (`type: 'website'`, `locale: 'tr_TR'`, `siteName`, `url`), `twitter: { card: 'summary_large_image' }` eklendi.
- **Kart görseli (29 Tem 2026, güncellendi):** Bayram gerçek tasarımı verdi → `app/opengraph-image.jpg` + `app/opengraph-image.alt.txt`. Geçici `next/og` üreteci (`opengraph-image.tsx`) **silindi** — aynı segmentte iki og dosyası bulunamaz. Kaynak 2848×1504 PNG (4,5 MB); merkezden kırpılıp 1200×630'a indirildi, JPEG q95 → **134 KB**.
- ⚠️ **Neden PNG değil JPEG:** aynı kadraj PNG olarak 650 KB ediyordu; WhatsApp büyük görsellerde kartı **sessizce göstermiyor**. Metin keskinliği q95'te kontrol edildi, bozulma yok.
- ⚠️ Karttaki "519 aktif ilan" ve "BETA" **donmuş** metin. Sayı gerçek zamanlı değil; rakam anlamsızlaşınca ya da beta bitince görsel elle yenilenmeli.
- 🚨 **`metadataBase` OLMADAN** Next göreli OG/canonical URL'lerini SESSİZCE üretmez — paylaşım kartının hiç görünmemesinin en sık sebebi budur.
- 🚨 **`openGraph.images` BİLEREK yazılmadı:** `opengraph-image.tsx` dosya konvansiyonu `og:image`'ı kendisi ekliyor; iki kaynak olursa hangisinin kazandığı sürüme bağlı.
- ⚠️ `SITE_URL` fallback'i `sitemap.ts` ile **birebir aynı** olmalı; ayrışırlarsa sitemap bir alan adını, canonical başkasını gösterir ve Google ikisini ayrı site sanar.
- ⏭️ `/ilan/[id]` için dinamik OG + kendi `alternates.canonical`'ı hâlâ AÇIK (ayrı ticket) — Next alt sayfalara canonical'ı **miras bırakmaz**.

### S2 · Auth sayfaları indekslenebilir — `noindex` yok 🟡 ✅
- `/giris`, `/profil-tamamla`, `/moderator-giris`, `/auth/reset` için `robots: { index: false }` metadata yok (client component oldukları için `layout.tsx` veya route segment metadata'sı gerekiyor).
- **Kabul kriteri:** [x] Bu 4 sayfada `<meta name="robots" content="noindex">`
- **Efor:** 2 puan
- **Yapıldı:** `app/giris/layout.tsx`, `app/moderator-giris/layout.tsx`, `app/profil-tamamla/layout.tsx`, `app/auth/layout.tsx` eklendi.
- 🚨 **`'use client'` sayfası `metadata` EXPORT EDEMEZ** — Next bunu hata vermeden yok sayar. Tek çözüm aynı segmentte sunucu tarafı `layout.tsx`.
- **Neden `/auth/reset` yerine segment seviyesi (`app/auth/layout.tsx`):** `callback`, `devir`, `reset` ve gelecekteki tüm `/auth/*` rotaları otomatik miras alsın diye. Sayfa başına yazsaydık S4'te robots.txt'te yaşadığımız "listeler zamanla ayrışır" sorununu yeniden üretirdik.
- `follow` farkı bilinçli: `/giris` → `follow: true` (sayfadaki genel linkler taransın), diğer üçü → `follow: false` (URL'ler tek kullanımlık token taşıyor).
- ⏭️ Açık kalan (isteğe bağlı): `/panel` ve `/araclarim`'da da `noindex` yok. robots.txt disallow'u var ve içerik zaten auth arkasında, o yüzden düşük öncelik.

### S3 · Sitemap eksik: `/yol-rehberi` ve `/u/[username]` 🟡 ✅
- **Dosya:** `app/sitemap.ts`
- Profil sayfaları (`/u/`) robots.txt'te AI crawler'lara açıkça izinli ama sitemap'te yok.
- **Kabul kriteri:** [x] `/yol-rehberi` statik listede · [x] Aktif kullanıcı profilleri dinamik listede
- **Efor:** 2 puan
- 🚨 **`/u/[username]` KLASÖR ADI YANILTICI: param `username` DEĞİL, kullanıcı `id`'si.** Sayfa `.eq('id', userId)` yapıyor, panel linki `/u/${userId}` üretiyor, `users.username` routing'de hiç kullanılmıyor. Sitemap'e `username` yazsaydık toptan 404 basardık.
- **Neden `users` taranmadı:** ilanı olmayan yüzlerce boş profil "thin content" sayılır ve sitemap'in tamamına olan güveni düşürür. Profil URL'leri zaten çekilmiş aktif ilan listesinden türetiliyor → dolu sayfa garantisi, ek sorgu maliyeti sıfır.
- `user_id` NULL olabilir (WhatsApp/Excel içe aktarımı) — bu satırlar profil listesine girmiyor. `lastModified` = kullanıcının en yeni ilanının tarihi.

### S4 · robots.txt tutarsız 🟢 ✅
- **Dosya:** `public/robots.txt`
- ClaudeBot bloğunda `/moderator-giris/` disallow yok (GPTBot'ta var). `User-agent: *` bloğu `Allow: /` diyor — `/panel/`, `/admin/`, `/api/`, `/moderator/` genel crawler'lara açık.
- **Kabul kriteri:** [x] `*` bloğunda özel alanlar disallow · [x] Bot blokları birbiriyle tutarlı
- **Efor:** 1 puan
- 🚨 **İsimli blok, `*` bloğunun YERİNE GEÇER — birleşmez.** GoogleBot/GPTBot/ClaudeBot kendi adını görünce `User-agent: *` bloğunu TAMAMEN yok sayar. Bu yüzden disallow listesi dört blokta da **birebir tekrar edilmek zorunda**; ayrışırlarsa bu bir hatadır.
- ⚠️ robots.txt bir güvenlik sınırı değil; asıl sınır `proxy.ts` + `requireStaff()` + RLS. Amaç indekslenmeme + crawler bütçesi.
- GPTBot/ClaudeBot'a `/ilan/`, `/u/`, `/yol-rehberi` bilinçli AÇIK: L1/L1c/L1f'ten sonra bu sayfalarda telefon yok, LLM'lerin Yükegel'i bilmesi işimize geliyor.

### L2 · İki CTA aynı yere gidiyor, huni ayrışmıyor 🟠 ✅
- **Dosya:** `HomeClient.tsx` + `app/ilan-ver/page.tsx`
- Yük veren ve nakliyeci için ayrı değer önerisi var ama tek hedef. Hangi persona'nın dönüştüğü ölçülemiyor.
- **Efor:** 3 puan
- **Yapıldı:** `lib/analiz.ts` (`olayGonder`) eklendi; `/ilan-ver` artık `?tip=` param'ını okuyup formu ön-seçiyor ve `ilan_ver_giris` / `ilan_olustur` olaylarını gönderiyor. HomeClient'taki üç "ilan ver" CTA'sı `?tip=yuk`'a bağlandı.
- 🚨 **Bulunan sessiz hata:** `HomeClient.tsx` zaten bir yerde `/ilan-ver?tip=arac` linki veriyordu ama sayfa param'ı **hiç okumuyordu** — link aylardır etkisizdi.
- 🚨 **İkinci bulunan hata:** `/ilan-ver` misafiri sabit `/giris?redirect=/ilan-ver`'e atıyordu; `?tip=` giriş turunda **kayboluyordu**. Artık `window.location.search` ekleniyor (`lib/redirect.ts`'teki `guvenliRedirect` query string'i zaten koruyor).
- ⚠️ `useSearchParams` yerine `useEffect` içinde `window.location.search` bilinçli: bu sayfa Suspense sınırında değil, `useSearchParams` tüm ağacı CSR bailout'a sokardı.
- ⚠️ Header'daki "+ İlan Ver" bilerek düz `/ilan-ver` bırakıldı — oradaki kullanıcının persona'sı bilinmiyor, uydurmak ölçümü kirletirdi.
- ⚠️ `lib/analiz.ts`: **GA'ya asla kişisel veri gitmez** (telefon, e-posta, TCKN/VKN, ad). KVKK gereği — GA verisi yurt dışına çıkar.

### L3 · "Ara" butonu misafirde auth kapısına çarpıyor 🟡 ✅
- **Dosya:** `HomeClient.tsx`
- **Efor:** 3 puan · **Bağımlılık:** L1
- 🚨 **Ticket'ın öncülü kısmen yanlıştı:** arama sonuçları misafire ZATEN açıktı — filtreleme, sunucudan gelen listenin üzerinde istemci tarafında çalışıyor. Duvar yalnız NUMARADA ve bu bilinçli (L1).
- **Gerçek kusur:** misafirin `🔐 Ara` butonu düz `/giris`'e atıyordu. Kullanıcı giriş yapıp ANA SAYFAYA düşüyor, baktığı ilanı akan listede yeniden bulmak zorunda kalıyor — çoğu zaman bulamıyordu.
- **Yapıldı:** buton artık `/giris?redirect=/ilan/{id}`'e gidiyor (aynı dosyadaki `araTikla` 401 dalının hedefiyle birebir aynı) ve `telefon_giris_duvari` olayını gönderiyor.

---

## W4 — UX cila (11 puan) — ✅ TAMAMLANDI (29 Tem 2026)

> **Doğrulama:** `npx tsc --noEmit -p tsconfig.json` **temiz**. Eslint: yeni dosyaların
> (`lib/sifre.ts`, `lib/ilan-liste.ts`, `app/api/auth/dogrulama-tekrar/route.ts`) **hiç
> bulgusu yok**; `Footer.tsx` de artık tamamen temiz. Değiştirilen üç büyük dosyada bulgu
> sayısı HEAD ile birebir karşılaştırıldı: `HomeClient.tsx` 21→21, `giris/page.tsx` 7→7,
> `profil-tamamla/page.tsx` 9→8. Yani **yeni ihlal yok**.
> Tek bilinçli susturma: L5'in mount effect'indeki `react-hooks/set-state-in-effect`
> (gerekçe kodda yazılı — alternatifi hidrasyon uyuşmazlığı).
> `next build` bu ortamda çalışmıyor; sekme/URL davranışı ve doğrulama e-postası canlıda
> göz kontrolü ister.
>
> Uygulama sonrası bağımsız bir inceleme ajanı çalıştırıldı; **3 gerçek hata + 3 yorum-kod
> uyuşmazlığı** buldu ve **hepsi bu dalgada kapatıldı** (aşağıda ilgili ticket'ların altında
> "İnceleme bulgusu" olarak işaretli).

### K3 · `userType` değişince tüm form sıfırlanıyor 🟠 ✅
- **Dosya:** `app/profil-tamamla/page.tsx`
- Kullanıcı "şirket" seçip alanları doldurduktan sonra "broker"a geçerse her şey siliniyor — ortak alanlar (TCKN dahil) dahil. Yanlış tıklama = baştan.
- **Efor:** 2 puan
- **Yapıldı:** `ALAN_GORUNUR` haritası + `tipDegistir()` fonksiyonu. Yalnız YENİ tipte GÖRÜNMEYEN alanlar temizlenir; ad, telefon ve KVKK onayı asla sıfırlanmaz.
- 🚨 **Neden effect değil fonksiyon:** "tip değişti" bir kullanıcı olayı, türetilmiş state değil. Effect'e bağlamak mount'ta da tetikleniyordu.
- 🚨 **Görünmeyen alan MUTLAKA temizlenmeli:** `handleSubmit` `sirketAdi: sirketAdi || undefined` gönderiyor ve `actions.ts:135` `company_name`'i **tipten bağımsız** yazıyor. Yani ekranda olmayan veri sessizce kaydediliyordu. `ALAN_GORUNUR` ile JSX koşulları **eşleşmek zorunda** — biri değişirse diğeri de değişmeli.
- 🚨 **İnceleme bulgusu — asenkron blur yarışı (düzeltildi).** Tip butonuna tıklamak açık TCKN/VKN alanını ÖNCE blur ediyor (mousedown → blur → click). Sıra: blur fetch'i başlar → `tipDegistir` `tcknMevcut`'u false yapar → fetch döner ve `setTcknMevcut(true)` yazar. Sonuç: `kimlikGecerli()` kalıcı false, "Kaydet" pasif, **uyarı metni de görünmüyor** (TCKN bloğu `sirket` tipinde gizli) — sebebi görünmeyen sessiz çıkmaz. Çözüm: `tipEpoch` ref sayacı; uçuştaki istek dönüşte epoch'u doğrulamazsa sonucunu yazmadan düşer. Spinner yine de kapatılır, yoksa sonsuz "Kontrol ediliyor" kalırdı.

### R2 · Şifre güç göstergesi 3 kriter gösteriyor, doğrulama 1 kriter uyguluyor 🟡 ✅
- **Dosya:** `app/auth/reset/page.tsx` + `app/giris/page.tsx`
- Kullanıcıya 3 çubuk gösterip 1 tanesini zorunlu kılmak kafa karıştırıcı.
- **Efor:** 2 puan
- **Yapıldı:** Kural **tek kaynağa** taşındı → `lib/sifre.ts` (`SIFRE_MIN`, `sifreKriterleri`, `sifreHatasi`, `SIFRE_KURAL_METNI`). Hem gösterge hem kapı aynı fonksiyondan besleniyor; bir daha ayrışamazlar.
- 🚨 **TÜRKÇE TUZAĞI: `/[A-Z]/` YANLIŞ.** "Şifre123" ve "Ölçü1234" geçerli parolalar ama `[A-Z]` bunları "büyük harf yok" diye reddeder. `\p{Lu}` + `/u` bayrağı Ç, Ğ, İ, Ö, Ş, Ü dahil hepsini kapsar. Ticket'ı düz uygulasaydık bu hatayı "düzeltme" olarak kalıcılaştırırdık.
- ⚠️ **`epostaGiris` BİLEREK kapıya bağlanmadı.** Yeni kural yalnız kayıt ve şifre sıfırlamada geçerli; mevcut zayıf parolalı kullanıcılar kilitlenmesin.
- ⚠️ İstemci doğrulaması **güvenlik değil UX**. Asıl zorunluluk Supabase Dashboard → Authentication → Policies → Password Requirements'ta ayarlanmalı (Bayram listesinde).

### F1 · Footer "Kayıt Ol" doğrudan giriş moduna düşüyor 🟢 ✅
- **Dosya:** `app/_components/Footer.tsx` + `app/giris/page.tsx`
- **Efor:** 1 puan
- **Yapıldı:** Link `/giris?mod=kayit`; `giris/page.tsx` param'ı okuyup **hem `mod` hem `sekme`**'yi kuruyor.
- 🚨 **Yalnız `mod`'u kurmak ETKİSİZ olurdu:** kayıt formunun render koşulu `sekme === 'eposta' && mod === 'kayit'`. Tek başına `setMod('kayit')` sessiz bir no-op olarak ship edilirdi.
- ⚠️ `mergeUserId` **önceliklidir** — hesap birleştirme akışındaki kullanıcı `?mod=kayit` ile kayıt formuna düşürülmemeli.
- 🚨 **İnceleme bulgusu (düzeltildi):** sekme butonları koşulsuz `setMod('giris')` çağırıyordu; `?mod=kayit` ile gelen kullanıcı zaten aktif olan "E-posta" sekmesine bir kez daha tıklayınca sessizce giriş formuna düşüyordu. Artık aktif sekmeye tıklamak erken dönüyor.

### F2 · Footer ve landing linkleri `<a>` — tam sayfa yenilemesi 🟢 ✅
- **Dosya:** `Footer.tsx` (8 link)
- **Efor:** 1 puan
- **Yapıldı:** Hepsi `next/link`'e çevrildi, ortak `bag` stil nesnesiyle. `@next/next/no-html-link-for-pages` bulgusu kalktı; ayrıca mevcut `react/no-unescaped-entities` (`Türkiye'nin`) fırsattan istifade düzeltildi. Dosya artık **sıfır bulgu**.

### L4 · Landing sayaç ve `.limit()` değerleri tutarsız 🟢 ✅
- **Dosya:** `app/page.tsx`, `app/_components/HomeClient.tsx`, yeni `lib/ilan-liste.ts`
- **Efor:** 2 puan
- **Yapıldı (iki ayrı kusur):** (1) SSR `.limit(200)` ile istemci yenileme sorgusunun `.limit(30)`'u ayrışmıştı — "yenile"ye basan kullanıcının listesi **kısalıyordu**. Tek sabit `ILAN_LIMITI` (`lib/ilan-liste.ts`) ile ikisi birleştirildi. (2) Sayaç `totalCount` (platform geneli, iki sekme dahil, kırpma öncesi) yazıyordu; artık **ekrandakini** sayıyor.
- ⚠️ `lib/ilan-liste.ts` istemci paketine giriyor — içine sunucuya özel hiçbir şey konulamaz.
- 🚨 **İnceleme bulgusu (düzeltildi):** ilk sayaç metni filtre açıkken "en yeni" ön ekini **düşürüyordu**. Oysa filtre bu 200'lük pencerenin İÇİNDE, istemcide çalışıyor — sunucuya gitmiyor. "12 yük ilanı" demek aramanın tüm platformu taradığı izlenimi verirdi; L4'ün kapatmak istediği yanlış beyanın ta kendisi. Artık ön ek filtreden bağımsız.
- ⚠️ **Kırpma ölçüsü `ilanlar.length`, `filtered.length` değil** ve **bilerek sekmeden bağımsız**: 200'lük pencere `created_at`e göre kesiliyor, tipe göre değil. Araç sekmesinde 3 kart görünse bile pencerenin dışında kalmış araç ilanları olabilir; per-tip saymak yanlış güven verirdi.
- ⚠️ Platform toplamı hâlâ hero rozetinde — orası pazarlama bağlamı, liste iddiası değil.

### L5 · Sekme state'i URL'e yansımıyor 🟢 ✅
- **Dosya:** `HomeClient.tsx`
- **Efor:** 2 puan
- **Yapıldı:** `urldenTip()` + mount effect + `popstate` dinleyicisi + `tipDegistir()`.
- 🚨 **`pushState` TEK BAŞINA BOZUK:** geri tuşu URL'i değiştirir ama React state'ini değiştirmez. `popstate` dinleyicisi **zorunlu**, opsiyonel değil.
- 🚨 **`useSearchParams` KULLANILAMAZ:** Suspense sınırı olmadan tüm ağacı CSR bailout'a sokar ve bu sayfa ISR'li (`revalidate = 30`) — ISR'ı öldürürdü.
- ⚠️ **`router.push` değil `history.pushState`:** `router.push` sunucudan RSC payload'ı çeker, ISR sayfasını yeniden ister. Sekme tamamen istemci tarafı bir filtre.
- ⚠️ Varsayılan (`yuk`) için parametre **silinir** — aynı liste için iki URL olmasın (yinelenen içerik).
- ⚠️ Mount effect'teki `setTip` bilinçli: SSR HTML'i varsayılan sekmeyle üretilmek zorunda, lazy initializer içinde `window` okumak hidrasyon uyuşmazlığı üretirdi. Eslint kuralı gerekçesiyle susturuldu.
- 🚨 **İnceleme bulgusu (düzeltildi):** `?tip=abc` sessizce varsayılana düşüyor ama **adres çubuğunda kalıyordu** — kullanıcı geçerli bir filtre uyguladığını sanıp o linki paylaşıyordu. Artık mount'ta `replaceState` ile temizleniyor (`?tip=yuk` de dahil; normalizasyon geçmişe kayıt bırakmamalı).

### A5 · Hata mesajları jenerik 🟢 ✅
- **Dosya:** `app/api/auth/giris/route.ts` + `app/giris/page.tsx`
- **Efor:** 1 puan
- **Yapıldı:** Route 401 gövdesine makine okunur `kod` eklendi (`eposta_dogrulanmamis` | `kimlik_hatali`); istemci bu koda bakıp kullanıcıyı kırmızı hata satırı yerine `dogrulama_bekle` ekranına geçiriyor.
- 🚨 **Türkçe METNE göre dallanmak kırılgan** — metin değişince dal sessizce ölür. Bu yüzden kod.
- ⚠️ **Hesap sayımı zayıflamadı:** GoTrue password grant'ta şifre, `Email not confirmed` kontrolünden ÖNCE doğrulanıyor. Yani bu ayrımı görmek için zaten doğru şifreyi bilmek gerekiyor.
- ⚠️ Bu dalda cooldown sayacı 0'a kurulur: e-posta az önce GÖNDERİLMEDİ ve kullanıcıların çoğu buraya kayıttan saatler sonra düşer. Kayıttan hemen sonra gelen azınlık sunucudaki 60 sn'lik adres kotasından 429 alır; istemci yanıttaki `bekle` ile sayacı kurar. Bir fazladan istek karşılığında çoğunluk gereksiz beklemez.

### A6 · `dogrulama_bekle` modunda tekrar gönderme yok 🟢 ✅
- **Dosya:** yeni `app/api/auth/dogrulama-tekrar/route.ts` + `app/giris/page.tsx`
- **Efor:** 2 puan
- **Yapıldı:** Origin (CSRF) kontrolü + e-posta normalizasyonu + üç kota kovası + `supabase.auth.resend()`. İstemcide geri sayımlı "tekrar gönder" butonu; ekran metni `dogrulamaSebep`'e göre (kayıt / giriş) değişiyor.
- 🚨 **Neden sunucuda:** `resend()` istemciden de çağrılabilir, ama o zaman anon key ile döngü yazan biri istediği adrese sınırsız e-posta attırabilir (mail bombing). Kotalar: adres başına 60 sn, IP başına saatte 5 **farklı** adres, IP başına saatte 10 toplam.
- 🚨 **`emailRedirectTo` VERİLMEZSE** Supabase kendi "Site URL"ine düşer, kullanıcı `/auth/callback` yerine ana sayfaya çıkar ve oturum takası **hiç yapılmaz** — "linke tıkladım ama giremiyorum". `request.url` kullanılmıyor: Vercel'de proxy arkasındaki iç adres olabilir.
- ⚠️ **Yanıt daima aynı**, adres kayıtlı olsa da olmasa da. Aksi halde endpoint "bu e-posta sistemde var mı?" sorusuna ücretsiz cevap makinesi olur.
- 🚨 **İnceleme bulgusu (düzeltildi — yorum yalanı):** yorum "sayaçlar yalnız başarılı gönderimden sonra işlenir" diyordu ama kod **her durumda** işliyor. Kod doğru, yorum yanlıştı → yorum düzeltildi. Bu, `otp/route.ts`'ten **bilinçli bir ayrılık**: oradaki "hata"lar sağlayıcı arızası, buradakilerin çoğu "böyle adres yok / zaten doğrulanmış" — yani saldırganın aradığı bilginin ta kendisi. Saymazsak o yol bedava olurdu. Bedeli: geçici sağlayıcı arızasında kullanıcı 60 sn bekler.
- ⚠️ İki fazlı kota muhasebesi (`sayma: true` ile bak, sonra işle) burada da geçerli: kilitliyken gelen istekler kilidi **uzatmamalı**, yoksa saldırgan kurbanı süresiz kilitli tutabilir.

---

## W5 — Veri bütünlüğü / alias (13 puan) — 📋 PLANLANDI (29 Tem 2026)

> **Neden bu dalga:** W0–W4 auth ve landing'i düzeltti. Bu dalga ürünün **ana verisini**
> düzeltiyor. Fark şu: auth bug'ları kullanıcıyı engelliyordu, bu bug **sessizce yanlış
> veri üretiyor** — hiç kimse hata görmüyor, ilanlar yanlış şehirle kaydediliyor ve her
> yeni ilanda hasar büyüyor.

### Zincirin tamamı — önce bunu anla

Tek bir kök sorun var, üç yerde birden zarar veriyor:

1. **`aliases.normalized` kolonunda aynı şehir iki farklı yazımla duruyor:**
   `Istanbul` (13 satır) ve `İstanbul` (154 satır). Aynısı `Izmir`/`İzmir`,
   `Mugla`/`Muğla`, `Bingol`/`Bingöl`.
2. **`findPlaces` bunları iki ayrı şehir sayıyor** (`index.ts:279` — `seen` kümesi ham
   `normalized` değeriyle anahtarlanıyor). İçinde hem `avcilar` (→`Istanbul`) hem
   `kadıköy` (→`İstanbul`) geçen bir mesaj **iki şehir bulmuş** oluyor.
3. **Sahte güzergâh üretiliyor:** `index.ts:619`'daki `sameCity` koruması string
   eşitliğine bakıyor; `'Istanbul' !== 'İstanbul'` olduğu için koruma devreye girmiyor
   ve **İstanbul→İstanbul** diye bir ilan kaydediliyor.

Buna ek olarak şehir filtresi `Istanbul` ve `İstanbul`'u iki ayrı şehir sayar — yani
kullanıcı İstanbul filtresi uyguladığında ilanların bir kısmını **hiç göremiyor**.

🚨 **Yeni bulgu (29 Tem 2026) — bozulmanın kaynağı bulundu.** Dokümanlar bunu "AI aynı
yeri farklı yazımla tekrar ekledi" diye açıklıyordu. Doğru değil: `learn-aliases`
prompt'unun **kendi örnekleri** ASCII'ye indirgenmiş. Yani bozuk yazımı AI uydurmuyor,
**biz öğretiyoruz** (bkz. D1). Bu bulgu olmadan SQL temizliği yapılsaydı bozulma
birkaç hafta içinde aynen geri gelirdi.

**Sıra önemli:** D1 + D2 (kaynağı kes) → D5 (mevcut veriyi temizle) → D3 (tekrarını DB'de
imkânsızlaştır). D4 bağımsız, her an yapılabilir.

---

### D1 · Alias öğrenme prompt'u bozuk yazımı ÖĞRETİYOR 🔴
- **Dosya:** `app/api/admin/learn-aliases/route.ts` (satır 181-219)
- **Efor:** 2 puan
- **Sorun:** Prompt kuralda "district: ilcenin **dogru Turkce adi**" diyor ama verdiği
  sekiz örneğin **hepsi** ASCII: `"Gaziantep"`, `"Eskisehir"`, `"Kocaeli"`+`"Izmit"`,
  `"Istanbul"`+`"Tuzla"`, `"Tekirdag"`+`"Corlu"`, `"Hatay"`+`"Antakya"`. LLM kuralı
  değil örneği taklit eder. `normalized` kolonuna yazılan değer doğrudan `listings`'e
  geçtiği için bozulma zincirin en başında doğuyor.
- **Yapılacak:** Örnekleri Türkçe doğru yazımla değiştir (`"Eskişehir"`, `"İzmit"`,
  `"İstanbul"`, `"Tekirdağ"`, `"Çorlu"`), prompt'un başına açık kural ekle:
  Türkçe karakterler (`ı ğ ü ş ö ç İ`) **korunacak**, ASCII'ye indirgenmeyecek.
  Prompt gövdesindeki diğer ASCII metinler (`GOREV`, `KURALLAR`) dokunulmadan kalabilir —
  onlar veri değil, talimat.
- **Kabul kriteri:** Prompt içindeki her il/ilçe örneği Türkçe doğru yazımda; keşif bir
  kez çalıştırıldığında öneri listesinde ASCII'ye indirgenmiş `normalized` yok.

### D2 · Alias yazma yolunda normalizasyon yok 🔴
- **Dosya:** `app/api/admin/learn-aliases/route.ts` (satır 123-135, 279-289, 385-387, 400-404)
- **Efor:** 3 puan
- **Sorun:** Dört yazma noktası **birbirinden farklı** davranıyor.
  - AI yolu (280) ve PATCH yolları (385, 401) `alias`'ı `.toLowerCase()` yapıyor.
  - **Manuel `create` (127) yapmıyor.** Admin panelden "Gebze" yazınca `gebze` zaten
    varken **yeni satır doğuyor**. `onConflict: 'alias'` upsert'i (325) tam string
    eşleşmesine dayandığı için bunu görmüyor.
  - `normalized` ve `district` **hiçbir yolda** normalize edilmiyor, sadece `.trim()`.
    Yani D1 düzeltilse bile elle "istanbul" yazan bir admin yeni bir varyant üretebilir.
- **Yapılacak:** Ortak yardımcı (örn. `lib/alias-normalize.ts`): `alias` → küçük harf +
  boşluk sadeleştirme; `normalized`/`district` → baş harf büyük, Türkçe karakter korunur.
  Dört yazma noktasında da kullan. Ayrıca yazmadan önce **ASCII-katlanmış** forma göre
  çakışma kontrolü: yeni değer mevcut farklı bir değerle katlandığında 409 dön ve mevcut
  değeri öner (sessizce ezme — admin hangi yazımın kazandığını görmeli).
- **Kabul kriteri:** Manuel formdan "Gebze"/"GEBZE"/"gebze" girilince üç deneme de aynı
  satıra düşüyor, yeni satır oluşmuyor. `normalized: "istanbul"` girişimi `İstanbul`
  mevcutken reddediliyor.
- ⚠️ **`is_active`/`is_approved` filtresi:** hem `parse-listing` hem `whatsapp-parse`
  yalnız `is_active = true` filtreliyor, `is_approved`'a **bakmıyor**. Şu an güvenli
  çünkü AI önerileri `is_active: false` doğuyor — ama bu iki bayrağın senkron kalmasına
  bağlı, kırılgan bir varsayım. D2'de not düşülecek, davranış değiştirilmeyecek.

### D3 · `aliases` tablosuna trigger + UNIQUE indeks 🟡
- **Dosya:** yeni `docs/20260729_alias_normalize_trigger.sql`
- **Efor:** 2 puan
- **Sorun:** D2 kodu korur, ama SQL Editor'den ya da ileride başka bir servisten gelen
  yazımı korumaz. 538 kopya grubu tam olarak böyle oluştu.
- **Yapılacak:** `BEFORE INSERT OR UPDATE` trigger — `alias` normalize edilerek yazılsın;
  + normalize forma UNIQUE indeks:
  `(type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu'))`
- 🚨 **SIRA ŞART:** Bu **en son** çalışır. D5'teki temizlik yapılmadan indeks kurulmaya
  çalışılırsa mevcut kopyalar yüzünden **hata verir ve kurulmaz**.
- **Kabul kriteri:** Temizlik sonrası indeks kuruluyor; SQL Editor'den `'GEBZE'` insert
  denemesi unique ihlali veriyor.

### D4 · `findPlaces` `seen` kümesi ham `normalized` ile anahtarlanıyor 🔴
- **Dosya:** `supabase/functions/parse-listing/index.ts` (279, 289-291, 303-305, 617-621)
- **Efor:** 3 puan
- **Sorun:** Yukarıdaki zincirin 2. ve 3. adımı. Veri temizlense bile **kod bu hata
  sınıfına açık kalır** — yarın yeni bir varyant doğduğunda sahte güzergâh yine üretilir.
- **Yapılacak:** `seen` kümesini ve `sameCity` karşılaştırmasını **katlanmış** anahtar
  üzerinden yürüt (`trNorm(match.normalized)`), `hits` içindeki değer ham kalsın.
  Aynı katlamayı `bestPlace` sonrası lane `from`/`to` karşılaştırmalarına da uygula
  (satır 426, 619, 642 civarı `l.from`/`l.to` anahtarı).
- **Kabul kriteri:** Hem `avcilar` hem `kadıköy` geçen tek satırlık bir metin **hiç lane
  üretmiyor** (iki hit tek şehre katlanıyor, ilçeler ayırt edici değilse reddediliyor);
  gerçek İstanbul→Ankara metni etkilenmiyor.
- ⚠️ İlçeler **gerçekten** farklıysa (şehiriçi güzergâh) lane korunmalı — satır 621'deki
  mevcut `diffDist` mantığı bilinçli, silinmemeli.

### D5 · SQL çalıştırma sırası + geçmiş veri onarımı 🟡
- **Dosya:** yeni `docs/20260729_alias_runbook.md` (mevcut iki `.sql`'i sırayla yönetir)
- **Efor:** 3 puan · **Bayram çalıştıracak**
- **Sorun:** İki hazır script var (`20260728_alias_homonim_temizligi.sql`,
  `20260728_alias_kopya_temizligi.sql`) ama aralarındaki **sıra hiçbir yerde yazılı
  değil** ve ikisi de yalnız kısmen çalıştırılmış durumda. Yanlış sırada çalıştırmak
  BÖLÜM 3'ü bozar (kaynak değerleri BÖLÜM 2 düzeltiyor).
- **Yapılacak — tek dosyada, numaralı sıra:**
  1. Homonim ADIM 3 — `araç`/`arac`/`olur` pasifleştir.
     (`araç` 3000 mesajın **580'inde** geçiyor, %19 — Bursa'nın bile üstünde.
     `olur` yerel testte doğrulandı: "…KAMYONDA OLUR" → sahte Erzurum eşleşmesi.)
  2. Kopya BÖLÜM 1 → 2 → 3 (ASCII bozulması → district yazımı → NULL district doldur).
  3. Kopya BÖLÜM 4.1 **`payas`** — 🚨 gerçek hata: Payas 2008'den beri **Hatay** ilçesi,
     `id=1003` "Adana" diyor ve küçük id kazandığı için **bugün her payas ilanı Adana'ya
     yazılıyor**. Doğru satır (`id=1844`) tabloda zaten var.
  4. Kopya BÖLÜM 4.2-4.6 (`kazan`→Kahramankazan, `ömerli`, `kıraç`, `gölbaşı`, `kemalpaşa`).
  5. Kopya BÖLÜM 5 doğrulama — **iki sorgu da boş dönmeli**, dönmüyorsa durup bana getir.
  6. Geçmiş konum onarımı — 🚨 **kopya BÖLÜM 6'yı KULLANMA** (ölü `destination_city`'yi
     onarıp canlı `listing_stops.city`/`district` ve `listings.origin_district`'i atlıyor);
     `20260729_alias_runbook.md` Adım 8 dört kolonu birlikte onarıyor.
  7. Sahte güzergâh ölçümü: runbook Adım 0.1 — `listings` ⋈ `listing_stops`, katlanmış
     anahtar eşit + ham yazım farklı. D4 öncesi ve sonrası karşılaştırılabilsin diye
     **düzeltmeden önce de** al. ⚖️ Şehir içi taşıma meşrudur; "aynı şehir" sahtelik
     sinyali değil (Adım 0.2 o tabanı ayrı ölçüyor).
  8. D3 indeksini **en son** kur.
- **Kabul kriteri:** BÖLÜM 5'in iki doğrulama sorgusu boş dönüyor; D3 indeksi hatasız
  kuruluyor.
- ⚠️ Hiçbir adım satır **silmiyor** — hepsi `UPDATE` ya da `is_active = false`. Geri
  alınabilir. `araç`/`olur` pasifleştirmesinin bedeli: Kastamonu/Araç ve Erzurum/Olur
  gerçekten geçtiğinde artık yakalanmaz. Bilinçli takas.

---

## Bayram'ın yapması gerekenler (kod dışı)

### ✅ DEPLOY'DAN ÖNCE — Supabase SQL Editor (TAMAMLANDI, 29 Tem 2026)
1. ~~**K1b:** `docs/20260728_kvkk_onay.sql`~~ ✅ çalıştırıldı.
2. ~~**A1b:** `docs/20260728_auth_events.sql`~~ ✅ çalıştırıldı — `auth_events` canlıda,
   denetim izi gerçekten birikiyor.

### ⚠️ DEPLOY'DAN SONRA — Supabase SQL Editor (ÇALIŞTIRILDI, sıra teyit edilmeli)
3. ~~**L1e:** `docs/20260728_contact_phone_revoke.sql`~~ ✅ çalıştırıldı (29 Tem 2026,
   doğrulama select'i 0 satır → `anon`/`authenticated` artık `contact_phone`'u göremiyor).
   ✅ **Duman testi geçti** (Bayram, 29 Tem 2026): çıkışta ana sayfa + `/ilan/[id]` açılıyor,
   `/moderator` listesi telefon kolonuyla yükleniyor, moderatör telefon düzenle + Onayla
   çalışıyor. Panel'de ayrı ilan-düzenleme adımı yok — numara profilden geliyor.
   Kod taramasıyla da doğrulandı: `contact_phone`'a dokunan **her** okuma/yazma yolu
   service-role kullanıyor (`app/panel/page.tsx`, `app/panel/actions.ts`,
   `app/moderator/actions.ts`, `app/ilan/[id]/page.tsx`, `app/ilan-ver/actions.ts`,
   `app/api/**`). Kırık yol kalmadı; geri alma bloğuna gerek yok.

### Kontrol / karar
4. ~~**K2 — `users.is_active` default'u**~~ ✅ **doğrulandı** (29 Tem 2026): default `true`,
   kolon nullable, NULL satır sayısı 0. Opsiyonel sertleştirme:
   `alter table public.users alter column is_active set not null;`
   (Nullable kaldığı sürece `.eq('is_active', true)` NULL satırları sessizce atlar.)
5. ~~**A4 — Twilio Console:** Code Length kaç hane?~~ ✅ **4 hane, çalışıyor** (28 Tem 2026).
   Bu bilgi `sahiplen` sayfasındaki 6-hane bug'ını (A4b-hane) ortaya çıkardı.
6. ~~**S1 — Görsel:** 1200×630 OG görseli~~ ✅ **TESLİM EDİLDİ** (Bayram, 29 Tem 2026).
   `app/opengraph-image.jpg` (1200×630, 134 KB) + `app/opengraph-image.alt.txt`.
   Geçici `next/og` üreteci silindi.
   ⏳ **Deploy sonrası göz kontrolü:** siteye bir link WhatsApp'a atıp kart görünüyor mu bak.
8. **`NEXT_PUBLIC_SITE_URL` ortam değişkeni** Vercel'de tanımlı mı teyit et. Tanımsızsa
   `https://yukegel.com` fallback'i devreye girer; alan adı farklıysa canonical + sitemap +
   OG URL'leri **hep birden** yanlış alan adını gösterir.
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
