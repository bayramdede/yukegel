import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────
// Kategori → Google arama terimleri eşlemesi
// ─────────────────────────────────────────────────────────────
const KATEGORI_ARAMA: Record<string, string[]> = {
  motorcu:      ['tır motorcu', 'kamyon motor tamiri'],
  elektrikci:   ['tır elektrikçi', 'kamyon elektrik tamiri'],
  kaportaci:    ['tır kaportacı', 'kamyon kaporta'],
  lastikci:     ['tır lastiği', 'kamyon lastikçi', 'lastik tamiri'],
  dorse_branda: ['dorse tamiri', 'branda ustası', 'tenteci'],
  frigo_ustasi: ['frigo tamir', 'soğutucu araç tamiri', 'thermo king'],
  tir_parki:    ['tır parkı', 'kamyon parkı', 'ağır vasıta park'],
  lokanta:      ['kamyoncu lokantası', 'şoför lokantası'],
  konaklama:    ['tır moteli', 'kamyoncu moteli', 'şoför moteli'],
  kantar:       ['kamyon kantarı', 'ağır vasıta kantar', 'tartı noktası'],
  yikama:       ['tır yıkama', 'kamyon yıkama', 'araç yağlama'],
  // Eski kategoriler (geriye uyumluluk)
  park_dinlenme:   ['tır parkı', 'kamyon park alanı'],
  yemek:           ['kamyoncu lokantası'],
  tamirci:         ['tır tamircisi', 'kamyon tamiri'],
  tesis_akaryakit: ['tır yıkama', 'akaryakıt istasyonu kamyon'],
  kantar_resmi:    ['kamyon kantarı', 'resmi kantar'],
};

const GECERLI_KATEGORILER = Object.keys(KATEGORI_ARAMA);

// ─────────────────────────────────────────────────────────────
// Google Places Text Search
// ─────────────────────────────────────────────────────────────
async function textSearch(query: string, apiKey: string): Promise<GooglePlace[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'tr');
  url.searchParams.set('region', 'tr');
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
// Google adres bileşeninden il/ilçe çıkar
// ─────────────────────────────────────────────────────────────
function parseAdresComponents(components: AddressComponent[]): { il: string | null; ilce: string | null } {
  let il: string | null = null;
  let ilce: string | null = null;

  for (const c of components) {
    if (c.types.includes('administrative_area_level_1')) {
      // Türkiye'de "İstanbul Province" gibi gelir — "Province" suffix'ini temizle
      il = c.long_name.replace(/\s*(Province|İl|İli)$/i, '').trim();
    }
    if (c.types.includes('administrative_area_level_2')) {
      ilce = c.long_name.replace(/\s*(District|İlçesi)$/i, '').trim();
    }
  }

  return { il, ilce };
}

// Rate limiting yardımcısı
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/poi-import
// Body: { province: string, categories: string[], limit_per_query?: number }
// province: Türkiye il adı (ör: "İstanbul")
// categories: import edilecek kategoriler
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Admin kontrolü
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase.from('users').select('role, email').eq('id', user.id).maybeSingle();
    if (!profil || profil.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sadece admin kullanabilir.' }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GOOGLE_PLACES_API_KEY tanımlı değil.' }, { status: 500 });
    }

    const body = await request.json();
    const { province, categories, limit_per_query = 5 } = body as {
      province: string;
      categories: string[];
      limit_per_query?: number;
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
    let atlanan = 0; // zaten var
    let hatali = 0;
    const detaylar: string[] = [];

    for (const kategori of categories) {
      const aramaTerimleri = KATEGORI_ARAMA[kategori] || [];

      for (const terim of aramaTerimleri) {
        const sorgu = `${terim} ${il}`;

        try {
          const sonuclar = await textSearch(sorgu, apiKey);
          const hedefler = sonuclar.slice(0, limit_per_query);

          for (const yer of hedefler) {
            try {
              // Rate limit: max 10 req/sn
              await sleep(120);

              // Place Details çek
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
                .upsert(kayit, {
                  onConflict: 'google_place_id',
                  ignoreDuplicates: true,
                });

              if (error) {
                // 23505 = unique violation (zaten var)
                if (error.code === '23505') {
                  atlanan++;
                } else {
                  console.error('[poi-import] Upsert error:', error);
                  hatali++;
                }
              } else {
                eklenen++;
              }
            } catch (yerHata) {
              console.error('[poi-import] Place detail error:', yerHata);
              hatali++;
            }
          }
        } catch (aramaHata) {
          const mesaj = aramaHata instanceof Error ? aramaHata.message : String(aramaHata);
          detaylar.push(`"${sorgu}": ${mesaj}`);
          hatali++;
        }

        // Sorgular arası bekleme
        await sleep(200);
      }
    }

    return NextResponse.json({
      success: true,
      data: { eklenen, atlanan, hatali },
      message: `${eklenen} yeni kayıt eklendi, ${atlanan} zaten vardı, ${hatali} hata.`,
      ...(detaylar.length > 0 && { hatalar: detaylar }),
    });

  } catch (err) {
    console.error('[poi-import/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/poi-import
// Desteklenen il ve kategori listesi döner (UI için)
// ─────────────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    success: true,
    kategoriler: GECERLI_KATEGORILER,
    kategoriArama: KATEGORI_ARAMA,
  });
}

// ─── Tipler ──────────────────────────────────────────────────

interface GooglePlace {
  place_id: string;
  name: string;
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
  reviews?: GoogleReview[];
}

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
}
