import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth'
import { structuredLog, maskIp } from '../../../../lib/logger'

/**
 * SPRINT_01 A1 — auth olay kaydı.
 *
 * `app/giris/page.tsx` ve `app/profil-tamamla/page.tsx` bu endpoint'i aylardır
 * çağırıyordu ama endpoint HİÇ YAZILMAMIŞTI → her çağrı 404. `.catch(() => {})`
 * ile susturulduğu için kimse fark etmedi. Sonuç: başarısız giriş denemelerinin,
 * OTP bombardımanının ve "giremiyorum" şikayetlerinin hiçbir izi yoktu.
 *
 * Bu endpoint İSTEMCİDEN veri alır, yani gövdesi GÜVENİLMEZ. Bu yüzden:
 *   - `user_id` gövdeden DEĞİL, SSR oturum cookie'sinden okunur
 *   - `event` / `method` beyaz listeye göre süzülür (uydurma değer tabloyu kirletemez)
 *   - `reason` 300 karakterde kesilir
 *   - telefon/e-posta/şifre asla yazılmaz; IP maskelenir (KVKK)
 *
 * Hata durumunda bile 204 döner: log yazımı kullanıcının giriş akışını ASLA bloklamamalı.
 * (Ama sunucu tarafında structuredLog'a WARN düşer, sessiz kalmaz.)
 */

const GECERLI_EVENTLER = new Set([
  'login_success',
  'login_failed',
  'otp_failed',
  'otp_sent',
  'kayit_tamamlandi',
  'kayit_basarisiz',
  'sifre_sifirlama_istendi',
  'sifre_degistirildi',
  'hesap_birlestirme',
  'cikis',
])

// Not: `kayit_tamamlandi` olayında method = profil-tamamla'daki user_type değeri.
// KULLANICI_TIPLERI ile birebir aynı kalmalı (app/profil-tamamla/page.tsx:16).
const GECERLI_METODLAR = new Set([
  'otp',
  'eposta',
  'google',
  'magic_link',
  'yuk_sahibi',
  'arac_sahibi',
  'sirket',
  'broker',
  'bilinmiyor',
])

// Aynı IP'den log spam'i tabloyu şişirmesin: dakikada 30.
// Not: telefon endpoint'indeki gibi bellek-içi ve instance başına — kaba filtre.
const KOTA_PENCERE_MS = 60_000
const KOTA_LIMIT = 30
const kotaSayaci = new Map<string, { adet: number; sifirlanma: number }>()

function kotaAsildi(anahtar: string): boolean {
  const simdi = Date.now()
  const kayit = kotaSayaci.get(anahtar)
  if (!kayit || simdi > kayit.sifirlanma) {
    kotaSayaci.set(anahtar, { adet: 1, sifirlanma: simdi + KOTA_PENCERE_MS })
    return false
  }
  kayit.adet += 1
  return kayit.adet > KOTA_LIMIT
}

function ipAl(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

export async function POST(request: Request) {
  // Bu handler ASLA throw etmemeli — çağıran taraf giriş akışının ortasında.
  try {
    const govde = await request.json().catch(() => null)
    if (!govde || typeof govde !== 'object') {
      return new NextResponse(null, { status: 204 })
    }

    const event = String(govde.event ?? '').slice(0, 60)
    const method = String(govde.method ?? 'bilinmiyor').slice(0, 40)

    if (!GECERLI_EVENTLER.has(event)) {
      structuredLog('WARN', 'auth', 'Bilinmeyen auth event reddedildi', { event })
      return new NextResponse(null, { status: 204 })
    }

    const ipHam = ipAl(request)
    const ipMasked = ipHam ? maskIp(ipHam) : null

    if (kotaAsildi(ipMasked ?? 'bilinmiyor')) {
      return new NextResponse(null, { status: 204 })
    }

    // ⚠️ user_id GÖVDEDEN OKUNMAZ. İstemci başkasının kimliğiyle kayıt attıramaz.
    let userId: string | null = null
    try {
      const supabase = await getServerSupabase()
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      // Oturum yoksa/bozuksa sorun değil — login_failed zaten oturumsuz gelir.
    }

    const kayit = {
      event,
      method: GECERLI_METODLAR.has(method) ? method : 'bilinmiyor',
      reason: govde.reason ? String(govde.reason).slice(0, 300) : null,
      user_id: userId,
      ip_masked: ipMasked,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    }

    const service = getServiceSupabase()
    const { error } = await service.from('auth_events').insert(kayit)

    if (error) {
      // Tablo yoksa (migration çalıştırılmadıysa) burası tetiklenir.
      // Sessizce yutMA — bu bugu ilk etapta gizleyen şey tam olarak buydu.
      structuredLog('ERROR', 'auth', 'auth_events yazılamadı', {
        supabase_error: error.message,
        event,
      })
    }

    // stdout'a da düşür: DB erişilemese bile Vercel Logs'ta iz kalsın.
    structuredLog(event.endsWith('_failed') ? 'WARN' : 'INFO', 'auth', `Auth olayı: ${event}`, {
      event,
      method: kayit.method,
      user_id: userId,
      ip_masked: ipMasked,
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    structuredLog('ERROR', 'auth', 'auth log endpoint çöktü', {
      hata: err instanceof Error ? err.message : String(err),
    })
    return new NextResponse(null, { status: 204 })
  }
}

// GET ile çağrılırsa 405 — prefetch/crawler tabloyu kirletmesin.
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
