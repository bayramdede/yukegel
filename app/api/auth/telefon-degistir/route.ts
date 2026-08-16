import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth'
import { istekIp, kotaDene } from '../../../../lib/kota'
import { structuredLog } from '../../../../lib/logger'

/**
 * Panelde telefon numarası DEĞİŞTİRME — ARTIK SUNUCUDA (Güvenlik takibi, 7 Ağu
 * açıldı — 11 Ağu kapandı).
 *
 * ESKİ HALİ NEDEN AÇIKTI:
 *   `app/panel/PanelClient.tsx` OTP doğrulandıktan SONRA istemciden doğrudan
 *   `supabase.from('users').update({ phone, phone_verified: true })` çağırıyordu.
 *   Dürüst akışta bu satır gerçekten `verifyOtp` başarılı olduktan sonra çalışıyordu,
 *   ama saldırganın o akışı TAKİP ETME zorunluluğu yoktu: aynı authenticated
 *   oturumla, OTP'siz, PostgREST'e doğrudan aynı `update`i atabiliyordu — kolon
 *   istemciden yazılabiliyordu (bkz. `docs/YAPILACAKLAR.md` madde 3, artık kapalı).
 *
 * YENİ HALİ:
 *   `phone_verified` YALNIZ burada, gerçek `verifyOtp` başarısından SONRA,
 *   service role ile yazılır. `authenticated` rolünün bu kolonu UPDATE etme
 *   yetkisi `docs/20260811_phone_verified_revoke.sql` ile geri alındı — istemci
 *   artık PostgREST'e doğrudan istekle de bu bayrağı set edemez; bu route TEK yol.
 *
 * `verifyOtp` BİLEREK SSR client'la (`getServerSupabase`) çağrılıyor, istemci
 * client'ıyla DEĞİL — aksi hâlde oturum cookie'si güncellenmez (aynı ders:
 * `/api/ilan/[id]/sahiplen/route.ts`).
 */

const NUMARA_BEKLEME_MS = 60_000
// 17 Ağu 2026 — docs/YAPILACAKLAR.md md.3: gönderim (`adim:'gonder'`) kotalıydı,
// `verifyOtp`in KENDİSİ hiçbir sunucu sayacından geçmiyordu. Oturum zaten
// zorunlu olduğu için anahtar `user.id` — IP'den daha kesin (aynı NAT'ta
// birden çok kullanıcı birbirini kilitlemez).
const DOGRULAMA_DENEME_LIMIT = 5
const DOGRULAMA_PENCERE_MS = 10 * 60 * 1000

/** 05xx… / 5xx… / +905xx… → +905xxxxxxxxx. Geçersizse null. */
function telefonNormalize(ham: unknown): string | null {
  if (typeof ham !== 'string') return null
  const rakam = ham.replace(/\D/g, '')
  let yerel: string
  if (rakam.length === 12 && rakam.startsWith('90')) yerel = rakam.slice(2)
  else if (rakam.length === 11 && rakam.startsWith('0')) yerel = rakam.slice(1)
  else if (rakam.length === 10) yerel = rakam
  else return null
  if (!/^5\d{9}$/.test(yerel)) return null
  return `+90${yerel}`
}

