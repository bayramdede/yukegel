import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Sadece moderator / admin erişebilir
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const { data: profil } = await ssrClient
      .from('users').select('role').eq('id', user.id).single();
    const role = (profil as any)?.role;
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId gerekli' }, { status: 400 });

    const svc = getServiceSupabase();

    // 1. Kullanıcı hesabını pasifleştir
    await svc.from('users').update({ is_active: false }).eq('id', userId);

    // 2. Tüm aktif ilanlarını kapat (completed olanlar dokunulmaz)
    await svc
      .from('listings')
      .update({
        status: 'passive',
        moderation_status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .neq('status', 'completed');

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
