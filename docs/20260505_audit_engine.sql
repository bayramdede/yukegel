-- ============================================================
-- Sprint 2: Audit Engine — Otomatik İlan Tarama Trigger'ı
-- Supabase SQL Editor'dan çalıştır.
-- ============================================================

-- ── Trigger fonksiyonu ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_listing_fn()
RETURNS trigger AS $$
DECLARE
  rule     RECORD;
  score    INTEGER := 0;
  haystack TEXT;
  logs     JSONB   := '[]'::jsonb;
BEGIN
  -- Taranacak metin: notes + raw_text (küçük harfe çevir)
  haystack := lower(
    COALESCE(NEW.notes, '')    || ' ' ||
    COALESCE(NEW.raw_text, '')
  );

  -- ── REGEX kuralları ──────────────────────────────────────
  FOR rule IN
    SELECT id, pattern, risk_weight, description
    FROM   public.safety_rules
    WHERE  is_active = true
    AND    rule_type = 'REGEX'
  LOOP
    BEGIN
      IF haystack ~* rule.pattern THEN
        score := score + rule.risk_weight;
        logs  := logs || jsonb_build_object(
          'rule_id',     rule.id,
          'description', rule.description,
          'weight',      rule.risk_weight
        );
      END IF;
    EXCEPTION WHEN others THEN
      -- Bozuk regex pattern → sessizce atla, işlemi durdurma
      NULL;
    END;
  END LOOP;

  -- ── PRICE_LIMIT kuralları ─────────────────────────────────
  -- pattern formatı: 'max:50000' veya 'min:100'
  FOR rule IN
    SELECT pattern, risk_weight, description
    FROM   public.safety_rules
    WHERE  is_active = true
    AND    rule_type = 'PRICE_LIMIT'
  LOOP
    BEGIN
      IF rule.pattern LIKE 'max:%' AND NEW.price_offer IS NOT NULL THEN
        IF NEW.price_offer > (split_part(rule.pattern, ':', 2))::numeric THEN
          score := score + rule.risk_weight;
          logs  := logs || jsonb_build_object(
            'rule', 'PRICE_MAX', 'description', rule.description, 'weight', rule.risk_weight
          );
        END IF;
      END IF;
      IF rule.pattern LIKE 'min:%' AND NEW.price_offer IS NOT NULL THEN
        IF NEW.price_offer < (split_part(rule.pattern, ':', 2))::numeric THEN
          score := score + rule.risk_weight;
          logs  := logs || jsonb_build_object(
            'rule', 'PRICE_MIN', 'description', rule.description, 'weight', rule.risk_weight
          );
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  -- ── Sonuç yaz ────────────────────────────────────────────
  score := LEAST(score, 100);   -- 100'ü geçemez

  NEW.audit_score         := score;
  NEW.internal_audit_logs := jsonb_build_object(
    'score',       score,
    'fired_rules', logs,
    'scanned_at',  now()
  );

  -- 71+ puan → shadow ban
  IF score >= 71 THEN
    NEW.is_shadow_banned := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Trigger: sadece INSERT'te çalış ─────────────────────────
-- Moderatör güncellemeleri (UPDATE) yeniden taramaz —
-- kasıtlı bir tasarım kararı. Moderatör shadow ban'ı
-- /api/moderator/toplu-islem üzerinden manuel kaldırır.
DROP TRIGGER IF EXISTS audit_listing_on_insert ON public.listings;
CREATE TRIGGER audit_listing_on_insert
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_listing_fn();

-- ── Mevcut ilanları toplu tara (opsiyonel, ilk kurulumda) ───
-- Sadece bir kez çalıştır. Mevcut ilanların audit_score'unu
-- hesaplar; is_shadow_banned'i değiştirmez (güvenli tarama).
-- Çalıştırmak istersen aşağıdaki bloğu uncomment et:

/*
DO $$
DECLARE
  ilan   RECORD;
  rule   RECORD;
  score  INTEGER;
  logs   JSONB;
  hay    TEXT;
BEGIN
  FOR ilan IN SELECT id, notes, raw_text, price_offer FROM public.listings LOOP
    score := 0;
    logs  := '[]'::jsonb;
    hay   := lower(COALESCE(ilan.notes,'') || ' ' || COALESCE(ilan.raw_text,''));

    FOR rule IN SELECT id, pattern, risk_weight, description
                FROM public.safety_rules
                WHERE is_active = true AND rule_type = 'REGEX' LOOP
      BEGIN
        IF hay ~* rule.pattern THEN
          score := score + rule.risk_weight;
          logs  := logs || jsonb_build_object('rule_id', rule.id, 'description', rule.description, 'weight', rule.risk_weight);
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END LOOP;

    score := LEAST(score, 100);

    UPDATE public.listings
    SET audit_score         = score,
        internal_audit_logs = jsonb_build_object('score', score, 'fired_rules', logs, 'scanned_at', now())
    WHERE id = ilan.id;
  END LOOP;
END $$;
*/
