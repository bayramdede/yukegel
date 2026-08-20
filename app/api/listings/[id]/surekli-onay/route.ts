import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../../lib/auth';
import { structuredLog } from '../../../../../lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/listings/[id]/surekli-onay — Sürekli Yük "hâlâ var mı?" onayı.
 *
 * `docs/SUREKLI_YUK_YAZILIMCI_TALIMATI.md` §4.3. Bilinçli olarak KÜÇÜK ve
 * BAĞIMSIZ tutuldu: genel bildirim sistemi (SMS/e-posta) YOK, bu uç nokta
 * yalnız İlanlarım'daki bağlamsal şeritten çağrılıyor. İleride genel bildirim
 * sistemi gelirse aynı endpoint'e bağlanabilir.
 *
 * Body: { action: 'onayla' | 'durdur' }
 *   onayla — YALNIZ ilan sahibi. `recurring_confirmed_at = now()`. İlan,
 *            onay/grace süresi geçtiği için `recurring-refresh` cron'unca
 *            pasife düşürülmüşse ve moderasyonu hâlâ yayında sayılan bir
 *            durumdaysa (approved/auto_published) tekrar `active`e döner —
 *            aksi hâlde (ör. moderatör ayrıca reddetmişse) status'a
 *            dokunmuyoruz, yalnız onay zamanını güncelliyoruz.
 *   durdur  — `is_recurring=false`, `recurring_until=null`. `status`a
 *             BİLEREK dokunulmuyor: ilan sıradan (tek seferlik) bir ilana
 *             döner ve normal `expire-active-listings` akışına devam eder.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (action !== 'onayla' && action !== 'durdur') {
    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const svc = getServiceSupabase();
  const { data: ilan } = await svc
    .from('listings')
    .select('id, user_id, is_recurring, status, moderation_status')
    .eq('id', id)
    .maybeSingle();

  if (!ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
  if (ilan.user_id !== user.id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  if (!ilan.is_recurring) {
    return NextResponse.json({ error: 'Bu ilan Sürekli Yük olarak işaretli değil.' }, { status: 400 });
  }

  const simdi = new Date().toISOString();
  const yayindaSayilir = ilan.moderation_status === 'approved' || ilan.moderation_status === 'auto_published';

  const yama: Record<string, unknown> = action === 'onayla'
    ? {
        recurring_confirmed_at: simdi,
        // Grace sonrası pasife düşmüştü, yayın kararı hâlâ geçerliyse geri aç.
        ...(ilan.status === 'passive' && yayindaSayilir ? { status: 'active' } : {}),
      }
    : { is_recurring: false, recurring_until: null };

  const { error } = await svc.from('listings').update(yama).eq('id', id);
  if (error) {
    structuredLog('ERROR', 'db-transaction', 'Sürekli Yük onay/durdur güncellenemedi', {
      supabase_error: error.message, listing_id: id, action, user_id: user.id,
    });
    return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...yama });
}
