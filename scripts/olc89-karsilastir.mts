// scripts/olc89-karsilastir.mts — `npm run olc:89`
//
// 🚨 NE ÖLÇER: #89-A (`findPlaces` dedup'ının Set→Map yükseltmesi) canlı trafikte
//    ŞERİT KAYBETTİRİYOR MU? Deploy kapısı budur.
//
// ❗ NEDEN OFFLINE: sandbox'tan supabase.co'ya ağ YOK (curl → 000; npm registry → 200).
//    Bu yüzden `olc:87` gibi canlıya vurulamıyor. Ham metin + ilgili alias kümesi
//    `execute_sql` ile dışa aktarıldı, iki parser YEREL koşuluyor.
//      • scripts/olc89-ornek-a.json   — son 36 saatten 35 gerçek çok-satırlı ilan
//      • scripts/olc89-alias.json     — bu örneğe DOKUNAN 362 aktif alias
//        biçim: ["type", alias, normalized, priority, district, bayrak]
//        bayrak 0 = değişmedi, 1 = #89-B ilçesini DOLDURDU, 2 = #89-B YENİ ekledi
//
// 🧪 ÜÇ KOŞUM, iki ayrı değişikliği AYIRMAK için:
//      ESKİ  = /tmp/mut-89a/index.ts (mutant: yükseltme yok) + ESKİ alias
//      KOD   = /tmp/mut-89a/index.ts                          + YENİ alias
//      YENİ  = supabase/functions/parse-listing/index.ts       + YENİ alias
//    KOD→YENİ farkı SADECE #89-A kodudur; deploy kararı bu sütuna bakar.
//    ESKİ→YENİ farkı uçtan uca (#89-A + #89-B) toplam etkidir; dokümana bu yazılır.
//
// ⚠️ Parser ELLE KOPYALANMAZ — iki index.ts'ten de çalışma anında sökülür (#86 dersi).
//
// 📌 KAPI: KOD→YENİ geçişinde AÇIKLANAMAYAN şerit kaybı 0 olmalı. Tek kabul edilen
//    kayıp türü DEDUP BİRLEŞMESİ: `Ankara|null→Konya` ile `Ankara|Gölbaşı→Konya`
//    ilçe dolunca aynı `laneKey`e düşer. Bu doğru davranış, gerileme değil.
//    Bunun dışındaki her kayıp deploy'u DURDURUR.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const KOK = resolve(import.meta.dirname, '..');
const YENI_KAYNAK = join(KOK, 'supabase/functions/parse-listing/index.ts');
const ESKI_KAYNAK = process.env.MUTANT ?? '/tmp/mut-89a/index.ts';

type Parser = {
  parseMessage: (m: string, a: any[]) => { lanes: any[] };
  cleanMessage: (s: string) => string;
};

function kaynaktanSok(dosya: string): string {
  const s = readFileSync(dosya, 'utf8').split('\n');
  const bas = s.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const pm = s.findIndex(l => l.startsWith('function parseMessage'));
  if (bas < 0 || pm < 0) throw new Error(`${dosya}: imzalar bulunamadı`);
  let son = -1;
  for (let i = pm + 1; i < s.length; i++) if (s[i] === '}') { son = i; break; }
  if (son < 0) throw new Error(`${dosya}: parseMessage sonu bulunamadı`);
  return s.slice(bas, son + 1).join('\n') + '\nexport { parseMessage, cleanMessage }\n';
}

const dizin = mkdtempSync(join(tmpdir(), 'olc89-'));
async function yukle(dosya: string, ad: string): Promise<Parser> {
  const p = join(dizin, ad + '.mts');
  writeFileSync(p, kaynaktanSok(dosya), 'utf8');
  return await import(p) as Parser;
}

const YENI = await yukle(YENI_KAYNAK, 'yeni');
const ESKI = await yukle(ESKI_KAYNAK, 'eski');

