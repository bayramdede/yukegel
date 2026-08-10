// scripts/test-87.mts — `npm run test:87`
//
// 🚨 NE KORUYOR: `parse-listing/index.ts` — SOLU BOŞ OK satırı ("➡️SAMSUN").
//    Bu kalıp WhatsApp yük ilanlarının en yaygın biçimi: köken bir satırda,
//    varışlar altındaki ok satırlarında. 6 Ağu 2026'da ölçüldü: son 30 günün
//    6.724 `processed` satırının 293'ünde bu kalıp var, 133'ünde ok satırında
//    adı geçen varış HİÇBİR ŞERİTTE YOK. Karşılaştırma: #86'nın net kazancı
//    45, #88'inki 10 satırdı. Yani bu kanal ikisinin toplamından büyük — ve
//    daha kötü cinsten, çünkü satırlar `processed` görünüyor: kimse fark etmiyor.
//
//    ÜÇ kusur (numaralar YAPILACAKLAR.md ile aynı; C boşta — aşağıya bak):
//    #87-A `splitByRelation` ok kolunda `if (left && right)` şartı vardı. Sol
//          boş olduğu için satır İLİŞKİSİZ sayılıyordu → parseMessage'taki
//          "ok solunda şehir yoksa contextFrom kullan" yedeği ULAŞILAMAZ ÖLÜ
//          KODDU. Satır Pass 2/Pass 3/fallback'e düşüyor, orada sıra bağımlı
//          olarak ya varış düşüyor ya UYDURMA şerit doğuyordu.
//    #87-B Pass 1 kökeni: `rel.left.trim() ? bestPlace(...) : contextFrom`.
//          Sol DOLU ama içinde tanınan yer yoksa ("13.60 TIR -> ANKARA") satır
//          sessizce düşüyordu. `||` her iki boşluğu da kapatır.
//    #87-D Pass 1'in `+` kolu: `+` tek başına "çoklu varış" sayılıyordu. Fiyat
//          satırları da `+` içerir ("duzce 1200+kdv") → köken önceki satırdan
//          alınıp UYDURMA şerit doğuyordu. Artık en az İKİ parça tanınan bir
//          yere çözülmeli.
//
//    #87-C YAZILDI, ÖLÇÜLDÜ, GERİ ALINDI — Pass 2'nin blok reset koşuluna
//          "solu boş ok resetlemesin" muafiyeti. Mantıklı görünüyordu ama 8
//          gerçek vakada + tüm testlerde çıktı BİT BİT AYNI çıktı: bu satırların
//          kökenini Pass 1 zaten `contextFrom` üzerinden sahipleniyor. Sıfır
//          kazanç + blok sınırını gevşetme riski → geri alındı. Ayrıntı
//          index.ts'te reset koşulunun başındaki "📌 #87 NOTU" yorumunda.
//
// ⚠️ TEST FONKSİYONU ELLE KOPYALANMAZ — `index.ts`ten çalışma anında sökülür.
//    Sebebi #86'nın acı dersi: elle kopyalanan bir regex zinciri, hatanın
//    BULUNDUĞU satırı hiç çalıştırmadan 17/17 geçmişti. Bkz. test-clean-message.mts.
//
// 🧪 MUTASYON DENEYİ (üç düzeltmenin HEPSİ ayrı ayrı doğrulandı, 6 Ağu 2026):
//    `index.ts`i geçici bir dizine kopyala, TEK bir düzeltmeyi geri al, testi
//    ona doğrult:  KAYNAK_INDEX=/tmp/mut-a/index.ts npm run test:87
//    Testin GEÇMESİ değil, o kopyada DÜŞMESİ beklenir. Ölçülen:
//      #87-A  `if (right)` → `if (left && right)`                   → 5 test düştü
//      #87-B  `bestPlace(...) || contextFrom` → eski üçlü operatör   → 1 test düştü
//      #87-D  `+` kolundan `yerliParca.length >= 2` kaldırıldı       → 1 test düştü
//
// ⚠️ #87-B TESTİNİN İLK HÂLİ MUTANTI YAKALAMIYORDU — bkz. o testin başındaki
//    yorum. Pass 3'ün `lanes.length === 0` kurtarması, kırık kodu da geçirir.
//    Mutasyon koşulmasaydı test yeşil görünüp hiçbir şey korumayacaktı.
//
// 📌 ALIAS'LAR SENTETİKTİR — canlı `aliases` tablosundan taşınmaz. Bu bir BİRİM
//    testidir: "şu metin + şu alias kümesi → şu şerit". Canlı alias kapsamasını
//    ölçmez; onu `npm run olc:87` yapar.
//
// 📌 VAKA METİNLERİ GERÇEK — canlı `raw_posts`tan alındı, id'ler yorumda.

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

