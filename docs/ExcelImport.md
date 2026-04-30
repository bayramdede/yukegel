# 📑 TEKNİK TASARIM DOKÜMANI: "THE VOYAGE" (SEFER BAZLI EXCEL İMPORT)

**Hedef:** Operatörlerin Excel üzerinden sınırsız duraklı ilanları "Sefer No" (Grup ID) ile gruplandırarak, hatasız ve denetlenmiş bir şekilde sisteme aktarması[cite: 10].

---

## 1. BACKEND VE VERİ TABANI MİMARİSİ (THE ENGINE)

Sistem, gelen her satırı bağımsız bir veri gibi değil, bir **Sefer Grubu** parçası olarak işler[cite: 10].

### A. "Sefer No" Algoritması (Group-By Logic)
*   **Unique Grouping:** Yazılımcı Excel'i yukarıdan aşağıya okurken `Sefer No` sütununu anahtar (`Key`) olarak kullanır[cite: 10].
*   **Header & Detail İlişkisi:**
    *   Aynı `Sefer No`'ya sahip ilk satır, `listings` tablosuna ana kayıt (Header) olarak yazılır[cite: 10].
    *   Gruptaki her satır (ilk satır dahil), `listing_stops` tablosuna `stop_order` (1, 2, 3...) verilerek "Durak" olarak kaydedilir[cite: 10].
*   **Atomic Transactions:** Bir Sefer No'ya ait tüm duraklar başarıyla işlenmeden veritabanına hiçbir kayıt atılmaz (All-or-Nothing)[cite: 10].

### B. "Invisible Sentinel" (Görünmez Denetçi) Filtresi
*   **Normalizer:** İlanın `Genel Notlar` kısmı kaydedilmeden önce `normalizeForSentinel` fonksiyonundan geçirilerek karakter hileleri (`nyn$turucn` ➔ `uyusturucu`) temizlenir[cite: 10, 5].
*   **Bypass Detection:** `Telefon` sütunu otomatik olarak `5XXXXXXXXX` formatına çekilir ve blacklist'teki numaralarla karşılaştırılır[cite: 6].
*   **Audit Logging:** Her yükleme işlemi `audit_logs` tablosuna; kimin, hangi Sefer No ile, kaç durak yüklediği bilgisiyle kaydedilir[cite: 3, 4].

---

## 2. UI/UX TASARIMI (THE PREVIEW INTERFACE)

Operatör Excel'i yüklediğinde, veriler doğrudan DB'ye gitmez; önce **"Preview & Fix"** ekranına düşer[cite: 10].

### A. Accordion-Style Sefer Kartları
*   **Grup Görünümü:** Her Sefer No, daraltılabilir (accordion) bir kart olarak sunulur[cite: 10].
    *   *Kart Başlığı:* `SN-001 | Diyarbakır ➔ İzmir | 3 Durak | 10 Teker`[cite: 10].
*   **Detay Görünümü:** Kart açıldığında duraklar dikey bir akış şeması (Timeline) olarak listelenir[cite: 10]. Operatör duraklardaki şehirleri veya notları tek tıkla (inline edit) düzeltebilir[cite: 10].

### B. Akıllı Uyarılar ve Görsel İpucu
*   **🚩 Risk Bayrağı:** Eğer bir durak veya not kural ihlaline takılmışsa, o kartın kenarı kırmızı yanar ve adminin önüne "İletişim Bypass Girişimi" uyarısı çıkar[cite: 3, 6, 10].
*   **Sarı Uyarı:** Şehir ismi veritabanıyla %100 eşleşmiyorsa (Örn: "Diyarbakr"), sistem en yakın şehri önerir ve onay ister[cite: 5].

---

## 3. YAZILIMCI İÇİN IMPLEMENTASYON NOTLARI (SRS)

1.  **Frontend (React):** `xlsx` veya `exceljs` kütüphanesini kullanarak Excel'i JSON'a çevir[cite: 10]. Veriyi önce `PreviewTable` komponentinde kullanıcıya göster[cite: 10].
2.  **Validation:** `contact_phone` zorunlu alandır; eksikse ilanı yayına almaz, operatöre hata gösterir[cite: 10].
3.  **Backend (Supabase/Node):** `listings` ve `listing_stops` kayıtlarını bir `db.transaction` bloğu içinde çalıştır[cite: 10]. `is_visible` değerini, denetimden geçene kadar `false` tut (Shadow Ban mantığı)[cite: 4, 10].

---

**Sonuç:** Bu mimari, kullanıcıya "sınırsız durak" özgürlüğü verirken, yöneticiye tam denetim ve temiz veri sağlar[cite: 2, 10].