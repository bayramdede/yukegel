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
      // Bu oturum emekli (merge edilmiş) bir kayda ait. Magic-link ile canlı hesaba
      // geçirmek SSR cookie'lerini güncellemediği için SONSUZ DÖNGÜ yaratıyordu
      // (localStorage yeni hesaba geçiyor, cookie eski oturumda kalıyor → proxy tekrar
      // buraya atıyor). Çözüm: ölü oturumun sb- cookie'lerini TEMİZLE ve temiz giriş
      // ekranına gönder. Kullanıcı Google ile yeniden girer (PKCE → /auth/callback →
      // cookie doğru set edilir → /panel).
      const clearResponse = NextResponse.redirect(new URL('/giris?hesap=tasindi', request.url));
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-')) clearResponse.cookies.delete(name);
      });
      return clearResponse;
    }

    if (profil?.role === 'admin' || profil?.role === 'moderator') {
      return supabaseResponse;
    }

    if (!profil?.user_type) {
      // Bu auth kimliğinin tamamlanmış satırı yok. Ama kullanıcının aynı e-posta/telefonla
      // KAYITLI (tamamlanmış) başka bir hesabı olabilir — ör. Google ile kayıtlı, şimdi ayrı
      // bir telefon (SMS OTP) auth kimliğiyle gelmiş (farklı auth.uid, users satırı yok).
      // Böyle bir durumda profil-tamamla'ya atmak DUPLICATE hesap/döngü yaratır; bunun yerine
      // girişe gönder, orada oturum otomatik canlı hesaba bağlanır (merge/switch self-heal).
      const eslesmeKosullari: string[] = [];
      if (user.email) eslesmeKosullari.push(`email.eq.${user.email}`);
      if (user.phone) {
        const p = user.phone.replace(/\D/g, '');
        const yerel = p.startsWith('90') ? '0' + p.slice(2) : p;
        const kisa  = p.startsWith('90') ? p.slice(2) : p;
        for (const t of new Set([p, `+${p}`, yerel, kisa])) eslesmeKosullari.push(`phone.eq.${t}`);
      }
      if (eslesmeKosullari.length > 0) {
        const { data: canliHesaplar } = await supabase
          .from('users')
          .select('user_type')
          .or(eslesmeKosullari.join(','))
          .is('merged_into', null)
          .neq('id', user.id)
          .limit(1);
        if (canliHesaplar?.[0]?.user_type) {
          return NextResponse.redirect(new URL('/giris?hesap=eslesme', request.url));
        }
      }

      // Gerçekten yeni/eksik profil — tamamlama ekranına gönder
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
