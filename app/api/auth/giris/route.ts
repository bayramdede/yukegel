import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../../../lib/auth'
import { istekIp, kotaDene, kotaSifirla } from '../../../../lib/kota'
import { structuredLog } from '../../../../lib/logger'

/**
 * SPRINT_01 G1 — şifreli giriş ARTIK SUNUCUDA, kotalı.
 *
 * ESKİ HALİ NEDEN AÇIKTI:
 *   `app/giris/page.tsx` ve `app/moderator-giris/page.tsx` doğrudan
 *   `supabase.auth.signInWithPassword()` çağırıyordu. Yani şifre denemesi tamamen
 *   istemcideydi ve HİÇBİR hız sınırı yoktu: bir sözlük saldırısı, herkese açık anon
 *   key ile saniyede onlarca deneme yapabilirdi. Supabase'in kendi kaba sınırı var ama
 *   o proje geneli; tek bir hesabı hedef alan denemeyi ayırt etmiyor.
 *
 * YENİ HALİ — iki kova (bkz. lib/kota.ts):
 *   1. E-posta başına 15 dk içinde 5 başarısız deneme → kilit.
 *      Hedefli sözlük saldırısını kesen asıl kural.
 *   2. IP başına 15 dk içinde 20 başarısız deneme → kilit.
 *      "Bir IP'den çok sayıda FARKLI hesabı dene" (credential stuffing) desenini keser.
 *      E-posta kotasından bilerek yüksek: aynı ofisten/NAT arkasından gelen dürüst
 *      kullanıcılar birbirini kilitlemesin.
 *
 * SADECE BAŞARISIZ denemeler sayılır; başarılı girişte iki kova da sıfırlanır
 * (`kotaSifirla`) — doğru şifreyi bilen kullanıcı bir önceki hatalarının bedelini ödemez.
 *
 * ⚠️ Kotalar process belleğinde; çok instance'ta delinir. lib/kota.ts'teki nota bak.
 *
 * NEDEN SUNUCUDA GİRİŞ YAPILIYOR:
 *   `getServerSupabase()` SSR client'tır → başarılı girişte `sb-` cookie'leri BURADA
 *   yazılır. Böylece proxy/middleware ilk istekte oturumu görür. Tarayıcı istemcisi
 *   (`createBrowserClient`) da aynı cookie'leri okuduğu için istemci tarafı bozulmaz.
 */

const PENCERE_MS = 15 * 60 * 1000
const EPOSTA_LIMIT = 5
const IP_LIMIT = 20

/** Kilit süresini kullanıcıya anlamlı bir metinle söyle. */
function kilitYaniti(bekleSn: number) {
  const dk = Math.ceil(bekleSn / 60)
  return NextResponse.json(
    {
      error: `Çok fazla hatalı giriş denemesi. ${dk} dakika sonra tekrar deneyin.`,
      bekle: bekleSn,
    },
    { status: 429, headers: { 'Retry-After': String(bekleSn) } }
  )
}

