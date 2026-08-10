/// <reference types="https://deno.land/types.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ── Inline structured logger (Deno ortamında lib/logger.ts import edilemez) ──
function edgeLog(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  metadata: Record<string, unknown> = {}
): void {
  console.log(JSON.stringify({
    level,
    service: 'yukegel-api',
    context: 'llm-parser',
    message,
    metadata,
    timestamp: new Date().toISOString(),
  }))
}

// -------------------------
// raw_posts durum yazımı — TEK GİRİŞ NOKTASI
// -------------------------
// 🚨 #65 (5 Ağu 2026). Bu fonksiyondan önce üç yerde çıplak `await ...update()`
//    vardı ve ÜÇÜNÜN DE dönüşü kontrol edilmiyordu. Bağlantı havuzu tükendiğinde
//    (PGRST003) update sessizce düşüyor, satır `pending` olarak kalıyordu.
//    Ölçüm: RPC hatası alan 176 raw_post'un 110'u bu yüzden `pending`de mahsur.
//
// ⚠️ NİYE ÖLÜMCÜL: repo genelinde `processing_status = 'pending'` SEÇEN hiçbir
//    yer yok — `reprocess-no-lane`:19, `learn-aliases`:83,216,508 ve
//    `moderator/page.tsx`:216,228 yalnız `no_lane` okuyor. Yani `pending`de
//    kalan satır ne kuyrukta görünür, ne yeniden denenir, ne bir ölçüme girer.
//    Sessiz kayıp, gürültülü kayıptan pahalıdır.
//
// Bu fonksiyon hatayı ÇÖZMÜYOR — görünür kılıyor. Kurtarma yolu ayrı iş (#65).
async function durumYaz(
  supabase: any,
  raw_post_id: string,
  status: 'processed' | 'no_lane',
  damgala: boolean,
  neden: string
): Promise<void> {
  const yama: Record<string, unknown> = { processing_status: status }
  if (damgala) yama.processed_at = new Date().toISOString()

  const { error } = await supabase.from('raw_posts').update(yama).eq('id', raw_post_id)

  if (error) {
    edgeLog('ERROR', 'raw_posts durumu YAZILAMADI — satır pending kalıyor', {
      raw_post_id,
      output_status: 'status_write_failed',
      hedef_status: status,
      neden,
      error_message: error.message ?? String(error),
      error_code: error.code ?? null,
    })
  }
}

// -------------------------
// Mesaj temizleme (LLM öncesi token tasarrufu)
// -------------------------
// PostgREST varsayılan olarak sorgu başına EN FAZLA 1000 satır döndürür
// (Supabase `db.max-rows`). Sınır aşıldığında HATA YOK — sorgu sessizce kesilir.
// `aliases` tablosu 1000'i geçtiği için bu fonksiyon şehir/araç tespitini
// alias'ların yarısını hiç görmeden yapıyordu. `.range()` ile sayfalanır.
// NOT: aynı düzeltme app/api/whatsapp-parse/route.ts içinde de var
// (`tumSatirlar`); Deno/Next sınırı yüzünden ortak modüle alınamıyor.
const SAYFA_BOYU = 1000

// ─── Alias önbelleği (5 Ağu 2026, #73) ────────────────────────────────────
// ÖLÇÜM: 15:06–15:22 arası ~1000 çağrıda `aliases` SELECT'i 1931 kez koştu
// (çağrı başına 2 sayfa × 1242 aktif alias). Toplam 47,6 sn DB süresi + her
// çağrıda ~1242 satırlık JSON'un ağdan çekilip parse edilmesi.
//
// Deno edge worker'ı sıcakken modül kapsamı YAŞAR. Yani bu önbellek, aynı
// worker'a düşen sonraki isteklerde hem 2 HTTP turunu hem JSON parse'ı
// hem de `aliasIndeksi()`'nin trNorm döngüsünü tamamen atlatır —
// WeakMap aynı dizi kimliğini gördüğü için indeks de yeniden kurulmaz.
//
// TTL neden 60 sn: alias'lar `learn-aliases` çalışınca değişir. 60 sn'lik
// bayatlık kabul edilebilir; buna karşılık yüzlerce eşzamanlı çağrılık bir
// import patlaması worker başına TEK fetch'e iner.
const ALIAS_TTL_MS = 60_000
let _aliasOnbellek: Alias[] | null = null
let _aliasZaman = 0
let _aliasUcus: Promise<Alias[]> | null = null   // aynı anda gelen istekler tek fetch'i paylaşsın

async function aliaslariCek(): Promise<Alias[]> {
  const hepsi: Alias[] = []
  for (let baslangic = 0; ; baslangic += SAYFA_BOYU) {
    const { data, error } = await supabase
      .from('aliases')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true })   // sayfalar arası tutarlılık için ŞART
      .range(baslangic, baslangic + SAYFA_BOYU - 1)
    if (error) throw new Error(error.message)
    const parca = (data || []) as Alias[]
    hepsi.push(...parca)
    if (parca.length < SAYFA_BOYU) return hepsi
  }
}

async function tumAliaslar(): Promise<Alias[]> {
  const simdi = Date.now()
  if (_aliasOnbellek && simdi - _aliasZaman < ALIAS_TTL_MS) return _aliasOnbellek
  if (_aliasUcus) return await _aliasUcus   // başka bir istek zaten çekiyor

  _aliasUcus = aliaslariCek()
  try {
    const taze = await _aliasUcus
    _aliasOnbellek = taze
    _aliasZaman = Date.now()
    return taze
  } catch (e) {
    // Çekme başarısızsa bayat veriyle devam et — hiç alias'sız parse etmekten iyi.
    if (_aliasOnbellek) return _aliasOnbellek
    throw e
  } finally {
    _aliasUcus = null
  }
}

const BLACKLIST_PHRASES = [
  'komisyon yok', 'komisyonsuz', 'kdv dahil', 'kdv haric',
  'whatsapp uzerinden iletildi', 'chatbridge', 'toplu gonderildi',
  'mesaj bekleniyor', 'goruntu dahil edilmedi', 'bu mesaj silindi',
  'forwarded', 'arama yapildi',
]

