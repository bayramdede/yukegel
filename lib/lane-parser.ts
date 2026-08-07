// lib/lane-parser.ts — deterministik (LLM'siz) ilan metni ayrıştırıcı.
//
// 🚨 KÖKEN: bu dosyadaki `cleanMessage`/`trNorm`/`stripSuffix`/`extractPhones`/
// `detectAdType`/`splitByRelation`/`findPlaces`/`findVehicle`/`findBodyType`/
// `extractWeight`/`extractPallet` fonksiyonları `supabase/functions/parse-listing/
// index.ts`teki (Deno, WhatsApp toplu import) AYNI mantığın ELLE SENKRON TUTULAN
// bir kopyasıdır — proje genelindeki `lib/whatsapp/telefon.ts` deseniyle aynı
// gerekçe: Deno edge fonksiyonu `supabase functions deploy` ile yalnız kendi
// klasörünü paketler, `lib/`i import edemez (bkz. `docs/COGRAFI_GECIS.md`,
// "Deno `lib/lokasyon.ts`'i import EDEMEZ"). Birini değiştirirsen diğerini de
// elle güncelle — özellikle `aliases` tablosunun şeklini veya alias eşleştirme
// kurallarını değiştiren her migration.
//
// ⚠️ TEK KASITLI SAPMA: `DEN_RE`. Deno'daki hâli ekten ÖNCE zorunlu boşluk istiyor
// ("Tuzla dan" gibi ayrı kelime); WhatsApp broadcast'i genelde ok/tire kullanır,
// bu regex nadiren devreye girer. Web'de kullanıcı tam gramatik cümle yazar
// ("İstanbul'dan" — kesme işaretiyle BİTİŞİK, boşluksuz). Deno'nun hâliyle
// kullanılsaydı `MetindenIlan.tsx`'teki resmî örnek metin bile eşleşmezdi.
// Bkz. aşağıdaki `DEN_RE` yorumu.
//
// 🎯 BU DOSYANIN AMACI Deno'daki çok-satırlı/çok-şeritli broadcast ayrıştırıcısını
// (`parseMessage`, Pass 1/2/3) TAŞIMAK DEĞİL — o, WhatsApp'ın "->İL-İLÇE" tarzı
// toplu mesaj biçimine karşı aylarca sertleştirildi (#86-#92) ve farklı bir girdi
// dağılımı için ayarlı. Bunun yerine TEK BİR serbest metin ilanı (web textarea'sına
// yazılan) için daha basit, daha TEDBİRLİ bir orkestratör (`hizliAyristir`) yazıldı:
// ilişki (ok/tire/den-ye) bulup İKİ tarafı da alias tablosundan çözebiliyorsa
// sonuç döner; çözemiyorsa `null` döner ve çağıran taraf LLM'e düşer. Belirsiz
// durumda SESSİZCE YANLIŞ doldurmak, kullanıcıya "çözemedim" demekten kötüdür.

export interface Alias {
  type: string
  alias: string
  normalized: string
  priority: number
  district: string | null
}

export interface PlaceHit {
  normalized: string
  priority: number
  matched: string
  district: string | null
}

// ── Mesaj temizleme (Deno `cleanMessage` ile birebir, satır 137-197) ────────
const BLACKLIST_PHRASES = [
  'komisyon yok', 'komisyonsuz', 'kdv dahil', 'kdv haric',
  'whatsapp uzerinden iletildi', 'chatbridge', 'toplu gonderildi',
  'mesaj bekleniyor', 'goruntu dahil edilmedi', 'bu mesaj silindi',
  'forwarded', 'arama yapildi',
]

