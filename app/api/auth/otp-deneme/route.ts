import { NextResponse } from 'next/server'
import { istekIp, kotaDene } from '../../../../lib/kota'
import { structuredLog } from '../../../../lib/logger'

/**
 * POST /api/auth/otp-deneme — giriş OTP'sini DOĞRULAMA denemesi için sunucu
 * tarafı hız sınırı (docs/YAPILACAKLAR.md md.3, 17 Ağu 2026 kapatıldı).
 *
 * 🚨 KÖK SORUN: `app/giris/page.tsx`teki asıl `supabase.auth.verifyOtp(...)`
 *    çağrısı doğrudan İSTEMCİDEN, hiçbir sunucu kotasından geçmeden gidiyordu.
 *    `/api/auth/otp` yalnız SMS GÖNDERİMİNİ sınırlıyor — 4/6 haneli kodu deneme
 *    hızını hiçbir şey kısıtlamıyordu.
 *
 * BU ROUTE KODU DOĞRULAMAZ, Supabase'e HİÇ DOKUNMAZ. Tek işi: istemci
 * `verifyOtp`yi çağırmadan HEMEN ÖNCE buraya "deneme hakkım var mı?" diye
 * sormak (`app/giris/page.tsx` `otpDogrula`). 429 dönerse istemci verifyOtp'yi
 * hiç çağırmaz. Böylece giriş akışının geri kalanı (merge/is_active/redirect
 * mantığı) HİÇ değişmeden, yalnızca verifyOtp'nin önüne sunucu tarafı bir kapı
 * eklenmiş oluyor — 8 Ağu'daki login kırılmasına yol açan büyük çaplı "akışı
 * sunucuya taşı" refaktörü BİLEREK yapılmadı (bkz. YAPILACAKLAR'daki gerekçe).
 *
 * ⚠️ SINIR: saldırgan Supabase'in kendi (public anon key'li) endpoint'ini
 *    doğrudan çağırabilir — bu route TEK BAŞINA onu durduramaz. Ama BİZİM
 *    arayüzümüzden (giriş formu) gelen deneme hızını gerçekten sınırlar,
 *    ki md.3'ün istediği "en azından sunucu tarafında bir hız sınırı" budur.
 *    Kalıcı/tam çözüm hâlâ Supabase'in kendi rate-limit ayarlarını doğrulamak
 *    + gerekirse verifyOtp'yi de sunucuya taşımak (ayrı, dikkatli bir tur).
 */

const NUMARA_LIMIT = 5
const NUMARA_PENCERE_MS = 10 * 60 * 1000 // 10 dk
const IP_LIMIT = 20
const IP_PENCERE_MS = 10 * 60 * 1000

/** 05xx… / 5xx… / +905xx… → +905xxxxxxxxx. Geçersizse null. `/api/auth/otp`teki BİREBİR aynısı. */
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

function kotaYaniti(bekleSn: number, mesaj: string) {
  return NextResponse.json(
    { izinli: false, error: mesaj, bekle: bekleSn },
    { status: 429, headers: { 'Retry-After': String(bekleSn) } }
  )
}

export async function POST(request: Request) {
  try {
    // CSRF: yan etkisi yok ama kota tüketiyor — dış siteden bilerek/bilmeden
    // tetiklenip kullanıcıyı kilitleyebilir (`/api/auth/otp`teki desenin aynısı).
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 })
    }

    const govde = await request.json().catch(() => null)
    const telefon = telefonNormalize(govde?.telefon)
    if (!telefon) {
      return NextResponse.json({ error: 'Geçerli bir cep telefonu girin.' }, { status: 400 })
    }

    const ip = istekIp(request)

    // 1) Numara başına — kod yanlış girilse bile deneme sayılır.
    const numaraKota = kotaDene({
      ad: 'otp-dogrula-numara', anahtar: telefon, limit: NUMARA_LIMIT, pencereMs: NUMARA_PENCERE_MS,
    })
    if (!numaraKota.izinli) {
      structuredLog('WARN', 'auth', 'OTP doğrulama kotası aşıldı (numara)', { ip, limit: NUMARA_LIMIT })
      return kotaYaniti(numaraKota.bekleSn, 'Çok fazla deneme yapıldı. Yeni bir kod isteyin.')
    }

    // 2) IP başına — bir saldırgan FARKLI numaralar gezerek numara kotasını atlatamasın.
    const ipKota = kotaDene({
      ad: 'otp-dogrula-ip', anahtar: ip, limit: IP_LIMIT, pencereMs: IP_PENCERE_MS,
    })
    if (!ipKota.izinli) {
      structuredLog('WARN', 'auth', 'OTP doğrulama kotası aşıldı (IP)', { ip, limit: IP_LIMIT })
      return kotaYaniti(ipKota.bekleSn, 'Çok fazla doğrulama denemesi. Bir süre sonra tekrar deneyin.')
    }

    return NextResponse.json({ izinli: true })
  } catch (err) {
    console.error('OTP deneme kotası hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
