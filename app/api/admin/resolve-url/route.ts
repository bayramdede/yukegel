import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

const IZINLI_DOMAINLER = [
  'goo.gl',
  'maps.app.goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
];

function domainIzinli(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return IZINLI_DOMAINLER.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// URL'den koordinat çıkar — önce !3d!4d (kesin POI), sonra @lat,lng, sonra ?ll=
function koordinatCikar(url: string): { lat: number; lng: number; name: string } | null {
  let lat: number | null = null;
  let lng: number | null = null;

  // 1. !3dLAT!4dLNG — data encoding (en hassas, kesin POI)
  let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }

  // 2. /@lat,lng
  if (lat == null) {
    m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
  }

  // 3. ?q=lat,lng (koordinat olarak yazılmışsa)
  if (lat == null) {
    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
  }

  // 4. ?ll=lat,lng
  if (lat == null) {
    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
  }

  if (lat == null || lng == null) return null;

  // Yer adı: /place/Ad/ veya /search/Ad/
  const placeM = url.match(/\/(?:place|search)\/([^/@?#]+)\//);
  const name = placeM ? decodeURIComponent(placeM[1].replace(/\+/g, ' ')) : '';

  return { lat, lng, name };
}

// ?q= parametresinden metin arama → Nominatim forward geocode
async function nominatimGeocode(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
    nomUrl.searchParams.set('q', q);
    nomUrl.searchParams.set('format', 'json');
    nomUrl.searchParams.set('addressdetails', '1');
    nomUrl.searchParams.set('limit', '1');
    nomUrl.searchParams.set('countrycodes', 'tr');
    nomUrl.searchParams.set('accept-language', 'tr');

    const r = await fetch(nomUrl.toString(), {
      headers: { 'User-Agent': 'Yukegel/1.0 (admin@yukegel.app)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const data: { lat: string; lon: string }[] = await r.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/resolve-url
// Kısa / iOS Google Maps linkini çözer.
// Koordinat URL'de yoksa Nominatim ile geocode eder.
// Body:  { url: string }
// Response: { success: true, url: string, lat?: number, lng?: number, name?: string }
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
      .from('users').select('role').eq('id', user.id).maybeSingle();

    if (!profil || !['admin', 'moderator'].includes(profil.role)) {
      return NextResponse.json({ success: false, error: 'Yetersiz yetki.' }, { status: 403 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL gerekli.' }, { status: 400 });
    }
    if (!domainIzinli(url)) {
      return NextResponse.json({ success: false, error: 'Yalnızca Google Maps linkleri desteklenir.' }, { status: 400 });
    }

    // ── Redirect takibi ───────────────────────────────────────────────────────
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yükegel-Admin/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!domainIzinli(res.url)) {
      return NextResponse.json(
        { success: false, error: 'Redirect hedefi güvenilir bir Google Maps URL değil.' },
        { status: 400 }
      );
    }

    const resolvedUrl = res.url;
    console.info('[resolve-url] input:', url, '→ resolved:', resolvedUrl);

    // ── Koordinat çıkarma — URL'den ───────────────────────────────────────────
    const fromUrl = koordinatCikar(resolvedUrl);
    if (fromUrl) {
      console.info('[resolve-url] coords from URL:', fromUrl);
      return NextResponse.json({ success: true, url: resolvedUrl, ...fromUrl });
    }

    // ── Koordinat yok — ?q= parametresinden Nominatim ile geocode ───────────
    // Örn: ?q=Adana+gümrük+Tır+Parkı,+Yıldırım+Beyazıt,...
    let qText = '';
    try {
      qText = new URL(resolvedUrl).searchParams.get('q') || '';
    } catch { /* URL parse failed */ }

    if (qText) {
      // Yer adı: virgülden önceki ilk parça (adres kısmını atla, sadece ismi gönder)
      const placeName = qText.split(',')[0].trim();
      console.info('[resolve-url] no coords in URL, geocoding q:', qText);

      // Önce tam sorgu ile dene, bulamazsa sadece yer adıyla dene
      let geocoded = await nominatimGeocode(qText);
      if (!geocoded && placeName !== qText) {
        geocoded = await nominatimGeocode(placeName);
      }

      if (geocoded) {
        console.info('[resolve-url] geocoded via Nominatim:', geocoded);
        return NextResponse.json({
          success: true,
          url: resolvedUrl,
          lat: geocoded.lat,
          lng: geocoded.lng,
          name: placeName,
          geocodedFromSearch: true,
        });
      }
    }

    // ── Koordinat bulunamadı — sadece URL döndür (client parse dener) ─────────
    console.warn('[resolve-url] no coords found for:', resolvedUrl);
    return NextResponse.json({ success: true, url: resolvedUrl });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : '';
    const timeoutHata = mesaj.includes('abort') || mesaj.includes('timeout');
    return NextResponse.json(
      { success: false, error: timeoutHata ? 'Link yanıt vermedi (zaman aşımı).' : 'Link çözülemedi.' },
      { status: 502 }
    );
  }
}
