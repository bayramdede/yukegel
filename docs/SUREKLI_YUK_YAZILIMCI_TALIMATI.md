# Sürekli Yük (Evergreen İlan) — Yazılımcı Talimatı

**Amaç:** Pazaryeri hiç boş kalmasın. Manuel ilan akışına bağımlı kalmadan, gerçek ve her gün tekrar eden yükleri "Sürekli Yük" olarak işaretleyip her sabah taze görünecek şekilde döngüye almak. **Sahte/sentetik ilan yok** — gösterilen her ilan gerçekten çağrılabilir bir yüktür.

**Karar özeti (kilitli):**
- Tekrar deseni: **her gün** (v1'de gün deseni yok).
- Kim işaretler: **ilan veren** (oluşturma + İlanlarım düzenleme formu).
- Şeffaflık: feed'de **"Sürekli Yük" rozeti**. (Ayrı bölüm/filtre yok, şimdilik.)
- Kişi başı en fazla **3** aktif sürekli yük (parametre — ileride premium'da artırılabilir).
- Bitiş tarihine tavan: en fazla **1 yıl** ileri (parametre).
- Yeniden onay: **7 günde bir**, İlanlarım'da bağlamsal uyarı şeridiyle (genel bildirim sistemi YOK; SMS/e-posta YOK). Onay gelmezse **3 gün** grace sonrası ilan pasife düşer.
- Moderatöre **ayrı ekran**: tüm sürekli yükleri listeler, sonlandırabilir.
- "Bu işi aldım": sürekli yükte **yeni anlaşma** oluşturur ama ilan **pasife DÜŞMEZ**.
- Güvenlik ağı (arşivden doldurma) **YOK** — sadece sürekli yük mekanizması.

---

## 1) Veri modeli değişiklikleri

### 1.1 `listings` tablosuna eklenecek kolonlar
- `is_recurring boolean NOT NULL DEFAULT false`
- `recurring_until date NULL` — sürekli yükün bitiş tarihi
- `recurring_confirmed_at timestamptz NULL` — son "hâlâ var mı" onayı; ilk işaretlemede `now()`

### 1.2 `deals` tablosuna eklenecek kolonlar (KRİTİK — mevcut kısıtlar sürekli yükte patlar)
Mevcut durumda `deals` üzerinde **ilan başına tek anlaşma** kuran üç kısmi unique index var:
- `deals_tek_aktif_anlasma` → `UNIQUE(listing_id) WHERE status IN ('matched','in_transit','completed')`
- `deals_tekil` → `UNIQUE(listing_id, carrier_id) WHERE carrier_id IS NOT NULL AND status <> 'cancelled'`
- `deals_harici_tekil` → `UNIQUE(listing_id) WHERE carrier_id IS NULL AND status <> 'cancelled'`

Sürekli yük her gün (ve bazen aynı nakliyeciyle tekrar) claim edileceğinden bu üç kısıt ihlal olur. Çözüm: recurring anlaşmaları bu kısıtlardan **muaf** tut, bunun yerine **güne göre** tekilleştir.

Eklenecek kolonlar:
- `is_recurring_deal boolean NOT NULL DEFAULT false` — claim anında ilan sürekli yükse `true`
- `deal_date date NULL` — sürekli anlaşmanın ait olduğu gün (claim anında `current_date`)

---

## 2) Migration SQL (`docs/20260820_surekli_yuk.sql`)

> Supabase SQL Editor'da manuel çalıştır. Convention gereği tarih-önekli, tek dosya.

```sql
-- 1) listings kolonları
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_recurring          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_until       date,
  ADD COLUMN IF NOT EXISTS recurring_confirmed_at timestamptz;

-- Sürekli yükleri hızlı bulmak için kısmi index
CREATE INDEX IF NOT EXISTS listings_recurring_idx
  ON public.listings (recurring_until)
  WHERE is_recurring = true;

-- 2) deals kolonları
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_recurring_deal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_date         date;

-- 3) Mevcut "tek anlaşma" kısıtlarını recurring anlaşmaları HARİÇ tutacak şekilde yeniden kur
DROP INDEX IF EXISTS public.deals_tek_aktif_anlasma;
CREATE UNIQUE INDEX deals_tek_aktif_anlasma
  ON public.deals (listing_id)
  WHERE status IN ('matched','in_transit','completed') AND is_recurring_deal = false;

DROP INDEX IF EXISTS public.deals_tekil;
CREATE UNIQUE INDEX deals_tekil
  ON public.deals (listing_id, carrier_id)
  WHERE carrier_id IS NOT NULL AND status <> 'cancelled' AND is_recurring_deal = false;

DROP INDEX IF EXISTS public.deals_harici_tekil;
CREATE UNIQUE INDEX deals_harici_tekil
  ON public.deals (listing_id)
  WHERE carrier_id IS NULL AND status <> 'cancelled' AND is_recurring_deal = false;

-- 4) Sürekli yükte güne göre tekilleştirme (aynı gün aynı nakliyeci iki kez almasın)
CREATE UNIQUE INDEX IF NOT EXISTS deals_recurring_gun_tekil
  ON public.deals (listing_id, carrier_id, deal_date)
  WHERE is_recurring_deal = true AND carrier_id IS NOT NULL AND status <> 'cancelled';

-- 5) Parametreler (system_config) — tablo anahtar/değer ise buna göre uyarla
INSERT INTO public.system_config (key, value) VALUES
  ('max_recurring_per_user',        '3'),
  ('recurring_max_days',            '365'),
  ('recurring_reconfirm_days',      '7'),
  ('recurring_reconfirm_grace_days','3')
ON CONFLICT (key) DO NOTHING;
```

> **Yazılımcı notu:** `system_config` şeması farklıysa (örn. tek satır JSON) INSERT'i ona göre değiştir. Anahtar isimleri sabit kalsın.

---

## 3) Cron değişiklikleri (pg_cron)

### 3.1 Mevcut `expire-active-listings` cron'unu güncelle (sürekli yükü öldürmesin)
```sql
UPDATE public.listings
SET status = 'passive', updated_at = now()
WHERE status = 'active'
  AND expires_at < now()
  AND is_recurring = false;   -- <-- eklenen satır
```

### 3.2 Yeni gecelik cron: `recurring-refresh` (her gece 00:05 önerilir)
Aktif sürekli yükleri tazeler, biteni kapatır, onay/grace mantığını yürütür.
```sql
-- a) Süresi dolan sürekli yükleri kapat
UPDATE public.listings
SET is_recurring = false, status = 'passive', updated_at = now()
WHERE is_recurring = true
  AND recurring_until IS NOT NULL
  AND recurring_until < current_date;

-- b) Onay süresi + grace geçmişse pasife düşür (is_recurring korunur; onaylayınca geri açılır)
UPDATE public.listings
SET status = 'passive', updated_at = now()
WHERE is_recurring = true
  AND status = 'active'
  AND recurring_confirmed_at
      < now() - ((SELECT value::int FROM public.system_config WHERE key='recurring_reconfirm_days')
               + (SELECT value::int FROM public.system_config WHERE key='recurring_reconfirm_grace_days')) * interval '1 day';

-- c) Hâlâ geçerli olan aktif sürekli yükleri "bugün" için tazele
UPDATE public.listings
SET available_date = current_date,
    expires_at     = (current_date + interval '1 day') - interval '1 second',  -- bugün 23:59:59
    updated_at     = now()
WHERE is_recurring = true
  AND status = 'active'
  AND (recurring_until IS NULL OR recurring_until >= current_date);
```

> **Sıralama bağımlılığı (feed):** Tazeleme `updated_at` ve `available_date`'i öne çeker. Feed'in bunları dikkate alacak şekilde sıralaması gerekir. Feed sorgusu `created_at`'e göre sıralıyorsa sürekli yükler dibe batar → sıralamayı `updated_at DESC` (veya `available_date` + `updated_at`) içerecek şekilde ayarla. **Yazılımcı, feed sorgusunu kaynaktan doğrulayıp sıralama anahtarını buna göre düzenlesin.** Beklenen davranış: her sabah sürekli yükler "bugün" tarihiyle ve taze `updated_at` ile listenin üstlerinde görünür.

---

## 4) Backend / API

### 4.1 İlan oluştur & düzenle
- Form payload'ına: `is_recurring` (bool), `recurring_until` (date) eklenir.
- Sunucu doğrulamaları:
  - `is_recurring=true` ise `recurring_until` zorunlu, **gelecekte** ve `<= today + recurring_max_days`.
  - Kişi başı aktif sürekli yük sayısı `max_recurring_per_user`'ı aşamaz (aynı `user_id`/`shadow_profile_id`). Aşarsa 4xx + anlaşılır mesaj.
  - İşaretleme anında `recurring_confirmed_at = now()`.
- Düzenlemede sürekli yükü **kapatma** (`is_recurring=false`) desteklenir → ilan normal expire akışına döner.

### 4.2 "Bu işi aldım" / claim handler (recurring branch)
Mevcut claim akışı ilanı `passive` yapıyor (uygulama kodunda; `deals` üzerinde trigger yok). Sürekli yük için dallandır:
- İlan `is_recurring=true` ise:
  - Yeni `deals` satırı: `is_recurring_deal=true`, `deal_date=current_date`, `carrier_id`, `shipper_id`, `status='matched'` (mevcut normal akıştaki başlangıç statüsüyle aynı olsun).
  - **`listings.status` DEĞİŞTİRİLMEZ** (ilan aktif kalır, ertesi gün cron yine tazeler).
  - Aynı gün aynı nakliyeci ikinci kez alırsa `deals_recurring_gun_tekil` engeller → kullanıcıya "bugün bu yükü zaten aldınız" mesajı.
- İlan sürekli değilse: mevcut davranış aynen (tek anlaşma + ilan passive).

### 4.3 Yeniden onay endpoint'i (küçük, bağımsız)
- `POST /api/listings/:id/surekli-onay` → sadece ilan sahibi; `recurring_confirmed_at = now()`.
- "Durdur" aksiyonu: `is_recurring=false` (+ istenirse `status='passive'`).
- Bu endpoint bilinçli olarak bağımsız tutulsun; ileride genel bildirim sistemi gelince aynı endpoint'e bağlanır.

---

## 5) Frontend

### 5.1 İlan formu (oluşturma **ve** İlanlarım düzenleme — aynı bileşen)
- "Bu her gün tekrarlayan bir yük (Sürekli Yük)" checkbox'ı.
- İşaretlenince: bitiş tarihi seçici (bugünden sonra, max 1 yıl).
- Açıklama metni: "İlanınız her gün otomatik yenilenir ve listede kalır. Dilediğiniz zaman durdurabilirsiniz."
- Düzenleme ekranında mevcut değerler dolu gelir; sürekli yükü kapatma/tarih değiştirme mümkün. **İlanlarım düzenlemede bu alanı unutma.**

### 5.2 Feed
- Sürekli yük kartında **"Sürekli Yük" rozeti**.

### 5.3 İlanlarım — bağlamsal onay şeridi
- `is_recurring=true` ve `recurring_confirmed_at < now() - recurring_reconfirm_days` olan ilanın kartında üstte şerit:
  - "Bu yük hâlâ her gün var mı?" → **[Evet, devam]** (onay endpoint'i) / **[Durdur]**.
- Grace geçip pasife düştüyse: "Sürekli yükünüz onay verilmediği için durduruldu — devam etmek için onaylayın" + tekrar aktifleştirme.

### 5.4 Moderatör — ayrı "Sürekli Yükler" ekranı
Yeni sayfa (örn. `/admin/surekli-yukler` veya moderatör paneli altında sekme). Liste kolonları:
- Hat: kalkış → varış (il/ilçe)
- İlan veren + telefon
- Başlangıç (created_at) / Bitiş (`recurring_until`)
- Son yenilenme (`updated_at`) / Son onay (`recurring_confirmed_at`)
- Günlük temas/anlaşma sayısı (o ilana ait `deals`, `deal_date=current_date`)
- Durum (aktif / onay bekliyor / pasif)

Aksiyonlar:
- **Sonlandır** (`is_recurring=false` + `status='passive'`)
- Bitiş tarihini düzenle
- Duraklat / tekrar aktifleştir

> Moderatör işlemleri mevcut kural gereği **service-role API route** üzerinden yapılmalı (tarayıcı client'ı değil).

---

## 6) Kabul kriterleri / test senaryoları

1. İlan veren sürekli yük + bitiş tarihi ile ilan açar → moderasyon onayından sonra feed'de rozetle ve üst sıralarda görünür.
2. Ertesi sabah (cron sonrası) ilan `available_date=bugün`, taze `updated_at` ile hâlâ üstlerde.
3. `expire-active-listings` çalışsa bile sürekli yük pasife düşmez.
4. Aynı sürekli yükü Pazartesi Nakliyeci A, Salı Nakliyeci A yine alır → iki ayrı `deals` satırı, ilan hep aktif, kısıt ihlali yok.
5. Aynı gün aynı nakliyeci ikinci kez alamaz (uyarı alır).
6. Kişi başı 4. sürekli yükü açmaya çalışınca engellenir.
7. Bitiş tarihi 1 yıldan uzağa konamaz.
8. 7 gün onaylanmayan sürekli yükte İlanlarım'da onay şeridi çıkar; 7+3 günde onay yoksa pasife düşer; onaylayınca geri açılır.
9. Moderatör ayrı ekrandan bir sürekli yükü sonlandırır → feed'den düşer.
10. Normal (sürekli olmayan) ilanların claim/expire davranışı hiç değişmez (regresyon yok).

---

## 7) Yazılımcının kaynaktan doğrulayıp bağlayacağı noktalar
- **Feed sıralama sorgusu:** `updated_at`/`available_date`'i dikkate alacak şekilde ayarla (bkz. 3.2 notu).
- **Claim handler dosyası:** ilanı passive yapan mevcut kodu bul, `is_recurring` dalını ekle (bkz. 4.2).
- **`system_config` şeması:** parametre INSERT'ini gerçek şemaya uyarla (bkz. 2).
- **İlan formu bileşeni:** oluşturma ve İlanlarım düzenleme aynı formu kullanıyorsa tek yerde değişiklik yeterli.

---

## 8) Deploy sırası
1. `docs/20260820_surekli_yuk.sql` → Supabase SQL Editor'da çalıştır.
2. `expire-active-listings` cron'unu güncelle + `recurring-refresh` cron'unu ekle (pg_cron).
3. Backend (form validasyon, claim branch, onay endpoint) → deploy.
4. Frontend (form alanı, rozet, İlanlarım şeridi, moderatör ekranı) → deploy.
5. `docs/PROJE_HARITASI.md`'yi güncelle.
