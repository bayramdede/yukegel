-- 15 Ağu 2026 — "Aynı plakayı başka bir işe yeniden yazarken önceki bilgileri
-- getirmedi" (Bayram bulgusu).
--
-- Kök neden: `carrier_vehicles` tablosu var ("kayıtlı araçlar" hızlı seçim
-- listesi buradan geliyor — bkz. `app/panel/PanelClient.tsx` seferAc,
-- `app/panel/AnlasmalarSekmesi.tsx` SevkiyatTakip.formAc + AracAtaFormu),
-- AMA en sık kullanılan yazma yolu — "Plaka Ata" (harici sefer, panel
-- İlanlarım → `POST /api/deals`) — bu tabloya HİÇ YAZMIYORDU, yalnız
-- `deals`e yazıyordu. Ayrıca tabloda nakliyeci firma adı/telefonu için kolon
-- bile yoktu (yalnız plate + driver_name).
--
-- Bu migration YALNIZ şemayı düzeltiyor; eksik upsert çağrıları
-- `app/api/deals/route.ts` (harici sefer oluşturma) ve
-- `app/api/deals/[id]/route.ts` (`stage_ilerle` 'assigned') içinde
-- ayrıca kod tarafında eklendi.
alter table public.carrier_vehicles
  add column if not exists carrier_name text,
  add column if not exists carrier_phone text;

comment on column public.carrier_vehicles.carrier_name is 'Harici nakliyeci/firma adı (varsa) — plaka atarken hatırlanır, 15 Ağu 2026.';
comment on column public.carrier_vehicles.carrier_phone is 'Harici nakliyeci telefonu (varsa) — plaka atarken hatırlanır, 15 Ağu 2026.';

-- Var olan deals kayıtlarından geriye dönük doldur (küçük veri seti, güvenli:
-- yalnız hâlâ boş olan satırları doldurur, mevcut veriyi ezmez).
update public.carrier_vehicles cv
set carrier_name  = coalesce(cv.carrier_name, d.external_carrier_name),
    carrier_phone = coalesce(cv.carrier_phone, d.external_carrier_phone)
from public.deals d
where d.vehicle_plate = cv.plate
  and d.shipper_id = cv.user_id
  and (d.external_carrier_name is not null or d.external_carrier_phone is not null)
  and cv.carrier_name is null and cv.carrier_phone is null;

-- ✅ UYGULANDI (15 Ağu 2026, Supabase MCP `apply_migration` ile canlıda).
-- Geriye dönük doldurma bu anda 0 satırı etkiledi — tek mevcut satırın
-- (`34ABC123`) eşleşen bir `deals.external_carrier_name/phone`'u yoktu.
