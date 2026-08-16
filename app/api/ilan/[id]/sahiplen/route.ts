import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../../lib/auth'
// SPRINT_01 G2 — ilan başına 60 sn yetmiyordu: bir saldırgan FARKLI ilan id'leriyle
// dolaşıp her birine ayrı ayrı SMS attırabiliyordu (her ilan kendi sayacında).
// IP bazlı kota bu dolaşmayı kesiyor.
import { istekIp, kotaDene } from '../../../../../lib/kota'

/**
 * SPRINT_01 L1d — ilan sahiplenme akışının sunucu tarafı.
 *
 * ESKİ HALİ NEDEN SIZINTIYDI:
 *   /ilan/[id]/sahiplen sayfası `'use client'` + anon key ile `contact_phone`'u çekip
 *   ekranda TAM olarak yazıyordu. Sayfa herkese açık ve id tahmin edilebilir; yani
 *   sahiplenilmemiş her ilanın numarası tek istekle okunabiliyordu.
 *
 * YENİ HALİ:
 *   Numara istemciye HİÇ gitmez. Önizlemede maskeli gösterilir, OTP gönderimi ve
 *   doğrulaması burada yapılır. Doğrulama SSR client ile çalıştığı için oturum
 *   cookie'si de doğru set olur (istemcideki verifyOtp yalnız localStorage'ı
 *   güncelliyordu — dokümante edilmiş proxy döngüsü riski).
 */

/**
 * SPRINT_01 A4b — SMS gönderimine bekleme süresi.
 *
 * Eski hali: `{ adim: 'gonder' }` isteği sınırsızdı. Sahiplenilmemiş bir ilanın
 * id'sini bilen herkes bu endpoint'e döngüyle vurup ilandaki numaraya sınırsız SMS
 * attırabiliyordu — hem Twilio faturası, hem numara sahibine taciz.
 *
 * Artık ilan başına 60 sn. Bellek içi (tek instance varsayımı); kalıcı çözüm için
 * Redis/DB gerekir ama bu haliyle bile kör döngüyü kesiyor.
 */
const OTP_BEKLEME_MS = 60_000
const otpSonGonderim = new Map<string, number>()
// 17 Ağu 2026 — docs/YAPILACAKLAR.md md.3: gönderim (`adim:'gonder'`) kotalıydı
// (yukarıdaki `otpSonGonderim` + IP kotası), `verifyOtp`in KENDİSİ ('dogrula')
// hiçbir sunucu sayacından geçmiyordu — ilan id'sini bilen biri sınırsız kod
// deneyebilirdi. İlan başına VE IP başına iki katman (aynı desen: `otp-ip-numara`).
const DOGRULAMA_DENEME_LIMIT = 5
const DOGRULAMA_IP_LIMIT = 20
const DOGRULAMA_PENCERE_MS = 10 * 60 * 1000

function beklemeKalan(anahtar: string): number {
  const simdi = Date.now()
  // Sızıntıyı önle: süresi dolmuş kayıtları ara sıra temizle.
  if (otpSonGonderim.size > 500) {
    for (const [k, v] of otpSonGonderim) if (simdi - v > OTP_BEKLEME_MS) otpSonGonderim.delete(k)
  }
  const son = otpSonGonderim.get(anahtar)
  if (!son) return 0
  return Math.max(0, Math.ceil((OTP_BEKLEME_MS - (simdi - son)) / 1000))
}

function telefonNormalize(ham: string): string {
  const rakam = ham.replace(/\D/g, '')
  if (rakam.startsWith('90')) return `+${rakam}`
  if (rakam.startsWith('0')) return `+9${rakam}`
  return `+90${rakam}`
}

function maskele(ham: string): string {
  const rakam = ham.replace(/\D/g, '')
  const son = rakam.slice(-2)
  const ilk = rakam.length >= 10 ? rakam.slice(-10, -7) : ''
  return `0${ilk} *** ** ${son}`
}

/** İlanı çeker ve sahiplenmeye uygun mu kontrol eder. */
async function ilanGetir(id: string) {
  const service = getServiceSupabase()
  const { data } = await service
    .from('listings')
    .select('id, contact_phone, user_id, status, is_shadow_banned, moderation_status')
    .eq('id', id)
    .maybeSingle()

  if (!data) return { hata: 'İlan bulunamadı', kod: 404 as const }
  // Zaten sahiplenilmiş → numara verilmez, OTP gönderilmez.
  if (data.user_id) return { hata: 'Bu ilan zaten sahiplenilmiş', kod: 409 as const }
  if (data.status !== 'active' || data.is_shadow_banned === true ||
      !['approved', 'auto_published'].includes(data.moderation_status)) {
    return { hata: 'İlan bulunamadı', kod: 404 as const }
  }
  if (!data.contact_phone) return { hata: 'Bu ilanda telefon yok', kod: 404 as const }
  return { ilan: data }
}

