import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/auth'
import { istekIp, kotaDene } from '../../../../lib/kota'
import { structuredLog } from '../../../../lib/logger'

/**
 * SPRINT_01 G2 — SMS OTP gönderimi ARTIK SUNUCUDA, kotalı.
 *
 * ESKİ HALİ NEDEN PARA KAYBIYDI:
 *   `app/giris/page.tsx` doğrudan `supabase.auth.signInWithOtp({ phone })` çağırıyordu.
 *   Yani SMS tetikleyicisi tamamen istemcideydi: kayıtsız biri anon key ile (o key zaten
 *   herkese açık) bir döngü yazıp rastgele numaralara sınırsız SMS attırabilirdi.
 *   Her mesaj Twilio faturasına yazılır; ayrıca numara sahipleri için taciz.
 *   İstemcideki 60 sn bekleme (A4b) yalnız BİZİM formumuzu kullananı kısıtlıyordu —
 *   sessionStorage'a yazılan bir sayaç saldırgan için yok hükmünde.
 *
 * YENİ HALİ:
 *   Üç katmanlı kota (bkz. lib/kota.ts):
 *     1. Numara başına 60 sn — aynı numaraya arka arkaya SMS yağmuru engellenir.
 *     2. IP başına saatte 5 FARKLI numara — asıl kötüye kullanım deseni bu.
 *        (Aynı numaraya tekrar kod istemek bu kotayı tüketmez; onu 1. kural kısıtlar.)
 *     3. IP başına saatte 15 toplam gönderim — üstten emniyet.
 *
 * ⚠️ Kotalar process belleğinde; çok instance'ta delinir. lib/kota.ts'teki nota bak.
 */

const NUMARA_BEKLEME_MS = 60_000
const SAAT_MS = 60 * 60 * 1000
const IP_FARKLI_NUMARA_LIMIT = 5
const IP_TOPLAM_LIMIT = 15

/** 05xx… / 5xx… / +905xx… → +905xxxxxxxxx. Geçersizse null. */
function telefonNormalize(ham: unknown): string | null {
  if (typeof ham !== 'string') return null
  const rakam = ham.replace(/\D/g, '')
  let yerel: string
  if (rakam.length === 12 && rakam.startsWith('90')) yerel = rakam.slice(2)
  else if (rakam.length === 11 && rakam.startsWith('0')) yerel = rakam.slice(1)
  else if (rakam.length === 10) yerel = rakam
  else return null
  // Türkiye cep numaraları 5 ile başlar. Sabit hatta SMS gitmez — boşuna ücret yazmasın.
  if (!/^5\d{9}$/.test(yerel)) return null
  return `+90${yerel}`
}

function kotaYaniti(bekleSn: number, mesaj: string) {
  return NextResponse.json(
    { error: mesaj, bekle: bekleSn },
    { status: 429, headers: { 'Retry-After': String(bekleSn) } }
  )
}

export async function POST(request: Request) {
  try {
    // CSRF: yan etkisi ücretli bir işlem, dış siteden tetiklenmesin.
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 })
    }

    const govde = await request.json().catch(() => null)
    const telefon = telefonNormalize(govde?.telefon)
    if (!telefon) {
      return NextResponse.json({ error: 'Geçerli bir cep telefonu girin (05xx xxx xx xx).' }, { status: 400 })
    }

    const ip = istekIp(request)

    // 1) Numara başına bekleme.
    const numaraKota = kotaDene({
      ad: 'otp-numara', anahtar: telefon, limit: 1, pencereMs: NUMARA_BEKLEME_MS, sayma: true,
    })
    if (!numaraKota.izinli) {
      return kotaYaniti(numaraKota.bekleSn, `${numaraKota.bekleSn} saniye sonra tekrar deneyebilirsiniz.`)
    }

    // 2) IP başına saatte kaç FARKLI numara.
    const ipFarkli = kotaDene({
      ad: 'otp-ip-numara', anahtar: ip, limit: IP_FARKLI_NUMARA_LIMIT,
      pencereMs: SAAT_MS, deger: telefon, sayma: true,
    })
    if (!ipFarkli.izinli) {
      structuredLog('WARN', 'auth', 'OTP IP kotası aşıldı (farklı numara)', {
        ip, limit: IP_FARKLI_NUMARA_LIMIT,
      })
      return kotaYaniti(ipFarkli.bekleSn, 'Çok fazla farklı numaraya kod istendi. Bir süre sonra tekrar deneyin.')
    }

    // 3) IP başına toplam gönderim.
    const ipToplam = kotaDene({
      ad: 'otp-ip-toplam', anahtar: ip, limit: IP_TOPLAM_LIMIT, pencereMs: SAAT_MS, sayma: true,
    })
    if (!ipToplam.izinli) {
      structuredLog('WARN', 'auth', 'OTP IP kotası aşıldı (toplam)', { ip, limit: IP_TOPLAM_LIMIT })
      return kotaYaniti(ipToplam.bekleSn, 'Çok fazla kod isteği. Bir süre sonra tekrar deneyin.')
    }

    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.signInWithOtp({ phone: telefon })

    if (error) {
      // Sağlayıcı hatası kullanıcıyı kilitlemesin: sayaçlar YAZILMADI (hepsi sayma:true).
      structuredLog('WARN', 'auth', 'OTP gönderilemedi', { ip, reason: error.message })
      return NextResponse.json({ error: 'SMS gönderilemedi. Numarayı kontrol edin.' }, { status: 502 })
    }

    // SMS gerçekten gittiyse sayaçları işle.
    kotaDene({ ad: 'otp-numara', anahtar: telefon, limit: 1, pencereMs: NUMARA_BEKLEME_MS })
    kotaDene({ ad: 'otp-ip-numara', anahtar: ip, limit: IP_FARKLI_NUMARA_LIMIT, pencereMs: SAAT_MS, deger: telefon })
    kotaDene({ ad: 'otp-ip-toplam', anahtar: ip, limit: IP_TOPLAM_LIMIT, pencereMs: SAAT_MS })

    structuredLog('INFO', 'auth', 'OTP gönderildi', { ip, method: 'otp' })
    return NextResponse.json({ success: true, bekleme: NUMARA_BEKLEME_MS / 1000 })
  } catch (err) {
    console.error('OTP gönderim hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
