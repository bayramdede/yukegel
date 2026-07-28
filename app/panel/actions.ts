'use server'

import { getServerSupabase, getServiceSupabase } from '../../lib/auth'

/**
 * SPRINT_01 L1e — panel ilan düzenleme ARTIK SUNUCUDA.
 *
 * Eski hali: `app/panel/IlanYonetim.tsx` istemciden anon key ile
 *   supabase.from('listings').update(patch).eq('id', ilan.id)
 * çağırıyordu. İki ayrı problem:
 *
 *  1) `contact_phone` istemci tarafından YAZILIYORDU. L1/L1c/L1d ile numarayı
 *     OKUMA yollarını kapattık; ama `authenticated` rolünün bu kolon üzerindeki
 *     yazma yetkisi durduğu sürece PostgREST'te `contact_phone` yetkisini geri
 *     alamıyorduk (revoke, kolonu update listesinden de düşürür → panel kırılır).
 *     Bu dosya o son bağı koparıyor: revoke artık güvenle çalıştırılabilir.
 *
 *  2) Gövde tamamen istemcinin kontrolündeydi. RLS "sadece kendi ilanın" der ama
 *     KOLON bazlı korumaz — aynı update'e
 *       trust_level: 'verified', moderation_status: 'approved', is_shadow_banned: false
 *     eklemek devtools açmak kadar kolaydı. Kullanıcı kendi ilanını moderasyondan
 *     geçirilmiş + doğrulanmış gösterebiliyordu. (K2 ile aynı sınıf hata.)
 *
 * Artık gövde aşağıdaki BEYAZ LİSTEDEN geçiyor ve sahiplik sunucuda doğrulanıyor.
 */

const ARAC_TIPLERI = new Set(['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'])
const UTSYAPI = new Set(['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'])

export type DurakGirdi = {
  city: string
  district?: string | null
  cargo_type?: string | null
  weight_ton?: number | null
  pallet_count?: number | null
  vehicle_count?: number | null
}

export type IlanGuncelleGirdi = {
  id: string
  origin_city: string
  origin_district?: string | null
  vehicle_type: string[]
  body_type: string[]
  available_date?: string | null
  date_flexible: boolean
  price_offer?: number | null
  price_negotiable: boolean
  telefon?: string | null
  notes?: string | null
  duraklar: DurakGirdi[]
}

export type PanelSonuc<T = undefined> =
  | { ok: true; veri?: T }
  | { ok: false; hata: string }

type SahiplikSonuc =
  | { ok: false; hata: string }
  | { ok: true; userId: string; service: ReturnType<typeof getServiceSupabase> }

/** Oturumu doğrular ve ilanın gerçekten bu kullanıcıya ait olduğunu kontrol eder. */
async function sahipMi(ilanId: string): Promise<SahiplikSonuc> {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }

  const service = getServiceSupabase()
  const { data: ilan } = await service
    .from('listings')
    .select('id, user_id')
    .eq('id', ilanId)
    .maybeSingle()

  if (!ilan) return { ok: false, hata: 'İlan bulunamadı.' }
  // Sahiplik kontrolü SUNUCUDA. RLS'e güvenip atlamıyoruz çünkü aşağıda
  // service-role kullanıyoruz — service-role RLS'i BYPASS eder.
  if (ilan.user_id !== user.id) return { ok: false, hata: 'Bu ilan size ait değil.' }

  return { ok: true, userId: user.id, service }
}

