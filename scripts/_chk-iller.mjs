import fs from 'fs';

const pull = (f, name) => {
  const src = fs.readFileSync(f, 'utf8');
  const re = new RegExp('const ' + name + '(?::[^=]+)? = \\[([\\s\\S]*?)\\]');
  const m = src.match(re);
  if (!m) { console.log('!! REGEX EŞLEŞMEDİ:', f, name); return null; }
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};

const src = pull('lib/ilan-sabitler.ts', 'ILLER');
const coll = (a, b) => new Intl.Collator('tr').compare(a, b);

const targets = [
  ['app/moderator/page.tsx', 'ILLER'],
  ['app/admin/poi-onay/PoiOnayClient.tsx', 'ILLER'],
  ['app/u/[username]/page.tsx', 'ILLER'],
  ['app/admin/radar/RadarClient.tsx', 'SEHIRLER'],
];

console.log('KAYNAK lib/ilan-sabitler.ts::ILLER →', src.length, 'il');
for (const [f, n] of targets) {
  const a = pull(f, n);
  if (!a) continue;
  const sameSeq = JSON.stringify(a) === JSON.stringify(src);
  const sameSet = JSON.stringify([...a].sort(coll)) === JSON.stringify([...src].sort(coll));
  const isAlpha = JSON.stringify(a) === JSON.stringify([...src].sort(coll));
  console.log(`${f}::${n}  n=${a.length}  aynıSıra=${sameSeq}  aynıKüme=${sameSet}  alfabetikMi=${isAlpha}`);
  if (!sameSet) {
    console.log('   FAZLA:', a.filter(x => !src.includes(x)), '| EKSİK:', src.filter(x => !a.includes(x)));
  }
}
