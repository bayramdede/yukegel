import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────
// Kategori yapılandırması
// terms: arama terimleri (Google'a gönderilir)
// type: Places API type filtresi (sonuç kalitesini artırır)
// exclude: bu kelimeleri içeren yer adları atlanır
// ─────────────────────────────────────────────────────────────
const KATEGORI_CONFIG: Record<string, {
  terms: string[];
  type?: string;
  exclude?: string[];
}> = {
  motorcu: {
    terms: ['tır motor ustası', 'kamyon motor tamiri'],
    type: 'car_repair',
    exclude: ['lastik', 'elektrik', 'kaporta', 'boya'],
  },
  elektrikci: {
    terms: ['tır elektrikçi', 'kamyon elektrik tamiri'],
    type: 'car_repair',
    exclude: ['lastik', 'motor', 'kaporta'],
  },
  kaportaci: {
    terms: ['tır kaportacı', 'kamyon kaporta boya'],
    type: 'car_repair',
  },
  lastikci: {
    terms: ['tır lastikçi', 'kamyon lastik tamiri'],
    type: 'car_repair',
    exclude: ['motor', 'elektrik', 'kaporta'],
  },
  dorse_branda: {
    terms: ['dorse tamiri', 'branda tenteci'],
    type: 'car_repair',
  },
  frigo_ustasi: {
    terms: ['frigo tamir', 'thermo king servis', 'carrier soğutucu tamir'],
    type: 'car_repair',
  },
  tir_parki: {
    terms: ['tır parkı', 'kamyon parkı'],
    type: 'parking',
    // Sadece kelimesiyle "park" olan şehir parklarını ve genel otoparkları hariç tut
    exclude: ['çocuk', 'millet', 'olimpiyat', 'botanik', 'alışveriş', 'avm', 'rezidans', 'site'],
  },
  lokanta: {
    terms: ['kamyoncu lokantası', 'şoför lokantası'],
    type: 'restaurant',
    exclude: ['cafe', 'kafe', 'pastane', 'pizza', 'burger', 'sushi', 'kebap sarayı'],
  },
  konaklama: {
    terms: ['kamyoncu moteli', 'şoför moteli', 'tır moteli'],
    type: 'lodging',
    // 4-5 yıldız lüks otelleri hariç tut
    exclude: ['hilton', 'sheraton', 'marriott', 'hyatt', 'radisson', 'sofitel', 'intercontinental', 'kempinski', 'four seasons', 'ritz', 'palace', 'resort'],
  },
  kantar: {
    terms: ['tır kantarı', 'kamyon tartı istasyonu'],
    // "baskül" kelimesi kantar satıcılarını getirir, doğrudan tartı noktalarını değil
    exclude: ['baskül satış', 'baskül üretici', 'baskül imalat', 'terazi', 'tartı sistemleri', 'tartı cihazı'],
  },
  yikama: {
    terms: ['tır yıkama', 'kamyon yıkama'],
    type: 'car_wash',
    exclude: ['mutfak', 'restoran', 'lokanta', 'yemek', 'oto kuaför'],
  },
  // Eski kategoriler
  park_dinlenme:   { terms: ['tır parkı dinlenme'], type: 'parking' },
  yemek:           { terms: ['kamyoncu lokantası'], type: 'restaurant' },
  tamirci:         { terms: ['tır tamircisi'], type: 'car_repair' },
  tesis_akaryakit: { terms: ['tır yıkama akaryakıt'], type: 'car_wash' },
  kantar_resmi:    { terms: ['kamyon tartı istasyonu'] },
};

const GECERLI_KATEGORILER = Object.keys(KATEGORI_CONFIG);

