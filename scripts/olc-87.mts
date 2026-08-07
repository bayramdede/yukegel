// scripts/olc-87.mts — `npm run olc:87`
//
// NE ÖLÇER: #87'nin ÜÇ düzeltmesi, canlı satırlarda ŞERİT KÜMESİNİ nasıl
// değiştiriyor. #86/#88'den FARKLI bir soru soruyor ve bu fark scriptin
// tamamını şekillendiriyor:
//
//   #86 ve #88 "şerit ÇIKMAYAN satır şerit çıkarır mı" diye sordu → `no_lane`
//   satırlarını taradı, 0→≥1 saydı. #87'nin zararı ORADA DEĞİL. #87'de satır
//   şerit üretiyor, `processed` damgasını yiyor, panelde sapasağlam görünüyor —
//   ama şerit YANLIŞ: ya varış düşmüş ya köken uydurulmuş. Sıfırdan sayarak
//   ölçersen bu kanalı GÖREMEZSİN. Bu yüzden burada:
//     · `processed` VE `no_lane` birlikte taranır,
//     · 0→≥1 değil, ŞERİT KÜMESİ karşılaştırılır (eklenen / silinen tek tek),
//     · "silinen şerit" bir alarm değil, düzeltmenin ta kendisidir (#87-D'nin
//       temizlediği uydurma şeritler) — ama HER BİRİ elle denetlenmek zorunda.
//
// #87-A  `splitByRelation` ok kolunda `if (left && right)` şartı vardı. Solu boş
//        ok satırı ("➡️SAMSUN") İLİŞKİSİZ sayılıyor, parseMessage'ın "ok solunda
//        şehir yoksa contextFrom kullan" yedeği ULAŞILAMAZ ÖLÜ KOD kalıyordu.
// #87-B  Pass 1 kökeni `rel.left.trim() ? bestPlace(...) : contextFrom` idi. Sol
//        DOLU ama yersizse ("13.60 TIR -> ANKARA") satır sessizce düşüyordu.
// #87-D  Pass 1'in `+` kolu `+`ı tek başına "çoklu varış" sayıyordu; fiyat
//        satırları ("duzce 1200+kdv") uydurma şerit doğuruyordu.
//        (#87-C yazıldı, ölçüldü, GERİ ALINDI — bkz. scripts/test-87.mts başlığı.)
//
// 🚨 NİYE AYRI SCRIPT, NİYE BAYRAM ÇALIŞTIRIYOR: bkz. `scripts/olc-86.mts` başlığı.
//    Özet: ölçüm hem canlı veri hem gerçek parser ister; kum havuzunun
//    `supabase.co` erişimi yok ve veriyi elle taşımak ÖLÇÜLDÜ + BOZUK çıktı.
//
// ⚠️ PARSER KODU ELLE KOPYALANMAZ — `index.ts`ten çalışma anında sökülür.
//    Varyantlar da bu kaynaktan STRING DEĞİŞİMİYLE üretilir; değişim tutmazsa
//    script PATLAR (sessizce "eski = yeni" ölçüp 0 kazanç raporlamasın diye).
//
// NOT: `.env.local` okunur; anahtarlar hiçbir yere yazılmaz/basılmaz.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const KOK = resolve(import.meta.dirname, '..');
const KAYNAK = join(KOK, 'supabase/functions/parse-listing/index.ts');

// ── Varyant üretimi ───────────────────────────────────────────────────────────
const A_YENI = `      if (right) return { left, right, rel: 'arrow' }`;
const A_ESKI = `      if (left && right) return { left, right, rel: 'arrow' }`;

const B_YENI = `    const from = bestPlace(findPlaces(rel.left, aliases)) || contextFrom`;
const B_ESKI = `    const from = rel.left.trim() ? bestPlace(findPlaces(rel.left, aliases)) : contextFrom`;

const D_YENI = `        if (parts.length > 1 && yerliParca.length >= 2) {`;
const D_ESKI = `        if (parts.length > 1) {`;

