import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../lib/auth';
import { structuredLog } from '../../../lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/deals — "Bu İşi Al / Anlaş" (GuvenEtkilesim PRD md.2, 1. aşama)
 *
 * Nakliyeci TALEP oluşturur (`status='requested'`). Mühürleme İLAN VERENİN
 * onayıyla olur (`POST /api/deals/[id]/onayla`) — PRD: "İlan veren … onayladığı
 * an süreç mühürlenir."
 *
 * 🚨 `shipper_id` İSTEMCİDEN ALINMAZ, `listings.user_id`'den okunur. Aksi hâlde
 *    bir saldırgan kendini "ilan veren" ilan edip kendi kaydını kendi onaylar ve
 *    hiç iş yapmadan itibar üretirdi.
 */
export async function POST(req: NextRequest) {
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const { listing_id, payment_terms_days } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: 'listing_id gerekli' }, { status: 400 });

  const svc = getServiceSupabase();

  const { data: ilan } = await svc
    .from('listings')
    .select('id, user_id, status, moderation_status, is_shadow_banned, completed_at')
    .eq('id', listing_id)
    .maybeSingle();

  if (!ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  // ⚠️ İlanların %99,95'i SAHİPSİZ (WhatsApp/kazıma kaynaklı, `user_id` NULL).
  //    Bu ilanlarda anlaşma tarafı yok; net hata vermek şart, yoksa kullanıcı
  //    butona basıp sessiz bir hiçlikle karşılaşır.
  if (!ilan.user_id) {
    return NextResponse.json({
      error: 'Bu ilan bir Yükegel hesabına bağlı değil. Sahibi ilanı sahiplenmeden anlaşma başlatılamaz.',
    }, { status: 409 });
  }
  if (ilan.user_id === user.id) {
    return NextResponse.json({ error: 'Kendi ilanınıza talep gönderemezsiniz.' }, { status: 400 });
  }
  if (ilan.completed_at) {
    return NextResponse.json({ error: 'Bu ilan tamamlanmış.' }, { status: 409 });
  }
  if (ilan.status !== 'active' || ilan.is_shadow_banned
      || !['approved', 'auto_published'].includes(ilan.moderation_status)) {
    return NextResponse.json({ error: 'Bu ilan şu anda yayında değil.' }, { status: 409 });
  }

  // Zaten mühürlenmiş bir anlaşma var mı? (kısmi unique indeks de korur ama
  // kullanıcıya 23505 değil anlaşılır mesaj dönmeli)
  const { data: mevcutAnlasma } = await svc
    .from('deals')
    .select('id, carrier_id, status')
    .eq('listing_id', listing_id)
    .in('status', ['matched', 'in_transit', 'completed'])
    .maybeSingle();
  if (mevcutAnlasma) {
    return NextResponse.json({ error: 'Bu yük için anlaşma çoktan yapılmış.' }, { status: 409 });
  }

  const vade = Number.isInteger(payment_terms_days)
    && payment_terms_days >= 0 && payment_terms_days <= 180
      ? payment_terms_days : null;

  const { data: deal, error } = await svc
    .from('deals')
    .insert({
      listing_id,
      shipper_id: ilan.user_id,   // ← İSTEMCİDEN DEĞİL
      carrier_id: user.id,
      status: 'requested',
      payment_terms_days: vade,
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    // `deals_tekil (listing_id, carrier_id)` — aynı nakliyeci ikinci kez talep etti
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Bu ilana zaten talep gönderdiniz.' }, { status: 409 });
    }
    structuredLog('ERROR', 'db-transaction', 'Anlaşma talebi oluşturulamadı', {
      supabase_error: error.message, listing_id, user_id: user.id,
    });
    return NextResponse.json({ error: 'Talep oluşturulamadı.' }, { status: 500 });
  }

  structuredLog('INFO', 'db-transaction', 'Anlaşma talebi oluşturuldu', {
    deal_id: deal.id, listing_id, carrier_id: user.id, shipper_id: ilan.user_id,
  });

  return NextResponse.json({ success: true, deal });
}

/**
 * GET /api/deals — oturum sahibinin taraf olduğu kayıtlar.
 * ⚠️ Servis rolüyle okunuyor ama filtre OTURUMDAN geliyor; istemci başkasının
 *    kayıtlarını isteyemez (RLS de ayrıca korur).
 */
export async function GET(req: NextRequest) {
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const rol = new URL(req.url).searchParams.get('rol'); // 'shipper' | 'carrier' | null
  const svc = getServiceSupabase();

  let q = svc.from('deals')
    .select(`id, listing_id, shipper_id, carrier_id, status, matched_at, transit_at,
             completed_declared_by, completed_declared_at, completed_at,
             payment_terms_days, payment_maturity_date, payment_declared_at,
             payment_confirmed_at, payment_disputed_at, review_deadline, created_at`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (rol === 'shipper')      q = q.eq('shipper_id', user.id);
  else if (rol === 'carrier') q = q.eq('carrier_id', user.id);
  else q = q.or(`shipper_id.eq.${user.id},carrier_id.eq.${user.id}`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data ?? [] });
}
