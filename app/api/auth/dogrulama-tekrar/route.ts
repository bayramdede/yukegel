import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/auth'
import { istekIp, kotaDene } from '../../../../lib/kota'
import { structuredLog } from '../../../../lib/logger'

/**
 * SPRINT_01 A6 — doğrulama e-postasını tekrar gönder.
 *
 * NEDEN GEREKLİ: kayıt sonrası "Doğrulama e-postası gönderildi" ekranında hiçbir
 * çıkış yolu yoktu. E-posta spam'e düştüyse, geç geldiyse ya da kullanıcı sekmeyi
 * kapattıysa yapabileceği tek şey AYNI e-postayla tekrar kayıt denemekti — o da
 * "Bu e-posta zaten kayıtlı" hatası veriyordu. Kullanıcı orada kilitleniyordu.
 *
 * NEDEN SUNUCUDA VE KOTALI: `supabase.auth.resend()` doğrudan istemciden de
 * çağrılabilir, ama o zaman herkese açık anon key ile bir döngü yazan biri
 * istediği adrese sınırsız e-posta attırabilir (hem SMTP kotamız yanar hem de
 * kurbanın gelen kutusu dolar — "mail bombing"). Kota bu yüzden burada.
 *
 * KOTALAR (bkz. lib/kota.ts):
 *   1. Adres başına 60 sn — arka arkaya butona basmayı keser.
 *   2. IP başına saatte 5 FARKLI adres — asıl kötüye kullanım deseni.
 *   3. IP başına saatte 10 toplam — üstten emniyet.
 *
 * ⚠️ HESAP SAYIMI (user enumeration): yanıt, adresin kayıtlı olup olmadığını ya da
 *    zaten doğrulanmış olup olmadığını ELE VERMEZ. Supabase ne derse desin biz
 *    daima aynı başarı yanıtını döneriz; aksi halde bu endpoint "bu e-posta
 *    sistemde var mı?" sorusuna ücretsiz bir cevap makinesine dönüşür.
 *
 * ⚠️ Kotalar process belleğinde; çok instance'ta delinir. lib/kota.ts'teki nota bak.
 */

/**
 * ⚠️ `emailRedirectTo` VERİLMEZSE Supabase kendi "Site URL" ayarına düşer ve
 *    kullanıcı `/auth/callback` yerine ana sayfaya çıkar — oturum takası hiç
 *    yapılmaz, kullanıcı "linke tıkladım ama yine giremiyorum" der.
 *    `request.url` KULLANILMIYOR: Vercel'de proxy arkasındaki iç adres olabilir.
 */
// 8 Ağu 2026 — tek kaynak. E-postadaki doğrulama linki de yönlenmesin.
import { SITE_URL } from '../../../../lib/site'

const ADRES_BEKLEME_MS = 60_000
const SAAT_MS = 60 * 60 * 1000
const IP_FARKLI_ADRES_LIMIT = 5
const IP_TOPLAM_LIMIT = 10

