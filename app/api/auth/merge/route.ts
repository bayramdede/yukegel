import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth'

export async function POST(request: Request) {
  try {
    const { keepUserId, mergeUserId } = await request.json()

    if (!keepUserId || !mergeUserId) {
      return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 })
    }

    // Oturum kontrolü: mevcut kullanıcı keepUserId veya mergeUserId olmalı
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || (user.id !== keepUserId && user.id !== mergeUserId)) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const service = getServiceSupabase()

    // 1. İlanları taşı
    await service.from('listings').update({ user_id: keepUserId }).eq('user_id', mergeUserId)

    // 2. Araçları taşı
    await service.from('vehicles').update({ user_id: keepUserId }).eq('user_id', mergeUserId)

    // 3. Eski profilin eksik alanlarını yeni profile aktar
    const { data: eskiProfil } = await service.from('users').select('*').eq('id', mergeUserId).single()
    const { data: yeniProfil } = await service.from('users').select('*').eq('id', keepUserId).single()

    if (yeniProfil) {
      const guncelleme: Record<string, unknown> = {}
      const aktarilacaklar = ['display_name', 'company_name', 'tckn', 'vkn', 'bio', 'username', 'phone', 'phone_verified', 'user_type'] as const
      if (eskiProfil) {
        for (const alan of aktarilacaklar) {
          if (!yeniProfil[alan] && eskiProfil[alan]) guncelleme[alan] = eskiProfil[alan]
        }
      }
      const eskiProviders: string[] = eskiProfil?.auth_providers || []
      const yeniProviders: string[] = yeniProfil.auth_providers || []
      guncelleme.auth_providers = [...new Set([...yeniProviders, ...eskiProviders, 'phone'])]
      if (Object.keys(guncelleme).length > 0) {
        await service.from('users').update(guncelleme).eq('id', keepUserId)
      }
    }

    // 4. Telefon OTP user'ını pasife al (yoksa oluştur)
    await service.from('users').upsert({
      id: mergeUserId,
      is_active: false,
      merged_into: keepUserId,
      role: 'user',
    }, { onConflict: 'id' })

    // 5. keepUserId'nin auth bilgilerini al ve magic link oluştur
    const { data: keepAuthUser } = await service.auth.admin.getUserById(keepUserId)
    const keepEmail = keepAuthUser?.user?.email

    if (keepEmail) {
      const origin = new URL(request.url).origin
      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
        type: 'magiclink',
        email: keepEmail,
        options: { redirectTo: `${origin}/auth/callback` },
      })
      if (!linkError && linkData?.properties?.action_link) {
        return NextResponse.json({ success: true, redirectUrl: linkData.properties.action_link })
      }
    }

    return NextResponse.json({ success: true, redirectUrl: '/panel' })
  } catch (err) {
    console.error('Merge hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
