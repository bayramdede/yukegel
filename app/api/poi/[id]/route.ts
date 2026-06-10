import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// GET /api/poi/[id]
// POI detay: temel bilgiler + son yorumlar
// ─────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getServiceSupabase();

    // POI + son 10 yorum paralel çek
    const [poiResult, reviewsResult] = await Promise.all([
      supabase
        .from('pois')
        .select('id, name, description, category, latitude, longitude, address, city, phone, website, photos, tags, badges, estimated_wait_minutes, is_emergency, avg_rating, review_count, created_at')
        .eq('id', id)
        .eq('status', 'approved')
        .maybeSingle(),

      supabase
        .from('poi_reviews')
        .select('id, rating, comment, quick_tags, is_verified_visit, review_type, created_at, user_id')
        .eq('poi_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (poiResult.error) {
      console.error('[poi/[id]/GET] DB error:', poiResult.error);
      return NextResponse.json({ success: false, error: 'Konum bilgisi alınamadı.' }, { status: 500 });
    }

    if (!poiResult.data) {
      return NextResponse.json({ success: false, error: 'Konum bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...poiResult.data,
        reviews: reviewsResult.data || [],
      },
    });
  } catch (err) {
    console.error('[poi/[id]/GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

const VALID_CATEGORIES = ['park_dinlenme', 'yemek', 'konaklama', 'tamirci', 'tesis_akaryakit', 'kantar_resmi'];

// ─────────────────────────────────────────────
// PATCH /api/poi/[id]
// Durum ve/veya içerik güncelle (admin/moderatör zorunlu)
// Body (hepsi opsiyonel, en az biri zorunlu):
//   status       — 'approved' | 'rejected'
//   name         — string
//   category     — geçerli kategori değeri
//   city         — string
//   address      — string
//   description  — string
//   latitude     — number  (longitude ile birlikte)
//   longitude    — number  (latitude ile birlikte)
//   is_emergency — boolean
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const body = await request.json();
    const { status, name, category, city, district, address, address_note, description, latitude, longitude, is_emergency } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status !== undefined) {
      if (!['approved', 'rejected'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Geçersiz durum. approved veya rejected olmalı.' }, { status: 400 });
      }
      updates.status = status;
    }

    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ success: false, error: 'Ad boş olamaz.' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json({ success: false, error: 'Geçersiz kategori.' }, { status: 400 });
      }
      updates.category = category;
    }

    if (city !== undefined)         updates.city         = city?.trim() || null;
    if (district !== undefined)    updates.district     = district?.trim() || null;
    if (address !== undefined)     updates.address      = address?.trim() || null;
    if (address_note !== undefined) updates.address_note = address_note?.trim() || null;
    if (description !== undefined) updates.description  = description?.trim() || null;
    if (is_emergency !== undefined) updates.is_emergency = Boolean(is_emergency);

    if (latitude !== undefined || longitude !== undefined) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json({ success: false, error: 'Geçersiz koordinat.' }, { status: 400 });
      }
      updates.latitude  = lat;
      updates.longitude = lng;
      updates.location  = `SRID=4326;POINT(${lng} ${lat})`;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ success: false, error: 'Güncellenecek alan belirtilmedi.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pois')
      .update(updates)
      .eq('id', id)
      .select('id, name, category, city, address, description, latitude, longitude, is_emergency, status')
      .maybeSingle();

    if (error) {
      console.error('[poi/[id]/PATCH] DB error:', error);
      return NextResponse.json({ success: false, error: 'Güncelleme başarısız.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'POI bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[poi/[id]/PATCH] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
