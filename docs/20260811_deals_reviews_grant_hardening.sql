-- ============================================================================
-- Güvenli Etkileşim — deals/reviews üzerinde GEREKSİZ GRANT'ları geri al
-- (savunma derinliği; SÖMÜRÜLEBİLİR bir açık DEĞİL — bkz. aşağıdaki doğrulama)
-- ============================================================================
--
-- NASIL BULUNDU
-- -------------
-- `/u/[username]` profil sayfasına "yayınlanmış değerlendirmeler" bölümü
-- eklemeden önce `reviews`in RLS/GRANT durumunu doğrularken bulundu:
-- `anon` VE `authenticated` rollerinin `public.deals` ve `public.reviews`
-- üzerinde **INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES** (yani
-- SELECT dışında HER ŞEY) GRANT edilmiş olduğu görüldü — Supabase'in yeni
-- tablolar için varsayılan şema-geneli GRANT davranışı (migration'da özel bir
-- GRANT/REVOKE yazılmadıysa böyle gelir). Faz 1 migration'ı bunu HİÇ ele
-- almamış; SQL plan dosyası "RLS yalnız OKUMAYI sınırlıyor, YAZMA istemciden
-- YOK" diyordu ama bu doğru değildi — yazma GRANT DÜZEYİNDE aslında vardı,
-- yalnız RLS'in "policy yoksa reddet" varsayılanı fiilen engelliyordu.
--
-- 🚨 BU DESEN SADECE deals/reviews'a ÖZGÜ DEĞİL — `information_schema`
-- taraması `safety_rules`, `system_config`, `blacklist`, `pois`, `raw_posts`,
-- `shadow_profiles` dahil NEREDEYSE TÜM public şema tablolarında aynı deseni
-- gösterdi (INSERT/UPDATE/DELETE/TRUNCATE GRANT var, o komutlar için RLS
-- policy'si yok). Bu şemasal/sistemik bir durum, TEK bir migration'la
-- düzeltilemeyecek kadar geniş kapsamlı — bilerek buraya, yalnız Güvenli
-- Etkileşim'in kendi tablolarına (deals/reviews) SINIRLANDI. Genel tarama
-- ayrı bir maddeye düşüldü: `docs/YAPILACAKLAR.md`.
--
-- ÖNCE EMPİRİK OLARAK DOĞRULANDI — SÖMÜRÜLEMEZ (11 Ağu 2026):
--   PostgreSQL RLS kuralı: `ENABLE ROW LEVEL SECURITY` açıkken bir komut için
--   (INSERT/UPDATE/DELETE) HİÇBİR permissive policy yoksa, o komut o rol için
--   TÜM satırlarda REDDEDİLİR — GRANT var olsa bile. `deals`/`reviews` için
--   yalnızca SELECT policy'leri var (`deals_taraflar_okur`,
--   `reviews_kendi_yorumu`, `reviews_yayinlanan_herkese`); INSERT/UPDATE/DELETE
--   policy'si YOK. Gerçek bir saldırgan senaryosu iki geçici kullanıcıyla
--   bizzat denendi:
--     · `authenticated` client'la `deals` INSERT (kendini var olan bir ilana
--       nakliyeci olarak eklemeye çalışma) → 42501 "new row violates RLS policy"
--     · `authenticated` client'la `reviews` INSERT (sahte 5 yıldız + anında
--       yayınlanmış yorum) → 42501 "new row violates RLS policy"
--     · `authenticated` client'la `reviews` DELETE (rastgele id) → 0 satır
--       etkilendi, hata yok (RLS filtre setini boşalttığı için)
--   Üçü de reddedildi/etkisizdi. **Sömürü YOK — bu turdaki düzeltme sömürüyü
--   KAPATMIYOR (zaten kapalıydı), ikinci bir savunma katmanı EKLİYOR.**
--
-- NEDEN YİNE DE DÜZELTİLİYOR (savunma derinliği):
-- Bugün RLS tek başına yeterli ama TEK hata payı sıfır: gelecekte biri
-- (insan ya da bir AI oturumu) meşru görünen ama gevşek bir INSERT/UPDATE
-- policy'si eklerse (`USING (true)` gibi), GRANT zaten açık olduğu için açık
-- ANINDA canlıya çıkar — hiçbir ikinci kontrol yok. GRANT'ı da daraltmak,
-- gelecekteki bir policy hatasının blast radius'unu SIFIRLAR: `authenticated`
-- rolünün fiziksel olarak yazma YETKİSİ olmadığı sürece, yanlış yazılmış bir
-- policy tek başına hiçbir şeyi tehlikeye atamaz.
--
-- KAPSAM DAR TUTULDU: yalnız INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER — SELECT'e
-- DOKUNULMUYOR. `reviews` SELECT gerekli (herkese açık profil sayfası
-- yayınlanmış yorumları göstermeli); `deals` SELECT'i RLS zaten doğru
-- daraltıyor (yalnız kendi taraf olduğun kayıt) ve dokunmanın kazancı yok.
-- Uygulama kodu bu iki tabloya YAZARKEN hep `getServiceSupabase()` kullanıyor
-- (`app/api/deals/*`, `app/api/reviews/route.ts`) — bu REVOKE hiçbir meşru
-- akışı KIRMAZ (service role privilege kontrolünü tamamen bypass eder).
-- ============================================================================

begin;

revoke insert, update, delete, truncate, trigger on public.deals from anon, authenticated;
revoke insert, update, delete, truncate, trigger on public.reviews from anon, authenticated;

-- Doğrulama: aşağıdaki sorgu yalnız SELECT (ve REFERENCES) satırları dönmeli.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('deals', 'reviews')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

commit;

-- ============================================================================
-- DEPLOY SONRASI DUMAN TESTİ
-- ============================================================================
-- Servis rolü bu REVOKE'tan ETKİLENMEZ (RLS + GRANT'ı tamamen bypass eder),
-- yani hiçbir uygulama akışının bozulma riski yok. Yine de:
-- 1) `/ilan/[id]` → "Bu İşi Al" → talep oluşuyor mu?
-- 2) Panel → "Anlaşmalarım" → onayla/yola çıktı/tamamla çalışıyor mu?
-- 3) Tamamlanmış bir anlaşmada değerlendirme yazılabiliyor mu?
--
-- GERİ ALMA (bir şey kırılırsa — beklenmiyor, servis rolü etkilenmiyor)
-- ----------------------------
--   grant insert, update, delete, truncate, trigger on public.deals to anon, authenticated;
--   grant insert, update, delete, truncate, trigger on public.reviews to anon, authenticated;
-- ============================================================================
