-- ============================================================
-- Sprint 1: Shadow Ban & Audit Infrastructure
-- ============================================================

-- 1. listings tablosuna güvenlik kolonları ekle
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_shadow_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audit_score      INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_audit_logs JSONB;

-- 2. Hızlı listeleme filtresi için indeks
CREATE INDEX IF NOT EXISTS idx_listings_shadow_ban
  ON public.listings (is_shadow_banned, moderation_status, status);

-- 3. Kural sözlüğü (Audit Engine'in çalıştırdığı kurallar)
CREATE TABLE IF NOT EXISTS public.safety_rules (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type   text    NOT NULL CHECK (rule_type IN ('REGEX', 'PRICE_LIMIT', 'RATE_LIMIT')),
  pattern     text    NOT NULL,
  risk_weight integer NOT NULL DEFAULT 10,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 4. Global blacklist
CREATE TABLE IF NOT EXISTS public.blacklist (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier_type  text NOT NULL CHECK (identifier_type IN ('PHONE', 'TAX_ID', 'IP_ADDRESS', 'DEVICE_ID')),
  identifier_value text NOT NULL,
  reason           text,
  blocked_by       uuid REFERENCES auth.users(id),
  blocked_at       timestamptz DEFAULT now(),
  UNIQUE (identifier_type, identifier_value)
);

-- 5. RLS
ALTER TABLE public.safety_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_only_safety_rules" ON public.safety_rules;
CREATE POLICY "admin_only_safety_rules" ON public.safety_rules
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "admin_only_blacklist" ON public.blacklist;
CREATE POLICY "admin_only_blacklist" ON public.blacklist
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Başlangıç güvenlik kuralları
INSERT INTO public.safety_rules (rule_type, pattern, risk_weight, description) VALUES
  ('REGEX', '(?i)(alkol|sigara|ka[çc]ak|yolcu|insan|ceset)',     80,  'Yasadışı taşımacılık'),
  ('REGEX', '(?i)(silah|mermi|patlayıcı)',                        100, 'Tehlikeli madde'),
  ('REGEX', '(?i)(uyu[şs]turucu|esrar|eroin|kokain)',             100, 'Yasadışı madde'),
  ('REGEX', '(https?://|www\.)',                                   30,  'URL paylaşımı'),
  ('REGEX', '(?i)(telegram|instagram|facebook\.com|tiktok)',       25,  'Sosyal medya yönlendirme'),
  ('REGEX', '(?i)(kapora|pey|emanet para|avans)',                  40,  'Peşin para tuzağı')
ON CONFLICT DO NOTHING;
