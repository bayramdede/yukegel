-- ============================================================================
-- #42 TAKİBİ — AYRAÇ ENVANTERİ
-- 5 Ağustos 2026
-- ============================================================================
--
-- ÖN KOŞUL: `olcum42` şeması ayakta olmalı. Düşürdüysen önce
-- `docs/20260805_no_lane_format_olcumu.sql`'i tekrar çalıştır (idempotent).
--
-- NİYE BU İKİNCİ ÖLÇÜM: İlk ölçümün BÖLÜM 5b'si "ayraçsız kova C = 186" dedi.
-- 🚨 O SAYI ŞİŞKİN, ve sebebi benim hatam: 5b'nin regex'i yalnız
--    `➡ -> → ⇒ ⟶ —> ➜ ➔` ve tire aradı. Ama örneklerde ayraç olarak
--    `👉` `▶️` `📍` `/` `=` de kullanılıyor. Bunları aramadığım için o satırlar
--    "ayraçsız" sayıldı. Yani 186, "ok yok" değil "BENİM BAKTIĞIM ok yok".
--
-- 🐛 Ayrıca kaynak doğrulandı (hexdump, iddia değil):
--      const ARROW_RE = /➡️|->|→|⇒|⟶|—>|➜|➔/
--      e2 9e a1 ef b8 8f  =  ➡ (U+27A1) + VS16 (U+FE0F)
--    Yani listedeki ok VARIATION SELECTOR'LI. `➡️` tutar, ÇIPLAK `➡` TUTMAZ.
--    İlk ölçümde ben çıplak `➡` aradım — o yüzden `ok_var=74` sayısı da
--    ayrıştırıcının gerçekte tanıdığından BÜYÜK. Aşağıda ikisi ayrı sayılıyor.
--
-- Bu dosya TEK soruyu ayırıyor:
--   👉 Kova C'nin ne kadarı "ayraç listesi eksik" (ucuz, mekanik düzeltme),
--      ne kadarı gerçekten "oksuz alt alta satır" (pahalı, yapısal iş)?
-- ============================================================================

-- Gerçek ARROW_RE — index.ts:208'in birebir karşılığı, VS16 dahil.
create or replace function olcum42.ok_gercek(t text) returns boolean
language sql immutable as $$
  select t ~ (chr(10145) || chr(65039) || '|->|→|⇒|⟶|—>|➜|➔')
$$;

