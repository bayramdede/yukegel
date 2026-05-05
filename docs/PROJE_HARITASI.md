# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
> Son güncelleme: 5 Mayıs 2026 — Moderatör panel v3 (service role bulk ops, akıllı butonlar)

---

## 1. STACK & ORTAM

| Katman | Teknoloji |
|---|---|
| Frontend/Backend | Next.js 15 (App Router, TypeScript) |
| DB / Auth | Supabase (gobepcswwsoswodhaufy, eu-central-1) |
| Edge Functions | Supabase Deno (`supabase/functions/parse-listing/`) |
| Deploy | Vercel |
| LLM | Anthropic Haiku (parse fallback) |
| SMS OTP | Twilio Verify (Service SID: VA...) |
| Style | Inline CSS — dark theme: `#0d1117` bg, `#22c55e` yeşil accent, `#161b22` card |
| Font | IBM Plex Sans |

**Önemli env:**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass için)
- Vercel'de ayrıca tanımlanmalı, `.env.local`'dan otomatik geçmez.

---

## 2. PROJE DOSYA YAPISI

```
yukegel/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── giris/page.tsx
│   ├── auth/callback/ + reset/
│   ├── profil-tamamla/page.tsx
│   ├── panel/
│   │   ├── page.tsx               # SSR wrapper
│   │   ├── PanelClient.tsx        # 3 sekme: İlanlarım, Araçlarım, Profilim
│   │   └── IlanYonetim.tsx
│   ├── ilan/[id]/
│   │   ├── page.tsx
│   │   ├── Aksiyonlar.tsx
│   │   └── sahiplen/page.tsx
│   ├── ilan-ver/
│   │   ├── page.tsx
│   │   └── TopluYukle.tsx
│   ├── araclarim/page.tsx
│   ├── moderator/
│   │   ├── page.tsx               # Moderatör paneli (§4'e bak)
│   │   └── WhatsappYukle.tsx
│   ├── moderator-giris/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── kullanicilar/ (page + KullaniciTablosu)
│   │   └── sistem-ayarlari/ (page + AyarSatiri)
│   ├── cikis/
│   └── u/[username]/ (page + IlanListesi + PaylasButonu)
│
├── api/
│   ├── admin/kullanici/route.ts
│   ├── auth/merge/route.ts
│   ├── auth/switch-account/route.ts
│   ├── excel-import/route.ts
│   ├── ilan/pasif/route.ts
│   ├── llm-parse/route.ts
│   ├── moderator/
│   │   ├── kullanici-askiya/route.ts   # users.is_active=false + ilanları kapat
│   │   ├── arsiv/route.ts              # (eski, toplu-islem ile replace edildi — silinebilir)
│   │   └── toplu-islem/route.ts        # Tüm toplu işlemler service role ile (§4'e bak)
│   └── whatsapp-parse/route.ts
│
├── lib/auth.ts + supabase.ts
├── supabase/functions/parse-listing/index.ts
├── proxy.ts
└── docs/PROJE_HARITASI.md + YAPILACAKLAR.md
```

---

## 3. VERİTABANI ŞEMASI (public.*)

### `listings` — önemli alanlar
```
moderation_status: 'pending' | 'approved' | 'rejected' | 'auto_published' | 'archived'
  -- 'archived': diğer tablarda .neq('archived') ile gizlenir, 🗄️ Arşiv tab'ında ayrı yönetilir
status: 'active' | 'passive' | 'completed' | 'expired'
user_id (nullable — sahipsiz ilanlar)
reviewed_at, is_repost, source_raw_post_id
```

### `users`
```
role: 'user' | 'moderator' | 'admin'
is_active, user_type, phone_verified
merged_into (uuid), moderator_sources (text[])
```

### `raw_posts`
```
processing_status: 'pending' | 'processed' | 'no_lane' | 'rejected' | 'repost'
clean_hash, message_date (date)
Unique index: (clean_hash, contact_phone, message_date)
```

### `aliases`
```
type: 'city' | 'vehicle' | 'body' | 'blacklist'
alias (unique), normalized, is_active, priority
```

### `system_config` — `key (PK), value (jsonb)`
### `vehicles` — `user_id, plate, vehicle_type, body_types[], capacity_ton`

---

## 4. MODERATÖr PANELİ

