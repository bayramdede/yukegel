// scripts/olc-87.mts — `npm run olc:87`
//
// NE ÖLÇER: elimdeki ağaç, CANLIDA ÇALIŞAN parser'a göre şerit kümesini nasıl
// değiştiriyor. Taban sabit değil, HAREKETLİ: her deploydan sonra "canli"
// varyantının tanımı güncellenir (aşağıdaki `varyantlar` bloğu).
//   6 Ağu 2026 · taban = #87 öncesi  → ölçüldü, #87-A/B/D deploy edildi (v89)
//   7 Ağu 2026 · taban = v89         → #92-A/#92-B ölçülüyor
//   10 Ağu 2026 · taban = v91        → #92 SAHADA; #92-C yazıldı ve ölçüldü
//   10 Ağu 2026 · taban = v92        → #92-C de SAHADA (canlı kaynak indirilip
//                                      yerel ağaçla birebir olduğu doğrulandı)
//
// 🚨🚨 EN PAHALI DERS — BU DOSYA BİR KEZ YALAN SÖYLEDİ (10 Ağu 2026).
//   Yukarıdaki "her deploydan sonra güncellenir" satırı 7 Ağu'da yazıldı ve
//   UNUTULDU. #92 v90/v91 ile sahaya çıktı, ama `canli` tanımı hâlâ onu geri
//   alıyordu. Script "canlıda 198 kendine-şerit var" gösterdi; gerçek 0'dı ve
//   bu sayı rapor edildi. Yani ölçüm aracı, ölçtüğü hatanın kendisini uydurdu.
//   Sebep: taban bir YORUMLA korunuyordu, KONTROLLE değil.
//   → Artık `BEYAN_EDILEN` bekçisi var: çekirdeğe beyan edilmemiş bir `#NN`
//     düzeltme imzası girerse script PATLAR. Yorum güvenilmez, kontrol güvenilir.
//   → Ve "canlı" iddiası artık DOĞRULANARAK yazılıyor: dağıtılmış kaynak okunup
//     düzeltme imzası aranıyor (`get_edge_function`). Bkz. `CANLI_SURUM`.
//
// 🚨 KAPILAR (ikisi de `yeni` satırında SIFIR olmalı):
//      ≥1→0 (KAYIP)      — düzeltme çalışan bir satırı öldürdü mü
//      KENDİNE ŞERİT     — GEREKÇESİZ köken = varış üretiliyor mu ← #92'de eklendi
//
// 📌 ŞEHİR İÇİ sütunu (#92-C, 10 Ağu 2026) bir KAPI DEĞİL, bilgi sütunudur.
//    "Köken = varış" olan ama satırında şehir içi ibaresi bulunan şeritler MEŞRU
//    (`ANKARA ➡️ ANKARA Ş.İÇİ`) ve KENDİNE ŞERİT sayısından DÜŞÜLÜR. Kapıyı bu
//    şekilde ayrıştırmak zorunluydu: aksi hâlde her koşu 🚨 gösterir, kapı
//    körelir ve kimse bakmaz — #92'nin aylarca saklanma sebebi tam buydu.
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
  // ⚠️ `sehirIciSatiri` de dışa açılıyor (#92-C). Sebebi ÖNEMLİ: KENDİNE ŞERİT
  //    kapısı artık meşru şehir içi şeridini ayırt etmek zorunda ve bunu yapmak
  //    için ibare tanıma mantığına ihtiyacı var. Deseni buraya KOPYALAMAK, bu
  //    projede adı konmuş bir hata sınıfı olurdu (aynı kural iki yerde iki yazım,
  //    zamanla ayrışır — bkz. alias-normalize). Tek kaynak: parser'ın kendisi.
  return s.slice(bas, son + 1).join('\n') +
    '\nexport { parseMessage, cleanMessage, splitByRelation, sehirIciSatiri }\n';
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

const geri92A = (k: string) => k.replace(A92_YENI, A92_ESKI);
const geri92B = (k: string) => k.split(B92_YENI).join(B92_ESKI);

// #92-C — şehir içi istisnası (10 Ağu 2026). v92 ile SAHADA (aşağıdaki `canli`
//   tanımına bak). Bu geri-alma fonksiyonu SİLİNMEDİ: `geri92C` teşhis satırı
//   istisnanın sahadaki değerini ölçmeye devam ediyor, ve bir sonraki düzeltme
//   yazıldığında taban yine buradan türetilecek.
//   Gövdeyi `false` yapmak istisnayı tamamen kapatır ve üç çağrı noktasının
//   hepsini birden etkisizleştirir (tek yerden mutasyon).
const C92_YENI = `  return / (?:sehir ?ici|s ici) /.test(n)`;
const C92_ESKI = `  return false`;
if (!yeniKod.includes(C92_YENI)) {
  throw new Error('#92-C (sehirIciSatiri gövdesi) kaynakta YOK — geri mi alındı? Ölçüm anlamsız.');
}
const geri92C = (k: string) => k.replace(C92_YENI, C92_ESKI);

