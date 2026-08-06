// scripts/olc-86.mts — `npm run olc:86`
//
// NE ÖLÇER: #86 (vekil çifti silme hatası) düzeltilince, şerit çıkaramamış
// gerçek satırlarda KAÇ TANESİ şerit üretmeye başlıyor. Yani "kod doğru oldu"
// değil, "kaç ilan kazanıyoruz" sorusunu yanıtlar.
//
// 🚨 NİYE AYRI BİR SCRIPT, NİYE BAYRAM ÇALIŞTIRIYOR:
//    Ölçüm iki şeyi AYNI ANDA ister — (a) canlı Supabase verisi, (b) gerçek
//    parser kodu. Benim kum havuzumun ağ izni yok (`supabase.co` allowlist
//    dışı, curl exit 56), veriyi elle taşımak ise ÖLÇÜLDÜ ve BOZUK: 6 Ağu'da
//    250 alias'lık tek sayfa elle taşındı, md5 tutmadı, `dogubayazit` →
//    `dogubayazio` olmuştu. Sessiz bir bozulma, ölçümü sessizce yalanlar.
//    Bu yüzden veri hiç insan/model elinden geçmiyor: script kendisi çekiyor.
//
// ⚠️ PARSER KODU ELLE KOPYALANMAZ. `index.ts`ten çalışma anında sökülür.
//    Sebebi #86'nın kendisi: #63'ün ilk testi regex zincirini elle kopyaladığı
//    için, kopyada olmayan :150 satırı yüzünden YANLIŞ YERE GEÇMİŞTİ.
//
// ÇIKTI: eski kod vs yeni kod, satır satır şerit sayısı farkı.
//        Sadece 0 → ≥1 geçişleri "kazanç" sayılır.
//
// NOT: `.env.local` okunur; anahtarlar hiçbir yere yazılmaz/basılmaz.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const KOK = resolve(import.meta.dirname, '..');
const KAYNAK = join(KOK, 'supabase/functions/parse-listing/index.ts');

const YENI_RE = '/[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]/g';
const ESKI_RE = '/[\\uD800-\\uDFFF]/g';

// ── 1) Parser çekirdeğini kaynaktan sök ───────────────────────────────────────
function cekirdek(): string {
  const s = readFileSync(KAYNAK, 'utf8').split('\n');
  const bas = s.findIndex(l => l.startsWith('const BLACKLIST_PHRASES'));
  const pm = s.findIndex(l => l.startsWith('function parseMessage'));
  if (bas < 0 || pm < 0) throw new Error('index.ts imzaları bulunamadı — dosya biçimi değişmiş');
  let son = -1;
  for (let i = pm + 1; i < s.length; i++) if (s[i] === '}') { son = i; break; }
  if (son < 0) throw new Error('parseMessage sonu bulunamadı');
  // 130..864 aralığı kendi kendine yeter: Alias/PlaceHit/Lane arayüzleri de içinde.
  return s.slice(bas, son + 1).join('\n') + '\nexport { parseMessage, cleanMessage }\n';
}

const dizin = mkdtempSync(join(tmpdir(), 'olc86-'));
const yeniKod = cekirdek();
if (!yeniKod.includes(YENI_RE)) {
  throw new Error('YENİ vekil regex\'i kaynakta yok — #86 düzeltmesi geri mi alındı?');
}
const eskiKod = yeniKod.replace(YENI_RE, ESKI_RE);
if (eskiKod === yeniKod) throw new Error('mutant üretilemedi');

const yYol = join(dizin, 'yeni.mts'); writeFileSync(yYol, yeniKod, 'utf8');
const eYol = join(dizin, 'eski.mts'); writeFileSync(eYol, eskiKod, 'utf8');
const YENI = await import(yYol) as any;
const ESKI = await import(eYol) as any;