function cekirdek(): string {
  const s = readFileSync(KAYNAK, 'utf8').split('\n');
  const bas = s.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const pm = s.findIndex(l => l.startsWith('function parseMessage'));
  if (bas < 0 || pm < 0) throw new Error('index.ts imzaları bulunamadı — dosya biçimi değişmiş');
  let son = -1;
  for (let i = pm + 1; i < s.length; i++) if (s[i] === '}') { son = i; break; }
  if (son < 0) throw new Error('parseMessage sonu bulunamadı');
  return s.slice(bas, son + 1).join('\n') + '\nexport { parseMessage, cleanMessage, splitByRelation }\n';
}

const dizin = mkdtempSync(join(tmpdir(), 'olc87-'));
const yeniKod = cekirdek();
for (const [ad, parca] of [['#87-A', A_YENI], ['#87-B', B_YENI], ['#87-D', D_YENI]] as const) {
  if (!yeniKod.includes(parca)) {
    throw new Error(`${ad} düzeltmesi kaynakta YOK — geri mi alındı? Ölçüm anlamsız.`);
  }
}

const varyantlar = {
  eski:    yeniKod.replace(A_YENI, A_ESKI).replace(B_YENI, B_ESKI).replace(D_YENI, D_ESKI),
  yalnizA: yeniKod.replace(B_YENI, B_ESKI).replace(D_YENI, D_ESKI),
  yalnizB: yeniKod.replace(A_YENI, A_ESKI).replace(D_YENI, D_ESKI),
  yalnizD: yeniKod.replace(A_YENI, A_ESKI).replace(B_YENI, B_ESKI),
  yeni:    yeniKod,
};
const M: Record<string, any> = {};
for (const [ad, kod] of Object.entries(varyantlar)) {
  if (ad !== 'yeni' && kod === yeniKod) throw new Error(`${ad} mutantı üretilemedi — string değişimi tutmadı`);
  const yol = join(dizin, `${ad}.mts`);
  writeFileSync(yol, kod, 'utf8');
  M[ad] = await import(yol);
}

