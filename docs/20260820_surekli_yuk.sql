-- ============================================================
-- Sürekli Yük (Evergreen İlan) — v1
-- Tarih: 20 Ağustos 2026
-- Kaynak: docs/SUREKLI_YUK_YAZILIMCI_TALIMATI.md
-- Supabase SQL Editor'da MANUEL çalıştır (bu proje convention'ı — bkz.
-- app/api/ilan/duzelt gibi diğer 2026 migration dosyaları). Kod bu kolonların
-- VAR OLDUĞUNU varsayıyor; bu dosya deploy'dan ÖNCE çalışmalı.
-- ============================================================

-- ── 1) listings kolonları ────────────────────────────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_recurring           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_until        date,
  ADD COLUMN IF NOT EXISTS recurring_confirmed_at timestamptz;

-- Sürekli yükleri hızlı bulmak için kısmi index (moderatör ekranı + cron).
CREATE INDEX IF NOT EXISTS listings_recurring_idx
  ON public.listings (recurring_until)
  WHERE is_recurring = true;

-- 🚨 SPRINT_01 L1e dersi (kaynaktan doğrulandı, `docs/20260728_contact_phone_revoke.sql`):
-- o migration `listings` üzerindeki TABLO-GENELİ SELECT/INSERT/UPDATE'i REVOKE
-- edip yerine `contact_phone` HARİÇ o ANKİ kolonların tek tek (column-level)
-- GRANT'ini koydu. Column-level GRANT yeni kolonlara OTOMATİK YAYILMAZ — bu
-- üç kolon GRANT'siz doğdu (`docs/PROJE_HARITASI.md` §3 listings notu: "Yeni
-- iki kolona GRANT elle verildi" — origin_province_id/district_official ile
-- AYNI ders). `is_recurring` `ILAN_SELECT`'te (`lib/ilan-liste.ts`) ve
-- `HomeClient.tsx`'in anon-key istemci sorgusunda okunuyor — GRANT'siz
-- kalırsa yalnız SSR (service-role) çalışır, "Tekrar dene"/istemci yenilemesi
-- `42501 permission denied for column is_recurring` ile SESSİZCE kırılır
-- (hata `catch{}`e düşer, kullanıcı boş liste görür). Üçünü de `anon` +
-- `authenticated`e SELECT veriyoruz — hiçbiri `contact_phone` gibi hassas
-- değil (rozet + moderatör ekranı + kullanıcının kendi düzenleme formu).
-- Yazma yolu YOK: is_recurring/recurring_until/recurring_confirmed_at'a
-- yazan her uç nokta (`lib/ilan-yaz.ts`, `/api/ilan/duzelt`,
-- `/api/listings/[id]/surekli-onay`, `/api/admin/surekli-yukler/[id]`)
-- service-role kullanıyor; UPDATE GRANT'i bilerek verilmedi.
GRANT SELECT (is_recurring, recurring_until, recurring_confirmed_at) ON public.listings TO anon;
GRANT SELECT (is_recurring, recurring_until, recurring_confirmed_at) ON public.listings TO authenticated;

-- ── 2) deals kolonları (KRİTİK — sürekli yük her gün yeniden claim edilir) ──
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_recurring_deal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_date         date;

-- ── 3) Mevcut "tek anlaşma" kısıtlarını recurring anlaşmalar HARİÇ olacak
--       şekilde yeniden kur. Üçü de bugün canlıda var (bkz.
--       app/api/deals/route.ts ve app/api/deals/[id]/route.ts yorumları).
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

-- ── 4) Sürekli yükte GÜNE göre tekilleştirme ────────────────────────────
-- Nakliyeci kolu (carrier_id dolu — normal "talep et/onayla" akışı).
CREATE UNIQUE INDEX IF NOT EXISTS deals_recurring_gun_tekil
  ON public.deals (listing_id, carrier_id, deal_date)
  WHERE is_recurring_deal = true AND carrier_id IS NOT NULL AND status <> 'cancelled';

-- Harici (sistem dışı) kol — ilan sahibi "Plaka Ata" ile günlük seferi kendi
-- giriyor (carrier_id NULL). Yazılımcı notu (§7): talimatta açıkça geçmiyor
-- ama deals_harici_tekil zaten is_recurring_deal=false'a daraltıldığı için
-- recurring+harici tarafında GÜNE göre eşdeğer bir tekillik olmazsa aynı gün
-- sınırsız harici sefer kaydı açılabilir. Simetri için ekleniyor.
CREATE UNIQUE INDEX IF NOT EXISTS deals_recurring_harici_gun_tekil
  ON public.deals (listing_id, deal_date)
  WHERE is_recurring_deal = true AND carrier_id IS NULL AND status <> 'cancelled';

