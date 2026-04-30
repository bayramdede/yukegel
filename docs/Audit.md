# 📑 TEKNİK TASARIM DOKÜMANI: "GÖRÜNMEZ DENETÇİ" (THE INVISIBLE AUDITOR)

**Proje:** Paletli.com Güvenlik ve İtibar Yönetimi[cite: 10]
**Versiyon:** 1.0 (Nisan 2026)[cite: 10]
**Roller:** Backend Architect, UI/UX Specialist, Security Expert[cite: 10]

---

## 1. SİSTEM MİMARİSİ (BACKEND)

Sistem, kullanıcıyı ilan verme anında yormayan ancak yayındaki içeriği periyodik olarak süpüren bir **"Async Watchdog"** prensibiyle çalışır[cite: 4, 10].

### A. Veritabanı Şeması (Sadeleştirilmiş Mimari)
Tablo kalabalığını önlemek için mevcut `raw_posts` ve `ad_review_queue` ile entegre çalışan tek bir ana tablo eklenir[cite: 2, 4]:

*   **`firewall_rules`**: Yasaklı paternleri ve aksiyonları tutar[cite: 6].
    *   `pattern` (TEXT): Yasaklı kök (Örn: `uyusturucu`, `05[0-9]{8}`)[cite: 6].
    *   `type` (ENUM): `KEYWORD`, `PHONE`, `URL`, `IBAN`[cite: 6].
    *   `severity` (ENUM): `SILENT` (Sadece logla), `SHADOW` (Sessizce gizle), `BLOCK` (Kalıcı engelle)[cite: 4].
*   **`audit_logs`**: Denetçinin yakaladığı her ihlali tarihçesiyle saklar[cite: 3].
    *   `ad_id` (UUID), `user_id` (UUID), `violation_details` (JSONB), `detected_at` (TIMESTAMPTZ)[cite: 3, 4].

### B. "The Auditor" İşlem Akışı (Cron Logic)
Her saat başı (`0 * * * *`) tetiklenen API Route (`/api/cron/audit`) şu adımları izler[cite: 4, 10]:
1.  **Batch Processing**: Son 30 günün aktif ilanları binerli gruplar halinde çekilir[cite: 8].
2.  **Visual Normalization**: Her ilan açıklaması karakter hilelerinden (`nyn$turucn` ➔ `uyusturucu`) arındırılır[cite: 10, 5].
3.  **Pattern Matcher**: Temizlenen metin, `firewall_rules` tablosundaki paternlerle karşılaştırılır[cite: 6].
4.  **Shadow Action**: İhlal varsa; ilan sessizce `is_visible: false` ve `status: flagged` yapılır[cite: 2, 10]. Kullanıcı kendi panelinde ilanı hâlâ "Yayında" görür ancak ilan arama sonuçlarından düşer[cite: 4, 10].

---

## 2. UI/UX TASARIMI (CONTROL TOWER)

Adminin cerrah hassasiyetinde müdahale edebilmesi için tasarlanmıştır[cite: 10].

### A. Admin Güvenlik Paneli (`/admin/firewall`)
*   **Audit Dashboard**: Periyodik denetimin son raporunu gösteren özet kartlar (Örn: "Son taramada 12 ilan bypass girişimi nedeniyle gizlendi")[cite: 4, 10].
*   **Strike List**: 3 strike sınırına yaklaşan kullanıcıların listesi ve geçmiş ihlalleri[cite: 4, 10].
*   **On-Demand Scan**: Admin bir kuralı güncellediğinde, "Şimdi Tüm İlanları Tara" butonuyla süreci elle tetikleyebilir[cite: 10].

### B. Moderatör Deneyim Katmanı (`/moderator`)
*   **Flagged Ads**: Denetçinin yakaladığı ilanlar "🚩 Şüpheli" etiketiyle listelenir[cite: 3, 10].
*   **Smart Highlighting**: Mesajın içindeki ihlal noktası (örn: gizli telefon numarası veya yasaklı kelime) moderatöre fosforlu sarı renkte vurgulanarak gösterilir[cite: 3].

---

## 3. TEKNİK IMPLEMENTASYON (GÖRÜNMEZ GÖZ)

Yazılımcı için normalizasyon ve kontrol fonksiyonu:

```typescript
// lib/security.ts
/**
 * Görünmez Göz'ün kalbi: Normalizer fonksiyonu
 * Kullanıcının karakter oyunlarını bozarak saf kök kelimeyi bulur.
 */
export const normalizeForSentinel = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, (m) => ({'0':'o', '1':'i', '3':'e', '5':'s'}[m] || m)) // Görsel benzerlik[cite: 5]
    .replace(/\$/g, 's') // Özel karakter hilesi[cite: 5]
    .replace(/n/g, 'u') // u -> n manipülasyonu[cite: 10]
    .replace(/[^a-z]/g, '') // Kök kelimeyi bulmak için her şeyi temizle[cite: 5, 6]
    .trim();
};
```

---

## 4. AUDIT & LOGLAMA PRENSİPLERİ

1.  **Sessiz Operasyon**: Kullanıcı kurala takıldığında ona asla "Bloklandınız" detayı verilmez; "Teknik hata" veya "İnceleniyor" mesajları kullanılır[cite: 3].
2.  **Geriye Dönük İzi**: `audit_logs` tablosu, adminin geriye dönük "bu ilan neden silindi?" sorusuna anlık cevap verebilmesi için zorunludur[cite: 3].
3.  **Strike Management**: Her denetçi yakalaması kullanıcının itibar puanını düşürür; eşik değer aşılınca hesap otomatik bloke edilir[cite: 4, 10].