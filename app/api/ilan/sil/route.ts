import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export async function DELETE(req: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

    const svc = getServiceSupabase();

    // Sahiplik kontrolü
    const { data: ilan } = await svc
      .from('listings')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
    if (ilan.user_id !== user.id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

    // Önce durağları, sonra ilanı sil
    await svc.from('listing_stops').delete().eq('listing_id', id);
    const { error } = await svc.from('listings').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