const dizin = mkdtempSync(join(tmpdir(), 'test87-'));
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
  A(1, 'Bursa', 'Bursa', 90, null), A(2, 'Konya', 'Konya', 90, null),
  // ⚠️ Gebze'nin önceliği 60 DEĞİL 95: `findPlaces` isabetleri ÖNCELİĞE göre sıralar
  //    ve #87-F vakasında (6c75aeea) canlı veri "GEBZE - MANİSA" satırında GEBZE'yi
  //    seçmişti. Sentetik kümede ilçe<il koyarsak sıra TERSİNE döner, mutant kendine
  //    şerit üretmez ve test mutasyonu YAKALAMAZ. Bkz. #87-F bloğu.
  A(3, 'Gebze', 'Kocaeli', 95, 'Gebze'), A(4, 'Eskişehir', 'Eskişehir', 90, null),
  A(5, 'İzmir', 'İzmir', 90, null), A(6, 'Çeşme', 'İzmir', 60, 'Çeşme'),
  A(7, 'Uşak', 'Uşak', 90, null), A(8, 'Mersin', 'Mersin', 90, null),
  A(9, 'Trabzon', 'Trabzon', 90, null), A(10, 'Rize', 'Rize', 90, null),
  A(11, 'Adana', 'Adana', 90, null), A(12, 'Ayaş', 'Ankara', 60, 'Ayaş'),
  A(13, 'Urfa', 'Şanlıurfa', 90, null), A(14, 'İzmit', 'Kocaeli', 60, null),
  A(15, 'Afyon', 'Afyonkarahisar', 90, null), A(16, 'Çay', 'Afyonkarahisar', 60, 'Çay'),
  A(17, 'Samsun', 'Samsun', 90, null), A(18, 'Düzce', 'Düzce', 90, null),
  A(19, 'Akyazı', 'Sakarya', 60, 'Akyazı'), A(20, 'Bartın', 'Bartın', 90, null),
  A(21, 'Antalya', 'Antalya', 90, null), A(22, 'Çorlu', 'Tekirdağ', 60, 'Çorlu'),
  A(23, 'Hatay', 'Hatay', 90, null), A(24, 'Ankara', 'Ankara', 90, null),
  A(25, 'Diyarbakır', 'Diyarbakır', 90, null),
  // #87-E vakası (e5ba7700 / 1d640d19) — ikisi de İSTANBUL İÇİ, ilçe farkı taşıyor.
  A(26, 'Avcılar', 'İstanbul', 60, 'Avcılar'), A(27, 'Tuzla', 'İstanbul', 60, 'Tuzla'),
  // #87-F vakası (6c75aeea / 9cbb76e1) — ardışık sol-boş ok satırları.
  A(28, 'Silivri', 'İstanbul', 60, 'Silivri'), A(29, 'Manisa', 'Manisa', 90, null),
  A(30, 'Dinar', 'Afyonkarahisar', 95, 'Dinar'), A(31, 'İskenderun', 'Hatay', 60, 'İskenderun'),
  A(32, 'Erzurum', 'Erzurum', 90, null), A(33, 'İstanbul', 'İstanbul', 90, null),
  // #89-A vakası — "İl İlçe" kalıbında ilçenin sessizce düşmesi.
  //   Gölbaşı/Yenimahalle: ilçe önceliği (60) < il önceliği (90) — canlıdaki tipik hâl
  //   (948 aktif ilçe alias'ının 912'si böyle).
  //   Kale/Denizli: öncelikler EŞİT (90). Bu satır önemli, çünkü sorunun ÖNCELİK
  //   sıralaması değil DEDUP olduğunu kanıtlıyor: eşit öncelikte bile ikinci isabet
  //   `seen`e takılıp hits'e hiç girmiyordu.
  A(34, 'Gölbaşı', 'Ankara', 60, 'Gölbaşı'), A(35, 'Yenimahalle', 'Ankara', 60, 'Yenimahalle'),
  A(36, 'Denizli', 'Denizli', 90, null), A(37, 'Kale', 'Denizli', 90, 'Kale'),
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
  if (a === b) console.log(`✓ ${ad.padEnd(48)} ${a || '(şerit yok)'}`);
  else {
    hata++;
    console.log(`❌ ${ad}\n     beklenen: ${b || '(şerit yok)'}\n     alınan  : ${a || '(şerit yok)'}`);
  }
}

