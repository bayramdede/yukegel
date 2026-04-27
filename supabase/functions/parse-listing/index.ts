/// <reference types="https://deno.land/types.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

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
      // Emojileri sil
      line = line.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu, '')
      // WhatsApp format karakterlerini sil
      line = line.replace(/[\u200e\u202a\u202c\u200f\u200b\u{FE0F}]/gu, '')
      // Kalın/italic WhatsApp formatını sil (* ve _)
      line = line.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1')
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
function trNorm(s: string): string {
  return (s || '')
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

// -------------------------
// Telefon çıkarma
// -------------------------
function extractPhones(text: string): string[] {
  const phones: string[] = []
  const matches = text.match(/0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || []
  const matches2 = text.match(/\+?\s*9\s*0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || []
  const matches3 = text.match(/5\d{9}/g) || []

  for (const m of [...matches, ...matches2, ...matches3]) {
    const d = m.replace(/\D/g, '')
    let norm = d
    if (norm.startsWith('90') && norm.length >= 12) norm = norm.slice(2)
    if (norm.startsWith('0') && norm.length === 11) norm = norm.slice(1)
    if (norm.length === 10 && norm.startsWith('5') && !phones.includes('0' + norm)) {
      phones.push('0' + norm)
    }
  }
  return phones
}

// -------------------------
// İlan tipi tespiti
// -------------------------
function detectAdType(text: string): 'yuk' | 'arac' {
  const norm = trNorm(text)
  const aracKelimeler = ['bos arac', 'bos tir', 'bos kamyon', 'yuklenecek', 'yuk ariyor', 'yukum var', 'bosaltir', 'boşaltır', 'boş araç', 'boş tır']
  for (const k of aracKelimeler) {
    if (norm.includes(trNorm(k))) return 'arac'
  }
  return 'yuk'
}

// -------------------------
// Satır ilişki tespiti (ok, tire, den-ye)
// -------------------------
const ARROW_RE = /➡️|->|→|⇒|⟶|—>|➜|➔/
const DASH_RE = /\s+[-–—]\s+/
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

  // Tire
  if (DASH_RE.test(line)) {
    const parts = line.split(DASH_RE)
    if (parts.length >= 2) {
      const left = parts[0].trim()
      const right = parts.slice(1).join(' - ').trim()
      if (left && right) return { left, right, rel: 'dash' }
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

  // Unigram
  for (const token of tokens) {
    const stripped = stripSuffix(token)
    for (const cand of [token, stripped]) {
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

  for (const line of lines) {
    const rel = splitByRelation(line)
    if (!rel) {
      // İlişki yok ama + var mı? Çoklu varış satırı olabilir
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
                  weight_ton: extractWeight(message),
                  pallet: extractPallet(message),
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

    const fromHits = findPlaces(rel.left, aliases)
    const toHits = findPlaces(rel.right, aliases)

    const from = bestPlace(fromHits)
    
    // + veya / ile ayrılmış çoklu varış
    const rightParts = rel.right.split(/[+\/]/).map(p => p.trim()).filter(p => p.length > 2)

    if (!from) continue

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
            weight_ton: extractWeight(message),
            pallet: extractPallet(message),
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
          weight_ton: extractWeight(message),
          pallet: extractPallet(message),
          raw_line: line
        })
      }
    }
  }

  // Fallback: 2 şehir aynı satırda
  if (lanes.length === 0) {
    for (const line of lines) {
      const hits = findPlaces(line, aliases)
      if (hits.length >= 2 && hits[0].priority >= 50 && hits[1].priority >= 50) {
        if (hits[0].normalized !== hits[1].normalized) {
          lanes.push({
            from: hits[0].normalized,
            fromDistrict: hits[0].district || null,
            to: hits[1].normalized,
            toDistrict: hits[1].district || null,
            vehicle: findVehicle(line, aliases),
            body_type: findBodyType(line, aliases),
            weight_ton: extractWeight(message),
            pallet: extractPallet(message),
            raw_line: line
          })
          break
        }
      }
    }
  }

  // Duplicate lane temizle (aynı from+to kombinasyonu)
  const seen = new Set<string>()
  const uniqueLanes = lanes.filter(l => {
    const key = l.from + '|' + l.to
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

    // Alias'ları yükle
    const { data: aliases } = await supabase.from('aliases').select('*').eq('is_active', true)

    // Telefonu ham metinden çıkar (cleanMessage telefon satırlarını siliyor)
    const phonesFromRaw = extractPhones(rawPost.raw_text)

    // Parse için mesajı temizle
    const cleanedText = cleanMessage(rawPost.raw_text)
    const result = parseMessage(cleanedText, aliases || [])

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
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
