# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
> Son güncelleme: 29 Temmuz 2026 — **SPRINT_01 W5 (alias veri bütünlüğü) kod tarafı tamamlandı.**
> **W5:** Bozuk `aliases.normalized` yazımı (`Istanbul` 13 satır / `İstanbul` 154 satır) sahte
> **İstanbul→İstanbul** güzergâhları üretiyordu. Kaynak iki katmanlıydı: `learn-aliases` prompt'unun
> örnekleri ASCII'ye indirgenmişti (**D1** düzeltti) ve dört alias yazma noktasının hiçbiri
> `normalized`/`district`'i normalize etmiyordu (**D2** → yeni `lib/alias-normalize.ts`, dört yolda
> 409 çakışma kontrolü). **D4** `parse-listing/findPlaces`'teki `seen`/`sameCity`/lane dedup
> anahtarlarını katlanmış forma geçirdi (5/5 kabul testi geçiyor; aynı testler HEAD'de 3/5 başarısız).
> **D5** `docs/20260729_alias_runbook.md` — iki hazır SQL script'inin çalıştırma sırası (sıra
> yanlışsa sessizce zarar veriyor). **D3** `docs/20260729_alias_normalize_trigger.sql` — normalize
> trigger + **kısmi** UNIQUE indeks.
> ⚠️ **SQL'lerin HİÇBİRİ ÇALIŞTIRILMADI** (Bayram'ın 29 Tem beyanı). Sıra: runbook Adım 0-9 → sonra
> trigger dosyası. (bkz. `docs/W5_DEVIR.md`)
>
> Önceki: 29 Temmuz 2026 — **SPRINT_01 W3 + W4 tamamlandı.**
> **W3 (SEO & huni):** `layout.tsx` metadata (metadataBase/OG/Twitter/canonical) + statik OG kartı, 4 auth sayfasına `noindex`, sitemap'e `/yol-rehberi` ve profil sayfaları, robots.txt dört bloğu tutarlı hale getirildi, iki CTA `?tip=` ile ayrıştı (`lib/analiz.ts`), misafirin "Ara" butonu artık `?redirect=` taşıyor.
> **W4 (UX cila):** Şifre kuralları tek kaynağa indi (`lib/sifre.ts` — ⚠️ `\p{Lu}`, `[A-Z]` DEĞİL); liste limiti tek sabite indi (`lib/ilan-liste.ts`) ve sayaç artık ekrandakini sayıyor; sekme state'i URL'e yansıyor (pushState + popstate); `profil-tamamla`'da tip değişimi ortak alanları koruyor ve blur yarışına karşı epoch guard'ı var; giriş route'u makine okunur `kod` dönüyor; **yeni** `/api/auth/dogrulama-tekrar` doğrulama e-postasını kotalı biçimde tekrar gönderiyor; Footer tamamen `next/link`.
>
> Önceki: 29 Temmuz 2026 — **SPRINT_01 W2 tamamlandı.** A10 ile `merged_into` giriş döngüsü kapandı: `/auth/devir` oturumu SUNUCUDA canlı hesaba geçiriyor (`hashed_token` + `verifyOtp`), token tarayıcıya hiç gelmiyor. M2 moderatör girişine rol doğrulaması ekledi. K2b TCKN/VKN doğrulayıcılarını `lib/kimlik.ts`'te tek kaynağa indirdi. **G2:** SMS gönderimi istemciden alınıp `/api/auth/otp`'ye taşındı (3 katmanlı kota). **G1:** şifreli giriş istemciden alınıp `/api/auth/giris`'e taşındı (e-posta 5 hata/15dk, IP 20 hata/15dk). Ortak kota altyapısı: `lib/kota.ts`.
>
> Önceki: 28 Temmuz 2026 — **SPRINT_01 W1 tamamlandı.** Auth audit trail açıldı (`/api/auth/log` + `auth_events`), `?hesap=` mesajları görünür oldu, `redirect` param'ı `lib/redirect.ts` ile güvenli şekilde korunuyor, profil upsert'i server action'a taşındı (kolon beyaz listesi), `/auth/reset` artık yalnız gerçek recovery oturumunda form gösteriyor, `/cikis` GET kapatıldı, OTP tekrar gönderimine **sunucu tarafı** 60 sn cooldown geldi. L1e ile `contact_phone`'un son istemci yazma yolu da kapandı — panel ve moderatör artık server action kullanıyor.
> ✅ **SPRINT_01'in 3 SQL'i de çalıştırıldı** (29 Tem 2026): `20260728_kvkk_onay.sql`, `20260728_auth_events.sql`, `20260728_contact_phone_revoke.sql`. Bekleyen migration yok. (bkz. `docs/SPRINT_01.md`)
>
> Önceki: 28 Temmuz 2026 — **SPRINT_01 W0 tamamlandı.** Telefon sızıntısı 4 yüzeyde birden kapatıldı (`/`, `/ilan/[id]`, `/u/[username]`, `/ilan/[id]/sahiplen`), numara artık yalnız `/api/ilan/[id]/telefon` üzerinden dönüyor. Google merge 404'ü çözüldü, merge route'undaki 3 bug giderildi, proxy prefix tuzağı kökten kapatıldı, KVKK açık rıza onayı eklendi.
>
> Önceki: 22 Temmuz 2026 — Ayrı auth kimliğiyle (telefon vs. Google) gelen KAYITLI kullanıcı artık profil-tamamla'ya düşmüyor. Magic-link self-heal SONSUZ DÖNGÜ yaratıyordu (implicit flow yalnız localStorage'ı günceller, SSR cookie eski oturumda kalır → proxy tekrar /giris'e atar); çözüm: proxy ölü oturumun sb- cookie'lerini siler, giriş sayfası ölü/eksik oturumu signOut ile kapatır → kullanıcı Google/e-posta ile temiz yeniden girer (PKCE → cookie doğru set). (bkz. 14. GÖREV DURUMU).

**Referans Dökümanlar:**
- `docs/LOG_VE_GUVENLIK_SPECLERI.md` — Log format standartları, audit trail, SecurityLogger kontrol listesi
- `docs/LANDING_AUTH_ANALIZ.md` — Landing / kayıt / giriş analizi (28 Tem 2026), bulgu kodları L1–L5, A1–A7, K1–K3
- `docs/SPRINT_01.md` — **Aktif sprint.** 30 madde / 78 puan, W0–W4 dalgaları. Yukarıdaki analiz + geniş tarama (M1–M2, R1–R2, C1–C2, G1–G2, S1–S4, F1–F2) birleşik backlog'u. Kabul kriterleri ve bağımlılıklar burada.
- `docs/ILAN_VER_ANALIZ.md` — **İlan verme akışı analizi (29 Tem 2026).** 30 madde / 87 puan, bulgu kodları V1–V10 (veri bütünlüğü & güvenlik), B1–B9 (bozuk), U1–U10 (UX/dönüşüm), M1–M5 (mimari). W0–W4 dalgaları, kabul kriterleri ve canlı DB ile doğrulanacak 6 madde burada.