console.log('\n── #87-A: solu boş ok satırı (mutasyonla KANITLANMIŞ) ──');
// Bu bölümdeki dördü de #87-A mutantında DÜŞER. Ortak özellikleri: Pass 1 zaten
// bir şerit ürettiği için `lanes.length !== 0` ve Pass 3'ün kurtarması KAPALI.
// Kırık kodun zararı ancak burada görünür hâle geliyor.

// 685877e4 — ESKİ ÇIKTI (ölçüldü): "Mersin→Ankara/Ayaş". Fallback iki şehri aynı
//   satırdan alıp UYDURUYOR; Adana hiçbir şeritte geçmiyor.
ok('685877e4 — Adana bloğu, iki ok varışı',
  '*ADANA OSB YÜKLEMELİ*\n➡️ MERSİN AYAŞ\n➡️ URFA MERKEZ\n13.60 TIR\nPALETLİ YÜK\n0507 180 37 33 ÖMER',
  ['Adana→Mersin', 'Adana→Şanlıurfa']);

// e8843b11 — ESKİ ÇIKTI: "Uşak→Trabzon , Uşak→Rize". `+` kolu şerit ürettiği için
//   Pass 3 kurtarması kapanıyor ve MERSİN sessizce düşüyor.
ok('e8843b11 — Mersin kaybolmamalı, "+" varışı dursun',
  '🟢 UŞAK YÜKLEME 🟢\n➡️MERSİN KAPALI TIR\n➡️TRABZON + RİZE KAPALI TIR\n☎️ _ÜMİT 0533 747 06 82 _☎️',
  ['Uşak→Mersin', 'Uşak→Trabzon', 'Uşak→Rize']);

// bbf0b3e4 — ESKİ ÇIKTI: "Kocaeli→Afyonkarahisar , Afyonkarahisar→Kocaeli , Kocaeli→Samsun".
//   Ortadaki TERS şerit uydurma; ayrıca Çay ilçesi kayboluyor.
ok('bbf0b3e4 — iki köken/varış çifti, ters şerit doğmasın',
  '📍 İZMİT\n➡️ AFYON / ÇAY\n📍 İZMİT\n➡️ SAMSUN\n🚛 DAMPERLİ ARAÇLAR\nAYDIN NAKLİYAT SUSURLUK\n0533 156 86 63',
  ['Kocaeli→Afyonkarahisar', 'Kocaeli→Afyonkarahisar/Çay', 'Kocaeli→Samsun']);

ok('contextFrom ok satırından ok satırına taşınır',
  'BURSA -> KONYA\n-> ANKARA\n-> DİYARBAKIR',
  ['Bursa→Konya', 'Bursa→Ankara', 'Bursa→Diyarbakır']);

console.log('\n── Aynı kalıp, ama Pass 3 kurtarıyor (REGRESYON kalkanı) ──');
// ⚠️ DÜRÜSTLÜK NOTU: aşağıdaki üçü #87-A mutantında da GEÇER — çünkü Pass 1 hiç
//    şerit üretmiyor, `lanes.length === 0` kalıyor ve Pass 3 doğru cevabı KAZARA
//    buluyor. Yani bunlar düzeltmeyi KANITLAMAZ, yalnızca KORUR: #87 sonrası
//    şeridin artık Pass 1'den kasten doğduğunu ve sonucun değişmediğini sabitler.
//    Canlıda bu satırların bir kısmı yine de şeritsiz kaldı; sebebi alias kapsaması,
//    parser değil (sentetik kümede alias'lar tam). Onu `npm run olc:87` ölçer.

ok('748ca449 — tek ok varışlı blok',
  '🟢 *GEBZE YÜKLEME* 🟢\n➡️BURSA  KAPALI TIR\n☎️ *MURAT 0538 407 33 10* ☎️',
  ['Kocaeli/Gebze→Bursa']);

ok('efe5941e — Bursa→Konya',
  '*⛔BURSA YÜKLEME⛔*\n➡️KONYA TENTELİ KAMYON\n*0530 9771351*',
  ['Bursa→Konya']);

