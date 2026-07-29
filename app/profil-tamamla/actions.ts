'use server'

import { getServerSupabase, getServiceSupabase } from '../../lib/auth'
// SPRINT_01 K2b — doğrulayıcılar ortak modülde. İstemci kopyasıyla ayrışmasın diye
// buraya yeniden yazma; `lib/kimlik.ts`'i düzelt.
import { tcknGecerli, vknGecerli } from '../../lib/kimlik'

/**
 * SPRINT_01 K2 — profil tamamlama kaydı ARTIK SUNUCUDA.
 *
 * Eski hali: `app/profil-tamamla/page.tsx` istemciden doğrudan
 * `supabase.from('users').upsert({...})` çağırıyordu. Yani gövde tamamen
 * kullanıcının kontrolündeydi. RLS satır bazlı koruma sağlar ("sadece kendi
 * satırın"), ama KOLON bazlı korumaz: aynı isteğe
 *   role: 'admin', is_active: true, phone_verified: true, merged_into: null
 * eklemek bir devtools açmak kadar kolaydı. Kendi satırında olduğu için RLS
 * bunu engellemez — kullanıcı kendini admin yapabilirdi.
 *
 * Yeni hali: gövde burada BEYAZ LİSTEDEN geçiyor. `role`, `is_active`,
 * `merged_into`, `trust_level` gibi alanlar istemciden GELSE BİLE yazılmaz;
 * değerleri sunucu belirler.
 *
 * `id` de gövdeden alınmıyor — oturum cookie'sinden okunuyor. Başkasının
 * satırını hedeflemek mümkün değil.
 */

export type ProfilGirdi = {
  displayName: string
  userType: string
  telefon: string
  telefonKilitli: boolean
  tckn?: string
  vkn?: string
  sirketAdi?: string
  kvkkOnay: boolean
  arac?: { plaka: string; tip: string; utsyapi: string[] } | null
}

export type ProfilSonuc = { ok: true } | { ok: false; hata: string }

const GECERLI_TIPLER = new Set(['yuk_sahibi', 'arac_sahibi', 'sirket', 'broker'])