export function cleanMessage(text: string): string {
  // Geçerli vekil çiftlerine dokunmadan YALNIZ yalnız kalan vekilleri sil (#86).
  text = text.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ''
  )
  return text
    .split('\n')
    .map(line => {
      line = line.replace(/[➡➜➔⟶⏩⏪▶◀⇒⇔]/gu, '->')
      line = line.replace(/(?<=[A-Za-zÇĞİÖŞÜçğıöşü])\s*[👉📍]\s*(?=[A-Za-zÇĞİÖŞÜçğıöşü])/gu, ' -> ')
      line = line.replace(/(?<=[A-Za-zÇĞİÖŞÜçğıöşü])\s*=+\s*(?=[A-Za-zÇĞİÖŞÜçğıöşü])/g, ' -> ')
      line = line.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu, ' ')
      line = line.replace(/[‎‪‬‏​‌‍⁠﻿\u{FE0F}]/gu, '')
      line = line.replace(/\*([^*]+)\*/g, ' $1 ').replace(/_([^_]+)_/g, ' $1 ')
      line = line.replace(/(?:\+?9?0?)?\s*5\d[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g, '')
      line = line.replace(/0\s*5\s*\d[\s\-\.]?\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}/g, '')
      return line.trim()
    })
    .filter(line => {
      if (!line || line.length < 3) return false
      if (/^[-=─═—–*\.]{3,}$/.test(line)) return false
      const norm = line.toLowerCase()
        .replace(/[ç]/g, 'c').replace(/[ğ]/g, 'g').replace(/[ıİ]/g, 'i')
        .replace(/[ö]/g, 'o').replace(/[ş]/g, 's').replace(/[ü]/g, 'u')
      if (BLACKLIST_PHRASES.some(p => norm.includes(p))) return false
      if (/^[\d\s\+\-\.\(\)\/,]+$/.test(line)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Türkçe normalizasyon (Deno `trNorm` ile birebir) ────────────────────────
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

export function trNorm(s: string): string {
  let t = (s || '')
  for (const [re, rep] of UNICODE_SMALL_CAPS) t = t.replace(re, rep)
  return t
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's')
    .replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/û/g, 'u').replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

const CASE_SUFFIXES = [
  'dan','den','tan','ten','da','de','ta','te',
  'ya','ye','yi','yı','yu','yü','nin','nın','nun','nün',
  'na','ne','a','e','i','ı','u','ü'
]

export function stripSuffix(token: string): string {
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

export function stripSuffixOnce(token: string): string {
  if (token.length < 5) return token
  for (const suf of CASE_SUFFIXES) {
    if (token.endsWith(suf) && token.length - suf.length >= 3) {
      return token.slice(0, -suf.length)
    }
  }
  return token
}

// ── Telefon (Deno `extractPhones` ile birebir) ──────────────────────────────
export function extractPhones(text: string): string[] {
  const phones: string[] = []
  const t = text.replace(/\+\s*9\s*0\s*/g, '0').replace(/[()]/g, ' ')
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

// ── İlan tipi (Deno `detectAdType` ile birebir — 7 Ağu 2026, #93 sonrası) ───
// 'yuklenecek' kasıtlı YOK: canlı ölçüm 1350 'arac' etiketli ilanın 25'i elle
// okundu, 25'i de yük simsarı kalıbıydı ("X'ten büyük balya yüklenecek").
// Ayrıntı: `docs/YAPILACAKLAR.md` başı.
export function detectAdType(text: string): 'yuk' | 'arac' {
  const norm = trNorm(text)
  const aracKelimeler = ['bos arac', 'bos tir', 'bos kamyon', 'yuk ariyor', 'boş araç', 'boş tır']
  for (const k of aracKelimeler) {
    if (norm.includes(trNorm(k))) return 'arac'
  }
  return 'yuk'
}

// ── İlişki tespiti (ok/tire Deno ile birebir; DEN_RE kasıtlı farklı — üstteki not) ─
const ARROW_RE = /➡️|->|→|⇒|⟶|—>|➜|➔/
const DASH_RE = /\s+[-–—~]\s+/
// 🎯 KASITLI SAPMA: Deno'daki `\s+(?:'?\s*)?(?:den|dan|ten|tan)\b\s+` — ekten önce
// ZORUNLU boşluk istiyordu ("Tuzla dan" gibi ayrı kelime hâlini yakalar, "Tuzla'dan"
// bitişik-kesmeli hâlini YAKALAMAZ). Web'de yazılan tam cümlelerde bitişik hâl
// baskın; bu yüzden zorunlu boşluk kaldırıldı, kesme işareti opsiyonel bırakıldı.
const DEN_RE = /(.+?)'?(?:den|dan|ten|tan)\b\s+(.+)/i

export function splitByRelation(line: string): { left: string, right: string, rel: string } | null {
  if (ARROW_RE.test(line)) {
    const parts = line.split(ARROW_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join('').replace(ARROW_RE, '').trim()
      if (right) return { left, right, rel: 'arrow' }
    }
  }

  if (DASH_RE.test(line)) {
    const parts = line.split(DASH_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join(' - ').trim()
      if (left && right) return { left, right, rel: 'dash' }
    }
  }

  const noSpaceDash = line.match(/^(.+?)[-–—](.+)$/)
  if (noSpaceDash) {
    const left = noSpaceDash[1].trim()
    const right = noSpaceDash[2].trim()
    if (left.length >= 3 && right.length >= 3 && /[a-zA-ZÀ-ÿÀ-ɏĞğİıŞşÇçÖöÜü]/u.test(left) && /[a-zA-ZÀ-ÿÀ-ɏ]/u.test(right)) {
      return { left, right, rel: 'dash_nospace' }
    }
  }

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

// ── Katlanmış karşılaştırma anahtarları (Deno W5/D4 ile birebir) ───────────
export function yerKey(s: string | null | undefined): string {
  return trNorm(s ?? '')
}

export function ayniSehir(a: string, b: string): boolean {
  return yerKey(a) === yerKey(b)
}

export function ayniIlce(a: string | null | undefined, b: string | null | undefined): boolean {
  return yerKey(a) === yerKey(b)
}

// ── Alias indeksi + findPlaces (Deno #71/#89-A ile birebir) ─────────────────
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
    if (a.type === 'city') { if (!sehir.has(anahtar)) sehir.set(anahtar, a) }
    else if (a.type === 'vehicle') arac.push([anahtar, a])
    else if (a.type === 'body') ustyapi.push([anahtar, a])
  }

  arac.sort((x, y) => (y[1].priority || 50) - (x[1].priority || 50))
  ustyapi.sort((x, y) => (y[1].priority || 50) - (x[1].priority || 50))

  const indeks: AliasIndeksi = { sehir, arac, ustyapi }
  _aliasIndeksCache.set(aliases as unknown as object, indeks)
  return indeks
}

export function findPlaces(text: string, aliases: Alias[]): PlaceHit[] {
  const norm = trNorm(text)
  const tokens = norm.split(' ').filter(t => t.length >= 3)
  const hits: PlaceHit[] = []
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
    if (!mevcut.district && match.district) mevcut.district = match.district
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + ' ' + tokens[i + 1]
    const bigram2 = stripSuffix(tokens[i]) + ' ' + stripSuffix(tokens[i + 1])
    for (const bg of [bigram, bigram2]) {
      const match = cityAliases.get(bg)
      if (match) ekleVeyaYukselt(match, bg)
    }
  }

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

export function bestPlace(hits: PlaceHit[]): PlaceHit | null {
  return hits.length > 0 ? hits[0] : null
}

export function findVehicle(text: string, aliases: Alias[]): string | null {
  const norm = trNorm(text)
  for (const [anahtar, va] of aliasIndeksi(aliases).arac) {
    if (norm.includes(anahtar)) return va.normalized
  }
  return null
}

export function findBodyType(text: string, aliases: Alias[]): string | null {
  const norm = trNorm(text)
  for (const [anahtar, ba] of aliasIndeksi(aliases).ustyapi) {
    if (norm.includes(anahtar)) return ba.normalized
  }
  return null
}

export function extractWeight(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*ton/i)
  if (m) return parseFloat(m[1].replace(',', '.'))
  return null
}

export function extractPallet(text: string): number | null {
  const m = text.match(/(\d+)\s*palet/i)
  if (m) return parseInt(m[1])
  return null
}

// ── AŞAĞISI DENO'DA YOK — bu modüle özgü, `/api/parse-text` şemasının
//    (price, available_date, date_flexible) ihtiyacı için EKLENDİ. Deno
//    parser'ının hiçbir tüketicisi bu alanları istemiyor, o yüzden orada
//    karşılığı yok ve senkron tutma yükümlülüğü taşımıyor.

export function extractPrice(text: string): number | null {
  const binM = text.match(/(\d+(?:[.,]\d+)?)\s*bin\s*(?:tl|₺|lira)\b/i)
  if (binM) return Math.round(parseFloat(binM[1].replace(',', '.')) * 1000)
  // İki ayrı biçim: binlik ayraçlı ("15.000", "15,000" — ayraç EN AZ bir kez)
  // ya da düz ayraçsız ("15000"). Tek regex `\d{1,3}(?:[.,]\d{3})*` yazılırsa
  // "15000" gibi ayraçsız 4+ haneli sayılarda `*` sıfır tekrara düşüp yalnız
  // SON 3 haneyi ("000") yakalar — 0 TL gibi saçma bir sonuç üretir. Alternatif
  // dallarla ayrıştırılınca ayraçsız dal `\d+` tüm haneyi alır.
  const m = text.match(/(?:₺\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:tl|₺|lira)\b/i)
  if (m) {
    const rakamli = m[1].replace(/[.,]/g, '')
    const val = parseInt(rakamli, 10)
    if (!isNaN(val) && val > 0) return val
  }
  return null
}

export function extractDate(text: string, bugunISO: string): string | null {
  const norm = trNorm(text)
  if (/\byarin\b/.test(norm)) {
    const d = new Date(bugunISO + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  }
  if (/\bbugun\b/.test(norm)) return bugunISO
  const m = text.match(/\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})\b/)
  if (m) {
    const gun = m[1].padStart(2, '0')
    const ay = m[2].padStart(2, '0')
    const yil = m[3]
    if (+ay >= 1 && +ay <= 12 && +gun >= 1 && +gun <= 31) return `${yil}-${ay}-${gun}`
  }
  return null
}

export function detectDateFlexible(text: string): boolean {
  const norm = trNorm(text)
  return ['esnek', 'her zaman', 'haftaya', 'uygun oldugunda'].some(k => norm.includes(trNorm(k)))
}

// ── Tek-ilan orkestratörü ────────────────────────────────────────────────
// `parseMessage` (Deno) DEĞİL — burası çok-şeritli broadcast state machine'i
// taşımıyor, TEK bir serbest metin ilanı için tedbirli bir sarmalayıcı.
// Güven eşiği: en az bir ilişki (ok/tire/den-ye) bulunmalı VE ilişkinin SOL
// tarafı alias tablosundan bir yere çözülebilmeli VE en az bir SAĞ taraf yere
// çözülebilmeli. İkisi birden sağlanmazsa `null` — çağıran taraf LLM'e düşer.
export interface HizliSonuc {
  listing_type: 'yuk' | 'arac'
  origin_city: string
  origin_district: string | null
  contact_phone: string | null
  vehicle_type: string | null
  body_type: string[]
  price: number | null
  available_date: string | null
  date_flexible: boolean
  stops: Array<{
    city: string
    district: string | null
    weight_ton: number | null
    pallet_count: number | null
    cargo_type: string | null
  }>
  notes: null
}

export function hizliAyristir(hamMetin: string, aliases: Alias[], bugunISO: string): HizliSonuc | null {
  const telefonlar = extractPhones(hamMetin)
  const temiz = cleanMessage(hamMetin)
  const satirlar = temiz.split('\n').map(s => s.trim()).filter(Boolean)

  let originHit: PlaceHit | null = null
  const stopAnahtarlari = new Set<string>()
  const stopSirasi: PlaceHit[] = []

  const ekleStop = (hit: PlaceHit) => {
    const anahtar = yerKey(hit.normalized) + '|' + yerKey(hit.district)
    if (stopAnahtarlari.has(anahtar)) return
    stopAnahtarlari.add(anahtar)
    stopSirasi.push(hit)
  }

  for (const satir of satirlar) {
    const iliski = splitByRelation(satir)
    if (!iliski) continue

    const solHits = findPlaces(iliski.left, aliases)
    const sagHits = findPlaces(iliski.right, aliases)
    const sol = bestPlace(solHits)
    const sag = bestPlace(sagHits)

    if (!originHit && sol) originHit = sol
    if (sag) ekleStop(sag)

    // Aynı ilişkide birden fazla varış olabilir ("Adana -> Mersin, Konya").
    for (const h of sagHits) {
      if (h === sag) continue
      if (originHit && ayniSehir(h.normalized, originHit.normalized) && ayniIlce(h.district, originHit.district)) continue
      ekleStop(h)
    }
  }

  // Güven eşiği tutmadı — kararı LLM'e bırak.
  if (!originHit || stopSirasi.length === 0) return null

  const ustyapiTek = findBodyType(temiz, aliases)
  const ton = extractWeight(temiz)
  const palet = extractPallet(temiz)

  return {
    listing_type: detectAdType(temiz),
    origin_city: originHit.normalized,
    origin_district: originHit.district,
    contact_phone: telefonlar[0] ?? null,
    vehicle_type: findVehicle(temiz, aliases),
    body_type: ustyapiTek ? [ustyapiTek] : [],
    price: extractPrice(hamMetin),
    available_date: extractDate(hamMetin, bugunISO),
    date_flexible: detectDateFlexible(hamMetin),
    // ⚠️ Basitleştirme: ton/palet METNİN TAMAMINDAN tek değer olarak çıkarılıyor,
    // yalnız İLK durağa uygulanıyor (çoğu tekil-ilan metni tek şerit tanımlar).
    // Çok duraklı bir metinde her durağa aynı değeri tekrarlamak, kullanıcının
    // gözden geçirmeden fark edemeyeceği yanlış veri üretebilirdi.
    stops: stopSirasi.map((h, i) => ({
      city: h.normalized,
      district: h.district,
      weight_ton: i === 0 ? ton : null,
      pallet_count: i === 0 ? palet : null,
      cargo_type: null,
    })),
    notes: null,
  }
}
