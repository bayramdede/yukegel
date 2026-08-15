-- 15 Ağu 2026 — "paneli hızlandır" incelemesi sırasında bulundu.
-- `/panel` (app/panel/page.tsx) `reviews`i `.eq('reviewer_id', user.id)` ile
-- okuyor ("bu deal'i zaten değerlendirdim mi?" kontrolü) ama `reviewer_id`
-- hiçbir indeksin ÖNDE gelen kolonu değildi — yalnız `reviews_tekil
-- (deal_id, reviewer_id)` vardı, reviewer_id ikinci sırada olduğu için bu
-- sorguda kullanılamıyordu. Tablo şu an 3 satır (etkisi ölçülemeyecek kadar
-- küçük — CONCURRENTLY bile gerektirmedi) ama büyüdükçe seq scan'e dönerdi.
-- 8 Ağu 2026'daki `docs/20260808_panel_yavasligi.sql` dersinin aynısı:
-- ".eq('user_id', …) ile sorgulanan her tabloda o kolon indeksli olmalı."
create index if not exists reviews_reviewer_idx
  on public.reviews (reviewer_id);

-- ✅ UYGULANDI (15 Ağu 2026, Supabase MCP `apply_migration` ile canlıda).