> **✅ İLAN VERME W0 — KANAMA DURDURULDU (29 Tem 2026, `ILAN_VER_ANALIZ` V1–V4):** `app/ilan-ver/actions.ts` baştan yazıldı, `app/ilan-ver/page.tsx` uyarlandı, `lib/ilan-sabitler.ts` eklendi. **Migration yok.** Kazanımlar: **V10** action'ın kendi oturum kapısı var (`proxy.ts`'e tek katmanlı güven bitti); **V1** her istemci değeri beyaz listeden ve sınırlardan geçiyor (`MAX_DURAK=10`, `MAX_ARAC_ADET=50`, `MAX_FIYAT=1e8`, `MAX_NOT=2000`, `MAX_RAW_TEXT=8000`), il adları `ilNormalize()` ile resmî yazıma çevriliyor, tanınmayan il **reddediliyor**; **V2** `contact_phone` artık `users.phone`'dan — istemci farklı numara yollarsa `WARN` loglanıp profil numarası kullanılıyor, profil boşsa doğrulanmış istemci numarası kabul edilip profile **geri yazılıyor** (dal kendini onarıyor); **V3** INSERT sonrası `audit_score` okunup `getAuditThresholds()` eşikleriyle karar veriliyor — 31–70 bandı `moderation_status='pending'` + `status='passive'` (yayında **değil**), `/api/ilan/duzelt` ile birebir aynı mantık; **V4** action `IlanKaydetSonuc` döndürüyor (`{ok, id, durum, mesaj}` \| `{ok:false, hata}`), ekran üç durumu (`yayinda`/`incelemede`/`reddedildi`) gerçekten gösteriyor, "Fiyat Belli" rozeti yalnız gerçekten yayındaysa çıkıyor. Yan kazanımlar: **V5 kısmî** (durak INSERT'i patlarsa ilan telafi edici `DELETE` ile geri alınıyor), **V8/B9** (AI'ın tanımadığı il/araç değeri artık forma ham yazılmıyor), **M2 kısmî** (`ILLER`/`ARAC_TIPLERI`/`UTSYAPI` tek kaynakta), **A2** (istemci `bugun()` de sabit +03:00). ⚠️ **`safety_rules` boşsa V3 kodu doğru ama etkisiz** — her ilan 0 puan alır ve `yayinda` döner; canlı DB'de doğrulanmalı.

> **✅ İLAN VERME W1 — KIRIKLAR ONARILDI (29 Tem 2026, `ILAN_VER_ANALIZ` B1/B3/B4/V5):** İki yeni dosya: **`lib/ilan-yaz.ts`** — `listings` yazan TEK yol; **`lib/toplu-yukle-sozlesme.ts`** — toplu yükleme istemci↔route sözleşmesi. `/api/excel-import` ve `app/ilan-ver/actions.ts` **baştan yazıldı**. **⚠️ İki migration var, KODDAN ÖNCE çalıştır:** `docs/20260729_ilan_olustur_rpc.sql` → `docs/20260729_listings_vehicle_id.sql`.
> **B1** — toplu yükleme aylardır ölüydü: istemci JSON `{action,rows,userId}` yolluyordu, route `formData().get('file')` okuyordu; ayrıca şablon `'Kalkış İli'` ↔ route `'Kalkış Şehri'`. İki taraf da artık `lib/toplu-yukle-sozlesme.ts`'ten import ediyor, istemci gövdeyi `satisfies TopluYukleIstek` ile mühürlüyor → ayrışma **derleme zamanında** patlar. `userId` sözleşmede **YOK**; kimlik oturumdan. Önizleme `aliases` tablosunu sözlük olarak kullanıyor (şablonun vaat ettiği `"ist"`, `"ant."` kısaltmaları gerçekten çözülüyor), `MAX_SATIR=300` / `MAX_ILAN=50` / `maxDuration=60` (B2 kısmî).
> **V5** — ilan + duraklar artık `public.ilan_olustur(jsonb, jsonb)` RPC'siyle **tek transaction'da**. Eski iki-PostgREST-isteği düzeninde durak INSERT'i patlarsa geriye **duraksız ilan** kalıyordu; telafi edici `DELETE` de patlayabildiği için yeterli değildi. RPC `security invoker` ve EXECUTE yalnız `service_role`da.
> **B4** — yük cinsi artık **durak bazlı**. AI çok duraklı metinden her durağın `cargo_type`'ını çıkarıyordu; sayfa onları `notlar`a gömüp ilk durağınkini genel cins yapıyordu → "İstanbul'a tekstil, Ankara'ya seramik" ilanı DB'ye "hepsi tekstil" giriyordu. Tekil formda durak başına alan var, boş bırakılan genel cinsle doluyor; genel alan yalnız tüm duraklar aynıysa AI'dan doluyor.
> **B3** — `listings.vehicle_id` (FK → `vehicles`, `on delete set null`, **GRANT'lı**). Araç ilanında kullanıcının seçtiği plaka şimdiye kadar hiçbir yere yazılmıyordu. İstemciden gelen id'ye güvenilmiyor: `user_id` + `is_active` ile doğrulanmayan id `WARN` loglanıp **sessizce düşer** (ilan reddedilmez).
> Kalan: **V6** (kota), **U1–U10** (dönüşüm), **M1/M3–M5**.

> **🔴 İLAN VERME AKIŞI — SPRINT_01 SERTLEŞTİRMESİ BU YOLA UYGULANMADI (29 Tem 2026; V1–V5, B1, B3, B4 ✅ giderildi, kalanlar geçerli):** `app/ilan-ver/actions.ts` projenin **en ayrıcalıklı yazma yolu** (service-role `listings` INSERT) ama `app/panel/actions.ts`'teki üç kazanımın hiçbiri burada yok: sunucu tarafı kolon beyaz listesi yok, sahiplik/oturum kapısı yok (`user` okunuyor ama null'da durmuyor), sınır kontrolü/kota yok. Üç bulgu tek başına sprint hak ediyor: **(1)** toplu yükleme fiilen çalışmıyor — `TopluYukle.tsx:104,174` JSON `{action,rows,userId}` yolluyor, `/api/excel-import:38` yalnızca `formData().get('file')` okuyor (üstelik şablon `'Kalkış İli'`, route `'Kalkış Şehri'` bekliyor — iki bağımsız kırık); **(2)** 31–70 moderasyon bandı ölü — `actions.ts:63` `moderation_status: 'auto_published'` sabitliyor, `audit_listing_fn` ise yalnızca `score >= reject_min` dalında bu alana dokunuyor (`auto_pub_max` hesaplanıp loglanıyor ama hiçbir kararda kullanılmıyor); **(3)** AI kotasının kapısı ile sayacı farklı şeye bakıyor — `parse-text` çağrı öncesi `countAiListingsLast24h`'e bakıyor, o da `listings.raw_text IS NOT NULL` sayıyor; formu göndermeyen kullanıcı Anthropic'i sınırsız çağırıyor, üstelik `whatsapp/route.ts:191,204` aynı sayacı kirletiyor.

> **✅ PROXY PREFIX TUZAĞI (28 Tem 2026, `SPRINT_01` M1 — ÇÖZÜLDÜ):** `proxy.ts` düz `pathname.startsWith(r)` kullanıyordu; `KORUNMALI` içindeki `'/moderator'` girdisi `/moderator-giris`'i de yakalıyordu → moderatör giriş sayfası oturumsuz erişilemez hâldeydi. Artık `korunmaliMi()` **segment sınırında** eşleştiriyor: `pathname === kok || pathname.startsWith(kok + '/')`. `ACIK_ROTALAR`'a da `/moderator-giris` eklendi. **Kural: `KORUNMALI`'ya segment eklerken düz `startsWith`'e geri dönme** — `/profil` ↔ `/profil-tamamla` aynı tuzağı taşıyor.

> **✅ EKSİK ROTALAR (28 Tem 2026, `LANDING_AUTH_ANALIZ` A1/A2 — ÇÖZÜLDÜ):**
> (1) ~~`POST /api/auth/log` yok~~ — **AÇILDI.** `app/api/auth/log/route.ts` service-role ile `auth_events` tablosuna yazıyor (event, method, reason, user_id, ip, user_agent). Fire-and-forget: hiçbir zaman auth akışını bloklamaz. Telefon/şifre **yazılmaz**. ✅ `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026) — tablo canlıda.
> (2) ~~`/giris/merge`~~ — **ÇÖZÜLDÜ.** `app/auth/callback/route.ts` artık `/giris?merge_user_id=…&merge_name=…&merge_email=…` yönlendiriyor; `giris/page.tsx` bu paramları lazy `useState` initializer ile okuyup mevcut `merge_onay` moduna giriyor. Yeni route açılmadı.
> **Tuzak (kalıcı):** Yeni endpoint çağrısı eklerken `.catch(()=>{})` ile sessizleştirme — en azından `console.warn` bırak; bu iki hata aylarca görünmez kaldı. `authLog()` çağrıları artık `console.warn` bırakıyor.

> **✅ TELEFON SIZINTISI (28 Tem 2026, `SPRINT_01` L1/L1b/L1c/L1d/L1f — UYGULAMA KATMANI ÇÖZÜLDÜ):**
> Dört ayrı yüzeyde aynı sızıntı vardı: `/` (RSC flight payload + anon select), `/ilan/[id]` (wa.me linki + `Aksiyonlar` prop'u), `/u/[username]` (`tel:` href), `/ilan/[id]/sahiplen` (numarayı tam olarak ekrana yazıyordu).
> **Yeni mimari:** `contact_phone` hiçbir public sorguda **seçilmez**. Numara yalnızca `GET /api/ilan/[id]/telefon` üzerinden döner (authed + profil tamam + hesap aktif + ilan yayında; `logPhoneAccess`; dk başına 20 istek; `no-store`). Sahiplenme akışı için `/api/ilan/[id]/sahiplen` var: `GET` maskeli numara, `POST` OTP gönder/doğrula — numara istemciye hiç gitmez.
> **Kural 1:** misafire kapalı hiçbir alan client component prop'una **veya** anon key sorgusuna girmemeli.
> **Kural 2 (ISR):** `app/page.tsx` `revalidate = 30` ile cache'li — çıktı tüm ziyaretçilerde ortak, **oturuma göre koşullu render imkânsız**. Hassas veriyi "misafirse gizle" ile değil, payload'dan tamamen çıkararak çöz. `/ilan/[id]` `cookies()` kullandığı için dinamik; orada koşullu render güvenli.
> **✅ DB KATMANI (28 Tem 2026, `SPRINT_01` L1e — KOD TARAFI BİTTİ):**
> Uygulamayı düzeltmek yetmiyordu: `anon`/`authenticated` rollerinin `listings.contact_phone` üzerindeki PostgREST yetkisi durduğu sürece anon key'i olan herkes `GET /rest/v1/listings?select=id,contact_phone&limit=1000` çekebiliyordu.
> **Kural (bunu unutma):** **RLS SATIR bazlıdır, KOLON bazlı değildir.** Satır zaten herkese açıksa (ilan listesi çalışsın diye) o satırın *yetkili* her kolonu da okunur. Arayüzde göstermemek koruma değildir.
> Revoke'un önündeki engel istemciden yazma yollarıydı; ikisi de kapatıldı: `app/panel/actions.ts` ve `app/moderator/actions.ts` (yeni). Numara artık yalnız service-role kullanan sunucu yollarından okunur/yazılır.
> ✅ **`docs/20260728_contact_phone_revoke.sql` çalıştırıldı** (Bayram, 29 Tem 2026 — doğrulama select'i 0 satır döndü) ve **duman testi geçti**: misafir ana sayfa/`/ilan/[id]`, moderatör listesi + telefon düzenleme çalışıyor. `contact_phone`'a dokunan her yol service-role kullanıyor → kırık yazma yolu kalmadı.
> **Tuzak:** Tablo geneline verilmiş `GRANT`, kolon bazlı `REVOKE`'u **ezer**. Düz `revoke select (contact_phone) …` no-op olur. Migration önce tablo geneli yetkiyi alıp `contact_phone` hariç tüm kolonları programatik geri veriyor.
> 🚨 **Bunun kalıcı yan etkisi:** grant'lar migration'ın çalıştığı ANDAKİ kolon listesine göre verildi. `public.listings`'e **bundan sonra eklenecek her yeni kolon `anon`/`authenticated` için yetkisiz doğar** ve `42501 permission denied for column …` ile sessizce patlar. Yeni kolon eklerken grant'ı da elle ver (bkz. §9 KURALLAR).

> **✅ İSTEMCİ UPDATE'İ = KOLON BEYAZ LİSTESİ ŞART (28 Tem 2026, `SPRINT_01` K2 + L1e):**
> Aynı sınıf hata iki yerde vardı: `profil-tamamla` `users` upsert'i ve `panel` `listings` update'i gövdeyi hiç filtrelemeden istemciden alıyordu. RLS "kendi satırın" der ama gövdeye `role: 'admin'`, `trust_level: 'verified'`, `moderation_status: 'approved'`, `is_shadow_banned: false` eklemeyi engellemez — devtools açmak kadar kolay.
> **Kural:** İstemciden gelen her `update`/`upsert` gövdesi `'use server'` action içinde **beyaz listeden** geçmeli. Sahiplik kontrolü de sunucuda olmalı — `getServiceSupabase()` RLS'i bypass ettiği için "RLS nasılsa engeller" varsayımı geçersiz.

---

## 0. SİSTEM CONFIG PARAMETRELERİ (system_config)

### Brand kategorisi — SQL:
```sql
INSERT INTO system_config (key, value, category, data_type, description) VALUES
  ('sirket_unvani',   'Yükegel',                                       'brand', 'string', 'Ticari ünvan — KVKK ve Kullanım Koşulları metinlerinde kullanılır'),
  ('marka_adi',       'Yükegel',                                       'brand', 'string', 'Marka adı — navbar ve genel gösterimde kullanılır'),
  ('logo_url',        '/logo.svg',                                     'brand', 'string', 'Logo dosya yolu (/public altında)'),
  ('favicon_url',     '/favicon.ico',                                  'brand', 'string', 'Favicon dosya yolu (/public altında)'),
  ('site_basligi',    'Yükegel - Türkiye''nin Nakliye İlan Platformu', 'brand', 'string', 'Tarayıcı sekmesi başlığı (SEO title)'),
  ('site_aciklamasi', 'Yük ve araç ilanları. Ücretsiz, hızlı, güvenilir.', 'brand', 'string', 'Meta description (SEO)')
ON CONFLICT (key) DO NOTHING;
```

### Kullanım:
- `lib/config.ts` → `getConfig(key, default)` / `getConfigs(keys[], defaults)`
- `layout.tsx` → `generateMetadata()` ile site başlığı + favicon
- `kvkk/page.tsx` + `kullanim-kosullari/page.tsx` → `sirket_unvani`
- Admin paneli → Sistem Ayarları > 🎨 Marka & Kimlik kategorisi

> **Not:** Navbar logo görsel URL'si şimdilik hardcode `/logo.svg`. Dinamik hale getirmek için tüm sayfalara ortak `<Navbar>` server component gerekir — ileriye bırakıldı.

## 1. STACK & ORTAM

| Katman | Teknoloji |
|---|---|
| Frontend/Backend | Next.js 15 (App Router, TypeScript) |
| DB / Auth | Supabase (gobepcswwsoswodhaufy, eu-central-1) |
| Edge Functions | Supabase Deno (`supabase/functions/parse-listing/`) |
| Deploy | Vercel |
| LLM | Anthropic Haiku (parse fallback) |
| SMS OTP | Twilio Verify |
| Style | Inline CSS — `#0d1117` bg, `#22c55e` accent, `#161b22` card |
| Font | IBM Plex Sans |

---

## 2. PROJE DOSYA YAPISI

```
yukegel/
├── app/
│   ├── page.tsx                        # Landing — 3 senaryo ✅
│   ├── nasil-calisir/page.tsx          # ✅
│   ├── hakkimizda/page.tsx             # ✅
│   ├── kvkk/page.tsx                   # ✅ — sirket_unvani config'den
│   ├── kullanim-kosullari/page.tsx     # ✅ — sirket_unvani config'den
│   ├── _components/
│   │   ├── Footer.tsx                  # Server component — sirket_unvani config'den
│   │   └── HomeClient.tsx              # Client component — eski page.tsx içeriği
│   ├── layout.tsx                        # 🔍 SPRINT_01 S1 — metadataBase + OG + Twitter + canonical ✅
│   ├── opengraph-image.jpg               # 🔍 SPRINT_01 S1 — 1200×630 paylaşım kartı (Bayram'ın
│   │   + opengraph-image.alt.txt         #    tasarımı). JPEG q95 / 134 KB — WhatsApp büyük
│   │                                     #    dosyada kartı sessizce göstermiyor. `.tsx` üreteci
│   │                                     #    SİLİNDİ; aynı segmentte iki og dosyası build'i kırar ✅
│   ├── sitemap.ts                        # 🔍 SPRINT_01 S3 — statik + ilan + PROFİL (`/u/{id}`) URL'leri ✅
│   ├── giris/page.tsx
│   ├── giris/layout.tsx                  # 🔍 SPRINT_01 S2 — noindex, follow:true ✅
│   ├── moderator-giris/layout.tsx        # 🔍 SPRINT_01 S2 — noindex, nofollow ✅
│   ├── profil-tamamla/layout.tsx         # 🔍 SPRINT_01 S2 — noindex, nofollow ✅
│   ├── auth/layout.tsx                   # 🔍 SPRINT_01 S2 — SEGMENT geneli noindex+nofollow;
│   │                                     #    yeni /auth/* rotaları otomatik miras alır ✅
│   ├── auth/callback/ + reset/           # 🔒 SPRINT_01 R1 — reset 3 durumlu: kontrol/hazir/gecersiz.
│   │                                     #    Form YALNIZ gerçek PASSWORD_RECOVERY oturumunda ✅
│   ├── auth/devir/route.ts               # 🔒 SPRINT_01 A10 — emekli (merged_into) oturumu SUNUCUDA
│   │                                     #    canlı hesaba devreder. hashed_token + verifyOtp → cookie ✅
│   ├── profil-tamamla/page.tsx
│   ├── profil-tamamla/actions.ts         # 🔒 SPRINT_01 K2 — users upsert'i sunucuda, KOLON BEYAZ LİSTESİ ✅
│   ├── panel/ (page + PanelClient + IlanYonetim)
│   ├── panel/actions.ts                  # 🔒 SPRINT_01 L1e — ilanGuncelle + ilanTamamlandiToggle.
│   │                                     #    Sahiplik sunucuda, gövde beyaz listeden geçiyor ✅
│   ├── ilan/[id]/ (page + Aksiyonlar + sahiplen)
│   ├── ilan-ver/ (page + actions + TopluYukle + MetindenIlan)
│   ├── araclarim/page.tsx
│   ├── moderator/ + moderator-giris/
│   ├── moderator/actions.ts              # 🔒 SPRINT_01 L1e — ilanTelefonlariGetir (toplu, ≤300) +
│   │                                     #    ilanTelefonGuncelle. requireStaff + phone-privacy log ✅
│   ├── admin/ (page + kullanicilar + sistem-ayarlari + guvenlik + crm + radar)
│   ├── yol-rehberi/                      # 🗺️ POI Modülü ✅
│   │   ├── page.tsx                      # Server component + metadata
│   │   ├── YolRehberiClient.tsx          # Harita + filtreler + bottom sheet
│   │   ├── PoiHarita.tsx                 # React-Leaflet (dynamic import, SSR=false)
│   │   ├── PoiDetay.tsx                  # Detay bottom sheet + yorum formu
│   │   └── PoiEkleModal.tsx              # Yeni POI ekleme formu
│   ├── cikis/
│   └── u/[username]/page.tsx
│
├── api/
│   ├── admin/kullanici/ + guvenlik/
│   ├── auth/merge/ + switch-account/ + tekil-kontrol/
│   ├── auth/log/route.ts                 # 🔒 SPRINT_01 A1 — auth_events'e service-role insert.
│   │                                     #    Fire-and-forget, IP+UA yazılır, telefon/şifre YAZILMAZ ✅
│   ├── excel-import/
│   ├── ilan/[id]/telefon/route.ts        # 🔒 SPRINT_01 L1b — TEK telefon kaynağı. GET, authed+profil tam,
│   │                                     #    logPhoneAccess, 20 istek/dk (in-memory → çok instance'ta zayıf) ✅
│   ├── ilan/[id]/sahiplen/route.ts       # 🔒 SPRINT_01 L1d — GET maskeli numara, POST {adim:'gonder'|'dogrula'}
│   │                                     #    OTP sunucuda; verifyOtp SSR client ile → cookie doğru set ✅
│   │                                     # 🔒 SPRINT_01 A4b — ilan başına 60 sn SMS cooldown (429+Retry-After),
│   │                                     #    sayaç yalnız SMS GERÇEKTEN gittiyse başlar. In-memory ✅
│   ├── ilan/pasif/ + duzelt/
│   ├── llm-parse/
│   ├── moderator/kullanici-askiya/ + toplu-islem/
│   ├── parse-text/                       # ✍️ Metinden ilan: LLM (Haiku) ile JSON çıkarımı ✅
│   ├── poi/route.ts                      # GET (bbox sorgu + sıralama), POST (yeni POI) ✅
│   ├── poi/[id]/route.ts                 # GET detay + son yorumlar ✅
│   ├── poi/[id]/review/route.ts          # POST yorum + geo-fence doğrulama ✅
│   └── whatsapp-parse/                   # 🔒 requireStaff + rate limit (10/dk) ✅
│
├── lib/auth.ts + supabase.ts             # auth.ts: requireStaff() → API route'lar için (redirect atmaz)
├── lib/redirect.ts                       # 🔒 SPRINT_01 A7 — guvenliRedirect(): yalnız `/` ile başlayan,
│                                         #    `//` ve `\` içermeyen yollar (açık yönlendirme koruması) ✅
├── lib/kota.ts                           # 🔒 SPRINT_01 G1/G2 — kotaDene()/kotaSifirla()/istekIp():
│                                         #    bellek içi kayan pencere sayacı. `deger` verilirse FARKLI
│                                         #    değer sayar, `sayma:true` sadece bakar. ⚠️ process-local ✅
├── lib/kimlik.ts                         # 🔒 SPRINT_01 K2b — tcknGecerli()/vknGecerli() TEK KAYNAK
│                                         #    (istemci + sunucu aynı modülü import eder) ✅
├── lib/analiz.ts                         # 📊 SPRINT_01 L2 — olayGonder(): GA olayları için tek kapı.
│                                         #    SSR-güvenli, hataları yutar. ⚠️ KİŞİSEL VERİ GÖNDERME ✅
├── lib/sifre.ts                          # 🔒 SPRINT_01 R2 — sifreKriterleri()/sifreHatasi()/SIFRE_KURAL_METNI.
│                                         #    Gösterge ile kapı AYNI kaynaktan beslenir.
│                                         #    ⚠️ Büyük harf: `\p{Lu}` + /u — `[A-Z]` Türkçe'de YANLIŞ ✅
├── lib/ilan-liste.ts                     # 📋 SPRINT_01 L4 — ILAN_LIMITI: SSR ve istemci sorgusu AYNI
│                                         #    limiti kullanır. ⚠️ İstemci paketine girer, server-only YOK ✅
├── lib/ilan-sabitler.ts                  # 🚨 ILAN_VER_ANALIZ M2 (29 Tem 2026) — ilan alanlarının TEK KAYNAĞI.
│                                         #    ILLER (81) · ARAC_TIPLERI · UTSYAPI · ARAC_TIPI_SETI ·
│                                         #    UTSYAPI_SETI · ilKey() · ilNormalize() → resmî il adı | null
│                                         #    aracTipiNormalize() · utsyapiNormalize() (Excel serbest yazımı)
│                                         #    ⚠️ Yalnız gösterim değil, SUNUCU BEYAZ LİSTESİ de bu dosya
│                                         #    (`lib/ilan-yaz.ts`). İstemci ve sunucu ayrışamaz.
│                                         #    ⚠️ ilKey(): İ (U+0130) → düz `i` ÖNCE, sonra toLowerCase (§9)
├── lib/ilan-yaz.ts                       # 🚨 ILAN_VER_ANALIZ W0/W1 (29 Tem 2026) — `listings` yazan TEK YOL.
│                                         #    `server-only`. ilanYaz(userId, girdi, kaynak) → ayrık birlik.
│                                         #    Doğrulama + beyaz liste + sınırlar (MAX_DURAK=10, MAX_ARAC_ADET=50,
│                                         #    MAX_FIYAT=1e8, MAX_TON=1e5, MAX_NOT=2000, MAX_RAW_TEXT=8000) ·
│                                         #    ilanTelefonu() (V2: telefon users.phone'dan) ·
│                                         #    V5: public.ilan_olustur() RPC ile ATOMİK ilan+durak yazma ·
│                                         #    V3: audit_score geri okunup getAuditThresholds() ile karar ·
│                                         #    B3: arac_id sahipliği (user_id + is_active) doğrulanır ·
│                                         #    B4: durak bazlı yuk_cinsi, boşsa ilan geneli · bugunISO() (+03:00)
│                                         #    🚨 YENİ İLAN KANALI EKLERKEN INSERT KOPYALAMA, BUNU ÇAĞIR.
├── lib/toplu-yukle-sozlesme.ts           # 🚨 ILAN_VER_ANALIZ B1 (29 Tem 2026) — toplu yükleme
│                                         #    istemci↔route SÖZLEŞMESİ. HamSatir · OnizlemeSatiri ·
│                                         #    OnaySatiri · TopluYukleIstek/Yanit · AlanDurumu ·
│                                         #    MAX_SATIR=300 · MAX_ILAN=50 · SABLON_HEADERS
│                                         #    İki taraf da BURADAN import eder; istemci `satisfies` ile mühürler.
│                                         #    ⚠️ `userId` sözleşmede YOK ve olmayacak — kimlik oturumdan.
├── lib/alias-normalize.ts                # 🚨 SPRINT_01 W5/D2 — alias yazma yolu TEK KAYNAK.
│                                         #    aliasKey() (İ→i, lower, ıçğöşü→icgosu) · trTemizle() ·
│                                         #    normalizeAliasFields() · aliasSatirlariniYukle() (sayfalı,
│                                         #    bayrak filtresi YOK) · aliasCakismaBul() → 409 ·
│                                         #    baskinYazimaHizala() (yalnız AI keşif yolu).
│                                         #    ⚠️ aliasKey() ile D3 indeks ifadesi BİREBİR aynı olmalı ✅
├── lib/whatsapp/chatParser.ts            # 📱 TEK KAYNAK sohbet parser (server + client ortak) ✅
├── lib/whatsapp/__tests__/chatParser.test.ts  # 29 assertion — `npm run test:parser` ✅
├── lib/whatsapp/telefon.ts               # 📱 TEK KAYNAK telefon regex (05XXXXXXXXX) ✅
├── app/api/raw-posts/telefon-doldur/route.ts  # 📱 contact_phone geriye-doldurma (içe aktarmadan AYRI) ✅
├── supabase/functions/parse-listing/index.ts
├── proxy.ts
│   └── api/ilanlar/[id]/route.ts       # Public AI-readable API ✅
├── public/robots.txt                   # 🔍 SPRINT_01 S4 — 4 blok (*, GoogleBot, GPTBot, ClaudeBot),
│                                       #    disallow listeleri BİREBİR AYNI olmak zorunda ✅
└── docs/
```

---

## 3. VERİTABANI ŞEMASI (public.*)

### `pois` — POI Modülü (Yol Rehberi)
```
-- Yeni (17 Haz 2026) 2 kademeli yapı:
Ana Kategori           | Alt Kategoriler (category değeri)
Akaryakıt & Enerji     | akaryakit_istasyonu, elektrik_sarj
Park & Konaklama       | tir_parki, otel_pansiyon
Tamir & Bakım          | motor_mekanik, lastikci, elektrik_takograf, branda_dorse, yikama_yaglama, acil_yol_yardim
Yeme & İçme            | dinlenme_tesisi, esnaf_lokantasi
Operasyon Noktaları    | kantar, nakliyeciler_sitesi, gumruk_sinir, antrepo_depo
-- Eski (backward compat): motorcu, elektrikci, kaportaci, dorse_branda, frigo_ustasi,
--   lokanta, konaklama, yikama, park_dinlenme, yemek, tamirci, tesis_akaryakit, kantar_resmi
-- Migration: docs/20260617_poi_kategori_guncelleme.sql
location: geography(Point,4326) — PostGIS
tags: text[] — özellik etiketleri
badges: jsonb — tır uygunluk rozetleri
status: 'pending'|'approved'|'rejected'
avg_rating, review_count — trigger ile güncellenir
-- Google Places entegrasyonu (15 Haz 2026):
google_place_id: text UNIQUE — mükerrer kayıt engeli
google_maps_url, google_rating, google_review_count
reviews_summary: text — Claude API Türkçe özet (maks 3 cümle)
verified: bool — admin onayı (default false)
verified_at, verified_by
satellite_confirmed: bool — uydu görüntüsü teyidi
last_synced_at: timestamptz — son Places API sync
is_active: bool — kullanıcıya gösterim (default true)
```
Migration: `docs/20260615_poi_google_integration.sql`

### `poi_reviews`
```
rating (1-5), comment, quick_tags (text[])
category_ratings: jsonb — Faz 2 için boş, şimdilik NULL
is_verified_visit: bool — geo-fence 200m kontrolü
review_type: 'verified'|'guest'
UNIQUE(poi_id, user_id)
```

### `poi_visit_logs` — Geo-fence için GPS geçmişi
### `poi_stay_events` — 3 saat+ park takibi (contextual öneri)

### RPCs:
- `get_pois_in_bbox(...)` — Bounding Box + akıllı sıralama formülü
- `check_poi_visit(...)` — 200m geo-fence doğrulama
- `get_nearby_listings_for_parked_driver(city)` — Contextual yük önerisi
- `get_parked_drivers_for_notification()` — Cron: 3h+ parkta bildirimi bekleyenler

Migration: `docs/20260610_poi_module.sql`

### `listings`
```
moderation_status: 'pending'|'approved'|'rejected'|'auto_published'|'archived'|'correction_needed'
status: 'active'|'passive'|'completed'|'expired'
is_shadow_banned, audit_score, internal_audit_logs (JSONB)
user_id (nullable), source: 'form'|'whatsapp'|'excel'
shadow_profile_id (nullable FK → shadow_profiles.id) — kayıtsız kullanıcı ilanları için
vehicle_id (nullable FK → vehicles.id, on delete set null) — ILAN_VER_ANALIZ B3 (29 Tem 2026)
contact_phone — 🔒 anon/authenticated için REVOKE edildi (SPRINT_01 L1e). Yalnız service-role.
```
> 🚨 **YAZMA YOLU TEK** (29 Tem 2026, `ILAN_VER_ANALIZ` W0/W1). Uygulamada `listings` INSERT'i
> **kopyalanmaz**. İki katmanlı bir kural:
> - **Next tarafındaysan → `lib/ilan-yaz.ts` / `ilanYaz()`.** Kanallar: `/ilan-ver` tekil form
>   (`app/ilan-ver/actions.ts` → yalnız auth kapısı), `/api/excel-import` toplu yükleme,
>   `app/api/whatsapp/route.ts` Twilio webhook'u.
> - **`ilanYaz()` kullanılamıyorsa → doğrudan `ilan_olustur()` RPC'si.** İki yol böyle:
>   `app/moderator/actions.ts` → `moderatorIlanOlustur()` (manuel giriş; `user_id` NULL ve
>   telefon profilden değil metinden geldiği için `ilanYaz()`'ın V2 sözleşmesine uymaz) ve
>   `supabase/functions/parse-listing/index.ts` (Deno; TS modülünü import EDEMEZ).
>
> Kendi iki ayrı INSERT'ini yazan bir yol, W0/W1'de kapatılan V1/V3/V5 deliklerini yeniden
> açar — excel-import'ta, WhatsApp webhook'unda ve moderatör panelinde tam olarak bu olmuştu.
>
> ⚡ **`public.ilan_olustur(p_listing jsonb, p_stops jsonb) → jsonb`** (29 Tem 2026, V5).
> İlan + duraklarını TEK transaction'da yazar, trigger'ın hesapladığı
> `id, audit_score, moderation_status, is_shadow_banned` ile döner. `security invoker`
> (bilerek — `definer` olsaydı ayrıcalık yükseltme yüzeyi olurdu), EXECUTE yalnız
> `service_role`da. Migration SIRASI: `docs/20260729_ilan_olustur_rpc.sql` →
> `docs/20260729_listings_vehicle_id.sql` (kolon + `create or replace` ile RPC'yi tazeler) →
> `docs/20260729_ilan_olustur_v2.sql`.
> **v2 (29 Tem 2026, W1+)** dört OPSİYONEL alan ekledi — `raw_post_id`, `shadow_profile_id`,
> `is_repost`, `reviewed_at` — böylece moderatör paneli ve Edge Function da bu RPC'yi
> kullanabiliyor. Ayrıca `listing_stops.vehicle_count` artık ÖNCE durağın kendi değerine
> bakıyor, yoksa ilan geneline (`arac_adet`) düşüyor; `moderation_status`/`status`/
> `trust_level` alan gelmezse `pending`/`passive`/`social`'a coalesce ediliyor.
> 🚨 **RPC'ye kolon eklerken ÜÇ çağıranı birlikte güncelle:** fonksiyon gövdesi,
> `lib/ilan-yaz.ts`, `app/moderator/actions.ts`, `supabase/functions/parse-listing/index.ts`.
> Fonksiyon jsonb aldığı için ayrışma **derleme zamanında görünmez** — alan sessizce NULL
> yazılır. Edge Function `tsconfig.json`'da `exclude`'da olduğu için `tsc` onu HİÇ görmez.
> ⚠️ `contact_phone` (28 Tem 2026, `SPRINT_01` L1e): PostgREST kolon yetkisi `anon` ve
> `authenticated` rollerinden alındı. İstemci tarafı hiçbir `select`/`update`/`insert`
> bu kolonu içeremez → `42501 permission denied`. Okuma/yazma yolları:
> `app/api/ilan/[id]/telefon`, `app/api/ilan/[id]/sahiplen`, `app/ilan/[id]/page.tsx`,
> `app/panel/actions.ts`, `app/moderator/actions.ts`. Migration:
> `docs/20260728_contact_phone_revoke.sql` ✅ çalıştırıldı (29 Tem 2026).
> 🚨 Migration `contact_phone` hariç **o anki** kolonlara grant verdi → `listings`'e sonradan
> eklenen kolonlar `anon`/`authenticated` için yetkisiz doğar. Yeni kolon = elle grant.

### `listing_stops` — 🚨 GÜZERGÂH ŞEMASI (varışlar burada)
```
listing_id (FK → listings.id), stop_order (1..n)
city, district (district nullable)
cargo_type, weight_ton, pallet_count, vehicle_count, notes
```
> 🚨 **Çıkış tek, varış çok.** Kalkış `listings.origin_city` / `origin_district`'te tek satır
> olarak durur; **uğrama/varış noktalarının hepsi `listing_stops` satırlarıdır.** Bir güzergâhı
> tek tabloda aramak yanlış sonuç verir.
> - Yazan: `supabase/functions/parse-listing/index.ts` (`ilan_olustur` RPC'si, lane grubu → `p_stops`),
>   `app/panel/actions.ts:96-157` (önce `delete .eq('listing_id')` sonra toplu insert — yani
>   duraklar **replace** ediliyor, patch değil).
> - Okuyan: `app/_components/HomeClient.tsx:696` varış filtresi
>   (`i.duraklar.some(d => d.sehir?.includes(varis))`) — bozuk yazım burada **doğrudan
>   kullanıcıya** "ilan bulunamadı" olarak yansır.
> - `get_nearby_listings_by_city` RPC varışı `listing_stops`'un **son durağından**
>   `DISTINCT ON` ile alıyor.
>
> ⚰️ **`listings.destination_city` ÖLÜ KOLON** (29 Tem 2026, W5). Uygulama kodunda tek bir
> yazma veya okuma yok. `app/panel/actions.ts` patch whitelist'inde bile yer almıyor.
> `docs/20260728_alias_kopya_temizligi.sql` BÖLÜM 6 bu ölü kolonu onarmaya çalışıp asıl canlı
> kolonu (`listing_stops.city`) atlıyor → **o bölümü olduğu gibi çalıştırma**, yerine
> `docs/20260729_alias_runbook.md` Adım 8'i kullan (dört kolonu birlikte onarıyor).
> Kolonun düşürülmesi `YAPILACAKLAR.md`'de bilet.
>
> ⚖️ **Aynı şehir içi taşıma meşrudur.** `origin_city = stops.city` bir bozukluk sinyali
> **değildir**. Sahte güzergâh parmak izi şudur: *katlanmış anahtar eşit, ham yazım farklı*
> (`Istanbul` → `İstanbul`). Ölçüm sorguları runbook Adım 0.1 / 0.2'de.

### `shadow_profiles` — Gölge Profil / CRM
```
phone (unique, +90 normalize), name, company_name, notes, status: 'active'|'blocked'|'converted'
converted_user_id (nullable FK → auth.users.id)
```
- Migration: `docs/20260601_shadow_profiles_crm.sql`
- Upsert RPC: `upsert_shadow_profile(p_phone text) → uuid`
- View: `shadow_profile_summary` (listing_count, last_listing_at, first_listing_at)
- Admin UI: `/admin/crm` — tablo + detay drawer (ilan geçmişi, isim/not/şirket düzenleme, durum yönetimi)
- API: `app/api/admin/crm/route.ts` (GET + PATCH), `app/api/admin/crm/[id]/route.ts` (GET detay)

### `users` — `role`, `is_active`, `user_type`, `phone_verified`, `company_name`, `ai_listing_quota_daily` (NULL = sistem default), `kvkk_onay_at`
> `kvkk_onay_at timestamptz` (28 Tem 2026, `SPRINT_01` K1) — KVKK aydınlatma metni + kullanım koşullarının onay anı. NULL = onay alınmamış (eski kayıt). `profil-tamamla` upsert'i yazıyor. ✅ Migration `docs/20260728_kvkk_onay.sql` çalıştırıldı (29 Tem 2026). Eski kullanıcılardan onay toplamak ayrı iş (panele tek seferlik modal gerekiyor, ticket açılmalı).
> ✅ `is_active` (29 Tem 2026 doğrulandı): DB default `true`, kolon nullable ama NULL satır yok.
> İstemci artık bu alanı **göndermiyor** (K2 beyaz listesinde yok) — default devreye giriyor.
> ⚠️ Kolon nullable olduğu için `.eq('is_active', true)` NULL satırları sessizce atlar.
> Opsiyonel sertleştirme: `alter table public.users alter column is_active set not null;`

### `auth_events` — Auth denetim izi (28 Tem 2026, `SPRINT_01` A1/A1b)
```
event      — giris_basarili | giris_hatali | otp_gonder | otp_hata | kayit | merge | cikis ...
method     — sifre | otp | google | magic_link
reason     — serbest metin (hata sebebi)
user_id    — nullable (başarısız girişte kullanıcı bilinmeyebilir)
ip, user_agent, created_at
```
- Insert **yalnız service-role** (`app/api/auth/log/route.ts`); select yalnız admin/moderator (RLS).
- ⛔ Telefon, e-posta, şifre **yazılmaz**.
- ✅ Migration: `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026) — tablo canlıda.
- 🔎 G1/G2 kotaları tetiklendiğinde `structuredLog('WARN','auth',…)` düşer; kalıcı iz için
  `login_failed` olayları bu tabloda birikir. "Şu IP'den 15 dakikada kaç hata?" sorgusu:
  `select ip_masked, count(*) from auth_events where event='login_failed'
   and created_at > now() - interval '15 min' group by 1 order by 2 desc;`

