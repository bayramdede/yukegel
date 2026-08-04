-- =====================================================================
-- aliases_normalize trigger — SEÇENEK (a) ile kurulum
-- Tarih: 4 Ağustos 2026
-- Görev: #43
-- Önceki dosya: docs/20260729_alias_normalize_trigger.sql (KURULMADI)
-- =====================================================================
--
-- NEDEN YENİ DOSYA?
-- 29 Tem tarihli dosyadaki fonksiyon gövdesi DB'ye kopyalanmış ama
-- DROP/CREATE TRIGGER satırları kopyalanmamış. Ölçüm (4 Ağu):
--   pg_proc    → 'aliases_normalize' VAR
--   pg_trigger → 0 satır (trigger YOK)
-- Yani fonksiyon canlı, tetikleyici hiç kurulmadı. Fonksiyon zaten
-- var olduğu için aşağıdaki CREATE OR REPLACE onu GÜNCELLER.
--
-- ---------------------------------------------------------------------
-- ESKİ DOSYADAN TEK FARK: alias satırından lower() ÇIKARILDI
-- ---------------------------------------------------------------------
-- Eski hâli:
--   NEW.alias := lower(btrim(regexp_replace(NEW.alias, '\s+', ' ', 'g')));
--
-- Gerekçesi (eski dosya sat. 64-66 ve 106-111) şuydu:
--   "Büyük harf içeren bir alias hiçbir zaman tutmaz, sessizce ölü kayıt olur."
-- BU PREMİS YANLIŞ — 4 Ağu'da ölçüldü (Bulgu B):
--   parse-listing/index.ts:323,337  → trNorm(a.alias)
--   whatsapp-parse/index.ts:224,232 → trNorm(a.alias) / aliasAnahtari(a.alias)
-- Alias YAZILIRKEN değil, OKUNURKEN katlanıyor. Yani büyük harfli alias
-- pekâlâ eşleşir. Trigger'ın lower()'ı ~100 ÇALIŞAN kaydı gereksiz yere
-- yeniden yazardı.
--
-- Dahası lower() AKTİF ZARAR verir. Postgres lower('İSTANBUL') sonucu
-- 'i' + U+0307 (birleşen nokta), uzunluk 9, ='istanbul' FALSE.
-- Bu tam olarak lib/alias-normalize.ts:82'nin yarattığı ve 4 Ağu'da
-- 34 satırda onarılan hatanın aynısı. Trigger'a lower() koymak, uygulama
-- tarafında kapattığımız deliği DB tarafında yeniden açmak olurdu.
--
-- lower() İSTENİYORSA doğru sıra şudur (aliasKey ile aynı):
--   lower(replace(NEW.alias,'İ','i'))   -- replace ÖNCE, lower SONRA
-- Ama uygulama zaten DB'ye ulaşmadan lower()'lıyor; DB'nin gördüğü
-- değerde U+0130 hiç bulunmaz. Yani bu koruma sıfır fayda sağlar.
-- Bu yüzden lower() tamamen çıkarıldı — seçenek (a).
--
-- ---------------------------------------------------------------------
-- KORUNAN KISIMLAR — ASIL DEĞER BURADA
-- ---------------------------------------------------------------------
-- 1) \s+ → ' ' sıkıştırma + btrim  : çift boşluklu alias'ı engeller
-- 2) district = '' → NULL          : '' ve NULL iki ayrı "ilçe yok" hâli olmasın
-- learn-aliases DIŞINDAN yapılan yazmalar (SQL Editor, seed, admin) bu
-- iki normalizasyonu atlıyor. Trigger'ın varlık sebebi bunlar.
--
-- ---------------------------------------------------------------------
-- KURULUM RİSKİ: YOK
-- ---------------------------------------------------------------------
-- Q3 ölçümü (4 Ağu): trigger'ın yazacağı değerlerde katlanmış-anahtar
-- çakışması 0 satır. BEFORE trigger sadece \s+ ve '' → NULL dokunuşu
-- yapacağı için 23505 riski yok. Ayrıca trigger yalnızca YENİ
-- INSERT/UPDATE'leri etkiler, mevcut satırlara dokunmaz.
--
-- =====================================================================

