import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getServiceSupabase } from '../../../lib/auth'
import { structuredLog } from '../../../lib/logger'
import { REDIRECT_COOKIE, guvenliRedirect } from '../../../lib/redirect'

/**
 * SPRINT_01 A10 — "Hesabınız başka bir hesabınızla birleştirildi" giriş döngüsünün çözümü.
 *
 * SORUN
 * -----
 * Merge sonrası emekli auth kimliğiyle giren kullanıcı `proxy.ts`'te `merged_into` dolu
 * satıra düşüyordu; proxy sb- cookie'lerini silip `/giris?hesap=tasindi`'ye atıyordu.
 * Aynı kimlikle tekrar girince yine aynı satır → SONSUZ DÖNGÜ. Kodda çıkış yolu yoktu.
 *
 * ESKİ ÇÖZÜM DENEMESİ ve NEDEN ÇALIŞMADI
 * --------------------------------------
 * `/api/auth/switch-account` magic-link'in `properties.action_link`'ini döndürüyordu.
 * O link IMPLICIT flow (`#access_token=...`) kullanır: token yalnız TARAYICIDA işlenir,
 * SSR cookie'si eski (emekli) oturumda kalır. Proxy bir sonraki istekte kullanıcıyı
 * yine emekli satırda görür → döngü geri gelir.
 *
 * BURADAKİ ÇÖZÜM
 * --------------
 * `action_link` yerine `properties.hashed_token` alınır ve `verifyOtp` SUNUCUDA,
 * cookie yazan `createServerClient` üzerinden çağrılır. Böylece canlı hesabın oturumu
 * doğrudan sb- cookie'lerine yazılır; tarayıcının fragment'i işlemesine gerek kalmaz.
 * Kullanıcı hiçbir şey yapmadan canlı hesabında uyanır.
 *
 * GÜVENLİK
 * --------
 * Hedef hesap ASLA istekten alınmaz — yalnız mevcut oturumun `users.merged_into`
 * zincirinden okunur. `merged_into` sadece `app/api/auth/merge/route.ts` tarafından
 * yazılır ve o route çağıranın iki kimlikten birine sahip olmasını şart koşar.
 * Yani devir yetkisi zaten merge anında kurulmuş bir bağa dayanır.
 */

// Zincir A→B→C olabilir (art arda merge). Döngüye/uzun zincire karşı sınırlı gez.
const MAKS_ADIM = 5

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const cookieStore = await cookies()

  // Hedef: query param → cookie → /panel. `guvenliRedirect` açık yönlendirmeyi engeller
  // ve `/auth/*` yollarını reddeder (bu route'a geri dönüş imkânsız).
  const hedef =
    guvenliRedirect(searchParams.get('redirect')) ??
    guvenliRedirect(cookieStore.get(REDIRECT_COOKIE)?.value)

  const yonlendir = (yol: string) => {
    const yanit = NextResponse.redirect(`${origin}${yol}`)
    if (hedef) yanit.cookies.delete(REDIRECT_COOKIE)
    return yanit
  }

  // Emekli oturumun cookie'lerini temizleyip temiz girişe gönder (kurtarılamayan haller).
  const temizGirise = (sebep: string) => {
    const url = new URL('/giris', origin)
    if (hedef) url.searchParams.set('redirect', hedef)
    url.searchParams.set('hesap', 'tasindi')
    const yanit = NextResponse.redirect(url)
    cookieStore.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) yanit.cookies.delete(name)
    })
    structuredLog('WARN', 'auth', 'Oturum devri yapılamadı', { sebep })
    return yanit
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Oturum yok — devredilecek bir şey de yok.
    const url = new URL('/giris', origin)
    if (hedef) url.searchParams.set('redirect', hedef)
    return NextResponse.redirect(url)
  }

  const service = getServiceSupabase()

  // ── merged_into zincirini sonuna kadar takip et ────────────────────────────
  let hedefId = user.id
  const gorulen = new Set<string>([user.id])
  for (let adim = 0; adim < MAKS_ADIM; adim++) {
    const { data: satir } = await service
      .from('users').select('merged_into').eq('id', hedefId).maybeSingle()
    const sonraki = satir?.merged_into as string | null | undefined
    if (!sonraki) break
    if (gorulen.has(sonraki)) return temizGirise('merged_into döngüsü')
    gorulen.add(sonraki)
    hedefId = sonraki
  }

  // Zaten canlı hesaptayız — proxy yanlış alarm vermiş ya da yarış durumu.
  if (hedefId === user.id) return yonlendir(hedef ?? '/panel')

  // Hedef satır gerçekten canlı mı? (merge hedefi silinmişse kurtarma imkânsız.)
  const { data: hedefSatir } = await service
    .from('users').select('id, merged_into').eq('id', hedefId).maybeSingle()
  if (!hedefSatir) return temizGirise('canlı hesap bulunamadı')
  if (hedefSatir.merged_into) return temizGirise('zincir sonu hâlâ emekli')

  const { data: hedefAuth } = await service.auth.admin.getUserById(hedefId)
  const hedefEposta = hedefAuth?.user?.email
  if (!hedefEposta) return temizGirise('canlı hesabın e-postası yok')

  // Magic link ÜRET ama linki KULLANMA — sadece hashed_token'ı al.
  const { data: linkData, error: linkHatasi } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: hedefEposta,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkHatasi || !tokenHash) return temizGirise('magic link üretilemedi')

  // Kritik adım: doğrulamayı SUNUCUDA yap. Bu çağrı `setAll` üzerinden canlı hesabın
  // sb- cookie'lerini yazar ve emekli oturumun cookie'lerini üzerine biner.
  const { error: dogrulamaHatasi } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (dogrulamaHatasi) return temizGirise(`verifyOtp: ${dogrulamaHatasi.message}`)

  structuredLog('INFO', 'auth', 'Oturum canlı hesaba devredildi', {
    emekli_user_id: user.id,
    user_id: hedefId,
  })

  return yonlendir(hedef ?? '/panel')
}
