// scripts/test-clean-message.mts — `npm run test:clean`
//
// 🚨 NE KORUYOR: `supabase/functions/parse-listing/index.ts::cleanMessage` —
//    parser'ın İLK adımı. Buradaki her hata sessizdir: metin bozulur, aşağıdaki
//    hiçbir kural hata vermez, ilan sadece "bulunamadı" olur.
//
// ⚠️ BU TEST NEDEN BÖYLE YAZILDI — 6 Ağu 2026, #86'nın acı dersi:
//    #63 için yazdığım ilk regresyon testi (`/tmp/t63.mjs`) 17/17 GEÇTİ ve
//    YANLIŞTI. Çünkü gerçek `cleanMessage`'ı çağırmıyordu; regex zincirini ELLE
//    KOPYALAMIŞTI. Kopyada olmayan bir satır (:139 vekil silme) canlıda 👉 ve 📍
//    karakterlerini test edilen kural çalışmadan ÖNCE yok ediyordu. Yani test,
//    kendi yazdığım kodun kendi yazdığım kopyasını doğruluyordu — canlı davranışı
//    değil. #63 "deploy edildi" diye kapatıldı; gerçekte 👉/📍 dalı ÖLÜ KODDU.
//
//    Bu yüzden aşağıdaki test fonksiyonu ELLE YAZILMAZ: `index.ts` dosyasından
//    ÇALIŞMA ANINDA sökülüp import edilir. Kaynak değişirse test onunla değişir;
//    kaynağa yeni bir satır girerse test onu da görür. Kopyalamayın.
//
// 📌 KAPSAM DÜRÜSTLÜĞÜ: bu test yalnız `cleanMessage`'ı ölçer. `findPlaces`
//    substring eşleştiği için "MERSİNİZMİR" gibi yapışık metinden bile şerit
//    çıkabilir — yani buradaki bir hatanın şerit kaybına dönüşmesi GARANTİ DEĞİL.
//    Test "metin bozulmuyor" der, "ilan üretiliyor" DEMEZ.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// KAYNAK_INDEX ile başka bir kopya gösterilebilir — MUTASYON DENEYİ içindir:
// `index.ts`i /tmp'ye kopyala, :150'yi eski `/[\uD800-\uDFFF]/g` haline döndür,
// testi ona doğrult. Testin GEÇMESİ değil, o kopyada BAŞARISIZ OLMASI gerekir.
// Yanlış sebeple geçen bir test, hiç olmayan testten daha zararlıdır (bkz. #86).
const KAYNAK = process.env.KAYNAK_INDEX
  ? resolve(process.env.KAYNAK_INDEX)
  : resolve(import.meta.dirname, '../supabase/functions/parse-listing/index.ts');

// ── cleanMessage'ı kaynaktan SÖK (elle kopyalama YASAK — yukarıdaki nota bak) ──
function kaynaktanSok(): string {
  const satirlar = readFileSync(KAYNAK, 'utf8').split('\n');

  const blStart = satirlar.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const cmStart = satirlar.findIndex(l => l.startsWith('function cleanMessage'));
  if (blStart < 0 || cmStart < 0) {
    throw new Error('index.ts içinde BLACKLIST_PHRASES veya cleanMessage bulunamadı — imza değişmiş olabilir');
  }
  // Fonksiyon sonu: sütun 0'daki ilk kapanış parantezi.
  let cmEnd = -1;
  for (let i = cmStart + 1; i < satirlar.length; i++) {
    if (satirlar[i] === '}') { cmEnd = i; break; }
  }
  // BLACKLIST bloğunun sonu da aynı yöntemle (dizi kapanışı `]`).
  let blEnd = -1;
  for (let i = blStart; i < satirlar.length; i++) {
    if (satirlar[i].startsWith(']')) { blEnd = i; break; }
  }
  if (cmEnd < 0 || blEnd < 0) throw new Error('blok sonu bulunamadı — kaynak biçimi değişmiş');

  return [
    ...satirlar.slice(blStart, blEnd + 1),
    ...satirlar.slice(cmStart, cmEnd + 1),
    'export { cleanMessage }',
  ].join('\n');
}