### Tab sistemi
| Tab | Filtre | Notlar |
|---|---|---|
| ⏳ Bekleyenler | `moderation_status = pending` | Varsayılan |
| ✅ Onaylananlar | `= approved` | |
| ❌ Reddedilenler | `= rejected` | |
| 💤 Pasifler | `= passive` | |
| 📋 Hepsi | `neq archived` | Arşiv hariç tümü |
| 🔍 Çözümsüz | `raw_posts.processing_status = no_lane` | |
| 🗄️ Arşiv | `= archived` | Sarı renk; sadece ↩ Bekleyenlere Al + ❌ Reddet |

### Filtreler
- **Omnisearch:** Tel/email → 500ms debounce → `users` tablosu → KullaniciKart
- Metin: client-side (ham metin, not, şehir)
- Tel, Kalkış/Varış İl, Araç Tipi: client-side
- Tonaj min/max: client-side (stops içindeki max ton)
- **Tarih başlangıç–bitiş: server-side** `gte/lte('created_at')` — tab + tarih değişince refetch

### Kalite skoru
`telefon(30) + origin(15) + stops(15) + vehicle(20) + body(10) + ton(5) + not(5)` → 🟢≥75 / 🟡≥45 / 🔴<45

### Toplu işlemler — `topluApi()` helper
**Tüm toplu işlemler `/api/moderator/toplu-islem` üzerinden service role ile yapılır.** Browser client kullanılmaz — RLS ve CHECK constraint bypass.

```typescript
// app/api/moderator/toplu-islem/route.ts
POST { ids: string[], action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive' }
// approve   → moderation_status:'approved', status:'active'
// reject    → moderation_status:'rejected', status:'passive'
// passive   → status:'passive'
// archive   → moderation_status:'archived', status:'passive'
// unarchive → moderation_status:'pending'
```

### Akıllı buton mantığı
**Bireysel kart:**
- `moderation_status === 'approved'` → Onayla gizle
- `moderation_status === 'rejected'` → Reddet gizle
- `status === 'passive'` → Pasif gizle
- Arşiv tabı → sadece ↩ Bekleyenlere Al + ❌ Reddet

**Yüzen bar (çoklu seçim):**
- Tümü zaten `approved` → Toplu Onayla gizle
- Tümü zaten `rejected` → Reddet gizle
- Arşiv tabında → ✅ Toplu Onayla yerine ↩ Bekleyenlere Al; 🗄️ Arşivle gizle

### Diğer özellikler
- **Toplu seçim:** per-ilan checkbox + master checkbox + Shift+Click aralık
- **users join:** `users(id, display_name, phone, email, is_active)` — hata verirse fallback (kullanıcısız)
- **Kullanıcı rozeti:** ilan kartında `👤 Ad`; askıdaysa kırmızı 🚫
- **KullaniciKart → 🚫 Askıya Al:** `POST /api/moderator/kullanici-askiya`
- **LLM:** düzenleme modunda 🤖 butonu → `/api/llm-parse`
- **Alias öğrenme:** onayda upsert

---

## 5. WHATSAPP PARSE PIPELINE

```
ZIP/TXT yükle → WhatsappYukle.tsx → /api/whatsapp-parse
  parseChatTxt():
    Android: [DD.MM.YYYY HH:MM:SS] Gönderen: mesaj
    iOS:     DD.MM.YYYY, HH:MM - Gönderen: mesaj
  ZIP içi dosya: _chat.txt → chat → sohbet → tek .txt (öncelik sırası)
  gatekeeper → spamKontrol → duplicate check → raw_posts INSERT
  → DB trigger → parse-listing Edge Function → listings + listing_stops
Response: { total_messages, saved_to_db, skipped, spam_blocked, reposted }
total_messages=0 → "format kontrol et" uyarısı gösterilir
```

---

## 6. API ROUTES — MODERATÖr

### `/api/moderator/toplu-islem` (POST)
```
{ ids, action } — service role, mod/admin session zorunlu
action: approve | reject | passive | archive | unarchive
```

### `/api/moderator/kullanici-askiya` (POST)
```
{ userId } — service role
users.is_active = false
listings → rejected/passive (completed hariç)
```

### `/api/moderator/arsiv` (POST) — deprecated, toplu-islem ile replace edildi

---

## 7. LIB / AUTH / MIDDLEWARE

