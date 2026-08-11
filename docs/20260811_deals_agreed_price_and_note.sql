-- Güvenli Etkileşim Faz 2.1 (11 Ağu 2026) — "Bu İşi Al" talep ekranına anlaşılan
-- fiyat + not alanı. Nakliyeci talep gönderirken doldurur; her iki taraf da
-- panelde "Anlaşma Şartları" kartında (fiyat + not + ödeme vadesi) görür.
-- Araç seçimi BİLEREK YOK — sonraki faz (PROJE_HARITASI.md §15, YAPILACAKLAR.md md.1).
--
-- Supabase MCP `apply_migration` ile canlıya uygulandı (proje: gobepcswwsoswodhaufy,
-- migration adı: deals_agreed_price_and_note). Bu dosya yalnız KAYIT — diğer
-- dated .sql dosyalarıyla aynı convention (docs/20260810_guven_etkilesim_plan.sql,
-- docs/20260811_deals_reviews_grant_hardening.sql).

alter table public.deals
  add column agreed_price numeric,
  add column note text;

comment on column public.deals.agreed_price is
  'Nakliyecinin talep gönderirken teklif ettiği/anlaştığı fiyat (TL). NULL = eski kayıt veya belirtilmedi.';
comment on column public.deals.note is
  'Talep gönderirken eklenen serbest metin not; her iki taraf da görür. NULL = yok.';

alter table public.deals
  add constraint deals_agreed_price_check check (agreed_price is null or agreed_price >= 0);

-- Uygulama tarafı (kod, aynı commit'te):
--   app/api/deals/route.ts       — POST: agreed_price ZORUNLU (>0, ≤100M), note opsiyonel (≤1000 char)
--   app/ilan/[id]/Aksiyonlar.tsx — "Bu İşi Al" formuna fiyat (zorunlu) + not alanı
--   app/panel/AnlasmalarSekmesi.tsx — "Anlaşma Şartları" kutusu (fiyat + not + vade)
--   app/panel/page.tsx           — SSR select'e agreed_price/note eklendi
--   scripts/test-deals-reviews.mts — 3 yeni kontrol, test:deals 25/25