/** Kabaca geçerli mi? Amaç doğrulama değil, saçma girdiyi kota anahtarı yapmamak. */
function epostaNormalize(ham: unknown): string | null {
  if (typeof ham !== 'string') return null
  // Kota anahtarı normalize EDİLMELİ: "Ali@X.com" ile "ali@x.com" aynı hesap;
  // aksi halde saldırgan sadece harf büyüklüğünü değiştirerek kotayı sıfırlar.
  const e = ham.trim().toLowerCase()
  if (e.length < 5 || e.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  return e
}

function kotaYaniti(bekleSn: number, mesaj: string) {
  return NextResponse.json(
    { error: mesaj, bekle: bekleSn },
    { status: 429, headers: { 'Retry-After': String(bekleSn) } }
  )
}

export async function POST(request: Request) {
  try {
    // CSRF: yan etkisi e-posta göndermek olan bir işlem, dış siteden tetiklenmesin.
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 })
    }

    const govde = await request.json().catch(() => null)
    const eposta = epostaNormalize(govde?.eposta)
    if (!eposta) {
      return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 })
    }

    const ip = istekIp(request)

    // Üç kovaya da önce SADECE BAK (`sayma: true`). Sayaç, isteğin sonucu belli
    // olduktan sonra tek seferde işlenir (aşağıda). Amaç: KİLİTLİYKEN gelen
    // istekler kilidi UZATMASIN — aksi halde saldırgan istek atmaya devam ederek
    // kurbanı süresiz kilitli tutabilirdi.
    //
    // ⚠️ `otp/route.ts`ten BİLEREK AYRILIYOR: orada sağlayıcı hatasında sayaç
    //    işlenmeden 502 dönülür. Burada hata yolunda da SAYIYORUZ, çünkü buradaki
    //    "hata"ların büyük kısmı "böyle bir adres yok / zaten doğrulanmış" — yani
    //    saldırganın tam da aradığı bilgi. Saymazsak o yol bedava ve sınırsız
    //    olurdu; hesap sayımına (enumeration) karşı kota tek savunmamız.
    const adresKota = kotaDene({
      ad: 'dogrulama-adres', anahtar: eposta, limit: 1, pencereMs: ADRES_BEKLEME_MS, sayma: true,
    })
    if (!adresKota.izinli) {
      return kotaYaniti(adresKota.bekleSn, `${adresKota.bekleSn} saniye sonra tekrar deneyebilirsiniz.`)
    }

    const ipFarkli = kotaDene({
      ad: 'dogrulama-ip-adres', anahtar: ip, limit: IP_FARKLI_ADRES_LIMIT,
      pencereMs: SAAT_MS, deger: eposta, sayma: true,
    })
    if (!ipFarkli.izinli) {
      structuredLog('WARN', 'auth', 'Doğrulama e-postası IP kotası (farklı adres)', {
        ip, limit: IP_FARKLI_ADRES_LIMIT,
      })
      return kotaYaniti(ipFarkli.bekleSn, 'Çok fazla farklı adrese istek gönderildi. Bir süre sonra tekrar deneyin.')
    }

    const ipToplam = kotaDene({
      ad: 'dogrulama-ip-toplam', anahtar: ip, limit: IP_TOPLAM_LIMIT, pencereMs: SAAT_MS, sayma: true,
    })
    if (!ipToplam.izinli) {
      structuredLog('WARN', 'auth', 'Doğrulama e-postası IP kotası (toplam)', { ip, limit: IP_TOPLAM_LIMIT })
      return kotaYaniti(ipToplam.bekleSn, 'Çok fazla istek. Bir süre sonra tekrar deneyin.')
    }

    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: eposta,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    })

    // Sayaçları HER DURUMDA işle — bkz. yukarıdaki "otp/route.ts'ten ayrılıyor" notu.
    // Bunun bedeli: geçici bir sağlayıcı arızası kullanıcıya 60 sn beklettirir.
    // Kabul ediyoruz; alternatifi hesap sayımına açık bir uç nokta.
    kotaDene({ ad: 'dogrulama-adres', anahtar: eposta, limit: 1, pencereMs: ADRES_BEKLEME_MS })
    kotaDene({ ad: 'dogrulama-ip-adres', anahtar: ip, limit: IP_FARKLI_ADRES_LIMIT, pencereMs: SAAT_MS, deger: eposta })
    kotaDene({ ad: 'dogrulama-ip-toplam', anahtar: ip, limit: IP_TOPLAM_LIMIT, pencereMs: SAAT_MS })

    if (error) {
      // Sebebi LOGA yaz, kullanıcıya YAZMA (bkz. hesap sayımı notu).
      structuredLog('WARN', 'auth', 'Doğrulama e-postası gönderilemedi', { ip, reason: error.message })
    } else {
      structuredLog('INFO', 'auth', 'Doğrulama e-postası tekrar gönderildi', { ip, method: 'eposta' })
    }

    // Başarı da hata da AYNI yanıt.
    return NextResponse.json({ success: true, bekleme: ADRES_BEKLEME_MS / 1000 })
  } catch (err) {
    console.error('Doğrulama e-postası hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
