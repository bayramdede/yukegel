// scripts/olc-88.mts — `npm run olc:88`
//
// NE ÖLÇER: #88'in İKİ Pass-2 düzeltmesi, şerit çıkaramamış gerçek satırlarda
// kaç ilan kazandırıyor — ve HANGİSİ ne kadar kazandırıyor. Dört varyant aynı
// satırlarda koşturulur: eski · sadece A · sadece B · yeni (ikisi birden).
//
// #88-A  `isYuklemeli` yalnız "yukle" ALT DİZİSİNE bakıyor. "yüklenmez",
//        "yüklenir", "yükleme üstene birşey konulmaz" gibi DOLGU satırları da
//        ateşliyordu; o satırlarda yer olmadığı için `blockOrigin` NULL'lanıyor,
//        altındaki "Teslim Yeri ..." satırı sahipsiz kalıyordu.
// #88-B  Reset koşulundaki `splitByRelation(line) !== null`, BLOCK_RESET_RE'nin
//        bilinçle dışarıda bıraktığı BOŞLUKSUZ tireyi arka kapıdan geri sokuyordu:
//        "(KISA-UZUN) DORSE" → rel:'dash_nospace' → blok resetleniyordu.
//
// 🚨 NİYE AYRI SCRIPT, NİYE BAYRAM ÇALIŞTIRIYOR: bkz. `scripts/olc-86.mts` başlığı.
//    Özet: ölçüm hem canlı veri hem gerçek parser ister; kum havuzunun
//    `supabase.co` erişimi yok ve veriyi elle taşımak ÖLÇÜLDÜ + BOZUK çıktı.
//
// ⚠️ PARSER KODU ELLE KOPYALANMAZ — `index.ts`ten çalışma anında sökülür.
//    Varyantlar da bu kaynaktan STRING DEĞİŞİMİYLE üretilir; değişim tutmazsa
//    script patlar (sessizce "eski = yeni" ölçüp 0 kazanç raporlamasın diye).
//
// NOT: `.env.local` okunur; anahtarlar hiçbir yere yazılmaz/basılmaz.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const KOK = resolve(import.meta.dirname, '..');
const KAYNAK = join(KOK, 'supabase/functions/parse-listing/index.ts');

// ── Varyant üretimi ───────────────────────────────────────────────────────────
const A_YENI = `        const yeniOrigin = bestPlace(yuklemePlaces)
        if (!yeniOrigin) continue
        blockOrigin = yeniOrigin`;
const A_ESKI = `        blockOrigin = bestPlace(yuklemePlaces)`;

const B_YENI = `      if (blockOrigin && (
        ARROW_RE.test(line) || BLOCK_RESET_RE.test(line) ||
        (splitByRelation(line) !== null && findPlaces(line, aliases).length > 0)
      )) {`;
const B_ESKI = `      if (blockOrigin && (ARROW_RE.test(line) || BLOCK_RESET_RE.test(line) || splitByRelation(line) !== null)) {`;

function cekirdek(): string {
  const s = readFileSync(KAYNAK, 'utf8').split('\n');
  const bas = s.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const pm = s.findIndex(l => l.startsWith('function parseMessage'));
  if (bas < 0 || pm < 0) throw new Error('index.ts imzaları bulunamadı — dosya biçimi değişmiş');
  let son = -1;
  for (let i = pm + 1; i < s.length; i++) if (s[i] === '}') { son = i; break; }
  if (son < 0) throw new Error('parseMessage sonu bulunamadı');
  return s.slice(bas, son + 1).join('\n') + '\nexport { parseMessage, cleanMessage }\n';
}

const dizin = mkdtempSync(join(tmpdir(), 'olc88-'));
const yeniKod = cekirdek();
for (const [ad, parca] of [['#88-A', A_YENI], ['#88-B', B_YENI]] as const) {
  if (!yeniKod.includes(parca)) {
    throw new Error(`${ad} düzeltmesi kaynakta YOK — geri mi alındı? Ölçüm anlamsız.`);
  }
}

// Varyantlar: hangi düzeltme AÇIK
const varyantlar = {
  eski:  yeniKod.replace(A_YENI, A_ESKI).replace(B_YENI, B_ESKI),
  yalnizA: yeniKod.replace(B_YENI, B_ESKI),
  yalnizB: yeniKod.replace(A_YENI, A_ESKI),
  yeni: yeniKod,
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

const satirlar = await tumSayfalar<any>((b, s) =>
  db.from('raw_posts').select('id,raw_text,created_at')
    .eq('processing_status', 'no_lane').is('processed_at', null)
    .gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString())
    .order('created_at', { ascending: false }).range(b, s));

