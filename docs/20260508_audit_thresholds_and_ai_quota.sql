-- ============================================================
-- 8 Mayıs 2026 — Audit eşikleri konfigüre edilebilir + AI ilan limiti
--   Faz 1, madde 3 ve 4
-- Supabase SQL Editor'dan sırayla çalıştır.
-- ============================================================

-- ── 1) system_config: yeni 3 anahtar (idempotent, unique constraint gerektirmez) ─
-- (category, key) üzerinde unique constraint olmayabileceği için ON CONFLICT yerine
-- IF NOT EXISTS pattern'ı kullanıyoruz. Tekrar çalıştırılabilir, mevcut değerleri ezmez.
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.system_config
    WHERE category = 'parse' AND key = 'auto_publish_score_max'
  ) THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES (
      'parse', 'auto_publish_score_max',
      '31'::jsonb, 'integer',
      'Audit skoru bu değerin ALTINDA olan ilanlar otomatik yayına alınır. Şu anki varsayılan: 31 (yani 0–30 puanlı ilanlar temiz sayılır).'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.system_config
    WHERE category = 'parse' AND key = 'reject_score_min'
  ) THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES (
      'parse', 'reject_score_min',
      '71'::jsonb, 'integer',
      'Audit skoru bu değer ve ÜZERİNDE olan ilanlar otomatik olarak shadow_ban + moderation_status=archived yapılır. Aktif iş akışında dikkate alınmaz.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.system_config
    WHERE category = 'llm' AND key = 'ai_listing_quota_default'
  ) THEN
    INSERT INTO public.system_config (category, key, value, data_type, description)
    VALUES (
      'llm', 'ai_listing_quota_default',
      '5'::jsonb, 'integer',
      'Tüm kullanıcılar için varsayılan günlük AI (Metinden İlan) limiti. Kullanıcı bazlı override: users.ai_listing_quota_daily.'
    );
  END IF;
END $;

-- ── 2) users.ai_listing_quota_daily kolonu ────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ai_listing_quota_daily INTEGER;

COMMENT ON COLUMN public.users.ai_listing_quota_daily IS
  'Kullanıcı bazlı günlük AI (Metinden İlan) limiti. NULL ise system_config.ai_listing_quota_default kullanılır. 0 = AI özelliği kapalı.';

-- ── 3) audit_listing_fn — eşikleri DB''den oku ────────────
CREATE OR REPLACE FUNCTION public.audit_listing_fn()
RETURNS trigger AS $$
DECLARE
  rule          RECORD;
  score         INTEGER := 0;
  haystack      TEXT;
  logs          JSONB   := '[]'::jsonb;
  auto_pub_max  INTEGER;
  reject_min    INTEGER;
BEGIN
  -- Eşikleri config''den çek (yoksa hard-coded fallback)
  BEGIN
    SELECT (value::text)::integer INTO auto_pub_max
    FROM public.system_config
    WHERE category = 'parse' AND key = 'auto_publish_score_max';
  EXCEPTION WHEN others THEN auto_pub_max := NULL;
  END;
  IF auto_pub_max IS NULL THEN auto_pub_max := 31; END IF;

  BEGIN
    SELECT (value::text)::integer INTO reject_min
    FROM public.system_config
    WHERE category = 'parse' AND key = 'reject_score_min';
  EXCEPTION WHEN others THEN reject_min := NULL;
  END;
  IF reject_min IS NULL THEN reject_min := 71; END IF;

  haystack := lower(
    COALESCE(NEW.notes, '')    || ' ' ||
    COALESCE(NEW.raw_text, '')
  );

  -- REGEX kuralları
  FOR rule IN
    SELECT id, pattern, risk_weight, description
    FROM   public.safety_rules
    WHERE  is_active = true AND rule_type = 'REGEX'
  LOOP
    BEGIN
      IF haystack ~* rule.pattern THEN
        score := score + rule.risk_weight;
        logs  := logs || jsonb_build_object(
          'rule_id', rule.id, 'description', rule.description, 'weight', rule.risk_weight
        );
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;

  -- PRICE_LIMIT kuralları
  FOR rule IN
    SELECT pattern, risk_weight, description
    FROM   public.safety_rules
    WHERE  is_active = true AND rule_type = 'PRICE_LIMIT'
  LOOP
    BEGIN
      IF rule.pattern LIKE 'max:%' AND NEW.price_offer IS NOT NULL
         AND NEW.price_offer > (split_part(rule.pattern, ':', 2))::numeric THEN
        score := score + rule.risk_weight;
        logs  := logs || jsonb_build_object('rule', 'PRICE_MAX', 'description', rule.description, 'weight', rule.risk_weight);
      END IF;
      IF rule.pattern LIKE 'min:%' AND NEW.price_offer IS NOT NULL
         AND NEW.price_offer < (split_part(rule.pattern, ':', 2))::numeric THEN
        score := score + rule.risk_weight;
        logs  := logs || jsonb_build_object('rule', 'PRICE_MIN', 'description', rule.description, 'weight', rule.risk_weight);
      END IF;
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;

  score := LEAST(score, 100);

  NEW.audit_score := score;
  NEW.internal_audit_logs := jsonb_build_object(
    'score', score,
    'fired_rules', logs,
    'thresholds', jsonb_build_object('auto_publish_max', auto_pub_max, 'reject_min', reject_min),
    'scanned_at', now()
  );

  -- Reject seviyesi: shadow_ban + archived (hiç dikkate alınmasın)
  IF score >= reject_min THEN
    NEW.is_shadow_banned  := true;
    NEW.moderation_status := 'archived';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger zaten audit_engine.sql içinde tanımlı — yeniden bağlamaya gerek yok.
-- Sadece fonksiyon CREATE OR REPLACE edildi.
