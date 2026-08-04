// scripts/test-districts.mts — `npm run test:districts`
//
// 🚨 TEK KAYNAK KONTROLÜ (20260731_districts_tablosu.sql § 4.3).
// `public.districts` tablosunun verisi `docs/20260731_districts_tablosu.sql`
// içindeki INSERT bloğundan geliyor; o blok da `lib/constants/locations.json`
// üzerinden üretildi. İkisi AYRIŞIRSA hiçbir yerde patlamaz — `ilce_resmi()`
// sessizce yanlış cevap verir, `district_official` yanlış dolar, ilanlar
// "resmi değil" damgası yer. Bu test o ayrışmayı yakalar.
//
// ⚠️ KAPSAM SINIRI: bu test JSON ile MIGRATION DOSYASINI karşılaştırır, canlı
//    tabloyu DEĞİL (kasıtlı: kimlik bilgisi istemesin, CI'da çalışsın).
//    Canlı tabloya elle satır eklenirse buradan görünmez — `provinces` ile aynı
//    kural geçerli: **elle satır ekleme YAPMA**, JSON'u düzenle ve bloğu yeniden
//    üret. Sayı kontrolü için: `select count(*) from public.districts` → 973.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');

let hata = 0;
const ok = (ad: string, kosul: boolean) => { if (!kosul) { console.log('❌', ad); hata++; } else console.log('✓', ad); };

type Il = { id: number; plate: string; name: string; districts: string[] };
const JSON_ILLER: Il[] = JSON.parse(readFileSync(join(kok, 'lib/constants/locations.json'), 'utf8'));

// ── SQL INSERT bloğunu ayrıştır ─────────────────────────────────────────────
// Beklenen biçim:  insert into public.districts (province_id, name) values
//                    ( 1, 'Aladağ'),
//                    …
//                  on conflict do nothing;
const sql = readFileSync(join(kok, 'docs/20260731_districts_tablosu.sql'), 'utf8');
const bas = sql.indexOf('insert into public.districts (province_id, name) values');
const son = sql.indexOf('on conflict do nothing;', bas);
ok('SQL INSERT bloğu bulundu', bas !== -1 && son > bas);
if (bas === -1 || son <= bas) { console.log('\n❌ Blok yok — dosya yeniden düzenlenmiş olabilir'); process.exit(1); }

const govde = sql.slice(sql.indexOf('\n', bas) + 1, son);
const satirlar = govde.split('\n').map(s => s.trim()).filter(s => s !== '' && !s.startsWith('--'));
const SQL_CIFT: Array<[number, string]> = [];
let bozuk = 0;
for (const s of satirlar) {
  // ( 34, 'Kadıköy'),   — ad içinde tek tırnak kaçışı yok, olsaydı burada patlardı
  const m = /^\(\s*(\d+)\s*,\s*'([^']*)'\s*\),?$/.exec(s);
  if (m) SQL_CIFT.push([Number(m[1]), m[2]]);
  else bozuk++;
}
ok('INSERT bloğunda ayrıştırılamayan satır yok', bozuk === 0);

// ── 1. Kaba sayılar ─────────────────────────────────────────────────────────
const JSON_TOPLAM = JSON_ILLER.reduce((a, p) => a + p.districts.length, 0);
ok('SQL 973 ilçe', SQL_CIFT.length === 973);
ok('JSON 973 ilçe', JSON_TOPLAM === 973);
ok('SQL 81 farklı il', new Set(SQL_CIFT.map(c => c[0])).size === 81);
ok('SQL province_id 1..81 aralığında', SQL_CIFT.every(([id]) => id >= 1 && id <= 81));

// ── 2. Çift yönlü küme karşılaştırması ──────────────────────────────────────
// Ayrıştırma değil TAM METİN eşitliği: `Marmaraereğlisi` ↔ `Marmara Ereğlisi`
// farkı da, `İ`/`I` farkı da hata sayılmalı. Tablodaki UNIQUE index katlanmış
// ad üzerinde ama `ilce_resmi()` kullanıcıya ham adı göstermiyor — yine de
// JSON tek kaynak, birebir aynı olmalılar.
const anahtar = (id: number, ad: string) => `${id}|${ad}`;
const sqlKume = new Set(SQL_CIFT.map(([id, ad]) => anahtar(id, ad)));
const jsonKume = new Set(JSON_ILLER.flatMap(p => p.districts.map(d => anahtar(p.id, d))));

