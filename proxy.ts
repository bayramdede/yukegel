import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && KORUNMALI.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL(`/giris?redirect=${pathname}`, request.url));
  }

  if (user) {
    const { data: profil } = await supabase
      .from('users')
      .select('user_type, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profil?.role === 'admin' || profil?.role === 'moderator') {
      return supabaseResponse;
    }

    if (!profil?.user_type) {
      return NextResponse.redirect(new URL('/profil-tamamla', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
