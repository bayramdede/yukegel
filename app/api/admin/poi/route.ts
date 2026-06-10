import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

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

    const { data: pois, error } = await supabase
      .from('pois')
      .select('id, name, category, city, district, address, address_note, latitude, longitude, is_emergency, status, added_by, created_at')
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(100);

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
  category: string;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  address_note?: string | null;
  latitude: number;
  longitude: number;
  is_emergency?: boolean;
}

const VALID_CATS = ['park_dinlenme', 'yemek', 'konaklama', 'tamirci', 'tesis_akaryakit', 'kantar_resmi'];

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

      if (!r.name || !String(r.name).trim()) rowErrors.push('Ad zorunlu');
      if (!VALID_CATS.includes(r.category))    rowErrors.push('Geçersiz kategori');

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
        category:     r.category,
        city:         r.city?.trim()         || null,
        district:     r.district?.trim()     || null,
        address:      r.address?.trim()      || null,
        address_note: r.address_note?.trim() || null,
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
