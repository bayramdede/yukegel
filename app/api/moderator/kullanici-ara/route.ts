import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

// POST /api/moderator/kullanici-ara
// Body: { id: string } → tek kullanıcı (tam eşleşme)
//    ya: { arama: string, tip: 'phone' | 'email' } → arama (ilk 5 sonuç)
//
// 🚨 8 Ağu 2026 — `app/moderator/page.tsx`teki omnisearch (kullanıcı ara) ve
// `duzenleAc()`teki "ilan sahibi bilgisi" paneli eskiden İSTEMCİDEN
// (`authenticated` rolüyle) doğrudan `users.phone`/`email` okuyordu. 7 Ağu
// güvenlik düzeltmesi bu kolonların herkese açık SELECT yetkisini kaldırdı
// (bkz. `docs/20260807_guvenlik_kayit_giris.sql`) — moderatör paneli de
// kırıldı. Bu tam olarak CLAUDE.md'nin "RLS bypass → sadece admin/mod
// doğrulandıktan sonra `getServiceSupabase()`" kuralının kapsadığı durum;
// eskiden bu kural burada uygulanmamıştı. Şimdi uygulanıyor.
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    const { data: profil } = await ssrClient.from('users').select('role').eq('id', user.id).single();
    const role = (profil as any)?.role;
    if (role !== 'moderator' && role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
    }

    const body = await request.json();
    const svc = getServiceSupabase();
    const KOLONLAR = 'id, display_name, phone, email, role, is_active, user_type, created_at';

    if (body?.id) {
      const { data } = await svc.from('users').select(KOLONLAR).eq('id', body.id).maybeSingle();
      return NextResponse.json({ kullanici: data ?? null });
    }

    const arama = (body?.arama ?? '').trim();
    const tip = body?.tip;
    if (!arama || (tip !== 'phone' && tip !== 'email')) {
      return NextResponse.json({ error: 'Geçersiz parametre' }, { status: 400 });
    }

    let query = svc.from('users').select(KOLONLAR);
    if (tip === 'phone') {
      const digits = arama.replace(/\D/g, '').slice(-10);
      query = query.ilike('phone', `%${digits}`);
    } else {
      query = query.ilike('email', `%${arama}%`);
    }
    const { data } = await query.limit(5);
    return NextResponse.json({ kullanicilar: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sunucu hatası' }, { status: 500 });
  }
}