// ── 🚨 TABAN = v91 (10 Ağu 2026). BAYAT TABAN BİR KEZ YALAN SÖYLEDİ ───────────
//
// 10 Ağu'da bu blok hâlâ `canli: geri92B(geri92A(yeniKod))` diyordu — yani #92
// düzeltmesini geri alıp ona "canlı" adını veriyordu. Ama #92 v90/v91 ile SAHAYA
// ÇIKMIŞTI. Sonuç: tablo "canlıda 198 kendine-şerit var" gösterdi, rapor edildi,
// ve YANLIŞTI — gerçek sayı 0'dı. Dosyanın başındaki "her deploydan sonra
// güncellenir" notu bir YORUMDU, kontrol değildi; kimse okumadı.
//
// Doğrulama yöntemi (tekrar gerekirse): dağıtılmış kaynağı oku ve düzeltme
// imzasını ara — Supabase MCP `get_edge_function` ya da
// `supabase functions download parse-listing`. 10 Ağu ölçümü:
//   `!kendineSerit(to)`                    → canlıda 2 yerde  (#92-B ✅)
//   `if (!from && rel.rel === 'arrow'`     → canlıda 0 yerde  (#92-A ✅)
//   `aracKelimeler` dizisinde 'yuklenecek' → yok              (#93  ✅)
// Yani yerel ağaç = dağıtılmış v91. TABAN ARTIK `yeniKod`.
const CANLI_SURUM = 'v92';
const CANLI_DOGRULAMA = '2026-08-10';

