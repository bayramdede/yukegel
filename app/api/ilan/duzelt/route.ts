import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export async function POST(req: NextRequest) {
  try {
    // ── Auth: kullanıcı oturumu
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

    const { id, notes, vehicle_type, body_type } = await req.json();
    if (!id) return NextResponse.json({ error: 'İlan ID gerekli' }, { status: 400 });

    const svc = getServiceSupabase();

    // ── İlanı çek ve sahiplik kontrolü
    const { data: ilan, error: ilanErr } = await svc
      .from('listings')
      .select('id, user_id, moderation_status, is_shadow_banned, notes, raw_text, vehicle_type, body_type')
      .eq('id', id)
      .single();

    if (ilanErr || !ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
    if (ilan.user_id !== user.id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    if (ilan.moderation_status !== 'correction_needed') {
      return NextResponse.json({ error: 'Bu ilan düzeltme beklemiyor' }, { status: 400 });
    }

    // ── Aktif güvenlik kurallarını çek
    const { data: kurallar } = await svc
      .from('safety_rules')
      .select('id, rule_type, pattern, risk_weight, description')
      .eq('is_active', true)
      .eq('rule_type', 'REGEX');

    // ── Yeni metni tara
    const yeniNotes = (notes ?? ilan.notes ?? '').trim();
    const haystack = (yeniNotes + ' ' + (ilan.raw_text || '')).toLowerCase();

    let score = 0;
    const firedRules: any[] = [];

    for (const kural of (kurallar || [])) {
      try {
        const re = new RegExp(kural.pattern, 'i');
        if (re.test(haystack)) {
          score += kural.risk_weight;
          firedRules.push({ rule_id: kural.id, description: kural.description, weight: kural.risk_weight });
        }
      } catch { /* bozuk regex, atla */ }
    }
    score = Math.min(score, 100);

    // ── Sonuca göre güncelle
    let yeniModerasyon: string;
    let yeniStatus: string;
    let yeniShadow: boolean;
    let mesaj: string;

    if (score < 31) {
      // Temiz → otomatik yayına al
      yeniModerasyon = 'approved';
      yeniStatus     = 'active';
      yeniShadow     = false;
      mesaj = 'İlanınız güncellendi ve yayına alındı.';
    } else if (score < 71) {
      // Orta risk → moderatör kuyruğuna geri gönder
      yeniModerasyon = 'pending';
      yeniStatus     = 'passive';
      yeniShadow     = false;
      mesaj = 'İlanınız güncellendi ve moderatör incelemesine gönderildi.';
    } else {
      // Hâlâ yüksek risk → düzeltme gerekiyor
      yeniModerasyon = 'correction_needed';
      yeniStatus     = 'passive';
      yeniShadow     = true;
      mesaj = 'İlanınızda hâlâ kurallara aykırı ifadeler bulunuyor. Lütfen tekrar düzenleyin.';
    }

    const { error: updateErr } = await svc.from('listings').update({
      notes:             yeniNotes || null,
      vehicle_type:      vehicle_type ?? ilan.vehicle_type,
      body_type:         body_type    ?? ilan.body_type,
      moderation_status: yeniModerasyon,
      status:            yeniStatus,
      is_shadow_banned:  yeniShadow,
      audit_score:       score,
      internal_audit_logs: {
        score,
        fired_rules: firedRules,
        scanned_at: new Date().toISOString(),
        source: 'user_correction',
      },
      reviewed_at: yeniModerasyon === 'approved' ? new Date().toISOString() : null,
    }).eq('id', id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      score,
      moderation_status: yeniModerasyon,
      status: yeniStatus,
      is_shadow_banned: yeniShadow,
      fired_rules: firedRules,
      mesaj,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
