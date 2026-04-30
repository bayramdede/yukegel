import { NextResponse } from 'next/server'
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth'

export async function PATCH(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const { id, alan, deger } = await request.json()
  if (!id || !alan) return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 })

  const izinliAlanlar = ['role', 'is_active', 'moderator_sources']
  if (!izinliAlanlar.includes(alan)) {
    return NextResponse.json({ error: 'Geçersiz alan' }, { status: 400 })
  }

  const service = getServiceSupabase()

  const { error } = await service
    .from('users')
    .update({ [alan]: deger })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Kullanıcı pasife alındıysa oturumunu anında sonlandır
  if (alan === 'is_active' && deger === false) {
    try {
      await service.auth.admin.signOut(id)
    } catch (_) {
      // Oturum zaten yoksa sorun değil
    }
  }

  return NextResponse.json({ success: true })
}
