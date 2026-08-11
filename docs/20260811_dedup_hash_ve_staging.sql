-- ============================================================================
-- Birleşik Mükerrer Hash'i (Bayram, 11 Ağu 2026)
-- ============================================================================
-- Gerekçe: `lib/dedup.ts` başlığındaki not. Eski `mukerrerBul()` yalnız
-- (kullanıcı, tip, kalkış/varış il+ilçe, tarih) beşlisine bakıyordu — Bayram'ın
-- "her şeyiyle aynı" tanımına uymuyordu. Yeni sistem telefon + tam rota +
-- araç/kasa tipleri + toplam ton/palet + tarihi TEK bir SHA-256'da eritiyor.
--
-- KAPSAM: yalnız `lib/ilan-yaz.ts::ilanYaz()` üzerinden geçen yollar (tekil
-- form/whatsapp-bot/facebook girişi + Excel toplu yükleme). WhatsApp/Facebook
-- TOPLU sohbet aktarımı (raw_posts → parse-listing Edge Function) bu koda HİÇ
-- dokunmuyor, ayrı bir runtime — kapsam dışı, bilinçli.
-- ============================================================================

begin;

-- ── 1) listings.dedup_hash ───────────────────────────────────────────────────
alter table public.listings
  add column dedup_hash text;

comment on column public.listings.dedup_hash is
  'lib/dedup.ts::dedupHashHesapla() çıktısı — telefon+tam rota+araç/kasa+toplam ton/palet+tarih SHA-256''si. NULL = migration öncesi eski kayıt.';

-- Yalnız dolu satırlarda anlamlı; sorgu deseni `eq(dedup_hash, X)` — kısmi
-- indeks NULL satırları (çoğunluk, geçmiş kayıtlar) indeks dışı bırakır.
create index listings_dedup_hash_idx on public.listings (dedup_hash)
  where dedup_hash is not null;

-- ── 2) excel_dedup_staging ───────────────────────────────────────────────────
-- Excel toplu yüklemede hash'i DB'de zaten var olan bir satırla eşleşen
-- grup buraya düşer — `listings`e YAZILMAZ, moderatör "gerçekten mükerrer mi,
-- yoksa araç/tonaj farklı mı" diye karar verene kadar bekler.
create table public.excel_dedup_staging (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id),
  sefer_no            text,
  -- Onaylanırsa `ilanYaz()`e AYNEN geçirilecek girdi (OnaySatiri grubu +
  -- çözümlenmiş tarih) — moderatör "onayla" dediğinde satırı yeniden
  -- ayrıştırmak yerine bu jsonb doğrudan kullanılır.
  girdi               jsonb not null,
  dedup_hash          text not null,
  -- Hangi MEVCUT ilanla çakıştığı — moderatör ekranında karşılaştırma linki.
  matched_listing_id  uuid references public.listings(id),
  status              text not null default 'bekliyor'
                        check (status in ('bekliyor', 'onaylandi', 'reddedildi')),
  created_at          timestamptz not null default now(),
  reviewed_by         uuid references public.users(id),
  reviewed_at         timestamptz,
  -- Moderatör "mükerrer değil" deyip onayladığında GERÇEKTEN yazılan ilan.
  created_listing_id  uuid references public.listings(id)
);

comment on table public.excel_dedup_staging is
  'Excel toplu yüklemede dedup_hash çakışması yüzünden listings''e yazılmayan gruplar. Moderatör onaylar/reddeder — bkz. app/moderator sekmesi "Mükerrer Excel".';

create index excel_dedup_staging_bekleyen_idx on public.excel_dedup_staging (created_at)
  where status = 'bekliyor';
create index excel_dedup_staging_user_idx on public.excel_dedup_staging (user_id);

-- ── 3) Grant sertleştirmesi İLK GÜNDEN ───────────────────────────────────────
-- 🚨 §9 dersi (11 Ağu 2026, deals/reviews): Supabase yeni tabloya anon/
-- authenticated'a SELECT DIŞINDA HER ŞEYİ (INSERT/UPDATE/DELETE/TRUNCATE)
-- otomatik grant eder. Bu tabloya YAZAN tek yol `getServiceSupabase()`
-- (excel-import route + moderator actions) — istemciden ne okuma ne yazma
-- olmalı, o yüzden ikisi de kapatılıyor (RLS de ayrıca varsayılan-reddet).
revoke all on public.excel_dedup_staging from anon, authenticated;

alter table public.excel_dedup_staging enable row level security;
-- Policy KASITLI YOK — RLS "policy yoksa reddet" varsayılanı + yukarıdaki
-- REVOKE iki katmanlı savunma. Servis rolü ikisini de bypass eder.

-- Doğrulama: aşağıdaki sorgu HİÇBİR satır dönmemeli.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'excel_dedup_staging'
  and grantee in ('anon', 'authenticated');

commit;
