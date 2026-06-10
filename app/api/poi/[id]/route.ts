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

// ─────────────────────────────────────────────
// PATCH /api/poi/[id]
// Durum güncelle: approved | rejected (admin/moderatör zorunlu)
// Body: { status: 'approved' | 'rejected' }
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
    const { status } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Geçersiz durum. approved veya rejected olmalı.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pois')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, name, status')
      .maybeSingle();

    if (error) {
      console.error('[poi/[id]/PATCH] DB error:', error);
      return NextResponse.json({ success: false, error: 'Durum güncellenemedi.' }, { status: 500 });
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
