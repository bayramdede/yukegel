import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Sadece moderator / admin
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const { data: profil } = await ssrClient.from('users').select('role').eq('id', user.id).single();
    const role = (profil as any)?.role;
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const { ids, action } = await request.json() as { ids: string[]; action: 'archive' | 'unarchive' };
    if (!ids?.length) return NextResponse.json({ error: 'ids gerekli' }, { status: 400 });

    const svc = getServiceSupabase();
    const now = new Date().toISOString();

    if (action === 'archive') {
      // Service role ile yaz — RLS ve CHECK constraint bypass
      const { error } = await svc
        .from('listings')
        .update({ moderation_status: 'archived', status: 'passive', reviewed_at: now })
        .in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Arşivden çıkar → pending'e al
      const { error } = await svc
        .from('listings')
        .update({ moderation_status: 'pending', reviewed_at: now })
        .in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
