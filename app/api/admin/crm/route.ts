import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/crm?page=1&limit=50&min_listings=1&search=05...
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const svc = getServiceSupabase();
  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit     = Math.min(100, parseInt(searchParams.get('limit') || '50'));
  const minCount  = parseInt(searchParams.get('min_listings') || '0');
  const search    = searchParams.get('search')?.trim() || '';
  const sortParam = searchParams.get('sort') || 'listing_count';
  const offset    = (page - 1) * limit;

  // Etiket sıralaması client-side (puan bazlı), DB'de desteklenmiyor
  const validSorts: Record<string, string> = {
    listing_count:  'listing_count',
    last_listing_at: 'last_listing_at',
    first_listing_at: 'first_listing_at',
    created_at:     'created_at',
    etiket:         'listing_count', // etiket client-side sort eder
  };
  const sortColumn = validSorts[sortParam] ?? 'listing_count';

  // count kaldırıldı — shadow_profiles artık denormalize listing_count kolonu taşıdığından
  // view basit SELECT. Yine de PostgREST count isteği zaman zaman ağır EXPLAIN veya
  // fallback COUNT yapabilir; toplam kayıt sayısı ayrı hafif sorguyla alınır.
  let query = svc
    .from('shadow_profile_summary')
    .select('*')
    .order(sortColumn, { ascending: false })
    .range(offset, offset + limit - 1);

  if (minCount > 0) query = query.gte('listing_count', minCount);
  if (search)       query = query.ilike('phone', `%${search}%`);

  // Toplam kayıt: count(*) shadow_profiles üzerinde — view'dan değil, çok daha hızlı
  let countQuery = svc.from('shadow_profiles').select('id', { count: 'exact', head: true });
  if (minCount > 0) countQuery = countQuery.gte('listing_count', minCount);
  if (search)       countQuery = countQuery.ilike('phone', `%${search}%`);

  const [{ data, error }, { count }] = await Promise.all([query, countQuery]);

  if (error) {
    console.error('[CRM] shadow_profile_summary sorgu hatası:', error.message, error.details);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}

// PATCH /api/admin/crm — shadow profile güncelle (name, company_name, notes, status)
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const svc = getServiceSupabase();
  const body = await req.json();
  const { id, name, company_name, notes, status, etiket } = body;

  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name         !== undefined) updates.name         = name;
  if (company_name !== undefined) updates.company_name = company_name;
  if (notes        !== undefined) updates.notes        = notes;
  if (status       !== undefined) updates.status       = status;
  if (etiket       !== undefined) updates.etiket       = etiket;

  const { error } = await svc
    .from('shadow_profiles')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
