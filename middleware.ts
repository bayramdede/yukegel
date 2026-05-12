// middleware.ts — Supabase session yenileme + geçersiz token temizleme
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    // Session'ı yenile — geçerliyse cookie güncellenir
    await supabase.auth.getUser();
  } catch (err: unknown) {
    const isRefreshError =
      err instanceof Error &&
      (err.message.includes('refresh_token_not_found') ||
        err.message.includes('Invalid Refresh Token'));

    if (isRefreshError) {
      // Geçersiz token cookie'lerini temizle
      const clearResponse = NextResponse.next({
        request: { headers: request.headers },
      });
      // sb- prefix ile başlayan tüm auth cookie'lerini temizle
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-')) {
          clearResponse.cookies.delete(name);
        }
      });
      return clearResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar ve _next hariç tüm rotalar
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