// 📌 #89-A ÖNCESİ bu test `['Eskişehir→İzmir']` bekliyordu; notu da şuydu:
//    "Çeşme (öncelik 60) < İzmir (90) → bestPlace İzmir'i seçer, iki ok satırı da
//     aynı şeride katlanır. İlçe inceliğinin kaybı AYRI İŞ (bestPlace önceliği)."
//    O "ayrı iş" #89-A ile yapıldı — ve eski TEŞHİS de yanlıştı: sorun ÖNCELİK değil
//    DEDUP'tı. `findPlaces`in `seen` kümesi yalnız İL ile anahtarlandığı için
//    "İZMİR ÇEŞME" satırında Çeşme isabeti hits'e HİÇ GİRMİYORDU; önceliklerle
//    oynamak bu yüzden hiçbir şeyi değiştirmezdi. Artık mevcut isabetin BOŞ ilçesi
//    doldurulunca iki ok satırı İKİ AYRI şerit üretiyor — mesajda gerçekten iki
//    ayrı yük var (biri İzmir geneli "2 NOKTA", biri Çeşme).
ok('5c95b3ca — İzmir kaybolmamalı, Çeşme ayrı şerit olmalı',
  '*⛔ESKİŞEHİR YÜKLER⛔*\n➡️İZMİR 2 NOKTA TIR\n➡️İZMİR ÇEŞME TIR TENTELİ\n*📞0533 954 5632*',
  ['Eskişehir→İzmir', 'Eskişehir→İzmir/Çeşme']);

console.log('\n── #87-D: "+" fiyat satırı çoklu varış SAYILMAZ ──');

// 99183fb8 — ESKİ ÇIKTI (ölçüldü): "Düzce→Sakarya/Akyazı , Düzce→Bartın". İkisi de
//   uydurma (kdv satırlarından doğdu), SAMSUN ise hiçbir şeritte yok. Bu test HEM
//   #87-A HEM #87-D mutantında düşer — iki kusur aynı satırda üst üste biniyor.
ok('99183fb8 — kdv satırları şerit uydurmasın',
  '📍duzce💰1200+kdv\n📍akyazi💰1300+kdv\n📍bartin💰1300+kdvtokt\n➡️samsun',
  ['Bartın→Samsun']);

ok('tek yerli "+" satırı (fiyat) şerit doğurmaz',
  'BURSA YÜKLEME\nkonya 1400+kdv',
  ['Bursa→Konya']);   // Pass 2 bloğundan doğar; "+" kolu değil

console.log('\n── #87-B: ok solu DOLU ama yersiz → contextFrom ──');

// ⚠️ İLK HÂLİ 'ADANA YÜKLEME\n13.60 TIR -> ANKARA' İDİ VE MUTASYONU YAKALAMIYORDU:
//    Pass 1 hiç şerit üretmediği için `lanes.length === 0` kalıyor, Pass 3'ün
//    "ardışık tek şehir satırı" sezgisi Adana→Ankara'yı KAZARA kurtarıyordu.
//    Bu yüzden önce gerçek bir Pass 1 şeridi (Bursa→Konya) kuruluyor: artık
//    `lanes.length !== 0`, Pass 3 kapalı, satırı yalnız #87-B kurtarabilir.
ok('"13.60 TIR -> ANKARA" satırı düşmesin',
  'BURSA -> KONYA\n13.60 TIR -> ANKARA',
  ['Bursa→Konya', 'Bursa→Ankara']);

console.log('\n── KORUMA: bağlamsız solu boş ok şerit UYDURMAZ ──');

ok('köken hiç yokken tek solu boş ok', '➡️ANKARA\nTENTELİ TIR', []);

// 📌 GERÇEK DAVRANIŞ, HATA DEĞİL — ve #87 ÖNCESİYLE AYNI. Pass 1 köken bulamaz
//    (`!from` → continue), `lanes.length === 0` kaldığı için Pass 3'ün "ardışık
//    tek şehir satırı" sezgisi devreye girer ve Ankara→Konya'yı üretir. Kalıp
//    gerçekten de çoğu zaman güzergâh anlamına gelir. Buraya, #87 düzeltmesinin
//    Pass 3'ü SESSİZCE devre dışı bırakmadığını kanıtlamak için kondu.
ok('kökensiz iki ok satırı — Pass 3 sezgisi korunur', '➡️ANKARA\n➡️KONYA', ['Ankara→Konya']);
ok('yer bulunmayan tamamen alakasız metin', 'MERHABA ARKADAŞLAR NASILSINIZ', []);