// ─────────────────────────────────────────────────────────────
// Yer adı kalite filtresi (basit heuristic)
// ─────────────────────────────────────────────────────────────
function kaliteFiltresi(ad: string, kategori: string): boolean {
  const adKucuk = ad.toLowerCase();
  const config = KATEGORI_CONFIG[kategori];

  // Kategori bazlı exclude listesi
  if (config?.exclude) {
    for (const kelime of config.exclude) {
      if (adKucuk.includes(kelime.toLowerCase())) return false;
    }
  }

  // Tır parkı için: sadece "park" kelimesi olan ve spesifik tır/kamyon içermeyen yerleri atla
  if (kategori === 'tir_parki' || kategori === 'park_dinlenme') {
    const tirKelime = ['tır', 'tir', 'kamyon', 'araç', 'truck', 'ağır vasıta', 'agir vasita'];
    const iceriyorMu = tirKelime.some(k => adKucuk.includes(k));
    // Çok kısa ve generik isimler (sadece "park") atla
    if (ad.trim().length <= 5) return false;
    // "Garaj" da geçerliyse kabul et
    if (adKucuk.includes('garaj')) return true;
    if (!iceriyorMu) return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// Claude ile toplu ön-eleme (opsiyonel, büyük batch'lerde)
// Bir seferde max 10 yer için çağrılır
// ─────────────────────────────────────────────────────────────
async function claudeOnEleme(
  yerler: { ad: string; adres: string }[],
  kategori: string,
  anthropicKey: string,
): Promise<boolean[]> {
  const kategoriAciklama: Record<string, string> = {
    tir_parki:     'TIR ve kamyon parkı (ağır vasıta park alanı)',
    yikama:        'TIR/kamyon yıkama veya yağlama tesisi',
    kantar:        'Kamyon/TIR ağırlık tartı noktası (istasyon, damga)',
    konaklama:     'Kamyoncu/şoför moteli veya pansiyonu (lüks otel değil)',
    lokanta:       'Kamyoncu/şoför lokantası veya yemekhanesi',
    motorcu:       'TIR/kamyon motor ustası veya tamirhanesi',
    elektrikci:    'TIR/kamyon elektrik tamircisi',
    kaportaci:     'TIR/kamyon kaportacı veya boyacı',
    lastikci:      'TIR/kamyon lastikçisi',
    dorse_branda:  'Dorse veya branda/tente tamircisi',
    frigo_ustasi:  'Frigo (soğutuculu araç) ustası',
  };

  const aciklama = kategoriAciklama[kategori] || kategori;
  const liste = yerler.map((y, i) => `${i + 1}. "${y.ad}" — ${y.adres}`).join('\n');

  const prompt = `Aşağıdaki Google Maps sonuçları "${aciklama}" kategorisinde arandı. Her biri gerçekten bu kategoriye uygun mu?

${liste}

Sadece uygun olanların numaralarını virgülle yaz. Uygun değilse sayma. Örnek: "1,3,4"
Eğer hiçbiri uygun değilse boş bırak.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return yerler.map(() => true); // hata varsa hepsini geç

    const data = await res.json();
    const yanit = data.content?.[0]?.text?.trim() || '';
    if (!yanit) return yerler.map(() => false);

    const uygunlar = new Set(
      yanit.split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n))
    );

    return yerler.map((_, i) => uygunlar.has(i + 1));
  } catch {
    return yerler.map(() => true); // hata varsa hepsini geç
  }
}

// ─────────────────────────────────────────────────────────────
// Google Places Text Search
// ─────────────────────────────────────────────────────────────
async function textSearch(query: string, type: string | undefined, apiKey: string): Promise<GooglePlace[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'tr');
  url.searchParams.set('region', 'tr');
  if (type) url.searchParams.set('type', type);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}`);
  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`Google Places API hatası: ${data.error_message || data.status}`);
  }

  return (data.results || []) as GooglePlace[];
}

// ─────────────────────────────────────────────────────────────
// Google Place Details
// ─────────────────────────────────────────────────────────────
async function placeDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,geometry,rating,user_ratings_total,url,address_components,reviews');
  url.searchParams.set('language', 'tr');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK') return null;
  return data.result as GooglePlaceDetails;
}

