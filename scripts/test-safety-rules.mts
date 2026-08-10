// scripts/test-safety-rules.mts — GÜVENLİK KURALLARININ JAVASCRIPT'TE
// GERÇEKTEN DERLENDİĞİNİ doğrular.
//
// 🚨 BU TESTİN VAR OLMA SEBEBİ (10 Ağu 2026): `safety_rules.pattern` değerleri
// POSTGRES sözdizimiyle yazılıyor ve satır içi bayrak taşıyor — `(?i)(silah|…)`.
// JavaScript `RegExp` satır içi bayrağı desteklemez ve "Invalid group" atar.
// Denetim kodu bunu `catch {}` ile SESSİZCE atlıyordu; sonuç: 10 kuralın 8'i
// JavaScript yolunda AYLARCA hiç çalışmadı ve atlananlar en ağırlarıydı
// (silah/uyuşturucu, göçmen taşıma, 5607 kaçakçılık, kapora/IBAN…).
//
// Hiçbir tsc/lint/build bunu yakalayamaz: desenler VERİDİR, kodda değil.
// Yakalayabilecek tek şey budur. Kurallar admin panelinden düzenlenebildiği
// için her deploy'da çalıştırılmalı.
//
// ÇALIŞTIRMA: npm run test:safety-rules   (dev sunucusu GEREKMEZ)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

/** `lib/metin-denetim.ts::desenAyikla` ile AYNI mantık — ayrışırsa test yalan söyler. */
const desenAyikla = (ham: string) => ham.replace(/\(\?[imsxu]+\)/g, '');

let gecti = 0; const hatalar: string[] = [];
const ok = (ad: string, kosul: boolean, ek = '') => {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); } else hatalar.push(`✗ ${ad}${ek ? `\n    ${ek}` : ''}`);
};

// ── 1. Ayıklayıcı doğru şeyi yapıyor mu? ──────────────────────────────
ok('(?i) bayrağı ayıklanıyor', desenAyikla('(?i)(silah)') === '(silah)');
ok('satır ortasındaki (?i) de ayıklanıyor',
   desenAyikla('(https?://)|(?i)(telegram)') === '(https?://)|(telegram)');
// ⚠️ GERÇEK grupları bozmamalı — bozarsa kural anlamı değişir, sessizce yanlış eşleşir
ok('(?:…) grubuna DOKUNMUYOR', desenAyikla('(?:ab)+c') === '(?:ab)+c');
ok('(?=…) ileri bakışa DOKUNMUYOR', desenAyikla('a(?=b)') === 'a(?=b)');
ok('(?<ad>…) adlı gruba DOKUNMUYOR', desenAyikla('(?<x>a)') === '(?<x>a)');

// ── 2. CANLI kuralların HEPSİ derleniyor mu? ───────────────────────────
const { data: kurallar, error } = await svc
  .from('safety_rules')
  .select('id, description, pattern, risk_weight, is_active, rule_type')
  .eq('is_active', true)
  .eq('rule_type', 'REGEX');
if (error) { console.error('DB hatası:', error.message); process.exit(1); }

console.log(`\naktif REGEX kural sayısı: ${kurallar!.length}\n`);

const derlenmeyen: string[] = [];
const hamDerlenmeyen: string[] = [];
for (const k of kurallar!) {
  // Ham hâliyle derlenir mi? (bilgi amaçlı — kaçının Postgres sözdizimi olduğunu gösterir)
  try { new RegExp(k.pattern, 'i'); } catch { hamDerlenmeyen.push(k.description ?? k.id); }
  // Ayıklandıktan sonra DERLENMEK ZORUNDA
  try { new RegExp(desenAyikla(k.pattern), 'i'); }
  catch (e: any) { derlenmeyen.push(`${k.description ?? k.id} → ${e.message}`); }
}

console.log(`ham hâliyle derlenemeyen (Postgres sözdizimi): ${hamDerlenmeyen.length}/${kurallar!.length}`);
for (const d of hamDerlenmeyen) console.log(`   · ${d}`);
console.log('');

ok('AYIKLANDIKTAN SONRA TÜM kurallar derleniyor', derlenmeyen.length === 0,
   derlenmeyen.join('\n    '));

// ── 3. Çapa: en ağır kuralların gerçekten eşleştiğini doğrula ─────────
// (Yalnız "derleniyor" demek yetmez; eşleşmesi de lazım.)
const capalar: [string, string][] = [
  ['silah',       'kamyona silah yukleyecegiz'],
  ['uyusturucu',  'uyusturucu tasima isi'],
  ['kapora/IBAN', 'once kapora gonder iban vereyim'],
  ['kacak',       'kacak sigara yuku'],
  ['belgesiz',    'faturasız is yapalim'],
];
for (const [ad, metin] of capalar) {
  let eslesen = 0;
  for (const k of kurallar!) {
    try { if (new RegExp(desenAyikla(k.pattern), 'i').test(metin.toLowerCase())) eslesen++; } catch {}
  }
  ok(`çapa "${ad}" en az bir kurala takılıyor`, eslesen > 0, `metin: "${metin}"`);
}

// Temiz metin HİÇBİR kurala takılmamalı (yanlış pozitif kontrolü)
const temiz = 'istanbul ankara arasi tekstil yuku 20 ton tir araniyor';
let temizEslesme = 0;
for (const k of kurallar!) {
  try { if (new RegExp(desenAyikla(k.pattern), 'i').test(temiz)) temizEslesme++; } catch {}
}
ok('normal ilan metni hiçbir kurala takılmıyor', temizEslesme === 0,
   `${temizEslesme} kural takıldı — yanlış pozitif`);

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