function sayiYada(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function ilanGuncelle(girdi: IlanGuncelleGirdi): Promise<PanelSonuc<{ duraklar: unknown[] }>> {
  const kontrol = await sahipMi(girdi.id)
  if ('hata' in kontrol) return { ok: false, hata: kontrol.hata }
  const { service } = kontrol

  // ── Doğrulama (istemcidekinin aynısı; istemciye GÜVENME) ────────────
  const kalkis = (girdi.origin_city ?? '').trim()
  if (kalkis.length < 2 || kalkis.length > 60) return { ok: false, hata: 'Kalkış şehri gerekli.' }

  const duraklar = (girdi.duraklar ?? []).filter(d => (d.city ?? '').trim().length > 0)
  if (duraklar.length === 0) return { ok: false, hata: 'En az bir varış durağı gerekli.' }
  if (duraklar.length > 10) return { ok: false, hata: 'En fazla 10 durak eklenebilir.' }

  const telefon = (girdi.telefon ?? '').replace(/\D/g, '')
  if (telefon && !/^0\d{10}$/.test(telefon))
    return { ok: false, hata: 'Telefon numarası 11 haneli olmalı (05xx xxx xx xx).' }

  const tarih = girdi.available_date && /^\d{4}-\d{2}-\d{2}$/.test(girdi.available_date)
    ? girdi.available_date : null

  const fiyat = sayiYada(girdi.price_offer)
  if (fiyat !== null && (fiyat < 0 || fiyat > 100_000_000))
    return { ok: false, hata: 'Geçersiz fiyat.' }

  // ── Beyaz liste ────────────────────────────────────────────────────
  // ⚠️ BU NESNEYE YENİ ALAN EKLERKEN İKİ KEZ DÜŞÜN.
  // ASLA eklenmemesi gerekenler: user_id, trust_level, moderation_status,
  // is_shadow_banned, status, internal_audit_logs, claimed_at, source.
  const patch = {
    origin_city: kalkis,
    origin_district: (girdi.origin_district ?? '').trim() || null,
    vehicle_type: (girdi.vehicle_type ?? []).filter(t => ARAC_TIPLERI.has(t)).slice(0, 10),
    body_type: (girdi.body_type ?? []).filter(u => UTSYAPI.has(u)).slice(0, 10),
    available_date: tarih,
    date_flexible: Boolean(girdi.date_flexible),
    price_offer: fiyat,
    price_negotiable: Boolean(girdi.price_negotiable),
    contact_phone: telefon || null,
    notes: (girdi.notes ?? '').trim().slice(0, 2000) || null,
  }

  const { error } = await service.from('listings').update(patch).eq('id', girdi.id)
  if (error) {
    console.error('ilanGuncelle update hatası:', error)
    return { ok: false, hata: 'Kaydedilemedi. Lütfen tekrar deneyin.' }
  }

  // ── Duraklar: sil + yeniden ekle ───────────────────────────────────
  await service.from('listing_stops').delete().eq('listing_id', girdi.id)
  const yeniStoplar = duraklar.map((d, i) => ({
    listing_id: girdi.id,
    stop_order: i + 1,
    city: d.city.trim(),
    district: (d.district ?? '')?.toString().trim() || null,
    cargo_type: (d.cargo_type ?? '')?.toString().trim() || null,
    weight_ton: sayiYada(d.weight_ton),
    pallet_count: sayiYada(d.pallet_count),
    vehicle_count: sayiYada(d.vehicle_count),
  }))
  const { data: eklenen, error: durakHata } = await service
    .from('listing_stops').insert(yeniStoplar).select()

  if (durakHata) {
    console.error('ilanGuncelle durak insert hatası:', durakHata)
    // İlan güncellendi ama duraklar yazılamadı — kullanıcıya dürüst ol.
    return { ok: false, hata: 'İlan kaydedildi ama duraklar güncellenemedi. Sayfayı yenileyip tekrar deneyin.' }
  }

  return { ok: true, veri: { duraklar: eklenen ?? yeniStoplar } }
}

/** "Araç Bulundu" / "Tekrar Aktif" — `completed_at` dışında hiçbir şeye dokunmaz. */
export async function ilanTamamlandiToggle(
  ilanId: string,
  tamamlandi: boolean
): Promise<PanelSonuc<{ completed_at: string | null }>> {
  const kontrol = await sahipMi(ilanId)
  if ('hata' in kontrol) return { ok: false, hata: kontrol.hata }

  const deger = tamamlandi ? new Date().toISOString() : null
  const { error } = await kontrol.service
    .from('listings').update({ completed_at: deger }).eq('id', ilanId)

  if (error) {
    console.error('ilanTamamlandiToggle hatası:', error)
    return { ok: false, hata: 'İşlem başarısız. Lütfen tekrar deneyin.' }
  }
  return { ok: true, veri: { completed_at: deger } }
}
