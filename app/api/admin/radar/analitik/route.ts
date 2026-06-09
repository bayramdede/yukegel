import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/radar/analitik?view=overview&days=30
// GET /api/admin/radar/analitik?view=city&city=Antalya&direction=departure&days=30

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const svc = getServiceSupabase();
  const { searchParams } = new URL(req.url);
  const view      = searchParams.get('view') || 'overview';
  const days      = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')));
  const city      = searchParams.get('city')?.trim() || '';
  const direction = searchParams.get('direction') || 'departure';

  if (view === 'overview') {
    const { data, error } = await svc.rpc('get_radar_city_overview', { p_days: days });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cities: data ?? [] });
  }

  if (view === 'city') {
    if (!city) return NextResponse.json({ error: 'city parametresi gerekli' }, { status: 400 });
    const counterpart = searchParams.get('counterpart')?.trim() || null;
    const rpcParams: Record<string, unknown> = {
      p_city:      city,
      p_direction: direction,
      p_days:      days,
    };
    if (counterpart) rpcParams.p_counterpart = counterpart;
    const { data, error } = await svc.rpc('get_radar_city_detail', rpcParams);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? {});
  }

  return NextResponse.json({ error: 'Geçersiz view' }, { status: 400 });
}