console.log('\n── #87-E: sol boş ok + köken YOK → satır yutulmasın (REGRESYON) ──');
// 🚨 BU TESTLER #87-A'NIN AÇTIĞI DELİĞİ KAPATIYOR. `npm run olc:87` ölçümünde
//    "≥1→0 (KAYIP)" sütunu 2 çıktı — o sütun SIFIR OLMALI, çünkü düzeltmenin
//    ÇALIŞAN bir satırı öldürdüğü anlamına gelir. İki vaka da aynı kalıp:
//      e5ba7700 · 1d640d19  "EYSAN TAŞIMACILIK / -> AVCILAR LİMAN - TUZLA"
//    #87 öncesi: sol boş ok `null` dönüyor → satır TİRE kuralına düşüyor →
//                İstanbul/Avcılar→İstanbul/Tuzla. DOĞRU.
//    #87-A sonrası: ok artık ilişki sayılıyor, satır Pass 1'de tüketiliyor, ama
//                contextFrom da yok → `!from` → `continue`. ŞERİT TAMAMEN KAYBOLDU.
// 📌 DERS: bir kolu "ulaşılabilir" yapmak, o satırların ESKİ yolunu da kapatır.
//    #87-A'nın kazancı ölçüldü, kapattığı yol ölçülmedi. Mutasyon testi bunu
//    göstermezdi — yalnız GERÇEK VERİ ÜZERİNDE eski/yeni kıyası gösterdi.
//    Bu yüzden olc:87'nin "KAYIP" sütunu birim testlerden daha değerli.

ok('#87-E — "-> AVCILAR LİMAN - TUZLA" şeridi kaybolmasın',
  'EYSAN TAŞIMACILIK\n➡️ AVCILAR LİMAN - TUZLA\nKAPALI TIR - HAFİF',
  ['İstanbul/Avcılar→İstanbul/Tuzla']);

ok('#87-E — kamyon varyantı (1d640d19)',
  'EYSAN TAŞIMACILIK\n➡️ AVCILAR LİMAN - TUZLA\nKAPALI KAMYON - HAFİF',
  ['İstanbul/Avcılar→İstanbul/Tuzla']);

// ⚠️ BU YORUM 7 AĞU 2026'DA GEÇERSİZ KALDI — #92-A. Eski hâli şuydu:
//      "#87-E kolu ŞERİT EKLEYEBİLİR AMA SİLEMEZ: yalnız `from` null iken çalışır."
//    O güvence BİLEREK kaldırıldı; `if (!from)` kapısı kolu sahada neredeyse hiç
//    çalıştırmıyordu (bkz. index.ts'teki #92 yorumu). Kol artık `from` doluyken de
//    devreye giriyor ve normal yolun üreteceği şeridi DEĞİŞTİREBİLİYOR.
// 📌 Aşağıdaki test HÂLÂ `Bursa→Konya` veriyor ama ARTIK BAŞKA SEBEPLE: kol devreye
//    giriyor, `alt` çözülüyor (sol=KONYA), ama "EREĞLİ" sentetik alias kümesinde YOK
//    → `altTo` null → kol şerit basmadan normal yola düşüyor. Yani bu test artık
//    "kol kapalı" değil, "kol ucu çözemezse satırı YUTMAZ" kuralını sabitliyor.
ok('#92-A — kolun ucu yere çözülmezse satır yutulmaz',
  'BURSA YÜKLEME\n➡️ KONYA - EREĞLİ',
  ['Bursa→Konya']);

ok('#87-E — sağda tek yer varsa yeni şerit uydurmaz',
  'EYSAN TAŞIMACILIK\n➡️ TUZLA',
  []);

