// ─────────────────────────────────────────────────────────────
// POI Kalite Puanlama — moderatör ön-eleme için
// Çekilen POI'lere 0-100 arası kalite puanı + gerekçe üretir.
// DB'ye yazılmaz; /api/admin/poi GET response'una runtime'da eklenir.
// ─────────────────────────────────────────────────────────────

export interface PoiScoreInput {
  name: string;
  category: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  district?: string | null;
  tags?: string[] | null;
  google_place_id?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
}

export interface PoiScoreResult {
  score: number;                  // 0-100 (clamp)
  level: 'green' | 'yellow' | 'red';
  reasons: { label: string; delta: number }[];
}

// İsimde geçince GÜVEN artıran TIR/kamyon odaklı anahtarlar
const POSITIVE_KEYWORDS = [
  'tır', 'tir', 'kamyon', 'ağır vasıta', 'agir vasita', 'ağır vasita',
  '7/24', 'yol yardım', 'yol yardim', 'tır parkı', 'tir parki',
  'dorse', 'treyler', 'çekici', 'cekici', 'nakliye', 'lojistik',
];

// İsimde geçince ELEYEN (kategoriyle çelişen) anahtarlar
const BLACKLIST_KEYWORDS = [
  'katlı otopark', 'katli otopark', 'düğün salonu', 'dugun salonu',
  'vale', 'avm otopark', 'kapalı otopark', 'kapali otopark',
];

// Kategoriye özel çelişki anahtarları (kantar kategorisinde "terazi satışı" gibi)
const CATEGORY_CONFLICT: Record<string, string[]> = {
  kantar_resmi: ['terazi', 'baskül', 'baskul', 'tartı sistemleri', 'tarti sistemleri'],
  kantar_ozel:  ['terazi', 'baskül', 'baskul', 'tartı sistemleri', 'tarti sistemleri'],
  kantar:       ['terazi', 'baskül', 'baskul', 'tartı sistemleri', 'tarti sistemleri'], // eski compat
  tir_parki: ['katlı otopark', 'katli otopark', 'düğün', 'dugun', 'vale'],
  park_dinlenme: ['katlı otopark', 'katli otopark', 'düğün', 'dugun'],
};

// Türkçe normalize: İ/I tuzağını önce çöz, sonra küçült
function trLower(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase();
}

export function scorePoi(p: PoiScoreInput): PoiScoreResult {
  const reasons: { label: string; delta: number }[] = [];
  let score = 0;

  const nameLc = trLower(p.name || '');

  // ── Negatif: blacklist isim eşleşmesi (en güçlü sinyal) ──
  const blMatch = BLACKLIST_KEYWORDS.find(k => nameLc.includes(trLower(k)));
  if (blMatch) {
    score -= 50;
    reasons.push({ label: `Şüpheli isim: "${blMatch}"`, delta: -50 });
  }

  // ── Negatif: kategori-isim çelişkisi ──
  const conflicts = CATEGORY_CONFLICT[p.category] || [];
  const conflictMatch = conflicts.find(k => nameLc.includes(trLower(k)));
  if (conflictMatch) {
    score -= 50;
    reasons.push({ label: `Kategori çelişkisi: "${conflictMatch}"`, delta: -50 });
  }

  // ── Pozitif: iletişim bilgileri ──
  if (p.phone && p.phone.trim()) {
    score += 20;
    reasons.push({ label: 'Telefon var', delta: 20 });
  }
  if (p.website && p.website.trim()) {
    score += 10;
    reasons.push({ label: 'Website var', delta: 10 });
  }

  // ── Pozitif: tam adres (mahalle/sokak/no içeriyorsa) ──
  const addr = trLower(p.address || '');
  const tamAdres = !!p.address && (
    /\bno[:.]?\s*\d/.test(addr) || /sok|cad|cd\.|mah|mahalle/.test(addr)
  );
  if (tamAdres) {
    score += 15;
    reasons.push({ label: 'Tam adres', delta: 15 });
  }

  // ── Pozitif: isimde TIR/kamyon anahtarı ──
  const posMatch = POSITIVE_KEYWORDS.find(k => nameLc.includes(trLower(k)));
  if (posMatch) {
    score += 20;
    reasons.push({ label: `İsimde anahtar: "${posMatch}"`, delta: 20 });
  }

  // ── Google puan/yorum sinyali ──
  const hasGoogle = !!p.google_place_id;
  const gr = p.google_rating ?? null;
  const grc = p.google_review_count ?? 0;

  if (hasGoogle && gr != null) {
    if (gr < 2.5 && grc >= 20) {
      score -= 40;
      reasons.push({ label: `Düşük Google puanı ${gr.toFixed(1)} (${grc})`, delta: -40 });
    } else if (gr >= 4.0 && grc >= 10) {
      score += 25;
      reasons.push({ label: `Yüksek Google puanı ${gr.toFixed(1)} (${grc})`, delta: 25 });
    } else if (gr >= 3.0) {
      score += 10;
      reasons.push({ label: `Orta Google puanı ${gr.toFixed(1)} (${grc})`, delta: 10 });
    }
  } else if (!hasGoogle) {
    // AI/manuel eklenen kayıt — Google sinyali yok; etiketler varsa küçük artı
    if (Array.isArray(p.tags) && p.tags.length > 0) {
      score += 5;
      reasons.push({ label: 'Etiket bilgisi var', delta: 5 });
    }
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const level: PoiScoreResult['level'] =
    score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';

  return { score, level, reasons };
}