// ── 2) Canlı veriyi çek ───────────────────────────────────────────────────────
// 🚨 İLK GEÇEN KAZANIR — `Object.fromEntries` DEĞİL.
//    `.env.local` içinde SUPABASE_SERVICE_ROLE_KEY İKİ KEZ geçiyor (satır 3 ve 5).
//    Satır 5'teki bozuk: JWT tam olarak `header.payload.signature` yani 3 parça
//    olmalı, oradaki 4 parça (219 vs 256 karakter). İkisinin claim'leri aynı.
//    dotenv ve Next.js İLK geçeni alır; `Object.fromEntries` SON geçeni alır →
//    bu script uygulamanın kullandığından FARKLI (bozuk) anahtarı seçiyordu ve
//    `Invalid API key` veriyordu. Uygulama çalışırken script patlıyordu.
const env: Record<string, string> = {};
for (const l of readFileSync(join(KOK, '.env.local'), 'utf8').split('\n')) {
  if (!l.includes('=') || l.trim().startsWith('#')) continue;
  const i = l.indexOf('=');
  const k = l.slice(0, i).trim();
  if (k in env) continue;                       // ilk geçen kazanır
  env[k] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 🚨 SAYFALAMA ŞART — PostgREST tek istekte en fazla 1000 satır döndürür ve
//    `.limit(5000)` bu SUNUCU tavanını KALDIRMAZ, sessizce 1000'de kesilirsin.
//    Bu tam olarak `parse-listing/index.ts:70`'te not düşülmüş hata: "aliases
//    tablosu 1000'i geçtiği için şehir tespiti alias'ların yarısını hiç
//    görmeden yapılıyordu". Canlı parser `.range()` ile sayfalıyor; bu script
//    ilk sürümde sayfalamıyordu ve 1242 alias'ın 1000'iyle ölçüm yaptı →
//    kazanç OLDUĞUNDAN AZ çıktı. Eksik alias asla yanlış şerit üretmez, sadece
//    şerit BULDURMAZ; yani hatalı ölçüm hep aşağı yönlü yanılır (KAYIP'ı şişirmez).
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

// Sessiz kesilmeye karşı açık kontrol: sayı tam yuvarlaksa şüphelen.
const { count: aliasSayisi } = await db.from('aliases')
  .select('id', { count: 'exact', head: true }).eq('is_active', true);
console.log(`alias: ${aliases.length} (tabloda ${aliasSayisi}) · ölçülen satır: ${satirlar.length}`);
if (aliasSayisi != null && aliases.length !== aliasSayisi) {
  throw new Error(`ALIAS EKSİK: ${aliases.length}/${aliasSayisi} çekildi — ölçüm güvenilmez, sayfalama bozuk.`);
}
console.log();

// ── 3) Karşılaştır ────────────────────────────────────────────────────────────
const kazanan: { id: string; eski: number; yeni: number; ornek: string }[] = [];
const kaybeden: { id: string; eski: number; yeni: number }[] = [];
// 🚨 ŞÜPHELİ = "kazanç" sayılan ama şeritleri YANLIŞ olabilen satırlar (#87).
//    Kalıp: birkaç satır KÖKEN listesi, ardından solu boş bir varış satırı —
//    `->samsun`. Parser o satırı ayrıştıramıyor, varışı DÜŞÜRÜYOR ve köken
//    listesindeki şehirleri BİRBİRİYLE eşliyor. Örnek 99183fb8:
//    duzce/akyazi/bartin ➡ samsun  →  ürettiği: Düzce→Sakarya, Düzce→Bartın.
//    Yani üç doğru şerit yerine iki UYDURMA şerit. `KAYIP` sütunu bunu GÖREMEZ
//    (o yalnız ≥1 → 0 geçişini ölçer), o yüzden ayrı sayılıyor.
const supheli: { id: string; yeni: number; satir: string }[] = [];
let ayni = 0, patlak = 0;

for (const r of satirlar as any[]) {
  const t = r.raw_text || '';
  let e = -1, y = -1;
  try { e = ESKI.parseMessage(ESKI.cleanMessage(t), aliases).lanes.length; } catch { patlak++; continue; }
  try { y = YENI.parseMessage(YENI.cleanMessage(t), aliases).lanes.length; } catch { patlak++; continue; }
  if (e === 0 && y > 0) {
    const satirlarT = YENI.cleanMessage(t).split('\n');
    const satir = satirlarT.find((l: string) => l.includes('->')) ?? satirlarT[0];
    kazanan.push({ id: r.id, eski: e, yeni: y, ornek: (satir || '').slice(0, 70) });
    const bassiz = satirlarT.find((l: string) => /^\s*->/.test(l));
    if (bassiz) supheli.push({ id: r.id, yeni: y, satir: bassiz.slice(0, 40) });
  } else if (e > 0 && y === 0) kaybeden.push({ id: r.id, eski: e, yeni: y });
  else ayni++;
}

console.log('─'.repeat(72));
console.log(`KAZANÇ (0 → ≥1 şerit) : ${kazanan.length}`);
console.log(`KAYIP  (≥1 → 0 şerit) : ${kaybeden.length}   ← 0 OLMALI, değilse düzeltme zarar veriyor`);
console.log(`değişmedi              : ${ayni}`);
console.log(`hata verdi             : ${patlak}`);
console.log(`  ↳ bunun ŞÜPHELİsi    : ${supheli.length}   ← solu boş "->" satırı var, şeritler UYDURMA olabilir (#87)`);
console.log('─'.repeat(72));

if (kazanan.length) {
  console.log('\nKazanan satırlardan örnekler:');
  for (const k of kazanan.slice(0, 25)) console.log(`  ${k.id.slice(0, 8)}  +${k.yeni} şerit  "${k.ornek}"`);
}
if (kaybeden.length) {
  console.log('\n🚨 KAYIP VEREN SATIRLAR (bunlar incelenmeli):');
  for (const k of kaybeden.slice(0, 25)) console.log(`  ${k.id}  ${k.eski} → 0`);
}
if (supheli.length) {
  console.log('\n⚠️  ŞÜPHELİ KAZANÇLAR (#87 — solu boş ayraç satırı):');
  for (const k of supheli.slice(0, 25)) console.log(`  ${k.id.slice(0, 8)}  +${k.yeni} şerit  "${k.satir}"`);
}

const oran = satirlar.length ? (100 * kazanan.length / satirlar.length).toFixed(1) : '0';
console.log(`\n📌 DÜRÜST OKUMA: 30 günde şerit çıkaramamış ${satirlar.length} satırın`);
console.log(`   ${kazanan.length} tanesi (%${oran}) #86 düzeltmesiyle şerit üretiyor.`);
console.log(`   Bunun ${supheli.length} tanesi ŞÜPHELİ (#87) — net kazanç ${kazanan.length - supheli.length}..${kazanan.length}.`);
console.log(`   Bu SADECE bu düzeltmenin payı; kalan satırların derdi başka (#42).`);
