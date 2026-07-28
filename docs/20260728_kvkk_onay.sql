-- SPRINT_01 K1 — KVKK açık rıza kaydı
-- Bayram: Supabase SQL Editor'de çalıştır.
--
-- Neden: profil-tamamla formu TCKN/VKN/telefon topluyor ama açık rıza alınmıyordu.
-- Onay anını kalıcı olarak saklıyoruz (denetim talebinde kanıt).

alter table public.users
  add column if not exists kvkk_onay_at timestamptz;

comment on column public.users.kvkk_onay_at is
  'KVKK aydınlatma metni ve kullanım koşullarının onaylandığı an. NULL = onay alınmamış (eski kayıt).';

-- İstemci bu kolonu YAZABİLMELİ (profil-tamamla upsert'i buraya yazıyor) ama
-- geçmişe dönük silememeli. Kolon bazlı yetki denetimi için:
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name = 'users' and column_name = 'kvkk_onay_at';

-- Mevcut kullanıcılar için raporlama: onayı olmayan aktif hesaplar
--   select count(*) from public.users
--   where kvkk_onay_at is null and user_type is not null and merged_into is null;
--
-- NOT: Eski kullanıcılardan onay toplamak ayrı bir iş (SPRINT_01'de yok).
-- Panele bir kereye mahsus onay modalı gerekiyor — yeni ticket açılmalı.