-- ── 5) Parametreler (system_config) ─────────────────────────────────────
-- ⚠️ Talimattaki taslak (key,value) BU PROJENİN GERÇEK ŞEMASIYLA UYUŞMUYORDU —
-- kaynaktan doğrulandı (`information_schema.columns`, 20 Ağu 2026): gerçek
-- şema `category, key, value(JSONB!), data_type, description`, PK yalnız
-- `key` (`category`+`key` değil). `value` JSONB olduğu için literal sayılar
-- `::jsonb` ile YAZILMALI (bkz. docs/20260508_audit_thresholds_and_ai_quota.sql
-- aynı desen) — düz `'3'` yazmak "column is of type jsonb but expression is
-- of type text" ile patlar. `data_type` sütununun kendi değeri de projenin
-- var olan sözlüğüyle aynı tutuldu (`'integer'`, `'number'` DEĞİL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'max_recurring_per_user') THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES ('surekli_yuk', 'max_recurring_per_user', '3'::jsonb, 'integer',
      'Kullanıcı başına en fazla aktif Sürekli Yük ilanı');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'recurring_max_days') THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES ('surekli_yuk', 'recurring_max_days', '365'::jsonb, 'integer',
      'Sürekli Yük bitiş tarihi tavanı (bugünden itibaren gün)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'recurring_reconfirm_days') THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES ('surekli_yuk', 'recurring_reconfirm_days', '7'::jsonb, 'integer',
      'Kaç günde bir "hâlâ var mı?" onayı istenir');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'recurring_reconfirm_grace_days') THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES ('surekli_yuk', 'recurring_reconfirm_grace_days', '3'::jsonb, 'integer',
      'Onay gelmezse ilan pasife düşmeden önceki ek süre (gün)');
  END IF;
END $$;

-- ============================================================
-- CRON DEĞİŞİKLİKLERİ (pg_cron)
-- ============================================================

-- ── 6) Mevcut expire-active-listings — sürekli yükü öldürmesin ──────────
-- Kaynak: docs/20260519_expire_48h_and_cron.sql. Aynı jobname'i yeniden
-- schedule etmek eskisinin yerine geçer (pg_cron upsert davranışı).
SELECT cron.unschedule('expire-active-listings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-active-listings');

SELECT cron.schedule(
  'expire-active-listings',
  '*/15 * * * *',
  $$
    UPDATE public.listings
    SET
      status     = 'passive',
      updated_at = now()
    WHERE
      status = 'active'
      AND expires_at < now()
      AND is_recurring = false;   -- <-- sürekli yükü muaf tutan tek satır
  $$
);

-- ── 7) Yeni gecelik cron: recurring-refresh (her gece 00:05) ────────────
-- Sıra ÖNEMLİ: önce süresi dolanları kapat, sonra onay/grace'i işle, en son
-- HÂLÂ aktif olanları bugüne tazele — aksi hâlde az önce kapanmış bir ilan
-- yanlışlıkla "bugün"e tazelenebilir.
SELECT cron.unschedule('recurring-refresh')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recurring-refresh');

SELECT cron.schedule(
  'recurring-refresh',
  '5 0 * * *',
  $$
    -- a) Süresi dolan sürekli yükleri kapat
    UPDATE public.listings
    SET is_recurring = false, status = 'passive', updated_at = now()
    WHERE is_recurring = true
      AND recurring_until IS NOT NULL
      AND recurring_until < current_date;

    -- b) Onay süresi + grace geçmişse pasife düşür (is_recurring KORUNUR;
    --    ilan sahibi onaylayınca İlanlarım'daki şeritten geri açılır).
    UPDATE public.listings
    SET status = 'passive', updated_at = now()
    WHERE is_recurring = true
      AND status = 'active'
      AND recurring_confirmed_at
          < now() - (
              -- `value` JSONB — `value::int` DEĞİL (jsonb→int doğrudan cast yok,
              -- `22P02`/`42846` ile patlar). `audit_listing_fn()` ile AYNI desen:
              -- önce `::text`, sonra `::int`.
              (SELECT (value::text)::int FROM public.system_config WHERE key = 'recurring_reconfirm_days')
              + (SELECT (value::text)::int FROM public.system_config WHERE key = 'recurring_reconfirm_grace_days')
            ) * interval '1 day';

    -- c) Hâlâ aktif olan sürekli yükleri "bugün" için tazele.
    UPDATE public.listings
    SET available_date = current_date,
        expires_at     = (current_date + interval '1 day') - interval '1 second',
        updated_at     = now()
    WHERE is_recurring = true
      AND status = 'active'
      AND (recurring_until IS NULL OR recurring_until >= current_date);
  $$
);

-- ── 8) Feed indeksi — sürekli yükler `is_recurring DESC` ile önce gelsin.
-- Yazılımcı notu (§7, feed sıralaması): `updated_at`'i birincil sıralama
-- anahtarı yapmak TÜM feed'i (sürekli olmayan ilanlar dahil) "son
-- düzenlenen üste" mantığına çevirirdi — küçük bir fiyat düzeltmesi eski bir
-- ilanı tepeye fırlatır, bu regresyon sayılır (kabul kriteri #10). Bunun
-- yerine `is_recurring` LİDER sıralama anahtarı: sürekli yükler her zaman
-- normal ilanların ÜSTÜNDE bir blok oluşturur, aralarında ve normal
-- ilanlar arasında sıralama yine `created_at DESC` — mevcut davranış
-- BİREBİR korunur. Kod tarafı: app/page.tsx, app/_components/HomeClient.tsx,
-- app/api/listings/ara/route.ts — üçü de `.order('is_recurring', {ascending:false}).order('created_at', ...)`.
DROP INDEX IF EXISTS public.idx_listings_active_feed;
CREATE INDEX IF NOT EXISTS idx_listings_active_feed
  ON public.listings (moderation_status, is_recurring DESC, created_at DESC)
  WHERE status = 'active' AND is_shadow_banned = false;

-- ============================================================
-- Doğrulama
-- ============================================================
SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('expire-active-listings', 'recurring-refresh');
SELECT key, value FROM public.system_config WHERE key LIKE 'recurring%' OR key = 'max_recurring_per_user';
SELECT count(*) AS aktif_surekli_yuk FROM public.listings WHERE is_recurring = true AND status = 'active';