// ── Alias kümeleri ────────────────────────────────────────────────────────────
type Ham = [string, string, string, number, string | null, number];
const ham = JSON.parse(readFileSync(join(KOK, 'scripts/olc89-alias.json'), 'utf8')) as Ham[];

const yap = (h: Ham, district: string | null) =>
  ({ id: 0, type: h[0], alias: h[1], normalized: h[2], priority: h[3], district, is_active: true });

// YENİ alias durumu = tablodaki hâli (#89-B uygulanmış)
const ALIAS_YENI = ham.map(h => yap(h, h[4]));
// ESKİ alias durumu = #89-B geri alınmış: bayrak 2 satırları YOK, bayrak 1'in ilçesi null
const ALIAS_ESKI = ham.filter(h => h[5] !== 2).map(h => yap(h, h[5] === 1 ? null : h[4]));

// ── Örnek ─────────────────────────────────────────────────────────────────────
const ornek = JSON.parse(readFileSync(join(KOK, 'scripts/olc89-ornek-a.json'), 'utf8')) as [string, string][];

// ── Koşum ─────────────────────────────────────────────────────────────────────
const gz = (l: any) => `${l.from}${l.fromDistrict ? '/' + l.fromDistrict : ''}→${l.to}${l.toDistrict ? '/' + l.toDistrict : ''}`;

function kos(p: Parser, alias: any[], metin: string): string[] {
  try { return p.parseMessage(p.cleanMessage(metin), alias).lanes.map(gz); }
  catch (e: any) { return [`__PATLADI__ ${e.message}`]; }
}

const say = (xs: string[]) => { const m = new Map<string, number>(); for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1); return m; };
function fark(a: string[], b: string[]) {                       // a=önce, b=sonra
  const ma = say(a), mb = say(b);
  const kayip: string[] = [], kazanc: string[] = [];
  for (const [k, n] of ma) { const d = n - (mb.get(k) ?? 0); for (let i = 0; i < d; i++) kayip.push(k); }
  for (const [k, n] of mb) { const d = n - (ma.get(k) ?? 0); for (let i = 0; i < d; i++) kazanc.push(k); }
  return { kayip, kazanc };
}

// ── Kayıp sınıflandırması ─────────────────────────────────────────────────────
// ⚠️ İLK SÜRÜMDEKİ HATA: "il çifti aynı bir kazanç varsa DEDUP BİRLEŞMESİ" diyordum.
//    Yanlış etiket. `Bursa→Balıkesir` gidip `Bursa/İnegöl→Balıkesir` gelmesi bir
//    BİRLEŞME değil, aynı şeridin İLÇESİNİN DOLMASIDIR — düzeltmenin ta kendisi.
//    Gerçek birleşme ancak il çiftinin şerit SAYISI düşerse olur. Üç ayrı sınıf:
//      YÜKSELTME : il çifti aynı, ilçeler yalnız null→dolu. Sayı korunur.
//      BİRLEŞME  : aynı il çiftinde şerit sayısı azaldı (iki şerit tek laneKey'e düştü).
//      AÇIKLANAMAYAN : il çifti tamamen kayboldu. Deploy'u DURDURUR.
const iller = (s: string) => s.replace(/\/[^→]*/g, '');
/** Kaybolan şerit `k`, kazanılan `g`ye YÜKSELTİLMİŞ olabilir mi? */
function yukseltmeMi(k: string, g: string): boolean {
  if (iller(k) !== iller(g)) return false;
  const [ka, kb] = k.split('→'), [ga, gb] = g.split('→');
  const uc = (eski: string, yeni: string) => {
    const e = eski.split('/')[1] ?? null, y = yeni.split('/')[1] ?? null;
    return e === null || e === y;      // ilçe ya boştu ya da AYNI kaldı; asla DEĞİŞMEDİ
  };
  return uc(ka, ga) && uc(kb, gb);
}