### `raw_posts`, `aliases`, `vehicles`

### `aliases` kolonözeti
```
alias      — ham/kısaltma form (küçük harf, normalize edilmiş)
normalized — standart karşılık (Gaziantep, İstanbul...)
type       — city | vehicle | body | blacklist | district
is_active  — parse motorunun görmesi için zorunlu
priority   — öncelik puanı (90+ = yüksek)
district   — ilçe adı (city tipi için, normalize ile ilişkilendirir)
created_by_ai / is_approved / llm_confidence / source_listing_ids  (SLH kolonları)
```
🚨 **W5 (29 Tem 2026) — yazım bütünlüğü.** `normalized`/`district` uzun süre iki yazımla birikti
(`Istanbul`/`İstanbul`, `Izmir`/`İzmir`, `Mugla`/`Muğla`, `Bingol`/`Bingöl`). Yazma yolu artık
`lib/alias-normalize.ts` üzerinden geçiyor. Bekleyen DB tarafı (henüz çalıştırılmadı):
- `docs/20260729_alias_runbook.md` → Adım 0-9 (ölçüm → homonim pasifleştirme → yazım düzeltme →
  NULL ilçe doldurma → `payas` → elle kararlar → doğrulama → geçmiş `listings` onarımı →
  katlanmış kopyaları pasifleştirme)
- `docs/20260729_alias_normalize_trigger.sql` → `aliases_normalize_trg` (BEFORE INSERT/UPDATE:
  `alias` lowercase+trim, `normalized`/`district` trim, boş `district` → NULL) +
  `aliases_katlanmis_anahtar_uniq`: **KISMİ** UNIQUE indeks
  `(type, translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')) WHERE is_active = true`
  ⚠️ İndeks ifadesi `lib/alias-normalize.ts::aliasKey()` ile birebir aynı olmak zorunda.
### `system_config` — `parse.auto_publish_score_max`, `parse.reject_score_min`, `llm.ai_listing_quota_default` ve diğerleri
### `safety_rules`, `blacklist`

---

## 4. MODERATÖR PANELİ

Sekmeler: ⏳ Bekleyenler / ✅ Onaylananlar / ❌ Reddedilenler / 💤 Pasifler / 📋 Hepsi / 🔍 Çözümsüz / 🗄️ Arşiv / 🔴 Riskli

Toplu işlemler: `approve | reject | passive | archive | unarchive | shadow_ban | shadow_ban_kaldir | correction_needed`

---

## 5. GÜVENLİK & DENETİM (Audit Engine V3)

