import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// Yalnızca bu hostname'lere izin ver — SSRF koruması
const IZINLI_DOMAINLER = [
  'goo.gl',
  'maps.app.goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
];

function domainIzinli(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return IZINLI_DOMAINLER.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/resolve-url
// Kısa Google Maps linkini takip ederek gerçek URL'yi döndürür.
// Body: { url: string }
// Response: { success: true, url: string }
// ─────────────────────────────────────────────
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
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL gerekli.' }, { status: 400 });
    }

    if (!domainIzinli(url)) {
      return NextResponse.json(
        { success: false, error: 'Yalnızca Google Maps linkleri desteklenir.' },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yükegel-Admin/1.0)' },
      signal: AbortSignal.timeout(8000),
    });

    // Redirect sonrası URL'nin de izin verilen bir domain'de olduğunu doğrula
    if (!domainIzinli(res.url)) {
      return NextResponse.json(
        { success: false, error: 'Redirect hedefi güvenilir bir Google Maps URL değil.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, url: res.url });
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : '';
    const timeoutHata = mesaj.includes('abort') || mesaj.includes('timeout');
    return NextResponse.json(
      { success: false, error: timeoutHata ? 'Link yanıt vermedi (zaman aşımı).' : 'Link çözülemedi.' },
      { status: 502 }
    );
  }
}
