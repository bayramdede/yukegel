/**
 * SEO metadata bekçisi — #33.
 *
 * NEDEN VAR: 6 Ağu 2026'da kök `app/layout.tsx` `alternates: { canonical: '/' }`
 * taşıyordu ve yanındaki yorum "alt sayfalar bunu miras ALMAZ" diyordu. Yanlıştı.
 * Next 16'nın birleştiricisi (node_modules/next/dist/lib/metadata/resolve-metadata.js)
 * üst katmanın çözülmüş metadata'sını `structuredClone` ile klonlayıp YALNIZCA
 * çocukta bulunan anahtarları eziyor. Sonuç: kendi canonical'ını yazmayan HER
 * sayfa `<link rel="canonical" href="https://yukegel.com/">` yayınlıyordu —
 * Google için "bu sayfa ana sayfanın kopyası", yani indeksten düşme.
 *
 * Bu betik hatayı DEĞİL, hatanın SINIFINI kilitliyor: her rota ya kendi
 * canonical'ını yazacak ya da noindex olacak. Yeni bir sayfa eklenip ikisi de
 * unutulursa burası kırmızı yanar.
 *
 * Kaynak metni statik okur; derleme veya ağ gerektirmez (sandbox'ta
 * `next build` Google Fonts'a çıkamadığı için tamamlanamıyor).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const APP = join(KOK, 'app');

let gecti = 0;
const hatalar: string[] = [];

function kontrol(ad: string, kosul: boolean, detay = '') {
  if (kosul) { gecti++; return; }
  hatalar.push(`${ad}${detay ? ` — ${detay}` : ''}`);
}

/**
 * Yorumları söker. ŞART: `alternates` kelimesi bu dosyalarda açıklama
 * metninde de geçiyor (bilerek — tuzağı yazıya döktük). Yorumları
 * ayıklamazsak "yorumda anlatmış" ile "kodda yazmış" ayırt edilemez ve
 * bekçi her şeyi yeşil sanır.
 */
function yorumsuz(kaynak: string): string {
  return kaynak
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sayfalariBul(dizin: string, biriken: string[] = []): string[] {
  for (const ad of readdirSync(dizin)) {
    const tam = join(dizin, ad);
    if (statSync(tam).isDirectory()) sayfalariBul(tam, biriken);
    else if (ad === 'page.tsx') biriken.push(tam);
  }
  return biriken;
}

/** Yaprak sayfadan köke doğru metadata zinciri: layout'lar + sayfanın kendisi. */
function zincir(sayfaYolu: string): string[] {
  const halkalar = [sayfaYolu];
  let dizin = join(sayfaYolu, '..');
  while (dizin.startsWith(APP)) {
    const lay = join(dizin, 'layout.tsx');
    if (existsSync(lay)) halkalar.push(lay);
    dizin = join(dizin, '..');
  }
  return halkalar;
}

function rotaAdi(sayfaYolu: string): string {
  const r = '/' + relative(APP, join(sayfaYolu, '..')).replace(/\\/g, '/');
  return r === '/.' ? '/' : r;
}

// ── 1. Kök layout canonical TAŞIMAMALI (asıl hatanın nöbetçisi) ────────────
{
  const kok = yorumsuz(readFileSync(join(APP, 'layout.tsx'), 'utf8'));
  kontrol(
    'kök layout canonical taşımıyor',
    !/alternates\s*:/.test(kok),
    'app/layout.tsx yeniden `alternates` yazıyor — bu değer canonical yazmayan TÜM sayfalara miras kalır'
  );
}

// ── 2. Her rota ya canonical yazar ya noindex olur ─────────────────────────
const sayfalar = sayfalariBul(APP).sort();
kontrol('en az 20 rota tarandı', sayfalar.length >= 20, `bulunan: ${sayfalar.length}`);

for (const sayfa of sayfalar) {
  const kaynaklar = zincir(sayfa).map((y) => yorumsuz(readFileSync(y, 'utf8')));
  // `canonical:` değeri değişken de olabilir (`/ilan/[id]` şablon dizesi
  // kuruyor). `null`/`undefined` KABUL EDİLMEZ — `/panel` bilerek böyle yazdı
  // ve onu noindex kurtarıyor, canonical saydırmıyoruz.
  const canonicalVar = kaynaklar.some((k) =>
    /alternates\s*:\s*\{[^}]*canonical\s*:\s*(?!null\b|undefined\b)\S/.test(k)
  );
  const noindexVar = kaynaklar.some((k) => /robots\s*:\s*\{[^}]*index\s*:\s*false/.test(k));
  kontrol(
    `rota ${rotaAdi(sayfa)} — canonical veya noindex`,
    canonicalVar || noindexVar,
    'ikisi de yok; kök layout ne yayınlarsa onu devralır'
  );
}

// ── 3. Canonical'lar GÖRELİ olmalı ────────────────────────────────────────
// Mutlak alan adı yazmak `metadataBase`'i devre dışı bırakır; staging/preview
// ortamı canlı alan adını canonical ilan eder ve kendi sayfalarını gömer.
for (const sayfa of [...sayfalar, ...sayfalar.map((s) => join(s, '..', 'layout.tsx')).filter(existsSync)]) {
  const k = yorumsuz(readFileSync(sayfa, 'utf8'));
  const m = k.match(/canonical\s*:\s*['"`](https?:\/\/[^'"`]+)/);
  kontrol(`${relative(KOK, sayfa)} — canonical göreli`, !m, m ? `mutlak yazılmış: ${m[1]}` : '');
}

// ── 4. Ana sayfanın canonical'ı `/` ve `app/page.tsx`'te ──────────────────
{
  const anaSayfa = yorumsuz(readFileSync(join(APP, 'page.tsx'), 'utf8'));
  kontrol(
    "ana sayfa canonical '/' yazıyor",
    /alternates\s*:\s*\{\s*canonical\s*:\s*['"`]\/['"`]\s*\}/.test(anaSayfa),
    'kökten çekilen canonical `app/page.tsx`e taşınmalıydı'
  );
}

// ── 5. Yönetim yüzeyleri noindex ─────────────────────────────────────────
for (const segment of ['admin', 'moderator', 'panel', 'araclarim']) {
  const aday = [join(APP, segment, 'layout.tsx'), join(APP, segment, 'page.tsx')].filter(existsSync);
  const noindex = aday.some((y) => /robots\s*:\s*\{[^}]*index\s*:\s*false/.test(yorumsuz(readFileSync(y, 'utf8'))));
  kontrol(`/${segment} noindex`, noindex);
}

console.log(`\n${hatalar.length === 0 ? '✅' : '❌'} SEO metadata: ${gecti} geçti, ${hatalar.length} kaldı`);
for (const h of hatalar) console.log(`   ✗ ${h}`);
process.exit(hatalar.length === 0 ? 0 : 1);
