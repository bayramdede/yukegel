import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// POST /api/poi/[id]/review
// Yorum ekle + geo-fence doğrulama
// Body: { rating, comment, quick_tags, user_lat, user_lng, category_ratings? }
// ─────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poiId } = await params;

    // Auth kontrolü
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Yorum yapmak için giriş gerekli.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      rating,
      comment,
      quick_tags = [],
      user_lat,
      user_lng,
      category_ratings = null,
    } = body;

    // Validasyon
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir puan (1-5) gerekli.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // POI varlık kontrolü
    const { data: poi } = await supabase
      .from('pois')
      .select('id, status')
      .eq('id', poiId)
      .eq('status', 'approved')
      .maybeSingle();

    if (!poi) {
      return NextResponse.json({ success: false, error: 'Konum bulunamadı.' }, { status: 404 });
    }

    // Geo-fence doğrulama (kullanıcı konum sağladıysa)
    let isVerified = false;
    let reviewType: 'verified' | 'guest' = 'guest';

    if (user_lat != null && user_lng != null) {
      const { data: visitCheck } = await supabase.rpc('check_poi_visit', {
        p_user_id:  user.id,
        p_poi_id:   poiId,
        p_user_lat: user_lat,
        p_user_lng: user_lng,
      });

      if (visitCheck?.verified) {
        isVerified = true;
        reviewType = 'verified';
      }
    }

    // Yorum kaydet
    const { data: review, error } = await supabase
      .from('poi_reviews')
      .upsert(
        {
          poi_id:           poiId,
          user_id:          user.id,
          rating,
          comment:          comment || null,
          quick_tags,
          category_ratings, // Faz 2 için boş bırakılabilir
          is_verified_visit: isVerified,
          review_type:      reviewType,
        },
        { onConflict: 'poi_id,user_id' }
      )
      .select('id, rating, review_type, is_verified_visit')
      .single();

    if (error) {
      console.error('[poi/review/POST] Upsert error:', error);
      return NextResponse.json({ success: false, error: 'Yorum kaydedilemedi.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: review,
      message: reviewType === 'verified'
        ? '✅ Yorumunuz doğrulanmış ziyaretçi olarak kaydedildi.'
        : 'Yorumunuz misafir yorum olarak kaydedildi.',
    }, { status: 201 });
  } catch (err) {
    console.error('[poi/review/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
