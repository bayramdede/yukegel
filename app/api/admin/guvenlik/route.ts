import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

async function yetkiKontrol(req: NextRequest) {
  const ssrClient = await getServerSupabase();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return null;
  const { data: profil } = await ssrClient.from('users').select('role').eq('id', user.id).single();
  if ((profil as any)?.role !== 'admin') return null;
  return user;
}

// ── GET: istatistik + kurallar + blacklist ──
export async function GET(req: NextRequest) {
  const user = await yetkiKontrol(req);
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);

  const [
    { data: kurallar },
    { data: blacklist },
    { count: toplamShadow },
    { count: bugunShadow },
    { count: toplamIncelenen },
    { count: onaylanan },
  ] = await Promise.all([
    svc.from('safety_rules').select('*').order('risk_weight', { ascending: false }),
    svc.from('blacklist').select('*').order('blocked_at', { ascending: false }),
    svc.from('listings').select('*', { count: 'exact', head: true }).eq('is_shadow_banned', true),
    svc.from('listings').select('*', { count: 'exact', head: true }).eq('is_shadow_banned', true).gte('created_at', bugun.toISOString()),
    svc.from('listings').select('*', { count: 'exact', head: true }).not('reviewed_at', 'is', null),
    svc.from('listings').select('*', { count: 'exact', head: true }).eq('moderation_status', 'approved').not('reviewed_at', 'is', null),
  ]);

  const dogrulukOrani = toplamIncelenen && toplamIncelenen > 0
    ? Math.round(((onaylanan ?? 0) / toplamIncelenen) * 100)
    : 0;

  return NextResponse.json({
    kurallar: kurallar || [],
    blacklist: blacklist || [],
    istatistik: {
      toplamShadow: toplamShadow ?? 0,
      bugunShadow: bugunShadow ?? 0,
      dogrulukOrani,
      toplamKural: kurallar?.length ?? 0,
      toplamBlacklist: blacklist?.length ?? 0,
    },
  });
}

// ── POST: yeni kural veya blacklist girişi ──
export async function POST(req: NextRequest) {
  const user = await yetkiKontrol(req);
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const body = await req.json();

  if (body.tablo === 'safety_rules') {
    const { rule_type, pattern, risk_weight, description } = body;
    if (!pattern?.trim()) return NextResponse.json({ error: 'Pattern zorunlu' }, { status: 400 });
    const { data, error } = await svc.from('safety_rules').insert({
      rule_type: rule_type || 'REGEX',
      pattern: pattern.trim(),
      risk_weight: Number(risk_weight) || 10,
      description: description?.trim() || null,
      is_active: true,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  if (body.tablo === 'blacklist') {
    const { identifier_type, identifier_value, reason } = body;
    if (!identifier_value?.trim()) return NextResponse.json({ error: 'Değer zorunlu' }, { status: 400 });
    const { data, error } = await svc.from('blacklist').insert({
      identifier_type: identifier_type || 'PHONE',
      identifier_value: identifier_value.trim(),
      reason: reason?.trim() || null,
      blocked_by: user.id,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  return NextResponse.json({ error: 'Geçersiz tablo' }, { status: 400 });
}

// ── PATCH: kural güncelle (is_active toggle veya tam güncelleme) ──
export async function PATCH(req: NextRequest) {
  const user = await yetkiKontrol(req);
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const { error } = await svc.from('safety_rules').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ── DELETE: kural veya blacklist girişi sil ──
export async function DELETE(req: NextRequest) {
  const user = await yetkiKontrol(req);
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const { id, tablo } = await req.json();
  if (!id || !tablo) return NextResponse.json({ error: 'id ve tablo gerekli' }, { status: 400 });

  const { error } = await svc.from(tablo).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
