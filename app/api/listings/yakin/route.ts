import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enYakinIl } from '../../../../lib/il-koordinatlari';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/listings/yakin?lat=..&lng=..
 * GPS konumuna en yakın ili (offline haversine, il merkezine göre)
 * hesaplar, o ildeki aktif+onaylı yük ilanlarını döner.
 *
 * Faz 1 (il bazlı) — gerçek yarıçap mesafesi değil, "hangi ile
 * en yakınsın" mantığı. Faz 2'de listings'e gerçek koordinat
 * eklenince PostGIS bbox sorgusuna geçilecek (bkz. PROJE_HARITASI.md §14).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng gerekli' }, { status: 400 });
  }

  const { il, mesafe_km } = enYakinIl(lat, lng);

  const { data, error } = await supabase.rpc('get_nearby_listings_by_city', {
    p_city: il,
    p_district: null,
    p_limit: 20,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    il,
    il_merkezine_mesafe_km: mesafe_km,
    data: data ?? [],
    total: data?.length ?? 0,
  });
}
