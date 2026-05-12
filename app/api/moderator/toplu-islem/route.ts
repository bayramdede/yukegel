import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';
import { logModeratorAction } from '../../../../lib/logger';

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

    const body = await request.json() as {
      ids: string[];
      action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive'
            | 'shadow_ban_kaldir' | 'shadow_ban' | 'correction_needed';
      correction_reason?: string;
      correction_message?: string;
    };

    const { ids, action } = body;
    if (!ids?.length) return NextResponse.json({ error: 'ids gerekli' }, { status: 400 });

    const svc = getServiceSupabase();
    const now = new Date().toISOString();

    // Supabase .in() URL limiti (~2KB) için batch helper
    async function batchUpdate(allIds: string[], payload: object): Promise<{ error: any }> {
      const BATCH = 50;
      for (let i = 0; i < allIds.length; i += BATCH) {
        const slice = allIds.slice(i, i + BATCH);
        const { error } = await svc.from('listings').update(payload).in('id', slice);
        if (error) return { error };
      }
      return { error: null };
    }

    if (action === 'correction_needed') {
      const logPatch = {
        correction_reason:       body.correction_reason  || null,
        correction_message:      body.correction_message || null,
        correction_requested_at: now,
      };
      const { data: mevcutIlanlar } = await svc
        .from('listings')
        .select('id, internal_audit_logs')
        .in('id', ids);
      for (const ilan of (mevcutIlanlar || [])) {
        const mevcutLog = (ilan.internal_audit_logs as any) || {};
        const { error } = await svc.from('listings').update({
          moderation_status:   'correction_needed',
          status:              'passive',
          reviewed_at:         now,
          internal_audit_logs: { ...mevcutLog, ...logPatch },
        }).eq('id', ilan.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      logModeratorAction({
        adminId: user.id,
        action: 'correction_needed',
        affectedIds: ids,
        reason: body.correction_reason,
      });
      return NextResponse.json({ success: true, updated: ids.length });
    }

    if (action === 'shadow_ban_kaldir') {
      const { error } = await batchUpdate(ids, { is_shadow_banned: false, moderation_status: 'approved', status: 'active', reviewed_at: now });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      logModeratorAction({ adminId: user.id, action: 'shadow_ban_kaldir', affectedIds: ids });
      return NextResponse.json({ success: true, updated: ids.length });
    }

    if (action === 'shadow_ban') {
      const { error } = await batchUpdate(ids, { is_shadow_banned: true, reviewed_at: now });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      logModeratorAction({ adminId: user.id, action: 'shadow_ban', affectedIds: ids });
      return NextResponse.json({ success: true, updated: ids.length });
    }

    const updateMap: Record<string, object> = {
      approve:   { moderation_status: 'approved',  status: 'active',  reviewed_at: now },
      reject:    { moderation_status: 'rejected',  status: 'passive', reviewed_at: now },
      passive:   { status: 'passive',                                  reviewed_at: now },
      archive:   { moderation_status: 'archived',  status: 'passive', reviewed_at: now },
      unarchive: { moderation_status: 'pending',                       reviewed_at: now },
    };

    const payload = updateMap[action];
    if (!payload) return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });

    const { error } = await batchUpdate(ids, payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    logModeratorAction({ adminId: user.id, action, affectedIds: ids });

    return NextResponse.json({ success: true, updated: count ?? ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
