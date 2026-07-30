// lib/ilan-yaz.ts — İLAN YAZMA YOLUNUN TEK KAYNAĞI (server-only).
//
// `ILAN_VER_ANALIZ` W0/W1. Projede `listings` INSERT eden İKİ ayrı ayrıcalıklı yol
// vardı (`app/ilan-ver/actions.ts` ve `/api/excel-import`) ve ikisi de kendi
// doğrulamasını, kendi `moderation_status` sabitini, kendi telefon kaynağını
// taşıyordu. W0 yalnız birincisini sertleştirdi — ikincisi hâlâ `arac_tipi`'ni
// doğrulamadan yazıyor ve `auto_published` sabitliyordu.
//
// 🚨 KURAL: `listings` tablosuna İLAN YAZAN her yol BU DOSYADAN geçer. Yeni bir
// kanal (WhatsApp, API, bot) eklerken `ilanYaz()` çağır; INSERT'i kopyalama.
//
// ⚠️ INSERT nesnesine YENİ ALAN EKLERKEN İKİ KEZ DÜŞÜN. İstemciden gelen hiçbir
// değer `user_id`, `trust_level`, `moderation_status`, `is_shadow_banned`,
// `status`, `audit_score`, `internal_audit_logs`, `source`, `claimed_at`
// alanlarına dokunmamalı.

import { getServiceSupabase } from './auth';
import { getAuditThresholds } from './auditLimits';
import { structuredLog } from './logger';
import { ARAC_TIPI_SETI, UTSYAPI_SETI, ilNormalize } from './ilan-sabitler';

export const MAX_DURAK = 10;
export const MAX_ARAC_ADET = 50;
export const MAX_FIYAT = 100_000_000;
export const MAX_TON = 100_000;
export const MAX_PALET = 10_000;
export const MAX_NOT = 2000;
export const MAX_KISA_METIN = 60;
export const MAX_RAW_TEXT = 8000;

export type IlanDurumu = 'yayinda' | 'incelemede' | 'reddedildi';

export type IlanYazSonuc =
  | { ok: true; id: string; durum: IlanDurumu; mesaj: string }
  | { ok: false; hata: string };

/** Bir durağın ham hâli. Şehir serbest metin gelebilir; `ilNormalize` süzer. */
export interface DurakGirdi {
  sehir: string;
  ilce?: string;
  ton?: string | number | null;
  palet?: string | number | null;
  notlar?: string | null;
  /**
   * `ILAN_VER_ANALIZ` B4 — yük cinsi DURAK BAZLI. Tek bir global değeri tüm
   * duraklara kopyalamak çok duraklı seferde yanlış bilgi üretiyordu
   * (İzmir'e seramik, Konya'ya cam giden tek ilan "hepsi seramik" oluyordu).
   * Boşsa `yuk_cinsi` (ilan geneli) devreye girer.
   */
  yuk_cinsi?: string | null;
}

export interface IlanYazGirdi {
  tip: string;
  kalkis: string;
  kalkis_ilce?: string;
  /** Yalnız profilde telefon YOKSA kullanılır; varsa profil kazanır (V2). */
  tel?: string;
  fiyat?: string | number | null;
  fiyat_pazarlik?: boolean;
  tarih: string;
  tarih_esnek?: boolean;
  genel_not?: string;
  arac_tipi?: string;
  utsyapi?: string[];
  arac_adet?: number;
  /**
   * B3 — araç ilanında ilanı veren SPESİFİK aracın id'si (`vehicles.id`).
   * ⚠️ İstemciden gelir ama SORGUSUZ YAZILMAZ: `ilanYaz()` aracın gerçekten
   * bu kullanıcıya ait ve aktif olduğunu doğrular, değilse sessizce düşürür.
   */
  arac_id?: string | null;
  yuk_cinsi?: string;
  duraklar: DurakGirdi[];
  raw_text?: string;
  ai_parsed?: boolean;
}

/** `listings.source` — hangi kanaldan geldi. Beyaz liste; istemci belirleyemez. */
export type IlanKaynak = 'form' | 'excel' | 'whatsapp' | 'moderator';