function cleanMessage(text: string): string {
  // 🚨 #86 (6 Ağu 2026) — BU SATIR SESSİZCE TÜM BMP-ÜSTÜ EMOJİLERİ SİLİYORDU.
  // Eski hali `/[\uD800-\uDFFF]/g` idi. `u` bayrağı YOK, yani JS bunu KOD BİRİMİ
  // bazında uygular ve GEÇERLİ vekil ÇİFTLERİNİN de iki yarısını ayrı ayrı siler.
  // 👉 U+1F449 = D83D DC49 · 📍 U+1F4CD = D83D DCCD · 🔹 U+1F539 = D83D DD39
  // → hepsi burada, aşağıdaki hiçbir kural çalışmadan ÖNCE, BOŞLUK BIRAKMADAN yok oluyordu.
  // İki sonuç: (a) #63'ün 👉/📍 ayraç kuralı ÖLÜ KODDU (ASCII `=` kuralı çalışıyordu,
  // çünkü `=` BMP'de), (b) "MERSİN👉İRAN" → "MERSİNİRAN" token yapışması —
  // yani :161'deki emoji-strip'in "boşlukla değiştir" önlemi bu karakterler için
  // hiç devreye giremiyordu. Ölçüm (son 30 gün, damgasız no_lane 490):
  // BMP-üstü emoji içeren 239 · boşluksuz yapışma 43 · #63 hedefi 58 · 🔹 9.
  // Doğru davranış: SADECE YALNIZ (eşsiz) vekilleri sil, geçerli çiftlere dokunma.
  text = text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
  return text
    .split('\n')
    .map(line => {
      // Ok karakterlerini ASCII'ye çevir (emoji-strip'ten ÖNCE)
      // ➡ U+27A1, ⏩ U+23E9 (YUKİ), ⏪ U+23EA, ▶ U+25B6, ⏩ vb. aynı range'de
      line = line.replace(/[➡➜➔⟶⏩⏪▶◀⇒⇔]/gu, '->')
      // #63: 👉 (U+1F449) ve 📍 (U+1F4CD) SADECE satır içinde, iki yanında harf varken ayraç.
      // "Van 👉 bulanık" / "*MERSİN📍MUĞLA*" → ayraç.
      // "👉AFYON..." / "📍 *Yükleme:*" → satır başı işaretçi, ayraç DEĞİL; alttaki emoji-strip boşluğa çevirir.
      line = line.replace(/(?<=[A-Za-zÇĞİÖŞÜçğıöşü])\s*[👉📍]\s*(?=[A-Za-zÇĞİÖŞÜçğıöşü])/gu, ' -> ')
      // #63: "KIZILTEPE = OSMANİYE KADİRLİ". İki yanı harf şartı "Tlf=0544..." yakalanmasını engeller.
      line = line.replace(/(?<=[A-Za-zÇĞİÖŞÜçğıöşü])\s*=+\s*(?=[A-Za-zÇĞİÖŞÜçğıöşü])/g, ' -> ')
      // NOT: "/" bilinçli olarak ayraç DEĞİL — veride baskın kullanımı ilçe/il ("Kartal / İstanbul",
      // "Aliağa /İZMİR"). Ayraç yapmak gerçek olmayan hat üretir. Ölçüm: docs/YAPILACAKLAR.md #63.
      // Emojileri BOŞ KARAKTERLE değil BOŞLUKLA değiştir
      // Aksi halde "KIZILTEPE🔲ANTEP" → "kiziltepeantep" oluşur (token ayırıcı kaybolur)
      line = line.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu, ' ')
      // WhatsApp format + görünmez Unicode karakterlerini sil
      // U+200C/D (ZWJ/ZWNJ), U+2060 (WJ), U+FEFF (BOM) city adlarını böler — trNorm'da boşluğa dönüşür
      line = line.replace(/[\u200e\u202a\u202c\u200f\u200b\u200c\u200d\u2060\ufeff\u{FE0F}]/gu, '')
      // Kalın/italic WhatsApp formatını sil (* ve _)
      // Önemli: boşlukla değiştir, aksi halde "*AFYON*İŞBİTİMİ" → "AFYONİŞBİTİMİ" olur
      line = line.replace(/\*([^*]+)\*/g, ' $1 ').replace(/_([^_]+)_/g, ' $1 ')
      // Telefon numaralarını sil
      line = line.replace(/(?:\+?9?0?)?\s*5\d[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g, '')
      line = line.replace(/0\s*5\s*\d[\s\-\.]?\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g, '')
      return line.trim()
    })
    .filter(line => {
      if (!line || line.length < 3) return false
      // Çizgi/eşitlik satırlarını sil
      if (/^[-=\u2500\u2550\u2014\u2013*\.]{3,}$/.test(line)) return false
      // Bilinen gereksiz ifadeleri sil
      const norm = line.toLowerCase()
        .replace(/[\u00e7]/g, 'c').replace(/[\u011f]/g, 'g').replace(/[\u0131\u0130]/g, 'i')
        .replace(/[\u00f6]/g, 'o').replace(/[\u015f]/g, 's').replace(/[\u00fc]/g, 'u')
      if (BLACKLIST_PHRASES.some(p => norm.includes(p))) return false
      // Sadece rakam/noktalama kalan satırları sil
      if (/^[\d\s\+\-\.\(\)\/,]+$/.test(line)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// -------------------------
// Türkçe normalizasyon
// -------------------------

// Unicode küçük harf / IPA karakter eşlemeleri (WhatsApp fancy font kullanımı)
// ᴋɪᴢɪʟᴛᴇᴘᴇ gibi küçük caps karakterler → normal ASCII
const UNICODE_SMALL_CAPS: [RegExp, string][] = [
  [/[ᴀᴁ]/gu, 'a'], [/ʙ/gu, 'b'], [/ᴄ/gu, 'c'], [/ᴅ/gu, 'd'],
  [/[ᴇ]/gu, 'e'], [/[ɢɡ]/gu, 'g'], [/ʜ/gu, 'h'],
  [/[ɪɩ]/gu, 'i'], [/[ᴊʝ]/gu, 'j'], [/ᴋ/gu, 'k'],
  [/ʟ/gu, 'l'], [/ᴍ/gu, 'm'], [/[ɴɴ]/gu, 'n'],
  [/[ᴏ]/gu, 'o'], [/ᴘ/gu, 'p'], [/[ʀʁ]/gu, 'r'],
  [/[ꜱsꜱ]/gu, 's'], [/ᴛ/gu, 't'], [/[ᴜʊ]/gu, 'u'],
  [/ᴠ/gu, 'v'], [/ᴡ/gu, 'w'], [/ʏ/gu, 'y'],
  [/[ᴢᴢ]/gu, 'z'],
]

function trNorm(s: string): string {
  let t = (s || '')
  // Unicode small caps / IPA → ASCII
  for (const [re, rep] of UNICODE_SMALL_CAPS) t = t.replace(re, rep)
  return t
    .replace(/İ/g, 'i').replace(/I/g, 'i')  // toLowerCase'den ÖNCE
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's')
    .replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/û/g, 'u').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// Türkçe hal eki soyma
const CASE_SUFFIXES = [
  'dan','den','tan','ten','da','de','ta','te',
  'ya','ye','yi','yı','yu','yü','nin','nın','nun','nün',
  'na','ne','a','e','i','ı','u','ü'
]

function stripSuffix(token: string): string {
  let t = token
  if (t.length < 5) return t
  let changed = true
  while (changed) {
    changed = false
    for (const suf of CASE_SUFFIXES) {
      if (t.endsWith(suf) && t.length - suf.length >= 3) {
        t = t.slice(0, -suf.length)
        changed = true
        break
      }
    }
  }
  return t
}

// Tek tur suffix soyma — ara formu korur (tuzladan → tuzla, full strip → tuzl)
// findPlaces hem stripSuffixOnce hem de stripSuffix ’i dener
function stripSuffixOnce(token: string): string {
  if (token.length < 5) return token
  for (const suf of CASE_SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 3) {
      return token.slice(0, -suf.length)
    }
  }
  return token
}

// -------------------------
// Telefon çıkarma
// -------------------------
function extractPhones(text: string): string[] {
  const phones: string[] = []
  // +90 prefix normalize et, parantezleri kaldır
  const t = text.replace(/\+\s*9\s*0\s*/g, '0').replace(/[()]/g, ' ')
  // 05 ile başlayan, aralarında isteğe bağlı boşluk olan 11 haneli numaraları yakala
  const re = /0\s*5(?:\s*\d){9}/g
  let m
  while ((m = re.exec(t)) !== null) {
    const digits = m[0].replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('05') && !phones.includes(digits)) {
      phones.push(digits)
    }
  }
  return phones
}

// -------------------------
// İlan tipi tespiti
// -------------------------
function detectAdType(text: string): 'yuk' | 'arac' {
  const norm = trNorm(text)
  // 'bosaltir'/'boşaltır' kasıtlı çıkarıldı — "YÜKLER BOŞALTIR" gibi ifadeler yük ilanında araç
  // varış noktasını belirtir, araç ilanı sinyali değil.
  // 'yukum var' da çıkarıldı — "yükümüz var" = yük ilanı sinyali.
  // 🚨 'yuklenecek' 7 Ağu 2026'da ÇIKARILDI (#93). Canlı ölçüm: bu tek kelimeyle
  // 'arac' sayılan 1350 ilandan 25'i elle okundu, 25'i de aslında YÜK ilanıydı
  // ("Urfa'dan büyük balya yüklenecek", "Sarımsak yüklenecek" — klasik yük
  // simsarı kalıbı: "X yüklenecek" = "X kalkışlı yük var, araç aranıyor").
  // Ayrıca bu 1350'nin yalnız 2'sinde BAŞKA bir gerçek araç sinyali de vardı —
  // yani kelimeyi çıkarmak neredeyse hiçbir gerçek araç ilanını kaçırmıyor.
  // Kanıt/ölçüm: `docs/YAPILACAKLAR.md` başı, `npm run test:ad-type`.
  const aracKelimeler = ['bos arac', 'bos tir', 'bos kamyon', 'yuk ariyor', 'boş araç', 'boş tır']
  for (const k of aracKelimeler) {
    if (norm.includes(trNorm(k))) return 'arac'
  }
  return 'yuk'
}

// -------------------------
// Satır ilişki tespiti (ok, tire, den-ye)
// -------------------------
// Pass 2 reset için: ~ dahil değil ("MANİSA ~ 3 TIR" pattern'ini reset etmemek için)
const BLOCK_RESET_RE = /\s+[-–—]\s+/

const ARROW_RE = /➡️|->|→|⇒|⟶|—>|➜|➔/
const DASH_RE = /\s+[-–—~]\s+/
const DEN_RE = /(.+?)\s+(?:'?\s*)?(?:den|dan|ten|tan)\b\s+(.+)/i

function splitByRelation(line: string): { left: string, right: string, rel: string } | null {
  // Ok
  // 🚨 #87 (6 Ağu 2026): ESKİDEN buradaki şart `if (left && right)` idi. Solu boş ok
  //    satırı ("➡️SAMSUN" → "->samsun") bu yüzden `null` dönüyordu ve parseMessage:646'daki
  //    "ok solunda şehir yoksa contextFrom kullan" yedeği ULAŞILAMAZ ÖLÜ KODDU.
  //    Satır ilişkisiz sayılıp Pass 2/Pass 3/fallback'e düşüyor, orada sıra bağımlı
  //    olarak ya varış DÜŞÜYOR ya da UYDURMA şerit doğuyordu. Gerçek örnekler:
  //      685877e4  "ADANA OSB YÜKLEMELİ / ->MERSİN AYAŞ / ->URFA MERKEZ"
  //                → fallback "Mersin→Ankara/Ayaş" üretiyordu (Adana hiç geçmiyor).
  //      e8843b11  "UŞAK YÜKLEME / ->MERSİN / ->TRABZON + RİZE" → Mersin kayıp.
  //      99183fb8  "...bartin / ->samsun" → Samsun hiçbir şeritte yok.
  //    ARTIK: sol boşsa da ok ilişkisi döner; kökeni çağıran taraf contextFrom'dan alır.
  if (ARROW_RE.test(line)) {
    const parts = line.split(ARROW_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join('').replace(ARROW_RE, '').trim()
      if (right) return { left, right, rel: 'arrow' }
    }
  }

  // Tire (boşluklu: "A - B")
  if (DASH_RE.test(line)) {
    const parts = line.split(DASH_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join(' - ').trim()
      if (left && right) return { left, right, rel: 'dash' }
    }
  }

  // Tire (boşluksuz: "CEYHAN-ANKARA") — tek tire içeren satır
  const noSpaceDash = line.match(/^(.+?)[-–—](.+)$/)
  if (noSpaceDash) {
    const left = noSpaceDash[1].trim()
    const right = noSpaceDash[2].trim()
    // Her iki taraf da en az 3 karakter olmalı, sadece rakam/sembol değil
    if (left.length >= 3 && right.length >= 3 && /[a-zA-ZÀ-ÿ\u00C0-\u024F\u011E\u011F\u0130\u0131\u015E\u015F\u00C7\u00E7\u00D6\u00F6\u00DC\u00FC\u011E\u011F]/u.test(left) && /[a-zA-ZÀ-ÿ\u00C0-\u024F]/u.test(right)) {
      return { left, right, rel: 'dash_nospace' }
    }
  }

  // DEN-YE
  const m = DEN_RE.exec(line)
  if (m) {
    const left = m[1].trim()
    const right = m[2].trim()
    if (left && right && left.length > 2 && right.length > 2) {
      return { left, right, rel: 'den' }
    }
  }

  return null
}

// -------------------------
// Yer tespiti (alias tablosundan)
// -------------------------
interface Alias {
  type: string
  alias: string
  normalized: string
  priority: number
  district: string | null
}

interface PlaceHit {
  normalized: string
  priority: number
  matched: string
  district: string | null
}

// 🚨 W5/D4 — Şehir/ilçe KARŞILAŞTIRMALARI daima katlanmış anahtar üzerinden.
//
// Sorun: `aliases.normalized` kolonunda aynı şehir iki yazımla duruyor —
// `Istanbul` (13 satır) ve `İstanbul` (154 satır); aynısı Izmir/İzmir,
// Mugla/Muğla, Bingol/Bingöl. Ham string eşitliği bunları İKİ AYRI ŞEHİR sayıyor:
//   • `avcilar` (→`Istanbul`) + `kadıköy` (→`İstanbul`) geçen tek satır
//     "iki şehir bulmuş" oluyor,
//   • `sameCity` koruması `'Istanbul' !== 'İstanbul'` dediği için devreye girmiyor,
//   • sonuç: sahte **İstanbul→İstanbul** ilanı kaydediliyor.
//
// ⚠️ Katlama YALNIZ karşılaştırma ve dedup anahtarlarında kullanılır. `hits` ve
// `lanes` içindeki değer HAM kalır — ilana yazılan, veritabanındaki yazımdır.
// (Yazma tarafı W5/D1+D2 ile düzeltildi, D5 mevcut veriyi temizliyor; bu katman
// veri temizlendikten sonra da doğru kalır ve bir daha bu bug'ı mümkün kılmaz.)
function yerKey(s: string | null | undefined): string {
  return trNorm(s ?? '')
}

/** Aynı şehir mi? Türkçe/ASCII yazım farkını yok sayar. */
function ayniSehir(a: string, b: string): boolean {
  return yerKey(a) === yerKey(b)
}

/** Aynı ilçe mi? `null`/boş ilçeler eşit sayılır (ikisi de "bilinmiyor"). */
function ayniIlce(a: string | null | undefined, b: string | null | undefined): boolean {
  return yerKey(a) === yerKey(b)
}

/**
 * 🚨 #92-C (10 Ağu 2026) — ŞEHİR İÇİ İSTİSNASI. Aynı-il şeridini MEŞRU kılar.
 *
 * #92-B "köken = varış" şeritlerini toptan reddetmeye başladı ve haklıydı:
 * `Mersin→Mersin` diye bir taşıma yok, o şerit yurt dışı varışın (Rusya)
 * temsil edilemeyişinden doğan bir artıktı. AMA aynı reddetme MEŞRU bir sınıfı
 * da düşürdü — `ANKARA ➡️ ANKARA Ş.İÇİ` gerçek bir şehir içi taşıma işidir.
 * `olc:87` bunu `KAYIP=3`'ün 1'i olarak gösterdi (diğer 2'si doğru temizlikti).
 *
 * KARAR (Bayram): "v90 kalıyor, Ş.İçi istisnası düşük öncelikli backlog." Bu
 * fonksiyon o istisna. Şerit SİLMEZ, yalnız reddedilmiş bir şeridi geri verir.
 *
 * ⚠️ SATIR DÜZEYİNDE ÇALIŞIR, mesaj düzeyinde DEĞİL. Mesajın 5. satırındaki
 *    "şehir içi" notu, 2. satırdaki uydurma `Mersin→Mersin`i meşrulaştırmamalı.
 *
 * 📌 DESEN CANLI DERLEM ÜZERİNDE ÖLÇÜLEREK YAZILDI (yazım tahmin edilmedi):
 *    180 günde 285 satır / 276 ilan eşleşiyor ve okunan örneklerin tamamı
 *    gerçek şehir içi ibaresi — `antalya sehir ici` (29), `izmir sehirici
 *    kirkayak` (11), `corlu sehir ici 1360 tir`, `ankara sehirici damper`…
 *    Bu yüzden `sehir ?ici`: boşluksuz "şehirici" yazımı yaygın, kaçırılamaz.
 *
 * 🚨 "İÇİN" TUZAĞI — desen `trNorm`DAN SONRA uygulanmak ZORUNDA. Ham metinde
 *    `iş için` / `giriş için` içinde "ş içi" geçer ve gevşek bir desen bunları
 *    yakalar (ilk denemede tam bunu yaptım: "iş için", "adli sicil", "giriş
 *    için" eşleşti). `trNorm` "için"i `icin` yapar, kelime sınırı da ayırır.
 *    Kısaltılmış biçim (`Ş.İÇİ` → `s ici`) 365 günde 3 kez geçiyor ve ÜÇÜ DE
 *    gerçek; 'sehir' kelimesi olmadan yanlış pozitif ÖLÇÜLDÜ = 0.
 */
function sehirIciSatiri(line: string): boolean {
  const n = ` ${trNorm(line)} `
  return / (?:sehir ?ici|s ici) /.test(n)
}

/** Lane / blok dedup anahtarı — yazım farkı ayrı lane üretmesin. */
function laneKey(from: string, fromDist: string | null | undefined, to: string, toDist: string | null | undefined): string {
  return `${yerKey(from)}|${yerKey(fromDist)}|${yerKey(to)}|${yerKey(toDist)}`
}

// -------------------------
// Alias indeksi — trNorm(a.alias) ALIAS DİZİSİ BAŞINA BİR KEZ
// -------------------------
// 🚨 #71 (5 Ağu 2026). Buradan önce `findPlaces` her aranan token için
//    `cityAliases.find(a => trNorm(a.alias) === cand)` çalıştırıyordu. `.find`
//    eşleşmede kısa devre yapar ama aramaların NEREDEYSE TAMAMI ıskalıyor, yani
//    pratikte her arama 1.163 city alias'ının HEPSİNİ geziyor ve her biri için
//    `trNorm` çağırıyordu. `trNorm` 36 regex `.replace` yapıyor. Token başına
//    5 arama (2 bigram + 3 unigram formu) × 1.163 alias × 36 regex ≈ 209.000
//    regex işlemi — TEK TOKEN için.
//
//    ÖLÇÜM (Node 22, gerçek alias kardinalitesi 1163/41/28):
//      satır  karakter      eski        yeni (soğuk, indeks kurulumu dahil)
//        6       341     265 ms          9.8 ms
//       24     1 381   1 020 ms          6.0 ms
//      230    13 459  11 302 ms         16.7 ms
//    Eşdeğerlik: 303 mesaj (3 gerçek + 300 üretilmiş), 0 fark.
//
// ⚠️ NİYE ÖLÜMCÜL: bu iş AĞ BEKLEMESİ DEĞİL, saf CPU. Deno worker'ında CPU
//    seri akar. Toplu içe aktarımda `on_raw_post_insert` FOR EACH ROW olduğu
//    için tek dakikada 640 satır → 640 eşzamanlı çağrı → 640 × ~0.5-11 sn CPU
//    aynı worker havuzunda kuyruğa girer. Ölçülen sonuç: çağrılar 78-150 sn
//    sürüyor, 150.000 ms geçidinde 504 ile ölüyor ve `durumYaz`a hiç varamadan
//    satırı `pending` bırakıyor (#65 yığınının mekanizması).
//
// NOT: aynı desen `app/api/whatsapp-parse/route.ts:290 aliasDiziniKur()` içinde
//      ZATEN doğru yazılmış. Bu dosya güncellenmemişti — Deno/Next sınırı
//      yüzünden ortak modüle alınamıyor, iki kopya elle hizalanmak zorunda.
//
// WeakMap anahtarı alias DİZİSİ. #73'ten sonra `tumAliaslar()` 60 sn boyunca
// AYNI diziyi döndürüyor — yani sıcak worker'da indeks de yeniden kurulmuyor,
// WeakMap doğrudan vuruyor. Soğuk worker'da bir kez kurulur (~1 ms, 1.242 trNorm).
type AliasIndeksi = {
  sehir: Map<string, Alias>
  arac: [string, Alias][]
  ustyapi: [string, Alias][]
}
const _aliasIndeksCache = new WeakMap<object, AliasIndeksi>()

function aliasIndeksi(aliases: Alias[]): AliasIndeksi {
  const onbellek = _aliasIndeksCache.get(aliases as unknown as object)
  if (onbellek) return onbellek

  const sehir = new Map<string, Alias>()
  const arac: [string, Alias][] = []
  const ustyapi: [string, Alias][] = []

  for (const a of aliases) {
    const anahtar = trNorm(a.alias)
    // ⚠️ `.find` İLK eşleşeni döndürüyordu; Map'te de İLK giren kazanmalı.
    //    `if (!has)` olmadan son giren kazanır ve aynı yazımın iki alias'ı
    //    olduğunda seçim sessizce değişirdi.
    if (a.type === 'city') { if (!sehir.has(anahtar)) sehir.set(anahtar, a) }
    else if (a.type === 'vehicle') arac.push([anahtar, a])
    else if (a.type === 'body') ustyapi.push([anahtar, a])
  }

  // Sıralama da çağrı başına bir kez — eskiden findVehicle/findBodyType her
  // çağrıda `.filter().sort()` yapıyordu.
  arac.sort((x, y) => (y[1].priority || 50) - (x[1].priority || 50))
  ustyapi.sort((x, y) => (y[1].priority || 50) - (x[1].priority || 50))

  const indeks: AliasIndeksi = { sehir, arac, ustyapi }
  _aliasIndeksCache.set(aliases as unknown as object, indeks)
  return indeks
}

function findPlaces(text: string, aliases: Alias[]): PlaceHit[] {
  const norm = trNorm(text)
  const tokens = norm.split(' ').filter(t => t.length >= 3)
  const hits: PlaceHit[] = []
  // 🚨 W5/D4 — Eskiden `seen.add(match.normalized)` HAM değerle anahtarlanıyordu;
  // "Istanbul" ve "İstanbul" iki ayrı giriş oluyordu. Artık katlanmış anahtar.
  //
  // 🚨 #89-A (6 Ağu 2026) — `seen` artık Set DEĞİL Map: aynı ilin İKİNCİ isabetini
  //    sessizce ATMAK yerine, ilçesi varsa mevcut isabeti YÜKSELTİYORUZ.
  //    Sorun: dedup anahtarı SADECE il ("Ankara"). "Ankara Gölbaşı" metninde önce
  //    `ankara` (il, district=null, öncelik 90) isabet ediyor, sonra gelen
  //    `gölbaşı` (Ankara/Gölbaşı, öncelik 60) `seen.has('ankara')` yüzünden
  //    hits'e HİÇ GİRMİYORDU. Sıralama sorunu değil, DEDUP sorunuydu — öncelikleri
  //    değiştirmek bu yüzden hiçbir şeyi çözmezdi.
  //    Ölçek: 948 aktif ilçe alias'ının 912'si kendi ilinin bare alias'ından
  //    düşük/eşit öncelikte, yani "İl İlçe" yazılan her satırda ilçe düşüyordu.
  //    Varış ilçe doluluğu 7 günde %25,5 (3.363/13.183).
  //    🔒 Yükseltme kuralı KATI: il ASLA değişmez, öncelik ASLA değişmez, sadece
  //       `district` null iken doluyor. Yeni yer EKLEMEZ, yer SİLMEZ, sıra bozmaz.
  //    ⚠️ Yan etki (İSTENEN): blok kaynağıyla aynı ilçeye çözülen satırlar artık
  //       `ayniIlce` ile eşleşip ELENİYOR (bkz. satır ~811, ~716). Yani sahte
  //       "kendine şerit" kayıtları DÜŞÜYOR. `olc` KAYIP sütunu bu yüzden 0
  //       çıkmayabilir; bu bir gerileme değil, düzeltmenin ta kendisidir.
  const seen = new Map<string, PlaceHit>()

  const cityAliases = aliasIndeksi(aliases).sehir

  const ekleVeyaYukselt = (match: Alias, matched: string) => {
    const key = yerKey(match.normalized)
    const mevcut = seen.get(key)
    if (!mevcut) {
      const hit: PlaceHit = {
        normalized: match.normalized,
        priority: match.priority || 50,
        matched,
        district: match.district || null,
      }
      hits.push(hit)
      seen.set(key, hit)
      return
    }
    // #89-A: yalnız BOŞ ilçeyi doldur. Dolu ilçenin üzerine YAZMA (ilk kazanır).
    if (!mevcut.district && match.district) mevcut.district = match.district
  }

  // Bigram
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + ' ' + tokens[i + 1]
    const bigram2 = stripSuffix(tokens[i]) + ' ' + stripSuffix(tokens[i + 1])
    for (const bg of [bigram, bigram2]) {
      const match = cityAliases.get(bg)
      if (match) ekleVeyaYukselt(match, bg)
    }
  }

  // Unigram — 3 form: ham, tek-strip (ara form), tam-strip
  for (const token of tokens) {
    const stripped1 = stripSuffixOnce(token)
    const strippedFull = stripSuffix(token)
    const candidates = [...new Set([token, stripped1, strippedFull])]
    for (const cand of candidates) {
      const match = cityAliases.get(cand)
      if (match) ekleVeyaYukselt(match, cand)
    }
  }

  return hits.sort((a, b) => b.priority - a.priority)
}

function bestPlace(hits: PlaceHit[]): PlaceHit | null {
  return hits.length > 0 ? hits[0] : null
}

// -------------------------
// Araç tipi tespiti
// -------------------------
function findVehicle(text: string, aliases: Alias[]): string | null {
  const norm = trNorm(text)
  for (const [anahtar, va] of aliasIndeksi(aliases).arac) {
    if (norm.includes(anahtar)) return va.normalized
  }
  return null
}

// Üstyapı tespiti
function findBodyType(text: string, aliases: Alias[]): string | null {
  const norm = trNorm(text)
  for (const [anahtar, ba] of aliasIndeksi(aliases).ustyapi) {
    if (norm.includes(anahtar)) return ba.normalized
  }
  return null
}

// -------------------------
// URL çıkarma + arşivleme
// -------------------------
const EDGE_URL_REGEX = /https?:\/\/[^\s\u200b\u200c\u200d\u2060\u00A0]+/gi;

function extractUrlsEdge(text: string): Array<{ url: string; domain: string; category: string }> {
  const raw = (text.match(EDGE_URL_REGEX) || []).map((u: string) => u.replace(/[.,;!?)"']+$/, ''));
  const unique = [...new Set(raw)] as string[];
  return unique.map((url: string) => {
    let domain = '';
    let category = 'other';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* malformed */ }
    if (domain === 'chat.whatsapp.com') category = 'whatsapp_group';
    else if (domain === 't.me' || domain.includes('telegram.')) category = 'telegram';
    else if (domain.includes('facebook.com') || domain === 'fb.com') category = 'facebook_group';
    else if (domain.includes('instagram.com')) category = 'instagram';
    else if (domain.includes('linkedin.com')) category = 'linkedin';
    return { url, domain, category };
  });
}

// -------------------------
// Ton/Palet çıkarma
// -------------------------
function extractWeight(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*ton/i)
  if (m) return parseFloat(m[1].replace(',', '.'))
  return null
}

function extractPallet(text: string): number | null {
  const m = text.match(/(\d+)\s*palet/i)
  if (m) return parseInt(m[1])
  return null
}

// -------------------------
// Ana parse fonksiyonu
// -------------------------
interface Lane {
  from: string
  fromDistrict: string | null
  to: string
  toDistrict: string | null
  vehicle: string | null
  body_type: string | null
  weight_ton: number | null
  pallet: number | null
  raw_line: string
}

function parseMessage(message: string, aliases: Alias[]): {
  phones: string[]
  ad_type: 'yuk' | 'arac'
  lanes: Lane[]
} {
  const phones = extractPhones(message)
  const ad_type = detectAdType(message)
  const lanes: Lane[] = []

  const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 3)

  // Pass 1: ok/tire/den-ye ilişki tespiti + contextFrom (başa ok satırları için)
  let contextFrom: PlaceHit | null = null

  for (const line of lines) {
    const rel = splitByRelation(line)
    if (!rel) {
      // İlişki yok — contextFrom'u güncelle (ok'suz origin satırlar için)
      const nonRelHits = findPlaces(line, aliases)
      if (nonRelHits.length > 0) contextFrom = nonRelHits[0]

      // + var mı? Çoklu varış satırı olabilir
      if (line.includes('+')) {
        const parts = line.split(/[+\/]/).map(p => p.trim()).filter(p => p.length > 2)
        // 🚨 #87-B (6 Ağu 2026): `+` TEK BAŞINA "çoklu varış" demek DEĞİL. Fiyat
        //    satırları da `+` içeriyor: "duzce 1200+kdv" → parts ["duzce 1200","kdv"].
        //    Eskiden bu satır çoklu varış sayılıyor, köken ÖNCEKİ satırdan alınıyor ve
        //    `99183fb8`de "Düzce→Sakarya/Akyazı" + "Düzce→Bartın" gibi İKİ UYDURMA
        //    şerit doğuyordu — üstelik satır `processed` olduğu için kimse görmüyordu.
        //    ARTIK: en az İKİ parça tanınan bir yere çözülmeli ("TRABZON + RİZE" evet,
        //    "duzce 1200 + kdv" hayır).
        const yerliParca = parts.filter(p => bestPlace(findPlaces(p, aliases)) !== null)
        if (parts.length > 1 && yerliParca.length >= 2) {
          // Önceki satırlardan kalkış şehri bul
          let fromCity: PlaceHit | null = null
          for (const prevLine of lines) {
            if (prevLine === line) break
            const prevHits = findPlaces(prevLine, aliases)
            if (prevHits.length > 0) { fromCity = prevHits[0]; break }
          }
          if (fromCity) {
            for (const part of parts) {
              const partHits = findPlaces(part, aliases)
              const to = bestPlace(partHits)
              // W5/D4 — yazım farkı yüzünden "Istanbul→İstanbul" lane'i doğmasın.
              // 🚨 #92-C — ama satır "şehir içi" diyorsa o şerit MEŞRUDUR.
              if (to && (!ayniSehir(to.normalized, fromCity.normalized) ||
                         sehirIciSatiri(line))) {
                lanes.push({
                  from: fromCity.normalized,
                  fromDistrict: fromCity.district || null,
                  to: to.normalized,
                  toDistrict: to.district || null,
                  vehicle: findVehicle(line, aliases),
                  body_type: findBodyType(line, aliases),
                  weight_ton: extractWeight(line),
                  pallet: extractPallet(line),
                  raw_line: line
                })
              }
            }
            continue
          }
        }
      }
      continue
    }

    // Ok solunda şehir yoksa ("->DİYARBAKIR" gibi) önceki bağlamı kullan
    // 🚨 #87: eski hâli `rel.left.trim() ? ... : contextFrom` idi ve `splitByRelation`
    //    boş sol döndüremediği için `contextFrom` kolu HİÇ ÇALIŞMIYORDU. Ayrıca sol
    //    dolu ama içinde tanınan yer yoksa ("13.60 TIR -> ANKARA") satır sessizce
    //    düşüyordu. `||` her iki boşluğu da kapatır; yorumun hep iddia ettiği davranış.
    const from = bestPlace(findPlaces(rel.left, aliases)) || contextFrom

    const toHits = findPlaces(rel.right, aliases)

    // + veya / ile ayrılmış çoklu varış
    const rightParts = rel.right.split(/[+\/]/).map(p => p.trim()).filter(p => p.length > 2)

    // 🚨 #87-E (6 Ağu 2026) — #87-A'NIN YAN HASARI. BU KOLU SİLME.
    //    #87-A sol boş oku artık ilişki saydığı için satır BURADA TÜKETİLİYOR. Ama
    //    contextFrom da yoksa `from` null kalır ve eski `continue` satırı TAMAMEN
    //    düşürürdü. #87 ÖNCESİ bu satırlar `splitByRelation`'dan null dönüp TİRE
    //    kuralına düşüyor ve DOĞRU çözülüyordu:
    //      e5ba7700 · 1d640d19  "EYSAN TAŞIMACILIK / -> AVCILAR LİMAN - TUZLA"
    //        #87 öncesi: İstanbul/Avcılar→İstanbul/Tuzla · #87-A sonrası: HİÇ ŞERİT YOK
    //    `npm run olc:87` bunu "≥1→0 (KAYIP) = 2" olarak yakaladı; o sütun SIFIR OLMALI.
    //    ARTIK: kökeni bulunamayan sol-boş ok satırında okun SAĞINI tek başına yeniden
    //    ilişkiye sokuyoruz — yani #87 öncesi tire davranışı geri geliyor.
    // 🔒 YÖN GÜVENLİĞİ: bu kol YALNIZ `from` null iken, yani satırın zaten DÜŞTÜĞÜ
    //    durumda çalışır. Şerit EKLEYEBİLİR, asla SİLEMEZ. Bu yüzden #87-A/B/D'nin
    //    ölçülmüş kazançlarını geri almaz.
    // 🚨 #87-F (6 Ağu 2026) — BU KOL `contextFrom` YAZMAZ. SAKIN EKLEME.
    //    İlk hâlinde burada `contextFrom = altFrom` vardı ve "yalnız ekler" güvencesini
    //    KENDİ ELİYLE BOZUYORDU: kolun kurtardığı satır contextFrom'u doldurunca, ondan
    //    SONRAKİ sol-boş ok satırlarında `from` artık null olmuyor, bu kol devreye
    //    giremiyor ve satır normal yola düşüp KENDİ KENDİNE ŞERİT üretiyordu:
    //      6c75aeea "-> GEBZE - SİLİVRİ / ->GEBZE - MANİSA"
    //        #87 öncesi: Gebze→Silivri · Gebze→Manisa
    //        contextFrom yazan hâl: Gebze→Silivri · Gebze→GEBZE  (Manisa KAYIP)
    //      9cbb76e1 "->DİNAR-İSKENDERUN / ->DİNAR-İSTANBUL / ->DİNAR-ERZURUM / ->ESKİŞEHİR-MERSİN"
    //        4 doğru şerit → Dinar→İskenderun · Dinar→DİNAR · Dinar→Eskişehir
    //    `olc:87` bunları "KAYIP" saymadı (satırda hâlâ ≥1 şerit var), "changed" saydı.
    //    📌 Ders: KAYIP=0 aklama belgesi değildir; "şerit EKLENDİ ≠ şerit DOĞRU".
    //    contextFrom yazmayınca her sol-boş ok satırı kendi sağını yeniden çözer —
    //    #87 öncesi tire davranışının aynısı.
    // 📌 Ders: bir kolu "ulaşılabilir" yapmak, o kolun ele geçirdiği satırların ESKİ
    //    yolunu da kapatır. #87-A'da kazanç sayıldı, kaybedilen yol sayılmadı.
    // 🚨 #92 (7 Ağu 2026) — KAPI `if (!from)` İDİ VE YANLIŞTI. SAKIN GERİ ALMA.
    //    #87-F "kol contextFrom yazmasın" diyerek kolun KENDİ yazdığı bağlamı kesti.
    //    Ama `contextFrom`u asıl dolduran şey kolun kendisi değil, MEŞRU BİR BAŞLIK
    //    SATIRI (:646). Yani gerçek hayatta kol zaten hiç çalışmıyordu:
    //      "MERSİN HEMEN YÜKLENİR"   → :646 contextFrom = Mersin
    //      "->MERSİN-ANKARA"         → from = contextFrom = Mersin, yani `!from` FALSE
    //                                → kol atlanır, satır normal yola düşer
    //                                → bestPlace("MERSİN-ANKARA") = Mersin (eşit öncelik,
    //                                  metinde önce geçen kazanır) → **Mersin→Mersin**
    //    `npm run olc:87` (7 Ağu, 8.432 satır) bu kalıpta 9 DOĞRU şeridin 2'ye düştüğünü
    //    gösterdi (`17c1d00d` · `94be0c0d` · `b467e6c3` · `c7484f34` · `65b65d38` …).
    //    KAYIP sütunu yine 0'dı: satırda hâlâ şerit var, sadece YANLIŞ şerit.
    // 📌 DERS (üçüncü kez aynı ders): #87-A sol-boş oku ilişki sayarak bu satırları
    //    TİRE kuralından çaldı. Çalınan yolu geri veren kolu, çalınmanın en sık
    //    görüldüğü duruma (başlıklı blok) KAPALI yazmışız. Bir kolu koşullandırırken
    //    "bu koşul sahada ne sıklıkla doğru?" diye sor — burada neredeyse hiç.
    // ⚠️ YÖN GÜVENCESİ DEĞİŞTİ, BİLEREK: bu kol artık "yalnız ekler, silmez" DEĞİL.
    //    `from` doluyken de devreye girdiği için normal yolun üreteceği şeridi
    //    DEĞİŞTİRİR. Gerekçe: değiştirdiği şerit ölçülmüş biçimde yanlış (Mersin→Mersin).
    //    Bu yüzden `olc:87`in KENDİNE ŞERİT sütunu artık zorunlu bir kapıdır.
    if (rel.rel === 'arrow' && !rel.left.trim()) {
      const alt = splitByRelation(rel.right)
      if (alt && alt.left.trim()) {
        const altFrom = bestPlace(findPlaces(alt.left, aliases))
        const altTo = bestPlace(findPlaces(alt.right, aliases))
        // ⚠️ Burada YALNIZ `ayniSehir` kullanmak KAYBIN AYNISINI TEKRARLARDI:
        //    kurtarmaya çalıştığımız iki vaka da İSTANBUL İÇİ (Avcılar→Tuzla).
        //    Şart aşağıdaki normal yolun kuralıyla aynı olmalı — şehir FARKLI *veya* İLÇE farklı.
        // 🚨 #92-C — "şehir içi" ibaresi aynı-il şeridini meşru kılar (bkz. sehirIciSatiri).
        if (altFrom && altTo &&
            (!ayniSehir(altTo.normalized, altFrom.normalized) ||
             !ayniIlce(altTo.district, altFrom.district) ||
             sehirIciSatiri(line))) {
          // ⚠️ #87-F: burada `contextFrom` GÜNCELLENMEZ. Her sol-boş ok satırı
          //    kendi sağını bağımsız çözer; blok başlığı bozulmaz.
          lanes.push({
            from: altFrom.normalized,
            fromDistrict: altFrom.district || null,
            to: altTo.normalized,
            toDistrict: altTo.district || null,
            vehicle: findVehicle(line, aliases),
            body_type: findBodyType(line, aliases),
            weight_ton: extractWeight(line),
            pallet: extractPallet(line),
            raw_line: line
          })
          continue
        }
        // Sağ taraf ilişki gibi görünüyor ama uçlardan biri yere çözülmüyor
        // ("-> ANKARA - 5000 TL") → normal yola düş, satırı yutma.
      }
    }
    if (!from) continue
    // Başarılı from → contextFrom güncelle
    contextFrom = from

    // 🚨 #92-B (7 Ağu 2026) — BU İKİ KOLDA KENDİNE-ŞERİT KORUMASI HİÇ YOKTU.
    //    :672'deki `+` kolu `!ayniSehir` ile koruyordu, Pass 2 de koruyordu, ama
    //    Pass 1'in ASIL ok/tire kolu `from`u `to`ya hiç kıyaslamadan yazıyordu.
    //    Sonuç: `Mersin→Mersin` gibi anlamsız şeritler DB'ye kadar gidiyordu
    //    (`olc:87` 7 Ağu çıktısı). Koruma yokluğu #92-A'nın zararını görünmez kıldı:
    //    yanlış varış "en azından bir şerit" olarak sayıldığı için KAYIP sütununa
    //    düşmedi. İki kusur birbirini örtüyordu.
    // 📌 Kural :743 ile AYNI olmalı — şehir FARKLI *veya* İLÇE farklı. Sadece
    //    `ayniSehir` kullanmak `İstanbul→İstanbul/Tuzla` gibi GERÇEK şeritleri öldürür.
    // 🚨 #92-C (10 Ağu 2026) — satır "şehir içi" diyorsa aynı-il şeridi MEŞRUDUR.
    //    `ANKARA ➡️ ANKARA Ş.İÇİ` #92-B tarafından düşürülüyordu. Bkz. sehirIciSatiri().
    const sehirIci = sehirIciSatiri(line)
    const kendineSerit = (to: PlaceHit): boolean =>
      !sehirIci &&
      ayniSehir(to.normalized, from.normalized) && ayniIlce(to.district, from.district)

    if (rightParts.length > 1) {
      for (const part of rightParts) {
        const partHits = findPlaces(part, aliases)
        const to = bestPlace(partHits)
        if (to && !kendineSerit(to)) {
          lanes.push({
            from: from.normalized,
            fromDistrict: from.district || null,
            to: to.normalized,
            toDistrict: to.district || null,
            vehicle: findVehicle(line, aliases),
            body_type: findBodyType(line, aliases),
            weight_ton: extractWeight(line),
            pallet: extractPallet(line),
            raw_line: line
          })
        }
      }
    } else {
      const to = bestPlace(toHits)
      if (to && !kendineSerit(to)) {
        lanes.push({
          from: from.normalized,
          fromDistrict: from.district || null,
          to: to.normalized,
          toDistrict: to.district || null,
          vehicle: findVehicle(line, aliases),
          body_type: findBodyType(line, aliases),
          weight_ton: extractWeight(line),
          pallet: extractPallet(line),
          raw_line: line
        })
      }
    }
  }

  // ── Pass 2: YÜKLEMELİ blok yapısı ──────────────────────────────
  // Her zaman çalışır (lanes.length bağımsız)
  {
    let blockOrigin: PlaceHit | null = null
    let blockVehicle: string | null = null
    let blockBody: string | null = null
    const blockSeen = new Set<string>()

    for (const line of lines) {
      const normLine = trNorm(line)
      // "YÜKLEMELİ" + "YÜKLER"/"YÜKLEME" blok origin tespiti
      // Ör: "ÇORLU YÜKLEME\nESENYURT TIR", "ANKARA GÖLBAŞINDAN YÜKLER\nİSTANBUL..."
      const isYuklemeli = normLine.includes('yuklemeli') || normLine.includes('yuklemesi')
        || normLine.includes('yuklenecek') || normLine.includes('yukleme') || normLine.includes('yukler')
        || normLine.includes('sarar') // NAZİLLİDEN SARAR gibi
        || normLine.includes('yukle') // Hadımköy yükle gibi

      if (isYuklemeli) {
        const yuklemePlaces = findPlaces(line, aliases)
        // 🚨 #88-A (6 Ağu 2026): ESKİDEN burada koşulsuz `blockOrigin = bestPlace(...)`
        //    vardı. `isYuklemeli` yalnız "yukle" ALT DİZİSİNE bakıyor, o yüzden yükle
        //    ile HİÇ İLGİSİ OLMAYAN dolgu satırları da ateşliyor:
        //      "2 koli 55*50*50 üstuste yüklenmez."   → yuklenmez ⊃ yukle
        //      "3 tabana 3 üstü yüklenir"             → yuklenir  ⊃ yukle
        //      "1 Kapak yer Yanyana yükleme üstene birşey konulmaz."
        //    Bu satırlarda yer yok → bestPlace null → blockOrigin SİLİNİYORDU ve
        //    hemen altındaki "Teslim Yeri ... / Van" satırı sahipsiz kalıyordu.
        //    Kalıp gerçek ve yaygın: "Yüklemeli Parça Aracı" şablonu (0 532 203 43 81).
        //    ARTIK: yer içermeyen "yükle*" satırı bloğu BOZMAZ, sadece atlanır.
        const yeniOrigin = bestPlace(yuklemePlaces)
        if (!yeniOrigin) continue
        blockOrigin = yeniOrigin
        blockVehicle = findVehicle(line, aliases)
        blockBody = findBodyType(line, aliases)
        // Aynı satırda hem kaynak hem hedef varsa (ör: "İKİTELLİ YÜKLEME HADIMKÖY")
        if (blockOrigin && yuklemePlaces.length >= 2) {
          // W5/D4 — şehir VE ilçe karşılaştırması katlanmış anahtarla.
          const dest = yuklemePlaces.find(p =>
            !ayniSehir(p.normalized, blockOrigin!.normalized) || !ayniIlce(p.district, blockOrigin!.district)
          )
          if (dest) {
            const key = laneKey(blockOrigin.normalized, blockOrigin.district, dest.normalized, dest.district)
            if (!blockSeen.has(key)) {
              lanes.push({
                from: blockOrigin.normalized,
                fromDistrict: blockOrigin.district || null,
                to: dest.normalized,
                toDistrict: dest.district || null,
                vehicle: blockVehicle,
                body_type: blockBody,
                weight_ton: extractWeight(line),
                pallet: extractPallet(line),
                raw_line: line
              })
              blockSeen.add(key)
            }
            blockOrigin = null // tek satırlık, devam satırı bekleme
          }
        }
        continue
      }

      // Ok, boşluklu tire veya kendi içinde ilişki olan satır → reset
      // NOT: satır başı tire (-TUZLA) reset etmemeli — yalnızca ayraç tireler resetler
      // 🚨 #88-B (6 Ağu 2026): `splitByRelation(line) !== null` şartı, BLOCK_RESET_RE'nin
      //    bilinçli olarak DIŞARIDA bıraktığı boşluksuz tireyi arka kapıdan geri sokuyordu.
      //    `splitByRelation` "(KISA-UZUN) DORSE" satırını `rel:'dash_nospace'` diye
      //    ayrıştırır (sol="(KISA", sağ="UZUN) DORSE") → blok resetleniyordu. Oysa bu
      //    satır bir DORSE TARİFİ, ilişki değil. Gerçek örnek `acb96bbc`:
      //      MANİSA TURGUTLU YÜKLEMELİ / (KISA-UZUN) DORSE / AKŞEHİR TIR
      //    Manisa→Konya/Akşehir şeridi bu yüzden hiç doğmuyordu (alias'ların ikisi de var).
      //    ARTIK: ilişkili satır ancak İÇİNDE TANINAN YER VARSA resetler. Yersiz satır
      //    (dorse/ödeme/ölçü tarifi) bloğu bozmaz. Gerçek güzergâh satırını Pass 1 zaten alır.
      // 📌 #87 NOTU (6 Ağu 2026) — BİLEREK DEĞİŞMEDİ, tekrar "düzeltmeye" kalkma.
      //    #87-A'dan sonra `splitByRelation` SOLU BOŞ oku da ilişki sayıyor
      //    ("➡️SAMSUN" → rel:'arrow', left:''), yani bu satırlar burada hâlâ
      //    resetliyor. İlk refleks "solu boş ok bloğun varışıdır, resetlememeli"
      //    demek oldu; öyle bir `!solBos` muafiyeti yazıldı ve ÖLÇÜLDÜ: 8 gerçek
      //    vaka + test:87 + test:pass2 çıktısı BİT BİT AYNI kaldı. Sebep: bu
      //    satırların kökenini Pass 1 zaten sahipleniyor — `YÜKLEME` satırı
      //    ilişkisiz olduğu için 617'de `contextFrom`u kuruyor, ok satırı da onu
      //    kullanıyor. Muafiyet sıfır kazanç, artı blok sınırını gevşetme riski
      //    getiriyordu; geri alındı. Diff küçük kalsın.
      if (blockOrigin && (
        ARROW_RE.test(line) || BLOCK_RESET_RE.test(line) ||
        (splitByRelation(line) !== null && findPlaces(line, aliases).length > 0)
      )) {
        blockOrigin = null
        continue
      }

      if (blockOrigin) {
        const hits = findPlaces(line, aliases)
        if (hits.length > 0) {
          const h = hits[0]
          // Aynı şehir farklı ilçe (şehiriçi güzergah) de lane sayılır
          // ⚠️ Bu mantık BİLİNÇLİ — silme. W5/D4 yalnız karşılaştırmayı katladı.
          const isDiff = !ayniSehir(h.normalized, blockOrigin.normalized) ||
            (h.district && blockOrigin.district && !ayniIlce(h.district, blockOrigin.district))
          if (isDiff) {
            const key = laneKey(blockOrigin.normalized, blockOrigin.district, h.normalized, h.district)
            if (!blockSeen.has(key)) {
              lanes.push({
                from: blockOrigin.normalized,
                fromDistrict: blockOrigin.district || null,
                to: h.normalized,
                toDistrict: h.district || null,
                vehicle: blockVehicle,
                body_type: blockBody,
                weight_ton: extractWeight(line),
                pallet: extractPallet(line),
                raw_line: line
              })
              blockSeen.add(key)
            }
          }
        }
      }
    }
  }

  // ── Pass 3: Ardışık tek-şehir satırları ────────────────────────────────────
  // "İstanbul fatih\nİzmir Gaziemir" veya "KARAMAN DAN\nBOLU" gibi
  // ok/tire olmadan alt alta yazılmış kalkış-varış satırlarını yakalar.
  if (lanes.length === 0) {
    for (let i = 0; i < lines.length - 1; i++) {
      const hitsA = findPlaces(lines[i], aliases)
      const hitsB = findPlaces(lines[i + 1], aliases)
      if (
        hitsA.length === 1 && hitsB.length === 1 &&
        hitsA[0].priority >= 40 && hitsB[0].priority >= 40
      ) {
        const a = hitsA[0], b = hitsB[0]
        // ⚠️ Aynı şehir + farklı ilçe kabulü BİLİNÇLİ (şehiriçi güzergâh) — silme.
        const isDiff = !ayniSehir(a.normalized, b.normalized) ||
          (a.district && b.district && !ayniIlce(a.district, b.district))
        if (isDiff) {
          // Araç/yük bilgisi için çevre satırları da tara
          const ctx = lines.slice(i, i + 4).join(' ')
          lanes.push({
            from: a.normalized, fromDistrict: a.district || null,
            to: b.normalized, toDistrict: b.district || null,
            vehicle: findVehicle(ctx, aliases),
            body_type: findBodyType(ctx, aliases),
            weight_ton: extractWeight(ctx),
            pallet: extractPallet(ctx),
            raw_line: lines[i] + ' ' + lines[i + 1]
          })
        }
      }
    }
  }

  // Fallback: 2 şehir aynı satırda — TÜM eşleşen satırları tara (break yok)
  if (lanes.length === 0) {
    for (const line of lines) {
      const hits = findPlaces(line, aliases)
      if (hits.length >= 2 && hits[0].priority >= 50 && hits[1].priority >= 50) {
        // Aynı şehir: sadece ilçeler farklıysa kabul et
        // 🚨 W5/D4 — SAHTE "İstanbul→İstanbul" İLANLARININ ÇIKTIĞI YER BURASI.
        // `sameCity` ham string eşitliğiydi: `'Istanbul' !== 'İstanbul'` olduğu için
        // koruma hiç devreye girmiyor, ilçesiz iki İstanbul eşleşmesi lane oluyordu.
        // ⚠️ `diffDist` mantığı BİLİNÇLİ: ilçeler gerçekten farklıysa (şehiriçi
        // güzergâh) lane korunmalı — silme, yalnız karşılaştırma katlandı.
        // ⚠️ BULGU (W5/D4, testle doğrulandı): bu dalın `sameCity===true` kolu TEK
        // SATIR için ULAŞILAMAZ, çünkü `findPlaces` şehir bazında tekilleştiriyor —
        // aynı şehrin ikinci ilçesi `hits`e hiç girmiyor. Eskiden buraya düşen tek
        // senaryo `Istanbul`/`İstanbul` bozulmasıydı, yani sahte lane üreten yoldu.
        // Şehiriçi güzergâh AYRI SATIRLARDA hâlâ yakalanıyor (Pass 2 ~558, Pass 3
        // ~594 iki farklı `findPlaces` çağrısını karşılaştırıyor). Silinmedi:
        // `findPlaces` ileride ilçe bazında tekilleştirilirse tekrar canlanır.
          const sameCity = ayniSehir(hits[0].normalized, hits[1].normalized)
          const diffDist = !ayniIlce(hits[0].district, hits[1].district)
          if (!sameCity || (sameCity && hits[0].district && hits[1].district && diffDist)) {
          lanes.push({
            from: hits[0].normalized,
            fromDistrict: hits[0].district || null,
            to: hits[1].normalized,
            toDistrict: hits[1].district || null,
            vehicle: findVehicle(line, aliases),
            body_type: findBodyType(line, aliases),
            weight_ton: extractWeight(line),
            pallet: extractPallet(line),
            raw_line: line
          })
          // break kaldırıldı — tüm satırları tara
        }
      }
    }
  }

  // Duplicate lane temizle (from+fromDistrict+to+toDistrict kombinasyonu)
  // W5/D4 — anahtar katlanmış: "Istanbul→Ankara" ile "İstanbul→Ankara" tek lane.
  const seen = new Set<string>()
  const uniqueLanes = lanes.filter(l => {
    const key = laneKey(l.from, l.fromDistrict, l.to, l.toDistrict)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { phones, ad_type, lanes: uniqueLanes }
}

// -------------------------
// HTTP Handler
// -------------------------
Deno.serve(async (req) => {
  try {
    const { raw_post_id } = await req.json()
    if (!raw_post_id) return new Response(JSON.stringify({ error: 'raw_post_id gerekli' }), { status: 400 })

    // raw_posts'tan al
    const { data: rawPost } = await supabase
      .from('raw_posts')
      .select('*')
      .eq('id', raw_post_id)
      .single()

    if (!rawPost) return new Response(JSON.stringify({ error: 'raw_post bulunamadı' }), { status: 404 })

    // ── PRE-CHECK: raw_text boş veya null ise LLM''e gidilmez ──
    const rawText: string | null = rawPost.raw_text ?? null
    if (!rawText || rawText.trim().length === 0) {
      edgeLog('WARN', 'PRE-CHECK FAILED — raw_text boş veya null', {
        raw_post_id,
        output_status: 'pre_check_failed',
        error_message: 'raw_text boş veya null',
      })
      // ⚠️ `damgala: false` KASITLI. `processed_at` bugün üç sınıfı ayıran TEK
      //    işaret: damgasız = "buraya hiç varılamadı" (boş metin ya da şerit yok),
      //    damgalı = "şerit vardı, ilan oluşmadı". #42/#64 ölçümü buna dayanıyor.
      //    Kalıcı çözüm `parse_lanes_found` kolonu (#64); o gelene kadar bozma.
      await durumYaz(supabase, raw_post_id, 'no_lane', false, 'raw_text bos')
      return new Response(JSON.stringify({ success: false, reason: 'empty_raw_text' }), { status: 400 })
    }

    // ── URL arşivleme (fire-and-forget) ──────────────────────────────────
    const foundUrls = extractUrlsEdge(rawText);
    if (foundUrls.length > 0) {
      supabase
        .from('archived_links')
        .upsert(
          foundUrls.map(({ url, domain, category }) => ({
            url, domain, category,
            source: 'whatsapp_parse',
            raw_post_id: raw_post_id,
            status: 'pending_review',
          })),
          { onConflict: 'url', ignoreDuplicates: true }
        )
        .then(() => {})
        .catch(() => {});
    }

    // Alias'ları yükle (SAYFALANARAK — tek sorgu 1000'de sessizce kesiliyordu)
    const aliases = await tumAliaslar()

    // Telefonu ham metinden çıkar (cleanMessage telefon satırlarını siliyor)
    const phonesFromRaw = extractPhones(rawText)

    // Parse için mesajı temizle
    const cleanedText = cleanMessage(rawText)
    const result = parseMessage(cleanedText, aliases)

    edgeLog('INFO', 'LLM parse tamamlandı', {
      raw_post_id,
      output_status: 'success',
      input_length: rawText.length,
      lanes_found: result.lanes.length,
      raw_text_preview: rawText.substring(0, 80),
    })

    // Ham metinden bulunan telefonları ekle
    if (phonesFromRaw.length > 0 && result.phones.length === 0) {
      result.phones.push(...phonesFromRaw)
    }

    if (result.lanes.length === 0) {
      // ⚠️ `damgala: false` — yukarıdakiyle aynı gerekçe. Bu dal #42'nin sınıfı:
      //    canlı ölçümde 55 no_lane'in 23'ü buradan geçti (kova_a=1, kova_b=12,
      //    kova_c=9). Damga atarsak o ayrım kaybolur.
      await durumYaz(supabase, raw_post_id, 'no_lane', false, 'serit bulunamadi')
      return new Response(JSON.stringify({ success: true, lanes: 0 }))
    }

    // Aynı raw_line'dan gelen lane'leri grupla (tek ilan, çok stop)
    // Farklı raw_line'lar → ayrı ilanlar
    const lineGroups = new Map<string, Lane[]>()
    for (const lane of result.lanes) {
      const key = lane.raw_line
      if (!lineGroups.has(key)) lineGroups.set(key, [])
      lineGroups.get(key)!.push(lane)
    }

    // Shadow profile upsert: ilanı gönderen telefon kayıtlı kullanıcı değilse
    // shadow_profiles'a upsert et ve shadow_profile_id al
    let shadowProfileId: string | null = null
    const contactPhone = result.phones[0] || null
    if (contactPhone && !rawPost.user_id) {
      // +90 normalize: "05XXXXXXXXX" → "+905XXXXXXXXX"
      const normalizedPhone = contactPhone.startsWith('0')
        ? '+9' + contactPhone
        : contactPhone
      const { data: spData } = await supabase.rpc('upsert_shadow_profile', { p_phone: normalizedPhone })
      if (spData) shadowProfileId = spData as string
    }

    // ── İlan üretimi ──────────────────────────────────────────────────────────
    //
    // 🚨 ILAN_VER_ANALIZ W1+. Burada eskiden `listings` INSERT'i ve ardından
    // `listing_stops` için ayrı bir döngü vardı. İkisi ayrı PostgREST isteği =
    // ayrı transaction: durak insert'i patlarsa geriye DURAKSIZ ilan kalıyordu
    // (V5). Uygulamadaki yollar `lib/ilan-yaz.ts`'e alındı ama bu fonksiyon
    // Deno'da koştuğu için o modülü IMPORT EDEMEZ — ortak zemin `ilan_olustur()`
    // RPC'si. Artık ilan + durakları tek transaction'da doğuyor.
    //
    // ⚠️ Migration: `docs/20260729_ilan_olustur_v2.sql` — `raw_post_id`,
    // `shadow_profile_id`, `is_repost` alanlarını YAZAN sürüm. v1 ile deploy
    // edilirse bu üç alan sessizce boş kalır.
    //
    // ── COĞRAFİ GEÇİŞ Dalga 2 — bu dosya NEDEN `province_id` GÖNDERMİYOR ──────
    //
    // Aşağıdaki `origin_city` (ve `p_stops[].city`) `aliases.normalized`'ın HAM
    // değeri. 2026-07-29'a kadar bu değer doğrudan tabloya yazılıyordu ve W5
    // alias öğrenmesi 'istanbul' (küçük i) ürettiği için 22.474 ilan
    // `origin_city='istanbul'` ile doğdu — ana sayfa filtresi 'İstanbul' ile
    // büyük/küçük harf duyarlı `.includes()` yaptığından bu ilanlar kullanıcıya
    // GÖRÜNMÜYORDU. (Onarım: `docs/20260730_istanbul_kanonik.sql`.)
    //
    // `ilan_olustur` v3 bunu YAPISAL olarak imkânsız kıldı: RPC metni `il_key()`
    // ile katlayıp `provinces`'tan çözüyor ve `province_id`'yi KENDİSİ türetiyor.
    // Bu yüzden burada bir şey göndermeye gerek yok — Deno bu dosyada
    // `lib/lokasyon.ts`'i zaten import EDEMEZ.
    //
    // ⚠️ GÜNCELLEME (3 Ağu 2026, v4 canlıda): bu yorum "…ve `origin_city`'yi
    //    kanonik ada çevirerek YAZIYOR" diyordu — ARTIK YAZMIYOR. v4 metin
    //    kolonlarına hiç dokunmuyor, yalnız `province_id` yazıyor; kolonlar
    //    Dalga 5'te tamamen düşüyor. Gönderdiğimiz `origin_city` hâlâ GEREKLİ
    //    ama artık yalnızca ÇÖZÜMLEME GİRDİSİ — saklanan bir değer değil.
    //    (Yorumun kendisi 4 Ağu'da düzeltildi; koddan bağımsız yaşlanmıştı.)
    //
    // 🚨 v4 ÇÖZEMEZSE ARTIK REDDEDİYOR (`22023`), v3 gibi ham metni saklamıyor.
    //    Bu yolun `origin_province_id` GÖNDERMEDİĞİNİ unutma: il yalnızca
    //    aşağıdaki `origin_city` metninden çözülür. Yani buradaki alias
    //    normalizasyonu artık sadece "doğru yazım" değil, ilanın VAR OLMA şartı.
    //
    // ✅ GÜNCELLEME (7 Ağu 2026, #50): bu yorum "district_official NULL kalıyor,
    //    DB'de ilçe tablosu YOK" diyordu — artık YANLIŞ. Dalga 5 `public.districts`
    //    tablosunu (973 ilçe) açtı ve `ilan_olustur` v4.1 `district_official`
    //    boş gelirse `ilce_resmi(province_id, district)` ile kendisi türetiyor.
    //    Bu satır o yüzden hiçbir şey GÖNDERMİYOR bile — RPC'nin yedek bacağı
    //    dolduruyor. Canlı ölçüm: WhatsApp kanalında flag doluluğu %0 → %98.
    // ⚠️ Migration: `docs/20260730_ilan_olustur_v3.sql` — v2 ile deploy edilirse
    // `origin_province_id` sessizce NULL kalır (hata vermez, sadece boş).
    let created = 0
    for (const [, lanes] of lineGroups) {
      const firstLane = lanes[0]
      const { data: rpcSonuc, error: rpcHata } = await supabase.rpc('ilan_olustur', {
        p_listing: {
          listing_type: result.ad_type,
          origin_city: firstLane.from,
          origin_district: firstLane.fromDistrict || null,
          contact_phone: contactPhone,
          source: rawPost.source || 'whatsapp',
          // Sosyal medyadan gelen her ilan insan gözü görmeden yayına çıkmaz.
          moderation_status: 'pending',
          status: 'passive',
          trust_level: 'social',
          raw_post_id: raw_post_id,
          raw_text: rawPost.raw_text,
          notes: firstLane.raw_line,
          vehicle_type: firstLane.vehicle ? [firstLane.vehicle] : null,
          body_type: firstLane.body_type ? [firstLane.body_type] : null,
          shadow_profile_id: shadowProfileId,
          // Repost bayrağı raw_posts'tan taşınır. ÖNCEDEN whatsapp-parse route'u
          // orijinal ilanı ayrıca kopyalıyordu; trigger de bu fonksiyonu çağırdığı
          // için aynı mesaj İKİ ilan üretiyordu. Artık tek üretici burasıdır.
          is_repost: rawPost.is_repost === true,
        },
        p_stops: lanes.map(l => ({
          city: l.to,
          district: l.toDistrict || null,
          cargo_type: null,
          weight_ton: l.weight_ton,
          // ⚠️ RPC içinde `::int`; ondalık gelirse 22P02 atar ve TÜM transaction
          // geri sarılır. Parser "1,5 palet" yazabilir — burada yuvarlıyoruz.
          pallet_count: typeof l.pallet === 'number' && isFinite(l.pallet)
            ? Math.round(l.pallet)
            : null,
        })),
      })

      if (rpcHata || !rpcSonuc) {
        edgeLog('ERROR', 'İlan oluşturulamadı (ilan_olustur)', {
          raw_post_id,
          output_status: 'error',
          error_message: rpcHata?.message ?? 'rpc null döndü',
          error_code: rpcHata?.code ?? null,
          stop_count: lanes.length,
        })
        continue
      }
      created++
    }

    // 🚨 DURUM, SONUCA GÖRE YAZILIR — "denedim" ile "oldu" aynı şey değil.
    //
    // Burada koşulsuz `processed` yazılıyordu. Yukarıdaki döngü RPC hatasında
    // `continue` ediyor, yani HİÇ ilan oluşmasa bile raw_post `processed`
    // işaretleniyordu → mesaj `no_lane` kuyruğundan DÜŞÜYOR ve moderatör onu bir
    // daha görmüyordu. Sessiz kayıp; üstelik en kolay kurtarılabilir yerde
    // (`reprocess-no-lane` alias öğretildikten sonra yeniden deneyebilirdi).
    //
    // ⚠️ Bu, `ilan_olustur` v4'ün ÖN KOŞULU. v4 çözülemeyen ili artık 22023 ile
    //    REDDEDİYOR (v3 ham metni kolona yazıp geçiyordu). Yani v4 bu satırı
    //    nadir bir kenar durumdan BEKLENEN AKIŞA çeviriyor. Sırayla:
    //      1) bu düzeltme deploy edilir,
    //      2) sonra v4 canlıya çıkar.
    //    Ters sırada, Deno'dan gelen her çözümsüz il kalıcı olarak kaybolur.
    //
    // `no_lane` bilinçli tercih ('error' değil): kuyruğun okuyucuları zaten o
    // değere bakıyor (`learn-aliases`:80,190,458 · `moderator/page.tsx`:221,233 ·
    // `reprocess-no-lane`:19). Yeni bir durum değeri eklemek beş okuyucuyu
    // birden güncellemeyi gerektirirdi ve anlam da doğru: "bu mesajdan lane
    // çıkarılamadı" — ister parser bulamadığı için, ister ili çözülemediği için.
    // 🕐 `processed_at` damgası — 4 Ağu 2026'da eklendi (#41).
    // 🚨 BURASI KOLONUN TEK YAZICISI. Eklenmeden önce `processed_at`'i repo'da
    //    HİÇBİR ŞEY yazmıyordu (`grep -rn processed_at` → 0 eşleşme, ne TS ne
    //    SQL). Yani kolon şemada vardı ve **her satırda NULL'dı** — başarılıda
    //    da, `no_lane`de de. "Başarısız yolda eksik" değil, hiç kullanılmıyordu.
    //    Sonuç: bir mesajın NE ZAMAN işlendiği kayıtta yoktu.
    //    3 Ağu'da `no_lane` oranı %39.7'ye sıçrayınca "bunu v4 mü yaptı" sorusuna
    //    cevap veremedik; işleme anını `created_at`ten TAHMİN etmek zorunda kaldık
    //    (alım ile işleme aynı koşuda olduğu için tutuyor — ama parti mantığı
    //    değiştiği gün bu tahmin sessizce çöker).
    //    ⚠️ Bir kaydın en çok işe yaradığı an, onu yazmayı en gereksiz
    //       bulduğumuz an: BAŞARISIZLIK anı.
    //
    // 🚨 #65 (5 Ağu 2026) — BU UPDATE'İN DÖNÜŞÜ KONTROL EDİLMİYORDU. Havuz
    //    tükendiğinde (PGRST003) sessizce düşüyor ve satır `pending` kalıyordu.
    //    176 RPC-hatalı postun 110'u tam olarak böyle mahsur kaldı. Artık
    //    `durumYaz` başarısızlığı `status_write_failed` ile logluyor.
    await durumYaz(
      supabase,
      raw_post_id,
      created > 0 ? 'processed' : 'no_lane',
      true,
      created > 0 ? 'ilan olustu' : 'serit var ilan yok'
    )

    if (created === 0) {
      edgeLog('WARN', 'Lane bulundu ama hiç ilan oluşmadı — no_lane kuyruğunda bırakıldı', {
        raw_post_id,
        output_status: 'no_listing_created',
        lanes_found: result.lanes.length,
      })
    }

    return new Response(JSON.stringify({ success: true, lanes: result.lanes.length, created }))

  } catch (err: any) {
    edgeLog('ERROR', 'Parse hatası', {
      output_status: 'error',
      error_message: err?.message ?? String(err),
    })
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
