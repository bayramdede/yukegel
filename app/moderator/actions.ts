'use server'

import { requireStaff, getServiceSupabase } from '../../lib/auth'
import { structuredLog } from '../../lib/logger'
import {
  ilanYaz, kisaMetin, sayiAralik, tamSayiAralik,
  MAX_DURAK, MAX_TON, MAX_PALET, MAX_NOT, MAX_RAW_TEXT, MAX_ARAC_ADET,
  type IlanYazGirdi,
} from '../../lib/ilan-yaz'
import { ARAC_TIPI_SETI, UTSYAPI_SETI } from '../../lib/ilan-sabitler'
// Çift yazım (`docs/COGRAFI_GECIS.md` Dalga 2). `ilCiftYazim`, `ilNormalize` ile
// aynı katlamayı (`ilKey`) kullanır; farkı plaka id'sini de döndürmesi.
import { ilCiftYazim, ilceNormalize } from '../../lib/lokasyon'

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
 * 8 Ağu 2026 — `internal_audit_logs` için `ilanTelefonlariGetir`'in AYNI deseni.
 *
 * NEDEN: bu kolon anti-spam motorunun `fired_rules` (hangi kural, hangi ağırlıkla
 * ateşlendi) ve `thresholds` (`reject_min`/`auto_publish_max`) alanlarını içeriyor.
 * `listings` satır RLS'i `using(true)` — HERKES her satırı okuyabiliyor — ve kolon
 * `anon`/`authenticated`'a GRANT'lıydı. Yani düz bir `fetch('/rest/v1/listings?
 * select=internal_audit_logs')` (kayıt bile gerekmeden) motorun tam eşik/ağırlık
 * tablosunu döküyordu — kural atlatmayı kolaylaştıran bir sızıntı. `docs/
 * 20260808_listings_audit_kolon.sql`'e bakınız.
 *
 * Kolon artık `anon`+`authenticated`'dan tamamen revoke edildi; yalnız
 * `getServiceSupabase()` (staff doğrulandıktan sonra, `requireStaff` ile) okuyor.
 */
export async function ilanAuditGetir(
  ids: string[]
): Promise<ModSonuc<Record<string, any>>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  const temiz = Array.from(new Set((ids ?? []).filter(id => typeof id === 'string' && id.length > 0)))
  if (temiz.length === 0) return { ok: true, veri: {} }
  if (temiz.length > 300) return { ok: false, hata: 'Çok fazla kayıt istendi.' }

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('listings')
    .select('id, internal_audit_logs')
    .in('id', temiz)

  if (error) {
    structuredLog('ERROR', 'audit-engine', 'Moderatör audit-log toplu okuma hatası', {
      supabase_error: error.message,
    })
    return { ok: false, hata: 'Audit kayıtları yüklenemedi.' }
  }

  const harita: Record<string, any> = {}
  for (const satir of data ?? []) harita[satir.id] = satir.internal_audit_logs ?? null
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

// ─────────────────────────────────────────────────────────────────────────────
// ILAN_VER_ANALIZ W1+ — moderatörün "Manuel Gir" yolu
// ─────────────────────────────────────────────────────────────────────────────

export interface ModDurakGirdi {
  city: string
  district?: string | null
  weight_ton?: string | number | null
  pallet_count?: string | number | null
  vehicle_count?: string | number | null
  cargo_type?: string | null
  notes?: string | null
}

export interface ModIlanGirdi {
  listing_type: string
  origin_city: string
  origin_district?: string | null
  /** `raw_posts.source` — ham mesajın geldiği kanal. Yoksa 'whatsapp'. */
  kaynak?: string | null
  raw_post_id: string
  raw_text?: string | null
  notes?: string | null
  vehicle_type?: string[]
  body_type?: string[]
  contact_phone?: string | null
  stops: ModDurakGirdi[]
}

/** `raw_posts.source` beyaz listesi — istemciden gelen serbest metin kolona yazılmaz. */
const KAYNAK_SETI: ReadonlySet<string> = new Set(['whatsapp', 'facebook', 'telegram', 'manual'])

