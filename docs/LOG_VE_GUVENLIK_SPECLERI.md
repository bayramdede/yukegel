# Yükegel — Diagnostic & Güvenlik Log Specleri
> Son güncelleme: 12 Mayıs 2026

---

## 1. Güvenlik ve Denetim (Audit Trail) Logları

Platformun yasal uyumluluğunu ve kullanıcı veri güvenliğini korumak için zorunlu loglar.

### 1.1 Hassas Veri Erişimi (Phone Privacy)
Kullanıcının telefon numarasını kimin, ne zaman görüntülediğini izler.

```json
{
  "level": "INFO | WARN",
  "service": "yukegel-api",
  "context": "phone-privacy",
  "message": "Telefon numarası erişimi",
  "metadata": {
    "timestamp": "ISO-8601",
    "viewer_id": "uuid",
    "target_listing_id": "uuid",
    "profile_completed": true,
    "ip_address": "masked"
  }
}
```

**Kritik Kural:** `proxy.ts` üzerinden `profile_completed = false` iken bu veriye erişim denenirse log seviyesi **WARN** olmalı. `SecurityLogger` middleware seviyesinde tetiklenmeli.

---

### 1.2 Service Role Kullanımı (Admin / Moderatör)
`service_role` RLS'yi ezdiği için bu yetkiyle yapılan her toplu işlem izlenmeli.

```json
{
  "level": "INFO",
  "service": "yukegel-api",
  "context": "moderator-actions",
  "message": "Toplu işlem gerçekleştirildi",
  "metadata": {
    "admin_id": "uuid",
    "action": "bulk_approve | bulk_reject | shadow_ban | archive",
    "affected_ids": ["uuid", "..."],
    "reason": "string"
  }
}
```

**İlgili Route:** `/api/moderator/toplu-islem`

---

### 1.3 Blacklist ve Shadow Ban Tetikleyicileri
Sistemin kimi neden engellediğini ve false positive engellemeleri izler.

```json
{
  "level": "WARN",
  "service": "yukegel-api",
  "context": "audit-engine",
  "message": "Shadow ban tetiklendi",
  "metadata": {
    "user_id": "uuid",
    "listing_id": "uuid",
    "trigger_text": "string (kısaltılmış, max 100 karakter)",
    "rule_id": "HEAVY_PROFANITY | PHONE_LEAK | ...",
    "audit_score": 75,
    "action": "shadow_ban | archived"
  }
}
```

---

## 2. Tanılama (Diagnostic) ve Sistem Sağlığı Logları

### 2.1 LLM Parsing & Processing Logları
`substring of undefined` gibi hataların tekrarlanmaması için.

```json
{
  "level": "ERROR | INFO",
  "service": "yukegel-api",
  "context": "llm-parser",
  "message": "LLM parse tamamlandı | PRE-CHECK FAILED | Parse hatası",
  "metadata": {
    "trace_id": "uuid",
    "user_id": "uuid",
    "input_length": 342,
    "output_status": "success | error | pre_check_failed",
    "error_message": "string | null",
    "raw_text_preview": "ilk 80 karakter..."
  }
}
```

**Kritik Kural:** LLM'e giden `raw_text` değeri `null` veya boş ise işlem başlamadan `output_status: "pre_check_failed"` logu düşülmeli, Haiku'ya istek yapılmamalı.

**İlgili dosya:** `supabase/functions/parse-listing/index.ts`, `/api/parse-text`

---

### 2.2 Atomik İşlem (Transaction) Logları
`listings` + `listing_stops` yazımında kısmi başarı senaryosunu izler.

```json
{
  "level": "ERROR | INFO",
  "service": "yukegel-api",
  "context": "db-transaction",
  "message": "Transaction commit | rollback",
  "metadata": {
    "transaction_id": "uuid",
    "status": "commit | rollback",
    "listing_id": "uuid | null",
    "error_at_stop_order": 2,
    "error_message": "string | null"
  }
}
```

---

### 2.3 Excel Upload & Veri Validasyonu
Hatalı Excel formatlarını ve `split(',')` hatalarını yakalar.