// GET → maskeli numara + uygunluk. Tam numara ASLA dönmez.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const sonuc = await ilanGetir(id)
    if ('hata' in sonuc) {
      return NextResponse.json({ error: sonuc.hata }, { status: sonuc.kod })
    }
    return NextResponse.json(
      { maskeliTelefon: maskele(sonuc.ilan!.contact_phone!) },
      { headers: { 'Cache-Control': 'no-store, private' } }
    )
  } catch (err) {
    console.error('sahiplen GET hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

// POST { adim: 'gonder' } → SMS gönder
// POST { adim: 'dogrula', kod } → doğrula + sahiplen
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { adim, kod } = await request.json()
    const sonuc = await ilanGetir(id)
    if ('hata' in sonuc) {
      return NextResponse.json({ error: sonuc.hata }, { status: sonuc.kod })
    }
    const telefon = telefonNormalize(sonuc.ilan!.contact_phone!)
    const supabase = await getServerSupabase()

    if (adim === 'gonder') {
      const kalan = beklemeKalan(id)
      if (kalan > 0) {
        return NextResponse.json(
          { error: `Yeni kod istemek için ${kalan} saniye bekleyin.`, kalan },
          { status: 429, headers: { 'Retry-After': String(kalan) } }
        )
      }
      // SPRINT_01 G2 — IP başına saatte 5 farklı numara. `sayma: true` → sadece bakar,
      // SMS gerçekten gidene kadar kotayı yakmaz.
      const ip = istekIp(request)
      const ipKota = kotaDene({
        ad: 'otp-ip-numara', anahtar: ip, limit: 5, pencereMs: 60 * 60 * 1000,
        deger: telefon, sayma: true,
      })
      if (!ipKota.izinli) {
        return NextResponse.json(
          { error: 'Çok fazla farklı numaraya kod istendi. Bir süre sonra tekrar deneyin.', kalan: ipKota.bekleSn },
          { status: 429, headers: { 'Retry-After': String(ipKota.bekleSn) } }
        )
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: telefon })
      if (error) {
        console.error('sahiplen OTP gönderilemedi:', error.message)
        return NextResponse.json({ error: 'SMS gönderilemedi. Lütfen tekrar deneyin.' }, { status: 502 })
      }
      // Sayaçları yalnızca SMS GERÇEKTEN gittiyse işle; sağlayıcı hatası kullanıcıyı kilitlemesin.
      otpSonGonderim.set(id, Date.now())
      // `/api/auth/otp` ile AYNI kova ('otp-ip-numara'): iki uç nokta arasında gidip gelerek
      // kotayı ikiye katlamak mümkün olmasın.
      kotaDene({ ad: 'otp-ip-numara', anahtar: ip, limit: 5, pencereMs: 60 * 60 * 1000, deger: telefon })
      return NextResponse.json({ success: true, bekleme: OTP_BEKLEME_MS / 1000 })
    }

    if (adim !== 'dogrula') {
      return NextResponse.json({ error: 'Geçersiz adım' }, { status: 400 })
    }
    if (!kod || String(kod).length < 4) {
      return NextResponse.json({ error: 'Kod eksik' }, { status: 400 })
    }

    // Doğrulama denemesi kotası — `verifyOtp`den ÖNCE. Kod yanlış girilse
    // bile deneme sayılır. İki katman: ilan başına + IP başına (bir saldırgan
    // FARKLI ilan id'leri gezerek ilan-bazlı kotayı atlatamasın).
    const ip = istekIp(request)
    const ilanKota = kotaDene({
      ad: 'sahiplen-dogrula-ilan', anahtar: id, limit: DOGRULAMA_DENEME_LIMIT, pencereMs: DOGRULAMA_PENCERE_MS,
    })
    if (!ilanKota.izinli) {
      return NextResponse.json(
        { error: 'Çok fazla hatalı kod denemesi. Yeni bir kod isteyin.', kalan: ilanKota.bekleSn },
        { status: 429, headers: { 'Retry-After': String(ilanKota.bekleSn) } }
      )
    }
    const ipKota2 = kotaDene({
      ad: 'sahiplen-dogrula-ip', anahtar: ip, limit: DOGRULAMA_IP_LIMIT, pencereMs: DOGRULAMA_PENCERE_MS,
    })
    if (!ipKota2.izinli) {
      return NextResponse.json(
        { error: 'Çok fazla doğrulama denemesi. Bir süre sonra tekrar deneyin.', kalan: ipKota2.bekleSn },
        { status: 429, headers: { 'Retry-After': String(ipKota2.bekleSn) } }
      )
    }

    // SSR client ile doğrula → oturum cookie'si de set olur.
    const { data: authData, error: otpHata } = await supabase.auth.verifyOtp({
      phone: telefon, token: String(kod), type: 'sms',
    })
    if (otpHata || !authData?.user) {
      return NextResponse.json({ error: 'Kod hatalı veya süresi dolmuş.' }, { status: 401 })
    }

    const service = getServiceSupabase()

    // `.is('user_id', null)` — yarış durumunda ikinci sahiplenmeyi engeller.
    const { data: guncellenen, error: updateHata } = await service
      .from('listings')
      .update({ user_id: authData.user.id, trust_level: 'verified', claimed_at: new Date().toISOString() })
      .eq('id', id)
      .is('user_id', null)
      .select('id')

    if (updateHata) {
      console.error('sahiplen update hatası:', updateHata)
      return NextResponse.json({ error: 'Sahiplenme sırasında bir hata oluştu.' }, { status: 500 })
    }
    if (!guncellenen || guncellenen.length === 0) {
      return NextResponse.json({ error: 'Bu ilan bu sırada başkası tarafından sahiplenildi.' }, { status: 409 })
    }

    const { data: mevcutProfil } = await service
      .from('users').select('id').eq('id', authData.user.id).maybeSingle()
    if (!mevcutProfil) {
      await service.from('users').insert({
        id: authData.user.id,
        phone: sonuc.ilan!.contact_phone,
        phone_verified: true,
        user_type: 'yuk_sahibi',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('sahiplen POST hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