/**
 * Çözümsüz bir ham mesajdan moderatör eliyle ilan oluşturur.
 *
 * 🚨 NEDEN SERVER ACTION: burası eskiden `app/moderator/page.tsx` içinde, ANON
 * istemciyle atılan iki ayrı INSERT'ti (`listings`, sonra bir `for` döngüsünde
 * `listing_stops`). Yani `ILAN_VER_ANALIZ`'in kapattığı üç delik bu yolda açıktı:
 *   V1 — `vehicle_type`/`body_type`/şehir beyaz listeden geçmiyordu,
 *   V5 — durak INSERT'i patlarsa geriye DURAKSIZ ilan kalıyordu,
 *   ve `moderation_status:'approved'` + `trust_level:'social'` gibi ayrıcalıklı
 *   alanlar TARAYICIDAN yazılıyordu — RLS satır bazlı olduğu için bunu kolon
 *   düzeyinde engelleyemiyorduk.
 *
 * `ilanYaz()` burada KULLANILAMAZ: o fonksiyon oturum sahibi bir `user_id` ve
 * V2 gereği PROFİL telefonu ister. Manuel giriş kayıtsız bir göndericinin
 * mesajından doğuyor — `user_id` NULL, telefon metinden okunuyor. Ortak zemin
 * bu yüzden `ilan_olustur()` RPC'si (v2: `raw_post_id` + `reviewed_at` yazar).
 *
 * ⚠️ Migration: `docs/20260729_ilan_olustur_v2.sql` — KODDAN ÖNCE çalışmalı.
 */