console.log('\n── #87-F: #87-E kolu contextFrom YAZMAMALI (REGRESYON) ──');
// 🚨 #87-E ilk hâlinde kurtardığı satırdan sonra `contextFrom = altFrom` yazıyordu.
//    Sonuç: ARDIŞIK sol-boş ok satırlarının İKİNCİSİNDE `from` artık null olmadığı
//    için #87-E kolu devreye giremiyor, satır normal yola düşüyor ve okun sağındaki
//    İLK yeri varış sanıp KENDİ KENDİNE ŞERİT üretiyordu. Gerçek veriden iki vaka:
//      6c75aeea  "-> GEBZE - SİLİVRİ / ->GEBZE - MANİSA"
//      9cbb76e1  "->DİNAR-İSKENDERUN / ->DİNAR-İSTANBUL / ->DİNAR- ERZURUM / ->ESKİŞEHİR - MERSİN"
// 📌 Bu vakaları `olc:87` KAYIP saymadı — satırda hâlâ şerit vardı, sadece YANLIŞ.
//    KAYIP=0 "temiz" demek değil; örneklerin elle okunması gerekti.

ok('#87-F — ardışık sol-boş ok satırlarının ikincisi de kendi sağını çözer',
  'EYSAN TAŞIMACILIK\n➡️ GEBZE - SİLİVRİ\nKAPALI VEYA AÇIK TIR\n➡️GEBZE - MANİSA\nKAPALI VEYA AÇIK TIR',
  ['Kocaeli/Gebze→İstanbul/Silivri', 'Kocaeli/Gebze→Manisa']);

ok('#87-F — dört sol-boş ok satırı, hiçbiri kendine şerit üretmez',
  '➡️DİNAR-İSKENDERUN DAMPER\n➡️ DİNAR-İSTANBUL 1360\n➡️ DİNAR- ERZURUM 1360\n➡️ESKİŞEHİR - MERSİN DAMPER',
  ['Afyonkarahisar/Dinar→Hatay/İskenderun', 'Afyonkarahisar/Dinar→İstanbul',
   'Afyonkarahisar/Dinar→Erzurum', 'Eskişehir→Mersin']);

console.log('\n── #89-A: "İl İlçe" kalıbında ilçe DÜŞMEMELİ ──');
// 🚨 KÖK SEBEP DEDUP'TI, ÖNCELİK DEĞİL. `findPlaces` içindeki `seen` kümesi yalnız
//    İL ile anahtarlanıyordu (`yerKey(match.normalized)`), bu yüzden "ANKARA GÖLBAŞI"
//    metninde `ankara` isabetinden sonra gelen `gölbaşı` isabeti hits'e HİÇ GİRMİYOR,
//    sıralamaya bile ulaşmıyordu. Öncelik sayılarıyla oynamak çözmezdi.
// 📊 Ölçek (canlı, 6 Ağu 2026): 948 aktif ilçe alias'ının 912'si kendi ilinin bare
//    alias'ından düşük/eşit öncelikte; 7 günde varış ilçe doluluğu %25,5 (3.363/13.183);
//    `district='Yenimahalle'` ve `district='Maltepe'` kayıt sayısı SIFIR.
ok('#89-A — köken tarafında ilçe korunur',
  'ANKARA YENİMAHALLE YÜKLEME\n➡️KONYA TIR',
  ['Ankara/Yenimahalle→Konya']);

ok('#89-A — iki taraf da aynı il, farklı ilçe → şerit KALIR ve ilçeler dolu',
  'ANKARA YENİMAHALLE ➡️ ANKARA GÖLBAŞI',
  ['Ankara/Yenimahalle→Ankara/Gölbaşı']);

// 📌 Öncelikler EŞİT (Denizli 90 / Kale 90). Eşit öncelikte bile eski kod ilçeyi
//    düşürüyordu — dedup teşhisinin kanıtı.
ok('#89-A — eşit öncelikte de ilçe düşmez',
  'İSTANBUL YÜKLEME\n➡️DENİZLİ KALE TIR',
  ['İstanbul→Denizli/Kale']);

// 🔒 KORUMA: yükseltme yalnız BOŞ ilçeyi doldurur, DOLU ilçeyi ezmez.
ok('#89-A — dolu ilçe ezilmez (ilk kazanır)',
  'BURSA YÜKLEME\n➡️ANKARA GÖLBAŞI YENİMAHALLE',
  ['Bursa→Ankara/Gölbaşı']);