// 🔒 BEKÇİ — tabanın sessizce bayatlamasını ENGELLER.
// Çekirdekteki her `#NN` düzeltme imzası burada BEYAN EDİLMİŞ olmak zorunda.
// Yeni bir düzeltme (#94…) eklenince script PATLAR ve seni tabanı gözden
// geçirmeye zorlar: o düzeltme canlıda mı, yoksa `canli` onu geri mi almalı?
// Yorum yerine kontrol — 10 Ağu hatasının tekrarını bu satır engelliyor.
const BEYAN_EDILEN = new Set([
  '#41', '#42', '#50', '#63', '#64', '#65', '#71', '#73',
  '#86', '#87', '#88', '#89', '#92', '#93',
]);
const bulunanImzalar = new Set(yeniKod.match(/#\d{2,3}/g) ?? []);
const beyansiz = [...bulunanImzalar].filter(i => !BEYAN_EDILEN.has(i));
if (beyansiz.length) {
  throw new Error(
    `Çekirdekte BEYAN EDİLMEMİŞ düzeltme imzası var: ${beyansiz.join(', ')}\n` +
    `  → Bu düzeltme(ler) CANLIDA mı? Dağıtılmış kaynağı oku (get_edge_function).\n` +
    `  → Canlıdaysa: imzayı BEYAN_EDILEN'e ekle, CANLI_SURUM'u güncelle.\n` +
    `  → Canlıda DEĞİLSE: geri alma fonksiyonu yaz ve 'canli' varyantına ekle,\n` +
    `     yoksa taban yalan söyler (10 Ağu 2026'da tam bunu yaşadık).`,
  );
}

// İskelet KORUNUYOR: `canli` = taban (ilk sıra), `yeni` = elimdeki ağaç (son sıra).
// Bugün İKİSİ AYNI — çünkü yerel ağaçta dağıtılmamış düzeltme yok. Yani `yeni`
// satırının TAMAMEN SIFIR olması BEKLENEN sonuçtur, arıza değil: ölçülecek yeni
// bir düzeltme yok demektir. Bir sonraki düzeltme yazıldığında `yeni` canlanır.
//
// Aradaki iki satır TEŞHİS: #92'yi geri alsak ne olurdu — yani düzeltmenin
// sahadaki değerini gösteriyor. Bunlar silinmedi çünkü #92'nin kazancının
// kanıtı bu satırlardır (`geri92AB` = eski v89 davranışı, 198 kendine şerit).
// 10 Ağu 2026, ÜÇÜNCÜ güncelleme: #92-C DEPLOY EDİLDİ (v92, 12:48:34 UTC) ve
// canlı kaynak indirilip yerel ağaçla BİREBİR olduğu doğrulandı. Taban yine
// `yeniKod`. `geri92C` SİLİNMEDİ: teşhis satırı istisnanın sahadaki değerini
// ölçmeye devam ediyor (ve bir sonraki düzeltmede taban yine ondan türetilecek).
const varyantlar = {
  canli:    yeniKod,                            // = dağıtılmış v92
  geri92C:  geri92C(yeniKod),                   // teşhis: şehir içi istisnası olmasa
  geri92AB: geri92C(geri92B(geri92A(yeniKod))), // teşhis: #92 hiç olmasaydı
  yeni:     yeniKod,
};
const M: Record<string, any> = {};
for (const [ad, kod] of Object.entries(varyantlar)) {
  // ⚠️ 'canli' ve 'yeni' BİLEREK yeniKod'a eşit (taban = dağıtılmış sürüm = yerel ağaç).
  //    Yalnız TEŞHİS mutantlarının gerçekten farklı olması gerekir.
  if (ad !== 'yeni' && ad !== 'canli' && kod === yeniKod)
    throw new Error(`${ad} mutantı üretilemedi — string değişimi tutmadı`);
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
const ADLAR = ['canli', 'geri92C', 'geri92AB', 'yeni'] as const;
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
// 🚨 #92-C (10 Ağu 2026) — KAPI AYRIŞTIRILDI. Aksi hâlde KALICI KIRMIZI olurdu.
//    Şehir içi taşıma (`ANKARA ➡️ ANKARA Ş.İÇİ`) MEŞRU bir aynı-il şeridi üretir,
//    yani "köken = varış" testine takılır. Kapıyı olduğu gibi bırakırsam her koşu
//    🚨 gösterir; bir süre sonra kimse bakmaz ve kapı ölür. Kapının ölmesi, #92'nin
//    aylarca saklanmasının sebebiydi — o hatayı kapıyı körelterek tekrarlamayacağım.
//    Bu yüzden iki AYRI sayı: gerçekten anlamsız olan (`kendine`) ve ibareyle
//    gerekçelendirilmiş olan (`sehirIci`). Kapı yalnız birincisine bakar.
const kendineMi = (l: any) =>
  l.from === l.to && (l.fromDistrict || '') === (l.toDistrict || '');
/** Kendine şerit AMA satırında şehir içi ibaresi var → gerekçeli, kapıya takılmaz. */
const gerekceliMi = (ad: Ad, l: any) =>
  kendineMi(l) && Boolean(l.raw_line) && M[ad].sehirIciSatiri(l.raw_line);

function cikti(ad: Ad, t: string): { set: Set<string>; kendine: number; sehirIci: number } | null {
  try {
    const lanes = M[ad].parseMessage(M[ad].cleanMessage(t), aliases).lanes;
    return {
      set: new Set(lanes.map(sk)),
      // ⚠️ `kendine` artık YALNIZ GEREKÇESİZ olanları sayar — kapının anlamı bu.
      kendine: lanes.filter((l: any) => kendineMi(l) && !gerekceliMi(ad, l)).length,
      sehirIci: lanes.filter((l: any) => gerekceliMi(ad, l)).length,
    };
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

type Sayac = { kazanc: number; kayip: number; eklenen: number; silinen: number; degisen: number; kendine: number; kendineSatir: number; sehirIci: number };
const yeniSayac = (): Sayac => ({ kazanc: 0, kayip: 0, eklenen: 0, silinen: 0, degisen: 0, kendine: 0, kendineSatir: 0, sehirIci: 0 });
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
  const v: Record<string, { set: Set<string>; kendine: number; sehirIci: number }> = {};
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
  sonuc.canli.sehirIci += tab.sehirIci;
  if (tab.kendine) sonuc.canli.kendineSatir++;
  for (const ad of ADLAR.slice(1)) {
    sonuc[ad].kendine += v[ad].kendine;
    sonuc[ad].sehirIci += v[ad].sehirIci;
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
console.log(`📌 TABAN = "canli" = parse-listing ${CANLI_SURUM} (${CANLI_DOGRULAMA} tarihinde`);
console.log('   DAĞITILMIŞ KAYNAK OKUNARAK doğrulandı, varsayılmadı). Diğer satırlar ONA GÖRE');
console.log('   farkı gösterir. `canli` satırında yalnız KENDİNE ŞERİT anlamlıdır.');
console.log('   `geri92*` satırları TEŞHİS: #92 geri alınsa ne olurdu (sahadaki değeri).');
if (sonuc.yeni.degisen === 0) {
  console.log('   ✅ `yeni` satırı sıfır: yerel ağaçta DAĞITILMAMIŞ düzeltme yok. Beklenen.');
}
console.log('─'.repeat(C));
console.log('varyant     satır DEĞİŞTİ   şerit EKLENDİ   şerit SİLİNDİ   0→≥1   ≥1→0   KENDİNE ŞERİT   ŞEHİR İÇİ');
for (const ad of ADLAR) {
  const s = sonuc[ad];
  const taban = ad === 'canli';
  console.log(
    `${ad.padEnd(11)} ${(taban ? '—' : String(s.degisen)).padStart(12)}   ${(taban ? '—' : String(s.eklenen)).padStart(13)}` +
    `   ${(taban ? '—' : String(s.silinen)).padStart(13)}   ${(taban ? '—' : String(s.kazanc)).padStart(4)}` +
    `   ${(taban ? '—' : String(s.kayip)).padStart(4)}${!taban && s.kayip ? ' 🚨' : '  '}` +
    `   ${String(s.kendine).padStart(6)} (${s.kendineSatir} satır)${s.kendine ? ' 🚨' : ''}` +
    `   ${String(s.sehirIci).padStart(9)}`
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
console.log('    `canli` satırı 0 DEĞİLSE canlıda o kadar bozuk şerit üretiliyor demektir —');
console.log(`    ve bu iddia ancak taban gerçekten canlıysa doğrudur (${CANLI_SURUM}, doğrulandı).`);
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