export async function POST(request: Request) {
  try {
    // CSRF: dış siteden tetiklenen giriş denemesi olmasın.
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: 'Geçersiz kaynak' }, { status: 403 })
    }

    const govde = await request.json().catch(() => null)
    const hamEposta = typeof govde?.eposta === 'string' ? govde.eposta : ''
    const sifre = typeof govde?.sifre === 'string' ? govde.sifre : ''
    // Kota anahtarı normalize edilmeli: "Ali@X.com" ile "ali@x.com" AYNI hesap,
    // aksi halde saldırgan sadece harf büyüklüğünü değiştirerek kotayı sıfırlar.
    const eposta = hamEposta.trim().toLowerCase()

    if (!eposta || !sifre) {
      return NextResponse.json({ error: 'E-posta ve şifre gerekli.' }, { status: 400 })
    }

    const ip = istekIp(request)

    // Ön kontrol: iki kovaya da sadece BAK (`sayma: true`). Sayaç yalnızca gerçekten
    // başarısız olan denemede işlenir — kilitliyken gelen istekler kilidi uzatmasın,
    // yoksa saldırgan istek atmaya devam ederek kurbanı süresiz kilitli tutabilir.
    const epostaKota = kotaDene({
      ad: 'giris-hata-eposta', anahtar: eposta, limit: EPOSTA_LIMIT,
      pencereMs: PENCERE_MS, sayma: true,
    })
    if (!epostaKota.izinli) {
      structuredLog('WARN', 'auth', 'Giriş kilidi (e-posta)', { ip, limit: EPOSTA_LIMIT })
      return kilitYaniti(epostaKota.bekleSn)
    }

    const ipKota = kotaDene({
      ad: 'giris-hata-ip', anahtar: ip, limit: IP_LIMIT,
      pencereMs: PENCERE_MS, sayma: true,
    })
    if (!ipKota.izinli) {
      structuredLog('WARN', 'auth', 'Giriş kilidi (IP)', { ip, limit: IP_LIMIT })
      return kilitYaniti(ipKota.bekleSn)
    }

    const supabase = await getServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre })

    if (error || !data?.user) {
      // Başarısız → iki kovayı da işle.
      kotaDene({ ad: 'giris-hata-eposta', anahtar: eposta, limit: EPOSTA_LIMIT, pencereMs: PENCERE_MS })
      kotaDene({ ad: 'giris-hata-ip', anahtar: ip, limit: IP_LIMIT, pencereMs: PENCERE_MS })

      structuredLog('WARN', 'auth', 'Şifreli giriş başarısız', { ip, reason: error?.message })

      // Hesap sayımını (user enumeration) engellemek için "yanlış şifre" ile
      // "böyle bir kullanıcı yok" AYNI mesajı döner. Tek istisna doğrulanmamış e-posta:
      // kullanıcının ne yapması gerektiğini bilmesi lazım ve bu bilgi zaten kayıt
      // ekranından sızıyor.
      const dogrulanmamis = error?.message?.includes('Email not confirmed')
      return NextResponse.json(
        {
          error: dogrulanmamis
            ? 'E-posta adresinizi doğrulamadınız. Gelen kutunuzu kontrol edin.'
            : 'E-posta veya şifre hatalı.',
          // SPRINT_01 A5 — makine okunur kod. İstemci eskiden bu iki durumu
          // ayırt edemiyor, ikisini de aynı kırmızı satırda gösteriyordu:
          // doğrulama linkini kaçıran kullanıcı "şifrem yanlış" sanıp şifre
          // sıfırlama döngüsüne giriyordu. Türkçe METNE göre dallanmak kırılgan
          // olurdu (metin değişince sessizce bozulur) — kod ile ayırıyoruz.
          kod: dogrulanmamis ? 'eposta_dogrulanmamis' : 'kimlik_hatali',
          kalanDeneme: Math.max(0, epostaKota.kalan - 1),
        },
        { status: 401 }
      )
    }

    // Başarılı → sayaçları temizle. Doğru şifreyi bilen kullanıcı önceki hatalarının
    // bedelini ödemesin.
    kotaSifirla('giris-hata-eposta', eposta)
    kotaSifirla('giris-hata-ip', ip)

    structuredLog('INFO', 'auth', 'Şifreli giriş başarılı', { ip, user_id: data.user.id, method: 'eposta' })

    // Rol, moderatör giriş ekranının yönlendirmesi için gerekiyor (M2).
    // GÜVENLİK SINIRI DEĞİL — asıl sınır `proxy.ts` + `requireStaff()`.
    const { data: profil } = await supabase
      .from('users').select('role').eq('id', data.user.id).maybeSingle()

    return NextResponse.json({ success: true, rol: profil?.role ?? 'user' })
  } catch (err) {
    console.error('Giriş hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