console.log('\n── #92-A: başlıklı blokta sol-boş ok + iç tire (CANLI GERİLEME) ──');
// 🚨 CANLIDA ÖLÇÜLDÜ, TAHMİN DEĞİL. `npm run olc:87` (7 Ağu 2026, 8.432 satır)
//    v89 parser'ının bu kalıpta şeritleri KATLEDİĞİNİ gösterdi:
//      17c1d00d  eski: 9 doğru şerit → yeni: Mersin→MERSİN , Mersin→Bursa
//      6dafdfb3  eski: 6 doğru şerit → yeni: Adana→ADANA
//      c7484f34  eski: 3 doğru şerit → yeni: 1 kendine şerit
//      ayrıca 94be0c0d · b467e6c3 · 65b65d38 · 3a4976b8 · f6daed73 · 28d0441c ·
//             8a72f090 · 85fce313
// 📌 KAYIP (≥1→0) SÜTUNU YİNE 0'DI. Yanlış şerit, şerit SAYISINI düşürmez; bu
//    yüzden hiçbir otomatik kapıya takılmadı, 25 örneğin elle okunmasıyla çıktı.
//    Aynı ders üçüncü kez: #87-E, #87-F, #92. Kalıcı çözüm olc-87.mts'e KENDİNE
//    ŞERİT sütunu eklemek — o iş YAPILACAKLAR.md'de.
// 🧪 MUTANT: index.ts'te kolun başına `if (!from) {` kapısını geri koy.

ok('#92-A — 17c1d00d: başlık contextFrom doldururken kol yine de çalışır',
  'MERSİN HEMEN YÜKLENİR\n13-60 TENTELİ-FRİGO\n%80 PEŞİN ÖDEME\n->MERSİN-ANKARA\n->MERSİN-ANTALYA',
  ['Mersin→Ankara', 'Mersin→Antalya']);

// ⚠️ YUKARIDAKİ TEST TEK BAŞINA MUTASYONU YAKALAMIYORDU — #87-B'nin aynı tuzağı.
//    #92-A geri alınınca Pass 1 hiç şerit üretmiyor (#92-B kendine şeridi eliyor),
//    `lanes.length === 0` kalıyor ve Pass 3 sezgisi doğru cevabı KAZARA buluyor.
//    Aşağıdaki metin önce GERÇEK bir Pass 1 şeridi kuruyor (Mersin→Konya): artık
//    `lanes.length !== 0`, Pass 3 KAPALI, satırları yalnız #92-A kurtarabilir.
// 📊 Üç varyantın ölçülmüş çıktısı (bu metin):
//      canlı v89 (A+B yok) : Mersin→Konya , Mersin→MERSİN     ← yanlış şerit
//      yalnız #92-B        : Mersin→Konya                     ← sekiz varış KAYIP
//      #92-A + #92-B       : Mersin→Konya , Mersin→Ankara , Mersin→Antalya
//    Yani #92-B tek başına yanlış şeridi susturur ama satırı KURTARMAZ; ikisi şart.
ok('#92-A — Pass 3 kurtarması KAPALIYKEN de blok çözülür',
  'MERSİN -> KONYA\nMERSİN HEMEN YÜKLENİR\n->MERSİN-ANKARA\n->MERSİN-ANTALYA',
  ['Mersin→Konya', 'Mersin→Ankara', 'Mersin→Antalya']);

ok('#92-A — 6dafdfb3: Adana bloğu, üç varış',
  'ADANA YÜKLEME VAR\n->ADANA-KONYA\n->ADANA-İZMİR\n->ADANA-SAMSUN',
  ['Adana→Konya', 'Adana→İzmir', 'Adana→Samsun']);

// 🔒 #87-E/F HÂLÂ ÇALIŞMALI: köken YOKKEN de aynı kol aynı sonucu vermeli.
//    (Yukarıdaki #87-E/F blokları bunu ayrıca sabitliyor; burası kapıyı
//     kaldırmanın o vakaları bozmadığını aynı yerde gösterir.)
ok('#92-A — kökensiz hâl (#87-E) aynen korunur',
  'EYSAN TAŞIMACILIK\n➡️ AVCILAR LİMAN - TUZLA',
  ['İstanbul/Avcılar→İstanbul/Tuzla']);

console.log('\n── #92-B: Pass 1 ok/tire kolunda kendine-şerit koruması ──');
// 🚨 Pass 1'in ASIL ok kolunda `from`u `to`ya kıyaslayan HİÇBİR şart yoktu.
//    `+` kolu (:672) ve Pass 2 koruyordu, burası korumuyordu. `Adana→Adana`
//    DB'ye kadar gidiyordu. Bu eksiklik #92-A'nın zararını da GİZLEDİ.
// 🧪 MUTANT: iki koldan da `&& !kendineSerit(to)` şartını sil.

