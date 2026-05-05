# Yükegel — Proje Haritası
> **Kullanım:** Her sohbet başında sadece bu dosyayı oku. Kaynak dosyaları sadece o dosyada değişiklik yapacaksan oku.  
> Son güncelleme: 5 Mayıs 2026 — Sprint 5 tamamlandı (correction_needed + düzeltme akışı)

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
│   ├── page.tsx                        # is_shadow_banned = false filtresi
│   ├── layout.tsx / globals.css
│   ├── giris/page.tsx
│   ├── auth/callback/ + reset/
│   ├── profil-tamamla/page.tsx
│   ├── panel/
│   │   ├── page.tsx
│   │   ├── PanelClient.tsx             # correction_needed + düzeltme formu
│   │   └── IlanYonetim.tsx
│   ├── ilan/[id]/
│   │   ├── page.tsx                    # shadow ban erişim kontrolü
│   │   ├── Aksiyonlar.tsx
│   │   └── sahiplen/page.tsx
│   ├── ilan-ver/page.tsx + TopluYukle.tsx
│   ├── araclarim/page.tsx
│   ├── moderator/
│   │   ├── page.tsx                    # Düzeltme İste butonu + toplu
│   │   └── WhatsappYukle.tsx
│   ├── moderator-giris/page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── kullanicilar/
│   │   ├── sistem-ayarlari/
│   │   └── guvenlik/                   # Sprint 4 ✅
│   ├── cikis/
│   └── u/[username]/page.tsx           # is_shadow_banned = false filtresi
│
├── api/
│   ├── admin/
│   │   ├── kullanici/route.ts
│   │   └── guvenlik/route.ts           # Sprint 4 ✅
│   ├── auth/merge/ + switch-account/
│   ├── excel-import/route.ts           # contact_phone fix
│   ├── ilan/
│   │   ├── pasif/route.ts
│   │   └── duzelt/route.ts             # Sprint 5 ✅ re-scan + otomatik onay
│   ├── llm-parse/route.ts
│   ├── moderator/
│   │   ├── kullanici-askiya/route.ts
│   │   ├── arsiv/route.ts              # deprecated
│   │   └── toplu-islem/route.ts        # correction_needed action eklendi
│   └── whatsapp-parse/route.ts
│
├── lib/auth.ts + supabase.ts
├── supabase/functions/parse-listing/index.ts
├── proxy.ts
└── docs/
    ├── PROJE_HARITASI.md
    ├── YAPILACAKLAR.md
    ├── 20260505_shadow_ban.sql         # Sprint 1
    ├── 20260505_audit_engine.sql       # Sprint 2
    ├── 20260505_correction_needed.sql  # Sprint 5 — CHECK constraint güncelleme
    ├── Detaylı_Kullanıcı_Akışları.docx
    └── Yukegel_Güvenlik_V3.md
```

---

## 3. VERİTABANI ŞEMASI (public.*)

### `listings` — önemli alanlar
```
moderation_status: 'pending' | 'approved' | 'rejected' | 'auto_published' | 'archived' | 'correction_needed'
status: 'active' | 'passive' | 'completed' | 'expired'
user_id (nullable)
reviewed_at, is_repost, source_raw_post_id

-- Güvenlik kolonları (Sprint 1):
is_shadow_banned:    BOOLEAN DEFAULT false
audit_score:         INTEGER DEFAULT 0        -- 0–100
internal_audit_logs: JSONB                    -- { score, fired_rules[], scanned_at, source? }
```

### `users` — `role: 'user' | 'moderator' | 'admin'`, `is_active`, `user_type`, `phone_verified`
### `raw_posts` — `processing_status`, `clean_hash`, `message_date (date)`
### `aliases` — `type: 'city' | 'vehicle' | 'body' | 'blacklist'`
### `system_config`, `vehicles`

### Güvenlik tabloları
```sql
public.safety_rules (id, rule_type, pattern, risk_weight, description, is_active)
public.blacklist (id, identifier_type, identifier_value, reason, blocked_by, blocked_at)
```

---

## 4. MODERATÖr PANELİ

### Tab sistemi
| Tab | Filtre | Notlar |
|---|---|---|
| ⏳ Bekleyenler | `moderation_status = pending` | Varsayılan |
| ✅ Onaylananlar | `= approved` | |
| ❌ Reddedilenler | `= rejected` | |
| 💤 Pasifler | `= passive` | |
| 📋 Hepsi | `neq archived` | |
| 🔍 Çözümsüz | `raw_posts.processing_status = no_lane` | |
| 🗄️ Arşiv | `= archived` | |
| 🔴 Riskli | `audit_score > 30`, `neq archived` | audit_score'a göre desc sıralı |

### Toplu işlemler
```typescript
POST /api/moderator/toplu-islem
{ ids, action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive'
         | 'shadow_ban_kaldir' | 'shadow_ban' | 'correction_needed' }
