import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

// Tüm moderatör toplu işlemleri service role ile — RLS bypass
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const { data: profil } = await ssrClient.from('users').select('role').eq('id', user.id).single();
    const role = (profil as any)?.role;
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const { ids, action } = await request.json() as {
      ids: string[];
      action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive';
    };
    if (!ids?.length) return NextResponse.json({ error: 'ids gerekli' }, { status: 400 });

    const svc = getServiceSupabase();
    const now = new Date().toISOString();

    const updateMap: Record<string, object> = {
      approve:   { moderation_status: 'approved',  status: 'active',  reviewed_at: now },
      reject:    { moderation_status: 'rejected',  status: 'passive', reviewed_at: now },
      passive:   { status: 'passive',                                  reviewed_at: now },
      archive:   { moderation_status: 'archived',  status: 'passive', reviewed_at: now },
      unarchive: { moderation_status: 'pending',                       reviewed_at: now },
    };

    const payload = updateMap[action];
    if (!payload) return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });

    const { error, count } = await svc
      .from('listings')
      .update(payload)
      .in('id', ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, updated: count ?? ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
