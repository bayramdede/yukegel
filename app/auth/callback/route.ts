import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
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
      const { data: profil } = await supabase
        .from('users')
        .select('user_type, role, email')
        .eq('id', user.id)
        .single()

      const role = (profil as any)?.role || 'user'

      // Admin / moderator → direkt yönlendir
      if (role === 'admin') return NextResponse.redirect(`${origin}/admin`)
      if (role === 'moderator') return NextResponse.redirect(`${origin}/moderator`)

      // Normal kullanıcı: profil tamamlanmamışsa tamamla sayfasına
      if (!profil?.user_type) {
        return NextResponse.redirect(`${origin}/profil-tamamla`)
      }

      // Gmail ile giriş — bu email başka bir users kaydında telefon ile kayıtlı mı?
      // (merge senaryosu: önce telefonla kayıt, sonra gmail ile giriş)
      if (user.email) {
        const { data: eskiProfil } = await supabase
          .from('users')
          .select('id, display_name, phone')
          .eq('email', user.email)
          .eq('is_active', true)
          .neq('id', user.id)
          .maybeSingle()

        if (eskiProfil) {
          // Merge gerekiyor — query param ile giris sayfasına yönlendir
          const params = new URLSearchParams({
            merge_user_id: eskiProfil.id,
            merge_name: eskiProfil.display_name || '',
          })
          return NextResponse.redirect(`${origin}/giris/merge?${params}`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
