-- =============================================================================
-- moderator_ilan_duzenle() — moderatör "Düzenle" akışını atomikleştir
-- Tarih: 8 Ağustos 2026 (Supabase `apply_migration` ile uygulandı)
-- =============================================================================
--
-- BULUNAN İKİ SORUN (app/moderator/page.tsx::duzenleKaydet, eski hâl):
--   1. `listings` UPDATE'i ve her durak için ayrı update/insert transaction'sız
--      atılıyordu — yarıda bir hata olursa ilan kendi duraklarıyla çelişirdi.
--   2. Formda SİLİNEN bir durak (`stopSil()`) DB'de HİÇ silinmiyordu; döngü
--      yalnız "id varsa update, yoksa insert" biliyordu, delete yoktu. "Sil"
--      butonu ekranda çalışıp kaydedince eski durak DB'de hayalet kalıyordu.
--
-- ÇÖZÜM: tek RPC, tek transaction. Duraklar UPDATE değil SİL+YENİDEN-EKLE —
-- bu hem #1'i hem #2'yi kapatıyor.
--
-- Fonksiyon tanımı için: `select pg_get_functiondef('moderator_ilan_duzenle'::regproc)`
-- (Supabase migration geçmişinde `moderator_ilan_duzenle_atomik` adıyla kayıtlı.)

-- BÖLÜM 0 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı, hepsi ROLLBACK'li)
-- =============================================================================

-- 0.1 Moderator kimliğiyle gerçek bir güncelleme — başarılı olmalı
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.users where role in ('moderator','admin') limit 1), true);
set local role authenticated;
select moderator_ilan_duzenle(
  (select id from listings limit 1),
  jsonb_build_object('listing_type','yuk','origin_province_id',34,'origin_district','Test',
    'origin_district_official', false, 'price_offer','15000','notes','RPC test notu',
    'vehicle_type', jsonb_build_array('TIR'), 'body_type', jsonb_build_array('Tenteli')),
  jsonb_build_array(jsonb_build_object('province_id',6,'district','Test2','weight_ton','10',
    'pallet_count','5','vehicle_count','1','cargo_type','Tekstil'))
);
-- beklenen: hatasız döner, ilanın alanları + tek durağı güncellenir
rollback;

-- 0.2 Sıradan 'user' rolüyle çağrı — reddedilmeli
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.users where coalesce(role,'user')='user' limit 1), true);
set local role authenticated;
select moderator_ilan_duzenle(
  (select id from listings limit 1),
  jsonb_build_object('origin_province_id', 34),
  jsonb_build_array(jsonb_build_object('province_id', 6))
);
rollback;
-- SONUÇ (8 Ağu 2026): ERROR 42501 moderator_ilan_duzenle: yetkisiz ✅

-- Kod tarafı: `tsc --noEmit` temiz, gerçek `next build` temiz.