export async function POST(request: Request) {
  try {
    // CSRF: SMS gönderimi ücretli, dış siteden tetiklenmesin.
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 })
    }

    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })

    const govde = await request.json().catch(() => null)
    const adim = govde?.adim
    const ip = istekIp(request)

    // ── 1. adım: yeni numaraya SMS kodu gönder ──────────────────────────────
    if (adim === 'gonder') {
      const telefon = telefonNormalize(govde?.telefon)
      if (!telefon) {
        return NextResponse.json({ error: 'Geçerli bir cep telefonu girin (05xx xxx xx xx).' }, { status: 400 })
      }

      // Kullanıcı başına 60 sn bekleme — `/api/auth/otp`'teki numara kotasının
      // aynısı, ama anahtar burada oturum (kullanıcı aynı numaraya tekrar tekrar
      // kod isteyip Twilio faturasını şişiremesin).
      const kota = kotaDene({
        ad: 'tel-degistir-kullanici', anahtar: user.id, limit: 1, pencereMs: NUMARA_BEKLEME_MS, sayma: true,
      })
      if (!kota.izinli) {
        return NextResponse.json(
          { error: `${kota.bekleSn} saniye sonra tekrar deneyebilirsiniz.`, bekle: kota.bekleSn },
          { status: 429, headers: { 'Retry-After': String(kota.bekleSn) } }
        )
      }

      const { error } = await supabase.auth.updateUser({ phone: telefon })
      if (error) {
        structuredLog('WARN', 'auth', 'Telefon değiştirme SMS gönderilemedi', {
          ip, user_id: user.id, reason: error.message,
        })
        return NextResponse.json({ error: 'SMS gönderilemedi: ' + error.message }, { status: 502 })
      }
      kotaDene({ ad: 'tel-degistir-kullanici', anahtar: user.id, limit: 1, pencereMs: NUMARA_BEKLEME_MS })
      return NextResponse.json({ success: true })
    }

    // ── 2. adım: kodu doğrula, GERÇEK KANIT varsa phone_verified yaz ────────
    if (adim === 'dogrula') {
      const telefon = telefonNormalize(govde?.telefon)
      const otp = typeof govde?.otp === 'string' ? govde.otp.trim() : ''
      if (!telefon || !otp) return NextResponse.json({ error: 'Eksik bilgi.' }, { status: 400 })

      // Doğrulama denemesi kotası — `verifyOtp`den ÖNCE. Kod yanlış girilse
      // bile deneme sayılır (fırsat tükendi); doğru girilse zaten akış biter.
      const denemeKota = kotaDene({
        ad: 'tel-degistir-dogrula', anahtar: user.id, limit: DOGRULAMA_DENEME_LIMIT, pencereMs: DOGRULAMA_PENCERE_MS,
      })
      if (!denemeKota.izinli) {
        structuredLog('WARN', 'auth', 'Telefon değiştirme doğrulama kotası aşıldı', { ip, user_id: user.id })
        return NextResponse.json(
          { error: 'Çok fazla hatalı kod denemesi. Yeni bir kod isteyin.', bekle: denemeKota.bekleSn },
          { status: 429, headers: { 'Retry-After': String(denemeKota.bekleSn) } }
        )
      }

      const { error } = await supabase.auth.verifyOtp({ phone: telefon, token: otp, type: 'phone_change' })
      if (error) {
        return NextResponse.json({ error: 'Kod hatalı veya süresi dolmuş.' }, { status: 400 })
      }

      // İstemcideki `yeniTel` state'iyle AYNI gösterim formatı: "0" + 10 hane.
      // `users.phone` kolonu tarihsel olarak bu formatta ("05xxxxxxxxx"), +90
      // öneki YOK — mevcut satırlarla tutarlı kalsın diye korunuyor.
      const yerelGosterim = '0' + telefon.slice(3)

      const svc = getServiceSupabase()
      const { error: yazHata } = await svc
        .from('users')
        .update({ phone: yerelGosterim, phone_verified: true })
        .eq('id', user.id)

      if (yazHata) {
        structuredLog('ERROR', 'db-transaction', 'Telefon doğrulandı ama kayıt güncellenemedi', {
          user_id: user.id, supabase_error: yazHata.message,
        })
        return NextResponse.json({ error: 'Doğrulandı ama kayıt güncellenemedi.' }, { status: 500 })
      }

      structuredLog('INFO', 'auth', 'Telefon değiştirildi ve doğrulandı', { user_id: user.id })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Geçersiz adım.' }, { status: 400 })
  } catch (err) {
    console.error('Telefon değiştirme hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
