import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../../lib/auth'
import { logPhoneAccess } from '../../../../../lib/logger'

/**
 * SPRINT_01 L1b — İlan sahibinin telefonunu YALNIZCA girişli + profili tamamlanmış
 * kullanıcıya döner.
 *
 * Neden ayrı endpoint: `app/page.tsx` ISR (revalidate=30) ile cache'leniyor, yani çıktı
 * tüm ziyaretçiler arasında PAYLAŞILIYOR. Telefonu oturuma göre koşullu render etmek
 * mümkün değil — cache ilk isteği kime verdiyse onu herkese servis eder. Bu yüzden
 * numara sayfa payload'ına HİÇ girmiyor, sadece buradan tek tek çekiliyor.
 *
 * Ayrıca her erişim `logPhoneAccess` ile denetim kaydına düşüyor (KVKK).
 */

// Basit bellek-içi kota: kullanıcı başına dakikada 20 numara.
// Not: Vercel'de her lambda örneği kendi Map'ini tutar; kesin sınır değil, sadece
// kaba kuvvet/kazıma denemesini yavaşlatır. Kalıcı çözüm için SPRINT_01 G1'e bak.
const KOTA_PENCERE_MS = 60_000
const KOTA_LIMIT = 20
const kotaSayaci = new Map<string, { adet: number; sifirlanma: number }>()

function kotaAsildi(userId: string): boolean {
  const simdi = Date.now()
  const kayit = kotaSayaci.get(userId)
  if (!kayit || simdi > kayit.sifirlanma) {
    kotaSayaci.set(userId, { adet: 1, sifirlanma: simdi + KOTA_PENCERE_MS })
    return false
  }
  kayit.adet += 1
  return kayit.adet > KOTA_LIMIT
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      logPhoneAccess({ viewerId: 'anonim', targetListingId: id, profileCompleted: false })
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const service = getServiceSupabase()

    // Profil tamamlanmamışsa telefon verilmez — profil-tamamla akışını atlayarak
    // numara kazımanın önüne geçer.
    const { data: profil } = await service
      .from('users')
      .select('user_type, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (!profil?.user_type) {
      logPhoneAccess({ viewerId: user.id, targetListingId: id, profileCompleted: false })
      return NextResponse.json(
        { error: 'Profilinizi tamamlayın', redirect: '/profil-tamamla' },
        { status: 403 }
      )
    }

    if (profil.is_active === false) {
      return NextResponse.json({ error: 'Hesap pasif' }, { status: 403 })
    }

    if (kotaAsildi(user.id)) {
      return NextResponse.json(
        { error: 'Çok fazla istek. Bir dakika sonra tekrar deneyin.' },
        { status: 429 }
      )
    }

    // İlan gerçekten yayında mı? (moderasyondan geçmemiş/banlı ilanın numarası sızmasın)
    const { data: ilan } = await service
      .from('listings')
      .select('contact_phone, status, is_shadow_banned, moderation_status')
      .eq('id', id)
      .maybeSingle()

    if (
      !ilan ||
      ilan.status !== 'active' ||
      ilan.is_shadow_banned === true ||
      !['approved', 'auto_published'].includes(ilan.moderation_status)
    ) {
      return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 })
    }

    if (!ilan.contact_phone) {
      return NextResponse.json({ error: 'Bu ilanda telefon yok' }, { status: 404 })
    }

    logPhoneAccess({ viewerId: user.id, targetListingId: id, profileCompleted: true })

    return NextResponse.json(
      { telefon: ilan.contact_phone },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch (err) {
    console.error('telefon endpoint hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
