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


Eyvallah! **Super Developer**, **UI/UX Uzmanı** ve **AI Gurusu** kimliğimle, **Paletli.com**'un geleceğini inşa edecek bu teknik dokümanı, yazılımcının doğrudan rehber alabileceği profesyonel bir formatta derledim[cite: 10]. Bu sistem, operasyonel hızı artırırken platformun ciddiyetini ve güvenliğini "Görünmez Denetçi" ile koruma altına alır[cite: 2, 4, 10].

Aşağıdaki metni kopyalayıp bir `.md` veya `.doc` dosyası olarak kaydedebilirsin.

---

# 📑 TEKNİK TASARIM DOKÜMANI: "THE VOYAGE" (SEFER BAZLI SMART IMPORT)

**Proje:** Paletli.com İlan ve Güvenlik Altyapısı[cite: 10]
**Versiyon:** 1.0 (Nisan 2026)[cite: 10]
**Kapsam:** Excel ile Çoklu Duraklı İlan Yükleme, Görünmez Denetim (Audit) ve Blokaj Mimarisi[cite: 10]

---

## 1. VERİ MODELİ VE EXCEL ŞABLONU (THE STRUCTURE)

Sistem, "Sefer No" (Grup ID) üzerinden bir ilanın sınırsız sayıda durağa sahip olabileceği bir **Header-Detail** ilişkisi üzerine kuruludur[cite: 10].

### A. Beklenen Excel Şablonu
| Sefer No | Kalkış Şehri | Kalkış İlçe | Varış Şehri (Durak) | Varış İlçe | Telefon (Zorunlu) | Araç Tipi | Genel Notlar |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SN-001** | Diyarbakır | Bağlar | **Şanlıurfa** | Merkez | 05323009470 | 10 Teker | Süt toplama seferi.[cite: 10] |
| **SN-001** | | | **Afyon** | Dinar | 05323009470 | | (Aynı Sefer No: 2. Durak)[cite: 10] |
| **SN-001** | | | **İzmir** | Bornova | 05323009470 | | (Aynı Sefer No: 3. Durak)[cite: 10] |

### B. Veritabanı Eşleşmesi
*   **Listings Tablosu**: Sefer No'su aynı olan grubun ilk satırı "Header" olarak kaydedilir[cite: 10].
*   **Listing_Stops Tablosu**: Gruptaki her varış satırı, `stop_order` (1, 2, 3...) verilerek bu ilana bağlanır[cite: 10].

---

## 2. GÖRÜNMEZ MUHAFIZ (BACKEND LOGIC)

İlanlar sisteme girerken kullanıcıyı yormayan, arka planda çalışan "Sentinel" mekanizması devreye girer[cite: 4, 10].

### A. Visual Normalizer (De-obfuscation)
Kullanıcının karakter hilelerini (Örn: `nyn$turucn`) bozmak için metin şu fonksiyonla temizlenir[cite: 5, 10]:
*   **Karakter Eşleme**: `$ ➔ s`, `0 ➔ o`, `n ➔ u`, `3 ➔ e`[cite: 5, 10].
*   **Sıfırlama**: Özel karakterler ve rakamlar atılarak "saf" kök kelime (`uyusturucu`) elde edilir[cite: 5, 6].

### B. Audit & Strike Sistemi
*   **Periyodik Denetim**: Her saat başı (`Cron Job`), yayındaki ilanlar tekrar taranır[cite: 4, 10].
*   **Audit Log**: Yakalanan her ihlal (Telefon bypass, link, yasaklı kelime) `audit_logs` tablosuna `user_id` ve ihlal detayı ile kaydedilir[cite: 3, 6].
*   **Automatic Block**: Kullanıcının `strike_count` değeri 3'e ulaştığında hesap otomatikman `is_blocked = true` yapılır[cite: 4, 10].

---

## 3. UI/UX TASARIMI (THE FRONTEND)

### A. Excel Preview & Fix Screen
*   **Grouping**: Excel yüklendiğinde ilanlar "Sefer No" bazlı **Accordion Kartlar** olarak gruplanır[cite: 10].
*   **Inline Edit**: Hatalı şehirler veya telefonlar tablo üzerinde anında düzeltilebilir[cite: 10].
*   **Visual Cues**: Denetçinin (Sentinel) yakaladığı şüpheli satırlar kırmızı bayrakla (🚩) vurgulanır[cite: 3, 10].

### B. Shadow Ban Deneyimi
*   **Optimistic UI**: Bloklanan veya şüpheli ilanlar kullanıcıya "Yayında" gibi görünür ancak ana sayfa ve arama sonuçlarından `is_visible: false` filtresiyle sessizce düşürülür[cite: 2, 4, 10].

---

## 4. YAZILIMCI İÇİN IMPLEMENTASYON REHBERİ (SRS)

1.  **Frontend**: `xlsx` kütüphanesi ile Excel'i JSON'a çevir, `PreviewComponent` içinde Sefer No bazlı `Array.reduce` ile grupla[cite: 10].
2.  **Normalization**: `app/ilan-ver/actions.ts` içerisinde metni temizlemeden veritabanına sorgu atma[cite: 10].
3.  **Atomic Transaction**: `listings` ve `listing_stops` tablolarına kayıt atarken `db.transaction` kullan; veri tutarsızlığını engelle[cite: 10].
4.  **Audit API**: `/api/cron/audit` endpoint'ini kur ve `CRON_SECRET` ile güvenliğe al[cite: 10].

---

**Sonuç**: Bu doküman, **Paletli.com**'un her saat başı kendini temizleyen, kullanıcıyı darlamayan ama platform dışı kaçışlara (bypass) ve illegaliteye izin vermeyen zeki ekosisteminin anayasasıdır[cite: 2, 10].