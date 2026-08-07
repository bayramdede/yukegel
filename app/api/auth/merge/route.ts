import { NextResponse } from 'next/server'
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth'

export async function POST(request: Request) {
  try {
    const { keepUserId, mergeUserId } = await request.json()

    if (!keepUserId || !mergeUserId) {
      return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 })
    }

    // Oturum kontrolü: mevcut kullanıcı keepUserId veya mergeUserId olmalı
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || (user.id !== keepUserId && user.id !== mergeUserId)) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const service = getServiceSupabase()

    // 🚨 GÜVENLİK (7 Ağu 2026) — yukarıdaki kontrol TEK BAŞINA yetmiyordu.
    // `mergeUserId`/`keepUserId` istemciden (URL parametresinden — `app/giris/
    // page.tsx`teki `?merge_user_id=`) geliyor. Eski kontrol yalnız "çağıran bu
    // İKİ ID'DEN BİRİ mi" diye bakıyordu — çağıran kendi id'sini `keepUserId`
    // yaparsa `mergeUserId`'ye RASTGELE BİR BAŞKA KULLANICININ id'sini
    // koyabiliyordu (herkese açık `u/[id]` profil URL'inden alınabilir) ve kontrol
    // GEÇİYORDU. Sonuç: keyfi bir kullanıcının ilanları/araçları/TCKN-VKN-telefonu
    // çağıranın hesabına aktarılıyor, kurbanın hesabı `is_active=false` ile
    // devre dışı bırakılıyordu — tam hesap ele geçirme, kurbanın hiçbir eylemi
    // gerekmeden.
    //
    // Düzeltme: bu route'un TEK meşru senaryosu (yorumlarda da yazılı) "aynı
    // e-postayla farklı sağlayıcıdan (Google/şifre) gelen İKİ hesabın birleşmesi."
    // Bu, iki auth kaydının gerçek e-postasını KENDİMİZ (istemciye güvenmeden)
    // karşılaştırarak sunucu tarafında ZORUNLU kılınıyor. Saldırgan kurbanın
    // e-postasını taklit edemez — Supabase Auth'un kendi kaydıdır.
    const [{ data: keepAuthOn }, { data: mergeAuthOn }] = await Promise.all([
      service.auth.admin.getUserById(keepUserId),
      service.auth.admin.getUserById(mergeUserId),
    ])
    const keepEmailOn = keepAuthOn?.user?.email?.trim().toLowerCase()
    const mergeEmailOn = mergeAuthOn?.user?.email?.trim().toLowerCase()
    if (!keepEmailOn || !mergeEmailOn || keepEmailOn !== mergeEmailOn) {
      return NextResponse.json({ error: 'Bu iki hesap birleştirilemez.' }, { status: 403 })
    }

    // 1. İlanları taşı
    await service.from('listings').update({ user_id: keepUserId }).eq('user_id', mergeUserId)

    // 2. Araçları taşı
    await service.from('vehicles').update({ user_id: keepUserId }).eq('user_id', mergeUserId)

    // 3. Eski profilin eksik alanlarını yeni profile aktar
    //
    // ⚠️ SPRINT_01 A2b — burada iki bug vardı:
    //   (a) `if (yeniProfil)` — Google merge akışında yeni auth kimliğinin users satırı
    //       HENÜZ YOKTUR (callback zaten `!profil?.user_type` gördüğü için buraya gelir).
    //       yeniProfil null olunca tüm aktarım atlanıyordu: kullanıcı adını, TCKN'sini,
    //       user_type'ını kaybedip boş profil-tamamla ekranına düşüyordu.
    //   (b) Eski satır `email`/`phone`/`username` değerlerini korurken aynı değerler yeni
    //       satıra yazılıyordu → `users_email_key` unique ihlali. Emekli satırın tekil
    //       alanları, yenisine yazılmadan ÖNCE boşaltılmalı.
    // maybeSingle(): satır yoksa single() hata döndürüyordu.
    const { data: eskiProfil } = await service.from('users').select('*').eq('id', mergeUserId).maybeSingle()
    const { data: yeniProfil } = await service.from('users').select('*').eq('id', keepUserId).maybeSingle()

    const AKTARILACAKLAR = [
      'display_name', 'company_name', 'tckn', 'vkn', 'bio',
      'username', 'phone', 'phone_verified', 'user_type',
    ] as const
    // Bu alanlarda DB'de tekil (unique) kısıt var — emekli satırdan önce sökülmeli.
    const TEKIL_ALANLAR = ['email', 'phone', 'username', 'tckn', 'vkn'] as const

    // 3a. Emekli satırı pasife al ve tekil alanlarını boşalt.
    //     (Eskiden 4. adımdaydı; aktarımdan SONRA çalıştığı için çakışma yaratıyordu.)
    const emekliGuncelleme: Record<string, unknown> = {
      id: mergeUserId,
      is_active: false,
      merged_into: keepUserId,
      role: 'user',
    }
    if (eskiProfil) {
      for (const alan of TEKIL_ALANLAR) {
        if (eskiProfil[alan]) emekliGuncelleme[alan] = null
      }
    }
    await service.from('users').upsert(emekliGuncelleme, { onConflict: 'id' })

    // 3b. Yeni satırı oluştur/güncelle — yoksa da çalışır.
    const guncelleme: Record<string, unknown> = { id: keepUserId }
    if (eskiProfil) {
      for (const alan of AKTARILACAKLAR) {
        if (!yeniProfil?.[alan] && eskiProfil[alan]) guncelleme[alan] = eskiProfil[alan]
      }
    }
    // Sağlayıcı listesi: 'phone' hardcode ediliyordu — Google ile gelen kullanıcıya
    // yanlış metadata yazıyordu. Gerçek sağlayıcıları auth kaydından oku.
    // (`keepAuthOn` yukarıdaki güvenlik kontrolünden — ikinci bir `getUserById` gerekmiyor.)
    const gercekProviders = (keepAuthOn?.user?.identities ?? []).map(i => i.provider).filter(Boolean)
    guncelleme.auth_providers = [...new Set([
      ...(yeniProfil?.auth_providers ?? []),
      ...(eskiProfil?.auth_providers ?? []),
      ...gercekProviders,
    ])]
    if (!yeniProfil?.email && keepAuthOn?.user?.email) guncelleme.email = keepAuthOn.user.email
    guncelleme.is_active = true

    const { error: aktarimHatasi } = await service
      .from('users').upsert(guncelleme, { onConflict: 'id' })
    if (aktarimHatasi) {
      console.error('Merge profil aktarımı başarısız:', aktarimHatasi)
      return NextResponse.json({ error: 'Profil aktarılamadı' }, { status: 500 })
    }

    // 5. Oturum ZATEN keepUserId ise magic link ÜRETME.
    //    Magic-link implicit flow yalnız localStorage'ı günceller, SSR cookie'si eski
    //    oturumda kalır → proxy kullanıcıyı geri atar (dokümante edilmiş sonsuz döngü).
    //    Google merge akışında (SPRINT_01 A2) oturum zaten doğru kimlikte; link gereksiz.
    if (user.id === keepUserId) {
      return NextResponse.json({ success: true, redirectUrl: '/panel' })
    }

    // Oturum emekli kimlikte — canlı hesaba geçmek için link gerekiyor.
    const keepEmail = keepAuthOn?.user?.email

    if (keepEmail) {
      const origin = new URL(request.url).origin
      const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
        type: 'magiclink',
        email: keepEmail,
        options: { redirectTo: `${origin}/auth/callback` },
      })
      if (!linkError && linkData?.properties?.action_link) {
        return NextResponse.json({ success: true, redirectUrl: linkData.properties.action_link })
      }
    }

    return NextResponse.json({ success: true, redirectUrl: '/panel' })
  } catch (err) {
    console.error('Merge hatası:', err)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
