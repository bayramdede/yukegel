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

    // Kullanıcı profili tamamlanmış mı kontrol et
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profil } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single()

      if (!profil?.username) {
        return NextResponse.redirect(`${origin}/profil-tamamla`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}