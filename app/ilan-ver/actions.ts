'use server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '../../lib/auth';
import { getAuditThresholds } from '../../lib/auditLimits';
import { structuredLog } from '../../lib/logger';
import { ARAC_TIPI_SETI, UTSYAPI_SETI, ilNormalize } from '../../lib/ilan-sabitler';

/**
 * ILAN_VER_ANALIZ W0 — "kanama durdur" (V1, V2, V3, V4, V9, V10).
 *
 * Eski hâli bu projenin EN AYRICALIKLI yazma yoluydu ve `app/panel/actions.ts`'teki
 * üç kazanımın hiçbirini taşımıyordu:
 *
 *  V1 — Gövde doğrudan service-role INSERT'e gidiyordu. Beyaz liste yok, sınır yok:
 *       `arac_adet: 999999`, 500 duraklı ilan, 2 MB'lık not, `utsyapi: ['<script>']`
 *       hepsi geçiyordu. RLS burada KORUMAZ; service-role RLS'i bypass eder.
 *  V2 — `contact_phone` İSTEMCİDEN geliyordu. Rakibin numarasını kendi ilanına
 *       yazmak devtools açmak kadar kolaydı. Artık oturumun profil numarası esas.
 *  V3 — `moderation_status: 'auto_published'` SABİTLENMİŞTİ. `audit_listing_fn`
 *       yalnızca `score >= reject_min` dalında bu alana dokunduğu için 31–70
 *       puanlık ORTA BANT fiilen yoktu: şüpheli ilan doğrudan yayına giriyordu.
 *       Artık INSERT sonrası skor okunup `/api/ilan/duzelt` ile AYNI eşik mantığı
 *       uygulanıyor (tek karar yeri olsun diye kasten birebir aynı).
 *  V4 — Ekran INSERT sonucunu hiç okumadan "İlanınız yayınlandı!" diyordu; trigger
 *       ilanı shadow-ban'lasa bile. Artık gerçek durum döndürülüyor.
 *  V9/V10 — `trust_level: 'verified'` koşulsuzdu ve action'ın kendi auth kapısı yoktu
 *       (yalnız `proxy.ts`'e bağımlıydı — tek katmanlı savunma, `SPRINT_01 M1`'de bir
 *       kez kırıldı). Artık oturum burada da doğrulanıyor.
 *
 * ⚠️ Aşağıdaki INSERT nesnesine YENİ ALAN EKLERKEN İKİ KEZ DÜŞÜN. İstemciden gelen
 * hiçbir değer `user_id`, `trust_level`, `moderation_status`, `is_shadow_banned`,
 * `status`, `audit_score`, `internal_audit_logs`, `source`, `claimed_at` alanlarına
 * dokunmamalı.
 */

const MAX_DURAK = 10;
const MAX_ARAC_ADET = 50;
const MAX_FIYAT = 100_000_000;
const MAX_TON = 100_000;
const MAX_PALET = 10_000;
const MAX_NOT = 2000;
const MAX_KISA_METIN = 60;
const MAX_RAW_TEXT = 8000;

export type IlanDurumu = 'yayinda' | 'incelemede' | 'reddedildi';

export type IlanKaydetSonuc =
  | { ok: true; id: string; durum: IlanDurumu; mesaj: string }
  | { ok: false; hata: string };

export interface IlanKaydetGirdi {
  tip: string;
  kalkis: string;
  kalkis_ilce: string;
  tel: string;
  fiyat: string;
  fiyat_pazarlik: boolean;
  tarih: string;
  tarih_esnek: boolean;
  genel_not: string;
  arac_tipi: string;
  utsyapi: string[];
  arac_adet: number;
  yuk_cinsi: string;
  duraklar: Array<{
    sehir: string;
    ilce: string;
    ton: string;
    palet: string;
    notlar: string;
  }>;
  raw_text?: string;
  ai_parsed?: boolean;
}

// ── Yardımcılar ────────────────────────────────────────────────────────────