// correction_needed → moderation_status:'correction_needed', status:'passive'
```

### Aksiyonlar özeti
- **✏️ Düzeltme İste** — `correction_needed` değilse ve arşivlenmiş/reddedilmiş değilse görünür (tekil + toplu yüzen bar)
- **👁 Shadow Ban Kaldır** — shadow banned olan kartlarda
- **👁 Shadow Banla** — approved + not-banned kartlarda
- **Kaydet ve Onayla** → `is_shadow_banned = false` de set eder

### Filtreler
- Omnisearch: tel/email → KullaniciKart + 🚫 Askıya Al + 🔍 İlanlarını Filtrele
- **Kaynak:** select (form/whatsapp/excel/facebook) — server-side
- **Kullanıcı:** omnisearch'ten seçim → `user_id` server-side filtresi
- Metin / tel / kalkış / varış / araç tipi: client-side
- **Tarih:** server-side

---

## 5. GÜVENLİK & DENETİM SİSTEMİ (Audit Engine V3)

### Puan → Aksiyon

| Puan | INSERT (trigger) | /api/ilan/duzelt (kullanıcı düzeltme) |
|---|---|---|
| 0–30 | Yayında | Otomatik `approved` + `active` |
| 31–70 | Sarı bayrak → mod kuyruğu | `pending` + `passive` (mod inceleyecek) |
| 71–100 | `is_shadow_banned = true` | `correction_needed` kalır |

### correction_needed akışı (Sprint 5)
1. Moderatör "✏️ Düzeltme İste" → `moderation_status = 'correction_needed'`, `status = 'passive'`
2. Kullanıcı panelde "⚠️ Düzeltme Gerekiyor" badge + "✏️ İlanı Düzelt" butonu görür
3. Hangi kuralların ihlal edildiği `internal_audit_logs.fired_rules`'dan gösterilir
4. Kullanıcı `notes`, `vehicle_type`, `body_type` düzenler → `/api/ilan/duzelt` POST
5. Route safety_rules'ı çekip JS'te re-scan yapar:
   - Score < 31 → `approved` + `active` + `is_shadow_banned = false` (otomatik yayın)
   - 31–70 → `pending` + `passive` (moderatöre geri)
   - ≥ 71 → `correction_needed` kalır, kullanıcıya kalan ihlaller gösterilir

### Sprint durumu
| Sprint | İş | Durum |
|---|---|---|
| 1 | Kolonlar + tablolar + public filtreler | ✅ |
| 2 | Audit Engine trigger | ✅ |
| 3 | Riskli tab + shadow ban kaldır/uygula | ✅ |
| 4 | Admin `/admin/guvenlik` paneli | ✅ |
| 5 | correction_needed + düzeltme akışı | ✅ |

---

## 6. WHATSAPP PARSE PIPELINE

```
ZIP/TXT yükle → raw_posts INSERT
→ DB trigger → parse-listing Edge Function → listings INSERT
→ audit_listing_on_insert trigger → audit_score + is_shadow_banned set
```

---

## 7. API ROUTES — ÖNEMLİLER

| Route | Metod | Açıklama |
|---|---|---|
| `/api/moderator/toplu-islem` | POST | Tüm bulk ops: approve/reject/passive/archive/unarchive/shadow_ban/correction_needed |
| `/api/moderator/kullanici-askiya` | POST | users.is_active = false |
| `/api/ilan/duzelt` | POST | Kullanıcı düzeltme + re-scan + otomatik onay |
| `/api/admin/guvenlik` | GET/POST/PATCH/DELETE | safety_rules + blacklist CRUD |
| `/api/excel-import` | POST | Excel toplu yükleme (contact_phone fetch içeriyor) |

---

## 8. LIB / AUTH / MIDDLEWARE

```typescript
getServerSupabase() / getServiceSupabase() / requireModerator() / landingForRole()
```
```
proxy.ts: PROFIL_KONTROLSUZ = ['/admin', '/moderator']
```

---

## 9. KURALLAR & TUZAKLAR

- **Shadow ban filtresi** = `.eq('is_shadow_banned', false)` — page.tsx ve u/[username]/page.tsx'te zorunlu.
- **ilan/[id] erişim:** `is_shadow_banned = true` → sahibi/mod/admin değilse `notFound()`
- **Audit trigger** sadece INSERT'te çalışır; re-scan için `/api/ilan/duzelt` kullanılır (JS'te manuel).
- **correction_needed CHECK constraint** → `docs/20260505_correction_needed.sql` çalıştırılmalı.
- **Moderatör toplu işlem = service role API** — RLS bypass.
- **`moderation_status: 'archived'`** CHECK constraint bypass için service role şart.
- Server action → ayrı dosyada `'use server'` zorunlu.
- `new URL(request.url).origin` kullan; `message_date` → `date` type.
- Vercel env → dashboard'dan; `.next` cache → `rm -rf .next` + restart.

---

## 10. KULLANICI AKIŞLARI (UX Referansı)

> Kaynak: `docs/Detaylı_Kullanıcı_Akışları.docx`

| Ekran | Rota | Durum |
|---|---|---|
| Landing | `/` | ⏳ |
| Kayıt akışı | `/kayit` | ⏳ |
| Giriş | `/giris` | ✅ |
| Panel | `/panel` | ✅ |
| İlan detay | `/ilan/[id]` | ✅ kısmi |
| İlan oluşturma (tekil 4 adım) | `/ilan-ver/tekil` | ⏳ |
| Toplu yükleme | `/ilan-ver` | ✅ kısmi |
| Atanan işlerim / durum | `/panel/is/[id]` | ⏳ |
| Puanlama | modal | ⏳ |
| Profil / Araçlarım | `/panel` tab | ✅ kısmi |

---

## 11. GÖREV DURUMU

### ✅ Tamamlanan
- Parse + alias öğrenme, auth tam akış, admin paneli
- Moderatör paneli v3 (omnisearch, bulk ops, akıllı butonlar, arşiv, tarih/kaynak/kullanıcı filtresi)
- WhatsApp parse, tekil ilan formu, Excel yükleme (contact_phone fix), "Sahiplen" akışı
- Panel (İlanlarım / Araçlarım / Profilim), Ana sayfa + filtreleme
- **Güvenlik Sprint 1–5:** shadow ban altyapısı, audit engine, riskli tab, admin güvenlik paneli, correction_needed akışı

### ⏳ Öncelikli (Faz 1 kalanlar)
1. E-posta kayıt → profil-tamamla (production test yok)
2. `/ilan-ver` → `user_type` yoksa yönlendirme
3. Kayıt akışı UI
4. Tekil ilan — 4 adımlı form
5. "Bu işi aldım" akışı (nakliyeci durum akışı)
6. Müşteri ilan detayı — plaka, modallar
7. Puanlama ekranları
8. Landing page, e-posta bildirimleri

### 🔮 Faz 2
Trust score, MERNİS/GİB, canlı konum, doğal dil arama, ödeme, bildirim kanalları

---

## 12. BİLİNEN BUGLAR

| # | Bug | Durum |
|---|---|---|
| 1 | WhatsApp iOS format | ✅ |
| 2 | `users!fk` join production | ✅ |
| 3 | Browser client toplu işlem RLS | ✅ |
| 4 | E-posta kayıt profil-tamamla | Açık |

---

## 13. NASIL KULLANILIR

```
"docs/PROJE_HARITASI.md dosyasını oku, sonra [görev]'i yapalım"
```