/**
 * Kanal politikası — `ILAN_VER_ANALIZ` W1+.
 *
 * 🚨 Bu tablo BİLEREK burada, `girdi`nin içinde DEĞİL. Politika istemciden gelen
 * bir alan olursa istemci onu gevşetebilir; `kaynak` ise beyaz listeli ve çağıran
 * sunucu kodu tarafından sabitleniyor.
 *
 * `daimaIncele`: audit skoru düşük olsa bile ilan yayına ÇIKMAZ, kuyruğa girer.
 * WhatsApp için açık, çünkü oradaki metin bir formdan değil serbest sohbetten
 * geliyor ve LLM'in yorumu doğrulanmamış; skorlayıcı "temiz" dese bile insan gözü
 * görmeli. Form ve Excel'de kullanıcı ne yazdığını ekranda görüp onaylıyor.
 */
const KANAL_POLITIKA: Record<IlanKaynak, { daimaIncele: boolean }> = {
  form:      { daimaIncele: false },
  excel:     { daimaIncele: false },
  whatsapp:  { daimaIncele: true  },
  moderator: { daimaIncele: false },
};

// ── Yardımcılar ────────────────────────────────────────────────────────────

export function kisaMetin(v: unknown, max = MAX_KISA_METIN): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function sayiAralik(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/**
 * `sayiAralik` + TAM SAYIYA yuvarlama.
 *
 * ⚠️ `public.ilan_olustur()` içinde `pallet_count` ve `vehicle_count`
 * `(… ->> '…')::int` ile cast ediliyor. Ondalıklı bir değer ("2.5") oraya
 * ulaşırsa Postgres `22P02` verir ve **tüm transaction geri sarılır** — kullanıcı
 * yalnızca "İlan kaydedilemedi" görür, sebebini asla öğrenemez. Excel'den gelen
 * palet hücresi pekâlâ ondalıklı olabilir. Kesirli palet zaten anlamsız; kırpmak
 * ilanı düşürmekten iyidir.
 */
export function tamSayiAralik(v: unknown, min: number, max: number): number | null {
  const n = sayiAralik(v, min, max);
  return n === null ? null : Math.round(n);
}

/**
 * Türkiye'de bugün (YYYY-AA-GG).
 * ⚠️ `PROJE_HARITASI §9` (A2): offset'siz `new Date()` host TZ'ye göre kayar.
 * Sunucu UTC'de koşar; sabit +03:00 eklemezsek gece 00:00–03:00 arası DÜNÜ döner
 * ve istemcinin gönderdiği "bugün" reddedilir. İstemci `bugun()` de aynı offseti
 * kullanmak ZORUNDA (`app/ilan-ver/page.tsx`).
 */
export function bugunISO(): string {
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return tr.toISOString().split('T')[0];
}

/**
 * Oturumun doğrulanmış telefonunu döndürür.
 *
 * `ILAN_VER_ANALIZ` V2 — telefon İSTEMCİDEN alınmaz. Profil numarası her zaman
 * kazanır; istemci farklı bir değer yollarsa sessizce ezilir ama WARN loglanır
 * (yalnız son 4 hane — tam numara loga yazılmaz). Profil boşsa doğrulanmış
 * istemci numarası kabul edilip profile GERİ YAZILIR, böylece Google ile
 * kaydolmuş telefonsuz kullanıcı kilitlenmez ve dal kendini onarır.
 */
export async function ilanTelefonu(
  userId: string,
  istemciDegeri?: string | null,
): Promise<{ ok: true; tel: string } | { ok: false; hata: string }> {
  const svc = getServiceSupabase();
  const { data: profil } = await svc
    .from('users')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  const profilTel = String(profil?.phone ?? '').replace(/\D/g, '');
  const istemciTel = String(istemciDegeri ?? '').replace(/\D/g, '');

  if (/^0\d{10}$/.test(profilTel)) {
    if (istemciTel && istemciTel !== profilTel) {
      structuredLog('WARN', 'db-transaction', 'İlan telefonu istemciden farklı geldi — profil numarası kullanıldı', {
        user_id: userId,
        istemci_tel_son4: istemciTel.slice(-4),
        profil_tel_son4: profilTel.slice(-4),
      });
    }
    return { ok: true, tel: profilTel };
  }

  if (istemciTel) {
    if (!/^0\d{10}$/.test(istemciTel)) {
      return { ok: false, hata: 'Telefon numarası 11 haneli olmalı (05xx xxx xx xx).' };
    }
    await svc.from('users').update({ phone: istemciTel }).eq('id', userId);
    return { ok: true, tel: istemciTel };
  }

  return { ok: false, hata: 'İletişim telefonu gerekli. Profilinizden telefon numaranızı ekleyin.' };
}

// ── Ana yazma yolu ─────────────────────────────────────────────────────────

/**
 * Doğrular, yazar, moderasyon kararını verir.
 *
 * @param userId  OTURUMDAN okunmuş kullanıcı kimliği. ⚠️ Asla istemciden alma.
 * @param kaynak  `listings.source`. Beyaz listeli; istemci belirleyemez.
 */
export async function ilanYaz(
  userId: string,
  girdi: IlanYazGirdi,
  kaynak: IlanKaynak = 'form',
): Promise<IlanYazSonuc> {
  const svc = getServiceSupabase();

  // ── V1: doğrulama. İstemcideki kontrollerin AYNISI — istemciye GÜVENME.
  const tip = girdi.tip === 'arac' ? 'arac' : 'yuk';

  // Çift yazım (`docs/COGRAFI_GECIS.md` Dalga 2): tek çağrıda hem kanonik metin
  // hem plaka id'si. `ilCiftYazim` içeride `ilId`'yi çağırıyor ve o da aynı
  // katlama (`ilKey`) ile eşleşiyor — yani `ilNormalize`'ın döndürdüğü adla
  // birebir aynı sonucu üretir, üstüne id'yi de verir.
  const kalkisIl = ilCiftYazim(girdi.kalkis);
  if (!kalkisIl) {
    return { ok: false, hata: 'Kalkış ili tanınamadı. Listeden bir il seçin.' };
  }
  const kalkis = kalkisIl.ad;
  const kalkisIlce = ilceNormalize(kalkisIl.id, girdi.kalkis_ilce);

  const ham = Array.isArray(girdi.duraklar) ? girdi.duraklar : [];
  const durakGirdileri = ham.filter(d => d && typeof d.sehir === 'string' && d.sehir.trim());
  if (durakGirdileri.length === 0) {
    return { ok: false, hata: 'En az bir varış durağı gerekli.' };
  }
  if (durakGirdileri.length > MAX_DURAK) {
    return { ok: false, hata: `En fazla ${MAX_DURAK} durak eklenebilir.` };
  }

  const genelYukCinsi = kisaMetin(girdi.yuk_cinsi);

  const duraklar: Array<{
    city: string; province_id: number; district: string | null;
    district_official: boolean | null; ton: number | null;
    palet: number | null; notlar: string | null; yuk_cinsi: string | null;
  }> = [];
  for (const d of durakGirdileri) {
    const il = ilCiftYazim(d.sehir);
    if (!il) {
      return { ok: false, hata: `Varış ili tanınamadı: "${String(d.sehir).slice(0, 30)}". Listeden seçin.` };
    }
    // İlçe ile BAĞLI çözülüyor: "Kadıköy" İstanbul'un resmî ilçesi, Ankara'nın
    // değil. `ilceNormalize` serbest girişi reddetmiyor, `resmi:false` ile
    // işaretliyor (spec md.7 — "İkitelli", "İSTOÇ" gibi adlar kullanımda).
    const ilce = ilceNormalize(il.id, d.ilce);
    duraklar.push({
      city: il.ad,
      province_id: il.id,
      district: ilce?.ad ?? null,
      district_official: ilce?.resmi ?? null,
      ton: sayiAralik(d.ton, 0, MAX_TON),
      palet: tamSayiAralik(d.palet, 0, MAX_PALET),
      notlar: kisaMetin(d.notlar, MAX_NOT),
      // B4: durağın kendi yük cinsi varsa o, yoksa ilan geneli.
      yuk_cinsi: kisaMetin(d.yuk_cinsi) ?? genelYukCinsi,
    });
  }

  const tarih = typeof girdi.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(girdi.tarih)
    ? girdi.tarih
    : null;
  if (!tarih) return { ok: false, hata: 'Geçerli bir tarih seçin.' };
  if (tarih < bugunISO()) return { ok: false, hata: 'Geçmiş bir tarih seçilemez.' };

  const fiyat = sayiAralik(girdi.fiyat, 0, MAX_FIYAT);
  if (girdi.fiyat && fiyat === null) {
    return { ok: false, hata: 'Geçersiz fiyat.' };
  }

  const aracAdet = tamSayiAralik(girdi.arac_adet ?? 1, 1, MAX_ARAC_ADET);
  if (aracAdet === null) {
    return { ok: false, hata: `Araç adedi 1 ile ${MAX_ARAC_ADET} arasında olmalı.` };
  }

  // Beyaz liste: listede olmayan değer sessizce DÜŞER.
  const aracTipi = girdi.arac_tipi && ARAC_TIPI_SETI.has(girdi.arac_tipi)
    ? [girdi.arac_tipi]
    : null;
  const utsyapi = Array.isArray(girdi.utsyapi)
    ? girdi.utsyapi.filter(u => UTSYAPI_SETI.has(u)).slice(0, UTSYAPI_SETI.size)
    : [];

  // ── B3: araç bağlantısı ───────────────────────────────────────────────────
  // Kullanıcı `/ilan-ver`'de kendi araçlarından birini seçiyor; o seçim şimdiye
  // kadar hiçbir yere yazılmıyordu. Yazıyoruz — ama id'ye GÜVENMİYORUZ:
  // istemci başkasının plakasını gönderebilir. `user_id` + `is_active` ile
  // doğrulanmayan id sessizce düşer (ilanı reddetmek kullanıcıyı cezalandırır;
  // burada kaybedilen tek şey bir ilişki kaydı).
  let aracId: string | null = null;
  const aracIdHam = typeof girdi.arac_id === 'string' ? girdi.arac_id.trim() : '';
  if (tip === 'arac' && /^[0-9a-f-]{36}$/i.test(aracIdHam)) {
    const { data: arac } = await svc
      .from('vehicles')
      .select('id')
      .eq('id', aracIdHam)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (arac?.id) {
      aracId = arac.id as string;
    } else {
      structuredLog('WARN', 'db-transaction', 'İlana bağlanmak istenen araç doğrulanamadı', {
        user_id: userId,
        vehicle_id: aracIdHam,
        source: kaynak,
      });
    }
  }

  // ── V2: telefon
  const telSonuc = await ilanTelefonu(userId, girdi.tel);
  if (!telSonuc.ok) return { ok: false, hata: telSonuc.hata };

  // ── ATOMİK YAZMA (V5) ─────────────────────────────────────────────────────
  // İlan ve durakları TEK transaction'da yazılır: `public.ilan_olustur()` RPC'si.
  //
  // Eskiden iki ayrı PostgREST isteğiydi ve her istek kendi transaction'ıydı;
  // durak insert'i patlarsa geriye DURAKSIZ ilan kalıyordu. Telafi edici bir
  // `delete` konmuştu ama o istek de patlayabilir — telafi ≠ atomiklik.
  //
  // `moderation_status`/`status` burada iyimser yazılıyor; nihai karar aşağıda,
  // trigger'ın hesapladığı `audit_score` okunduktan sonra veriliyor (V3).
  //
  // ⚠️ Migration: `docs/20260729_ilan_olustur_rpc.sql` — KODDAN ÖNCE çalışmalı.
  const aiIle = Boolean(girdi.ai_parsed || girdi.raw_text);
  const { data: rpcSonuc, error } = await svc.rpc('ilan_olustur', {
    p_listing: {
      listing_type: tip,
      origin_city: kalkis,
      origin_province_id: kalkisIl.id,
      origin_district: kalkisIlce?.ad ?? null,
      origin_district_official: kalkisIlce?.resmi ?? null,
      contact_phone: telSonuc.tel,
      price_offer: fiyat,
      price_negotiable: Boolean(girdi.fiyat_pazarlik),
      available_date: tarih,
      date_flexible: Boolean(girdi.tarih_esnek),
      notes: kisaMetin(girdi.genel_not, MAX_NOT),
      raw_text: kisaMetin(girdi.raw_text, MAX_RAW_TEXT),
      source: kaynak,
      moderation_status: 'auto_published',
      status: 'active',
      trust_level: 'verified',
      user_id: userId,
      vehicle_id: aracId,
      vehicle_type: aracTipi,
      body_type: utsyapi.length > 0 ? utsyapi : null,
      // `stop_order` fonksiyon içinde `with ordinality` ile üretiliyor;
      // araç adedi tüm duraklara aynı yazılıyor (mevcut davranış korundu).
      arac_adet: aracAdet,
    },
    p_stops: duraklar.map(d => ({
      city: d.city,
      district: d.district,
      cargo_type: d.yuk_cinsi,
      weight_ton: d.ton,
      pallet_count: d.palet,
      notes: d.notlar,
    })),
  });

  const listing = rpcSonuc as {
    id: string;
    audit_score: number | null;
    moderation_status: string | null;
    is_shadow_banned: boolean | null;
  } | null;

  if (error || !listing?.id) {
    structuredLog('ERROR', 'db-transaction', 'İlan oluşturma hatası', {
      user_id: userId,
      error_message: error?.message ?? 'rpc null döndü',
      error_code: error?.code,
      listing_type: tip,
      origin_city: kalkis,
      stop_count: duraklar.length,
      source: kaynak,
    });
    // PGRST202 = fonksiyon yok → migration çalıştırılmamış. Ayırt edilebilir olsun.
    return {
      ok: false,
      hata: error?.code === 'PGRST202'
        ? 'İlan kaydedilemedi: sunucu güncellemesi eksik. Lütfen yöneticiye bildirin.'
        : 'İlan kaydedilemedi. Lütfen tekrar deneyin.',
    };
  }

  // ── V3: moderasyon kararı ─────────────────────────────────────────────────
  // Eşikler `system_config`'ten; `/api/ilan/duzelt` ile BİREBİR aynı mantık.
  const { autoPublishScoreMax, rejectScoreMin } = await getAuditThresholds();
  const skor = Number(listing.audit_score ?? 0);

  let durum: IlanDurumu;
  let mesaj: string;

  if (skor >= rejectScoreMin || listing.is_shadow_banned || listing.moderation_status === 'archived') {
    // Trigger zaten `is_shadow_banned` + `archived` yaptı; dokunma, sadece dürüst ol.
    durum = 'reddedildi';
    mesaj = 'İlanınız otomatik kontrolden geçemedi ve yayına alınmadı. Panelinizden düzenleyip tekrar gönderebilirsiniz.';
  } else if (skor >= autoPublishScoreMax || KANAL_POLITIKA[kaynak].daimaIncele) {
    const { error: modError } = await svc
      .from('listings')
      .update({ moderation_status: 'pending', status: 'passive' })
      .eq('id', listing.id);
    if (modError) {
      // Kuyruğa alamadıysak ilan YAYINDA kalır — sessizce geçme, görünür iz bırak.
      structuredLog('ERROR', 'db-transaction', 'Orta bant ilanı kuyruğa alınamadı — ilan yayında kaldı', {
        user_id: userId,
        listing_id: listing.id,
        audit_score: skor,
        error_message: modError.message,
      });
    }
    durum = 'incelemede';
    mesaj = 'İlanınız alındı ve moderatör incelemesine gönderildi. Onaylandığında yayına alınacak.';
  } else {
    durum = 'yayinda';
    mesaj = tip === 'yuk'
      ? 'İlanınız yayında. Nakliyeciler artık görebilir.'
      : 'İlanınız yayında. Yük sahipleri artık görebilir.';
  }

  structuredLog('INFO', 'db-transaction', 'İlan oluşturuldu', {
    user_id: userId,
    listing_id: listing.id,
    listing_type: tip,
    origin_city: kalkis,
    stop_count: duraklar.length,
    vehicle_id: aracId,
    audit_score: skor,
    durum,
    ai_parsed: aiIle,
    source: kaynak,
  });

  return { ok: true, id: listing.id, durum, mesaj };
}
