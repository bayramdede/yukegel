'use server'

import { requireStaff, getServiceSupabase } from '../../lib/auth'
import { structuredLog } from '../../lib/logger'
import {
  kisaMetin, sayiAralik, tamSayiAralik,
  MAX_DURAK, MAX_TON, MAX_PALET, MAX_NOT, MAX_RAW_TEXT, MAX_ARAC_ADET,
} from '../../lib/ilan-yaz'
import { ARAC_TIPI_SETI, UTSYAPI_SETI, ilNormalize } from '../../lib/ilan-sabitler'

/**
 * SPRINT_01 L1e — moderatör panelindeki `contact_phone` okuma/yazmaları sunucuya taşındı.
 *
 * NEDEN: L1/L1c/L1d ile numarayı istemciden OKUMA yollarını kapattık, ama
 * `authenticated` rolünün `listings.contact_phone` üzerindeki PostgREST yetkisi
 * duruyordu. Yani düz bir kullanıcı hesabıyla:
 *
 *   fetch('/rest/v1/listings?select=contact_phone', { headers: { apikey: <anon> } })
 *
 * hâlâ RLS'in okumasına izin verdiği HER satırın numarasını döndürüyordu — bizim
 * arayüzde göstermememiz bir şeyi engellemiyordu. Kolonu revoke etmek gerekiyordu;
 * revoke etmek de bu paneli kıracaktı, çünkü moderatör aynı anon istemciyle
 * numarayı okuyup yazıyordu.
 *
 * Bu dosya o bağı koparıyor: numara artık yalnızca rolü SUNUCUDA doğrulanmış
 * admin/moderator'a, yalnızca burada verilir. Erişim `logPhoneAccess` ile iz bırakır.
 *
 * Bkz. docs/20260728_contact_phone_revoke.sql
 */

export type ModSonuc<T = undefined> =
  | { ok: true; veri: T }
  | { ok: false; hata: string }

/**
 * Ekranda listelenen ilanların numaralarını toplu döner.
 * İstemci artık `contact_phone`'u select'ine koymuyor; listeyi çektikten sonra
 * bunu çağırıp birleştiriyor.
 */
export async function ilanTelefonlariGetir(
  ids: string[]
): Promise<ModSonuc<Record<string, string | null>>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  const temiz = Array.from(new Set((ids ?? []).filter(id => typeof id === 'string' && id.length > 0)))
  if (temiz.length === 0) return { ok: true, veri: {} }
  // Panel zaten 200 ile sınırlı; yine de tavan koy.
  if (temiz.length > 300) return { ok: false, hata: 'Çok fazla kayıt istendi.' }

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('listings')
    .select('id, contact_phone')
    .in('id', temiz)

  if (error) {
    structuredLog('ERROR', 'phone-privacy', 'Moderatör telefon toplu okuma hatası', {
      supabase_error: error.message,
    })
    return { ok: false, hata: 'Telefonlar yüklenemedi.' }
  }

  // KVKK izi: kim, kaç numaraya baktı. (logPhoneAccess tek ilan içindir — toplu
  // okumada her satır için bir satır log üretmek gürültü olurdu.)
  structuredLog('INFO', 'phone-privacy', 'Moderatör panelinde toplu telefon erişimi', {
    viewer_id: yetki.user.id,
    role: yetki.user.role,
    adet: data?.length ?? 0,
  })

  const harita: Record<string, string | null> = {}
  for (const satir of data ?? []) harita[satir.id] = satir.contact_phone ?? null
  return { ok: true, veri: harita }
}

/**
 * Tek ilanın numarasını günceller. `contact_phone` DIŞINDA hiçbir kolona dokunmaz —
 * moderatörün diğer alanları (durum, notlar, moderation_status…) mevcut akışıyla,
 * anon istemci + RLS üzerinden yazılmaya devam ediyor.
 */
export async function ilanTelefonGuncelle(
  ilanId: string,
  telefon: string | null
): Promise<ModSonuc<{ telefon: string | null }>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  if (typeof ilanId !== 'string' || ilanId.length === 0)
    return { ok: false, hata: 'Geçersiz ilan.' }

  const rakam = (telefon ?? '').replace(/\D/g, '')
  if (rakam && !/^0\d{10}$/.test(rakam))
    return { ok: false, hata: 'Telefon 11 haneli olmalı (05xx xxx xx xx).' }

  const deger = rakam || null
  const service = getServiceSupabase()
  const { error } = await service
    .from('listings')
    .update({ contact_phone: deger })
    .eq('id', ilanId)

  if (error) {
    structuredLog('ERROR', 'phone-privacy', 'Telefon güncelleme hatası', {
      supabase_error: error.message, listing_id: ilanId,
    })
    return { ok: false, hata: 'Telefon kaydedilemedi.' }
  }

  structuredLog('INFO', 'moderator-actions', 'İlan telefonu güncellendi', {
    user_id: yetki.user.id, role: yetki.user.role, listing_id: ilanId, doluMu: Boolean(deger),
  })
  return { ok: true, veri: { telefon: deger } }
}
