# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
> Son güncelleme: 10 Temmuz 2026 — Landing page "sürücünün yol arkadaşı" (driver-mate) formatına güncellendi (bkz. 10. KULLANICI AKIŞLARI altı / GÖREV DURUMU).

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
│   ├── excel-import/
│   ├── ilan/pasif/ + duzelt/
│   ├── llm-parse/
│   ├── moderator/kullanici-askiya/ + toplu-islem/
│   ├── parse-text/                       # ✍️ Metinden ilan: LLM (Haiku) ile JSON çıkarımı ✅
│   ├── poi/route.ts                      # GET (bbox sorgu + sıralama), POST (yeni POI) ✅
│   ├── poi/[id]/route.ts                 # GET detay + son yorumlar ✅
│   ├── poi/[id]/review/route.ts          # POST yorum + geo-fence doğrulama ✅
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
```

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
- **Ağır/çoklu-dosya işleyen API route'ları** (`whatsapp-parse`, `learn-aliases`, `crm/[id]/analiz`) → `export const maxDuration = 60` şart; yoksa Vercel default timeout'ta düz-metin hata sayfası ("An error occurred with your deployment...") döner ve frontend'in `res.json()` çağrısı "Unexpected token" hatasıyla patlar
- **Frontend fetch + `.json()` pattern'i** → önce `res.text()` al, sonra `JSON.parse` dene (try/catch); Vercel platform hataları (413/504) JSON değil HTML/düz-metin döner
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
| Yol Rehberi (POI) | `/yol-rehberi` | ✅ |
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
