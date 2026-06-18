import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

const VALID_CATS = [
  // Yeni 16 kategori
  'akaryakit_istasyonu', 'elektrik_sarj',
  'tir_parki', 'otel_pansiyon',
  'motor_mekanik', 'lastikci', 'elektrik_takograf', 'branda_dorse', 'yikama_yaglama', 'acil_yol_yardim',
  'dinlenme_tesisi', 'esnaf_lokantasi',
  'kantar', 'nakliyeciler_sitesi', 'gumruk_sinir', 'antrepo_depo',
  // Eski (backward compat)
  'park_dinlenme', 'yemek', 'konaklama', 'tamirci', 'tesis_akaryakit', 'kantar_resmi',
  'motorcu', 'elektrikci', 'kaportaci', 'dorse_branda', 'frigo_ustasi', 'lokanta', 'yikama',
];

const VALID_CATS_LABELS: Record<string, string> = {
  akaryakit_istasyonu: 'Akaryakıt İstasyonu',
  elektrik_sarj:       'Elektrik Şarj Noktası',
  tir_parki:           'TIR Parkı',
  otel_pansiyon:       'Otel & Pansiyon',
  motor_mekanik:       'Motor & Mekanik',
  lastikci:            'Lastikçi',
  elektrik_takograf:   'Elektrik & Takograf',
  branda_dorse:        'Branda & Dorse',
  yikama_yaglama:      'Yıkama & Yağlama',
  acil_yol_yardim:     'Acil Yol Yardım',
  dinlenme_tesisi:     'Dinlenme Tesisi',
  esnaf_lokantasi:     'Esnaf Lokantası',
  kantar:              'Kantar',
  nakliyeciler_sitesi: 'Nakliyeciler Sitesi',
  gumruk_sinir:        'Gümrük & Sınır',
  antrepo_depo:        'Antrepo & Depo',
};

interface EnrichResult {
  name: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  address_note: string | null;
  category: string | null;
  description: string | null;
  // Google Places alanları
  phone: string | null;
  website: string | null;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
}