-- Kodun TANIMADIĞI ayraçlar.
create or replace function olcum42.ok_tanimsiz(t text) returns boolean
language sql immutable as $$
  select t ~ (chr(10145) || '(?!' || chr(65039) || ')')   -- çıplak ➡ (VS16'sız)
      or t ~ chr(128073)                                   -- 👉
      or t ~ chr(9654)                                     -- ▶ / ▶️
      or t ~ chr(128205)                                   -- 📍
      or t ~ chr(11015)                                    -- ⬇
      or t ~ '[[:alpha:]][[:space:]]*/[[:space:]]*[[:alpha:]]'  -- MERSİN/VAN
      or t ~ '[[:alpha:]][[:space:]]*=+[[:space:]]*[[:alpha:]]' -- KIZILTEPE==OSMANİYE
$$;

-- Kodun tanıdığı tire ayraçları (index.ts:209 DASH_RE + bitişik tire).
create or replace function olcum42.tire_var(t text) returns boolean
language sql immutable as $$
  select t ~ '[[:space:]][-–—~][[:space:]]'
      or t ~ '[[:alpha:]][-–—][[:alpha:]]'
$$;


-- ============================================================================
-- BÖLÜM 9 — Kova C, ayraç sınıfına göre. Sınıflar ÖRTÜŞÜR; toplam 318 etmez.
-- ============================================================================
select 'BÖLÜM 9 — kova C ayraç envanteri' as bolum,
       count(*)                                              as kova_c,
       count(*) filter (where olcum42.ok_gercek(raw_text))   as ok_TANINAN,
       count(*) filter (where raw_text ~ (chr(10145) || '(?!' || chr(65039) || ')'))
                                                             as ciplak_ok_27a1,
       count(*) filter (where raw_text ~ chr(128073))        as isaret_parmagi,
       count(*) filter (where raw_text ~ chr(9654))          as ucgen_play,
       count(*) filter (where raw_text ~ chr(128205))        as pin,
       count(*) filter (where raw_text ~ chr(11015))         as asagi_ok,
       count(*) filter (where raw_text ~ '[[:alpha:]][[:space:]]*/[[:space:]]*[[:alpha:]]')
                                                             as slash,
       count(*) filter (where raw_text ~ '[[:alpha:]][[:space:]]*=+[[:space:]]*[[:alpha:]]')
                                                             as esittir,
       count(*) filter (where olcum42.tire_var(raw_text))    as tire
from olcum42.olcum where kume = 'hedef' and yer >= 2;


-- ============================================================================
-- BÖLÜM 9b — 👉 ASIL KARAR SAYISI.
--   `sadece_tanimsiz` = kodun tanıdığı HİÇBİR ayraç yok, ama tanımadığı ayraç
--                       VAR. Bunlar ayraç listesine ekleme yapınca düzelir.
--                       Ucuz iş, ölçülebilir getiri.
--   `hakiki_ayracsiz`  = hiçbir ayraç yok. "Oksuz alt alta" sınıfının GERÇEK
--                       boyutu. Pahalı, yapısal iş (satır komşuluğu çıkarımı).
-- ============================================================================
select 'BÖLÜM 9b — ucuz mu pahalı mı' as bolum,
       count(*)                                                          as kova_c,
       count(*) filter (where olcum42.ok_gercek(raw_text)
                          or olcum42.tire_var(raw_text))                 as kod_zaten_goruyor,
       count(*) filter (where not olcum42.ok_gercek(raw_text)
                          and not olcum42.tire_var(raw_text)
                          and olcum42.ok_tanimsiz(raw_text))             as sadece_tanimsiz,
       count(*) filter (where not olcum42.ok_gercek(raw_text)
                          and not olcum42.tire_var(raw_text)
                          and not olcum42.ok_tanimsiz(raw_text))         as hakiki_ayracsiz
from olcum42.olcum where kume = 'hedef' and yer >= 2;


-- ============================================================================
-- BÖLÜM 9c — HAKİKİ AYRAÇSIZ satırlar nasıl görünüyor?
-- Ayraç eklemenin dokunamadığı kalıntı bu. Desteklenip desteklenmeyeceğine
-- sayıya değil BUNLARA bakarak karar verilecek.
-- ============================================================================
select 'BÖLÜM 9c — hakiki ayraçsız örnekler' as bolum,
       yer,
       replace(left(raw_text, 240), chr(10), ' ⏎ ') as metin
from olcum42.olcum
where kume = 'hedef' and yer >= 2
  and not olcum42.ok_gercek(raw_text)
  and not olcum42.tire_var(raw_text)
  and not olcum42.ok_tanimsiz(raw_text)
order by random() limit 25;


-- ============================================================================
-- BÖLÜM 9d — KOD ZATEN GÖRÜYOR ama şerit kurulamıyor. En rahatsız edici küme:
-- ayraç tanınıyor, iki yer de tanınıyor, yine de `no_lane`. Buradaki sebep
-- ayraç listesi DEĞİL — `splitByRelation` sonrası bir şey. Ayrı kazı gerekir.
-- ============================================================================
select 'BÖLÜM 9d — ayraç tanınıyor ama yine no_lane' as bolum,
       yer,
       replace(left(raw_text, 240), chr(10), ' ⏎ ') as metin
from olcum42.olcum
where kume = 'hedef' and yer >= 2
  and (olcum42.ok_gercek(raw_text) or olcum42.tire_var(raw_text))
order by random() limit 20;
