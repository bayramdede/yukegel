// scripts/olc-87.mts — `npm run olc:87`
//
// NE ÖLÇER: elimdeki ağaç, CANLIDA ÇALIŞAN parser'a göre şerit kümesini nasıl
// değiştiriyor. Taban sabit değil, HAREKETLİ: her deploydan sonra "canli"
// varyantının tanımı güncellenir (aşağıdaki `varyantlar` bloğu).
//   6 Ağu 2026 · taban = #87 öncesi  → ölçüldü, #87-A/B/D deploy edildi (v89)
//   7 Ağu 2026 · taban = v89         → #92-A/#92-B ölçülüyor
//
// 🚨 KAPILAR (ikisi de `yeni` satırında SIFIR olmalı):
//      ≥1→0 (KAYIP)      — düzeltme çalışan bir satırı öldürdü mü
//      KENDİNE ŞERİT     — köken = varış üretiliyor mu  ← #92'de eklendi, aşağıda niye
//
// #86/#88'den FARKLI bir soru soruyor ve bu fark scriptin tamamını şekillendiriyor:
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
// 📌 7 AĞU 2026 — TABAN DEĞİŞTİ. #87-A/B/D artık CANLIDA (v89, deploy 05:41 UTC),
//    dolayısıyla "eski" onları geri almak DEĞİL. Ölçümün tek anlamlı sorusu şu:
//    "elimdeki ağaç, ŞU AN ÇALIŞAN sürüme göre neyi değiştiriyor?" Taban = v89.
//    #87 substitusyonları AŞAĞIDA DURUYOR (silinmedi) — tekrar ölçmek gerekirse
//    `TABAN` tanımına eklemek yeter; ölçülen değerleri YAPILACAKLAR.md'de.
const A_YENI = `      if (right) return { left, right, rel: 'arrow' }`;
const A_ESKI = `      if (left && right) return { left, right, rel: 'arrow' }`;

const B_YENI = `    const from = bestPlace(findPlaces(rel.left, aliases)) || contextFrom`;
const B_ESKI = `    const from = rel.left.trim() ? bestPlace(findPlaces(rel.left, aliases)) : contextFrom`;

const D_YENI = `        if (parts.length > 1 && yerliParca.length >= 2) {`;
const D_ESKI = `        if (parts.length > 1) {`;

// #92-A — kurtarma kolunun `if (!from)` kapısı kaldırıldı. v89'da kapı VARDI ve
//   kolu sahada neredeyse hiç çalıştırmıyordu: meşru bir başlık satırı contextFrom'u
//   doldurunca `from` null olmuyor, satır normal yola düşüp KENDİNE ŞERİT üretiyordu.
const A92_YENI = `    if (rel.rel === 'arrow' && !rel.left.trim()) {`;
const A92_ESKI = `    if (!from && rel.rel === 'arrow' && !rel.left.trim()) {`;

// #92-B — Pass 1'in ok/tire kolunda kendine-şerit koruması HİÇ YOKTU (iki push
//   noktası). `+` kolu ve Pass 2 koruyordu, burası korumuyordu.
const B92_YENI = ` && !kendineSerit(to)`;
const B92_ESKI = ``;

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
for (const [ad, parca] of [['#87-A', A_YENI], ['#87-B', B_YENI], ['#87-D', D_YENI],
                           ['#92-A', A92_YENI], ['#92-B', B92_YENI]] as const) {
  if (!yeniKod.includes(parca)) {
    throw new Error(`${ad} düzeltmesi kaynakta YOK — geri mi alındı? Ölçüm anlamsız.`);
  }
}
// 🚨 #92-B iki push noktasında da olmalı; `replace` tek tek değiştirdiği için
//    sayıyı burada sabitliyoruz. Biri eksikse ölçüm sessizce yalan söyler.
const b92Sayisi = yeniKod.split(B92_YENI).length - 1;
if (b92Sayisi !== 2) throw new Error(`#92-B koruması ${b92Sayisi} yerde — 2 bekleniyordu`);

// TABAN = canlı v89: #92-A ve #92-B geri alınmış hâl. (#87-A/B/D canlıda, dokunulmaz.)
const geri92A = (k: string) => k.replace(A92_YENI, A92_ESKI);
const geri92B = (k: string) => k.split(B92_YENI).join(B92_ESKI);