// ── Canlı veri ────────────────────────────────────────────────────────────────
// 🔑 İLK GEÇEN KAZANIR (dotenv semantiği). `.env.local`de SUPABASE_SERVICE_ROLE_KEY
//    iki kez geçiyor ve İKİNCİSİ BOZUK (4 parçalı JWT). `Object.fromEntries` SON
//    geçeni alır → `Invalid API key`. Bkz. olc-86.mts.
const env: Record<string, string> = {};
for (const l of readFileSync(join(KOK, '.env.local'), 'utf8').split('\n')) {
  if (!l.includes('=') || l.trim().startsWith('#')) continue;
  const i = l.indexOf('=');
  const k = l.slice(0, i).trim();
  if (k in env) continue;
  env[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 🚨 SAYFALAMA ŞART — PostgREST tek istekte en fazla 1000 satır döndürür ve
//    `.limit(N)` bu SUNUCU tavanını KALDIRMAZ. olc-86'nın ilk sürümü tam olarak
//    buna takıldı: 1242 alias'ın 1000'iyle ölçtü, kazanç 40 çıktı — gerçeği 46'ydı.
const SAYFA = 1000;
async function tumSayfalar<T>(kur: (b: number, s: number) => any): Promise<T[]> {
  const hepsi: T[] = [];
  for (let b = 0; ; b += SAYFA) {
    const { data, error } = await kur(b, b + SAYFA - 1);
    if (error) throw error;
    const p = (data || []) as T[];
    hepsi.push(...p);
    if (p.length < SAYFA) return hepsi;
  }
}

const aliases = await tumSayfalar<any>((b, s) =>
  db.from('aliases').select('id,type,alias,normalized,priority,district,is_active')
    .eq('is_active', true).order('id', { ascending: true }).range(b, s));

const { count: aliasSayisi } = await db.from('aliases')
  .select('id', { count: 'exact', head: true }).eq('is_active', true);
if (aliasSayisi != null && aliases.length !== aliasSayisi) {
  throw new Error(`ALIAS EKSİK: ${aliases.length}/${aliasSayisi} çekildi — ölçüm güvenilmez, sayfalama bozuk.`);
}

const GUN = 30;
const esik = new Date(Date.now() - GUN * 864e5).toISOString();

// 🚨 #86/#88'den AYRILAN YER: `processed` DE taranıyor. #87'nin zararının
//    tamamı orada — satır başarılı görünüyor, şerit yanlış.
const satirlar = await tumSayfalar<any>((b, s) =>
  db.from('raw_posts').select('id,raw_text,processing_status,created_at')
    .in('processing_status', ['processed', 'no_lane'])
    .gte('created_at', esik)
    .order('created_at', { ascending: false }).range(b, s));

const { count: satirSayisi } = await db.from('raw_posts')
  .select('id', { count: 'exact', head: true })
  .in('processing_status', ['processed', 'no_lane']).gte('created_at', esik);
if (satirSayisi != null && satirlar.length !== satirSayisi) {
  throw new Error(`SATIR EKSİK: ${satirlar.length}/${satirSayisi} çekildi — ölçüm güvenilmez.`);
}

const durumSayisi = satirlar.reduce((a: Record<string, number>, r: any) => {
  a[r.processing_status] = (a[r.processing_status] || 0) + 1; return a;
}, {});
console.log(`alias: ${aliases.length}/${aliasSayisi} · satır: ${satirlar.length}/${satirSayisi} (son ${GUN} gün)`);
console.log(`  durum dağılımı: ${Object.entries(durumSayisi).map(([k, v]) => `${k}=${v}`).join(' · ')}\n`);

// ── Karşılaştır ───────────────────────────────────────────────────────────────
const ADLAR = ['eski', 'yalnizA', 'yalnizB', 'yalnizD', 'yeni'] as const;
type Ad = typeof ADLAR[number];

// Şerit anahtarı: parser çıktısı zaten normalize (aynı alias tablosu her varyantta),
// o yüzden düz birleştirme yeterli — katlama (`laneKey`) gerekmez.
const sk = (l: any) => `${l.from}/${l.fromDistrict || ''}→${l.to}/${l.toDistrict || ''}`;

function seritler(ad: Ad, t: string): Set<string> | null {
  try { return new Set(M[ad].parseMessage(M[ad].cleanMessage(t), aliases).lanes.map(sk)); }
  catch { return null; }
}

// #87 imzası: SOLU BOŞ ok satırı içeren satırlar. Kapsamı daraltmak için değil,
// kazancın gerçekten bu kalıptan gelip gelmediğini SAĞLAMASI için.
function solBosOkVar(ad: Ad, t: string): boolean {
  try {
    return M[ad].cleanMessage(t).split('\n').some((l: string) => {
      const r = M[ad].splitByRelation(l.trim());
      return r !== null && r.rel === 'arrow' && r.left === '';
    });
  } catch { return false; }
}

type Sayac = { kazanc: number; kayip: number; eklenen: number; silinen: number; degisen: number };
const yeniSayac = (): Sayac => ({ kazanc: 0, kayip: 0, eklenen: 0, silinen: 0, degisen: 0 });
const sonuc: Record<string, Sayac> = Object.fromEntries(ADLAR.slice(1).map(a => [a, yeniSayac()]));

const kayipOrnek: any[] = [];
const eklenenOrnek: any[] = [];
const silinenOrnek: any[] = [];
let patlak = 0, imzali = 0, imzaliDegisen = 0;

for (const r of satirlar as any[]) {
  const t = r.raw_text || '';
  const e = seritler('eski', t);
  if (e === null) { patlak++; continue; }
  const v: Record<string, Set<string>> = {};
  let atla = false;
  for (const ad of ADLAR.slice(1)) {
    const s = seritler(ad, t);
    if (s === null) { atla = true; break; }
    v[ad] = s;
  }
  if (atla) { patlak++; continue; }

  const imza = solBosOkVar('yeni', t);
  if (imza) imzali++;

  for (const ad of ADLAR.slice(1)) {
    const y = v[ad];
    const eklenen = [...y].filter(x => !e.has(x));
    const silinen = [...e].filter(x => !y.has(x));
    if (!eklenen.length && !silinen.length) continue;
    const s = sonuc[ad];
    s.degisen++;
    s.eklenen += eklenen.length;
    s.silinen += silinen.length;
    if (e.size === 0 && y.size > 0) s.kazanc++;
    if (e.size > 0 && y.size === 0) s.kayip++;

    if (ad !== 'yeni') continue;
    if (imza) imzaliDegisen++;
    const ozet = {
      id: r.id.slice(0, 8), durum: r.processing_status, imza: imza ? '✓' : '·',
      eski: [...e].join(' , ') || '(yok)', yeni: [...y].join(' , ') || '(yok)',
      metin: M.yeni.cleanMessage(t).replace(/\n/g, ' ⏎ ').slice(0, 110),
    };
    if (e.size > 0 && y.size === 0) kayipOrnek.push(ozet);
    else if (silinen.length) silinenOrnek.push(ozet);
    else if (eklenen.length) eklenenOrnek.push(ozet);
  }
}

// ── Rapor ─────────────────────────────────────────────────────────────────────
const C = 78;
console.log('─'.repeat(C));
console.log('varyant     satır DEĞİŞTİ   şerit EKLENDİ   şerit SİLİNDİ   0→≥1   ≥1→0');
for (const ad of ADLAR.slice(1)) {
  const s = sonuc[ad];
  console.log(
    `${ad.padEnd(11)} ${String(s.degisen).padStart(12)}   ${String(s.eklenen).padStart(13)}` +
    `   ${String(s.silinen).padStart(13)}   ${String(s.kazanc).padStart(4)}   ${String(s.kayip).padStart(4)}${s.kayip ? ' 🚨' : ''}`
  );
}
console.log(`hata verdi  ${String(patlak).padStart(12)}`);
console.log('─'.repeat(C));
console.log(`#87 imzası (solu boş ok) taşıyan satır: ${imzali}`);
console.log(`  bunların ${imzaliDegisen} tanesinde şerit kümesi değişti` +
  ` (değişen satırların %${sonuc.yeni.degisen ? (100 * imzaliDegisen / sonuc.yeni.degisen).toFixed(1) : '0'}'i)`);
console.log('─'.repeat(C));
console.log('⚠️  "≥1→0" (KAYIP) sütunu 0 OLMALI. Değilse düzeltme çalışan bir satırı öldürüyor.');
console.log('⚠️  "şerit SİLİNDİ" ALARM DEĞİL — #87-D\'nin temizlediği uydurma şeritler burada');
console.log('    görünür. Ama her biri gerçekten uydurma mıydı, ÖRNEKLERDEN elle doğrula.');
console.log('⚠️  "şerit EKLENDİ" de "şerit DOĞRU" demek DEĞİL — aynı şekilde elle denetle.');

function bas(baslik: string, liste: any[], n: number) {
  if (!liste.length) return;
  console.log(`\n${baslik} (${liste.length} satır, ilk ${Math.min(n, liste.length)}):`);
  for (const o of liste.slice(0, n)) {
    console.log(`  ${o.id} [${o.durum}] imza:${o.imza}`);
    console.log(`      eski: ${o.eski}`);
    console.log(`      yeni: ${o.yeni}`);
    console.log(`      metin: "${o.metin}"`);
  }
}

bas('🚨 KAYIP — şerit vardı, YOK OLDU (bunlar hata, hepsini incele)', kayipOrnek, 50);
bas('♻️  ŞERİT DEĞİŞTİ/SİLİNDİ — uydurma temizliği mi, gerçek kayıp mı?', silinenOrnek, 25);
bas('➕ ŞERİT EKLENDİ — kurtarılan varışlar', eklenenOrnek, 25);

const oran = satirlar.length ? (100 * sonuc.yeni.degisen / satirlar.length).toFixed(1) : '0';
console.log(`\n📌 DÜRÜST OKUMA: son ${GUN} günün ${satirlar.length} satırından ${sonuc.yeni.degisen} tanesinin`);
console.log(`   (%${oran}) şerit kümesi #87 ile DEĞİŞİYOR: ${sonuc.yeni.eklenen} şerit eklendi,`);
console.log(`   ${sonuc.yeni.silinen} şerit silindi. Bu bir "kazanç" sayısı DEĞİL — düzeltmenin`);
console.log(`   DOKUNDUĞU yüzeyin büyüklüğü. Kazanç iddiası ancak yukarıdaki örnekler elle`);
console.log(`   denetlendikten sonra yazılabilir; #86/#88'in "0→≥1" sayısıyla kıyaslanamaz.`);
console.log(`   Ölçüm #86 ve #88 düzeltmeleri AÇIKKEN yapılır — onların payı buna DAHİL DEĞİL.`);
