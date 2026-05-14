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
// Mesaj temizleme (LLM öncesi token tasarrufu)
// -------------------------
const BLACKLIST_PHRASES = [
  'komisyon yok', 'komisyonsuz', 'kdv dahil', 'kdv haric',
  'whatsapp uzerinden iletildi', 'chatbridge', 'toplu gonderildi',
  'mesaj bekleniyor', 'goruntu dahil edilmedi', 'bu mesaj silindi',
  'forwarded', 'arama yapildi',
]

function cleanMessage(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Ok karakterlerini ASCII'ye çevir (emoji-strip'ten ÖNCE)
      // ➡ U+27A1, ⏩ U+23E9 (YUKİ), ⏪ U+23EA, ▶ U+25B6, ⏩ vb. aynı range'de
      line = line.replace(/[➡➜➔⟶⏩⏪▶◀⇒⇔]/gu, '->')
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
  const aracKelimeler = ['bos arac', 'bos tir', 'bos kamyon', 'yuklenecek', 'yuk ariyor', 'boş araç', 'boş tır']
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
  if (ARROW_RE.test(line)) {
    const parts = line.split(ARROW_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join('').replace(ARROW_RE, '').trim()
      if (left && right) return { left, right, rel: 'arrow' }
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

function findPlaces(text: string, aliases: Alias[]): PlaceHit[] {
  const norm = trNorm(text)
  const tokens = norm.split(' ').filter(t => t.length >= 3)
  const hits: PlaceHit[] = []
  const seen = new Set<string>()

  const cityAliases = aliases.filter(a => a.type === 'city')

  // Bigram
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + ' ' + tokens[i + 1]
    const bigram2 = stripSuffix(tokens[i]) + ' ' + stripSuffix(tokens[i + 1])
    for (const bg of [bigram, bigram2]) {
      const match = cityAliases.find(a => trNorm(a.alias) === bg)
      if (match && !seen.has(match.normalized)) {
        hits.push({ normalized: match.normalized, priority: match.priority || 50, matched: bg, district: match.district || null })
        seen.add(match.normalized)
      }
    }
  }

  // Unigram — 3 form: ham, tek-strip (ara form), tam-strip
  for (const token of tokens) {
    const stripped1 = stripSuffixOnce(token)
    const strippedFull = stripSuffix(token)
    const candidates = [...new Set([token, stripped1, strippedFull])]
    for (const cand of candidates) {
      const match = cityAliases.find(a => trNorm(a.alias) === cand)
      if (match && !seen.has(match.normalized)) {
        hits.push({ normalized: match.normalized, priority: match.priority || 50, matched: cand, district: match.district || null })
        seen.add(match.normalized)
      }
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
  const vehicleAliases = aliases.filter(a => a.type === 'vehicle')
  for (const va of vehicleAliases.sort((a, b) => (b.priority || 50) - (a.priority || 50))) {
    if (norm.includes(trNorm(va.alias))) return va.normalized
  }
  return null
}

// Üstyapı tespiti
function findBodyType(text: string, aliases: Alias[]): string | null {
  const norm = trNorm(text)
  const bodyAliases = aliases.filter(a => a.type === 'body')
  for (const ba of bodyAliases.sort((a, b) => (b.priority || 50) - (a.priority || 50))) {
    if (norm.includes(trNorm(ba.alias))) return ba.normalized
  }
  return null
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
        if (parts.length > 1) {
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
              if (to && to.normalized !== fromCity.normalized) {
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
    const from = rel.left.trim()
      ? bestPlace(findPlaces(rel.left, aliases))
      : contextFrom

    const toHits = findPlaces(rel.right, aliases)

    // + veya / ile ayrılmış çoklu varış
    const rightParts = rel.right.split(/[+\/]/).map(p => p.trim()).filter(p => p.length > 2)

    if (!from) continue
    // Başarılı from → contextFrom güncelle
    contextFrom = from

    if (rightParts.length > 1) {
      for (const part of rightParts) {
        const partHits = findPlaces(part, aliases)
        const to = bestPlace(partHits)
        if (to) {
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
      if (to) {
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
        blockOrigin = bestPlace(findPlaces(line, aliases))
        blockVehicle = findVehicle(line, aliases)
        blockBody = findBodyType(line, aliases)
        continue
      }

      // Ok veya tire içeren satır yeni bir blok/hat başlangıcı — reset
      if (blockOrigin && (ARROW_RE.test(line) || BLOCK_RESET_RE.test(line) || /[-–—]/.test(line))) {
        blockOrigin = null
        continue
      }

      if (blockOrigin) {
        const hits = findPlaces(line, aliases)
        if (hits.length > 0 && hits[0].normalized !== blockOrigin.normalized) {
          const key = `${blockOrigin.normalized}|${blockOrigin.district ?? ''}|${hits[0].normalized}|${hits[0].district ?? ''}`
          if (!blockSeen.has(key)) {
            lanes.push({
              from: blockOrigin.normalized,
              fromDistrict: blockOrigin.district || null,
              to: hits[0].normalized,
              toDistrict: hits[0].district || null,
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

  // Fallback: 2 şehir aynı satırda — TÜM eşleşen satırları tara (break yok)
  if (lanes.length === 0) {
    for (const line of lines) {
      const hits = findPlaces(line, aliases)
      if (hits.length >= 2 && hits[0].priority >= 50 && hits[1].priority >= 50) {
        // Aynı şehir: sadece ilçeler farklıysa kabul et
          const sameCity = hits[0].normalized === hits[1].normalized
          const diffDist = hits[0].district !== hits[1].district
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
  const seen = new Set<string>()
  const uniqueLanes = lanes.filter(l => {
    const key = `${l.from}|${l.fromDistrict ?? ''}|${l.to}|${l.toDistrict ?? ''}`
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
      await supabase.from('raw_posts').update({ processing_status: 'no_lane' }).eq('id', raw_post_id)
      return new Response(JSON.stringify({ success: false, reason: 'empty_raw_text' }), { status: 400 })
    }

    // Alias'ları yükle
    const { data: aliases } = await supabase.from('aliases').select('*').eq('is_active', true)

    // Telefonu ham metinden çıkar (cleanMessage telefon satırlarını siliyor)
    const phonesFromRaw = extractPhones(rawText)

    // Parse için mesajı temizle
    const cleanedText = cleanMessage(rawText)
    const result = parseMessage(cleanedText, aliases || [])

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
      await supabase.from('raw_posts').update({ processing_status: 'no_lane' }).eq('id', raw_post_id)
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

    let created = 0
    for (const [, lanes] of lineGroups) {
      const firstLane = lanes[0]
      const { data: listing } = await supabase.from('listings').insert({
        listing_type: result.ad_type,
        origin_city: firstLane.from,
        origin_district: firstLane.fromDistrict || null,
        contact_phone: result.phones[0] || null,
        source: rawPost.source || 'whatsapp',
        moderation_status: 'pending',
        trust_level: 'social',
        raw_post_id: raw_post_id,
        raw_text: rawPost.raw_text,
        notes: firstLane.raw_line,
        vehicle_type: firstLane.vehicle ? [firstLane.vehicle] : null,
        body_type: firstLane.body_type ? [firstLane.body_type] : null,
      }).select().single()

      if (listing) {
        for (let i = 0; i < lanes.length; i++) {
          await supabase.from('listing_stops').insert({
            listing_id: listing.id,
            stop_order: i + 1,
            city: lanes[i].to,
            district: lanes[i].toDistrict || null,
            cargo_type: null,
            weight_ton: lanes[i].weight_ton,
            pallet_count: lanes[i].pallet,
          })
        }
        created++
      }
    }

    await supabase.from('raw_posts').update({ processing_status: 'processed' }).eq('id', raw_post_id)

    return new Response(JSON.stringify({ success: true, lanes: result.lanes.length, created }))

  } catch (err: any) {
    edgeLog('ERROR', 'Parse hatası', {
      output_status: 'error',
      error_message: err?.message ?? String(err),
    })
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
