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

  const izinliAlanlar = ['role', 'is_active', 'moderator_sources', 'ai_listing_quota_daily']
  if (!izinliAlanlar.includes(alan)) {
    return NextResponse.json({ error: 'Geçersiz alan' }, { status: 400 })
  }

  // ai_listing_quota_daily için tip kontrolü: null veya non-negative integer
  let normalizedDeger: any = deger
  if (alan === 'ai_listing_quota_daily') {
    if (deger === null || deger === '' || deger === undefined) {
      normalizedDeger = null
    } else {
      const n = Number(deger)
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return NextResponse.json({ error: 'Limit sıfır veya pozitif tam sayı olmalı (boş bırakırsan sistem varsayılanı kullanılır).' }, { status: 400 })
      }
      normalizedDeger = n
    }
  }

  const service = getServiceSupabase()

  const { error } = await service
    .from('users')
    .update({ [alan]: normalizedDeger })
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