ok('#92-B — aynı il aynı ilçe şerit ÜRETMEZ',
  'ADANA YÜKLEME\n➡️ ADANA TENTELİ TIR',
  []);

// 🔒 KORUMA: kural `ayniSehir && ayniIlce` — sadece `ayniSehir` olsaydı bu
//    GERÇEK şeridi öldürürdü (#87-E'nin kurtardığı vakaların aynısı).
ok('#92-B — aynı il FARKLI ilçe şerit KALIR',
  'AVCILAR YÜKLEME\n➡️ TUZLA KAPALI TIR',
  ['İstanbul/Avcılar→İstanbul/Tuzla']);

ok('#92-B — çoklu varış kolunda da kendine şerit elenir',
  'BURSA YÜKLEME\n➡️ BURSA + KONYA',
  ['Bursa→Konya']);

console.log('\n── #92-C: ŞEHİR İÇİ İSTİSNASI (10 Ağu 2026) ──');

// 🚨 ASIL VAKA — canlı satır `4aadf724`. #92-B bu MEŞRU şeridi düşürüyordu;
//    `olc:87` onu KAYIP=3'ün 1'i olarak gösterdi (diğer 2'si doğru temizlikti).
ok('#92-C — "ANKARA ➡️ ANKARA Ş.İÇİ" şeridi KALIR',
  '⚠️YARIN YÜKLER\nANKARA ➡️ ANKARA Ş.İÇİ\nFRİGO KAMYONET',
  ['Ankara→Ankara']);

ok('#92-C — açık yazım "şehir içi" de kabul',
  'BURSA YÜKLEME\nBURSA ➡️ BURSA ŞEHİR İÇİ TIR',
  ['Bursa→Bursa']);

// Canlı derlemde en yaygın biçim BOŞLUKSUZ ("izmir sehirici kirkayak", 11 kez).
ok('#92-C — boşluksuz "şehirici" de kabul',
  'İZMİR YÜKLEME\nİZMİR ➡️ İZMİR ŞEHİRİÇİ TIR',
  ['İzmir→İzmir']);

// 🔒 EN ÖNEMLİ KORUMA — istisna #92-B'yi GENEL OLARAK delmemeli.
ok('#92-C — ibare YOKSA kendine şerit HÂLÂ elenir (#92-B korunuyor)',
  'ADANA YÜKLEME\n➡️ ADANA TENTELİ TIR',
  []);

// 🚨 "İÇİN" TUZAĞI — ham metinde "iş için" içinde "ş içi" geçer. Desen trNorm'dan
//    SONRA uygulandığı için "icin" olur ve eşleşmez. Gevşek desenle bu satır
//    kendine şerit üretirdi (ilk denememde tam bu oldu).
ok('#92-C — "iş için" ibaresi istisnayı TETİKLEMEZ',
  'ADANA YÜKLEME\n➡️ ADANA iş için tenteli tır',
  []);

ok('#92-C — "giriş için" de tetiklemez',
  'MERSİN YÜKLEME\n➡️ MERSİN giriş için evrak',
  []);

// ⚠️ SATIR DÜZEYİ: başka satırdaki ibare bu satırı meşrulaştırmamalı.
ok('#92-C — ibare BAŞKA satırdaysa kendine şerit meşrulaşmaz',
  'şehir içi işler de yapılır\nMERSİN YÜKLEME\n➡️ MERSİN TENTELİ',
  []);

console.log('\n── KORUMA: #88 ve mevcut davranış bozulmadı ──');

ok('temiz kontrol — Çorlu→Hatay',
  '➡️ÇORLU YÜKLEMELİ\n➡️HATAY\nTENTELİ TIR KAPALI\n05514624133',
  ['Tekirdağ/Çorlu→Hatay']);

ok('#88-B — "(KISA-UZUN) DORSE" bloğu bozmaz',
  'BURSA YÜKLEMELİ\n(KISA-UZUN) DORSE\nKONYA TIR',
  ['Bursa→Konya']);

ok('yer içeren boşluksuz tire bloğu HÂLÂ KESER',
  'GEBZE YÜKLEME\nBURSA-İZMİR\nANKARA',
  ['Bursa→İzmir']);

console.log(hata === 0 ? `\n✅ hepsi geçti` : `\n❌ ${hata} test başarısız`);
process.exit(hata === 0 ? 0 : 1);