ok('SQL içinde (il, ilçe) kopyası yok', sqlKume.size === SQL_CIFT.length);
ok('JSON içinde (il, ilçe) kopyası yok', jsonKume.size === JSON_TOPLAM);

const sqldeVarJsondaYok = [...sqlKume].filter(k => !jsonKume.has(k));
const jsondaVarSqldeYok = [...jsonKume].filter(k => !sqlKume.has(k));
ok('SQL\'de olup JSON\'da olmayan yok', sqldeVarJsondaYok.length === 0);
ok('JSON\'da olup SQL\'de olmayan yok', jsondaVarSqldeYok.length === 0);

// ── 3. il_key() katlaması altında çakışma var mı ────────────────────────────
// `districts_il_key_uniq` index'i (province_id, il_key(name)) üzerinde. JSON'da
// aynı il içinde katlandığında çakışan iki ilçe olursa INSERT'in
// `on conflict do nothing`'i satırı SESSİZCE YUTAR — 973 beklerken 972 gelir.
// 🚨 `İ` → 'i' değişimi `toLowerCase()`ten ÖNCE olmalı (public.il_key ile aynı).
const ilKey = (s: string) => s.replace(/İ/g, 'i').toLowerCase().trim();
const katlamaCakismasi: string[] = [];
for (const p of JSON_ILLER) {
  const g = new Set<string>();
  for (const d of p.districts) {
    const k = ilKey(d);
    if (g.has(k)) katlamaCakismasi.push(`${p.name}: ${d}`);
    g.add(k);
  }
}
ok('il_key katlaması altında il içi çakışma yok', katlamaCakismasi.length === 0);

// ── 4. Bilinen çapa değerler ────────────────────────────────────────────────
// Rastgele değil: her biri bir kez kafa karıştırdı.
const varMi = (id: number, ad: string) => sqlKume.has(anahtar(id, ad));
ok('çapa — İstanbul/Çekmeköy var, İstanbul/Ömerli YOK (mahalle)',
  varMi(34, 'Çekmeköy') && !varMi(34, 'Ömerli'));
ok('çapa — Gölbaşı hem Ankara hem Adıyaman ilçesi',
  varMi(6, 'Gölbaşı') && varMi(2, 'Gölbaşı'));
ok('çapa — Gebze Kocaeli\'nde, İstanbul\'da değil',
  varMi(41, 'Gebze') && !varMi(34, 'Gebze'));
ok('çapa — Havza Samsun ilçesi, Amasya değil (4 Ağu alias hatası)',
  varMi(55, 'Havza') && !varMi(5, 'Havza'));
ok('çapa — Orhaneli Bursa ilçesi, Sakarya değil (4 Ağu alias hatası)',
  varMi(16, 'Orhaneli') && !varMi(54, 'Orhaneli'));
ok('çapa — Selimpaşa hiçbir ilin ilçesi değil (Silivri mahallesi)',
  ![...sqlKume].some(k => ilKey(k.split('|')[1]) === ilKey('Selimpaşa')));
ok('çapa — Tekirdağ\'da Marmaraereğlisi bitişik yazılıyor',
  varMi(59, 'Marmaraereğlisi') && !varMi(59, 'Marmara Ereğlisi'));
ok('çapa — 51 ilde Merkez',
  SQL_CIFT.filter(([, ad]) => ad === 'Merkez').length === 51);

if (sqldeVarJsondaYok.length) console.log('\n  SQL fazlası:', sqldeVarJsondaYok.slice(0, 20).join(' · '));
if (jsondaVarSqldeYok.length) console.log('\n  JSON fazlası:', jsondaVarSqldeYok.slice(0, 20).join(' · '));
if (katlamaCakismasi.length) console.log('\n  Katlama çakışması:', katlamaCakismasi.join(' · '));

console.log(hata === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
