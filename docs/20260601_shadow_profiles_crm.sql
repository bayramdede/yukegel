-- ============================================================
-- Shadow Profiles (Gölge Profil) + CRM
-- Tarih: 2026-06-01
-- ============================================================

-- 1. shadow_profiles tablosu
CREATE TABLE IF NOT EXISTS public.shadow_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text NOT NULL UNIQUE,          -- +905XXXXXXXXX formatı (normalize edilmiş)
  name            text,                          -- admin manuel doldurur
  company_name    text,                          -- admin manuel doldurur
  notes           text,                          -- admin özel notları
  status          text NOT NULL DEFAULT 'active' -- active | blocked | converted
                    CHECK (status IN ('active', 'blocked', 'converted')),
  converted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS shadow_profiles_phone_idx ON public.shadow_profiles (phone);
CREATE INDEX IF NOT EXISTS shadow_profiles_status_idx ON public.shadow_profiles (status);
CREATE INDEX IF NOT EXISTS shadow_profiles_created_at_idx ON public.shadow_profiles (created_at DESC);

-- updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION public.set_shadow_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shadow_profiles_updated_at ON public.shadow_profiles;
CREATE TRIGGER shadow_profiles_updated_at
  BEFORE UPDATE ON public.shadow_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_shadow_profiles_updated_at();

-- 2. listings tablosuna shadow_profile_id FK ekle
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS shadow_profile_id uuid REFERENCES public.shadow_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS listings_shadow_profile_id_idx ON public.listings (shadow_profile_id);

-- 3. RLS: shadow_profiles yalnızca admin erişebilir
ALTER TABLE public.shadow_profiles ENABLE ROW LEVEL SECURITY;

-- Admin tam erişim (service role bypass eder, bu policy browser client için)
CREATE POLICY shadow_profiles_admin_all ON public.shadow_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Upsert RPC: upsert_shadow_profile
-- Verilen telefon için shadow_profile_id döner (var ise mevcut, yoksa yeni)
CREATE OR REPLACE FUNCTION public.upsert_shadow_profile(p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.shadow_profiles (phone)
  VALUES (p_phone)
  ON CONFLICT (phone) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. CRM özet view: admin paneli için kolay sorgu
CREATE OR REPLACE VIEW public.shadow_profile_summary AS
SELECT
  sp.id,
  sp.phone,
  sp.name,
  sp.company_name,
  sp.notes,
  sp.status,
  sp.converted_user_id,
  sp.created_at,
  sp.updated_at,
  COUNT(l.id)::int                              AS listing_count,
  MAX(l.created_at)                             AS last_listing_at,
  MIN(l.created_at)                             AS first_listing_at
FROM public.shadow_profiles sp
LEFT JOIN public.listings l ON l.shadow_profile_id = sp.id
GROUP BY sp.id;

-- View erişim: admin servis rolü ile çalışır
GRANT SELECT ON public.shadow_profile_summary TO authenticated;
