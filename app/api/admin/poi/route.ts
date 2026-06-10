import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// GET /api/admin/poi
// Pending POI listesi (admin/moderatör zorunlu)
// Query params: status (default: pending)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';

    const { data: pois, error } = await supabase
      .from('pois')
      .select('id, name, category, city, latitude, longitude, is_emergency, status, added_by, created_at')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[admin/poi/GET] DB error:', error);
      return NextResponse.json({ success: false, error: 'Veriler alınamadı.' }, { status: 500 });
    }

    // Ekleyen kullanıcıların display_name + email bilgilerini çek
    const userIds = [...new Set((pois || []).map(p => p.added_by).filter(Boolean))] as string[];
    const kullaniciMap: Record<string, { display_name: string | null; email: string | null }> = {};

    if (userIds.length > 0) {
      const { data: kullanicilar } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);
      for (const k of (kullanicilar || []) as any[]) {
        kullaniciMap[k.id] = { display_name: k.display_name, email: k.email };
      }
    }

    const sonuc = (pois || []).map(p => ({
      ...p,
      ekleyen: p.added_by ? (kullaniciMap[p.added_by] ?? null) : null,
    }));

    return NextResponse.json({ success: true, data: sonuc });
  } catch (err) {
    console.error('[admin/poi/GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
