import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '../../../../lib/auth';

// Service role client (RLS bypass — admin işlemleri için)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Link listesi (admin/moderatör)
export async function GET(request: NextRequest) {
  const ssrClient = await getServerSupabase();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { data: dbUser } = await ssrClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!dbUser || !['admin', 'moderator'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get('status')   || 'pending_review';
  const category = searchParams.get('category') || '';
  const page     = parseInt(searchParams.get('page') || '1', 10);
  const limit    = 50;
  const offset   = (page - 1) * limit;

  const service = getServiceClient();
  let query = service
    .from('archived_links')
    .select('*, raw_posts(raw_text, message_date)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}

// PATCH: Durum güncelle (admin/moderatör)
// Body: { id: string, status: 'approved' | 'rejected', notes?: string }
export async function PATCH(request: NextRequest) {
  const ssrClient = await getServerSupabase();
  const { data: { user } } = await ssrClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Yetkisiz.' }, { status: 401 });

  const { data: dbUser } = await ssrClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!dbUser || !['admin', 'moderator'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Yetkisiz.' }, { status: 403 });
  }

  const body = await request.json();
  const { id, status, notes } = body;

  if (!id || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Geçersiz parametre.' }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service
    .from('archived_links')
    .update({
      status,
      notes: notes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