function kisaMetin(v: unknown, max = MAX_KISA_METIN): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function sayiAralik(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function bugunISO(): string {
  // Sunucu UTC'de koşuyor; Türkiye +03:00. `PROJE_HARITASI §9`: offset'siz
  // `new Date()` host TZ'ye göre kayar ve gün sınırında bir gün geriye düşer.
  const tr = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return tr.toISOString().split('T')[0];
}

async function oturumKullanicisi() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

// ── Ana action ─────────────────────────────────────────────────────────────

export async function ilanKaydet(formData: IlanKaydetGirdi): Promise<IlanKaydetSonuc> {
  // ── V10: auth kapısı BURADA. `proxy.ts`'e güvenip atlamıyoruz.
  const user = await oturumKullanicisi();
  if (!user) {
    return { ok: false, hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };
  }

  const svc = getServiceSupabase();

  // ── V1: doğrulama. İstemcideki kontrollerin AYNISI — istemciye GÜVENME.
  const tip = formData.tip === 'arac' ? 'arac' : 'yuk';

  const kalkis = ilNormalize(formData.kalkis);
  if (!kalkis) {
    return { ok: false, hata: 'Kalkış ili tanınamadı. Listeden bir il seçin.' };
  }

  const ham = Array.isArray(formData.duraklar) ? formData.duraklar : [];
  const durakGirdileri = ham.filter(d => d && typeof d.sehir === 'string' && d.sehir.trim());
  if (durakGirdileri.length === 0) {
    return { ok: false, hata: 'En az bir varış durağı gerekli.' };
  }
  if (durakGirdileri.length > MAX_DURAK) {
    return { ok: false, hata: `En fazla ${MAX_DURAK} durak eklenebilir.` };
  }

  const duraklar: Array<{
    city: string; district: string | null; ton: number | null;
    palet: number | null; notlar: string | null;
  }> = [];
  for (const d of durakGirdileri) {
    const city = ilNormalize(d.sehir);
    if (!city) {
      return { ok: false, hata: `Varış ili tanınamadı: "${String(d.sehir).slice(0, 30)}". Listeden seçin.` };
    }
    duraklar.push({
      city,
      district: kisaMetin(d.ilce),
      ton: sayiAralik(d.ton, 0, MAX_TON),
      palet: sayiAralik(d.palet, 0, MAX_PALET),
      notlar: kisaMetin(d.notlar, MAX_NOT),
    });
  }

  const tarih = typeof formData.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData.tarih)
    ? formData.tarih
    : null;
  if (!tarih) return { ok: false, hata: 'Geçerli bir tarih seçin.' };
  if (tarih < bugunISO()) return { ok: false, hata: 'Geçmiş bir tarih seçilemez.' };

  const fiyat = sayiAralik(formData.fiyat, 0, MAX_FIYAT);
  if (formData.fiyat && fiyat === null) {
    return { ok: false, hata: 'Geçersiz fiyat.' };
  }

  const aracAdet = sayiAralik(formData.arac_adet, 1, MAX_ARAC_ADET);
  if (aracAdet === null) {
    return { ok: false, hata: `Araç adedi 1 ile ${MAX_ARAC_ADET} arasında olmalı.` };
  }

  // Beyaz liste: listede olmayan değer sessizce DÜŞER (istemci zaten süzüyor;
  // buraya düşen bir değer ya eski bir istemci ya da elle yapılmış istek demektir).
  const aracTipi = ARAC_TIPI_SETI.has(formData.arac_tipi) ? [formData.arac_tipi] : null;
  const utsyapi = Array.isArray(formData.utsyapi)
    ? formData.utsyapi.filter(u => UTSYAPI_SETI.has(u)).slice(0, UTSYAPI_SETI.size)
    : [];

  // ── V2: telefon İSTEMCİDEN DEĞİL, oturumun profilinden.
  const { data: profil } = await svc
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();

  const profilTel = String(profil?.phone ?? '').replace(/\D/g, '');
  const istemciTel = String(formData.tel ?? '').replace(/\D/g, '');
  let tel: string | null = null;

  if (/^0\d{10}$/.test(profilTel)) {
    tel = profilTel;
    if (istemciTel && istemciTel !== profilTel) {
      // Sessizce düzeltiyoruz ama iz bırakıyoruz: bu ya eski bir istemci ya da
      // başkasının numarasını yazma denemesi. İkisini de görmek istiyoruz.
      structuredLog('WARN', 'db-transaction', 'İlan telefonu istemciden farklı geldi — profil numarası kullanıldı', {
        user_id: user.id,
        istemci_tel_son4: istemciTel.slice(-4),
        profil_tel_son4: profilTel.slice(-4),
      });
    }
  } else if (istemciTel) {
    if (!/^0\d{10}$/.test(istemciTel)) {
      return { ok: false, hata: 'Telefon numarası 11 haneli olmalı (05xx xxx xx xx).' };
    }
    // Profilde numara yok — kabul et ve profile YAZ ki bir daha bu daldan geçilmesin.
    tel = istemciTel;
    await svc.from('users').update({ phone: tel }).eq('id', user.id);
  }

  if (!tel) {
    return { ok: false, hata: 'İletişim telefonu gerekli. Profilinizden telefon numaranızı ekleyin.' };
  }

  // ── INSERT ────────────────────────────────────────────────────────────────
  // `moderation_status`/`status` burada iyimser yazılıyor; nihai karar aşağıda,
  // trigger'ın hesapladığı `audit_score` okunduktan sonra veriliyor (V3).
  const aiIle = Boolean(formData.ai_parsed || formData.raw_text);
  const { data: listing, error } = await svc
    .from('listings')
    .insert({
      listing_type: tip,
      origin_city: kalkis,
      origin_district: kisaMetin(formData.kalkis_ilce),
      contact_phone: tel,
      price_offer: fiyat,
      price_negotiable: Boolean(formData.fiyat_pazarlik),
      available_date: tarih,
      date_flexible: Boolean(formData.tarih_esnek),
      notes: kisaMetin(formData.genel_not, MAX_NOT),
      raw_text: kisaMetin(formData.raw_text, MAX_RAW_TEXT),
      source: 'form',
      moderation_status: 'auto_published',
      status: 'active',
      trust_level: 'verified',
      user_id: user.id,
      vehicle_type: aracTipi,
      body_type: utsyapi.length > 0 ? utsyapi : null,
    })
    .select('id, audit_score, moderation_status, is_shadow_banned')
    .single();

  if (error || !listing) {
    structuredLog('ERROR', 'db-transaction', 'İlan oluşturma hatası', {
      user_id: user.id,
      error_message: error?.message ?? 'listing null',
      listing_type: tip,
      origin_city: kalkis,
    });
    return { ok: false, hata: 'İlan kaydedilemedi. Lütfen tekrar deneyin.' };
  }

  // ── Duraklar ──────────────────────────────────────────────────────────────
  const { error: stopError } = await svc.from('listing_stops').insert(
    duraklar.map((d, i) => ({
      listing_id: listing.id,
      stop_order: i + 1,
      city: d.city,
      district: d.district,
      vehicle_count: aracAdet,
      cargo_type: kisaMetin(formData.yuk_cinsi),
      weight_ton: d.ton,
      pallet_count: d.palet,
      notes: d.notlar,
    }))
  );

  if (stopError) {
    // Duraksız ilan hiçbir işe yaramaz — "nereye?" sorusuna cevap veremez.
    // Tam çözüm tek RPC (V5); şimdilik telafi edici silme ile yetim kayıt bırakmıyoruz.
    await svc.from('listings').delete().eq('id', listing.id);
    structuredLog('ERROR', 'db-transaction', 'İlan durak oluşturma hatası — ilan geri alındı', {
      user_id: user.id,
      listing_id: listing.id,
      error_message: stopError.message,
    });
    return { ok: false, hata: 'İlan kaydedilemedi (duraklar yazılamadı). Lütfen tekrar deneyin.' };
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
  } else if (skor >= autoPublishScoreMax) {
    const { error: modError } = await svc
      .from('listings')
      .update({ moderation_status: 'pending', status: 'passive' })
      .eq('id', listing.id);
    if (modError) {
      // Kuyruğa alamadıysak ilan YAYINDA kalır — sessizce geçme, görünür iz bırak.
      structuredLog('ERROR', 'db-transaction', 'Orta bant ilanı kuyruğa alınamadı — ilan yayında kaldı', {
        user_id: user.id,
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
    user_id: user.id,
    listing_id: listing.id,
    listing_type: tip,
    origin_city: kalkis,
    stop_count: duraklar.length,
    audit_score: skor,
    durum,
    ai_parsed: aiIle,
    source: 'form',
  });

  return { ok: true, id: listing.id, durum, mesaj };
}

export async function kullanicitelefon(): Promise<string | null> {
  const user = await oturumKullanicisi();
  if (!user) return null;

  // maybeSingle() — admin veya yeni kullanıcıda users satırı olmayabilir
  const { data } = await getServiceSupabase()
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();

  return data?.phone || null;
}