export async function moderatorIlanOlustur(
  girdi: ModIlanGirdi
): Promise<ModSonuc<{ id: string }>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  try {
    const tip = girdi?.listing_type === 'arac' ? 'arac' : 'yuk'

    const kalkisIl = ilCiftYazim(girdi?.origin_city)
    if (!kalkisIl) return { ok: false, hata: 'Kalkış ili tanınamadı. Listeden bir il seçin.' }
    const kalkis = kalkisIl.ad
    const kalkisIlce = ilceNormalize(kalkisIl.id, girdi?.origin_district)

    const rawPostId = typeof girdi?.raw_post_id === 'string' ? girdi.raw_post_id.trim() : ''
    if (!/^[0-9a-f-]{36}$/i.test(rawPostId))
      return { ok: false, hata: 'Geçersiz ham mesaj kimliği.' }

    const hamDuraklar = Array.isArray(girdi?.stops) ? girdi.stops : []
    const gecerli = hamDuraklar.filter(d => d && typeof d.city === 'string' && d.city.trim())
    if (gecerli.length === 0) return { ok: false, hata: 'En az bir varış durağı gerekli.' }
    if (gecerli.length > MAX_DURAK) return { ok: false, hata: `En fazla ${MAX_DURAK} durak eklenebilir.` }

    const duraklar: Array<Record<string, unknown>> = []
    for (const d of gecerli) {
      const il = ilCiftYazim(d.city)
      if (!il)
        return { ok: false, hata: `Varış ili tanınamadı: "${String(d.city).slice(0, 30)}". Listeden seçin.` }
      // İlçe İL'E BAĞLI çözülüyor: "Kadıköy" İstanbul'un resmî ilçesi, Ankara'nın
      // değil. Serbest giriş reddedilmiyor, `resmi:false` ile işaretleniyor.
      const ilce = ilceNormalize(il.id, d.district)
      duraklar.push({
        city: il.ad,
        province_id: il.id,
        district: ilce?.ad ?? kisaMetin(d.district),
        district_official: ilce?.resmi ?? null,
        cargo_type: kisaMetin(d.cargo_type),
        weight_ton: sayiAralik(d.weight_ton, 0, MAX_TON),
        // ⚠️ RPC içinde `::int`; ondalık değer 22P02 atıp TÜM transaction'ı geri sarar.
        pallet_count: tamSayiAralik(d.pallet_count, 0, MAX_PALET),
        vehicle_count: tamSayiAralik(d.vehicle_count, 1, MAX_ARAC_ADET) ?? 1,
        notes: kisaMetin(d.notes, MAX_NOT),
      })
    }

    // Beyaz liste: listede olmayan değer sessizce DÜŞER (V1).
    const aracTipi = Array.isArray(girdi?.vehicle_type)
      ? girdi.vehicle_type.filter(v => ARAC_TIPI_SETI.has(v))
      : []
    const utsyapi = Array.isArray(girdi?.body_type)
      ? girdi.body_type.filter(u => UTSYAPI_SETI.has(u))
      : []

    const kaynak = KAYNAK_SETI.has(String(girdi?.kaynak ?? '')) ? String(girdi.kaynak) : 'whatsapp'

    const service = getServiceSupabase()
    const { data: rpcSonuc, error } = await service.rpc('ilan_olustur', {
      p_listing: {
        listing_type: tip,
        origin_city: kalkis,
        origin_province_id: kalkisIl.id,
        origin_district: kalkisIlce?.ad ?? kisaMetin(girdi?.origin_district),
        origin_district_official: kalkisIlce?.resmi ?? null,
        // Telefon burada YAZILMAZ; aşağıda `ilanTelefonGuncelle` ile, kendi
        // doğrulaması ve KVKK izi ile yazılıyor. Tek kapı kalsın.
        contact_phone: null,
        notes: kisaMetin(girdi?.notes, MAX_NOT),
        raw_text: kisaMetin(girdi?.raw_text, MAX_RAW_TEXT),
        source: kaynak,
        // Moderatör zaten insan gözüyle baktı: doğrudan onaylı doğar.
        moderation_status: 'approved',
        status: 'active',
        trust_level: 'social',
        user_id: null,
        vehicle_type: aracTipi.length > 0 ? aracTipi : null,
        body_type: utsyapi.length > 0 ? utsyapi : null,
        raw_post_id: rawPostId,
        reviewed_at: new Date().toISOString(),
      },
      p_stops: duraklar,
    })

    const listing = rpcSonuc as { id: string } | null

    if (error || !listing?.id) {
      structuredLog('ERROR', 'moderator-actions', 'Manuel ilan oluşturulamadı', {
        user_id: yetki.user.id,
        raw_post_id: rawPostId,
        error_message: error?.message ?? 'rpc null döndü',
        error_code: error?.code ?? null,
        stop_count: duraklar.length,
      })
      return {
        ok: false,
        hata: error?.code === 'PGRST202'
          ? 'İlan kaydedilemedi: sunucu güncellemesi eksik (ilan_olustur v2). Migration çalıştırılmalı.'
          : 'İlan kaydedilemedi. Lütfen tekrar deneyin.',
      }
    }

    // Telefon: kolon yetkisi yalnız service-role'de (SPRINT_01 L1e).
    const telHam = (girdi?.contact_phone ?? '').replace(/\D/g, '')
    if (telHam) {
      const { error: telHata } = await service
        .from('listings')
        .update({ contact_phone: /^0\d{10}$/.test(telHam) ? telHam : null })
        .eq('id', listing.id)
      if (telHata) {
        // İlan oluştu; numarasız kaldı. Moderatör düzenleyebilir, iz bırak yeter.
        structuredLog('WARN', 'moderator-actions', 'Manuel ilan telefonu yazılamadı', {
          listing_id: listing.id, supabase_error: telHata.message,
        })
      }
    }

    // Ham mesajı işlenmiş say. Patlarsa ilan yine de geçerli — mesaj kuyrukta kalır.
    const { error: rawHata } = await service
      .from('raw_posts')
      .update({ processing_status: 'processed' })
      .eq('id', rawPostId)
    if (rawHata) {
      structuredLog('WARN', 'moderator-actions', 'raw_post işlenmiş olarak işaretlenemedi', {
        raw_post_id: rawPostId, listing_id: listing.id, supabase_error: rawHata.message,
      })
    }

    structuredLog('INFO', 'moderator-actions', 'Manuel ilan oluşturuldu', {
      user_id: yetki.user.id,
      role: yetki.user.role,
      listing_id: listing.id,
      raw_post_id: rawPostId,
      listing_type: tip,
      origin_city: kalkis,
      stop_count: duraklar.length,
    })

    return { ok: true, veri: { id: listing.id } }
  } catch (e) {
    const hata = e as { message?: string; name?: string }
    structuredLog('ERROR', 'moderator-actions', 'Manuel ilan beklenmeyen istisna', {
      user_id: yetki.user.id,
      error_name: hata?.name ?? null,
      error_message: hata?.message ?? String(e),
    })
    return { ok: false, hata: 'İlan kaydedilemedi. Teknik bir hata oluştu.' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXCEL MÜKERRER STAGING (Bayram'ın Batch Pre-check / Staging isteği, 11 Ağu 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Excel toplu yüklemede `dedup_hash`i var olan bir ilanla çakışan gruplar
// `listings`e yazılmaz, `excel_dedup_staging`e düşer (`app/api/excel-import`).
// Tablo istemciye TAMAMEN kapalı (grant revoke + RLS default-deny), o yüzden
// listeleme/onay/ret YALNIZ burada, rolü `requireStaff()` ile doğrulanmış
// service-role üzerinden yapılır — `no_lane` (Çözümsüz) sekmesindeki desenle
// aynı mantık, ama o tablo istemciye açık olduğu için orada action gerekmiyordu.

export interface MukerrerStagingKaydi {
  id: string
  seferNo: string | null
  createdAt: string
  matchedListingId: string | null
  /** `girdi` özeti — ekranda "ne yazılacaktı" göstermek için (rota + fiyat vb.). */
  ozet: {
    kalkis: string
    varislar: string[]
    fiyat: string | null
    aracTipi: string | null
    tarih: string | null
  }
}

/** Bekleyen mükerrer Excel gruplarını döner (en yeni önce). */
export async function mukerrerExcelListe(): Promise<ModSonuc<MukerrerStagingKaydi[]>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('excel_dedup_staging')
    .select('id, sefer_no, girdi, matched_listing_id, created_at')
    .eq('status', 'bekliyor')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    structuredLog('ERROR', 'moderator-actions', 'Mükerrer staging listesi okunamadı', {
      user_id: yetki.user.id, supabase_error: error.message,
    })
    return { ok: false, hata: 'Liste yüklenemedi.' }
  }

  const kayitlar: MukerrerStagingKaydi[] = (data ?? []).map(r => {
    const g = (r.girdi ?? {}) as Partial<IlanYazGirdi>
    const duraklar = Array.isArray(g.duraklar) ? g.duraklar : []
    return {
      id: r.id as string,
      seferNo: (r.sefer_no as string | null) ?? null,
      createdAt: r.created_at as string,
      matchedListingId: (r.matched_listing_id as string | null) ?? null,
      ozet: {
        kalkis: String(g.kalkis ?? ''),
        varislar: duraklar.map(d => String(d?.sehir ?? '')).filter(Boolean),
        fiyat: g.fiyat != null ? String(g.fiyat) : null,
        aracTipi: g.arac_tipi ?? null,
        tarih: g.tarih ?? null,
      },
    }
  })

  return { ok: true, veri: kayitlar }
}

/**
 * Mükerrer sanılan grubu ONAYLA — "araç/tonaj farklı, mükerrer değil".
 * Saklanan `girdi` `ilanYaz()`e `dedupAtla:true` ile geçirilir (aksi hâlde AYNI
 * hash yeniden yakalanır, sonsuz döngü). İlan ORİJİNAL yükleyene ait olur,
 * moderatöre değil — `user_id` staging satırından okunuyor.
 */
export async function mukerrerExcelOnayla(stagingId: string): Promise<ModSonuc<{ id: string }>> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  const service = getServiceSupabase()
  const { data: kayit } = await service
    .from('excel_dedup_staging')
    .select('id, user_id, girdi, status')
    .eq('id', stagingId)
    .maybeSingle()

  if (!kayit) return { ok: false, hata: 'Kayıt bulunamadı.' }
  if (kayit.status !== 'bekliyor') return { ok: false, hata: 'Bu kayıt zaten işlenmiş.' }

  const sonuc = await ilanYaz(
    kayit.user_id as string,
    kayit.girdi as IlanYazGirdi,
    'excel',
    { dedupAtla: true },
  )

  if (!sonuc.ok) {
    structuredLog('WARN', 'moderator-actions', 'Mükerrer staging onayı ilan yazamadı', {
      user_id: yetki.user.id, staging_id: stagingId, hata: sonuc.hata,
    })
    return { ok: false, hata: sonuc.hata }
  }

  await service.from('excel_dedup_staging')
    .update({
      status: 'onaylandi', reviewed_by: yetki.user.id,
      reviewed_at: new Date().toISOString(), created_listing_id: sonuc.id,
    })
    .eq('id', stagingId)

  structuredLog('INFO', 'moderator-actions', 'Mükerrer Excel grubu onaylandı → ilan yazıldı', {
    user_id: yetki.user.id, staging_id: stagingId, listing_id: sonuc.id,
  })

  return { ok: true, veri: { id: sonuc.id } }
}

/** Mükerrer grubu REDDET — gerçekten aynı ilan, yazılmayacak. */
export async function mukerrerExcelReddet(stagingId: string): Promise<ModSonuc> {
  const yetki = await requireStaff()
  if (!yetki.ok) return { ok: false, hata: yetki.error }

  const service = getServiceSupabase()
  const { data: kayit } = await service
    .from('excel_dedup_staging')
    .select('id, status')
    .eq('id', stagingId)
    .maybeSingle()

  if (!kayit) return { ok: false, hata: 'Kayıt bulunamadı.' }
  if (kayit.status !== 'bekliyor') return { ok: false, hata: 'Bu kayıt zaten işlenmiş.' }

  await service.from('excel_dedup_staging')
    .update({ status: 'reddedildi', reviewed_by: yetki.user.id, reviewed_at: new Date().toISOString() })
    .eq('id', stagingId)

  structuredLog('INFO', 'moderator-actions', 'Mükerrer Excel grubu reddedildi', {
    user_id: yetki.user.id, staging_id: stagingId,
  })

  return { ok: true, veri: undefined }
}
