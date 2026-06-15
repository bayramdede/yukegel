'use server';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────
// POST /api/admin/poi-import/[id]/summarize
// Bir POI için Google yorumlarını Claude ile özetler,
// reviews_summary kolonunu günceller.
// Admin yetkisi zorunlu.
// ─────────────────────────────────────────────────────────────
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Admin kontrolü
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (!profil || profil.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sadece admin kullanabilir.' }, { status: 403 });
    }

    // POI'yi çek
    const { data: poi, error: poiErr } = await supabase
      .from('pois')
      .select('id, name, category, google_place_id')
      .eq('id', id)
      .maybeSingle();

    if (poiErr || !poi) {
      return NextResponse.json({ success: false, error: 'POI bulunamadı.' }, { status: 404 });
    }

    if (!poi.google_place_id) {
      return NextResponse.json({
        success: false,
        error: 'Bu POI için Google Place ID yok. Önce Google Places verisi çekilmeli.',
      }, { status: 400 });
    }

    // Google Places API'dan son yorumları çek
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GOOGLE_PLACES_API_KEY tanımlı değil.' }, { status: 500 });
    }

    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', poi.google_place_id);
    detailsUrl.searchParams.set('fields', 'reviews,rating,user_ratings_total');
    detailsUrl.searchParams.set('language', 'tr');
    detailsUrl.searchParams.set('reviews_sort', 'newest');
    detailsUrl.searchParams.set('key', apiKey);

    const detailsRes = await fetch(detailsUrl.toString());
    if (!detailsRes.ok) {
      return NextResponse.json({ success: false, error: 'Google Places API bağlantı hatası.' }, { status: 502 });
    }

    const detailsData = await detailsRes.json();
    if (detailsData.status !== 'OK') {
      return NextResponse.json({
        success: false,
        error: `Google Places API: ${detailsData.status}`,
      }, { status: 502 });
    }

    const reviews: GoogleReview[] = detailsData.result?.reviews || [];
    const rating: number | undefined = detailsData.result?.rating;
    const reviewCount: number | undefined = detailsData.result?.user_ratings_total;

    if (reviews.length === 0) {
      // Yorum yoksa kısa bir not yaz
      const ozet = 'Bu işletme için henüz yeterli yorum bulunmamaktadır.';
      await supabase
        .from('pois')
        .update({ reviews_summary: ozet, updated_at: new Date().toISOString() })
        .eq('id', id);

      return NextResponse.json({ success: true, data: { reviews_summary: ozet, yorum_sayisi: 0 } });
    }

    // Claude API çağrısı
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY tanımlı değil.' }, { status: 500 });
    }

    // Yorumları birleştir
    const yorumMetni = reviews
      .map((r, i) => `${i + 1}. [${r.rating}/5 yıldız] ${r.text || '(metin yok)'}`)
      .join('\n');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: 'Sen bir kamyoncu asistanısın. Aşağıda bir işletmenin Google yorumları var. Kamyon şoförlerine yönelik kısa, pratik ve Türkçe bir özet yaz. Maksimum 3 cümle. Olumlu ve olumsuz öne çıkan noktaları belirt. Yalnızca özet metni yaz, başka hiçbir şey ekleme.',
        messages: [
          {
            role: 'user',
            content: `İşletme: ${poi.name}\n\nYorumlar:\n${yorumMetni}`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('[poi-summarize] Claude API error:', errText);
      return NextResponse.json({ success: false, error: 'Claude API hatası.' }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const ozet: string = claudeData.content?.[0]?.text?.trim() || '';

    if (!ozet) {
      return NextResponse.json({ success: false, error: 'Claude boş yanıt döndü.' }, { status: 502 });
    }

    // DB güncelle: reviews_summary + güncel Google rating/count
    const guncelleme: Record<string, unknown> = {
      reviews_summary: ozet,
      updated_at: new Date().toISOString(),
    };
    if (rating !== undefined)      guncelleme.google_rating       = rating;
    if (reviewCount !== undefined) guncelleme.google_review_count = reviewCount;

    const { error: updateErr } = await supabase
      .from('pois')
      .update(guncelleme)
      .eq('id', id);

    if (updateErr) {
      console.error('[poi-summarize] DB update error:', updateErr);
      return NextResponse.json({ success: false, error: 'Veritabanı güncelleme hatası.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        reviews_summary: ozet,
        yorum_sayisi: reviews.length,
        google_rating: rating,
        google_review_count: reviewCount,
      },
    });

  } catch (err) {
    console.error('[poi-summarize/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
}