Eşikler `system_config.parse.*` anahtarlarından okunur (DB trigger + `/api/ilan/duzelt` aynı helper'ı kullanır: `lib/auditLimits.ts`).
Varsayılan: `auto_publish_score_max=31`, `reject_score_min=71`.

| Puan | INSERT | /api/ilan/duzelt |
|---|---|---|
| < auto_publish_score_max | Yayında | Otomatik approved+active |
| auto..reject arası | Mod kuyruğu | pending+passive |
| ≥ reject_score_min | shadow_ban + archived | correction_needed kalır |

Sprintler 1–5: ✅

---

## 6. WHATSAPP PARSE PIPELINE

```
ZIP/TXT → raw_posts → DB trigger → parse-listing Edge Fn → listings → audit trigger
```

---

## 7. API ROUTES

| Route | Açıklama |
|---|---|
| `/api/moderator/toplu-islem` | Bulk ops |
| `/api/ilan/duzelt` | Kullanıcı düzeltme + re-scan |
| `/api/admin/guvenlik` | safety_rules + blacklist CRUD |
| `/api/excel-import` | Excel toplu yükleme. `POST` JSON, `action: 'preview' \| 'commit'`. Sözleşme: `lib/toplu-yukle-sozlesme.ts`. Kimlik OTURUMDAN (`userId` gövdede YOK). Kayıt `ilanYaz()` üzerinden → V1/V3 aynen geçerli. `MAX_SATIR=300`, `MAX_ILAN=50`, `maxDuration=60` |
| `/api/auth/tekil-kontrol` | telefon/tckn/vkn tekillik (service role) |
| `/api/auth/log` | 🔒 Auth denetim izi → `auth_events` (service role). Fire-and-forget, IP+UA yazar, telefon/şifre yazmaz |
| `/api/auth/otp` | 🔒 **TEK** SMS OTP gönderim yolu (G2). POST + Origin. 3 kota: numara 1/60sn, IP 5 farklı numara/saat, IP 15 toplam/saat. 429 + `Retry-After` |
| `/api/auth/giris` | 🔒 **TEK** şifreli giriş yolu (G1). POST + Origin. Kota: e-posta 5 hata/15dk, IP 20 hata/15dk. Başarıda sayaç sıfırlanır, cookie SUNUCUDA yazılır, `{ rol }` döner |
| `/api/auth/dogrulama-tekrar` | 🔒 Doğrulama e-postasını tekrar gönder (A6). POST + Origin. 3 kota: adres 1/60sn, IP 5 farklı adres/saat, IP 10 toplam/saat. ⚠️ Yanıt **daima aynı** (hesap sayımına kapalı); sayaçlar hata yolunda da işlenir |
| `/api/ilan/[id]/telefon` | 🔒 **TEK** telefon kaynağı. GET, authed + profil tam + hesap aktif + ilan yayında. `logPhoneAccess`, 20/dk, `no-store` |
| `/api/ilan/[id]/sahiplen` | 🔒 GET maskeli numara, POST `{adim:'gonder'\|'dogrula'}`. İlan başına 60 sn SMS cooldown (429 + `Retry-After`) |
| `/api/parse-text` | Tekil kullanıcı metnini Haiku ile JSON'a çevirir + per-user günlük quota kontrolü (429) |
| `/api/whatsapp` | Twilio WhatsApp webhook — kayıt/kota kontrolü + LLM parse + ilan oluştur |
| `/api/admin/kullanici` | role / is_active / moderator_sources / **ai_listing_quota_daily** PATCH |
| `/api/admin/crm` | Shadow Profile listesi (GET) + güncelle (PATCH) |
| `/api/admin/crm/[id]` | Shadow Profile detay + ilan geçmişi (GET) |
| `/api/admin/radar` | Radar Intelligence: rota tarama, lead listesi, phone history (GET) |
| `/api/poi` | POI listele (GET: bbox + filtre + sıralama + is_active), yeni POI ekle (POST) |
| `/api/poi/[id]` | POI detay + son 10 yorum (GET), güncelle (PATCH: +satellite_confirmed, is_active, reviews_summary) |
| `/api/poi/[id]/review` | Yorum ekle + geo-fence doğrulama (POST) |
| `/api/admin/poi-import` | Google Places'ten il+kategori bazlı veri çek (POST), kategori listesi (GET) |
| `/api/admin/poi-import/[id]/summarize` | POI için Claude yorum özeti üret (POST) |
| `/api/listings/yakin` | Yakınımdaki Yükler: lat/lng → en yakın il (offline haversine) → o ildeki aktif ilanlar (GET) |

---

## 8. PROXY MANTIĞI

```
Açık rotalar: /giris, /auth/, /profil-tamamla, /nasil-calisir, /hakkimizda,
              /kvkk, /kullanim-kosullari, /api/, ...
1. Açık rota → geç
2. Giriş yok + korumalı → /giris?redirect=
3. Giriş var:
   - maybeSingle() ile users.select('user_type, role, merged_into')
   - merged_into dolu (emekli oturum) → /auth/devir?redirect=… (COOKIE SİLİNMEZ — devir onları okur)
   - role=admin|moderator → direkt geç
   - user_type yoksa:
     - aynı e-posta/telefonla KAYITLI başka hesap var mı? → varsa /giris?hesap=eslesme (self-heal merge)
     - yoksa → /profil-tamamla
```

> **KRİTİK auth tuzağı (22 Tem 2026):** Bir kişinin birden fazla auth kimliği olabilir — Google/e-posta bir `auth.users` satırı (`email` dolu, `phone` null), telefon (SMS OTP) AYRI bir satır (`phone` dolu, `email` null), FARKLI `id`'lerle. `public.users` satırı yalnızca birinde (genelde ilk kayıt olunanda) bulunur. Diğer kimlikle girildiğinde `auth.uid()` ≠ `users.id` → proxy satır bulamaz. **Eskiden** bu doğrudan `/profil-tamamla`'ya atıyor, oradan `users_email_key` / duplicate hesap doğuyordu. **Artık** proxy uzlaştırma yapıyor: satır yoksa aynı e-posta/telefonla kayıtlı canlı hesabı arar, bulursa girişe yönlendirir; `app/giris/page.tsx` açılış `useEffect`'i oturumu otomatik `merge`/`switch-account` ile canlı hesaba bağlar. Telefon eşleştirmesi 4 formatı da dener: `+905xx`, `905xx`, `05xx`, `5xx` (RLS `users` üzerinde okumaya izin verdiği için client/proxy bu aramayı yapabiliyor).

---

## 9. KURALLAR & TUZAKLAR

- 🚨 **Güzergâh sorgusu yazarken `listings`'i tek başına sorgulama** (29 Tem 2026, W5).
  Kalkış `listings.origin_city`'de, varışlar `listing_stops` satırlarında. `listings`
  içindeki `destination_city` **ölü kolondur** — dolu görünse bile kimse okumaz.
  Bir güzergâh sorgusu `JOIN public.listing_stops s ON s.listing_id = l.id` içermiyorsa
  yanlıştır. Bu tuzak bir kez gerçek zarar verdi: eski temizlik script'i (BÖLÜM 6) ölü
  kolonu onarıp kullanıcıya görünen `listing_stops.city`'yi atlamıştı.
- ⚖️ **"Aynı şehir" bozukluk sinyali değildir** (29 Tem 2026, W5). Şehir içi taşıma meşru
  bir hizmet; `origin_city = stops.city` olan ilanların çoğu gerçektir. Sahte güzergâhın
  parmak izi **yazım farkıdır**: katlanmış anahtar eşit ama ham string farklı
  (`Istanbul` vs `İstanbul`). Veri kalitesi ölçerken bu ikisini karıştırma — biri
  düzeltilecek hasar, öteki korunacak iş.
- 🚨 **`onAuthStateChange` callback'i İÇİNDE `await supabase.*` ÇAĞIRMA** (A8, 29 Tem 2026).
  Callback, Supabase'in auth kilidi (`navigator.locks`) tutulurken çalışır; içeriden yapılan
  her `supabase.from(...)` / `getSession()` aynı kilidi bekler → **deadlock**. Belirti:
  konsolda `Lock "lock:sb-...-auth-token" was not released within 5000ms`; oturum çerezi
  geçerli olmasına rağmen istemci kendini çıkış yapmış sanır (navbar "Giriş Yap" gösterir,
  ama `/admin` gibi sunucu tarafı rotalar çalışır — onlar cookie'yi sunucuda okuyor).
  Doğrusu: callback yalnız senkron state yazar, DB işi `setTimeout(() => { ... }, 0)` ile
  kilidin dışına atılır. Uygulandığı yerler: `app/_components/HomeClient.tsx`,
  `app/giris/page.tsx`.
- Abone olunduğu anda `INITIAL_SESSION` bir kez tetiklenir → ayrıca `getSession()` çağırmaya
  gerek yok (ve o çağrı da kilide takılabilir).
- 🚨 **Sunucuda oturum devrederken `action_link` DEĞİL `hashed_token` kullan** (A10, 29 Tem 2026).
  `admin.generateLink()` iki şey döner: `properties.action_link` **implicit flow**tur
  (`#access_token=…`) — token yalnız tarayıcıda işlenir, **SSR cookie'si eski oturumda kalır**;
  proxy bir sonraki istekte kullanıcıyı yine eski kimlikte görür → sonsuz döngü.
  Doğrusu: `properties.hashed_token` alınıp cookie yazan `createServerClient` üzerinden
  `supabase.auth.verifyOtp({ type: 'magiclink', token_hash })` çağrılır; oturum doğrudan
  sb- cookie'lerine yazılır. Uygulandığı yer: `app/auth/devir/route.ts`.
  (`app/api/auth/switch-account/route.ts` hâlâ `action_link` döndürüyor — istemci tarafı
  akış olduğu için orada sorun çıkarmıyor, ama sunucu tarafında ASLA o yolu kullanma.)
- Supabase implicit-flow linki oturumu `#access_token=…&refresh_token=…` olarak bırakır ve
  client bunu okuduktan sonra **URL'yi TEMİZLEMEZ** — token'lar adres çubuğunda, tarayıcı
  geçmişinde ve kullanıcının kopyaladığı her linkte kalır. `HomeClient.tsx` oturum çözüldükten
  sonra `history.replaceState` ile fragment'ı siliyor (emniyet kemeri; asıl çözüm `/auth/devir`).
- Emekli oturumu `/auth/devir`'e gönderirken **sb- cookie'lerini silme**: devir, devri
  yetkilendirmek için emekli oturumun `merged_into` zincirini okumak zorunda. Temizliği
  (kurtarılamayan hâllerde) devir route'u kendisi yapar.
- 🚨 **Ücretli veya kaba-kuvvete açık auth işlemlerini İSTEMCİDEN çağırma** (G1/G2, 29 Tem 2026).
  `signInWithOtp` (SMS = para) ve `signInWithPassword` (sözlük saldırısı) aylarca doğrudan
  tarayıcıdan, herkese açık anon key ile çağrılıyordu. İstemcideki sayaçlar (sessionStorage)
  saldırgan için yok hükmünde. İkisi de artık sunucu route'unda: `/api/auth/otp`,
  `/api/auth/giris`. Yeni bir auth çağrısı eklerken kuralı tekrarla: **tetikleyici sunucuda,
  kota sunucuda; istemcideki bekleme yalnız UX.**
- Kota kovaları paylaşılabilir olmalı: `/api/auth/otp` ile `/api/ilan/[id]/sahiplen` **aynı**
  `'otp-ip-numara'` kovasını kullanır. Ayrı kova verseydik saldırgan iki uç nokta arasında
  gidip gelerek kotayı ikiye katlardı. Yeni bir SMS tetikleyicisi eklersen aynı kovaya bağla.
- Kotalarda önce `sayma: true` ile **BAK**, işlem gerçekten başarılı/başarısız olduktan sonra
  kaydet. Aksi halde sağlayıcı hatası (Twilio down) masum kullanıcıyı kilitler. Simetrik kural:
  giriş kotası yalnız **başarısız** denemeyi sayar ve başarıda `kotaSifirla` ile temizlenir;
  kilitliyken gelen istek sayaca YAZILMAZ, yoksa saldırgan istek atmaya devam ederek kurbanı
  süresiz kilitli tutar.
- Kota anahtarı olarak e-posta kullanırken **`trim().toLowerCase()`** uygula — aksi halde
  `Ali@X.com` / `ali@x.com` ayrı kovalara düşer ve sayaç harf büyüklüğü değiştirilerek sıfırlanır.
- ⚠️ `lib/kota.ts` sayaçları **process belleğinde**. Vercel'de çok instance → gerçek limit
  ≈ (limit × instance sayısı); deploy/soğuk başlangıç sıfırlar; `x-forwarded-for` proxy
  arkasında güvenilir, doğrudan erişimde taklit edilebilir. Tek savunma katmanı olarak sayma.
  Trafik artınca `kotaDene`'nin gövdesini Vercel KV / Upstash Redis'e taşı — imza değişmez.
- Oturum SUNUCUDA açıldığında (`/api/auth/giris`, `/auth/devir`) istemciye dönüşte
  `router.push` değil **tam sayfa yüklemesi** (`window.location.assign`) yap: tarayıcıdaki
  Supabase istemcisinin bellek içi durumu bayat kalabilir, tam yükleme header/proxy/server
  component'leri aynı oturuma oturtur.
- `maybeSingle()` — callback, proxy, actions her yerde
- `is_shadow_banned = false` — page.tsx + u/[username]/page.tsx zorunlu
- Audit trigger sadece INSERT; re-scan → `/api/ilan/duzelt`
- `correction_needed` CHECK → `docs/20260505_correction_needed.sql`
- Toplu işlem + archived → service role zorunlu
- Server action → ayrı dosya + `'use server'`
- Vercel env → dashboard; `.next` cache → `rm -rf .next`
- Supabase → Redirect URLs'e production URL eklenmeli
- **Ağır/çoklu-dosya işleyen API route'ları** (`whatsapp-parse`, `learn-aliases`, `crm/[id]/analiz`) → `export const maxDuration = 60` şart; yoksa Vercel default timeout'ta düz-metin hata sayfası ("An error occurred with your deployment...") döner ve frontend'in `res.json()` çağrısı "Unexpected token" hatasıyla patlar
- **Frontend fetch + `.json()` pattern'i** → önce `res.text()` al, sonra `JSON.parse` dene (try/catch); Vercel platform hataları (413/504) JSON değil HTML/düz-metin döner
- **`write_file` tüm dosyayı ezer** — küçük değişiklikler için `str_replace` kullan
- **İnline component anti-pattern**: Parent fonksiyonu içinde tanımlanan component'leri JSX olarak çağırmak (`<EditForm />`) her render'da yeni component tipi yaratır → input focus kaybolur, cursor başa döner. Çözüm: fonksiyon çağrısı (`{EditForm({})}`) veya parent dışına taşı.
- **WhatsApp ZIP timeout — `maxDuration=60` olsa bile aşılabilir**: `whatsapp-parse` route'unda dosya sayısı az olsa bile ("grup 1/1") 504 timeout görülebiliyor — sebep dosya içeriği değil, **medyalı (fotoğraf/video dahil) WhatsApp export**'unun çok büyük olması (yüzlerce MB–GB); `request.formData()` + `file.arrayBuffer()` bu dosyayı sunucuda tam okuyordu ve bu süre 60sn'lik execution time'a dahildi. İlk müdahale (22 Tem 2026, sabah) sadece boyuta duyarlı gruplama + kullanıcıya uyarıydı — yetersiz kaldı, dosya sunucuya gitmeden aynı hata devam etti. **Asıl çözüm (22 Tem 2026, `WhatsappYukle.tsx`)**: ZIP artık sunucuya YÜKLENMEDEN ÖNCE tarayıcıda `JSZip` ile açılıyor (`zipDenMetinCikar`), sadece içindeki sohbet `.txt`'i çıkarılıp `.txt` olarak sunucuya gönderiliyor — medya (foto/video) hiç network'e binmiyor, Vercel'in 60sn'lik süresine artık sadece küçük metin okuma/parse/DB adımları giriyor. Ayıklama sırasında buton "📦 Medya ayıklanıyor..." gösteriyor (tarayıcı tarafı, süre sınırı yok). Sohbet txt'i zip içinde bulunamazsa veya zip bozuksa orijinal dosya sunucuya gönderilip eski davranışa (sessizce atlama / hata) düşülüyor. **Ek optimizasyon (22 Tem 2026, aynı gün, kullanıcı isteğiyle)**: Eski/uzun süredir aktif gruplarda medya olmasa bile tüm sohbet geçmişi (yıllarca) yine de yükleniyordu — sunucu zaten `saat_filtre` cutoff'undan eski mesajları atıyordu ama bu filtre gönderdikten SONRA uygulanıyordu. Artık `dosyaHazirla()` fonksiyonu hem zip'ten çıkan hem düz `.txt` metnini, göndermeden önce tarayıcıda `eskiIcerigiKirp()` ile kırpıyor: metin SONDAN başa doğru satır satır taranıyor (sunucudaki `parseChatTxt` ile birebir aynı `TS_ANDROID`/`TS_IOS` regex'leri kullanılarak), cutoff'tan (+6 saat güvenlik payı) eski ilk mesaj bulununca tarama duruyor ve öncesi tamamen atılıyor — böylece eski geçmişin tamamını okumaya/işlemeye hiç gerek kalmıyor, payload sadece işe yarayan son kısım kadar kalıyor.

- **WhatsApp sohbet parser'ı TEK KAYNAKTADIR: `lib/whatsapp/chatParser.ts`** (28 Tem 2026). Öncesinde aynı regex/tarih mantığı hem `api/whatsapp-parse/route.ts` hem `WhatsappYukle.tsx` içinde elle senkron tutuluyordu; ayrıştıklarında tarayıcı doğru mesajı kırpıp atıyor, sunucu farklı yorumluyordu — kayıp sessizdi. Kopya mantık YAZMA, modülü import et. Testler: `npm run test:parser`.
- **`new Date("2026-07-28T14:30")` (offset'siz) HOST saat dilimine göre yorumlanır** — tarayıcı UTC+3, Vercel UTC olduğu için aynı mesaj 3 saat farklı zamana düşüyordu; cutoff sınırındaki ilanlar bu yüzden sessizce eleniyordu. `chatParser` tüm zaman damgalarını sabit `+03:00` varsayarak çözer (`VARSAYILAN_TZ`); manuel `new Date(...)` ile tarih kurma.
- **WhatsApp export formatı telefon lokaline göre değişir** — ayraç `.`/`/`/`-`, yıl 2 veya 4 hane, saat 24h veya 12h (`ÖÖ/ÖS/AM/PM`), iOS köşeli parantezli `[...]` Android tireli, AM/PM öncesinde görünmez **U+202F dar boşluk**. Eski regex sadece `dd.mm.yyyy` + 24h + iOS/Android'in dar bir alt kümesini tanıyordu; tanımayan formatlarda dosyanın TAMAMI 0 mesajla dönüyordu (hata yok, sadece "0 mesaj"). `satiriTemizle()` görünmez Unicode'ları (bidi/zero-width/NBSP) temizler — regex'ten ÖNCE çağrılmalı.
- **Türkçe normalize ederken `İ/I` `toLowerCase()`'ten ÖNCE dönüştürülmeli**; sistem mesajı filtresi aksansız karşılaştırma yapmazsa "uçtan uca" ile "uctan uca" eşleşmez ve sistem mesajları ilan sanılır.
- **`raw_posts` chunk INSERT'te tek `23505` tüm chunk'ı düşürür** — eski kod `continue` diyordu, 100 satırın 99'u sessizce kayboluyordu. Artık chunk `23505` alırsa satır satır retry edilir; `23505` dışı hatalar `insert_failed` + `errors[]` ile response'a ve `structuredLog`'a yansır. (`upsert` + `onConflict` kullanılmadı: `raw_posts`'un unique constraint kolonları dokümante değil.)
- **PostgREST insert dönüşünün SIRASI garanti değildir** — `inserted[i]` ↔ `meta[i]` eşlemesi yapma; satırlar çakışma nedeniyle eksik dönerse eşleme kayar ve YANLIŞ kayıtlar işlenir. Doğal anahtarla (`clean_hash|contact_phone|message_date`) map'le.
- **Repost ilanının TEK üreticisi `parse-listing`'dir** (28 Tem 2026). Öncesinde route `repostListings()` ile orijinal ilanı kopyalıyordu ama `raw_posts` INSERT trigger'ı zaten `parse-listing`'i çağırıyordu → tek mesaj İKİ ilan. `repostListings` kaldırıldı; `parse-listing` listing insert'inde `is_repost: rawPost.is_repost === true` ile bayrağı taşıyor. ✅ Doğrulandı (28 Tem 2026): `on_raw_post_insert AFTER INSERT ON public.raw_posts FOR EACH ROW EXECUTE FUNCTION trigger_parse_listing()` — **WHEN koşulu yok**, her satır için çalışıyor. Yani route'un ayrıca ilan üretmemesi doğru karardı.
- **PostgREST `.in()` filtreyi URL'e gömer** — sınırsız dizi verme. Binlerce 32 karakterlik hash on binlerce karakterlik URL üretir; sorgu ya çok yavaşlar ya reddedilir. `whatsapp-parse` içindeki `parcala()` yardımcısı ile `IN_PARCA_BOYU = 150`'lik parçalara böl.
- **Supabase update/insert'lerde sınırsız `Promise.all` ATMA** — bağlantı havuzu doyar, istekler sıraya girer ve toplam süre doğrusal olmayan şekilde patlar. `sirayla(ogeler, ESZAMANLI=6, isle)` ile eşzamanlılık tavanı koy.
- **`raw_posts`'un benzersizlik kuralı `(clean_hash, message_date)`'tir — `clean_hash` TEK BAŞINA unique DEĞİL** (28 Tem 2026, `pg_indexes` ile doğrulandı). Kurallar `CONSTRAINT` değil `CREATE UNIQUE INDEX` ile tanımlı, o yüzden `pg_constraint`'te görünmezler; `pg_indexes`'e bak. Gerçek indeksler: `idx_raw_posts_hash_msgdate UNIQUE (clean_hash, message_date) WHERE clean_hash IS NOT NULL` (bağlayıcı olan) ve `raw_posts_dedup_idx UNIQUE (clean_hash, contact_phone, message_date) WHERE clean_hash IS NOT NULL AND contact_phone IS NOT NULL`. `idx_raw_posts_clean_hash` unique DEĞİL. (Eski `idx_raw_posts_hash_day (clean_hash, post_date)` 28 Tem 2026'da düşürüldü.)
- **Batch-içi tekilleştirme anahtarı DB'nin unique indeksiyle BİREBİR aynı olmalı** — bu 23505 fırtınasının asıl sebebiydi: route'un anahtarı `hash__telefon__tarih`, DB'ninki `(clean_hash, post_date)` idi. Aynı gün aynı metni farklı iki kişi paylaşınca (nakliye gruplarında rutin) uygulama ayrı satır sanıyor, DB tüm chunk'ı reddediyordu. Aynı hata kurtarma bloğunda da vardı: sadece `clean_hash`'e bakmak, başka güne ait MEŞRU repost'u da eliyordu. Çakışma testi her zaman unique indeksin ÇİFTİ üzerinden yapılmalı (bugün `(clean_hash, message_date)`).
- **Kısmi unique indeks (`WHERE ...`) `upsert`/`onConflict` ile kullanılamaz** — PostgreSQL kısmi indeksi `ON CONFLICT` hedefi olarak ancak predicate'i ima eden bir `WHERE` varsa çıkarsar, PostgREST bunu üretmez. `raw_posts`'un iki unique indeksi de kısmi olduğu için constraint-agnostik 23505 yakalaması korunmak zorunda.
- **Alias eşleşmesi SUBSTRING ile yapılmamalı** (28 Tem 2026). `gatekeeper_sync` `norm.includes(aliasNorm)` kullanıyordu: `"lojistik"` içindeki `"ist"` → İstanbul, `"getirin"` içindeki `"tir"` → TIR, `"balyası"` içindeki `"balya"` → Balıkesir. Neredeyse her mesaj 2+ şehir bulmuş sayılıyor, `isAd` kuralı (`telefon && (araç || şehir>=2)`) fiilen **"telefon var mı"**ya iniyordu — gatekeeper devre dışıydı. Düzeltme: token eşitliği + Türkçe hal eki soyma (`ekSoy`), tokenlar `[\s.>-]` sınırlarından ayrılır, 3 harften kısa alias yok sayılır. `parse-listing/findPlaces` zaten token bazlıydı; iki taraf hizalandı.
- **İlçe adları günlük Türkçe kelimelerle çakışıyor (homonim)** — `araç`→Kastamonu, `olur`→Erzurum, `pazar`→Rize, `perşembe`→Ordu, `merkez`→onlarca il. Token eşleşmesi bunları TEMİZLEMEZ, veri tarafında pasifleştirmek gerekir: `docs/20260728_alias_homonim_temizligi.sql`. Hem gatekeeper'ı hem `parse-listing`'in gerçek güzergâh çıkarımını bozar.
- 🚨 **LLM prompt'unun ÖRNEKLERİ kuraldan güçlüdür — bozuk örnek bozuk veri üretir** (29 Tem 2026, `SPRINT_01` W5/D1). `learn-aliases` prompt'unda kurallar Türkçe doğru yazımı istiyordu ama JSON **örnekleri** ASCII'ye indirgenmişti (`"Eskisehir"`, `"Istanbul"`, `"Tekirdag"`). Model kuralı değil örneği taklit etti; `aliases.normalized` aylarca iki yazımla doldu (`Istanbul` 13 satır / `İstanbul` 154 satır). **Kural:** prompt'a örnek yazarken örneğin kendisi üretmek istediğin çıktının birebir doğru hali olmalı. Ayrıca prompt'a mevcut kayıtlar bağlam olarak veriliyorsa "listede eski/bozuk kayıtlar olabilir, onları örnek alma" satırı şart — yoksa bozulma kendi kendini besler.
- 🚨 **Karşılaştırma anahtarı ile SAKLANAN değer aynı şey değildir** (29 Tem 2026, `SPRINT_01` W5/D2+D4). `Istanbul` ve `İstanbul` **aynı şehir** ama string eşitliği bunu göremez. `parse-listing/findPlaces`'teki `seen` seti ham `normalized` üzerinde çalıştığı için iki yazım İKİ AYRI ŞEHİR sayılıyordu; `sameCity` koruması devreye girmiyor ve **sahte `İstanbul→İstanbul` ilanı** kaydediliyordu (aynı sebeple şehir filtresi de ilanların bir kısmını hiç göstermiyordu). Düzeltme: her karşılaştırma/dedup anahtarı katlanmış formdan geçer (`aliasKey` / `yerKey`), **saklanan değer Türkçe kalır**. ⚠️ Katlama fonksiyonu (`lib/alias-normalize.ts::aliasKey`) ile DB indeks ifadesi (`docs/20260729_alias_normalize_trigger.sql`) BİREBİR aynı olmalı: `translate(lower(replace(alias,'İ','i')),'ıçğöşü','icgosu')`. Sıra kritik — `İ` (U+0130) **önce** düz `i`ye çevrilmeli, yoksa Postgres `lower()` onu `i` + U+0307 olarak iki karaktere açar ve JS `toLowerCase()` ile ayrışır → uygulama "çakışma yok" derken DB 23505 atar.
- ⚠️ **`normalized` her zaman şehir DEĞİL — otomatik yazım düzeltmesi yapma** (29 Tem 2026, W5/D2). `type='vehicle'` satırlarında `normalized` doğrudan `vehicle_type` olarak ilana yazılıyor; "tir" → "Tir" yapmak eşleşmeyi bozar. Bu yüzden ne `normalizeAliasFields` ne de DB trigger'ı `normalized`/`district` üzerinde büyük harfe çevirme / ASCII katlama yapıyor — yalnız boşluk temizliği. Yanlış yazım sessizce düzeltilmez, `aliasCakismaBul` **409 ile admine sorar** (öneri: çoğunluk yazımı — 154 satır `İstanbul` varken 13 satırlık `Istanbul` kazanmasın).
- 🚨 **`alias` kolonundaki UNIQUE kısıtı HAM string üzerinde — katlanmış kopyaları engellemez** (29 Tem 2026, W5/D3). `Gebze`/`GEBZE`/`gebze`, `Çorlu`/`çorlu`/`corlu`, `Torbali`/`torbali`/`torbalı` üç ayrı satır olarak duruyor ve hepsi tek katlanmış anahtara düşüyor. Sonucu: planlanan tam UNIQUE indeks **kurulamaz** (23505). Ayrıca temizlik script'i bu satırları silmiyor, yalnız `normalized`/`district`'i tutarlı yapıyor — yani veri temizliği tamamlansa bile önkoşul karşılanmıyor. Çözüm iki parçalı: önce fazlalıkları `is_active = false` yap (runbook Adım 9; `row_number() OVER (PARTITION BY type, katlanmış ORDER BY id) > 1` — **silme yok**, `findPlaces` zaten `.order('id')` ile küçük id'yi seçtiği için bugünkü davranış değişmez), sonra indeksi **kısmi** kur (`WHERE is_active = true`) — pasifleştirilmiş kopyalar tabloda durduğu için tam indeks onları da ihlal sayardı.
- **PostgREST tek sorguda EN FAZLA 1000 satır döndürür — ve bunu SÖYLEMEZ** (28 Tem 2026). Supabase'in `db.max-rows` ayarı. Sınırı aşan `select()` hata vermez, sessizce kesilir. `aliases` tablosu 1887 aktif satıra çıkmıştı; hem `app/api/whatsapp-parse` gatekeeper'ı hem `supabase/functions/parse-listing` şehir/araç tespitini alias'ların **%47'sini hiç görmeden** yapıyordu. Üstelik `ORDER BY` olmadığı için hangi 887 satırın düştüğü belirsizdi → aynı mesaj farklı zamanlarda farklı ayrıştırılabiliyordu. Düzeltme: `.range()` ile sayfalama + `.order('id')` (sıralama olmadan sayfalar çakışır/atlar). **Kural: bir tabloyu "hepsini çek" niyetiyle okuyan her sorgu sayfalanmalı.**
- **`raw_posts.post_date` KALDIRILDI** (28 Tem 2026). Tek tarih otoritesi `message_date`; unique indeks de onun üzerinde. Kayıt: `docs/20260728_raw_posts_post_date_sadelestirme.sql`. Not: eski 1543 satırda `post_date` mesajın günü değil İÇE AKTARMA günüydü (12–20 May 2026 penceresi) — kolon baştan güvenilmezdi.
- **Telefon geriye-doldurma içe aktarmanın PARÇASI DEĞİL** — `POST /api/raw-posts/telefon-doldur` ayrı işi yapar. Route'un içindeyken satır başına 2 UPDATE ile süre bütçesini yiyordu ve içe aktarmanın doğruluğuna hiç katkısı yoktu. Telefon regex'i tek kaynakta: `lib/whatsapp/telefon.ts` (⚠️ `supabase/functions/parse-listing/index.ts` içinde Deno tarafında ikinci bir kopya var, Deno/Next sınırı yüzünden import edilemiyor — birini değiştirirken diğerini de güncelle).
- **Vercel'de 60 sn aşılırsa fonksiyon ÖLDÜRÜLÜR ve JSON değil HTML döner** — bu yüzden ağır route'lar kendi süre bütçesini tutmalı. `whatsapp-parse`: `SURE_BUTCESI_MS = 45_000`; dolduğunda döngü kırılır ve `{ tamamlanmadi: true, islenmeyen: N }` ile **geçerli JSON** döner. Sessiz ölüm yerine kısmi başarı raporlanır.
- **Parti boyu sihirli sayıyla ayarlanmaz — istemci ikiye böler (bisection)** (28 Tem 2026). `WhatsappYukle.tsx` sıralı döngü yerine iş kuyruğu kullanır: 504/413 ya da `tamamlanmadi` gelirse parti ikiye bölünüp kuyruğun başına konur; grupta tek dosya kaldıysa `dosyayiBol()` dosyayı **mesaj başlığı sınırından** (satır ortasından değil) ikiye ayırır. `MAX_BOLUNME = 8`. Bu güvenlidir çünkü tekilleştirme hash tabanlı → yeniden gönderim idempotent, yazılmış satırlar `skipped` döner.
- **`requireAdmin()` API route'ta KULLANILMAZ** — içeride `redirect()` çağırır, bu `NEXT_REDIRECT` fırlatır ve route 500 döner. API route'larda `requireStaff()` kullan (`{ ok, user }` / `{ ok, status, error }` döner).
- **RLS SATIR bazlıdır, KOLON bazlı DEĞİLDİR** (28 Tem 2026, `SPRINT_01` L1e). İki ayrı sonucu var, ikisi de bizi ısırdı: **(1) Okuma:** satır herkese açıksa o satırın *yetkili* her kolonu da okunur — `contact_phone` aylarca `GET /rest/v1/listings?select=contact_phone` ile anon key üzerinden çekilebiliyordu; arayüzde göstermemek koruma değildi. Çözüm PostgREST kolon yetkisini revoke etmek. **(2) Yazma:** "sadece kendi satırın" politikası, gövdeye `role: 'admin'` / `trust_level: 'verified'` / `moderation_status: 'approved'` eklemeyi **engellemez**. İstemciden gelen her `update`/`upsert` `'use server'` action içinde **kolon beyaz listesinden** geçmeli. Örnekler: `app/panel/actions.ts`, `app/profil-tamamla/actions.ts`.
- **Tablo geneline verilmiş `GRANT`, kolon bazlı `REVOKE`'u EZER** (28 Tem 2026). `revoke select (contact_phone) on listings from anon;` tek başına **no-op**'tur. Doğrusu: önce tablo geneli yetkiyi al, sonra hedef kolon hariç tüm kolonları `information_schema.columns` üzerinden programatik geri ver. Örnek: `docs/20260728_contact_phone_revoke.sql`.
- 🚨 **Kolon bazlı grant, `listings`'e SONRADAN eklenen kolonları KAPSAMAZ** (29 Tem 2026, `SPRINT_01` L1e). `20260728_contact_phone_revoke.sql` tablo geneli yetkiyi alıp `contact_phone` hariç **o an var olan** kolonları tek tek geri verdi. Artık `public.listings` kolon bazlı yetkilendirilmiş bir tablodur: yeni bir kolon eklendiğinde `anon`/`authenticated` o kolon için **yetkisiz doğar** ve ilk okuma/yazmada `42501 permission denied for column …` ile patlar — üstelik hata çoğu zaman uygulama katmanında "kayıt olmadı" gibi görünür. **Kural:** `alter table public.listings add column …` yazan her migration'a hemen ardından `grant select, insert, update (yeni_kolon) on public.listings to authenticated;` (+ herkese açıksa `grant select (yeni_kolon) … to anon;`) ekle. Kontrol: `select column_name from information_schema.columns c where table_name='listings' and not exists (select 1 from information_schema.column_privileges p where p.table_name='listings' and p.column_name=c.column_name and p.grantee='authenticated');`
- **Kod ve migration'ın SIRASI önemlidir** — yetki daraltan migration'lar **deploy'dan SONRA**, yeni kolon/tablo açan migration'lar **deploy'dan ÖNCE** çalıştırılır. Ters sırada ya kod olmayan kolona yazar ya da yeni kod var olmayan yetkiyle çalışır. Migration dosyasının başına hangisi olduğunu YAZ.
- **Bellek içi rate limit tek instance varsayar** — `api/ilan/[id]/telefon` (20/dk) ve `api/ilan/[id]/sahiplen` (60 sn OTP cooldown) `Map` kullanıyor. Çok instance'a ölçeklenirse limit instance sayısı kadar gevşer. Redis'e taşıma kararı `SPRINT_01` G2 ile birlikte. Ayrıca sayaç yalnızca işlem **gerçekten** başarılıysa başlatılmalı — sağlayıcı hatası kullanıcıyı kilitlememeli.
- **Recovery oturumu ≠ normal oturum, ama Supabase ikisini de kabul eder** (28 Tem 2026, `SPRINT_01` R1). Tarayıcıda normal bir oturum açıkken `supabase.auth.updateUser({ password })` **eski şifre sorulmadan çalışır**. `/auth/reset` bu yüzden formu koşulsuz göstermemeli: `PASSWORD_RECOVERY` event'i (veya PKCE `?code=` takası) beklenmeli, işlem sonrası `signOut()` çağrılmalı.
- 🚨 **`/u/[username]` KLASÖR ADI YALAN SÖYLÜYOR — param `username` değil, kullanıcı `id`'si** (29 Tem 2026, `SPRINT_01` S3). `app/u/[username]/page.tsx` param'ı `.eq('id', userId)` ile kullanıyor, panel de linki `/u/${userId}` üretiyor. `users.username` kolonu **routing'de hiç kullanılmıyor**. Bu rotaya URL üreten her yer (sitemap, paylaş butonu, e-posta şablonu) **id** yazmak zorunda; `username` yazan toptan 404 basar. Klasörü yeniden adlandırmak isterse `[id]` olmalı.
- 🚨 **`'use client'` sayfası `metadata` EXPORT EDEMEZ** (29 Tem 2026, `SPRINT_01` S2). Next bunu **hata vermeden yok sayar** — yazdığın `robots`/`title` hiçbir zaman HTML'e girmez, fark etmen aylar sürer. Tek çözüm: aynı route segmentinde sunucu tarafı bir `layout.tsx`. Mümkünse **segment seviyesine** koy (`app/auth/layout.tsx`), sayfa başına değil; yoksa yeni eklenen kardeş rotalar sessizce dışarıda kalır.
- **OG görseli: aynı segmentte TEK dosya olabilir** (29 Tem 2026, `SPRINT_01` S1). `app/opengraph-image.{tsx,png,jpg}` bir arada bulunamaz — Next hangisini seçeceğini bilemez. Statik görsele geçerken `.tsx` üreteci **silinmek zorunda**. Alt metin ayrı dosyadan gelir: `app/opengraph-image.alt.txt`. ⚠️ **Dosya boyutu:** WhatsApp büyük görsellerde kartı sessizce göstermez; 1200×630 JPEG ~130 KB güvenli, aynı kadraj PNG olarak 650 KB'a çıkıyordu. ⚠️ Karttaki sayı/rozet (ör. "519 aktif ilan", "BETA") **donmuş** metindir; güncellenmesi elle yapılır.
- 🚨 **`metadataBase` olmadan göreli OG/canonical URL'leri ÜRETİLMEZ** (29 Tem 2026, `SPRINT_01` S1). Next build'de uyarı verip sessizce atlar. WhatsApp/LinkedIn paylaşım kartının hiç görünmemesinin en sık sebebi budur. Ayrıca **canonical MİRAS ALINMAZ**: kök layout'un `alternates.canonical`'ı alt sayfalara geçmez, her sayfa kendi canonical'ından sorumludur.
- 🚨 **robots.txt'te isimli blok, `*` bloğunun YERİNE GEÇER — birleşmez** (29 Tem 2026, `SPRINT_01` S4). GoogleBot/GPTBot/ClaudeBot kendi adını taşıyan bir blok görünce `User-agent: *` bloğunu **tamamen yok sayar**. Bu yüzden `public/robots.txt`'teki dört bloğun disallow listesi birebir aynı olmak zorunda; yeni bir özel alan eklerken dördünü birden güncelle. (Eski halinde `*` bloğu düpedüz `Allow: /` diyordu → `/panel/`, `/admin/`, `/api/` genel taramaya açıktı.) ⚠️ robots.txt bir güvenlik sınırı değildir; asıl sınır `proxy.ts` + `requireStaff()` + RLS.
- 🚨 **Kota, KAPININ olduğu yerde sayılmalı** (29 Tem 2026, `ILAN_VER_ANALIZ` V7). `parse-text` ücretli Anthropic çağrısını istek başında kotayla kapatıyor ama sayaç (`countAiListingsLast24h`) `listings.raw_text IS NOT NULL` satırlarını sayıyor — yani **kayıt** anını. Ayrıştırıp formu göndermeyen kullanıcının sayacı hiç artmaz; ücretli endpoint sınırsız çağrılabilir. Aynı sayaç `whatsapp/route.ts:191,204` tarafından da besleniyor, yani kanallar birbirinin kotasını yiyor. **Kural:** ücretli/kaba-kuvvete açık her çağrıda kapı ile sayaç **aynı olayı** ölçer; `lib/kota.ts` ile önce `sayma: true` peek, işlem **başarılıysa** sayaç işlenir.
- 🚨 **`moderation_status`'u uygulamada sabitlemek trigger'ın kararını ezer** (29 Tem 2026, `ILAN_VER_ANALIZ` V3 — ✅ W0'da giderildi). `ilanKaydet` INSERT'te `moderation_status: 'auto_published'` yazıyordu; `audit_listing_fn` yalnızca `score >= reject_min` (71) dalında bu alana dokunuyor. Sonuç: 31–70 puanlık **orta bant fiilen yoktu** — şüpheli ilan doğrudan yayına giriyordu. **Yerleşen kalıp:** INSERT `.select('id, audit_score, moderation_status, is_shadow_banned')` ile geri okunur, sonra `getAuditThresholds()` eşikleriyle **tek bir yerde** karar verilir; `>= rejectScoreMin` veya `is_shadow_banned` ise trigger'ın kararına DOKUNULMAZ (sadece kullanıcıya dürüst mesaj), `>= autoPublishScoreMax` ise `pending`+`passive`, altındaysa yayında. `/api/ilan/duzelt` ve `ilanKaydet` bu mantığı **birebir aynı** yazar — ikisi ayrışırsa aynı skor iki farklı sonuç verir. Ek olarak, trigger sessizce `is_shadow_banned` yapabildiği için **başarı ekranı INSERT sonucunu okumadan "yayında" diyemez**.
- 🚨 **Server action `throw` etmez, ayrık birlik (discriminated union) döndürür** (29 Tem 2026, `ILAN_VER_ANALIZ` V1/V4). `throw new Error(error.message)` ham Postgres mesajını (kolon adları, kısıt adları) istemciye sızdırır ve istemci onu ayırt edemez — doğrulama hatası mı, DB çöktü mü? **Kalıp:** `type Sonuc = {ok:true, …} | {ok:false, hata:string}`. Doğrulama hataları kullanıcıya olduğu gibi gösterilir, DB hataları `structuredLog('ERROR', …)`'a yazılıp kullanıcıya jenerik mesaj döner. Dönen tip **istemciyle paylaşılan tek `type`**'tır (`import { type IlanDurumu }`), böylece ekranın gösterdiği durumlar ile sunucunun ürettiği durumlar derleme zamanında eşleşir.
- 🚨 **Kimlik doğrulanmış kullanıcının kendi verisi bile istemciden gelmez** (29 Tem 2026, `ILAN_VER_ANALIZ` V2). `contact_phone` forma yazılıp olduğu gibi kaydediliyordu; devtools ile rakibin numarasını kendi ilanına yazmak mümkündü. **Kural:** kullanıcıya ait doğrulanmış alanlar (telefon, e-posta, ünvan, `user_id`) **her zaman** oturumdan/profil satırından okunur. İstemci farklı bir değer yollarsa sessizce ezilir ama `WARN` loglanır (son 4 hane ile — tam numara loga yazılmaz). Profil alanı boşsa doğrulanmış istemci değeri kabul edilip **profile geri yazılır**, böylece dal kendini onarır ve Google ile kaydolmuş telefonsuz kullanıcı kilitlenmez.
- ✅ **İstemci↔route sözleşmesi tek bir `type`'ta tanımlanmalı** (29 Tem 2026, `ILAN_VER_ANALIZ` B1 — **çözüldü**). `TopluYukle.tsx` JSON `{action, rows, userId}` yolluyordu, `/api/excel-import` yalnızca `formData().get('file')` okuyordu; üstelik istemci şablonu `'Kalkış İli'`, route `'Kalkış Şehri'` bekliyordu. Özellik **aylarca hiç çalışmadı** ve TypeScript yakalayamadı çünkü `fetch` gövdesi `any`. **Kural:** `fetch` ile konuşan her istemci↔route çifti sözleşmesini TEK dosyada tanımlar (`lib/toplu-yukle-sozlesme.ts`), iki taraf da BURADAN import eder, istemci gövdeyi `satisfies` ile mühürler, yanıtı ayrık birlik olarak daraltır. ⚠️ Ayrıca `userId` **asla istemciden alınmaz**, oturumdan okunur — sözleşmede o alan hiç bulunmaz.
- 🚨 **Ayrıcalıklı yazma yolu ÇOĞALTILMAZ** (29 Tem 2026, `ILAN_VER_ANALIZ` W0/W1). W0'da `app/ilan-ver/actions.ts` sertleştirildi; `/api/excel-import` ise kendi `listings` INSERT'ini yazdığı için V1 (beyaz liste) ve V3 (moderasyon bandı) delikleri orada **açık kaldı** — `moderation_status: 'auto_published'` sabitleniyor, `vehicle_type` doğrulanmadan diziye konuyordu. Bir güvenlik düzeltmesi, aynı tabloya yazan öteki yolu kapsamıyorsa düzeltme değildir. **Kural:** tablo başına tek yazma modülü (`lib/ilan-yaz.ts`), yeni kanal INSERT kopyalamaz, o fonksiyonu çağırır.
- 🚨 **İki ayrı PostgREST isteği transaction DEĞİLDİR** (29 Tem 2026, `ILAN_VER_ANALIZ` V5). Ana kayıt + bağımlı satırlar iki `insert()` çağrısıyla yazılırsa ikincisi patladığında birincisi **kalıcı olur** — `listings`'te duraksız ilan, ana sayfada hiç görünmeyen ama moderatör kuyruğunda duran hayalet kayıt. Telafi edici `delete` yeterli değil: o istek de patlayabilir ve tam o anda yetim kayıt kalıcılaşır. **Kural:** birbirine bağımlı çok tablolu yazma tek `plpgsql` fonksiyonuna alınır (`public.ilan_olustur`), `security invoker` + EXECUTE yalnız `service_role`. ⚠️ `security definer` seçme — service-role zaten yetkili, `definer` yalnızca ayrıcalık yükseltme yüzeyi ekler.
- ⚠️ **`jsonb` parametreli RPC, ayrışmayı DERLEME ZAMANINDA GİZLER** (29 Tem 2026, V5/B3). `svc.rpc('ilan_olustur', { p_listing: {...} })` gövdesi TypeScript için serbest bir nesne; fonksiyon gövdesinde okunmayan bir alan hata vermez, **sessizce yok sayılır** (kolon NULL kalır). Kolon eklerken SQL fonksiyonu ile `lib/ilan-yaz.ts`'teki nesne **birlikte** güncellenmeli; duman testi kolonun gerçekten dolduğunu `select` ile doğrulamalı.
- 🚨 **`Number("5.000")` JavaScript'te **5**'tir — Excel'den gelen TÜRKÇE sayı sessizce bozulur** (29 Tem 2026, W1 denetimi). Fiyat hücresine `5.000` yazan kullanıcının ilanı **5 TL**'ye kaydoluyordu: hata yok, uyarı yok, sadece yanlış veri. `"2,5"` ise `NaN` verip tonajı büsbütün düşürüyordu. **Kural:** Excel/kullanıcı metninden gelen her sayı `sayiMetniCoz()`'den (`lib/toplu-yukle-sozlesme.ts`) geçer — virgül varsa ondalık, noktalar `1.234.567` kalıbındaysa binlik. Dönüşüm **önizlemede** uygulanmalı ki kullanıcı kaydedilecek değeri görsün.
- ⚠️ **`(x->>'alan')::int` ondalık metinde `22P02` atar ve TÜM transaction'ı geri alır** (29 Tem 2026, W1 denetimi). `sayiAralik()` ondalığa izin verdiği için Excel'den gelen `2.5` palet değeri RPC'de `::int`'e çarpıyor, ilan **ve** duraklar birlikte geri dönüyor, kullanıcı yalnızca "İlan kaydedilemedi" görüyor. **Kural:** RPC'de `::int`'e giden her alan TypeScript tarafında `tamSayiAralik()` ile yuvarlanır (`lib/ilan-yaz.ts`). Tip daralması SQL'de değil, gönderen tarafta yapılır.
- **`useSearchParams` Suspense sınırı olmayan sayfada TÜM AĞACI CSR bailout'a sokar** (29 Tem 2026, `SPRINT_01` L2). Yalnız ilk yüklemede okunacak bir query param için `useEffect` içinde `new URLSearchParams(window.location.search)` yeterli ve maliyetsiz. Ayrıca URL'den gelen değer state'e **beyaz listeden geçmeden** yazılmamalı.
- **Giriş duvarına yönlendirirken `?redirect=` HER ZAMAN doldurulmalı** (29 Tem 2026, `SPRINT_01` L2/L3). Düz `/giris`'e atmak kullanıcıyı giriş sonrası ana sayfaya düşürür; akan ilan listesinde baktığı ilanı bir daha bulamaz. `lib/redirect.ts`'teki `guvenliRedirect` query string'i korur, o yüzden `/ilan-ver?tip=arac` gibi hedefler de güvenle taşınabilir.
- ⚠️ **GA'ya kişisel veri gönderme** (`lib/analiz.ts`). Telefon, e-posta, TCKN/VKN, tam ad → GA'ya **gitmez**. Yalnız kategorik/sayısal alanlar (`tip: 'yuk' | 'arac'` gibi). KVKK gereği: GA verisi yurt dışına çıkar.
- 🚨 **BÜYÜK HARF KONTROLÜNDE `/[A-Z]/` KULLANMA — Türkçe'de yanlış** (29 Tem 2026, `SPRINT_01` R2). "Şifre123" ve "Ölçü1234" tamamen geçerli parolalar ama `[A-Z]` bunları "büyük harf yok" diye reddeder; kullanıcı ne yaptığını anlamadan kayıt olamaz. Doğrusu `\p{Lu}` + `/u` bayrağı (Ç, Ğ, İ, Ö, Ş, Ü dahil). Aynı tuzak küçük harf (`\p{Ll}`) ve harf (`\p{L}`) kontrolleri için de geçerli. tsconfig `target: ES2017` bunu destekliyor. Şifre kuralları **tek kaynak**: `lib/sifre.ts`.
- ⚠️ **İstemci şifre doğrulaması güvenlik değil UX'tir.** Gerçek zorunluluk Supabase Dashboard → Authentication → Policies → Password Requirements'ta ayarlanır. `lib/sifre.ts` yalnız kullanıcıya ne beklendiğini gösterir. Ayrıca **mevcut kullanıcıların girişine yeni kural uygulanmaz** — eski zayıf parolalılar kilitlenmesin (`epostaGiris` bilinçli olarak kapıya bağlı değil).
- 🚨 **`pushState` TEK BAŞINA BOZUKTUR — `popstate` dinleyicisi zorunludur** (29 Tem 2026, `SPRINT_01` L5). URL'i elle değiştiren her yer geri/ileri tuşunu da dinlemeli; yoksa geri tuşu URL'i değiştirir ama React state'i eski kalır ve ekranla adres çubuğu çelişir. Ayrıca: istemci tarafı bir filtre için **`router.push` değil `history.pushState`** (`router.push` RSC payload'ı çeker, ISR sayfasını yeniden ister); varsayılan değer için parametre **silinmeli** (aynı liste için iki URL = yinelenen içerik); **geçersiz parametre `replaceState` ile temizlenmeli**, yoksa kullanıcı çalışmayan bir filtre uyguladığını sanıp o linki paylaşır.
- 🚨 **Tip/mod değiştiren butonlar, açık input'u ÖNCE blur eder** (29 Tem 2026, `SPRINT_01` K3). Sıra: mousedown → blur → click. `onBlur`'da asenkron kontrol yapan bir alan varsa, istek uçarken form temizlenir ve dönen sonuç **temizlenmiş state'in üzerine** yazar. `profil-tamamla`'da bu, "Kaydet" butonunu kalıcı pasif bırakıyor ve **uyarı metni de görünmüyordu** (ilgili blok yeni tipte gizli) — sebebi görünmeyen sessiz çıkmaz. Çözüm: epoch/abort sayacı (`tipEpoch` ref); uçuştaki istek dönüşte epoch'u doğrulamazsa sonucunu yazmaz. Spinner yine de kapatılmalı.
- 🚨 **Görünmeyen form alanı MUTLAKA temizlenmeli** (29 Tem 2026, `SPRINT_01` K3). `handleSubmit` alanı `x || undefined` ile gönderiyor ve `profil-tamamla/actions.ts` `company_name`'i **kullanıcı tipinden bağımsız** yazıyor — yani ekranda olmayan veri sessizce kaydediliyor. `ALAN_GORUNUR` haritası ile JSX koşulları **birbirinin aynası**; biri değişirse diğeri de değişmeli.
- ⚠️ **Aynı sekmeye/moda tekrar tıklamak hiçbir şeyi sıfırlamamalı** (29 Tem 2026, `SPRINT_01` F1). Koşulsuz `setMod('giris')` yüzünden `?mod=kayit` ile gelen kullanıcı, zaten aktif olan sekmeye tekrar tıklayınca sessizce giriş formuna düşüyordu. Ayrıca URL param'ı ile mod kurarken **render koşulunun tamamını** kur: kayıt formu `sekme === 'eposta' && mod === 'kayit'` istiyor; yalnız `mod`'u kurmak sessiz bir no-op'tur.
- ⚠️ **Liste sayacı, LİSTEYİ saymalı** (29 Tem 2026, `SPRINT_01` L4). `count: 'exact'` toplamı platform genelini verir (tüm sekmeler, kırpma öncesi); altındaki liste ise tek sekmenin ilk `ILAN_LIMITI` kaydı. Ekranda "519 ilan" yazıp 40 kart göstermek kullanıcıya sayfa bozuk hissi verir. Kırpma varsa **"en yeni" ön eki filtreden bağımsız** yazılmalı: filtre bu pencerenin içinde, istemcide çalışıyor — sunucuya gitmiyor. Limit tek yerden: `lib/ilan-liste.ts`.
- 🚨 **Auth hata dallarında Türkçe METNE göre dallanma** (29 Tem 2026, `SPRINT_01` A5). Metin değişince dal sessizce ölür. Sunucu makine okunur `kod` dönmeli (`eposta_dogrulanmamis` | `kimlik_hatali`), istemci ona baksın. Hesap sayımı endişesi yok: GoTrue password grant'ta şifre, `Email not confirmed` kontrolünden **önce** doğrulanıyor.
- 🚨 **`resend()` / `signUp()` çağrısında `emailRedirectTo` VERİLMEZSE** Supabase kendi "Site URL" ayarına düşer; kullanıcı `/auth/callback` yerine ana sayfaya çıkar, oturum takası **hiç yapılmaz** ve "linke tıkladım ama giremiyorum" der (29 Tem 2026, `SPRINT_01` A6). Değer `NEXT_PUBLIC_SITE_URL`'den gelmeli — **`request.url` kullanma**, Vercel'de proxy arkasındaki iç adres olabilir.
- ⚠️ **E-posta gönderen uç noktalar hesap sayımına (enumeration) kapalı olmalı** (29 Tem 2026, `SPRINT_01` A6). `/api/auth/dogrulama-tekrar` adres kayıtlı olsun olmasın **aynı yanıtı** döner; sebep yalnız loga yazılır. Kotalar hata yolunda da işlenir — buradaki "hata"ların çoğu "böyle adres yok / zaten doğrulanmış", yani saldırganın aradığı bilgi; saymazsak o yol bedava olur. (`otp/route.ts`'ten bilinçli ayrılık: orada hata = sağlayıcı arızası, sayaç işlenmeden 502 döner.)

---

## 10. KULLANICI AKIŞLARI

| Ekran | Rota | Durum |
|---|---|---|
| Landing (3 senaryo) | `/` | ✅ |
| Nasıl Çalışır | `/nasil-calisir` | ✅ |
| Hakkımızda | `/hakkimizda` | ✅ |
| KVKK | `/kvkk` | ✅ |
| Kullanım Koşulları | `/kullanim-kosullari` | ✅ |
| Kayıt | `/giris` → `/profil-tamamla` | ✅ |
| Giriş | `/giris` | ✅ |
| Yol Rehberi (POI) | `/yol-rehberi` | ✅ |
| Panel | `/panel` | ✅ |
| İlan detay | `/ilan/[id]` | ✅ kısmi |
| Tekil ilan formu | `/ilan-ver` | ✅ |
| Metinden ilan (LLM) | `/ilan-ver` (yöntem=metin) | ✅ |
| Toplu yükleme | `/ilan-ver` | ✅ çalışıyor (29 Tem 2026, `ILAN_VER_ANALIZ` B1 — ortak sözleşme `lib/toplu-yukle-sozlesme.ts`, kayıt `ilanYaz()` üzerinden) |
| Atanan işlerim | `/panel/is/[id]` | 🔮 Faz 2 |
| Puanlama | modal | 🔮 Faz 2 |
| Profil / Araçlarım | `/panel` tab | ✅ kısmi |

---

## 13. AI-READINESS (SEO)

| Adım | Dosya | Açıklama |
|---|---|---|
| 1 | `app/ilan/[id]/page.tsx` | `generateMetadata` — dinamik title/description/OG |
| 2 | `app/ilan/[id]/page.tsx` | JSON-LD `<script type="application/ld+json">` — Schema.org/Service |
| 3 | `app/ilan/[id]/page.tsx` | Semantik `<article>`, `<ol>` durak listesi, `data-ai-label` |
| 4 | `public/robots.txt` | 4 blok, birebir aynı disallow listeleri + Sitemap path (S4) |
| 5 | `app/api/ilanlar/[id]/route.ts` | Public JSON API (hassas veri yok, 5dk cache) |
| 6 | `app/ilan/[id]/page.tsx` | `audit_score` → metadata + `data-quality-score` + görsel rozet |
| 7 | `app/layout.tsx` | `metadataBase` + OG + Twitter card + `alternates.canonical` (S1) |
| 8 | `app/opengraph-image.jpg` (+ `.alt.txt`) | 1200×630 paylaşım kartı, statik görsel (S1) |
| 9 | `app/{giris,moderator-giris,profil-tamamla,auth}/layout.tsx` | Auth yüzeylerinde `noindex` (S2) |

**Sitemap**: `app/sitemap.ts` ✅ — statik sayfalar (`/yol-rehberi` dahil) + aktif/onaylı ilanlar
(5000 limit) + **yayında ilanı olan kullanıcıların profilleri** (`/u/{id}`, aynı sorgudan türetilir).

**Site adresi tek kaynak:** `NEXT_PUBLIC_SITE_URL`, fallback `https://yukegel.com`.
`app/layout.tsx` ve `app/sitemap.ts` **aynı** değişkeni + **aynı** fallback'i kullanır; ayrışırlarsa
canonical ile sitemap farklı alan adı gösterir ve Google ikisini ayrı site sanar.

⏭️ **Açık:** `/ilan/[id]` kendi `alternates.canonical`'ını vermiyor — Next canonical'ı alt
sayfalara **miras bırakmaz**. Dinamik OG görseli de yok (kök karta düşüyor).

---

## 14. GÖREV DURUMU

### ✅ Tamamlanan
- **SPRINT_01 W5 — Alias veri bütünlüğü (kod tarafı)** (29 Temmuz 2026). Devir notu: `docs/W5_DEVIR.md`.
  - **D1 — `learn-aliases` prompt'u.** Altı bozuk JSON örneği doğru Türkçe yazıma çevrildi (`"Eskişehir"`, `"İzmit"`, `"İstanbul"`, `"İkitelli"`, `"Tekirdağ"`, `"Çorlu"`), prompt'un başına "EN ÖNEMLİ KURAL — TÜRKÇE YAZIM" bloğu eklendi ve **"mevcut alias listesindeki ASCII kayıtları örnek alma"** uyarısı yazıldı (liste bağlam olarak veriliyor, yoksa bozulma kendini besliyordu).
  - **D2 — dört yazma noktası kapatıldı.** Yeni `lib/alias-normalize.ts`: `aliasKey()` (katlama), `trTemizle()`, `normalizeAliasFields()`, `aliasSatirlariniYukle()` (sayfalı, bayrak filtresi YOK), `aliasCakismaBul()` → **409 + çoğunluk yazımı önerisi**, `baskinYazimaHizala()` (yalnız AI keşif yolu; değişenler yanıtta `hizalanan_yazimlar` olarak raporlanır). Manuel `create`, AI keşif, PATCH `approve` ve PATCH alan güncelleme yollarının dördü de normalize+kontrol ediyor. 5b kopya kontrolü ham `in('alias',…)` yerine katlanmış anahtar setiyle çalışıyor.
  - **D4 — `parse-listing/findPlaces` karşılaştırma anahtarları katlandı.** `yerKey`/`ayniSehir`/`ayniIlce`/`laneKey` eklendi; `seen` (bigram+unigram), `sameCity` koruması, Pass 2 hedef bulucu + `blockSeen`, Pass 2/3 `isDiff`, fallback ve son lane dedup — hepsi katlanmış anahtar kullanıyor, **saklanan değer ham kalıyor**. Kabul testi: yeni kod **5/5**, HEAD aynı testlerde **3/5 başarısız** (HEAD `hits=["Istanbul","İstanbul"]` ve sahte `Istanbul->İstanbul` lane'i üretiyor).
  - **D5 — `docs/20260729_alias_runbook.md`.** İki hazır temizlik script'inin (`20260728_alias_homonim_temizligi.sql` / `20260728_alias_kopya_temizligi.sql`) çalıştırma sırası hiçbir yerde yazılı değildi ve **ters sıra sessizce zarar veriyor** (kopya BÖLÜM 3, BÖLÜM 2'nin düzelttiği değerleri kaynak alıyor). 11 adım, her adımın önizleme `SELECT`'i ve geri alması var, hiçbir adım satır silmiyor.
  - **D3 — `docs/20260729_alias_normalize_trigger.sql`.** `aliases_normalize_trg` (BEFORE INSERT/UPDATE OF alias,normalized,district) + `aliases_katlanmis_anahtar_uniq` **kısmi** UNIQUE indeks. Trigger `normalizeAliasFields`'in DB ikizi — ayrışırlarsa uygulama "temiz" der, DB başka değer yazar.
  - 🚨 **Devir notunda OLMAYAN bulgu:** `alias` UNIQUE'i ham string üzerinde olduğu için `Gebze`/`GEBZE`/`gebze` ayrı satırlar; hepsi tek katlanmış anahtara düşüyor ve temizlik script'i satır silmediği için D3 indeksi tam haliyle **hiç kurulamaz**. Çözüm: runbook Adım 9 (fazlalıkları `is_active=false`) + indeksin `WHERE is_active = true` ile kısmi olması.
  - 🚨 **BAYRAM'IN DÜZELTMESİ — ölçüm ve onarım yanlış tabloyu gösteriyordu** (29 Tem 2026). Runbook'un ilk Adım 0'ı `WHERE origin_city = destination_city` sorguluyordu; iki hata: (1) **varışlar `listings`'te değil, `listing_stops` satırlarında** — `listings.destination_city` uygulama kodunda hiç okunup yazılmayan **ölü kolon**, canlı varış filtresi `HomeClient.tsx:696` → `listing_stops.city`; (2) **şehir içi taşıma meşrudur**, aynı şehir bir bozukluk sinyali değil. Doğru parmak izi: *katlanmış anahtar eşit, ham yazım farklı*. Adım 0 (0.1 sahte aday / 0.2 meşru şehir içi tabanı / 0.3 dört kolonda yazım dağılımı / 0.4 ölü kolon teyidi) ve Adım 8 yeniden yazıldı.
  - 🚨 **Bu düzeltmenin ortaya çıkardığı ASIL boşluk:** `20260728_alias_kopya_temizligi.sql` **BÖLÜM 6 yetersiz** — yalnız `listings.origin_city` + ölü `destination_city`'yi onarıyor; `listing_stops.city`, `listing_stops.district` ve `listings.origin_district`'e hiç dokunmuyor. Yani eski haliyle temizlik tamamlansa bile **kullanıcıya görünen bozuk varışlar bozuk kalırdı**. Runbook Adım 8 artık dört kolonu birlikte onarıyor ve elle `CASE` listesi yerine `aliases` tablosunu sözlük olarak kullanıyor (`HAVING count(DISTINCT …) = 1` ile belirsiz anahtarlar elle bırakılıyor). **BÖLÜM 6'yı olduğu gibi çalıştırma.**
  - ⏳ **SQL'lerin hiçbiri çalıştırılmadı** (Bayram'ın beyanı). Doğrulama: `tsc --noEmit` temiz; lint HEAD'e göre gerilemedi (`learn-aliases` 15→13 hata, `parse-listing` 1→1, `lib/alias-normalize.ts` 0).
- **SPRINT_01 W1 — Auth akış bütünlüğü** (28 Temmuz 2026). Ayrıntı ve kabul kriterleri: `docs/SPRINT_01.md`.
  - **A1 + A1b — auth denetim izi açıldı.** `app/api/auth/log/route.ts` (yeni) service-role ile `auth_events`'e yazıyor. Endpoint aylardır **yoktu**; `authLog()` çağrıları `.catch(()=>{})` içinde olduğu için 404 sessizce yutuluyordu. Artık `console.warn` bırakılıyor. ✅ `docs/20260728_auth_events.sql` çalıştırıldı (29 Tem 2026).
  - **A3 — `?hesap=tasindi` / `?hesap=eslesme` mesajları görünür oldu.** Mesaj `onAuthStateChange`'ten bağımsız basılıyor; proxy cookie'yi sildiği için `!user` dalında da çalışması gerekiyordu.
  - **A7 — `redirect` param'ı korunuyor.** `lib/redirect.ts` (yeni) `guvenliRedirect()`: yalnız `/` ile başlayan, `//` ve `\` içermeyen yollar → açık yönlendirme kapalı.
  - **K2 — `users` upsert'i server action'a taşındı.** `app/profil-tamamla/actions.ts` (yeni) + kolon beyaz listesi. `role`, `is_active`, `phone_verified`, `merged_into`, `trust_level` istemciden yazılamıyor.
  - **R1 — `/auth/reset` yeniden yazıldı.** Backlog'da yazandan daha kötü bir bulgu çıktı: tarayıcıda **normal** bir oturum açıkken `updateUser({password})` başarıyla çalışıyordu → açık kalmış oturuma erişen kişi eski şifreyi bilmeden şifreyi değiştirebiliyordu. Form artık yalnız gerçek `PASSWORD_RECOVERY` oturumunda; başarıdan sonra `signOut()`.
  - **C1 — `/cikis` GET kapatıldı**, POST + Origin kontrolü. Link prefetch / üçüncü taraf `<img src>` ile istemsiz çıkış vektörü kapandı.
  - **A4b — OTP cooldown SUNUCUDA.** `api/ilan/[id]/sahiplen` ilan başına 60 sn (429 + `Retry-After`); istemci sayacı yalnız görsel. Sayaç SMS gerçekten gittiyse başlıyor.
  - **L1e — `contact_phone`'un son istemci yazma yolu kapandı.** `app/panel/actions.ts` ve `app/moderator/actions.ts` (yeni); `IlanYonetim.tsx`'ten anon istemci tamamen kaldırıldı, `moderator/page.tsx`'in select/update/insert'lerinden kolon çıkarıldı. ✅ `docs/20260728_contact_phone_revoke.sql` çalıştırıldı (29 Tem 2026) — duman testi geçti.
  - **Keşif (backlog'da yoktu):** panel'in istemci `listings` update'i gövdeyi hiç filtrelemiyordu — kullanıcı kendi ilanına `trust_level: 'verified'` / `moderation_status: 'approved'` / `is_shadow_banned: false` yazabiliyordu. K2 ile aynı sınıf; beyaz listeyle kapandı.
  - **Ayrıca:** panel "Araç Bulundu" toggle'ının hatası sessizce yutuluyordu (buton çalışmış görünüp sayfa yenilenince geri dönüyordu) — artık kart üstünde gösteriliyor. Moderatör telefon kaydı başarısız olursa `alert` çıkıyor.
  - **Doğrulama:** `npx tsc --noEmit` temiz; değişen/yeni dosyalarda eslint 0 problem. `next build` bu ortamda tamamlanamadı (sandbox `.next` FUSE artefaktı + Google Fonts'a çıkış yok) — Bayram'ın makinesinde/CI'da doğrulanmalı.
- **Kayıtlı kullanıcı ayrı auth kimliğiyle gelince profil-tamamla'ya düşüyordu — proxy + giriş self-heal ile çözüldü** (22 Temmuz 2026): Doğrulanan vaka — Bayram'ın 2 auth kimliği vardı: `0d7ac38c…` (email bayramdede@gmail.com, `public.users` satırı burada, `broker`) ve `4c509880…` (phone 905380855996, satırı YOK). SMS ile girince oturum `4c50…` oluyor, proxy o `id` için satır bulamıyor ve `/profil-tamamla`'ya atıyordu. Giriş formundaki merge yalnızca formdan geçildiğinde çalışıyordu; doğrudan korumalı rotaya gidince kaçıyordu.
  - `proxy.ts`: select'e `merged_into` eklendi. (a) `merged_into` dolu → sb- cookie'leri temizle + `/giris?hesap=tasindi`. (b) `user_type` yok ama aynı e-posta/telefonla (`+905xx`/`905xx`/`05xx`/`5xx` dört format) `merged_into IS NULL` canlı hesap varsa → `/profil-tamamla` yerine `/giris?hesap=eslesme`.
  - `app/giris/page.tsx`: açılış kontrolü `supabase.auth.onAuthStateChange` **INITIAL_SESSION** olayına bağlı (getUser DEĞİL). Neden: magic-link `#access_token` hash'i istemci başlatılırken TÜKETİLİR; INITIAL_SESSION bundan sonra tetiklendiği için eski/merged cookie yerine hash'ten gelen GÜNCEL oturumu görürüz — aksi halde getUser hash işlenmeden eski merged oturumu okuyup `signOut` ediyor, kullanıcı giriş ekranında takılıyordu (RACE). Mantık: sağlıklı canlı oturum (`user_type` var, `merged_into` yok) → `yonlendir()`; ölü/eksik oturum → `signOut()` + bilgi mesajı. Formla giriş (SIGNED_IN) bu bloktan ETKİLENMEZ; onları otpGonder/epostaGiris yönetir.
  - **DÖNGÜ DÜZELTMESİ (22 Tem, sonraki tur):** İlk self-heal turunda kullanılan magic-link geçişi (switch-account/merge → `window.location.href`) SONSUZ YENİLENME yaratıyordu. Magic-link implicit flow (`#access_token`) yalnız browser localStorage'ı canlı hesaba geçirir; middleware'in okuduğu SSR `sb-` cookie ESKİ (merged) oturumda kalır → proxy tekrar `/giris?hesap=tasindi`'ye atar → mount tekrar switch-account çağırıp sayfayı yeniler. Çözüm magic-link bağımlılığını kaldırmak: ölü oturumun cookie'sini proxy siler, giriş sayfası oturumu tamamen kapatır (signOut), kullanıcı temiz yeniden girer.
  - `otpDogrula` telefon merge sorgusu artık 4 formatı da deniyor (önceden yalnız `05xx`/`5xx` — kayıt E.164 `+905xx` durduğunda eşleşmeyi kaçırıyordu).
  - Doğrulama: `npx tsc --noEmit` temiz. Sandbox Supabase'e ulaşamadığı için canlı test yapılmadı; düzeltme bir sonraki girişte self-heal ile devreye girer.
- **"users_email_key" duplicate key hatası — hesap birleştirme (merge) eksikleri giderildi** (22 Temmuz 2026): SMS ile giriş yapan, ama e-postası zaten başka (eski) bir hesapta kayıtlı olan kullanıcılar `/profil-tamamla`'ya düşüyor ve kaydet'e basınca `duplicate key value violates unique constraint "users_email_key"` hatası alıyordu.
  - Kök neden: `eskiProfil` (merge hedefi) aramaları sadece **telefon** (`app/giris/page.tsx`) ya da sadece **eposta** (`app/auth/callback/route.ts`, Google akışı) bazlıydı — hiçbiri diğerine bakmıyordu. Telefonla girip eposta çakışması olan bir hesap hiçbir merge kontrolüne takılmadan doğrudan profil-tamamla'ya gidip ham upsert hatasıyla karşılaşıyordu.
  - `app/giris/page.tsx` (`otpDogrula`): `eskiProfil` sorgusu artık telefon **VEYA** (varsa) `data.user.email` ile eşleşen kaydı da arıyor.
  - `app/auth/callback/route.ts`: eposta bazlı `eskiProfil`/merge kontrolü artık `!profil?.user_type` (profil-tamamla'ya gönderme) kontrolünden **önce** çalışıyor — önceden profili tamamlanmamış kullanıcılar için bu kontrol hiç çalışmıyordu.
  - Her iki sorguda da `.eq('is_active', true)` filtresi `.is('merged_into', null)` ile değiştirildi — `is_active` eski hesaplarda hiç set edilmemiş (NULL) olabiliyordu, `merged_into IS NULL` "bu hesap başka bir yere merge edilmemiş, gerçek/canlı bir hesap" anlamına daha doğru karşılık geliyor.
  - `app/profil-tamamla/page.tsx`: submit hatası artık `users_email_key` içeriyorsa "Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın." gösteriyor (ham Postgres mesajı yerine) — yukarıdaki iki düzeltmeyi atlayan olası edge-case'ler için güvenlik ağı.
  - Doğrulama: `npx tsc --noEmit` temiz. `npx eslint` — üç dosyada da hata sayısı 20 Temmuz commit'iyle birebir aynı (`giris/page.tsx` 6 hata/2 uyarı — `Logo` inline component; `auth/callback/route.ts` 1 hata — `as any`; `profil-tamamla/page.tsx` 7 hata/2 uyarı — `MevcutUyari`/`KontrolYukleniyor`), hepsi pre-existing, yeni hata yok.
- **SMS ile giriş → yanlış profil-tamamla yönlendirmesi düzeltildi** (22 Temmuz 2026): Profili tamam olan kullanıcılar OTP girişinden sonra hâlâ `/profil-tamamla`'ya düşüyordu; kök neden 3 katmanlıydı.
  - `app/giris/page.tsx` (`otpDogrula`): `mevcutProfil?.is_active && mevcutProfil?.user_type` kontrolü `is_active` NULL olduğunda (profil-tamamla upsert'i bu alanı hiç set etmiyordu) yanlışlıkla "pasif" sayıyordu → `is_active !== false && user_type` yapıldı (sadece açıkça `false` ise pasif say).
  - `proxy.ts`: `/profil-tamamla`'ya yönlendirirken orijinal hedef path artık `?redirect=` ile taşınıyor (önce sabit `/profil-tamamla` idi, kullanıcı tamamladıktan sonra hep `/panel`'e düşüyordu).
  - `app/profil-tamamla/page.tsx`: `useSearchParams` + `Suspense` eklendi (`redirect` param okunuyor); init `useEffect` artık `user_type` zaten doluysa formu hiç göstermeden `redirect || '/panel'`'e yönlendiriyor; `user_type` boşsa mevcut `display_name`/`phone`/`company_name`/`tckn`/`vkn` DB'den önceden dolduruluyor (tam boş form yerine sadece eksik alan isteniyor). Submit upsert'i artık `is_active: true` set ediyor; başarı sonrası `redirect || '/panel'`'e gidiyor.
  - Doğrulama: `npx tsc --noEmit` temiz. `npx eslint` — `MevcutUyari`/`KontrolYukleniyor` inline component tanımlarından kaynaklanan `react-hooks/static-components` hataları (7 hata/2 uyarı) 20 Temmuz commit'inde de aynı şekilde vardı (git ile doğrulandı) — bu değişiklikle gelmedi, pre-existing.
  - **Not (22 Temmuz, sonraki tur):** Bu turda "kasıtlı dokunulmadı" denen `eskiProfil` sorgusundaki `.eq('is_active', true)` filtresi bir sonraki bug fix'te (`users_email_key` duplicate key, yukarıda) `.is('merged_into', null)` ile değiştirildi — yukarıdaki not artık geçerli değil.
- **TCKN zorunluluğu kaldırıldı** (22 Temmuz 2026): `app/profil-tamamla/page.tsx` — TCKN alanı daha önce `arac_sahibi` (nakliyeci) tipi için zorunluydu; nakliyecileri kayıt sırasında ürküttüğü gözlemlendiği için tüm kullanıcı tiplerinde opsiyonel yapıldı.
  - `kimlikGecerli()`: `arac_sahibi` özel dalı kaldırıldı — artık sadece dolu girilmişse geçerlilik/tekillik kontrolü yapılıyor.
  - UI: TCKN etiketi her zaman "(opsiyonel)", `required` attribute'u kaldırıldı, "Kimlik bilgisi profil güvenilirliğinizi artırır" ipucu artık tüm kullanıcı tiplerinde (arac_sahibi dahil) boşken gösteriliyor.
  - VKN (şirket zorunlu) ve diğer alanlar değişmedi. `npx tsc --noEmit` temiz.
  - **Not:** İleride TCKN'yi tekrar zorunlu kılmak istenirse `kimlikGecerli()`'ye `arac_sahibi` dalı geri eklenir.
- **Landing page → Driver-Mate formatı** (10 Temmuz 2026): `app/_components/HomeClient.tsx` sürücü-merkezli hub yapısına güncellendi (`app/page.tsx` değişmedi).
  - Hero (`HeroKayitsiz`): başlık/CTA'lar sürücü odaklı yeniden yazıldı — birincil buton `🚛 Sürücüyüm, Hizmetleri Gör` (`#surucu-hizmetleri` anchor), ikincil `📦 Yük Vereceğim, İlan Ver` (`/ilan-ver`).
  - Yeni `SurucuHizmetleri` bileşeni (hero altında, ana odak): kartlık grid — Yük Bul (`#ilanlar` anchor), Lastikçi, Park Yeri, Yemek Yeri (üçü `/yol-rehberi`'ye link — kategori deep-link'i yok, POI sayfası `useSearchParams` desteklemiyor), Hamal (pasif/"YAKINDA" kart — POI şemasında karşılığı yok), Yol Rehberi (tümü).
  - Yeni `YukVerenBanner` bileşeni: yük sahiplerinin ilan verebilmesi vurgusu için ayrı CTA kartı (`/ilan-ver`), hub'ın hemen altında.
  - Canlı ilan feed'i (filtre barı + `IlanKart` listesi) korundu, ikinci plana alındı — `📋 Canlı Yük & Araç İlanları` başlığıyla `id="ilanlar"` anchor'ı eklendi.
  - Auth/listing fetch mantığı değişmedi (`HeroMusteri`/`HeroNakliyeci` login sonrası bannerları aynı, hub tüm kullanıcı tiplerinde görünür).
  - **2. tur (aynı gün) — kullanıcı geri bildirimi üzerine genişletme:** ilk 6 kategori örnek kabul edilip `POI_HIYERARSI`'deki tüm ana kategorilere göre 8 karta çıkarıldı: 📦 Yük Bul (`🔥 En çok aranan` rozetli), 🔄 Lastikçi, 🅿️ Park & Konaklama, 🍲 Yeme & Mola, ⛽ Akaryakıt & Şarj, 🏭 Kantar & Operasyon, 👷 Hamal (YAKINDA), 🗺️ Tüm Yol Rehberi.
    - Kart render mantığı ayrı `SurucuHizmetKarti` bileşenine çıkarıldı: 48px dairesel renkli ikon rozeti, hover'da `translateY(-3px)` + renkli glow `boxShadow`, opsiyonel `rozet` (badge pill) alanı.
    - Başlık metni "🚛 Yolda Yalnız Değilsin" / "Yükten lastiğe, duraktan sofraya — şoförün ihtiyacı olan her şey tek dokunuşta." olarak güncellendi; grid `minmax` 150px→160px, `gap` 12→14.
    - Doğrulama (2. tur): `npx tsc --noEmit` temiz; `npx eslint` aynı 20 hata/2 uyarı temel çizgisi (hepsi öncesinden var — `any`, unescaped entity, `<a>`/`<img>`, `set-state-in-effect`), yeni hata yok.
  - **3. tur (aynı gün) — "marka ajansı" UX/UI pasosu, `HeroKayitsiz` (kayıtsız kullanıcı hero'su):** metin korundu, görsel/etkileşim katmanı baştan tasarlandı.
    - İki kolonlu grid (`.hero-grid`, 860px altı tek kolona düşüyor, sağ görsel mobilde gizleniyor) + arka planda iki bulanık glow blob (yeşil/mavi, `filter:blur(90px)`).
    - Sol kolon: eyebrow rozetinin yanına canlı `📦 {totalCount} aktif ilan` çipi eklendi (gerçek veri — `HomeClient`'tan `totalCount` prop'u geçiliyor); başlıkta ikinci satır yeşil gradient metin (`backgroundClip:text`); CTA butonları `.hero-cta-primary/secondary` class'larıyla hover'da kalkıp glow veriyor; güven rozetleri (Anında İlan, Güvenli, Ücretsiz, WhatsApp) nokta ayraçlı tek satıra alındı.
    - Sağ kolon: `#surucu-hizmetleri`'ye link veren tıklanabilir "Bugün Yolda" rota kartı — `SURUCU_HIZMETLERI.slice(0,4)` (Yük Bul, Lastikçi, Park & Konaklama, Yeme & Mola) kesikli çizgiyle bağlı dikey rota olarak gösteriliyor; kart hover'da kenarlık/glow değişiyor.
    - Doğrulama (3. tur): `npx tsc --noEmit` temiz; `npx eslint` 21 problem (19 hata/2 uyarı) — önceki turdan 1 eksik, çünkü `&apos;` kullanımı eski unescaped-entity hatasını da giderdi; yeni hata yok.
  - **4. tur (aynı gün) — `/yol-rehberi` kategori deep-link'i (önceki turlarda "yok" olarak not edilen limitasyon giderildi):**
    - `app/yol-rehberi/page.tsx`: `YolRehberiClient` artık `<Suspense fallback={<div style={{height:'100dvh',background:'#0d1117'}}/>}>` içinde render ediliyor — `useSearchParams` kullanımı Next.js'te Suspense boundary zorunlu kılıyor.
    - `app/yol-rehberi/YolRehberiClient.tsx`: `useSearchParams()` ile `?anaKategori=` / `?altKategori=` okunuyor; `aktifAnaKat`/`aktifAltKatlar` state'lerinin `useState` initializer'ında `POI_HIYERARSI`'ye karşı doğrulanıyor (geçersiz/eksik param → sessizce `'hepsi'`e düşer, hata fırlatmaz).
    - `app/_components/HomeClient.tsx`: `SURUCU_HIZMETLERI` kart href'leri güncellendi — Park & Konaklama → `?anaKategori=park_konaklama`, Yeme & Mola → `?anaKategori=yeme_icme`, Akaryakıt & Şarj → `?anaKategori=akaryakit_enerji`, Kantar & Operasyon → `?anaKategori=operasyon` (hepsi ana kategori bazlı, ilgili tüm alt kategorileri kapsıyor). Yük Bul (`#ilanlar`) ve Tüm Yol Rehberi (`/yol-rehberi`, filtresiz) değişmedi.
    - Doğrulama (4. tur): `npx tsc --noEmit` temiz; `npx eslint` yeni hata yok (mevcut `YolRehberiClient.tsx`/`page.tsx` hataları öncesinden var — `any`, `set-state-in-effect`, `<a>`, `Date.now` purity).
  - **5. tur (aynı gün) — "Lastikçi" kartı çok spesifikti, genişletildi:** `🔄 Lastikçi` (`altKategori=lastikci` tekli filtre) → `🔧 Tamir & Bakım` (`?anaKategori=tamir_bakim`, ana kategori — Lastikçi, Motor & Mekanik, Elektrik & Takograf, Branda & Dorse, Yıkama & Yağlama, Acil Yol Yardım'ın tamamını kapsıyor). İkon/renk `POI_HIYERARSI`'deki `tamir_bakim` ana kategorisiyle eşleşecek şekilde 🔧 / `#dc2626` yapıldı. Hero'daki rota kartı (`SURUCU_HIZMETLERI.slice(0,4)`) otomatik güncellendi.
  - Doğrulama: `npx tsc --noEmit` temiz; `npx eslint` mevcut dosyadaki eski `any`/`<a>` uyarıları dışında yeni hata çıkarmadı. `next build` çalıştırılmadı (sandbox'ta canlı Supabase bağlantısı riskli) — deploy öncesi Bayram'ın lokalde/Vercel preview'da görsel kontrol etmesi önerilir.
  - **Not:** `/yol-rehberi` kategori query param desteklemiyor (`YolRehberiClient.tsx`'de `useSearchParams` yok) — istenirse Lastikçi/Park/Yemek kartları için ileride `?anaKategori=`/`?altKategori=` deep-link desteği eklenebilir (Suspense boundary gerektirir).
- **Yakınımdaki Yükler** (1 Temmuz 2026): `/yol-rehberi` haritasına 3. sekme ("📦 Yükler") eklendi — stealth büyüme stratejisine uygun, sürücü zaten haritayı açmışken arka planda yük keşfi.
  - `lib/il-koordinatlari.ts`: 81 il merkez koordinatı (`app/api/admin/poi-import/route.ts` içindeki tablonun kopyası) + `enYakinIl(lat,lng)` — GPS'ten offline haversine ile en yakın ili bulur (Geocoding API çağrısı YOK, ek maliyet yok).
  - `docs/20260701_nearby_listings_rpc.sql`: `get_nearby_listings_by_city(p_city, p_district, p_limit)` RPC — **gerçek şema** (`origin_city`/`origin_district`, varış `listing_stops`'un son durağından `DISTINCT ON` ile) ile yazıldı.
  - **Not:** `docs/20260610_poi_module.sql` içindeki eski `get_nearby_listings_for_parked_driver` fonksiyonu `listings.dest_city`/`title`/`load_type` gibi olmayan kolonları referans alıyor — çağrılırsa hata verir, kullanılmıyor, silinmedi (geriye dönük doküman amaçlı duruyor).
  - `/api/listings/yakin` (GET, `?lat=&lng=`): en yakın ili bulur, RPC'yi çağırır, ilan listesini döner.
  - UI: `YolRehberiClient.tsx` — Liste/Harita yanına "📦 Yükler" toggle, `YukListeKart` bileşeni (kalkış→varış, fiyat, araç tipi, "YAKININDA" rozeti ilçe eşleşmesinde), `/ilan/[id]`'e link.
  - **Faz 1 kapsamı:** il bazlı (gerçek km mesafesi değil). Faz 2: `listings`/`listing_stops`'a gerçek koordinat + PostGIS bbox sorgusu (bkz. altta "🔮 Faz 2").
  - Migration: `docs/20260701_nearby_listings_rpc.sql` (Supabase SQL Editor'da manuel çalıştırılmalı).
- **POI Kalite Puanlama + Toplu Onay** (19 Haziran 2026): `/admin/poi-onay` sayfasına kalite puanı ve toplu seç/onayla eklendi.
  - `lib/poi-score.ts`: 0-100 kalite puanı hesaplar (telefon +20, website +10, tam adres +15, isimde TİR/kamyon anahtarı +20, Google rating≥4&yorum≥10 +25 / rating<2.5&yorum≥20 -40, blacklist isim -50, kategori çelişkisi -50). Eşik: ≥70 yeşil, 40-69 sarı, <40 kırmızı. İ/I trLower normalize.
  - `/api/admin/poi` GET: her kayda `quality_score`, `score_level`, `score_reasons` ekler (DB'ye yazılmaz, runtime); select'e Google alanları eklendi.
  - `/api/admin/poi` PATCH (yeni): toplu durum güncelleme `{ ids[], status }`, service role, `.in()` 50'lik chunk.
  - UI: her kartta checkbox + puan rozeti (hover'da gerekçe tooltip), liste üstünde toplu bar ("Puan≥70 Seç" / Tümünü Seç / Seçilenleri Onayla / Reddet). Onay insan eliyle — puan tek başına approved yapmaz.
  - Rozet "Kalite XX" yazıyor (Google puanıyla karışmasın diye); kart sağındaki Google puanı "Google ★ X.X" olarak ayrı. Sıralamaya "Kalite Skoru" eklendi (varsayılan, azalan) — skor DB kolonu olmadığı için client-side sıralanır.
  - **Not:** Şema değişikliği YOK, migration gerekmez. Puan tamamen runtime hesaplanır.
- **POI Google Places Entegrasyonu** (15 Haziran 2026): Mevcut POI modülüne Google Places veri pipeline'ı eklendi.
  - DB: `google_place_id` (unique), `google_rating`, `google_review_count`, `reviews_summary`, `verified`, `satellite_confirmed`, `is_active`, `last_synced_at` kolonları. 11 yeni TIR-spesifik kategori.
  - API: `/api/admin/poi-import` (Places Text Search + Details, upsert, duplicate engeli), `/api/admin/poi-import/[id]/summarize` (Claude Haiku ile Türkçe özet).
  - Admin paneli (`/admin/poi-onay`): "Google'dan Veri Çek" bölümü (il dropdown, kategori multi-select), uydu onay checkbox, yorum özeti butonu, Claude özet gösterimi.
  - Frontend: 11 yeni kategori chip, etiket listesi güncellendi.
  - Migration: `docs/20260615_poi_google_integration.sql`.
  - Env: `GOOGLE_PLACES_API_KEY` zorunlu.
- **POI Modülü / Yol Rehberi** (10 Haziran 2026): Kamyon şoförleri için konum tabanlı harita modülü.
  - DB: `pois`, `poi_reviews`, `poi_visit_logs`, `poi_stay_events` tabloları. PostGIS geography index.
  - RPCs: `get_pois_in_bbox` (bounding box + akıllı sıralama), `check_poi_visit` (200m geo-fence), `get_nearby_listings_for_parked_driver`, `get_parked_drivers_for_notification`.
  - API: `/api/poi` (GET bbox sorgu, POST ekle), `/api/poi/[id]` (detay), `/api/poi/[id]/review` (yorum + geo-fence).
  - Frontend: `/yol-rehberi` — React-Leaflet harita, 6 kategori chip, Tier 2 alt filtreler, SOS butonu, bottom sheet liste, POI detay modalı, yorum formu (hızlı etiket + yıldız), yeni POI ekleme modalı.
  - Contextual cross-entegrasyon: kullanıcı 3h+ parkta kalınca şehirdeki yük ilanları önerisi (pg_cron altyapısı hazır).
  - Migration: `docs/20260610_poi_module.sql`.
- **Radar & İstihbarat Paneli** (4 Haziran 2026): Admin satış radari — iki modül.
  - **Lead Radar** (`/admin/radar`): Rota bazlı (kalkış+varış) lead arama. `get_radar_intelligence` RPC, phone normalize, frekans+NLP sınıflandırma, WA/davet/geçmiş aksiyonları. Migration: `docs/20260604_radar_intelligence_rpc.sql`.
  - **Analitik Dashboard** (`/admin/radar/analitik`): QlikView-tarzı drill-down. Şehir listesi sol panel, varış/kalkış bar chart, araç tipi dağılımı, sparkline. `get_radar_city_overview` + `get_radar_city_detail(direction)` RPC. Migration: `docs/20260604_radar_analitik_rpc.sql`.
  - API: `app/api/admin/radar/route.ts` + `app/api/admin/radar/analitik/route.ts`.
- **Shadow Profile / CRM** (1 Haziran 2026): WhatsApp'tan ilan atan kayıtsız numaraların otomatik profillenmesi.
  - `shadow_profiles` tablosu: phone (unique), name, company_name, notes, status, converted_user_id. RLS: admin only.
  - `listings.shadow_profile_id` FK eklendi.
  - Upsert RPC: `upsert_shadow_profile(p_phone)` — transaction güvenli, SECURITY DEFINER.
  - Entegrasyon: `/api/whatsapp/route.ts` (kayıtsız numara → fire-and-forget upsert + kayıt linki), `parse-listing` Edge Fn (contact_phone + user_id yoksa → upsert + listing'e shadow_profile_id set).
  - Admin CRM paneli `/admin/crm`: filtreleme (telefon arama, min ilan sayısı "balina" modu), sayfalama, sağdan açılan detay drawer (ilan geçmişi, isim/not/şirket düzenleme, durum).
  - Migration: `docs/20260601_shadow_profiles_crm.sql`.
- **Link Havuzu** (21 May 2026): Mesajlardaki URL'leri otomatik arşivleyen ve admin/moderatöre "yeni ilan kaynağı" olarak sunan radar sistemi.
  - `archived_links` tablosu: `url, domain, category, status, source, raw_post_id, user_id`. Unique index `url` üzerinde (duplicate yok).
  - URL çıkarma: `extractUrlsFromText` / `extractUrlsEdge` helper — `https?://...` regex, trailing punctuation trim, domain tespiti.
  - Ön kategori: `chat.whatsapp.com` → `whatsapp_group`, `t.me` → `telegram`, `facebook.com` → `facebook_group` vb.
  - Entegrasyon noktaları: `app/api/parse-text/route.ts` (kullanıcı metni) + `supabase/functions/parse-listing/index.ts` (WhatsApp ZIP). Her ikisi fire-and-forget, ana akışı etkilemez.
  - Admin UI: `/admin/link-havuzu` — status/category filtresi, Onayla/Reddet butonları, sayfalama.
  - API: `app/api/admin/link-havuzu/route.ts` (GET + PATCH, admin+moderatör yetkili).
  - Migration: `docs/20260521_archived_links.sql`.
  - WhatsApp Bot entegrasyonu da `whatsapp_parse` source ile tabloya yazar; `app/api/whatsapp/route.ts`'ye aynı fire-and-forget bloğu eklenebilir (isteğe bağlı).
- **Smart Learning Hub (SLH)** (14 May 2026): `/admin/ogrenme-merkezi` — 3 sekmeli alias yönetim paneli.
  - Sekme 1 — Alias Kütüphanesi: CRUD (ekle/düzenle/sil), tip filtresi (`city`, `vehicle`, `blacklist`), arama. 
  - Sekme 2 — AI Keşif Alanı: `raw_posts.processing_status='no_lane'` + `listings.origin_city IS NULL` listeleme; Haiku ile toplu alias keşfi (confidence≥70 → pending + `is_active=false`).
  - Sekme 3 — Onay Bekleyen: human-in-the-loop onay/red (`is_approved=true`+`is_active=true`) + “Yeniden İşle” re-parse trigger.
  - **Önemli kolon adları:** `aliases.normalized` (canonical değil), `raw_posts.raw_text` (message_text değil), `raw_posts.slh_scanned_at` (tarama takibi).
  - `raw_posts.slh_scanned_at`: NULL = hiç taranmadı; dolu = LLM gördü, bir daha gönderilmez. Migration: `docs/20260514_slh_scan_tracking.sql`.
  - Alias ekleme/düzenleme: city tipinde İl/İlçe seçimi — İl → `district: null`, İlçe → `district` dolu.
  - Admin ana sayfa: ReprocessWidget kaldırıldı, Öğrenme Merkezi kartı eklendi.
  - Migration: `docs/20260514_slh_aliases_columns.sql` (`created_by_ai`, `is_approved`, `approved_by`, `approved_at`, `llm_confidence`, `source_listing_ids`).
  - API: `app/api/admin/learn-aliases/route.ts` (GET/POST/PATCH/DELETE).
- **Expired pending otomatik arşiv** (12 May 2026): pg_cron job — her saat başı, 24 saatten eski `pending` ilanları `archived` yapar. Migration: `docs/20260512_auto_archive_expired_pending.sql`.
- **WhatsApp Bot** (12 May 2026): `app/api/whatsapp/route.ts` — Twilio Sandbox entegrasyonu, kayıt/kota/LLM parse/listing insert akışı. +90 normalize, imza doğrulama, TwiML yanıt. `price_offer`+`vehicle_type[]` şema uyumu.
- **WhatsApp ZIP Import düzeltmeleri** (14 May 2026): (1) Varsayılan saat filtresi 12→48 saat. (2) `batchKeys` Set ile intra-batch dedup — aynı `(hash,phone,date)` kombinasyonu batch içinde çakışınca tüm insert'in 23505 ile patlaması düzeltildi. (3) Sonuç satırına `alias_count` + collapsible debug log paneli eklendi.
- **Log implementasyonu** (12 May 2026): `lib/logger.ts` oluşturuldu. `proxy.ts` SecurityLogger, `parse-listing` pre_check_failed + error, `excel-import` satır-bazlı + tamamlanma, `parse-text` quota WARN, `ilan-ver/actions.ts` ilan yaratma INFO/ERROR, `moderator/toplu-islem` tüm moderasyon aksiyonları — tümü devreye alındı.
- Auth (OTP + e-posta + Google + merge), profil-tamamla
- Moderatör paneli v3, admin paneli
- WhatsApp parse + alias, Excel yükleme, Sahiplen akışı
- Panel (İlanlarım / Araçlarım / Profilim)
- Güvenlik Sprint 1–5
- Tekil ilan formu (yük + araç)
- **Metinden İlan akışı** (8 May 2026): kullanıcı WhatsApp/serbest metni yapıştırır → `/api/parse-text` Haiku LLM ile JSON çıkarır → mevcut tekil form prefilled olarak açılır → kullanıcı düzeltir + yayınlar. `listings.raw_text` doldurulur (source: 'form' korundu, CHECK karıştırmamak için).
- **Audit eşikleri konfigüre edilebilir** (8 May 2026): `system_config.parse.auto_publish_score_max` (default 31) ve `parse.reject_score_min` (default 71). Hem DB trigger (`audit_listing_fn`) hem `/api/ilan/duzelt` `lib/auditLimits.ts` helper'ını kullanır. Reject seviyesi artık shadow_ban + `moderation_status='archived'` set ediyor ("hiç dikkate alınmasın"). Migration: `docs/20260508_audit_thresholds_and_ai_quota.sql`.
- **Per-user AI ilan limiti** (8 May 2026): `users.ai_listing_quota_daily` (NULL=default), `system_config.llm.ai_listing_quota_default` (default 5/gün). `/api/parse-text` parse öncesi son 24s'lik AI ilan sayısını (`raw_text IS NOT NULL`) kontrol eder, dolduysa 429. Admin UI: `/admin/kullanicilar` tablosunda **AI Limit / Gün** sütunu — tıklanıp düzenlenebilir, boş = default, 0 = AI kapalı.
- Landing page (3 senaryo)
- Landing performans: getSession (network'üz), paralel auth+listings, progressive rozet zenginleştirme, limit 30, cancel guard
- Nasıl Çalışır, Hakkımızda, KVKK, Kullanım Koşulları

### ⏳ Faz 1 — Kalanlar
1. **Müşteri ilan detayı** — plaka onay, araç sil/pasifleştir modalları, progress bar
2. **E-posta bildirimleri** — durum değişikliklerinde tetiklenen mailler
3. **WhatsApp Bot** — nakliyeci/müşteri WhatsApp'tan mesaj atar → bot LLM ile ayrıştırır → ilan oluşturulur → link döner (detay: §11) ✅
3. **Log implementasyonu** (detay: `docs/LOG_VE_GUVENLIK_SPECLERI.md` §4 kontrol listesi)
   - `proxy.ts` → `SecurityLogger` (yetkisiz phone erişim → WARN) ✅
   - `supabase/functions/parse-listing` → null input `pre_check_failed` logu + error log ✅
   - `/api/excel-import` → satır bazlı validasyon + tamamlanma logu ✅
   - `/api/parse-text` → quota aşımı WARN logu ✅
   - `lib/logger.ts` → `logRlsError()` yardımcısı oluşturuldu; diğer route'larda kullanılabilir ✅
   - `app/ilan/[id]` → henüz `raw_text` yok; Faz 2'de ekle ⏳
   - Vercel Analytics bot-trafik izleme → altyapı gerektiriyor, Faz 2 ⏳

### 🔧 Kısmi / Geliştirme Gereken
- Profil: doğrulama rozetleri, güven skoru
- Nakliyeci araç formu: marka/model/yıl/ruhsat belgesi
- Kayıtlı adresler (müşteri)

### 🔮 Faz 2
- **Yakınımdaki Yükler — gerçek mesafe:** `listings`/`listing_stops`'a `origin_location geography(Point,4326)` kolonu, ilan oluşturulurken (form/WhatsApp/Excel) geocoding, `get_listings_near_point(lat,lng,radius_m)` RPC (POI'deki `get_pois_in_bbox` mantığının aynısı) — haritada gerçek "500m yarıçap" gösterimi ve mesafeye göre sıralama.
- "Bu işi aldım" akışı (durum güncellemeleri, bildirim, ilan pasife)
- **Güven ve İtibar Sistemi** — çift körleme puanlama, rozet sistemi (detay: §15)
- Trust score, MERNİS/GİB, canlı konum
- Doğal dil arama, ödeme sistemi, push bildirim
- **WhatsApp'tan İlan Gönder CTA** — Hero bölümüne WhatsApp ikonlu buton ("💬 İlanını WhatsApp'tan Gönder"), GA event + deep link entegrasyonu

---

## 11. WHATSAPP BOT (Faz 1)

### Kullanıcı Akışı
```
Kullanıcı WhatsApp'tan yazar:
  "Selam, yarın Konya'dan İstanbul'a 20 ton buğdayım var, tır lazım."
    ↓
[1] KAYIT KONTROLÜ
    SELECT * FROM users WHERE phone = '+90...' LIMIT 1
    ↓
    ✗ Kayıt yok → Bot cevap yazar:
        "Bu numara ile kayıtlı hesap bulunamadı.
         Kayıt olmak için: yukegel.app/giris"
        → AKIŞ DURUR (LLM çağrılmaz)
    ✓ Kayıt var → devam
    ↓
[2] AI KOTA KONTROLÜ (LLM'den önce)
    Son 24s içinde bu user'ın WhatsApp'tan oluşturduğu ilan sayısı
    >= ai_listing_quota_daily → Bot cevap yazar:
        "Günlük AI ilan limitine ulaştınız.
         Yeni ilanı yukegel.app/ilan-ver adresinden oluşturabilirsiniz."
        → AKIŞ DURUR (LLM çağrılmaz)
    < limit → devam
    ↓
[3] LLM PARSE (Haiku)
    Metni ayrıştırır:
    { nereden: "Konya", nereye: "İstanbul", yuk: "Buğday",
      agirlik: 20, birim: "ton", arac_tipi: "Tır" }
    ↓
[4] listing + listing_stops tablolarına INSERT (source: 'whatsapp')
    ↓
Bot WhatsApp'tan cevap yazar:
  "İlanın yayına alındı! ✅ Link: yukegel.app/ilan/123"
```

### Teknik Gereksinimler
| Bileşen | Açıklama | Durum |
|---|---|---|
| Webhook endpoint | `app/api/whatsapp/route.ts` — Twilio POST alır, TwiML ile yanıtlar | ✅ |
| WhatsApp Business API | **Twilio** Sandbox — webhook kaydı yapıldı | ✅ |
| Mesaj yönlendirme | Numaraya göre kullanıcı eşleme (`users.phone`, +90 normalize) | ✅ |
| Parse | Mevcut `parse-listing` Edge Fn veya `/api/parse-text` kullanılır (regex + LLM) | ✅ |
| Kayıtsız kullanıcı | Kayıt yok → LLM çağrılmadan kayıt linki döner, ilan açılmaz | ✅ |
| Quota | LLM'den önce `ai_listing_quota_daily` kontrolü — `source='whatsapp'` dahil | ✅ |
| Landing hero | WhatsApp botunu ön plana çıkaran mesaj/CTA ("Sadece yaz, ilanın yayında") | 🔮 Yapılacak |

### Landing Entegrasyonu
- Hero bölümünde WhatsApp ikonlu belirgin CTA: **"WhatsApp'tan yaz, saniyeler içinde yayında"**
- Nasıl Çalışır sayfasına WhatsApp adımı eklenmeli
- Mobilde direkt WhatsApp deep link: `https://wa.me/90XXXXXXXXXX?text=...`

### Öncelik Sırası
1. WhatsApp Business API hesabı + webhook kaydı
2. `/api/whatsapp-parse` endpoint (mevcut parse altyapısını çağırır)
3. Kullanıcı eşleme + onboarding yanıtı
4. Landing hero güncellemesi

---

---

## 15. GÜVEN VE İTİBAR SİSTEMİ (Airbnb Çift Körleme Modeli)

### Genel Bakış
Platform güvenilirliğini artırmak için çift kör (double-blind) puanlama sistemi. İki taraf da yorum yazmadan yorumlar yayınlanmaz; sadece biri yazarsa 7 gün sonra otomatik yayınlanır.

### İş Akışı
```
1. Nakliyeci → "İşi Aldım" butonu → Yük sahibi onayı → transaction kaydı oluşur
2. Taşıma tamamlandıktan 24 saat sonra her iki tarafa değerlendirme bildirimi
3. Her iki taraf yorum yazarsa → anında is_published = true
4. Sadece biri yazarsa → 7 günlük cron job otomatik yayınlar
5. Hiçbiri yazmazsa → yorum kaydı açık kalır, 7 gün sonra kapanır
```

### Veritabanı Gereksinimleri
```sql
-- transactions tablosu ("Bu işi aldım" akışı için)
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  carrier_id uuid REFERENCES users(id),   -- nakliyeci
  owner_id uuid REFERENCES users(id),     -- yük sahibi
  status text DEFAULT 'pending',          -- pending|active|completed|cancelled
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- reviews tablosu
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id),
  listing_id uuid REFERENCES listings(id),
  reviewer_id uuid REFERENCES users(id),
  target_id uuid REFERENCES users(id),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  published_at timestamptz
);
```
RLS: Kullanıcı yalnızca kendi yazdığı yorumları ve `is_published = true` olanları görebilir.

### Çift Körleme Mantığı (Edge Function / DB Webhook)
- Her iki taraf `reviews` tablosuna yazdığında → her iki kaydı da `is_published = true` yap
- pg_cron (günlük): `created_at < now() - interval '7 days'` olan tek taraflı kayıtları yayınla

### Rozet Sistemi
| Rozet | Kriter | Kime |
|---|---|---|
| ⚡ Hızlı Ödemeci | Faz 2 ödeme modülüyle tanımlanacak | Yük sahibi |
| 🛡️ Güvenilir Nakliyeci | Son 10 işte ortalama puan ≥ 4.5 | Nakliyeci |
| ⏰ Dakik Şoför | Zamanında teslimat oranı ≥ %90 | Nakliyeci |

Rozetler DB function ile hesaplanır, `users.badges jsonb` kolonunda saklanır.

### UI/UX Gereksinimleri
- **İlan Kartları:** Yük sahibinin ⭐ puanı + toplam tamamladığı iş sayısı kart üzerinde
- **Profil Sayfası:** Alınan yorumlar kronolojik liste + kazanılan rozetler bölümü
- **Değerlendirme Formu:** 5 yıldız + metin alanı (opsiyonel), "Puanla ve Bitir" butonu
- **Çift körleme durumu:** "Karşı taraf henüz değerlendirme yazmadı, X gün sonra yayınlanacak"

### Görevler
- [ ] `transactions` tablosu + RLS politikaları
- [ ] `reviews` tablosu + RLS politikaları
- [ ] `users.badges jsonb` kolonu
- [ ] "İşi Aldım" butonu → yük sahibi onay/red akışı (transaction INSERT)
- [ ] Çift körleme mantığı: DB Webhook veya Edge Function
- [ ] pg_cron job: 7 günlük tek taraflı yorum otomatik yayınlama
- [ ] Taşıma bittikten 24s sonra değerlendirme bildirimi tetikleyicisi
- [ ] Rozet hesaplama DB function
- [ ] İlan kartına puan + iş sayısı bileşeni
- [ ] Profil sayfasına Yorumlar + Rozetler bölümü
- [ ] Değerlendirme formu UI (nakliyeci tarafı + müşteri tarafı)

### Öncelik Sırası
1. DB şeması (`transactions` + `reviews` + `users.badges`)
2. "İşi Aldım / Onayla" transaction akışı UI
3. Değerlendirme formu UI'ları
4. Çift körleme Edge Function + pg_cron
5. Bildirim tetikleyicileri (24s sonra)
6. Profil sayfası güncelleme + rozet sistemi

---

## 12. BİLİNEN BUGLAR

| # | Bug | Durum |
|---|---|---|
| 1 | WhatsApp iOS format | ✅ |
| 2 | users!fk join production | ✅ |
| 3 | Browser client toplu işlem RLS | ✅ |
| 4 | E-posta kayıt profil-tamamla | ✅ |
| 5 | Admin/Gmail /ilan-ver erişim | ✅ |
| 6 | Moderatör düzenleme: ilçe/input her tuşta focus kaybı (inline component) | ✅ 8 May 2026 |
| 7 | `refresh_token_not_found` — geçersiz token döngüsü | ✅ 12 May 2026 — middleware.ts eklendi, getCurrentUser hata yakalıyor |
| 8 | Toplu işlem `.in()` URL limiti — 50'lik batch ile düzeltildi | ✅ 12 May 2026 |
| 9 | WhatsApp ZIP import: cutoff 12h→48h varsayılan + intra-batch 23505 | ✅ 14 May 2026 |
