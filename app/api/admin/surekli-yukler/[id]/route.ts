import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../lib/auth';
import { getConfigs } from '../../../../../lib/config';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/surekli-yukler/[id] — moderatör aksiyonları (§5.4).
 *
 * Body: { action: 'sonlandir' | 'duraklat' | 'aktiflestir' | 'tarih_duzenle', recurring_until? }
 *   sonlandir     — is_recurring=false + status='passive' (kalıcı, feed'den düşer)
 *   duraklat      — status='passive', is_recurring KORUNUR (geçici; cron dokunmaz,
 *                   moderatör 'aktiflestir' ile geri açar — pasif kaldığı sürece
 *                   `recurring-refresh` cron'u onu 'active' YAPMAZ, yalnız zaten
 *                   aktif olanları tazeler)
 *   aktiflestir   — status='active' (duraklatılmışı geri aç)
 *   tarih_duzenle — recurring_until günceller (aynı tavan kuralları: gelecekte + ≤365 gün)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await params;
  const { action, recurring_until } = await req.json().catch(() => ({}));
  const svc = getServiceSupabase();

  const { data: ilan } = await svc
    .from('listings')
    .select('id, is_recurring, available_date')
    .eq('id', id)
    .maybeSingle();
  if (!ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
  if (!ilan.is_recurring) return NextResponse.json({ error: 'Bu ilan Sürekli Yük değil.' }, { status: 400 });

  let yama: Record<string, unknown>;
  switch (action) {
    case 'sonlandir':
      yama = { is_recurring: false, status: 'passive', recurring_until: null };
      break;
    case 'duraklat':
      yama = { status: 'passive' };
      break;
    case 'aktiflestir':
      yama = { status: 'active' };
      break;
    case 'tarih_duzenle': {
      if (typeof recurring_until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(recurring_until)) {
        return NextResponse.json({ error: 'Geçerli bir tarih gönderin.' }, { status: 400 });
      }
      const bugun = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (recurring_until <= bugun) {
        return NextResponse.json({ error: 'Bitiş tarihi bugünden sonra olmalı.' }, { status: 400 });
      }
      const cfg = await getConfigs(['recurring_max_days'], { recurring_max_days: '365' });
      const maxGun = parseInt(cfg.recurring_max_days, 10) || 365;
      const tavanTarih = new Date(Date.now() + 3 * 60 * 60 * 1000 + maxGun * 86400_000).toISOString().split('T')[0];
      if (recurring_until > tavanTarih) {
        return NextResponse.json({ error: `Bitiş tarihi en fazla ${maxGun} gün ileri olabilir.` }, { status: 400 });
      }
      yama = { recurring_until };
      break;
    }
    default:
      return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const { error } = await svc.from('listings').update(yama).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, ...yama });
}
