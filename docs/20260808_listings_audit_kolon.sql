-- =============================================================================
-- `listings.internal_audit_logs` public sızıntısı — 8 Ağu 2026
-- =============================================================================
--
-- NASIL BULUNDU: 7-8 Ağu login regresyonundan sonra aynı hata sınıfını (satır
-- RLS'i "herkes okuyabilir" + kolon GRANT'ı dar değil) başka tablolarda da
-- arıyordum. `public.listings`'in RLS'i şuydu:
--
--   "Herkes okuyabilir"  SELECT  roles={public}  qual=true
--
-- yani satır bazında HİÇBİR filtre yok — approved/pending/rejected/archived
-- FARK ETMEKSİZİN her satır herkese (anon dâhil) açık. Bugüne kadar bunun
-- zararsız kalmasının tek sebebi, uygulama kodunun HER anon/authenticated
-- sorguda elle dar bir `select(...)` listesi kullanması (`contact_phone`
-- SPRINT_01 L1e'de zaten bu yüzden ayrı kolon revoke edilmişti). Ama kolon
-- GRANT'ı bu listeyle SINIRLI DEĞİLDİ — `internal_audit_logs` (jsonb) hem
-- `anon` hem `authenticated`'a table-level SELECT ile açıktı. Yani uygulama
-- kodu hiç sormasa bile, anon key'i olan HERKES doğrudan PostgREST'e:
--
--   GET /rest/v1/listings?select=internal_audit_logs,moderation_status
--
-- atarak şunu görüyordu (gerçek, canlı satır — 8 Ağu'da SET LOCAL ROLE anon
-- ile doğrulandı):
--
--   {"score":70,"thresholds":{"reject_min":71,"auto_publish_max":31},
--    "fired_rules":[{"weight":70,"rule_id":"...",
--    "description":"Güvenlik: İlan içine telefon veya e-posta gizlenmiş."}]}
--
-- yani anti-spam/moderasyon motorunun TAM eşik değerlerini (`reject_min`,
-- `auto_publish_max`) ve hangi ifadenin kaç puan getirdiğini — kural atlatmayı
-- kolaylaştıran bir sızıntı — kayıtsız, oturumsuz herkes okuyabiliyordu.
--
-- BÖLÜM 0 — ÖLÇÜM (8 Ağu 2026, gerçekten çalıştırıldı)
-- =============================================================================
-- begin; set local role anon;
-- select internal_audit_logs from public.listings where internal_audit_logs<>'{}' limit 3;
-- rollback;
-- SONUÇ (düzeltmeden ÖNCE): 3 satır döndü, thresholds/fired_rules dâhil. ⚠️

-- =============================================================================
-- BÖLÜM 1 — UYGULA
-- =============================================================================
revoke select (internal_audit_logs) on public.listings from anon, authenticated;
-- `audit_score` (ham puan, 0-100) daha az hassas — `/ilan/[id]` sayfasında zaten
-- "Kalite Skoru" adıyla BİLEREK herkese gösteriliyor (o yol service role
-- kullanıyor, bu revoke'tan etkilenmiyor). Yine de `anon`'un buna hiç ihtiyacı
-- yok (hiçbir anon-context kod onu okumuyor) — kapattık. `authenticated` ise
-- moderatör panelinin KENDİ `.gt('audit_score', 30)` WHERE filtresi için
-- KALMALI (bkz. lib/auth.ts-benzeri ders: WHERE'de geçen kolon da SELECT
-- grant'ı ister, select listesinde olmasa bile).
revoke select (audit_score) on public.listings from anon;

-- =============================================================================
-- BÖLÜM 2 — KOD TARAFI
-- =============================================================================
-- `app/moderator/page.tsx::getIlanlar()` bu kolonu doğrudan (anon key +
-- authenticated JWT'li) istemciden select ediyordu — revoke sonrası bu sorgu
-- TAMAMEN patlardı (contact_phone'un SPRINT_01 L1e'de yaşadığının aynısı).
-- Aynı desen tekrarlandı:
--   1. `app/moderator/actions.ts` → yeni `ilanAuditGetir(ids)` server action'ı,
--      `ilanTelefonlariGetir()`'in birebir kopyası (requireStaff + getServiceSupabase
--      + toplu `.in('id', ids)` + harita).
--   2. `getIlanlar()`: ana select'ten `internal_audit_logs` çıkarıldı; liste
--      çekildikten sonra `ilanTelefonlariGetir` ile PARALEL (`Promise.all`)
--      `ilanAuditGetir` çağrılıp sonuç satırlara `internal_audit_logs` olarak
--      geri birleştiriliyor. `audit_score` select'te KALDI (WHERE filtresi +
--      ekranda "riskli" sıralaması için hâlâ gerekli, authenticated grant'ı
--      duruyor).
--
-- Diğer tüketiciler taranıp ETKİLENMEDİĞİ doğrulandı:
--   - `app/panel/page.tsx` — zaten `getServiceSupabase()` (svc) kullanıyor.
--   - `app/api/moderator/toplu-islem/route.ts` — zaten `getServiceSupabase()`.
--   - `app/api/ilan/duzelt/route.ts` — zaten `getServiceSupabase()`, yalnız yazıyor.
--   - `app/ilan/[id]/page.tsx`, `app/api/ilanlar/[id]/route.ts` — `audit_score`
--     okuyor ama İKİSİ DE service role client kullanıyor, grant'tan etkilenmez.
--
-- DERS (7-8 Ağu'nun aynısı, ikinci kez): bir kolonu kısıtlamadan önce
-- `grep -rn "<kolon>"` ile TÜM tüketicileri bulup hangi client (anon/
-- authenticated/service) kullandıklarını tek tek doğrula — "bulduğum ihtiyaç"
-- ile "var olan ihtiyaç" aynı şey değil.
--
-- Kod tarafı: `tsc --noEmit` temiz, gerçek `next build` temiz (8 Ağu 2026).

-- =============================================================================
-- BÖLÜM 3 — DOĞRULAMA (8 Ağu 2026, gerçekten çalıştırıldı, hepsi ROLLBACK'li)
-- =============================================================================
-- 3.1 anon artık okuyamıyor
begin; set local role anon;
select internal_audit_logs from public.listings limit 1;
rollback;
-- SONUÇ: 42501 permission denied ✅

-- 3.2 authenticated (moderatör dâhil) da okuyamıyor — servis rolü zorunlu
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.users where role in ('moderator','admin') limit 1), true);
set local role authenticated;
select internal_audit_logs from public.listings limit 1;
rollback;
-- SONUÇ: 42501 permission denied ✅ (artık yalnız ilanAuditGetir/service role okuyor)

-- 3.3 moderatör panelinin KENDİ sorgu şekli hâlâ çalışıyor (audit_score WHERE + select)
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.users where role in ('moderator','admin') limit 1), true);
set local role authenticated;
select id, audit_score, is_shadow_banned from public.listings
where audit_score > 30 and moderation_status <> 'archived' limit 3;
rollback;
-- SONUÇ: 3 satır döndü, hatasız ✅
