# SPRINT 01 — Landing / Kayıt / Giriş

> Oluşturma: 28 Temmuz 2026
> Kaynak analiz: `docs/LANDING_AUTH_ANALIZ.md`
> Kapsam: `app/page.tsx`, `app/_components/*`, `app/giris`, `app/profil-tamamla`, `app/auth/*`, `app/cikis`, `app/moderator-giris`, `proxy.ts`, `app/layout.tsx`, `app/sitemap.ts`, `public/robots.txt`

**Toplam: 30 madde / 78 puan** · Efor birimi: 1 puan ≈ 30 dk odaklı iş.

---

## Dalga planı

| Dalga | Tema | Maddeler | Puan | Neden bu sırada |
|---|---|---|---|---|
| **W0** | Yasal + tam kilitleyen buglar | L1, A2, M1, K1 | 17 | Ürün şu an yasal risk taşıyor ve iki akış tamamen kırık |
| **W1** | Auth akış bütünlüğü | A1, A3, A4, A7, K2, R1, C1 | 21 | Kullanıcı doğru ekrana gitmiyor / sessiz hata |
| **W2** | Güvenlik & gözlemlenebilirlik | G1, G2, M2, C2, K2b | 15 | Kötüye kullanım yüzeyi + kör nokta |
| **W3** | SEO & huni | S1, S2, S3, S4, L2, L3 | 14 | Trafik ve dönüşüm |
| **W4** | UX cila | K3, L4, L5, A5, A6, R2, F1, F2 | 11 | Küçük ama görünür |

---

## W0 — Blocker (17 puan)

### L1 · Telefon numarası RSC payload'ında misafire sızıyor 🔴
- **Dosya:** `app/page.tsx:92` → `tel: ilan.contact_phone`, `:117` `<HomeClient initialIlanlar={...} />`
- **Mekanizma:** `createServiceClient()` (RLS bypass) ile çekilen `contact_phone`, client component prop'u olarak flight payload'a serialize ediliyor. Giriş yapmamış ziyaretçi sayfa kaynağından tüm ilan sahiplerinin telefonunu okuyabiliyor. Aynı sızıntı `HomeClient.tsx:444/486`'daki anon sorguda da var.
- **Etki:** KVKK ihlali + "üye olunca telefon görünür" ürün vaadinin tamamen boşa çıkması (`HomeClient.tsx:261` UyeBanner).
- **Yapılacak:** `page.tsx`'te kullanıcı oturumu yoksa `tel: null` map'le; telefon yalnızca ayrı bir authed endpoint (`/api/ilan/[id]/telefon`) üzerinden dönsün. `HomeClient.tsx:444` select listesinden `contact_phone` çıkar.
- **Kabul kriteri:**
  - [ ] Çıkış yapmış tarayıcıda `view-source` + flight payload'da hiçbir `+90`/`05` telefon deseni yok
  - [ ] Girişli kullanıcıda telefon hâlâ görünüyor
  - [ ] `logPhoneAccess` her telefon açılışında kayıt düşüyor
- **Efor:** 5 puan · **Bağımlılık:** yok · **Riskli dosya:** `page.tsx`, `HomeClient.tsx`

### A2 · Google merge akışı 404'e düşüyor 🔴
- **Dosya:** `app/auth/callback/route.ts` → `redirect('/giris/merge?...')`; `app/giris/` altında yalnızca `page.tsx` var
- **Etki:** Aynı e-postayla önceden kaydı olan kullanıcı Google ile girince 404 alıp tamamen kilitleniyor. Geri dönüş yolu yok.
- **Yapılacak:** İki seçenekten biri —
  - (A) `app/giris/merge/page.tsx` oluştur (eski hesap adını göster, "Bu benim / değil" onayı → `/api/auth/merge`)
  - (B) callback'i `/giris?mod=merge_onay&merge_user_id=...` biçimine çevir; `giris/page.tsx` zaten `'merge_onay'` moduna sahip (`type Mod`)
  - **Öneri: (B)** — mevcut mod state'i hazır, yeni route/RLS yüzeyi açmıyor.
- **Kabul kriteri:**
  - [ ] Var olan e-postayla Google girişi → 404 yok, onay ekranı geliyor
  - [ ] Onay sonrası `/panel`'e düşüyor, `merged_into` doğru set ediliyor
  - [ ] Reddetme yolu da bir yere çıkıyor (çıkış + açıklama)
- **Efor:** 5 puan · **Bağımlılık:** yok