```typescript
// lib/auth.ts
getServerSupabase()   // SSR client (cookie)
getServiceSupabase()  // Service role (RLS bypass)
requireModerator()    // Mod/admin değilse redirect
landingForRole(role)  // admin→/admin | moderator→/moderator | diğer→/panel
```

```
// proxy.ts middleware
PROFIL_KONTROLSUZ = ['/admin', '/moderator']  // user_type kontrolü yok
Giriş yapmamış + korumalı → /giris?redirect=...
user_type yok + kontrolsuz değil → /profil-tamamla
```

---

## 8. AUTH AKIŞI

```
Telefon OTP → merged_into varsa switch-account → user_type yoksa profil-tamamla
E-posta   → /auth/callback → role bazlı redirect
Google    → /auth/callback → role bazlı redirect
```

---

## 9. KURALLAR & TUZAKLAR

- **Moderatör toplu işlem = service role API** — browser client RLS'i keser; `topluApi()` helper her zaman `/api/moderator/toplu-islem` çağırır
- **users join** → `users(...)` yaz, `users!fk_adı(...)` FK adı production'da farklı olabilir; join hata verince fallback query devreye girer
- **`moderation_status: 'archived'`** CHECK constraint bypass için service role şart
- **`listings.user_id` FK yok** — users join kaldırıldı, kullanıcı rozeti şimdilik gizli. Supabase'de FK eklenir eklenmez `users(id, display_name, is_active)` join ile geri alınabilir.
- `getServiceSupabase()` → sadece mod/admin doğrulandıktan sonra kullan
- Server action → ayrı dosyada `'use server'` zorunlu
- `new URL(request.url).origin` kullan, env var değil
- `message_date` → `date` type (timestamptz değil)
- Vercel env → dashboard'dan set et
- `.next` cache sorununda → `rm -rf .next` + restart

---

## 10. GÖREV DURUMU

### ✅ Tamamlanan
- Parse sistemi + alias öğrenme
- Auth tam akış (OTP, e-posta, Google, merge/switch, profil-tamamla)
- Admin paneli (dashboard, kullanıcı, sistem ayarları)
- **Moderatör paneli v3:**
  - Omnisearch (tel/email → KullaniciKart + 🚫 Askıya Al)
  - Toplu seçim + master checkbox + Shift+Click
  - **Tüm bulk ops service role API üzerinden** (`/api/moderator/toplu-islem`)
  - Akıllı butonlar — approved ilan tekrar onaylanamaz, rejected ilan tekrar reddedilemez
  - Yüzen bar — seçili ilanların durumuna göre dinamik butonlar
  - 🗄️ Arşiv tab — sadece ↩ Bekleyenlere Al + ❌ Reddet
  - Tarih filtresi (server-side), tonaj filtresi (client-side)
  - users join + fallback, kullanıcı rozeti
- WhatsApp parse: iOS format + ZIP bulucu + detaylı response
- Tekil yük ilanı formu, Excel toplu yükleme
- "Sahiplen" akışı (OTP)
- Panel (İlanlarım / Araçlarım / Profilim)
- Ana sayfa + filtreleme

### ⏳ Öncelikli (Faz 1 kalanlar)
1. E-posta kayıt → profil-tamamla (production test edilmedi)
2. `/ilan-ver` → `user_type` yoksa profil-tamamla yönlendirme
3. **"Bu işi aldım" akışı** — nakliyeci durum akışı (İşi Aldı → Yükü Aldı → Taşımada → Teslim Etti)
4. Blacklist yönetimi (admin paneli)
5. Landing page
6. E-posta bildirimleri

### 🔮 Faz 2
Trust score, MERNİS/GİB, canlı konum, doğal dil arama, ödeme

---

## 11. BİLİNEN BUGLAR

| # | Bug | Durum |
|---|---|---|
| 1 | WhatsApp iOS format parse edilmiyordu | ✅ Düzeltildi |
| 2 | `users!fk` join → production'da ilanlar boş | ✅ Düzeltildi |
| 3 | Browser client toplu onay/arşiv → RLS/CHECK sessiz hata | ✅ Düzeltildi (service role API) |
| 4 | E-posta kayıt → profil-tamamla (production test yok) | Açık |

---

## 12. NASIL KULLANILIR

```
"docs/PROJE_HARITASI.md dosyasını oku, sonra [görev]'i yapalım"
```
