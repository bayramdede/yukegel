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

// ── 6. robots.txt sözleşmesi (10 Ağu 2026) ───────────────────────────────
// 🚨 NEDEN VAR: 8 Ağu'da AI-readiness için makine-okunur bir uç yazıldı
// (`/api/ilanlar/[id]`) ama `Disallow: /api/` onu DÖRT BLOKTA DA kapatıyordu —
// yani uç, kendisi için yazıldığı GPTBot/ClaudeBot'a kapalıydı. Hiçbir tsc/lint
// bunu göremez: robots.txt bir METİN dosyası, kod değil. Yakalayabilecek tek
// şey budur. Dosyanın kendi kuralı da "dört blok birebir aynı olacak" diyor;
// o kural şimdiye kadar YORUMLA korunuyordu, artık kontrolle korunuyor.
const robots = readFileSync(join(KOK, 'public/robots.txt'), 'utf8');
const bloklar = robots.split(/^User-agent:/m).slice(1);
kontrol('robots.txt dört User-agent bloğu taşıyor', bloklar.length === 4,
  `bulunan: ${bloklar.length}`);

// Her blokta özel alanlar kapalı OLMAK ZORUNDA — biri atlanırsa panel taranır.
const ZORUNLU_KAPALI = ['/admin/', '/moderator/', '/moderator-giris/', '/panel/',
                        '/api/', '/araclarim/', '/profil-tamamla/', '/auth/'];
for (const [i, blok] of bloklar.entries()) {
  const ad = blok.split('\n')[0].trim();
  for (const yol of ZORUNLU_KAPALI) {
    kontrol(`robots blok #${i + 1} (${ad}) → Disallow: ${yol}`,
      blok.includes(`Disallow: ${yol}`));
  }
  // Makine-okunur uç HER blokta açık olmalı; `/api/ilanlar/` daha uzun olduğu
  // için Google'da `Disallow: /api/`yi yener (en spesifik kural kazanır).
  kontrol(`robots blok #${i + 1} (${ad}) → Allow: /api/ilanlar/`,
    blok.includes('Allow: /api/ilanlar/'));
}

// ⚠️ `/api/` altında AÇILAN tek yol `/api/ilanlar/` olmalı. Yeni bir Allow
//    eklenirse burası kırmızı yanar ve o ucun yanıtı elden geçirilmeye zorlanır
//    (hassas alan sızdırıyor mu?).
const apiAllowlari = [...robots.matchAll(/^Allow: (\/api\/[^\s]*)$/gm)].map(m => m[1]);
kontrol('robots.txt: /api/ altında yalnız /api/ilanlar/ açık',
  apiAllowlari.every(y => y === '/api/ilanlar/'),
  `bulunan: ${[...new Set(apiAllowlari)].join(', ')}`);

// Sitemap yönlenmeyen host ile verilmeli (apex 307 ile www'ye gidiyor).
kontrol('robots.txt Sitemap satırı www host kullanıyor',
  robots.includes('Sitemap: https://www.yukegel.com/sitemap.xml'));

// 🚨🚨 EN ÖNEMLİ KONTROL (10 Ağu 2026) — `noindex` + `Disallow` ÇAKIŞMASI.
// `noindex` etiketinin çalışması için sayfanın TARANABİLİR olması şarttır: Google
// sayfayı çekemezse etiketi hiç görmez. İkisini birlikte kullanmak net etki olarak
// İKİSİNİ DE öldürür ve URL "engellendi" durumunda çakılı kalır — Search Console'da
// "Düzeltmeyi doğrula" sonsuza kadar "beklemede" der (8-10 Ağu'da tam bu yaşandı).
//
// `/giris` HERKESE AÇIK SAYFALARDAN BAĞLANTILI (her ilan sayfası + footer), yani
// Google onu mutlaka keşfediyor → taranabilir OLMAK ZORUNDA ki noindex okunsun.
kontrol('robots.txt `/giris`i YASAKLAMIYOR (noindex okunabilsin)',
  !/^Disallow: \/giris$/m.test(robots),
  'Disallow + noindex birlikte ikisini de öldürür; /giris public bağlantılı.');
const girisLayout = readFileSync(join(APP, 'giris/layout.tsx'), 'utf8');
kontrol('/giris noindex taşıyor (yasak yerine bu çalışıyor)',
  /index:\s*false/.test(yorumsuz(girisLayout)));

// ⚠️ Auth arkasındaki yüzeylerde aynı çakışma BİLİNÇLİ duruyor: public bağlantı
//    olmadığı için Google keşfetmiyor, rapor gürültüsü üretmiyorlar ve yasak
//    "taranmasın bile" demek. Bu listenin daralması bir KARAR olmalı, kaza değil —
//    bu yüzden sayı sabitlendi.
const cakisanlar = ['/admin/', '/panel/', '/moderator/', '/araclarim/',
                    '/profil-tamamla/', '/auth/']
  .filter(y => robots.includes(`Disallow: ${y}`));
kontrol('auth arkası 6 yüzey bilinçli olarak hem Disallow hem noindex',
  cakisanlar.length === 6, `bulunan: ${cakisanlar.length} → ${cakisanlar.join(', ')}`);

// 🚨 Her ilan sayfasındaki giriş bağlantısı `nofollow` OLMAK ZORUNDA. Olmazsa
//    `redirect` parametresi yüzünden her ilan için ayrı bir yasaklı URL doğar ve
//    Search Console "Robots.txt tarafından engellendi" bildirimi gönderir
//    (8 Ağu 2026'da tam bu oldu). robots.txt keşiften SONRA reddeder; asıl
//    çözüm keşfi engellemek.
const ilanSayfasi = readFileSync(join(APP, 'ilan/[id]/page.tsx'), 'utf8');
const girisBaglantisi = /<a\s+href=\{`\/giris\?redirect=[^`]*`\}([^>]*)>/.exec(ilanSayfasi);
kontrol('ilan sayfasında /giris?redirect= bağlantısı bulundu', Boolean(girisBaglantisi));
kontrol('o bağlantı rel="nofollow" taşıyor',
  Boolean(girisBaglantisi) && /rel="nofollow"/.test(girisBaglantisi![1]),
  girisBaglantisi ? `nitelikler: ${girisBaglantisi[1].trim().slice(0, 80)}` : 'bağlantı yok');

console.log(`\n${hatalar.length === 0 ? '✅' : '❌'} SEO metadata: ${gecti} geçti, ${hatalar.length} kaldı`);
for (const h of hatalar) console.log(`   ✗ ${h}`);
process.exit(hatalar.length === 0 ? 0 : 1);