// ─────────────────────────────────────────────────────────────
// Google Places ile yer detaylarını çek
// ─────────────────────────────────────────────────────────────
async function googlePlacesEnrich(
  lat: number, lng: number, slug: string | undefined, apiKey: string,
): Promise<Pick<EnrichResult, 'phone' | 'website' | 'google_place_id' | 'google_rating' | 'google_review_count' | 'name' | 'address'>> {
  const bos = { phone: null, website: null, google_place_id: null, google_rating: null, google_review_count: null, name: null, address: null };
  try {
    // 1. Text Search: slug + koordinat bias ile en yakın eşleşmeyi bul
    const tsUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    tsUrl.searchParams.set('query', slug || `${lat},${lng}`);
    tsUrl.searchParams.set('location', `${lat},${lng}`);
    tsUrl.searchParams.set('radius', '100');  // 100m — çok kesin konum
    tsUrl.searchParams.set('language', 'tr');
    tsUrl.searchParams.set('key', apiKey);

    const tsRes = await fetch(tsUrl.toString(), { signal: AbortSignal.timeout(6000) });
    if (!tsRes.ok) return bos;
    const tsData = await tsRes.json();
    const place = tsData.results?.[0];
    if (!place?.place_id) return bos;

    // 2. Place Details: telefon, website, rating
    const detUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detUrl.searchParams.set('place_id', place.place_id);
    detUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,website,rating,user_ratings_total');
    detUrl.searchParams.set('language', 'tr');
    detUrl.searchParams.set('key', apiKey);

    const detRes = await fetch(detUrl.toString(), { signal: AbortSignal.timeout(6000) });
    if (!detRes.ok) return bos;
    const detData = await detRes.json();
    if (detData.status !== 'OK') return bos;

    const r = detData.result;
    return {
      phone:               r.formatted_phone_number ?? null,
      website:             r.website ?? null,
      google_place_id:     r.place_id ?? null,
      google_rating:       r.rating ?? null,
      google_review_count: r.user_ratings_total ?? null,
      name:                r.name ?? null,
      address:             r.formatted_address ?? null,
    };
  } catch {
    return bos;
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/enrich-poi
// Koordinatlardan Nominatim + Claude ile POI alanlarını tahmin eder.
// Body: { lat: number, lng: number, slug?: string }
// Response: EnrichResult
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profil || !['admin', 'moderator'].includes(profil.role)) {
      return NextResponse.json({ success: false, error: 'Yetersiz yetki.' }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI servisi yapılandırılmamış.' }, { status: 503 });
    }

    const body = await request.json();
    const { lat, lng, slug, poi_id } = body;

    // ── poi_id branch: mevcut Google Maps POI için LLM zenginleştirme ───────
    if (poi_id) {
      const googleKey = process.env.GOOGLE_PLACES_API_KEY;

      // 1. POI'yi DB'den çek
      const { data: poi, error: poiErr } = await supabase
        .from('pois')
        .select('id, name, category, categories, address, city, district, google_place_id, google_rating, google_review_count')
        .eq('id', poi_id)
        .maybeSingle();

      if (poiErr || !poi) {
        return NextResponse.json({ success: false, error: 'POI bulunamadı.' }, { status: 404 });
      }

      // 2. Google Places editorial summary (varsa)
      let editorialSummary = '';
      if (googleKey && poi.google_place_id) {
        try {
          const detUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
          detUrl.searchParams.set('place_id', poi.google_place_id);
          detUrl.searchParams.set('fields', 'editorial_summary,types');
          detUrl.searchParams.set('language', 'tr');
          detUrl.searchParams.set('key', googleKey);
          const res = await fetch(detUrl.toString(), { signal: AbortSignal.timeout(6000) });
          if (res.ok) {
            const data = await res.json();
            editorialSummary = data.result?.editorial_summary?.overview || '';
          }
        } catch { /* skip */ }
      }

      // 3. Kategori listesi metni
      const newCatLabels = Object.entries(VALID_CATS_LABELS)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');

      // 4. LLM prompt
      const prompt = `Sen Türkiye'de kamyon şoförlerine yönelik bir POI veri tabanı doldurma asistanısın.

MEVCUT POI BİLGİLERİ:
Ad: ${poi.name}
Adres: ${poi.address || '(yok)'}
Şehir: ${poi.city || '(yok)'}, İlçe: ${poi.district || '(yok)'}
Mevcut kategori: ${poi.category || '(yok)'}
Google puanı: ${poi.google_rating ? `${poi.google_rating}/5 (${poi.google_review_count} yorum)` : '(yok)'}
${editorialSummary ? `Google açıklaması: ${editorialSummary}` : ''}

GEÇERLİ KATEGORİLER (birden fazla seçilebilir):
${newCatLabels}

GÖREV — aşağıdaki JSON alanlarını doldur. Bilmiyorsan null bırak, UYDURMA:
{
  "description": "Kamyon şoförlerine yönelik 1-2 cümle açıklama (Türkçe)",
  "address_note": "Nasıl bulunur, ne dikkat edilmeli — 1-2 cümle kısa yol tarifi (Türkçe)",
  "categories": ["kategori_kodu_1", "kategori_kodu_2"]
}

Notlar:
- description: yerin ne sunduğunu, avantajlarını anlat
- address_note: şoföre pratik yol tarifi (varsa mevcut adres bilgisini kullan)
- categories: bu yer birden fazla hizmet veriyorsa (örn. lastikçi + yol yardım), tüm uygun kategorileri ekle

ÇIKTI: Yalnızca JSON nesnesi, başka metin yok.`;

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!aiRes.ok) {
        return NextResponse.json({ success: false, error: 'AI servisi hatası.' }, { status: 502 });
      }

      const aiData = await aiRes.json();
      const rawText = aiData.content?.[0]?.text || '';
      const clean = rawText.replace(/```json|```/g, '').trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(clean);
      } catch {
        const m = clean.match(/\{[\s\S]*\}/);
        if (!m) return NextResponse.json({ success: false, error: 'AI yanıtı ayrıştırılamadı.' }, { status: 502 });
        parsed = JSON.parse(m[0]);
      }

      const description  = typeof parsed.description  === 'string' ? parsed.description.trim()  || null : null;
      const address_note = typeof parsed.address_note === 'string' ? parsed.address_note.trim() || null : null;
      const categories   = Array.isArray(parsed.categories)
        ? (parsed.categories as unknown[]).filter((c): c is string => typeof c === 'string' && VALID_CATS.includes(c))
        : [];

      return NextResponse.json({ success: true, data: { description, address_note, categories } });
    }
    // ── /poi_id branch ────────────────────────────────────────────────────────

    const latN = Number(lat);
    const lngN = Number(lng);
    if (isNaN(latN) || isNaN(lngN) || latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
      return NextResponse.json({ success: false, error: 'Geçersiz koordinat.' }, { status: 400 });
    }

    // ── 1. Nominatim reverse geocode ─────────────────────────────────────────
    let nominatimVeri = '';
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latN}&lon=${lngN}&format=json&accept-language=tr&addressdetails=1`,
        {
          headers: { 'User-Agent': 'Yukegel/1.0 (admin@yukegel.app)' },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (nomRes.ok) {
        const nom = await nomRes.json();
        const a = nom.address || {};
        nominatimVeri = [
          nom.display_name && `Tam adres: ${nom.display_name}`,
          a.road        && `Cadde/Sokak: ${a.road}`,
          a.suburb      && `Mahalle: ${a.suburb}`,
          a.neighbourhood && `Semt: ${a.neighbourhood}`,
          a.city_district && `İlçe/Semt: ${a.city_district}`,
          a.district    && `İlçe: ${a.district}`,
          a.county      && `İlçe (county): ${a.county}`,
          a.city        && `Şehir: ${a.city}`,
          a.town        && `İlçe merkezi: ${a.town}`,
          a.state       && `İl: ${a.state}`,
          a.postcode    && `Posta kodu: ${a.postcode}`,
        ].filter(Boolean).join('\n');
      }
    } catch {
      // Nominatim başarısız olursa LLM yine de çalışır, daha az bağlamla
    }

    // ── 2. Claude Haiku ile alan tahmini ─────────────────────────────────────
    const slugBilgi = slug?.trim()
      ? `URL'den çıkarılan ham yer adı/slug (Türkçe olabilir, hatalı veya eksik olabilir): "${slug}"`
      : 'URL slug bilgisi mevcut değil.';

    const prompt = `Sen Türkiye'de kamyon şoförleri için bir POI (ilgi noktası) veri tabanı doldurma asistanısın.

Aşağıdaki verilere dayanarak JSON formatında alan önerileri üret:

KOORDİNATLAR: ${latN}, ${lngN}

NOMİNATIM REVERSE GEOCODE SONUCU:
${nominatimVeri || '(Nominatim verisi alınamadı)'}

${slugBilgi}

GEÇERLİ KATEGORİLER (yalnızca bunlardan birini kullan):
- park_dinlenme  → Tır parkı, dinlenme tesisi, mola yeri
- yemek          → Restoran, lokanta, şoför sofrası
- konaklama      → Motel, otel, kamp alanı
- tamirci        → Oto tamirci, lastikçi, usta
- tesis_akaryakit → Akaryakıt istasyonu, taşıt bakım tesisi
- kantar_resmi   → Kantar noktası, gümrük, resmi kurum

GÖREV:
Aşağıdaki JSON alanlarını doldur. Bilmiyorsan null bırak, UYDURMA.
Adres bilgisi için Nominatim verisini kullan.
name için slug'ı düzelt/normalize et (varsa), Nominatim bağlamına göre gerçekçi bir isim öner.

{
  "name": "Tesisin gerçek adı (örn. 'Adana Gümrük Tır Parkı')",
  "city": "Şehir/il adı",
  "district": "İlçe adı",
  "address": "Mahalle/sokak/cadde",
  "address_note": "Kısa yol tarifi (1-2 cümle, şoföre yönelik)",
  "category": "Geçerli kategorilerden biri",
  "description": "1-2 cümle açıklama"
}

ÇIKTI: Yalnızca JSON nesnesi, başka metin yok.`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error('[enrich-poi] AI error:', err.slice(0, 200));
      return NextResponse.json({ success: false, error: 'AI servisi hatası.' }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ success: false, error: 'AI yanıtı ayrıştırılamadı.' }, { status: 502 });
      }
      parsed = JSON.parse(m[0]);
    }

    const claudeResult = {
      name:         typeof parsed.name        === 'string' ? parsed.name.trim()         || null : null,
      city:         typeof parsed.city        === 'string' ? parsed.city.trim()         || null : null,
      district:     typeof parsed.district    === 'string' ? parsed.district.trim()     || null : null,
      address:      typeof parsed.address     === 'string' ? parsed.address.trim()      || null : null,
      address_note: typeof parsed.address_note === 'string' ? parsed.address_note.trim() || null : null,
      category:     typeof parsed.category    === 'string' && VALID_CATS.includes(parsed.category) ? parsed.category : null,
      description:  typeof parsed.description === 'string' ? parsed.description.trim()  || null : null,
    };

    // ── 3. Google Places API — telefon, website, kesin ad ve adres ────────────
    const googleKey = process.env.GOOGLE_PLACES_API_KEY;
    const googleResult = googleKey
      ? await googlePlacesEnrich(latN, lngN, slug, googleKey)
      : { phone: null, website: null, google_place_id: null, google_rating: null, google_review_count: null, name: null, address: null };

    const result: EnrichResult = {
      // Google Places daha güvenilir — varsa üstün tut, yoksa Claude/Nominatim'e düş
      name:                googleResult.name    || claudeResult.name,
      address:             googleResult.address || claudeResult.address,
      city:                claudeResult.city,
      district:            claudeResult.district,
      address_note:        claudeResult.address_note,
      category:            claudeResult.category,
      description:         claudeResult.description,
      phone:               googleResult.phone,
      website:             googleResult.website,
      google_place_id:     googleResult.google_place_id,
      google_rating:       googleResult.google_rating,
      google_review_count: googleResult.google_review_count,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : '';
    const timeoutHata = mesaj.includes('abort') || mesaj.includes('timeout');
    console.error('[enrich-poi] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: timeoutHata ? 'İstek zaman aşımına uğradı.' : 'Beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