-- ---------------------------------------------------------------------
-- BÖLÜM 1 — Kurulum öncesi durum kontrolü
-- ---------------------------------------------------------------------
-- Beklenen: fonksiyon_var = true, trigger_var = false
select
  exists (select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'aliases_normalize')
    as fonksiyon_var,
  exists (select 1 from pg_trigger t
          where t.tgname = 'aliases_normalize_trg' and not t.tgisinternal)
    as trigger_var;


-- ---------------------------------------------------------------------
-- BÖLÜM 2 — Fonksiyonu güncelle
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aliases_normalize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- alias: SADECE boşluk normalizasyonu.
  -- lower() BİLEREK YOK — bkz. dosya başındaki Bulgu B açıklaması.
  -- Türkçe İ (U+0130) lower()'dan geçerse 'i'+U+0307 üretir ve
  -- katlanmış anahtar sapar; eşleşme tarafı zaten okurken katlıyor.
  IF NEW.alias IS NOT NULL THEN
    NEW.alias := btrim(regexp_replace(NEW.alias, '\s+', ' ', 'g'));
  END IF;

  IF NEW.normalized IS NOT NULL THEN
    NEW.normalized := btrim(regexp_replace(NEW.normalized, '\s+', ' ', 'g'));
  END IF;

  IF NEW.district IS NOT NULL THEN
    NEW.district := btrim(regexp_replace(NEW.district, '\s+', ' ', 'g'));
    -- Boş string NULL olsun: '' ile NULL iki ayrı "ilçe yok" hali olmasın.
    IF NEW.district = '' THEN
      NEW.district := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------
-- BÖLÜM 3 — Trigger'ı kur  (29 Tem'de ATLANAN kısım — asıl eksik buydu)
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS aliases_normalize_trg ON public.aliases;

CREATE TRIGGER aliases_normalize_trg
  BEFORE INSERT OR UPDATE OF alias, normalized, district
  ON public.aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.aliases_normalize();


-- ---------------------------------------------------------------------
-- BÖLÜM 4 — Doğrulama
-- ---------------------------------------------------------------------

-- 4.a  Trigger gerçekten kuruldu mu?  Beklenen: 1 satır, tgenabled = 'O'
select t.tgname,
       t.tgenabled,
       pg_get_triggerdef(t.oid) as tanim
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'aliases'
  and not t.tgisinternal;

-- 4.b  Fonksiyon gövdesinde lower() KALMADIĞINI doğrula
--      Beklenen: lower_var = false
select position('lower(' in prosrc) > 0 as lower_var
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'aliases_normalize';

-- 4.c  Canlı davranış testi — geçici satır yaz, oku, sil.
--      Beklenen: alias = 'TEST İĞNE ALIAS' (büyük harf KORUNDU,
--                çift boşluk teke indi), district = NULL
begin;
  insert into public.aliases (alias, normalized, type, district, is_active)
  values ('  TEST   İĞNE   ALIAS  ', '  test normalized  ', 'city', '   ', false)
  returning
    alias,
    length(alias)              as alias_uzunluk,
    normalized,
    district,
    district is null           as district_null_mu;
rollback;
-- rollback → test satırı DB'de kalmaz.


-- =====================================================================
-- SONUÇ KAYDI (çalıştırdıktan sonra doldur)
-- =====================================================================
-- Çalıştırma tarihi :
-- BÖLÜM 1 fonksiyon_var / trigger_var :        /
-- 4.a tgname / tgenabled              :        /
-- 4.b lower_var (beklenen false)      :
-- 4.c alias / uzunluk / district_null :        /        /
-- Not :
-- =====================================================================
