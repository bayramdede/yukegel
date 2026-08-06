// scripts/test-pass2.mts — `npm run test:pass2`
//
// 🚨 NE KORUYOR: `parse-listing/index.ts::parseMessage` Pass 2 ("YÜKLEMELİ blok").
//    Pass 2, "ŞEHİR YÜKLEME" satırını blok kökeni sayıp altındaki satırları varış
//    kabul eder. İki ayrı hata bloğu sessizce koparıyordu (#88, 6 Ağu 2026):
//
//    #88-A  `isYuklemeli` yalnız "yukle" ALT DİZİSİNE bakar. "yüklenmez",
//           "yüklenir", "yükleme üstene birşey konulmaz" gibi DOLGU satırları da
//           ateşliyor; o satırda yer olmadığı için `blockOrigin` NULL'lanıyordu.
//    #88-B  Reset koşulundaki `splitByRelation(line) !== null`, BLOCK_RESET_RE'nin
//           bilinçle dışarıda bıraktığı BOŞLUKSUZ tireyi geri sokuyordu:
//           "(KISA-UZUN) DORSE" → rel:'dash_nospace' → blok resetleniyordu.
//
// ⚠️ TEST FONKSİYONU ELLE KOPYALANMAZ — `index.ts`ten çalışma anında sökülür.
//    Sebebi #86'nın acı dersi: elle kopyalanan bir regex zinciri, hatanın
//    BULUNDUĞU satırı hiç çalıştırmadan 17/17 geçmişti. Bkz. test-clean-message.mts.
//
// 🧪 MUTASYON DENEYİ: `index.ts`i /tmp'ye kopyala, #88-A veya #88-B düzeltmesini
//    geri al, testi ona doğrult: `KAYNAK_INDEX=/tmp/mut/index.ts npm run test:pass2`.
//    Testin GEÇMESİ değil, o kopyada DÜŞMESİ beklenir.
//
// 📌 ALIAS'LAR SENTETİKTİR — canlı `aliases` tablosundan taşınmaz. Bu bir BİRİM
//    testidir: "şu metin + şu alias kümesi → şu şerit". Canlı alias kapsamasını
//    ölçmez; onu `npm run olc:88` yapar.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const KAYNAK = process.env.KAYNAK_INDEX
  ? resolve(process.env.KAYNAK_INDEX)
  : resolve(import.meta.dirname, '../supabase/functions/parse-listing/index.ts');

function kaynaktanSok(): string {
  const s = readFileSync(KAYNAK, 'utf8').split('\n');
  const bas = s.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const pm = s.findIndex(l => l.startsWith('function parseMessage'));
  if (bas < 0 || pm < 0) throw new Error('index.ts imzaları bulunamadı — biçim değişmiş olabilir');
  let son = -1;
  for (let i = pm + 1; i < s.length; i++) if (s[i] === '}') { son = i; break; }
  if (son < 0) throw new Error('parseMessage sonu bulunamadı');
  return s.slice(bas, son + 1).join('\n') + '\nexport { parseMessage, cleanMessage }\n';
}

const dizin = mkdtempSync(join(tmpdir(), 'pass2-'));
const gecici = join(dizin, 'sokulen.mts');
writeFileSync(gecici, kaynaktanSok(), 'utf8');
const { parseMessage, cleanMessage } = await import(gecici) as {
  parseMessage: (m: string, a: any[]) => { lanes: any[] };
  cleanMessage: (s: string) => string;
};

// ── Sentetik alias kümesi ─────────────────────────────────────────────────────
const A = (id: number, alias: string, normalized: string, priority: number, district: string | null) =>
  ({ id, type: 'city', alias, normalized, priority, district, is_active: true });
const ALIAS = [
  A(1, 'Manisa', 'Manisa', 90, null), A(2, 'Turgutlu', 'Manisa', 50, 'Turgutlu'),
  A(3, 'Kula', 'Manisa', 90, 'Kula'), A(4, 'Akşehir', 'Konya', 65, 'Akşehir'),
  A(5, 'Van', 'Van', 90, null), A(6, 'Başkale', 'Van', 90, 'Başkale'),
  A(7, 'Silivri', 'İstanbul', 90, null), A(8, 'Kemerburgaz', 'İstanbul', 60, null),
  A(9, 'Ankara', 'Ankara', 90, null), A(10, 'İzmir', 'İzmir', 90, null),
  A(11, 'Bursa', 'Bursa', 90, null), A(12, 'Konya', 'Konya', 90, null),
];

// ── Koşum ─────────────────────────────────────────────────────────────────────
let hata = 0;
const gz = (l: any) => `${l.from}${l.fromDistrict ? '/' + l.fromDistrict : ''}→${l.to}${l.toDistrict ? '/' + l.toDistrict : ''}`;