const { count: aliasSayisi } = await db.from('aliases')
  .select('id', { count: 'exact', head: true }).eq('is_active', true);
console.log(`alias: ${aliases.length} (tabloda ${aliasSayisi}) · ölçülen satır: ${satirlar.length}`);
if (aliasSayisi != null && aliases.length !== aliasSayisi) {
  throw new Error(`ALIAS EKSİK: ${aliases.length}/${aliasSayisi} çekildi — ölçüm güvenilmez, sayfalama bozuk.`);
}
console.log();

// ── Karşılaştır ───────────────────────────────────────────────────────────────
const ADLAR = ['eski', 'yalnizA', 'yalnizB', 'yeni'] as const;
type Ad = typeof ADLAR[number];

function seritSayisi(ad: Ad, t: string): number | null {
  try { return M[ad].parseMessage(M[ad].cleanMessage(t), aliases).lanes.length; }
  catch { return null; }
}

const sonuc: Record<Ad, { kazanc: number; kayip: number }> =
  { eski: { kazanc: 0, kayip: 0 }, yalnizA: { kazanc: 0, kayip: 0 }, yalnizB: { kazanc: 0, kayip: 0 }, yeni: { kazanc: 0, kayip: 0 } };
const kazananlar: { id: string; sayi: number; hangi: string; ornek: string }[] = [];
let patlak = 0;

for (const r of satirlar as any[]) {
  const t = r.raw_text || '';
  const e = seritSayisi('eski', t);
  if (e === null) { patlak++; continue; }
  let atla = false;
  const y: Record<string, number> = {};
  for (const ad of ADLAR.slice(1)) {
    const v = seritSayisi(ad, t);
    if (v === null) { atla = true; break; }
    y[ad] = v;
  }
  if (atla) { patlak++; continue; }
  for (const ad of ADLAR.slice(1)) {
    if (e === 0 && y[ad] > 0) sonuc[ad].kazanc++;
    else if (e > 0 && y[ad] === 0) sonuc[ad].kayip++;
  }
  if (e === 0 && y.yeni > 0) {
    // Hangi düzeltmenin payı: yalnızA mı, yalnızB mi, yoksa ikisi birlikte mi
    const hangi = y.yalnizA > 0 && y.yalnizB > 0 ? 'A+B(ikisi de tek başına yeter)'
      : y.yalnizA > 0 ? 'A' : y.yalnizB > 0 ? 'B' : 'yalnız İKİSİ BİRDEN';
    const satir = M.yeni.cleanMessage(t).split('\n').map((l: string) => l.trim()).find((l: string) => l.length > 3) ?? '';
    kazananlar.push({ id: r.id, sayi: y.yeni, hangi, ornek: satir.slice(0, 60) });
  }
}

console.log('─'.repeat(78));
console.log('varyant     KAZANÇ (0→≥1)   KAYIP (≥1→0)');
for (const ad of ADLAR.slice(1)) {
  console.log(`${ad.padEnd(11)} ${String(sonuc[ad].kazanc).padStart(9)}   ${String(sonuc[ad].kayip).padStart(12)}${sonuc[ad].kayip ? '  🚨' : ''}`);
}
console.log(`hata verdi  ${String(patlak).padStart(9)}`);
console.log('─'.repeat(78));
console.log('⚠️  KAYIP sütunu 0 OLMALI. Değilse düzeltme daha önce çalışan satırı bozuyor.');
console.log('⚠️  KAZANÇ "şerit üretti" demek, "şerit DOĞRU" demek DEĞİL — örnekler elle denetlenmeli.');

if (kazananlar.length) {
  const pay: Record<string, number> = {};
  for (const k of kazananlar) pay[k.hangi] = (pay[k.hangi] || 0) + 1;
  console.log('\nKazancın dağılımı:');
  for (const [h, n] of Object.entries(pay).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${h}`);
  console.log('\nÖrnekler:');
  for (const k of kazananlar.slice(0, 30)) {
    console.log(`  ${k.id.slice(0, 8)}  +${k.sayi} şerit  [${k.hangi}]  "${k.ornek}"`);
  }
}

const oran = satirlar.length ? (100 * sonuc.yeni.kazanc / satirlar.length).toFixed(1) : '0';
console.log(`\n📌 DÜRÜST OKUMA: 30 günde şerit çıkaramamış ${satirlar.length} satırın`);
console.log(`   ${sonuc.yeni.kazanc} tanesi (%${oran}) #88'in iki Pass-2 düzeltmesiyle şerit üretiyor.`);
console.log(`   Bu ölçüm #86 düzeltmesi AÇIKKEN yapılır — yani #86'nın payı buna DAHİL DEĞİL,`);
console.log(`   dört varyantın hepsi #86'lı koddan türetiliyor.`);
