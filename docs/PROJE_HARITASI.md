# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
> Son güncelleme: 21 Mayıs 2026 — `lib/auth.ts` temizliği: `requireModerator` ve `landingForRole` kaldırıldı (proxy.ts + service_role'e taşınmıştı); `lib/logger.ts` maskeleme fonksiyonları KVKK fazı için bilerek korunuyor

**Referans Dökümanlar:**
- `docs/LOG_VE_GUVENLIK_SPECLERI.md` — Log format standartları, audit trail, SecurityLogger kontrol listesi

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
│   ├── giris/page.tsx
│   ├── auth/callback/ + reset/
│   ├── profil-tamamla/page.tsx
│   ├── panel/ (page + PanelClient + IlanYonetim)
│   ├── ilan/[id]/ (page + Aksiyonlar + sahiplen)
│   ├── ilan-ver/ (page + actions + TopluYukle + MetindenIlan)
│   ├── araclarim/page.tsx
│   ├── moderator/ + moderator-giris/
│   ├── admin/ (page + kullanicilar + sistem-ayarlari + guvenlik + crm)
│   ├── cikis/
│   └── u/[username]/page.tsx
│
├── api/
│   ├── admin/kullanici/ + guvenlik/
│   ├── auth/merge/ + switch-account/ + tekil-kontrol/
│   ├── excel-import/
│   ├── ilan/pasif/ + duzelt/
│   ├── llm-parse/
│   ├── moderator/kullanici-askiya/ + toplu-islem/
│   ├── parse-text/                       # ✍️ Metinden ilan: LLM (Haiku) ile JSON çıkarımı ✅
│   └── whatsapp-parse/
│
├── lib/auth.ts + supabase.ts
├── supabase/functions/parse-listing/index.ts
├── proxy.ts
│   └── api/ilanlar/[id]/route.ts       # Public AI-readable API ✅
├── public/robots.txt                   # GPTBot + ClaudeBot izinleri ✅
└── docs/
```

---

## 3. VERİTABANI ŞEMASI (public.*)

### `listings`
```
moderation_status: 'pending'|'approved'|'rejected'|'auto_published'|'archived'|'correction_needed'
status: 'active'|'passive'|'completed'|'expired'
is_shadow_banned, audit_score, internal_audit_logs (JSONB)
user_id (nullable), source: 'form'|'whatsapp'|'excel'
```

### `users` — `role`, `is_active`, `user_type`, `phone_verified`, `company_name`, `ai_listing_quota_daily` (NULL = sistem default)
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
| `/api/excel-import` | Excel toplu yükleme (auto_published) |
| `/api/auth/tekil-kontrol` | telefon/tckn/vkn tekillik (service role) |
| `/api/parse-text` | Tekil kullanıcı metnini Haiku ile JSON'a çevirir + per-user günlük quota kontrolü (429) |
| `/api/whatsapp` | Twilio WhatsApp webhook — kayıt/kota kontrolü + LLM parse + ilan oluştur |
| `/api/admin/kullanici` | role / is_active / moderator_sources / **ai_listing_quota_daily** PATCH |

---

## 8. PROXY MANTIĞI

```
Açık rotalar: /giris, /auth/, /profil-tamamla, /nasil-calisir, /hakkimizda,
              /kvkk, /kullanim-kosullari, /api/, ...
1. Açık rota → geç
2. Giriş yok + korumalı → /giris?redirect=
3. Giriş var:
   - maybeSingle() ile users.select('user_type, role')
   - role=admin|moderator → direkt geç
   - user_type yoksa → /profil-tamamla
```

---

## 9. KURALLAR & TUZAKLAR

- `maybeSingle()` — callback, proxy, actions her yerde
- `is_shadow_banned = false` — page.tsx + u/[username]/page.tsx zorunlu
- Audit trigger sadece INSERT; re-scan → `/api/ilan/duzelt`
- `correction_needed` CHECK → `docs/20260505_correction_needed.sql`
- Toplu işlem + archived → service role zorunlu
- Server action → ayrı dosya + `'use server'`
- Vercel env → dashboard; `.next` cache → `rm -rf .next`
- Supabase → Redirect URLs'e production URL eklenmeli
- **`write_file` tüm dosyayı ezer** — küçük değişiklikler için `str_replace` kullan
- **İnline component anti-pattern**: Parent fonksiyonu içinde tanımlanan component'leri JSX olarak çağırmak (`<EditForm />`) her render'da yeni component tipi yaratır → input focus kaybolur, cursor başa döner. Çözüm: fonksiyon çağrısı (`{EditForm({})}`) veya parent dışına taşı.

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
| Panel | `/panel` | ✅ |
| İlan detay | `/ilan/[id]` | ✅ kısmi |
| Tekil ilan formu | `/ilan-ver` | ✅ |
| Metinden ilan (LLM) | `/ilan-ver` (yöntem=metin) | ✅ |
| Toplu yükleme | `/ilan-ver` | ✅ kısmi |
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
| 4 | `public/robots.txt` | GPTBot, ClaudeBot izinleri + Sitemap path |
| 5 | `app/api/ilanlar/[id]/route.ts` | Public JSON API (hassas veri yok, 5dk cache) |
| 6 | `app/ilan/[id]/page.tsx` | `audit_score` → metadata + `data-quality-score` + görsel rozet |

**Sitemap**: `app/sitemap.ts` ✅ — aktif+onaylı ilanlar, 5000 limit, statik sayfalar dahil.

---

## 14. GÖREV DURUMU

### ✅ Tamamlanan
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