```json
{
  "level": "WARN | ERROR",
  "service": "yukegel-api",
  "context": "excel-import",
  "message": "Excel yükleme tamamlandı | Validasyon hatası",
  "metadata": {
    "user_id": "uuid",
    "filename": "ilanlar.xlsx",
    "row_count": 45,
    "validation_errors": [
      { "row": 7, "field": "phone", "reason": "format hatası" }
    ],
    "processing_time_ms": 1230
  }
}
```

**İlgili Route:** `/api/excel-import`

---

### 2.4 Per-User AI Kota Aşımı
Günlük AI ilan limitini dolduran kullanıcıları izler.

```json
{
  "level": "WARN",
  "service": "yukegel-api",
  "context": "llm-quota",
  "message": "Günlük AI ilan kotası aşıldı — 429 döndürüldü",
  "metadata": {
    "user_id": "uuid",
    "quota_limit": 5,
    "used_today": 5,
    "ip_address": "masked"
  }
}
```

---

### 2.5 RLS Permission Denied (42501)
Hangi RLS kuralının takıldığını frontend'den yakalar.

```json
{
  "level": "WARN",
  "service": "yukegel-api",
  "context": "rls-monitor",
  "message": "RLS 42501 — Permission Denied",
  "metadata": {
    "user_id": "uuid | anonim",
    "route": "/api/...",
    "table": "listings | users | ...",
    "operation": "SELECT | INSERT | UPDATE | DELETE",
    "supabase_error_code": "42501"
  }
}
```

---

## 3. Standart Log Format (JSON Mode)

Tüm loglar Vercel Logs / Supabase Edge Function Logs'ta kolayca taranabilmesi için JSON:

```json
{
  "level": "ERROR | WARN | INFO",
  "service": "yukegel-api",
  "context": "moderator-actions | auth | llm-parser | audit-engine | excel-import | db-transaction | phone-privacy | llm-quota | rls-monitor",
  "message": "Kısa açıklama",
  "metadata": { ... },
  "timestamp": "2026-05-12T11:08:00Z"
}
```

---

## 4. Yazılımcı Kontrol Listesi

| # | Görev | Dosya | Durum |
|---|---|---|---|
| 1 | `proxy.ts` → `SecurityLogger` ekle (yetkisiz phone erişim) | `proxy.ts` | ✅ 12 May 2026 |
| 2 | `app/ilan/[id]` tüm `raw_text` işlemlerini `try-catch` içine al + teknik detayı logla | `app/ilan/[id]/page.tsx`, route | ⚠️ `raw_text` bu dosyada henüz yok; Faz 2 "Bu işi aldım" geliştirilince ekle |
| 3 | `42501` hatalarını frontend'de yakalayıp "hangi RLS takıldı" bilgisini logla | `lib/logger.ts` → `logRlsError()` | ✅ 12 May 2026 — `excel-import` entegre; diğer route'larda `logRlsError()` çağrılabilir |
| 4 | `data-ai-label` okunma sıklığını user-agent analizi ile izle (bot trafik) | middleware / Vercel Analytics | ⏳ Altyapı gerektiriyor, Faz 2'de |
| 5 | LLM'e `null` veri giderse `pre_check_failed` logu düşüp erken çık | `supabase/functions/parse-listing/index.ts` | ✅ 12 May 2026 |
| 6 | Excel import satır bazlı validasyon hatalarını logla | `/api/excel-import` | ✅ 12 May 2026 |

---

## 5. Gizlilik & Maskeleme Kuralları

> **Asla ham formda loglama yapılmayacak veriler:**

| Veri | Maskeleme Örneği |
|---|---|
| Telefon numarası | `0532***1234` |
| TCKN | `123****789*` |
| VKN | `123****89*` |
| IP adresi | `192.168.*.*` |
| Şifre | — (hiçbir zaman loglanmaz) |
| Kredi kartı | — (hiçbir zaman loglanmaz) |

KVKK kapsamında "açık rıza" gerektiren ham özel veriler hiçbir log kaydında bulunmamalıdır.
