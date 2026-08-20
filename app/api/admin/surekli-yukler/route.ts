import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/surekli-yukler — moderatör ekranı, tüm Sürekli Yükleri listeler.
 * `docs/SUREKLI_YUK_YAZILIMCI_TALIMATI.md` §5.4.
 *
 * Kolonlar: hat, ilan veren + telefon, başlangıç/bitiş, son yenilenme/son
 * onay, bugünkü temas sayısı, durum. `contact_phone` normalde anon/authenticated
 * için REVOKE (`SPRINT_01 L1e`) — burada service-role ile okunuyor, yalnız
 * `requireAdmin()` geçtikten SONRA (proje kuralı: RLS bypass yalnız admin/mod
 * doğrulandıktan sonra).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const svc = getServiceSupabase();
  const { searchParams } = new URL(req.url);
  const durumFiltre = searchParams.get('durum'); // 'active' | 'passive' | null

  let sorgu = svc
    .from('listings')
    .select(`id, user_id, status, moderation_status, contact_phone,
      origin_province_id, origin_district, created_at, updated_at,
      recurring_until, recurring_confirmed_at,
      listing_stops ( stop_order, province_id, district )`)
    .eq('is_recurring', true)
    .order('recurring_confirmed_at', { ascending: true });

  if (durumFiltre === 'active' || durumFiltre === 'passive') sorgu = sorgu.eq('status', durumFiltre);

  const { data, error } = await sorgu;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((r: any) => r.id as string);

  // İlan veren bilgisi AYRI sorguyla (FK hint tahmin etmek yerine — bkz.
  // `app/page.tsx::fetchInitialIlanlar` aynı desen). `user_id` NULL olabilir
  // (sahiplenilmemiş ilan sürekli yük işaretlenemez ama garanti değil).
  const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
  const sahipMap: Record<string, { display_name: string | null; phone: string | null }> = {};
  if (userIds.length > 0) {
    const { data: sahipler } = await svc.from('users').select('id, display_name, phone').in('id', userIds as string[]);
    for (const s of (sahipler ?? []) as any[]) sahipMap[s.id] = s;
  }
  // Bugünkü temas/anlaşma sayısı — ayrı sorgu, `deal_date = bugün`.
  const bugun = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  let gunlukSayim: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: bugunDeals } = await svc
      .from('deals')
      .select('listing_id')
      .in('listing_id', ids)
      .eq('deal_date', bugun)
      .eq('is_recurring_deal', true)
      .neq('status', 'cancelled');
    for (const d of (bugunDeals ?? []) as any[]) {
      gunlukSayim[d.listing_id] = (gunlukSayim[d.listing_id] ?? 0) + 1;
    }
  }

  const satirlar = (data ?? []).map((r: any) => ({
    ...r,
    owner: r.user_id ? (sahipMap[r.user_id] ?? null) : null,
    gunluk_temas: gunlukSayim[r.id] ?? 0,
  }));

  return NextResponse.json({ data: satirlar, bugun });
}