let toplamEski = 0, toplamKod = 0, toplamYeni = 0;
let ilceEski = 0, ilceKod = 0, ilceYeni = 0;
let netKazanc = 0, aciklanamayanKayip = 0, birlesmeKayip = 0, yukseltme = 0;
const rapor: string[] = [];

const ilceli = (xs: string[]) => xs.filter(x => x.includes('/')).length;

for (const [id, metin] of ornek) {
  const A = kos(ESKI, ALIAS_ESKI, metin);   // ESKİ kod + ESKİ alias
  const B = kos(ESKI, ALIAS_YENI, metin);   // ESKİ kod + YENİ alias   (#89-B tek başına)
  const C = kos(YENI, ALIAS_YENI, metin);   // YENİ kod + YENİ alias   (#89-B + #89-A)

  toplamEski += A.length; toplamKod += B.length; toplamYeni += C.length;
  ilceEski += ilceli(A); ilceKod += ilceli(B); ilceYeni += ilceli(C);

  const f = fark(B, C);                     // ← DEPLOY KAPISI: sadece #89-A kodu
  netKazanc += f.kazanc.length - f.kayip.length;
  if (f.kayip.length || f.kazanc.length) {
    rapor.push(`\n▸ ${id}`);
    for (const g of f.kazanc) rapor.push(`   + ${g}`);
    // Her kaybı EN FAZLA BİR kazançla eşle: eşleşmemiş kazanç kalmazsa geri kalan
    // kayıplar gerçekten birleşmedir (il çifti duruyor ama şerit sayısı azaldı).
    const bos = [...f.kazanc];
    for (const k of f.kayip) {
      const i = bos.findIndex(g => yukseltmeMi(k, g));
      if (i >= 0) { bos.splice(i, 1); yukseltme++; rapor.push(`   - ${k}   (↑ ilçesi doldu — düzeltme)`); }
      else if (f.kazanc.some(g => iller(g) === iller(k))) { birlesmeKayip++; rapor.push(`   - ${k}   (birleşme — beklenen)`); }
      else { aciklanamayanKayip++; rapor.push(`   - ${k}   ⚠️ AÇIKLANAMAYAN`); }
    }
  }
}

console.log(`\n══ #89-Ö offline ölçüm — ${ornek.length} gerçek ilan, ${ham.length} alias ══`);
console.log(`\nŞerit sayısı   ESKİ(kod+alias eski) ${toplamEski}  →  #89-B ${toplamKod}  →  +#89-A ${toplamYeni}`);
console.log(`İlçeli şerit   ${ilceEski} (%${(100 * ilceEski / toplamEski).toFixed(1)})  →  ${ilceKod} (%${(100 * ilceKod / toplamKod).toFixed(1)})  →  ${ilceYeni} (%${(100 * ilceYeni / toplamYeni).toFixed(1)})`);
console.log(`\n── #89-A kodunun TEK BAŞINA etkisi (deploy kapısı) ──`);
console.log(`net şerit farkı : ${netKazanc >= 0 ? '+' : ''}${netKazanc}`);
console.log(`ilçe doluluk    : ${ilceKod} → ${ilceYeni}  (${ilceYeni - ilceKod >= 0 ? '+' : ''}${ilceYeni - ilceKod})`);
console.log(`↑ ilçesi dolan  : ${yukseltme}`);
console.log(`dedup birleşmesi: ${birlesmeKayip}`);
console.log(`AÇIKLANAMAYAN   : ${aciklanamayanKayip}`);
if (rapor.length) console.log(`\n── ilan bazında fark (#89-B sonrası → #89-A sonrası) ──${rapor.join('\n')}`);

const gecti = aciklanamayanKayip === 0 && ilceYeni >= ilceKod;
console.log(gecti
  ? `\n✅ KAPI AÇIK — açıklanamayan kayıp yok, ilçe doluluğu düşmüyor. Deploy edilebilir.`
  : `\n❌ KAPI KAPALI — deploy ETME.`);
process.exit(gecti ? 0 : 1);
