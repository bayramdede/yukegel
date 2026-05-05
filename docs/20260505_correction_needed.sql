-- ============================================================
-- Sprint 5: correction_needed moderation_status değeri
-- Supabase SQL Editor'dan çalıştır.
-- ============================================================

-- Mevcut check constraint'i düşür ve yeniden oluştur
-- (Constraint adı farklıysa Supabase Dashboard > Table Editor > listings > Constraints'ten kontrol et)

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_moderation_status_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_moderation_status_check
  CHECK (moderation_status IN (
    'pending',
    'approved',
    'rejected',
    'auto_published',
    'archived',
    'correction_needed'
  ));
