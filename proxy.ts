import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { logPhoneAccess } from './lib/logger'
import { REDIRECT_COOKIE, REDIRECT_COOKIE_MAX_AGE, guvenliRedirect } from './lib/redirect'

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
  '/moderator-giris',
];

const KORUNMALI = ['/panel', '/ilan-ver', '/araclarim', '/profil', '/moderator'];

// DİKKAT: düz `startsWith` kullanma. `/moderator-giris` gibi KARDEŞ rotalar `/moderator`
// prefix'ine takılıp yanlışlıkla kilitleniyordu — oturumsuz moderatör kendi giriş ekranına
// ulaşamıyordu (bkz. docs/SPRINT_01.md M1). Aynı tuzak `/profil` ↔ `/profil-tamamla` için de
// geçerli. Segment sınırında eşleştir: tam eşleşme veya `kok + '/'`.
function korunmaliMi(pathname: string): boolean {
  return KORUNMALI.some(kok => pathname === kok || pathname.startsWith(kok + '/'));
}

/**
 * SPRINT_01 A7 — /giris URL'i üret, kullanıcının gitmek istediği yeri KAYBETME.
 *
 * Eskiden üç ayrı yerde elle URL kuruluyordu ve ikisi (`?hesap=tasindi`,
 * `?hesap=eslesme`) redirect'i tamamen düşürüyordu: kullanıcı `/ilan-ver`'e
 * tıklıyor, hesap birleştirme akışından geçiyor, sonunda anasayfaya bırakılıyordu.
 * Üçüncüsü de `pathname`'i encode etmiyordu — query string'li yollar (`/panel?sekme=ilanlar`)
 * bozuluyordu.
 */
function girisYonlendir(request: NextRequest, hesap?: 'tasindi' | 'eslesme'): NextResponse {
  const { pathname, search } = request.nextUrl;
  const url = new URL('/giris', request.url);
  const hedef = guvenliRedirect(pathname + search);
  if (hedef) url.searchParams.set('redirect', hedef);
  if (hesap) url.searchParams.set('hesap', hesap);

  const yanit = NextResponse.redirect(url);
  // Query param Google OAuth / magic-link zincirinde kayboluyor; cookie sağ çıkar.
  // httpOnly DEĞİL: /giris sayfası client tarafında da okuyup temizliyor.
  // Değer `guvenliRedirect`'ten geçmiş göreli bir yol, hassas veri değil.
  if (hedef) {
    yanit.cookies.set(REDIRECT_COOKIE, hedef, {
      path: '/',
      maxAge: REDIRECT_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }
  return yanit;
}

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

  if (!user && korunmaliMi(pathname)) {
    return girisYonlendir(request);
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
      // SPRINT_01 A10 — burası eskiden sb- cookie'lerini silip `/giris?hesap=tasindi`'ye
      // atıyordu. Ama kullanıcı hep aynı kimlikle (ör. telefon OTP) geri geldiği için
      // yine bu satıra düşüyordu: SONSUZ DÖNGÜ, çıkışı olmayan bir giriş ekranı.
      //
      // Yeni davranış: `/auth/devir` oturumu SUNUCUDA canlı hesaba geçirir
      // (service-role + magic-link `hashed_token` + `verifyOtp` → cookie'ler yazılır).
      //
      // ⚠️ COOKIE'LERİ BURADA SİLME. Devir route'u, devri yetkilendirmek için emekli
      // oturumu okumak zorunda; cookie'ler silinirse `getUser()` null döner ve kullanıcı
      // yine girişte kalır. Devir başarısız olursa temizliği o route yapar.
      const devirUrl = new URL('/auth/devir', request.url);
      const devirHedef = guvenliRedirect(pathname + request.nextUrl.search);
      if (devirHedef) devirUrl.searchParams.set('redirect', devirHedef);
      return NextResponse.redirect(devirUrl);
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
        // 🚨 8 Ağu 2026 — SERVİS ROLÜ ZORUNLU. `phone`/`email` 7 Ağu'daki güvenlik
        // düzeltmesinden sonra `authenticated`'in SELECT yetkisinde değil — bu
        // sütunlar bir `.or()` FİLTRESİNDE geçse bile (hiç SELECT listesinde
        // olmasalar da) Postgres değerlendirme için okuma yetkisi ister ve
        // `authenticated` client'ıyla `42501 permission denied` ile patlardı.
        // Sonuç canlıda GERÇEKTEN yaşandı: bu sorgu sessizce hata verip
        // `canliHesaplar` boş kaldığı için HER kullanıcı (eşleşen canlı hesabı
        // olsa bile) "gerçekten yeni profil" dalına düşüp profil-tamamla'ya
        // yönlendiriliyordu — giriş tamamen kilitlendi.
        // Servis rolü burada güvenli: yalnız BU oturumun kendi email/telefonuyla
        // eşleşen (`user.email`/`user.phone` zaten Supabase Auth'un doğruladığı
        // değerler) başka bir hesabı arıyor, sonucu istemciye asla göstermiyor —
        // yalnız yönlendirme kararı için `user_type` boolean'a indirgeniyor.
        const svc = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: canliHesaplar } = await svc
          .from('users')
          .select('user_type')
          .or(eslesmeKosullari.join(','))
          .is('merged_into', null)
          .neq('id', user.id)
          .limit(1);
        if (canliHesaplar?.[0]?.user_type) {
          return girisYonlendir(request, 'eslesme');
        }
      }

      // Gerçekten yeni/eksik profil — tamamlama ekranına gönder
      logPhoneAccess({
        viewerId: user.id,
        profileCompleted: false,
      })
      // SPRINT_01 A7 — query string de korunsun (`/panel?sekme=ilanlar` gibi).
      const ptUrl = new URL('/profil-tamamla', request.url);
      ptUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(ptUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
