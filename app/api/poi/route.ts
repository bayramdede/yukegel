import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../lib/auth';

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

    const { data, error } = await supabase.rpc('get_pois_in_bbox', {
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
    });

    if (error) {
      console.error('[poi/GET] RPC error:', error);
      return NextResponse.json({ success: false, error: 'Konum verileri alınamadı.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[poi/GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/poi
// Yeni POI ekle (giriş zorunlu, pending olarak eklenir)
// Body: { name, description, category, latitude, longitude, address, city, phone, website, tags, badges, is_emergency }
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
    } = body;

    // Temel validasyon
    if (!name || !category || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: 'name, category, latitude ve longitude zorunludur.' },
        { status: 400 }
      );
    }

    const validCategories = ['park_dinlenme', 'yemek', 'konaklama', 'tamirci', 'tesis_akaryakit', 'kantar_resmi'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ success: false, error: 'Geçersiz kategori.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

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
        phone,
        website,
        tags,
        badges,
        is_emergency,
        status: 'pending',
        added_by: user.id,
      })
      .select('id, name, status')
      .single();

    if (error) {
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
