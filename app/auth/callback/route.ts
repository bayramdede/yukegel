import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { structuredLog, maskIp } from '../../../lib/logger'
import { REDIRECT_COOKIE, guvenliRedirect } from '../../../lib/redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()

    // SPRINT_01 A7 — kullanıcı giriş öncesi nereye gitmek istiyordu?
    // Query param Google OAuth zincirinde hayatta kalmıyor; proxy bunu cookie'ye yazdı.
    const hedef = guvenliRedirect(cookieStore.get(REDIRECT_COOKIE)?.value)
    // Tek kullanımlık: bu istekte tüketiliyor, sonraki girişe sarkmasın.
    const yonlendir = (varsayilan: string) => {
      const yanit = NextResponse.redirect(`${origin}${hedef ?? varsayilan}`)
      if (hedef) yanit.cookies.delete(REDIRECT_COOKIE)
      return yanit
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // 🚨 8 Ağu 2026 — SERVİS ROLÜ ZORUNLU. `email`/`phone` 7 Ağu güvenlik
      // düzeltmesinden sonra `authenticated`'in SELECT yetkisinde değil (bkz.
      // `docs/20260807_guvenlik_kayit_giris.sql`). Bu route sunucuda çalışıyor,
      // oturum zaten `exchangeCodeForSession`ile doğrulanmış — servis rolü
      // burada RLS bypass DEĞİL, doğrulanmış tek bir kullanıcının kendi kaydını
      // ve (aşağıda) aynı e-postayla eşleşen başka bir hesabı arıyor, sonucu
      // istemciye asla ham göstermiyor.
      const svc = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // 21 Ağu 2026 — Google OAuth girişleri `auth_events`e HİÇ YAZILMIYORDU
      // (yalnız structuredLog/stdout'a düşüyordu, DB'de izi yoktu — OTP/e-posta
      // girişleri `/api/auth/log` ile yazarken bu yol hiç çağrılmamıştı, çünkü
      // istemci Google'dan döndüğünde bu route'a hiç uğramadan session'ı alıyor).
      // Fire-and-forget: `.then()` bekletilmiyor, giriş akışını bloklamaz.
      const xff = request.headers.get('x-forwarded-for')
      const ipHam = xff ? xff.split(',')[0].trim() : request.headers.get('x-real-ip')
      svc.from('auth_events').insert({
        event: 'login_success',
        method: 'google',
        user_id: user.id,
        ip_masked: ipHam ? maskIp(ipHam) : null,
        user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      }).then(({ error }) => {
        if (error) structuredLog('ERROR', 'auth', 'auth_events yazılamadı (google)', { supabase_error: error.message })
      })

      // maybeSingle() — yeni kayıtta users tablosunda henüz satır olmayabilir
      const { data: profil } = await svc
        .from('users')
        .select('user_type, role, email')
        .eq('id', user.id)
        .maybeSingle()

      const role = (profil as any)?.role || 'user'

      // Admin / moderator → direkt yönlendir
      if (role === 'admin') {
        structuredLog('INFO', 'auth', 'Başarılı giriş', { user_id: user.id, method: 'google', role: 'admin' })
        return yonlendir('/admin')
      }
      if (role === 'moderator') {
        structuredLog('INFO', 'auth', 'Başarılı giriş', { user_id: user.id, method: 'google', role: 'moderator' })
        return yonlendir('/moderator')
      }

      // Gmail ile giriş — bu email başka bir users kaydında (telefon veya eposta ile) zaten kayıtlı mı?
      // ÖNEMLİ: bu kontrol user_type kontrolünden ÖNCE çalışmalı — yoksa profili tamamlanmamış
      // (yeni auth id, eski eposta) kullanıcılar profil-tamamla'ya düşüp orada email unique
      // constraint'ine çarpıyordu (users_email_key).
      // is_active yerine merged_into kullanıyoruz: eski hesaplarda is_active hiç set edilmemiş olabilir (NULL).
      if (user.email) {
        const { data: eskiProfil } = await svc
          .from('users')
          .select('id, display_name, phone')
          .eq('email', user.email)
          .is('merged_into', null)
          .neq('id', user.id)
          .maybeSingle()

        if (eskiProfil) {
          // SPRINT_01 A2 — burası `/giris/merge` adresine yönlendiriyordu ama o sayfa hiç
          // yazılmamıştı: aynı e-postayla eski kaydı olan herkes Google girişinde 404 alıp
          // tamamen kilitleniyordu. `/giris` sayfasında zaten çalışan bir `merge_onay` modu
          // var; onu paramlarla tetikliyoruz (yeni route/RLS yüzeyi açmadan).
          const params = new URLSearchParams({
            merge_user_id: eskiProfil.id,
            merge_name: eskiProfil.display_name || '',
            merge_email: user.email,
          })
          structuredLog('INFO', 'auth', 'Merge onayı isteniyor', {
            user_id: user.id, method: 'google', eski_user_id: eskiProfil.id,
          })
          return NextResponse.redirect(`${origin}/giris?${params}`)
        }
      }

      // Profil tamamlanmamış (yeni kayıt) → profil-tamamla.
      // SPRINT_01 A7 — cookie'yi BURADA TÜKETME; kullanıcının asıl hedefi profil
      // tamamlandıktan sonra kullanılacak. Query param'a da yaz ki tek kaynağa bağlı kalmasın.
      if (!profil?.user_type) {
        const ptUrl = new URL('/profil-tamamla', origin)
        if (hedef) ptUrl.searchParams.set('redirect', hedef)
        return NextResponse.redirect(ptUrl)
      }

      // Normal kullanıcı, profil tamam → hedefine (yoksa panele) yönlendir
      structuredLog('INFO', 'auth', 'Başarılı giriş', { user_id: user.id, method: 'google', role: 'user' })
      return yonlendir('/panel')
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
