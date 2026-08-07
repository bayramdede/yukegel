// scripts/test-ad-type.mts — `npm run test:ad-type`
//
// 🚨 NE KORUYOR: `supabase/functions/parse-listing/index.ts::detectAdType` —
// #93 (7 Ağu 2026): 'yuklenecek' anahtar kelimesi çıkarıldı. Canlı ölçüm:
// bu tek kelimeyle 'arac' sayılan 1350 ilandan elle okunan 25'i, 25'i de
// gerçekte YÜK ilanıydı ("Urfa'dan büyük balya yüklenecek" — yük simsarı
// kalıbı: "X yüklenecek" = "X'te yük var, araç aranıyor", "boş araç" DEĞİL).
//
// Fonksiyon `index.ts`ten ÇALIŞMA ANINDA sökülür — elle kopyalanmaz (bkz.
// `test-clean-message.mts` başlığındaki #86 dersi: elle kopyalanan bir test,
// kaynağın kendisini değil kendi kopyasını doğrular).

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const KAYNAK = process.env.KAYNAK_INDEX
  ? resolve(process.env.KAYNAK_INDEX)
  : resolve(import.meta.dirname, '../supabase/functions/parse-listing/index.ts');

// ── trNorm + detectAdType'ı kaynaktan SÖK ───────────────────────────────────
function kaynaktanSok(): string {
  const satirlar = readFileSync(KAYNAK, 'utf8').split('\n');

  const scStart = satirlar.findIndex(l => l.startsWith('const UNICODE_SMALL_CAPS'));
  const tnStart = satirlar.findIndex(l => l.startsWith('function trNorm'));
  const daStart = satirlar.findIndex(l => l.startsWith('function detectAdType'));
  if (scStart < 0 || tnStart < 0 || daStart < 0) {
    throw new Error('index.ts içinde UNICODE_SMALL_CAPS/trNorm/detectAdType bulunamadı — imza değişmiş olabilir');
  }

  let scEnd = -1;
  for (let i = scStart; i < satirlar.length; i++) {
    if (satirlar[i].startsWith(']')) { scEnd = i; break; }
  }
  let tnEnd = -1;
  for (let i = tnStart + 1; i < satirlar.length; i++) {
    if (satirlar[i] === '}') { tnEnd = i; break; }
  }
  let daEnd = -1;
  for (let i = daStart + 1; i < satirlar.length; i++) {
    if (satirlar[i] === '}') { daEnd = i; break; }
  }
  if (scEnd < 0 || tnEnd < 0 || daEnd < 0) throw new Error('blok sonu bulunamadı — kaynak biçimi değişmiş');

  return [
    ...satirlar.slice(scStart, scEnd + 1),
    ...satirlar.slice(tnStart, tnEnd + 1),
    ...satirlar.slice(daStart, daEnd + 1),
    'export { detectAdType }',
  ].join('\n');
}

const dizin = mkdtempSync(join(tmpdir(), 'adtype-'));
const gecici = join(dizin, 'sokulen.mts');
writeFileSync(gecici, kaynaktanSok(), 'utf8');
const { detectAdType } = await import(gecici) as { detectAdType: (s: string) => 'yuk' | 'arac' };

let hata = 0;
function ok(ad: string, girdi: string, beklenen: 'yuk' | 'arac') {
  let cikti: 'yuk' | 'arac';
  try { cikti = detectAdType(girdi); }
  catch (e: any) { hata++; console.log(`❌ ${ad}: PATLADI — ${e.message}`); return; }
  if (cikti === beklenen) {
    console.log(`✓ ${ad.padEnd(50)} → ${cikti}`);
  } else {
    hata++;
    console.log(`❌ ${ad}\n     beklenen: ${beklenen}   çıktı: ${cikti}\n     girdi: ${girdi}`);
  }
}

console.log('\n── #93: gerçek "yuklenecek" örnekleri artık YUK (canlı veriden, 7 Ağu 2026) ──');
ok('yük simsarı — büyük balya', 'Urfa yardımcı dan büyük balya yüklenecek 13.60 açık ihtiyaç', 'yuk');
ok('yük simsarı — sarımsak', 'Gaziantep arabandan yükler\nSarımsak yüklenecek', 'yuk');
ok('yük simsarı — çuvallı gübre', 'MERSİNDEN YARIN YÜKLEMELİ ÇUVALLI GÜBRE YÜKLENECEKTİR 13/60 AÇIK', 'yuk');
ok('yük simsarı — şişe', 'MALATYA 1. OSB ŞİŞE YÜKLENECEK 15*6 ÇADIR', 'yuk');
ok('regresyon örneği (MetindenIlan.tsx resmî örnek 3)', 'Adana → Mersin\n10 palet meyve, frigo, 5 ton\nyarın yüklenecek', 'yuk');

console.log('\n── Gerçek araç sinyalleri hâlâ ARAC (regresyon olmadığının kanıtı) ──');
ok('boş araç', 'Boş aracım var, İzmir\'de bekliyor.', 'arac');
ok('boş tır', 'Boş tırım var, yük arıyorum.', 'arac');
ok('boş kamyon', 'Boş kamyon, Ankara-İstanbul arası.', 'arac');
ok('yük arıyor', 'İstanbul\'dan yük arıyorum, aracım hazır.', 'arac');
ok('"yuklenecek" + gerçek araç sinyali birlikte — yine arac', 'Boş aracım var, uygun yükte hemen yüklenecek', 'arac');

console.log('\n── Yanlış pozitif üretmediğinin kontrolü ──');
ok('sade yük ilanı, araç kelimesi yok', 'İstanbul\'dan Ankara\'ya 5 ton yük var, TIR aranıyor', 'yuk');
ok('"yükler boşaltır" araç sinyali DEĞİL (zaten hariç tutulmuştu)', 'ANKARA YÜKLER İZMİR BOŞALTIR', 'yuk');

console.log(hata === 0 ? `\n✅ hepsi geçti` : `\n❌ ${hata} test başarısız`);
process.exit(hata === 0 ? 0 : 1);