export async function profilKaydet(girdi: ProfilGirdi): Promise<ProfilSonuc> {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }

  // ── Doğrulama ──────────────────────────────────────────────────────
  if (!girdi.kvkkOnay) return { ok: false, hata: 'Devam etmek için KVKK metnini onaylamalısınız.' }

  const displayName = (girdi.displayName ?? '').trim()
  if (displayName.length < 2 || displayName.length > 120)
    return { ok: false, hata: 'Ad soyad en az 2 karakter olmalı.' }

  if (!GECERLI_TIPLER.has(girdi.userType))
    return { ok: false, hata: 'Geçersiz kullanıcı tipi.' }

  const telefon = (girdi.telefon ?? '').replace(/\D/g, '')
  if (!/^0\d{10}$/.test(telefon))
    return { ok: false, hata: 'Telefon numarası 11 haneli olmalı (05xx xxx xx xx).' }

  const tckn = (girdi.tckn ?? '').replace(/\D/g, '')
  if (tckn && !tcknGecerli(tckn)) return { ok: false, hata: 'Geçersiz TCKN.' }

  const vkn = (girdi.vkn ?? '').replace(/\D/g, '')
  if (vkn && !vknGecerli(vkn)) return { ok: false, hata: 'Geçersiz VKN.' }

  if (girdi.userType === 'sirket' && !vkn)
    return { ok: false, hata: 'Şirket hesabı için VKN zorunlu.' }

  const sirketAdi = (girdi.sirketAdi ?? '').trim()
  if (girdi.userType === 'sirket' && sirketAdi.length < 2)
    return { ok: false, hata: 'Şirket adı zorunlu.' }

  const service = getServiceSupabase()

  // ── Askıya alınmış hesap kontrolü ──────────────────────────────────
  // Eski istemci kodu upsert gövdesine `is_active: true` koyuyordu. Bu, banlanmış
  // bir kullanıcının profil-tamamla'yı tekrar POST'layarak kendini AKTİFLEŞTİRMESİ
  // demekti. Artık `is_active` hiç yazılmıyor (aşağıdaki beyaz listede yok) ve
  // pasif hesap buradan geri dönüyor.
  const { data: mevcut } = await service
    .from('users')
    .select('is_active, merged_into, phone, phone_verified')
    .eq('id', user.id)
    .maybeSingle()

  if (mevcut?.is_active === false)
    return { ok: false, hata: 'Hesabınız askıya alınmış. Destek ile iletişime geçin.' }
  if (mevcut?.merged_into)
    return { ok: false, hata: 'Bu hesap başka bir hesapla birleştirilmiş. Lütfen tekrar giriş yapın.' }

  // ── Tekillik ───────────────────────────────────────────────────────
  // İstemci onBlur'da /api/auth/tekil-kontrol çağırıyor ama o sadece UX.
  // Yarış durumunda (iki sekme) ya da devtools'la atlandığında burası tutar.
  async function cakismaVar(kolon: 'phone' | 'tckn' | 'vkn', deger: string) {
    const { data } = await service
      .from('users')
      .select('id')
      .eq(kolon, deger)
      .is('merged_into', null)
      .neq('id', user!.id)
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  if (!girdi.telefonKilitli && (await cakismaVar('phone', telefon)))
    return { ok: false, hata: 'Bu telefon numarası ile zaten bir hesap var. Giriş yapmayı deneyin.' }
  if (tckn && (await cakismaVar('tckn', tckn)))
    return { ok: false, hata: 'Bu TCKN ile zaten bir hesap var. Giriş yapmayı deneyin.' }
  if (vkn && (await cakismaVar('vkn', vkn)))
    return { ok: false, hata: 'Bu VKN ile zaten bir hesap var. Giriş yapmayı deneyin.' }

  // ── Beyaz liste ────────────────────────────────────────────────────
  // ⚠️ BU NESNEYE YENİ ALAN EKLERKEN İKİ KEZ DÜŞÜN.
  // Buraya yazılan her kolon istemcinin dolaylı olarak etkileyebildiği bir kolon olur.
  // ASLA eklenmemesi gerekenler: role, is_active, merged_into, trust_level,
  // is_shadow_banned, moderation_status.
  // (is_active bilinçli olarak YOK — DB varsayılanı geçerli. Yukarıdaki askı kontrolüne bak.)
  const kayit: Record<string, unknown> = {
    id: user.id,                       // ← oturumdan, gövdeden DEĞİL
    email: user.email,                 // ← oturumdan, gövdeden DEĞİL
    display_name: displayName,
    user_type: girdi.userType,
    phone: telefon,
    // phone_verified istemcinin `telefonKilitli` bayrağına DEĞİL, gerçek kanıta bakıyor:
    // ya bu oturum SMS OTP ile açılmış ve numara tutuyor, ya da satırda AYNI numara
    // için zaten doğrulanmış kaydı var. İstemci bu bayrağı kendi başına set edemez.
    phone_verified:
      (Boolean(user.phone) && user.phone!.replace(/\D/g, '').endsWith(telefon.slice(1))) ||
      (mevcut?.phone_verified === true && (mevcut.phone ?? '').replace(/\D/g, '') === telefon),
    kvkk_onay_at: new Date().toISOString(),
    ...(tckn ? { tckn } : {}),
    ...(vkn ? { vkn } : {}),
    ...(sirketAdi ? { company_name: sirketAdi } : {}),
  }

  const { error } = await service.from('users').upsert(kayit, { onConflict: 'id' })

  if (error) {
    // email unique constraint — bu kişinin eski bir hesabı var ama merge kontrolleri
    // (giris/page.tsx, auth/callback/route.ts) yakalayamadı.
    if (error.message.includes('users_email_key')) {
      return { ok: false, hata: 'Bu e-posta adresiyle zaten bir hesabınız var. Lütfen giriş yapın.' }
    }
    console.error('profilKaydet upsert hatası:', error)
    return { ok: false, hata: 'Profil kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  // ── Araç (opsiyonel) ───────────────────────────────────────────────
  if (girdi.userType === 'arac_sahibi' && girdi.arac?.plaka && girdi.arac?.tip) {
    const plaka = girdi.arac.plaka.toUpperCase().replace(/\s/g, '').slice(0, 12)
    const { error: aracHata } = await service.from('vehicles').insert({
      user_id: user.id,
      plate: plaka,
      vehicle_type: girdi.arac.tip,
      body_types: Array.isArray(girdi.arac.utsyapi) ? girdi.arac.utsyapi.slice(0, 10) : [],
      is_active: true,
    })
    // Araç kaydı başarısız olsa bile profil kaydedildi — kullanıcıyı burada kilitleme.
    if (aracHata) console.error('profilKaydet araç insert hatası:', aracHata)
  }

  return { ok: true }
}
