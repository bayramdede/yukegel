import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/crm/[id] — shadow profile detayı + ilan geçmişi
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await params;
  const svc = getServiceSupabase();

  const [profileRes, listingsRes] = await Promise.all([
    svc.from('shadow_profiles').select('*').eq('id', id).maybeSingle(),
    svc.from('listings')
      .select('id, origin_city, listing_type, moderation_status, status, created_at, notes, vehicle_type')
      .eq('shadow_profile_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (!profileRes.data) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  return NextResponse.json({
    profile: profileRes.data,
    listings: listingsRes.data ?? [],
  });
}