const varyantlar = {
  canli:     geri92B(geri92A(yeniKod)),
  yalniz92A: geri92B(yeniKod),
  yalniz92B: geri92A(yeniKod),
  yeni:      yeniKod,
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
const ADLAR = ['canli', 'yalniz92A', 'yalniz92B', 'yeni'] as const;
type Ad = typeof ADLAR[number];

// Şerit anahtarı: parser çıktısı zaten normalize (aynı alias tablosu her varyantta),
// o yüzden düz birleştirme yeterli — katlama (`laneKey`) gerekmez.
const sk = (l: any) => `${l.from}/${l.fromDistrict || ''}→${l.to}/${l.toDistrict || ''}`;

// 🚨 KENDİNE ŞERİT — #92'NİN DOĞURDUĞU ZORUNLU SÜTUN. SAKIN KALDIRMA.
//    Bu script üç kez (#87-E, #87-F, #92) "KAYIP=0" gösterip yine de canlıda
//    bozuk şerit üretilmesine izin verdi. Sebep tek ve basit: YANLIŞ ŞERİT, ŞERİT
//    SAYISINI DÜŞÜRMEZ. `≥1→0` sütununa hiç düşmez, `değişen` içinde 400 satırın
//    arasında kaybolur, ancak 25 örneğin ELLE okunmasıyla ortaya çıkar. Üç kerede
//    ikisinde gözden kaçtı. Artık bir SAYI: köken = varış olan şerit anlamsızdır,
//    "Mersin'den Mersin'e yük" diye bir şey yok.
// 📌 İlçe dahil karşılaştırılır: `İstanbul→İstanbul/Tuzla` GERÇEK bir şerittir,
//    kendine şerit DEĞİLDİR. Sadece ile bakmak onu yanlışlıkla suçlu gösterirdi.
const kendineMi = (l: any) =>
  l.from === l.to && (l.fromDistrict || '') === (l.toDistrict || '');

function cikti(ad: Ad, t: string): { set: Set<string>; kendine: number } | null {
  try {
    const lanes = M[ad].parseMessage(M[ad].cleanMessage(t), aliases).lanes;
    return { set: new Set(lanes.map(sk)), kendine: lanes.filter(kendineMi).length };
  } catch { return null; }
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

type Sayac = { kazanc: number; kayip: number; eklenen: number; silinen: number; degisen: number; kendine: number; kendineSatir: number };
const yeniSayac = (): Sayac => ({ kazanc: 0, kayip: 0, eklenen: 0, silinen: 0, degisen: 0, kendine: 0, kendineSatir: 0 });
const sonuc: Record<string, Sayac> = Object.fromEntries(ADLAR.map(a => [a, yeniSayac()]));

const kayipOrnek: any[] = [];
const eklenenOrnek: any[] = [];
const silinenOrnek: any[] = [];
const kendineOrnek: any[] = [];
let patlak = 0, imzali = 0, imzaliDegisen = 0;

for (const r of satirlar as any[]) {
  const t = r.raw_text || '';
  const tab = cikti('canli', t);
  if (tab === null) { patlak++; continue; }
  const e = tab.set;
  const v: Record<string, { set: Set<string>; kendine: number }> = {};
  let atla = false;
  for (const ad of ADLAR.slice(1)) {
    const s = cikti(ad, t);
    if (s === null) { atla = true; break; }
    v[ad] = s;
  }
  if (atla) { patlak++; continue; }

  const imza = solBosOkVar('yeni', t);
  if (imza) imzali++;

  // Kendine şerit HER varyantta sayılır — taban dahil. Tablonun anlamı:
  // "canli" satırındaki sayı ŞU AN CANLIDA ÜRETİLEN bozuk şerit adedi.
  sonuc.canli.kendine += tab.kendine;
  if (tab.kendine) sonuc.canli.kendineSatir++;
  for (const ad of ADLAR.slice(1)) {
    sonuc[ad].kendine += v[ad].kendine;
    if (v[ad].kendine) sonuc[ad].kendineSatir++;
  }

  const ozetKur = (y: Set<string>) => ({
    id: r.id.slice(0, 8), durum: r.processing_status, imza: imza ? '✓' : '·',
    eski: [...e].join(' , ') || '(yok)', yeni: [...y].join(' , ') || '(yok)',
    metin: M.yeni.cleanMessage(t).replace(/\n/g, ' ⏎ ').slice(0, 110),
  });
  if (tab.kendine || v.yeni.kendine) kendineOrnek.push(ozetKur(v.yeni.set));

  for (const ad of ADLAR.slice(1)) {
    const y = v[ad].set;
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
    const ozet = ozetKur(y);
    if (e.size > 0 && y.size === 0) kayipOrnek.push(ozet);
    else if (silinen.length) silinenOrnek.push(ozet);
    else if (eklenen.length) eklenenOrnek.push(ozet);
  }
}

// ── Rapor ─────────────────────────────────────────────────────────────────────
const C = 96;
console.log('─'.repeat(C));
console.log('📌 TABAN = "canli" (parse-listing v89, canlıda çalışan sürüm). Diğer satırlar');
console.log('   ONA GÖRE farkı gösterir. `canli` satırında yalnız KENDİNE ŞERİT anlamlıdır.');
console.log('─'.repeat(C));
console.log('varyant     satır DEĞİŞTİ   şerit EKLENDİ   şerit SİLİNDİ   0→≥1   ≥1→0   KENDİNE ŞERİT');
for (const ad of ADLAR) {
  const s = sonuc[ad];
  const taban = ad === 'canli';
  console.log(
    `${ad.padEnd(11)} ${(taban ? '—' : String(s.degisen)).padStart(12)}   ${(taban ? '—' : String(s.eklenen)).padStart(13)}` +
    `   ${(taban ? '—' : String(s.silinen)).padStart(13)}   ${(taban ? '—' : String(s.kazanc)).padStart(4)}` +
    `   ${(taban ? '—' : String(s.kayip)).padStart(4)}${!taban && s.kayip ? ' 🚨' : '  '}` +
    `   ${String(s.kendine).padStart(6)} (${s.kendineSatir} satır)${s.kendine ? ' 🚨' : ''}`
  );
}
console.log(`hata verdi  ${String(patlak).padStart(12)}`);
console.log('─'.repeat(C));
console.log(`#87 imzası (solu boş ok) taşıyan satır: ${imzali}`);
console.log(`  bunların ${imzaliDegisen} tanesinde şerit kümesi değişti` +
  ` (değişen satırların %${sonuc.yeni.degisen ? (100 * imzaliDegisen / sonuc.yeni.degisen).toFixed(1) : '0'}'i)`);
console.log('─'.repeat(C));
console.log('🚨 "KENDİNE ŞERİT" `yeni` satırında 0 OLMALI — ZORUNLU KAPI (7 Ağu 2026, #92).');
console.log('    Köken = varış (il VE ilçe aynı) olan şerit anlamsızdır. Bu sütun VAR OLDUĞU İÇİN');
console.log('    var: KAYIP=0 üç kez (#87-E · #87-F · #92) "temiz" dedi, üçünde de canlıda bozuk');
console.log('    şerit üretiliyordu. Sebep basit — YANLIŞ ŞERİT, ŞERİT SAYISINI DÜŞÜRMEZ.');
console.log('    `canli` satırındaki sayı düşmüyorsa düzeltme işe yaramamış demektir.');
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

bas('🚨 KENDİNE ŞERİT — köken = varış (canlıda VEYA yenide). Hepsini incele.', kendineOrnek, 50);
bas('🚨 KAYIP — şerit vardı, YOK OLDU (bunlar hata, hepsini incele)', kayipOrnek, 50);
bas('♻️  ŞERİT DEĞİŞTİ/SİLİNDİ — uydurma temizliği mi, gerçek kayıp mı?', silinenOrnek, 25);
bas('➕ ŞERİT EKLENDİ — kurtarılan varışlar', eklenenOrnek, 25);

const oran = satirlar.length ? (100 * sonuc.yeni.degisen / satirlar.length).toFixed(1) : '0';
console.log(`\n📌 DÜRÜST OKUMA: son ${GUN} günün ${satirlar.length} satırından ${sonuc.yeni.degisen} tanesinin`);
console.log(`   (%${oran}) şerit kümesi CANLI SÜRÜME GÖRE değişiyor: ${sonuc.yeni.eklenen} şerit eklendi,`);
console.log(`   ${sonuc.yeni.silinen} şerit silindi. Bu bir "kazanç" sayısı DEĞİL — düzeltmenin`);
console.log(`   DOKUNDUĞU yüzeyin büyüklüğü. Kazanç iddiası ancak yukarıdaki örnekler elle`);
console.log(`   denetlendikten sonra yazılabilir; #86/#88'in "0→≥1" sayısıyla kıyaslanamaz.`);
console.log(`   Ölçüm #86 ve #88 düzeltmeleri AÇIKKEN yapılır — onların payı buna DAHİL DEĞİL.`);