function ok(ad: string, metin: string, beklenen: string[]) {
  let alinan: string[];
  try { alinan = parseMessage(cleanMessage(metin), ALIAS).lanes.map(gz); }
  catch (e: any) { hata++; console.log(`❌ ${ad}: PATLADI — ${e.message}`); return; }
  const a = [...alinan].sort().join(' , ');
  const b = [...beklenen].sort().join(' , ');
  if (a === b) console.log(`✓ ${ad.padEnd(46)} ${a || '(şerit yok)'}`);
  else {
    hata++;
    console.log(`❌ ${ad}\n     beklenen: ${b || '(şerit yok)'}\n     alınan  : ${a || '(şerit yok)'}`);
  }
}

console.log('\n── #88-A: yer içermeyen "yükle*" satırı bloğu BOZMAMALI ──');
ok('"Yüklemeli Parça Aracı" şablonu',
  'Yüklemeli Parça Aracı  Kamyon TIR\n' +
  'Yükleme Yeri Kula / Manisa\n' +
  '1 Kapak yer Yanyana yükleme üstene birşey konulmaz.\n' +
  'Toplam 1100kg\n' +
  'Teslim Yeri Merkez veya Başkale / Van\n' +
  '0 532 203 43 81',
  ['Manisa/Kula→Van/Başkale']);

ok('"üstuste yüklenmez" dolgusu',
  'Yükleme Yeri Silivri\n' +
  '2 koli 55*50*50 üstuste yüklenmez.\n' +
  'Teslim Yeri Ankara',
  ['İstanbul→Ankara']);

ok('"3 üstü yüklenir" dolgusu',
  'Yükleme Yeri Kula\n' +
  '6 Adet palet 120*235*130 3 tabana 3 üstü yüklenir\n' +
  'Teslim Yeri Van',
  ['Manisa/Kula→Van']);

console.log('\n── #88-B: yer içermeyen boşluksuz-tire satırı bloğu BOZMAMALI ──');
ok('"(KISA-UZUN) DORSE" araya girer',
  'MANİSA TURGUTLU  YÜKLEMELİ\n(KISA-UZUN) DORSE\nAKŞEHİR TIR\nHEVES NAKLİYAT',
  ['Manisa→Konya/Akşehir']);

ok('yersiz tireli tarif satırı (PEŞİN-VADELİ)',
  'SİLİVRİ YÜKLEME\nPEŞİN-VADELİ ÖDEME\nANKARA',
  ['İstanbul→Ankara']);

console.log('\n── KORUMA: resetlemesi GEREKEN satırlar hâlâ resetliyor ──');
ok('yer içeren boşluksuz tire bloğu KESER',
  'SİLİVRİ YÜKLEME\nBURSA-İZMİR\nANKARA',
  ['Bursa→İzmir']);           // Pass 1 Bursa→İzmir'i alır; Silivri→Ankara DOĞMAMALI

ok('boşluklu tire bloğu KESER',
  'SİLİVRİ YÜKLEME\nA - B\nANKARA',
  []);

ok('ok satırı bloğu KESER',
  'SİLİVRİ YÜKLEME\nBURSA -> İZMİR\nANKARA',
  ['Bursa→İzmir']);

console.log('\n── KORUMA: mevcut Pass 2 davranışı bozulmadı ──');
ok('Yükleme/Boşaltma çifti — farklı il',
  'MİLTRANS\nYÜKLER-BOŞALTIR\nYükleme ; SİLİVRİ\nBoşaltma : ANKARA\nARAÇ BİLGİSİ : TENTELİ TIR',
  ['İstanbul→Ankara']);

// 📌 GERÇEK DAVRANIŞ, HATA DEĞİL: iki uç da İstanbul'a çözülüyor ve İKİSİNİN DE
//    `district`i NULL → `isDiff` false → şerit yok. Canlıda `Kemerburgaz` alias'ı
//    da district'siz (normalized=İstanbul, district=null), yani `4ec36229` satırı
//    Pass 2 hatası yüzünden değil, ALIAS'ta ilçe olmadığı için şeritsiz kalıyor.
//    Ayrı iş: şehiriçi güzergâhın doğması için alias'a ilçe girilmeli (#42/Kova A).
ok('Yükleme/Boşaltma — aynı il, ilçesiz alias → şerit YOK',
  'Yükleme ; SİLİVRİ\nBoşaltma : KEMERBURGAZ',
  []);

ok('tek satırda köken+varış',
  'Orhanlı yükleme Ankara indirme tır 330 yer',
  []);                        // Orhanlı alias'ı sentetik kümede YOK → şerit yok (beklenen)

ok('yer bulunmayan tamamen alakasız metin', 'MERHABA ARKADAŞLAR NASILSINIZ', []);

console.log(hata === 0 ? `\n✅ hepsi geçti` : `\n❌ ${hata} test başarısız`);
process.exit(hata === 0 ? 0 : 1);
