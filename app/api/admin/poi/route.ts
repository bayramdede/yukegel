import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';
import { POI_GECERLI_KATEGORILER } from '../../../../lib/poi-constants';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────
// GET /api/admin/poi
// Pending POI listesi (admin/moderatör zorunlu)
// Query params: status (default: pending)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profil || !['admin', 'moderator'].includes(profil.role)) {
      return NextResponse.json({ success: false, error: 'Yetersiz yetki.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pending';
    const search       = searchParams.get('search')?.trim() || '';
    const categoryFilter = searchParams.get('category') || '';
    const sortBy       = searchParams.get('sort') || 'created_at';
    const sortOrder    = searchParams.get('order') === 'asc';

    const VALID_SORT = ['created_at', 'name', 'avg_rating', 'review_count', 'city'];
    const sortCol = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pois')
      .select('id, name, description, category, city, district, address, address_note, phone, website, tags, latitude, longitude, is_emergency, status, added_by, created_at, avg_rating, review_count')
      .eq('status', statusFilter);

    if (search) query = query.ilike('name', `%${search}%`);
    if (categoryFilter) query = query.eq('category', categoryFilter);

    query = query.order(sortCol, { ascending: sortOrder });

    const { data: pois, error } = await query;

    if (error) {
      console.error('[admin/poi/GET] DB error:', error);
      return NextResponse.json({ success: false, error: 'Veriler alınamadı.' }, { status: 500 });
    }

    // Ekleyen kullanıcıların display_name + email bilgilerini çek
    const userIds = [...new Set((pois || []).map(p => p.added_by).filter(Boolean))] as string[];
    const kullaniciMap: Record<string, { display_name: string | null; email: string | null }> = {};

    if (userIds.length > 0) {
      const { data: kullanicilar } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', userIds);
      for (const k of (kullanicilar || []) as any[]) {
        kullaniciMap[k.id] = { display_name: k.display_name, email: k.email };
      }
    }

    const sonuc = (pois || []).map(p => ({
      ...p,
      ekleyen: p.added_by ? (kullaniciMap[p.added_by] ?? null) : null,
    }));

    return NextResponse.json({ success: true, data: sonuc });
  } catch (err) {
    console.error('[admin/poi/GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/poi
// Tekil veya toplu POI ekle — direkt approved (admin/moderatör zorunlu)
// Body: PoiInput | PoiInput[]
// ─────────────────────────────────────────────
interface PoiInput {
  name: string;
  description?: string | null;
  category: string;
  categories?: string[];  // çoklu alt kategori desteği
  city?: string | null;
  district?: string | null;
  address?: string | null;
  address_note?: string | null;
  phone?: string | null;
  website?: string | null;
  tags?: string[];
  latitude: number;
  longitude: number;
  is_emergency?: boolean;
}

const VALID_CATS = POI_GECERLI_KATEGORILER;

export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profil || !['admin', 'moderator'].includes(profil.role)) {
      return NextResponse.json({ success: false, error: 'Yetersiz yetki.' }, { status: 403 });
    }

    const body = await request.json();
    const rows: PoiInput[] = Array.isArray(body) ? body : [body];

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Veri bulunamadı.' }, { status: 400 });
    }
    if (rows.length > 500) {
      return NextResponse.json({ success: false, error: 'Tek seferinde en fazla 500 kayıt gönderilebilir.' }, { status: 400 });
    }

    const insertable: Record<string, unknown>[] = [];
    const errors: { index: number; name: string; errors: string[] }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowErrors: string[] = [];

      // categories[] öncelikli; yoksa category tekline bak
      const rowCats: string[] = Array.isArray(r.categories) && r.categories.length > 0
        ? r.categories : (r.category ? [r.category] : []);
      const rowCategory = rowCats[0] ?? '';

      if (!r.name || !String(r.name).trim()) rowErrors.push('Ad zorunlu');
      if (rowCats.length === 0) rowErrors.push('Kategori zorunlu');
      const invalidRowCat = rowCats.find(c => !VALID_CATS.includes(c));
      if (invalidRowCat) rowErrors.push(`Geçersiz kategori: ${invalidRowCat}`);

      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      if (isNaN(lat) || lat < -90  || lat > 90)  rowErrors.push('Geçersiz enlem');
      if (isNaN(lng) || lng < -180 || lng > 180) rowErrors.push('Geçersiz boylam');

      if (rowErrors.length > 0) {
        errors.push({ index: i, name: String(r.name ?? ''), errors: rowErrors });
        continue;
      }

      insertable.push({
        name:         String(r.name).trim(),
        description:  r.description?.trim()  || null,
        category:     rowCategory,
        categories:   rowCats,
        city:         r.city?.trim()         || null,
        district:     r.district?.trim()     || null,
        address:      r.address?.trim()      || null,
        address_note: r.address_note?.trim() || null,
        phone:        r.phone?.trim()        || null,
        website:      r.website?.trim()      || null,
        tags:         Array.isArray(r.tags) ? r.tags : [],
        latitude:  lat,
        longitude: lng,
        location:  `SRID=4326;POINT(${lng} ${lat})`,
        is_emergency: Boolean(r.is_emergency),
        status:    'approved',
        added_by:  user.id,
      });
    }

    let inserted = 0;
    if (insertable.length > 0) {
      const { data, error } = await supabase.from('pois').insert(insertable).select('id');
      if (error) {
        console.error('[admin/poi/POST] Insert error:', error);
        return NextResponse.json({ success: false, error: 'Kayıt hatası: ' + error.message }, { status: 500 });
      }
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      inserted,
      errors,
      message: `${inserted} konum eklendi.${errors.length > 0 ? ` ${errors.length} satır hatalı.` : ''}`,
    }, { status: 201 });
  } catch (err) {
    console.error('[admin/poi/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