const dizin = mkdtempSync(join(tmpdir(), 'cleanmsg-'));
const gecici = join(dizin, 'sokulen.mts');
writeFileSync(gecici, kaynaktanSok(), 'utf8');
const { cleanMessage } = await import(gecici) as { cleanMessage: (s: string) => string };

// ── Testler ────────────────────────────────────────────────────────────────────
let hata = 0;
const gorunur = (s: string) =>
  JSON.stringify(s).replace(/[\uD800-\uDFFF]/g, m => `\\u${m.charCodeAt(0).toString(16).toUpperCase()}`);

function ok(ad: string, girdi: string, kontrol: (c: string) => boolean, beklenti: string) {
  let cikti: string;
  try { cikti = cleanMessage(girdi); }
  catch (e: any) { hata++; console.log(`❌ ${ad}: PATLADI — ${e.message}`); return; }
  if (kontrol(cikti)) {
    console.log(`✓ ${ad.padEnd(38)} ${gorunur(cikti)}`);
  } else {
    hata++;
    console.log(`❌ ${ad}\n     girdi:   ${gorunur(girdi)}\n     çıktı:   ${gorunur(cikti)}\n     beklenen: ${beklenti}`);
  }
}

const H = '\uD83D'; // yalnız yüksek vekil (eşsiz)
const L = '\uDC49'; // yalnız düşük vekil (eşsiz)

console.log('\n── #86: geçerli vekil çiftleri KORUNUR ──');
ok('👉 harf arasında ayraç olur', 'MERSİN👉İRAN',
   c => c.includes('->') && !c.includes('MERSİNİRAN'), 'MERSİN -> İRAN');
ok('📍 harf arasında ayraç olur', 'KIZILTEPE📍OSMANİYE',
   c => c.includes('->') && !c.includes('KIZILTEPEOSMANİYE'), 'KIZILTEPE -> OSMANİYE');
ok('🔹 yapıştırmaz (boşluk olur)', 'ANKARA🔹İZMİR',
   c => !/ANKARAİZMİR/.test(c), 'token yapışmaz');
ok('🚛 yapıştırmaz', 'ADANA🚛KONYA',
   c => !/ADANAKONYA/.test(c), 'token yapışmaz');

console.log('\n── #86: EŞSİZ vekiller hâlâ silinir (JSON serialize koruması) ──');
ok('yalnız yüksek vekil silinir', `ANKARA${H}IZMIR`,
   c => !c.includes(H), 'D83D kalmamalı');
ok('yalnız düşük vekil silinir', `ANKARA${L}IZMIR`,
   c => !c.includes(L), 'DC49 kalmamalı');
ok('çift + eşsiz karışık', `MERSİN👉İRAN ${H}`,
   c => c.includes('->') && !c.includes(H), 'ayraç var, eşsiz vekil yok');
ok('JSON.stringify patlamaz', `A${H}B👉C`,
   c => { JSON.stringify(c); return true; }, 'istisna atmaz');

console.log('\n── #63: ayraç kuralları ──');
ok('ASCII = ayraç olur', 'KIZILTEPE = OSMANİYE',
   c => c.includes('->'), 'KIZILTEPE -> OSMANİYE');
ok('➡ (BMP) ayraç olur', 'UŞAK ➡ SİİRT',
   c => c.includes('->'), 'UŞAK -> SİİRT');
ok('satır başı 👉 ayraç DEĞİL', '👉 ANKARA YÜKLEME',
   c => !c.includes('->'), 'sol tarafta harf yok, ayraç olmamalı');
ok('"/" bilinçli olarak ayraç DEĞİL', 'ANKARA/İZMİR',
   c => !c.includes('->'), 'bkz. index.ts yorumu');

console.log('\n── genel sağlamlık ──');
ok('boş metin', '', c => c === '', 'boş döner');
ok('sadece emoji satırı düşer', '🚛🔹👉', c => !/[\uD800-\uDFFF]/.test(c), 'vekil kalmaz');
ok('çok satırlı korunur', 'UŞAK YÜKLEME\n➡SİİRT\n05551112233',
   c => c.split('\n').length >= 2 && c.includes('->'), 'satırlar + ayraç');

console.log(hata === 0 ? `\n✅ hepsi geçti` : `\n❌ ${hata} test başarısız`);
process.exit(hata === 0 ? 0 : 1);
