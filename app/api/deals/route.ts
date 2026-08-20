import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../lib/auth';
import { structuredLog } from '../../../lib/logger';
import { bugunISO } from '../../../lib/ilan-yaz';

export const runtime = 'nodejs';

/**
 * POST /api/deals — "Bu İşi Al / Anlaş" (GuvenEtkilesim PRD md.2, 1. aşama)
 *
 * Nakliyeci TALEP oluşturur (`status='requested'`). Mühürleme İLAN VERENİN
 * onayıyla olur (`POST /api/deals/[id]/onayla`) — PRD: "İlan veren … onayladığı
 * an süreç mühürlenir."
 *
 * 🚨 `shipper_id` İSTEMCİDEN ALINMAZ, `listings.user_id`'den okunur. Aksi hâlde
 *    bir saldırgan kendini "ilan veren" ilan edip kendi kaydını kendi onaylar ve
 *    hiç iş yapmadan itibar üretirdi.
 */
export async function POST(req: NextRequest) {
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const {
    listing_id, payment_terms_days, agreed_price, note, carrier_phone_consent,
    external_carrier_name, external_carrier_phone, vehicle_plate, driver_name,
  } = await req.json().catch(() => ({}));
  if (!listing_id) return NextResponse.json({ error: 'listing_id gerekli' }, { status: 400 });

  // Anlaşılan fiyat — 11 Ağu 2026, talep ekranına eklendi. ZORUNLU: taraflar
  // "neye onay verdiğini" ancak bir rakam varsa görebilir, bkz. PROJE_HARITASI §15.
  const fiyat = typeof agreed_price === 'number' && Number.isFinite(agreed_price) ? agreed_price : null;
  if (fiyat === null || fiyat <= 0 || fiyat > 100_000_000) {
    return NextResponse.json({ error: 'Anlaşılan fiyat gerekli (geçerli bir tutar girin).' }, { status: 400 });
  }
  const notMetni = typeof note === 'string' && note.trim() !== '' ? note.trim().slice(0, 1000) : null;
  const vade = Number.isInteger(payment_terms_days)
    && payment_terms_days >= 0 && payment_terms_days <= 180
      ? payment_terms_days : null;

  const svc = getServiceSupabase();

  const { data: ilan } = await svc
    .from('listings')
    .select('id, user_id, status, moderation_status, is_shadow_banned, completed_at, is_recurring')
    .eq('id', listing_id)
    .maybeSingle();

  if (!ilan) return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });

  // Sürekli Yük (20 Ağu 2026) — bkz. docs/SUREKLI_YUK_YAZILIMCI_TALIMATI.md §4.2.
  // Bu ilan her gün yeniden "claim" edilebilir; `listings.status` HİÇ pasife
  // düşmez, tekillik GÜNE göre `deals_recurring_gun_tekil` / `_harici_gun_tekil`
  // kısmi indeksleriyle sağlanır (docs/20260820_surekli_yuk.sql).
  const recurringAktif = ilan.is_recurring === true;
  const bugun = bugunISO();

  // ⚠️ İlanların %99,95'i SAHİPSİZ (WhatsApp/kazıma kaynaklı, `user_id` NULL).
  //    Bu ilanlarda anlaşma tarafı yok; net hata vermek şart, yoksa kullanıcı
  //    butona basıp sessiz bir hiçlikle karşılaşır.
  if (!ilan.user_id) {
    return NextResponse.json({
      error: 'Bu ilan bir Yükegel hesabına bağlı değil. Sahibi ilanı sahiplenmeden anlaşma başlatılamaz.',
    }, { status: 409 });
  }
  // Kendi ilanına talep gönderemez — AMA harici nakliyeci ekleyebilir.
  if (ilan.user_id === user.id) {
    const hariciAd = typeof external_carrier_name === 'string' ? external_carrier_name.trim().slice(0, 200) : null;
    const hariciTel = typeof external_carrier_phone === 'string' ? external_carrier_phone.trim().replace(/\s/g, '').slice(0, 20) : null;
    const plaka = typeof vehicle_plate === 'string' ? vehicle_plate.trim().toUpperCase().replace(/\s/g, '').slice(0, 15) : null;
    const sofor = typeof driver_name === 'string' ? driver_name.trim().slice(0, 100) : null;

    if (!hariciAd && !plaka) {
      return NextResponse.json({ error: 'Kendi ilanınıza talep gönderemezsiniz. Harici nakliyeci eklemek için nakliyeci adı veya plaka girin.' }, { status: 400 });
    }

    // Zaten aktif bir harici sefer var mı? Sürekli yükte tekillik GÜNE göre —
    // dün girilmiş bir sefer bugünkü yeni kaydı engellemesin.
    let mevcutHariciQuery = svc.from('deals')
      .select('id').eq('listing_id', listing_id).is('carrier_id', null)
      .not('status', 'in', '("cancelled")');
    mevcutHariciQuery = recurringAktif
      ? mevcutHariciQuery.eq('is_recurring_deal', true).eq('deal_date', bugun)
      : mevcutHariciQuery;
    const { data: mevcutHarici } = await mevcutHariciQuery.maybeSingle();
    if (mevcutHarici) {
      return NextResponse.json({
        error: recurringAktif ? 'Bu yükü bugün için zaten kaydettiniz.' : 'Bu ilan için zaten aktif bir sefer kaydı var.',
      }, { status: 409 });
    }

    const simdi = new Date().toISOString();
    const { data: hariciDeal, error: hariciErr } = await svc.from('deals').insert({
      listing_id,
      shipper_id: user.id,
      carrier_id: null,
      status: 'matched',
      matched_at: simdi,
      agreed_price: fiyat,
      payment_terms_days: vade,
      note: notMetni,
      carrier_phone_consent: false,
      external_carrier_name: hariciAd,
      external_carrier_phone: hariciTel,
      vehicle_plate: plaka,
      driver_name: sofor,
      is_recurring_deal: recurringAktif,
      deal_date: recurringAktif ? bugun : null,
      // 15 Ağu 2026 — "Plaka Ata" burada plakayı ZATEN alıyor; sevkiyat
      // takibi (`SevkiyatTakip`, Anlaşmalarım) `shipment_stage` boşsa 1.
      // aşamayı ("Plaka Atandı") tekrar tekrar doldurulmuş bir formla
      // istiyordu — aynı bilgiyi iki kez girdirmek yerine plaka varsa
      // 'assigned' aşaması burada baştan işaretleniyor; bir sonraki
      // aşama doğrudan "Araç Yüklendi" olarak açılır.
      ...(plaka ? { shipment_stage: 'assigned', assigned_at: simdi } : {}),
    }).select('id, status, agreed_price, note, created_at, external_carrier_name, external_carrier_phone, vehicle_plate, driver_name').single();

    if (hariciErr) {
      // `deals_recurring_harici_gun_tekil` — yarış durumunda aynı gün iki kez basıldı.
      if (hariciErr.code === '23505') {
        return NextResponse.json({ error: 'Bu yükü bugün için zaten kaydettiniz.' }, { status: 409 });
      }
      structuredLog('ERROR', 'db-transaction', 'Harici sefer oluşturulamadı', { supabase_error: hariciErr.message, listing_id, user_id: user.id });
      return NextResponse.json({ error: 'Sefer kaydedilemedi.' }, { status: 500 });
    }

    // 15 Ağu 2026 — BUG: bu dal `carrier_vehicles`e hiç yazmıyordu, "aynı
    // plakayı başka bir işte yeniden yazınca önceki bilgiler gelmiyor"
    // şikâyetinin kök nedeni buydu (`stage_ilerle`/`yola_cikti` yazıyordu,
    // asıl kullanılan "Plaka Ata" burası yazmıyordu). `carrier_vehicles.plate`
    // NOT NULL + `unique(user_id, plate)` olduğu için yalnız plaka VARSA
    // yazılır — yoksa aynı plaka bir dahaki sefere hızlı seçimde çıkar.
    if (plaka) {
      await svc.from('carrier_vehicles').upsert(
        { user_id: user.id, plate: plaka, driver_name: sofor, carrier_name: hariciAd, carrier_phone: hariciTel, last_used_at: new Date().toISOString() },
        { onConflict: 'user_id,plate' }
      );
    }

    // İlan pasife al — yük sevkiyata girdi. Sürekli yükte YAPMA: ilan her gün
    // yeniden claim edilebilmeli, `status` hep `active` kalır (talimat §4.2).
    if (!recurringAktif) {
      await svc.from('listings').update({ status: 'passive' }).eq('id', listing_id);
    }

    structuredLog('INFO', 'db-transaction', 'Harici sefer oluşturuldu', { deal_id: hariciDeal.id, listing_id, user_id: user.id });
    return NextResponse.json({ success: true, deal: hariciDeal, harici: true });
  }
  if (ilan.completed_at) {
    return NextResponse.json({ error: 'Bu ilan tamamlanmış.' }, { status: 409 });
  }
  if (ilan.status !== 'active' || ilan.is_shadow_banned
      || !['approved', 'auto_published'].includes(ilan.moderation_status)) {
    return NextResponse.json({ error: 'Bu ilan şu anda yayında değil.' }, { status: 409 });
  }

  // Zaten mühürlenmiş bir anlaşma var mı? (kısmi unique indeks de korur ama
  // kullanıcıya 23505 değil anlaşılır mesaj dönmeli)
  // Sürekli yükte bu kontrol GÜNE daralır — dünkü `matched`/`completed` kaydı
  // bugünkü yeni talebi engellemez (ilan zaten hiç pasife düşmedi, yarın da
  // aynı ya da başka bir nakliyeci talep edebilmeli).
  let mevcutAnlasmaQuery = svc
    .from('deals')
    .select('id, carrier_id, status')
    .eq('listing_id', listing_id);
  mevcutAnlasmaQuery = recurringAktif
    ? mevcutAnlasmaQuery.eq('is_recurring_deal', true).eq('deal_date', bugun).in('status', ['requested', 'matched', 'in_transit', 'completed'])
    : mevcutAnlasmaQuery.in('status', ['matched', 'in_transit', 'completed']);
  const { data: mevcutAnlasma } = await mevcutAnlasmaQuery.maybeSingle();
  if (mevcutAnlasma) {
    return NextResponse.json({
      error: recurringAktif ? 'Bu yükü bugün zaten talep ettiniz.' : 'Bu yük için anlaşma çoktan yapılmış.',
    }, { status: 409 });
  }

  const { data: deal, error } = await svc
    .from('deals')
    .insert({
      listing_id,
      shipper_id: ilan.user_id,   // ← İSTEMCİDEN DEĞİL
      carrier_id: user.id,
      status: 'requested',
      payment_terms_days: vade,
      agreed_price: fiyat,
      note: notMetni,
      carrier_phone_consent: carrier_phone_consent === true,
      is_recurring_deal: recurringAktif,
      deal_date: recurringAktif ? bugun : null,
    })
    .select('id, status, agreed_price, note, created_at')
    .single();

  if (error) {
    // `deals_tekil` (normal ilan) / `deals_recurring_gun_tekil` (sürekli yük,
    // aynı gün aynı nakliyeci) — aynı nakliyeci ikinci kez talep etti
    if (error.code === '23505') {
      return NextResponse.json({
        error: recurringAktif ? 'Bu yükü bugün zaten talep ettiniz.' : 'Bu ilana zaten talep gönderdiniz.',
      }, { status: 409 });
    }
    structuredLog('ERROR', 'db-transaction', 'Anlaşma talebi oluşturulamadı', {
      supabase_error: error.message, listing_id, user_id: user.id,
    });
    return NextResponse.json({ error: 'Talep oluşturulamadı.' }, { status: 500 });
  }

  structuredLog('INFO', 'db-transaction', 'Anlaşma talebi oluşturuldu', {
    deal_id: deal.id, listing_id, carrier_id: user.id, shipper_id: ilan.user_id,
  });

  return NextResponse.json({ success: true, deal });
}

/**
 * GET /api/deals — oturum sahibinin taraf olduğu kayıtlar.
 * ⚠️ Servis rolüyle okunuyor ama filtre OTURUMDAN geliyor; istemci başkasının
 *    kayıtlarını isteyemez (RLS de ayrıca korur).
 */
export async function GET(req: NextRequest) {
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const rol = new URL(req.url).searchParams.get('rol'); // 'shipper' | 'carrier' | null
  const svc = getServiceSupabase();

  let q = svc.from('deals')
    .select(`id, listing_id, shipper_id, carrier_id, status, matched_at, transit_at,
             completed_declared_by, completed_declared_at, completed_at,
             payment_terms_days, payment_maturity_date, payment_declared_at,
             payment_confirmed_at, payment_disputed_at, review_deadline, created_at,
             agreed_price, note`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (rol === 'shipper')      q = q.eq('shipper_id', user.id);
  else if (rol === 'carrier') q = q.eq('carrier_id', user.id);
  else q = q.or(`shipper_id.eq.${user.id},carrier_id.eq.${user.id}`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data ?? [] });
}
