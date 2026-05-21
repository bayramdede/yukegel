-- Migration: archived_links tablosu
-- Mesajlardaki URL'leri arşivler; admin/moderatör "Link Havuzu" olarak kullanır.
-- Aynı URL tekrar gelirse CONFLICT → ignore (birden fazla mesajda aynı link = normal).
-- Tarih: 2026-05-21

CREATE TABLE IF NOT EXISTS public.archived_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text        NOT NULL,
  domain      text,
  category    text        NOT NULL DEFAULT 'other',
    -- 'whatsapp_group' | 'telegram' | 'facebook_group' | 'instagram' | 'linkedin' | 'other'
  status      text        NOT NULL DEFAULT 'pending_review',
    -- 'pending_review' | 'approved' | 'rejected'
  source      text,
    -- 'whatsapp_parse' (Edge Fn) | 'user_text' (parse-text API) | 'whatsapp_bot'
  raw_post_id uuid        REFERENCES public.raw_posts(id)  ON DELETE SET NULL,
  user_id     uuid        REFERENCES public.users(id)      ON DELETE SET NULL,
  notes       text,
  reviewed_by uuid        REFERENCES public.users(id)      ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Aynı URL ikinci kez gelirse hata yerine sessizce geç
CREATE UNIQUE INDEX IF NOT EXISTS archived_links_url_uq
  ON public.archived_links(url);

CREATE INDEX IF NOT EXISTS archived_links_status_idx   ON public.archived_links(status);
CREATE INDEX IF NOT EXISTS archived_links_category_idx ON public.archived_links(category);
CREATE INDEX IF NOT EXISTS archived_links_created_idx  ON public.archived_links(created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.archived_links ENABLE ROW LEVEL SECURITY;

-- Service role her şeyi yapabilir (Edge Fn + API routes)
CREATE POLICY "al_service_role_all" ON public.archived_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Oturum açmış herkes INSERT yapabilir (parse akışları anon değil, authenticated çalışır)
CREATE POLICY "al_authenticated_insert" ON public.archived_links
  FOR INSERT TO authenticated WITH CHECK (true);

-- Admin ve moderatörler okuyabilir
CREATE POLICY "al_admin_mod_select" ON public.archived_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'moderator')
    )
  );

-- Admin ve moderatörler güncelleyebilir (status, notes, reviewed_by, reviewed_at)
CREATE POLICY "al_admin_mod_update" ON public.archived_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'moderator')
    )
  );