### M1 · `/moderator-giris` çıkış yapmışken erişilemiyor 🔴 *(yeni)*
- **Dosya:** `proxy.ts:19` `KORUNMALI = [... '/moderator']`, `:72` `pathname.startsWith(r)`
- **Mekanizma:** `'/moderator-giris'.startsWith('/moderator') === true`. `ACIK_ROTALAR`'da `/moderator-giris` yok → oturumsuz kullanıcı moderatör giriş sayfasına gidemiyor, `/giris?redirect=/moderator-giris`'e atılıyor.
- **Etki:** Moderatör ekibi kendi giriş ekranına ulaşamıyor.
- **Yapılacak:** `ACIK_ROTALAR`'a `/moderator-giris` ekle (ACIK kontrolü KORUNMALI'dan önce çalışıyor, sıra doğru). Ayrıca prefix eşleşmesini `'/moderator'` → `'/moderator/'` yapıp aynı sınıf hatayı kökten kapat.
- **Kabul kriteri:**
  - [ ] Gizli sekmede `/moderator-giris` açılıyor
  - [ ] `/moderator` hâlâ oturumsuz erişime kapalı
- **Efor:** 1 puan · **Bağımlılık:** yok

### K1 · KVKK / açık rıza onayı yok 🔴
- **Dosya:** `app/profil-tamamla/page.tsx` (form gövdesi), `app/giris/page.tsx` kayıt modu
- **Etki:** TCKN/VKN/telefon topluyoruz, aydınlatma metni onayı alınmıyor. `/kvkk` ve `/kullanim-kosullari` sayfaları var ama akışa bağlı değil.
- **Yapılacak:** Kayıt tamamlama formuna zorunlu checkbox: "KVKK Aydınlatma Metni ve Kullanım Koşulları'nı okudum, onaylıyorum" + linkler. Onay zamanını `users.kvkk_onay_at timestamptz` kolonuna yaz.
- **Kabul kriteri:**
  - [ ] Onaysız submit engelleniyor (client + server action)
  - [ ] `users.kvkk_onay_at` doluyor
  - [ ] Metin linkleri yeni sekmede açılıyor
- **Efor:** 4 puan · **Bağımlılık:** DB migration (kolon) · **Not:** Migration W0'da açılmalı, K2 ile aynı deploy'a girebilir
- **DB:** `alter table users add column kvkk_onay_at timestamptz;`

### K1b · Migration: `users.kvkk_onay_at` 🔴
- **Efor:** 1 puan · K1'i blokluyor

### L1b · `/api/ilan/[id]/telefon` endpoint'i 🔴
- Authed + `logPhoneAccess` + rate limit (dk başına 10). L1'in parçası ama ayrı ticket olarak takip edilmeli.
- **Efor:** 1 puan

---

## W1 — Auth akış bütünlüğü (21 puan)

### A1 · `/api/auth/log` endpoint'i yok, çağrılar sessizce yutuluyor 🔴
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

### A1b · Migration + RLS: `auth_events` tablosu
- Insert yalnız service-role; select yalnız admin/moderator.
- **Efor:** 2 puan

