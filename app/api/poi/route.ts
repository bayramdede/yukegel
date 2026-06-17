import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../lib/auth';
import { POI_GECERLI_KATEGORILER } from '../../../lib/poi-constants';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// GET /api/poi
// Bounding Box veya lat/lng yarıçap sorgusu
// Query params:
//   min_lng, min_lat, max_lng, max_lat  — bounding box (harita kaydırma)
//   lat, lng, radius_km                — yarıçap araması (opsiyonel)
//   category                           — filtre
//   tags                               — virgülle ayrılmış tag listesi
//   emergency                          — "true" = sadece SOS noktaları
//   limit                              — max sonuç (default 50)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const minLng  = parseFloat(searchParams.get('min_lng') || '');
    const minLat  = parseFloat(searchParams.get('min_lat') || '');
    const maxLng  = parseFloat(searchParams.get('max_lng') || '');
    const maxLat  = parseFloat(searchParams.get('max_lat') || '');
    const userLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const userLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    const category = searchParams.get('category') || null;
    const tagsRaw  = searchParams.get('tags');
    const tags     = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : null;
    const emergency = searchParams.get('emergency') === 'true';
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Bounding box zorunlu
    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
      return NextResponse.json(
        { success: false, error: 'min_lng, min_lat, max_lng, max_lat parametreleri zorunludur.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Toplam sayı (limit'ten bağımsız) + veri sorgusunu paralel çalıştır
    let countQuery = supabase
      .from('pois')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_active', true)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng);
    if (category) countQuery = countQuery.eq('category', category);
    if (emergency) countQuery = countQuery.eq('is_emergency', true);

    const [{ data, error }, { count }] = await Promise.all([
      supabase.rpc('get_pois_in_bbox', {
        p_min_lng:       minLng,
        p_min_lat:       minLat,
        p_max_lng:       maxLng,
        p_max_lat:       maxLat,
        p_category:      category,
        p_tags:          tags,
        p_emergency_only: emergency,
        p_user_lat:      userLat,
        p_user_lng:      userLng,
        p_limit:         limit,
      }),
      countQuery,
    ]);

    if (error) {
      console.error('[poi/GET] RPC error:', error);
      return NextResponse.json({ success: false, error: 'Konum verileri alınamadı.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [], total: count ?? (data?.length ?? 0) });
  } catch (err) {
    console.error('[poi/GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/poi
// Yeni POI ekle (giriş zorunlu, pending olarak eklenir)
// Body: { name, description, category, latitude, longitude, address, city, phone, website,
//         tags, badges, is_emergency, google_place_id? }
//
// Duplicate engeli:
//   1. google_place_id varsa UNIQUE constraint (DB seviyesi)
//   2. Yoksa: ~100m yarıçapında aynı isim (case-insensitive) → 409
//   3. ~50m yarıçapında herhangi bir POI (pending dahil) → 409
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name, description, category,
      latitude, longitude,
      address, city, district, address_note, phone, website,
      tags = [], badges = {},
      is_emergency = false,
      google_place_id,
    } = body;

    // Temel validasyon
    if (!name || !category || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: 'name, category, latitude ve longitude zorunludur.' },
        { status: 400 }
      );
    }

    if (!POI_GECERLI_KATEGORILER.includes(category)) {
      return NextResponse.json({ success: false, error: 'Geçersiz kategori.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // ── Duplicate check ────────────────────────────────────────────────
    // ~0.001° ≈ 100m bounding box — proximity sorgusu
    const DELTA_100M = 0.001; // ~100m

    const { data: yakın } = await supabase
      .from('pois')
      .select('id, name, category, status, latitude, longitude, google_place_id')
      .neq('status', 'rejected')
      .gte('latitude', latitude - DELTA_100M)
      .lte('latitude', latitude + DELTA_100M)
      .gte('longitude', longitude - DELTA_100M)
      .lte('longitude', longitude + DELTA_100M)
      .limit(10);

    if (yakın && yakın.length > 0) {
      const nameLower = name.trim().toLowerCase();

      // 1. Aynı isim + aynı kategori → 100m içinde kesin tekrar
      const aynıIsim = yakın.find(
        p => p.category === category && p.name.trim().toLowerCase() === nameLower
      );
      if (aynıIsim) {
        return NextResponse.json({
          success: false,
          duplicate: true,
          error: `"${aynıIsim.name}" adıyla bu konuma yakın bir yer zaten mevcut (${aynıIsim.status === 'pending' ? 'onay bekliyor' : 'yayında'}).`,
          existing_id: aynıIsim.id,
        }, { status: 409 });
      }

    }
    // ─────────────────────────────────────────────────────────────────

    // PostGIS geography point formatı
    const locationWkt = `SRID=4326;POINT(${longitude} ${latitude})`;

    const { data, error } = await supabase
      .from('pois')
      .insert({
        name,
        description,
        category,
        location: locationWkt,
        latitude,
        longitude,
        address,
        city,
        district,
        address_note,
        phone,
        website,
        tags,
        badges,
        is_emergency,
        status: 'pending',
        added_by: user.id,
        ...(google_place_id ? { google_place_id } : {}),
      })
      .select('id, name, status')
      .single();

    if (error) {
      // google_place_id UNIQUE constraint ihlali
      if (error.code === '23505' && error.message?.includes('google_place_id')) {
        return NextResponse.json({
          success: false,
          duplicate: true,
          error: 'Bu Google Places konumu zaten kayıtlı.',
        }, { status: 409 });
      }
      console.error('[poi/POST] Insert error:', error);
      return NextResponse.json({ success: false, error: 'Konum eklenemedi.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Konumunuz inceleme için gönderildi. Onaylandıktan sonra haritada görünecektir.',
    }, { status: 201 });
  } catch (err) {
    console.error('[poi/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
