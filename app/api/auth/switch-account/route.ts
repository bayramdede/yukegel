import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth'

// Telefon OTP ile giriş yapmış ama merged_into'su olan kullanıcıyı
// asıl hesabına (keepUserId) magic link ile geçirir
export async function POST(request: Request) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const service = getServiceSupabase()

    // Bu kullanıcının merged_into'sunu bul
    const { data: profil } = await service
      .from('users').select('merged_into').eq('id', user.id).single()

    const hedefId = profil?.merged_into
    if (!hedefId) return NextResponse.json({ error: 'Merge yok' }, { status: 400 })

    // Hedef kullanıcının email'ini al
    const { data: hedefAuth } = await service.auth.admin.getUserById(hedefId)
    const hedefEmail = hedefAuth?.user?.email
    if (!hedefEmail) return NextResponse.json({ error: 'Email bulunamadı' }, { status: 400 })

    // Request origin'den callback URL oluştur
    const origin = new URL(request.url).origin
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: hedefEmail,
      options: { redirectTo: `${origin}/auth/callback` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: 'Link oluşturulamadı' }, { status: 500 })
    }

    return NextResponse.json({ redirectUrl: linkData.properties.action_link })
  } catch (err) {
    console.error('switch-account hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