### A3 · `?hesap=tasindi` / `?hesap=eslesme` mesajları hiç gösterilmiyor 🟠
- **Dosya:** `proxy.ts:94` ve `:128` bu paramlarla yönlendiriyor; `app/giris/page.tsx:42` yalnızca `redirect` param'ını okuyor
- **Ek problem:** `proxy.ts:94` cookie'leri sildiği için `giris/page.tsx:61`'deki `if (!user) return;` erken çıkıyor → hiçbir bilgilendirme yapılmıyor.
- **Etki:** Kullanıcı sebepsizce giriş ekranında buluyor kendini, ne olduğunu anlamıyor → terk.
- **Yapılacak:** `searchParams.get('hesap')` oku, `useEffect` içinde `setBilgi()` ile açıklayıcı metin bas. `tasindi` → "Hesabınız birleştirildi, aynı yöntemle tekrar giriş yapın." `eslesme` → "Bu numara/e-posta zaten kayıtlı bir hesaba ait, o hesapla giriş yapın."
- **Kabul kriteri:** [ ] İki param için de mesaj görünüyor · [ ] Mesaj `!user` durumunda da basılıyor (onAuthStateChange'ten bağımsız)
- **Efor:** 2 puan

### A7 · Yönlendirme sonrası `redirect` param'ı kayboluyor 🟡
- `proxy.ts:73` `/giris?redirect=...` kuruyor; merge/switch akışları sonrasında korunmuyor.
- **Kabul kriteri:** [ ] `/panel/ilanlarim`'a giriş isteyen kullanıcı, giriş sonrası oraya dönüyor
- **Efor:** 2 puan · **Bağımlılık:** A2, A3

### A4 · OTP uzunluğu 4 hardcoded, Twilio 6 hane gönderiyor olabilir 🟠
- **Dosya:** `app/giris/page.tsx:430` `.substring(0, 4)` + `maxLength={4}`
- **Etki:** Twilio Verify varsayılanı 6 hanedir. Eğer 6 ise SMS OTP girişi **tamamen çalışmıyor** demektir.
- **Yapılacak:** Twilio Console → Verify Service → Code Length kontrol et, kodu ona göre sabitle **veya** input'u 4-8 arası esnek yap ve `maxLength`'i tek yerden sabitle.
- **Kabul kriteri:** [ ] Gerçek telefonla uçtan uca OTP girişi başarılı
- **Efor:** 1 puan · **Bağımlılık:** ⚠️ Twilio Console erişimi gerekiyor (Bayram)

### K2 · `users` upsert'inde RLS/kolon yetkisi doğrulanmadı 🟠
- **Dosya:** `app/profil-tamamla/page.tsx:223` — client'tan `supabase.from('users').upsert({... tckn, vkn, phone_verified, is_active ...})`
- **Risk:** Kullanıcı `phone_verified: true`, `is_active`, hatta `role` gibi alanları kendi isteğiyle set edebiliyorsa yetki yükseltme açığı var.
- **Yapılacak:** Aşağıdaki SQL'i çalıştır, sonucu bu dokümana yapıştır. Gerekirse upsert'i `'use server'` server action'a taşı ve yalnız beyaz listedeki kolonları yaz.
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename='users';
select grantee, privilege_type, column_name from information_schema.column_privileges
where table_name='users' and grantee in ('authenticated','anon') order by grantee, column_name;
```
- **Kabul kriteri:** [ ] `role`, `is_active`, `phone_verified`, `merged_into` kolonları `authenticated` için yazılamaz · [ ] Profil tamamlama hâlâ çalışıyor
- **Efor:** 3 puan (doğrulama 1 + gerekirse server action'a taşıma 2)

### R1 · `/auth/reset` recovery oturumu kontrol etmiyor 🟠 *(yeni)*
- **Dosya:** `app/auth/reset/page.tsx:34` `supabase.auth.updateUser({ password })`
- **Sorun:** Sayfa doğrudan açıldığında (recovery token yokken) form gösteriliyor, submit'te "Linkin süresi dolmuş olabilir" gibi belirsiz hata veriyor. `PASSWORD_RECOVERY` event'i dinlenmiyor.
- **Yapılacak:** `onAuthStateChange` ile `PASSWORD_RECOVERY`/oturum bekle; oturum yoksa "Geçersiz veya süresi dolmuş link" ekranı + "Yeni link iste" butonu.
- **Kabul kriteri:** [ ] Tokensız `/auth/reset` → form değil, hata ekranı · [ ] Geçerli linkle akış çalışıyor
- **Efor:** 3 puan

### C1 · `/cikis` GET ile çalışıyor — prefetch/CSRF ile istemsiz çıkış 🟠 *(yeni)*
- **Dosya:** `app/cikis/route.ts:5-7`
- **Sorun:** `<a href="/cikis">` link prefetch'i veya üçüncü taraf `<img src="https://yukegel.com/cikis">` kullanıcıyı oturumdan düşürebilir.
- **Yapılacak:** GET handler'ı kaldır, yalnız POST bırak; çıkış butonlarını `<form method="post" action="/cikis">` yap. Origin header kontrolü ekle.
- **Kabul kriteri:** [ ] `GET /cikis` → 405 · [ ] Tüm çıkış butonları hâlâ çalışıyor
- **Efor:** 2 puan · **Not:** Çıkış butonu kullanan tüm sayfaları taramak gerekiyor (`grep -rn "/cikis" app/`)

### A4b · OTP tekrar gönderim cooldown'ı yok 🟠
- **Dosya:** `app/giris/page.tsx:104-112` `otpGonder`
- Kullanıcı butona basılı tutup onlarca SMS tetikleyebilir → Twilio maliyeti + kullanıcı spam'i.
- **Yapılacak:** 60 sn geri sayım + buton disable + `sessionStorage`'a son gönderim zamanı.
- **Kabul kriteri:** [ ] İkinci gönderim 60 sn boyunca engelli, geri sayım görünüyor
- **Efor:** 2 puan

---

## W2 — Güvenlik & gözlemlenebilirlik (15 puan)

### G1 · Şifreli girişte rate limit / lockout yok 🟠 *(yeni)*
- **Dosya:** `app/giris/page.tsx` (signInWithPassword), `app/moderator-giris/page.tsx:20`
- Moderatör giriş ekranı özellikle riskli: sınırsız deneme, log yok (A1 nedeniyle), ikinci faktör yok.
- **Yapılacak:** Server tarafında IP+e-posta bazlı sayaç (5 hata → 15 dk kilit). `auth_events` üzerinden okunabilir. Supabase Auth rate limit ayarlarını da kontrol et.
- **Kabul kriteri:** [ ] 6. hatalı denemede kilit mesajı · [ ] Kilit süresi dolunca açılıyor
- **Efor:** 5 puan · **Bağımlılık:** A1 (auth_events)

### G2 · OTP gönderiminde bot koruması yok 🟠 *(yeni)*
- Kayıtsız biri rastgele numaralara SMS tetikleyebilir → doğrudan para kaybı.
- **Yapılacak:** Turnstile/hCaptcha veya en azından IP başına saatlik OTP kotası (server-side).
- **Kabul kriteri:** [ ] Aynı IP'den saatte >5 farklı numaraya OTP engelleniyor
- **Efor:** 4 puan · **Bağımlılık:** A4b

### M2 · Moderatör girişinde rol doğrulaması yok 🟠 *(yeni)*
- **Dosya:** `app/moderator-giris/page.tsx:20-30` — `signInWithPassword` başarılıysa koşulsuz `router.push('/moderator')`
- Normal kullanıcı buradan giriş yapıp `/moderator`'a itiliyor; proxy oradan geri atıyor ama kullanıcı garip bir döngü yaşıyor ve moderatör ekranının varlığı doğrulanmış oluyor.
- **Yapılacak:** Giriş sonrası `users.role` oku; `admin|moderator` değilse `signOut()` + "Bu hesabın moderatör yetkisi yok" mesajı.
- **Kabul kriteri:** [ ] Normal kullanıcı burada giriş yapamıyor, açıklayıcı hata alıyor
- **Efor:** 2 puan

### C2 · `/cikis` `sb-` cookie'lerini açıkça temizlemiyor 🟡 *(yeni)*
- `signOut()` yeterli olmalı ama `proxy.ts:60-64` ve `:95-97`'de zaten manuel temizleme pattern'i var — tutarlılık için burada da uygula. Kısmi çıkış hâllerini eler.
- **Efor:** 1 puan · **Bağımlılık:** C1

### K2b · TCKN/VKN sunucu tarafında yeniden doğrulanmıyor 🟠
- **Dosya:** `app/profil-tamamla/page.tsx` — `tcknGecerli()`/`vknGecerli()` yalnız client'ta
- Client bypass edilerek geçersiz TCKN yazılabilir.
- **Yapılacak:** K2'deki server action'a aynı algoritmayı taşı (`lib/kimlik.ts` olarak ortak modül).
- **Kabul kriteri:** [ ] Doğrudan PostgREST çağrısıyla geçersiz TCKN yazılamıyor
- **Efor:** 3 puan · **Bağımlılık:** K2

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

1. **A4 — Twilio Console:** Verify Service → Code Length kaç hane? (4 ise kod doğru, 6 ise SMS girişi şu an tamamen kırık)
2. **K2 — Supabase SQL Editor:** yukarıdaki iki sorguyu çalıştır, çıktıyı paylaş
3. **S1 — Görsel:** 1200×630 OG görseli (logo + "Türkiye'nin Nakliye İlan Platformu")
4. **G2 — Karar:** Turnstile mi kota mı? Turnstile ücretsiz ama Cloudflare hesabı gerektiriyor

---

## Değiştirilmemesi gerekenler

Analizde doğru kurgulanmış bulunan ve regresyon riski taşıyan noktalar:

1. `giris/page.tsx` — `INITIAL_SESSION` event'ine bağlanma (magic-link hash'i bu event'ten önce tüketiliyor)
2. `proxy.ts:94-98` — merge edilmiş oturumda `sb-` cookie silme (sonsuz döngüyü bu çözdü, magic-link ile değiştirmeye kalkma)
3. `giris/page.tsx:114-216` — 4 formatlı telefon eşleştirme (`+90…`, `90…`, `0…`, `5…`)
4. `api/auth/tekil-kontrol` — service-role ile yalnız `{ mevcut: boolean }` dönmesi (enumeration'a kapalı)
5. `profil-tamamla` — TCKN/VKN algoritmik doğrulama (K2b bunu **kaldırmıyor**, sunucuya *kopyalıyor*)
6. Her yerde `maybeSingle()` kullanımı — `single()`'ın 0 satırda patlamasını eler
