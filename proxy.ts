import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { logPhoneAccess } from './lib/logger'

const ACIK_ROTALAR = [
  '/giris',
  '/auth/',
  '/profil-tamamla',
  '/_next/',
  '/api/',
  '/favicon',
  '/logo',
  '/nasil-calisir',
  '/hakkimizda',
  '/kvkk',
  '/kullanim-kosullari',
];

const KORUNMALI = ['/panel', '/ilan-ver', '/araclarim', '/profil', '/moderator'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    ACIK_ROTALAR.some(r => pathname.startsWith(r)) ||
    pathname.match(/\.(svg|png|jpg|ico|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Geçersiz/süresi dolmuş refresh token — cookie'leri temizle
      if (
        error.message.includes('refresh_token_not_found') ||
        error.message.includes('Invalid Refresh Token') ||
        error.status === 400
      ) {
        const clearResponse = NextResponse.next({ request });
        request.cookies.getAll().forEach(({ name }) => {
          if (name.startsWith('sb-')) clearResponse.cookies.delete(name);
        });
        return clearResponse;
      }
    }
    user = data?.user ?? null;
  } catch {
    user = null;
  }

  if (!user && KORUNMALI.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL(`/giris?redirect=${pathname}`, request.url));
  }

  if (user) {
    const { data: profil } = await supabase
      .from('users')
      .select('user_type, role, merged_into')
      .eq('id', user.id)
      .maybeSingle();

    // Bu oturum başka bir hesaba merge edilmiş (emekli) bir kayda ait.
    // Böyle bir satırda user_type NULL'dır (merge upsert'i sadece is_active/merged_into set eder) —
    // aşağıdaki user_type kontrolüne bırakılırsa kullanıcı SONSUZ profil-tamamla döngüsüne girer.
    // Bunun yerine giriş sayfasına gönder; orada oturum otomatik canlı hesaba geçirilir (switch-account).
    if (profil?.merged_into) {
      return NextResponse.redirect(new URL('/giris?hesap=tasindi', request.url));
    }

    if (profil?.role === 'admin' || profil?.role === 'moderator') {
      return supabaseResponse;
    }

    if (!profil?.user_type) {
      // Profil tamamlanmamış kullanıcı korumalı rotaya girmeye çalışıyor — WARN
      logPhoneAccess({
        viewerId: user.id,
        profileCompleted: false,
      })
      return NextResponse.redirect(new URL(`/profil-tamamla?redirect=${encodeURIComponent(pathname)}`, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