// ─────────────────────────────────────────────────────────────
// Adres bileşeninden il/ilçe çıkar
// ─────────────────────────────────────────────────────────────
function parseAdresComponents(components: AddressComponent[]): { il: string | null; ilce: string | null } {
  let il: string | null = null;
  let ilce: string | null = null;

  for (const c of components) {
    if (c.types.includes('administrative_area_level_1')) {
      il = c.long_name.replace(/\s*(Province|İl|İli)$/i, '').trim();
    }
    if (c.types.includes('administrative_area_level_2')) {
      ilce = c.long_name.replace(/\s*(District|İlçesi)$/i, '').trim();
    }
  }

  return { il, ilce };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/poi-import
// Body: { province, categories, limit_per_query?, claude_filter? }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (!profil || profil.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sadece admin kullanabilir.' }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GOOGLE_PLACES_API_KEY tanımlı değil.' }, { status: 500 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const body = await request.json();
    const {
      province,
      categories,
      limit_per_query = 5,
      claude_filter = true, // varsayılan: Claude filtresi aktif
    } = body as {
      province: string;
      categories: string[];
      limit_per_query?: number;
      claude_filter?: boolean;
    };

    if (!province?.trim()) {
      return NextResponse.json({ success: false, error: 'province zorunludur.' }, { status: 400 });
    }
    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ success: false, error: 'En az bir kategori seçilmeli.' }, { status: 400 });
    }

    const gecersizKat = categories.filter(k => !GECERLI_KATEGORILER.includes(k));
    if (gecersizKat.length > 0) {
      return NextResponse.json({ success: false, error: `Geçersiz kategoriler: ${gecersizKat.join(', ')}` }, { status: 400 });
    }

    const il = province.trim();
    let eklenen = 0;
    let atlanan = 0;
    let filtrelenen = 0;
    let hatali = 0;
    const hatalar: string[] = [];

    for (const kategori of categories) {
      const config = KATEGORI_CONFIG[kategori];
      if (!config) continue;

      // Her arama terimi için Places API'yi çağır — term başına yalnızca 1 en iyi sonuç al
      // (limit_per_query tüm sorgularda toplanarak uygulanır)
      const bulunanYerler: GooglePlace[] = [];

      for (const terim of config.terms) {
        const sorgu = `${terim} ${il}`;

        try {
          const sonuclar = await textSearch(sorgu, config.type, apiKey);

          // Heuristic filtre: yer adına göre eleme
          const filtreliSonuclar = sonuclar.filter(s => kaliteFiltresi(s.name, kategori));

          bulunanYerler.push(...filtreliSonuclar);
          await sleep(200);
        } catch (err) {
          const mesaj = err instanceof Error ? err.message : String(err);
          hatalar.push(`"${sorgu}": ${mesaj}`);
        }
      }

      // google_place_id'ye göre deduplikasyon
      const tekYerler = Array.from(
        new Map(bulunanYerler.map(y => [y.place_id, y])).values()
      ).slice(0, limit_per_query * config.terms.length);

      if (tekYerler.length === 0) continue;

      // Claude ön-eleme (opsiyonel)
      let gececekler = tekYerler;
      if (claude_filter && anthropicKey && tekYerler.length > 0) {
        const elemeGirdisi = tekYerler.map(y => ({
          ad: y.name,
          adres: y.formatted_address || '',
        }));

        try {
          const sonuclar = await claudeOnEleme(elemeGirdisi, kategori, anthropicKey);
          const onceki = tekYerler.length;
          gececekler = tekYerler.filter((_, i) => sonuclar[i]);
          filtrelenen += onceki - gececekler.length;
        } catch {
          // Claude hatası → tümünü geç
        }
      }

      // Geçen yerleri Place Details ile zenginleştirip kaydet
      for (const yer of gececekler.slice(0, limit_per_query)) {
        try {
          await sleep(120);
          const detay = await placeDetails(yer.place_id, apiKey);
          if (!detay) continue;

          const { il: adresIl, ilce } = parseAdresComponents(detay.address_components || []);

          const kayit = {
            google_place_id:     detay.place_id,
            name:                detay.name,
            category:            kategori,
            latitude:            detay.geometry.location.lat,
            longitude:           detay.geometry.location.lng,
            location:            `SRID=4326;POINT(${detay.geometry.location.lng} ${detay.geometry.location.lat})`,
            address:             detay.formatted_address || null,
            city:                adresIl || il,
            district:            ilce || null,
            phone:               detay.formatted_phone_number || null,
            google_maps_url:     detay.url || null,
            google_rating:       detay.rating || null,
            google_review_count: detay.user_ratings_total || 0,
            status:              'pending',
            verified:            false,
            is_active:           true,
            last_synced_at:      new Date().toISOString(),
          };

          const { error } = await supabase
            .from('pois')
            .upsert(kayit, { onConflict: 'google_place_id', ignoreDuplicates: true });

          if (error) {
            if (error.code === '23505') { atlanan++; }
            else { hatali++; console.error('[poi-import] Upsert error:', error); }
          } else {
            eklenen++;
          }
        } catch (err) {
          hatali++;
          console.error('[poi-import] Place detail error:', err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { eklenen, atlanan, filtrelenen, hatali },
      message: `${eklenen} yeni kayıt eklendi, ${filtrelenen} Claude filtresiyle elendi, ${atlanan} zaten vardı.`,
      ...(hatalar.length > 0 && { hatalar }),
    });

  } catch (err) {
    console.error('[poi-import/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// GET — desteklenen kategoriler
export async function GET() {
  return NextResponse.json({
    success: true,
    kategoriler: GECERLI_KATEGORILER,
    config: Object.fromEntries(
      Object.entries(KATEGORI_CONFIG).map(([k, v]) => [k, { terms: v.terms, type: v.type }])
    ),
  });
}

// ─── Tipler ──────────────────────────────────────────────────

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  url?: string;
  address_components: AddressComponent[];
  reviews?: unknown[];
}
