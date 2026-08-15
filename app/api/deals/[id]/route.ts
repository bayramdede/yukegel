import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';
import { structuredLog } from '../../../../lib/logger';

export const runtime = 'nodejs';

/** Çift kör değerlendirme penceresi (PRD md.1). */
const KOR_PENCERE_GUN = 14;

/**
 * PATCH /api/deals/[id] — durum geçişleri (GuvenEtkilesim PRD md.2)
 *
 * Body: { action: 'onayla' | 'reddet' | 'yola_cikti' | 'tamamla' | 'iptal',
 *         cancel_reason?: string, cancel_type?: 'anlasma' | 'is' }
 *
 * 🚨 YETKİ TABLOSU — her geçişin KİM tarafından yapılabileceği burada tanımlı.
 *    Bu tablonun gevşek olması modülün tamamını çürütür: örneğin nakliyeci
 *    kendi kaydını `matched` yapabilse ilan verenin onayı anlamsızlaşır.
 *      onayla / reddet : YALNIZ shipper (ilan veren)
 *      yola_cikti      : YALNIZ carrier (yükü o taşıyor)
 *      tamamla         : shipper TEK BAŞINA tamamlar (15 Ağu 2026 — Bayram:
 *                        "işin sahibi tamamlandı diyorsa karşı taraftan onay
 *                        bekleme"); carrier'ın beyanı hâlâ tek başına
 *                        YETERSİZ, shipper onayı gerekir.
 *      iptal           : İKİ TARAF (tamamlanmadan önce) — AMA `cancel_type:'is'`
 *                        (yükün kendisi iptal) YALNIZ shipper; nakliyeci yalnız
 *                        `'anlasma'` (eşleşme bozuldu) seçebilir, bkz. 11 Ağu notu.
 *
 * 🚨 11 Ağu 2026 — BULUNAN BUG: `matched`/`in_transit` bir kayıt iptal
 *    edildiğinde `listings.status` HİÇ geri alınmıyordu — "onayla" onu
 *    `passive` yapıyor ama `iptal` onu geri `active` yapmıyordu. Sonuç: araç
 *    gelmese/anlaşma bozulsa bile ilan sonsuza kadar yayından düşük kalıyordu.
 *    Düzeltme `cancel_type` ile geldi:
 *      'anlasma' — eşleşme bozuldu (ör. araç gelmedi), İŞ HÂLÂ GEÇERLİ →
 *                  `listings.status` geri `active`e döner, yeni bir nakliyeci
 *                  talep edebilir.
 *      'is'      — işin/yükün kendisi iptal oldu → `listings` `passive`
 *                  KALIR (zaten öyleydi, ekstra işlem gerekmez).
 *    `cancel_type` yalnız ZATEN mühürlenmiş (`matched`/`in_transit`) bir
 *    kaydı iptal ederken ZORUNLU — o ana kadar `listings` hiç `passive`
 *    olmadığı için (`requested` durumunda "reddet"/"iptal" ile geri alınacak
 *    bir şey yok), eski basit (yalnız serbest metin) akış orada AYNEN kalıyor.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const {
    action, cancel_reason, cancel_type,
    vehicle_plate, driver_name, dispatch_notes,
    stage, external_carrier_name, external_carrier_phone,
  } = await req.json().catch(() => ({}));
  const svc = getServiceSupabase();

  const { data: deal } = await svc
    .from('deals')
    .select('id, listing_id, shipper_id, carrier_id, status, completed_declared_by, completed_declared_at, payment_terms_days, shipment_stage')
    .eq('id', id)
    .maybeSingle();

  if (!deal) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  const isShipper = deal.shipper_id === user.id;
  const isCarrier = deal.carrier_id === user.id;
  if (!isShipper && !isCarrier) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const simdi = new Date().toISOString();
  let yama: Record<string, unknown> = {};

  switch (action) {
    // ── Mühürleme (PRD: "onayladığı an süreç mühürlenir") ────────────────
    case 'onayla': {
      if (!isShipper) return NextResponse.json({ error: 'Yalnız ilan veren onaylayabilir.' }, { status: 403 });
      if (deal.status !== 'requested') {
        return NextResponse.json({ error: `'${deal.status}' durumundaki kayıt onaylanamaz.` }, { status: 409 });
      }
      yama = { status: 'matched', matched_at: simdi };
      break;
    }

    case 'reddet': {
      if (!isShipper) return NextResponse.json({ error: 'Yalnız ilan veren reddedebilir.' }, { status: 403 });
      if (deal.status !== 'requested') {
        return NextResponse.json({ error: 'Yalnız bekleyen talep reddedilebilir.' }, { status: 409 });
      }
      yama = { status: 'cancelled', cancelled_at: simdi, cancelled_by: user.id,
               cancel_reason: typeof cancel_reason === 'string' ? cancel_reason.slice(0, 500) : null };
      break;
    }

    case 'yola_cikti': {
      if (!isCarrier) return NextResponse.json({ error: 'Yalnız nakliyeci bu adımı yapabilir.' }, { status: 403 });
      if (deal.status !== 'matched') {
        return NextResponse.json({ error: 'Yalnız mühürlenmiş kayıt yola çıkabilir.' }, { status: 409 });
      }
      const plaka = typeof vehicle_plate === 'string' ? vehicle_plate.trim().toUpperCase().replace(/\s/g, '').slice(0, 15) : null;
      const sofor = typeof driver_name === 'string' ? driver_name.trim().slice(0, 100) : null;
      const dispatchNot = typeof dispatch_notes === 'string' ? dispatch_notes.trim().slice(0, 500) : null;
      // Plaka varsa kayıtlı araçlara ekle / güncelle (son kullanım tarihi yenile).
      if (plaka) {
        await svc.from('carrier_vehicles').upsert(
          { user_id: user.id, plate: plaka, driver_name: sofor, last_used_at: simdi },
          { onConflict: 'user_id,plate' }
        );
      }
      yama = {
        status: 'in_transit', transit_at: simdi,
        ...(plaka ? { vehicle_plate: plaka } : {}),
        ...(sofor ? { driver_name: sofor } : {}),
        ...(dispatchNot ? { dispatch_notes: dispatchNot } : {}),
      };
      break;
    }

    // ── Tamamlama ──────────────────────────────────────────────────────
    // 15 Ağu 2026 — Bayram: "işin sahibi tamamlandı diyorsa karşı taraftan
    // onay bekleme." İlan sahibi (shipper) işin gerçek muhatabı ve ödemeyi
    // yapan taraf; kararını TEK BAŞINA verebilir, artık beklemiyor. Nakliyeci
    // beyanı hâlâ tek başına YETERLİ DEĞİL — bir nakliyeci "işi bitirdim"
    // deyip inceleme/ödeme sürecini tek taraflı tetikleyemesin diye şipperın
    // onayını bekliyor (eski PRD md.2 "beyan + karşı onay" YALNIZ bu yönde
    // korundu).
    case 'tamamla': {
      if (!['matched', 'in_transit'].includes(deal.status)) {
        return NextResponse.json({ error: 'Bu kayıt tamamlanabilir durumda değil.' }, { status: 409 });
      }
      const vade = deal.payment_terms_days;
      const tamamlamaAlanlari = {
        status: 'completed' as const,
        completed_at: simdi,
        review_deadline: new Date(Date.now() + KOR_PENCERE_GUN * 86400_000).toISOString(),
        ...(vade !== null && vade !== undefined
          ? { payment_maturity_date: new Date(Date.now() + vade * 86400_000).toISOString().slice(0, 10) }
          : {}),
      };
      if (isShipper) {
        // Nakliyeci daha önce beyan ettiyse o ilk beyan zamanı korunur;
        // etmediyse beyan eden taraf da shipper'ın kendisi sayılır.
        yama = {
          ...tamamlamaAlanlari,
          completed_declared_by: deal.completed_declared_by ?? user.id,
          completed_declared_at: deal.completed_declared_at ?? simdi,
        };
        break;
      }
      // Nakliyeci: yalnız beyan edebilir, ilan sahibinin onayı gerekiyor.
      if (!deal.completed_declared_by) {
        yama = { completed_declared_by: user.id, completed_declared_at: simdi };
        break;
      }
      // 🚨 Aynı kişi iki kez basarak tek taraflı tamamlayamaz.
      if (deal.completed_declared_by === user.id) {
        return NextResponse.json({
          error: 'Tamamlandı beyanınız alındı; ilan sahibinin onayı bekleniyor.',
        }, { status: 409 });
      }
      // Bu satıra normalde erişilmez artık (shipper her zaman yukarıda tek
      // başına tamamlıyor) — yalnız güvenlik ağı olarak bırakıldı.
      yama = tamamlamaAlanlari;
      break;
    }

    case 'iptal': {
      if (deal.status === 'completed') {
        return NextResponse.json({ error: 'Tamamlanmış kayıt iptal edilemez.' }, { status: 409 });
      }
      if (deal.status === 'cancelled') {
        return NextResponse.json({ error: 'Kayıt zaten iptal.' }, { status: 409 });
      }
      // Yalnız ZATEN mühürlenmiş (listings'i passive yapmış) bir kaydı iptal
      // ederken cancel_type ZORUNLU — aşağıdaki yan etki bunsuz hangi yöne
      // gideceğini bilemez. 'requested' durumunda listings hiç dokunulmadığı
      // için bu ayrım anlamsız, eski basit akış geçerli.
      const muhurlenmisti = ['matched', 'in_transit'].includes(deal.status);
      if (muhurlenmisti && cancel_type !== 'anlasma' && cancel_type !== 'is') {
        return NextResponse.json({
          error: 'İptal türü belirtilmeli: anlaşma mı, iş mi iptal oldu?',
        }, { status: 400 });
      }
      // 🚨 11 Ağu 2026 — Bayram: "teklif veren sadece anlaşmayı iptal edebilir,
      // yükü iptal edemez; yükü sadece yükün/ilanın sahibi iptal edebilir."
      // `anlasma` (eşleşme bozuldu, iş hâlâ geçerli) İKİ TARAF için de mantıklı
      // — nakliyeci de "araç gidemeyecek" diyebilir. `is` (yükün kendisi
      // ortadan kalktı, ilan bir daha YAYINA DÖNMEZ) yalnız YÜKÜN sahibinin
      // kararı olmalı; nakliyeci bunu seçebilseydi, ilan sahibinin haberi
      // olmadan o kişinin ilanını KALICI OLARAK kapatabilirdi.
      if (muhurlenmisti && cancel_type === 'is' && !isShipper) {
        return NextResponse.json({
          error: 'Yükün kendisini yalnız ilan sahibi iptal edebilir. Siz yalnız anlaşmayı iptal edebilirsiniz.',
        }, { status: 403 });
      }
      yama = { status: 'cancelled', cancelled_at: simdi, cancelled_by: user.id,
               cancel_type: muhurlenmisti ? cancel_type : null,
               cancel_reason: typeof cancel_reason === 'string' ? cancel_reason.slice(0, 500) : null };
      break;
    }

    // ── Sevkiyat aşama ilerlemesi — YALNIZ ilan sahibi (shipper) yönetir.
    // Sistem dışı nakliyeciler için de kullanılır (carrier_id IS NULL).
    case 'stage_ilerle': {
      if (!isShipper) {
        return NextResponse.json({ error: 'Sevkiyat takibi yalnız ilan sahibi tarafından yapılabilir.' }, { status: 403 });
      }
      if (!['matched', 'in_transit'].includes(deal.status)) {
        return NextResponse.json({ error: 'Sevkiyat takibi yalnız aktif anlaşmalarda yapılabilir.' }, { status: 409 });
      }
      const ASAMALAR = ['assigned', 'loaded', 'on_road', 'delivered'] as const;
      type Asama = typeof ASAMALAR[number];
      if (!ASAMALAR.includes(stage as Asama)) {
        return NextResponse.json({ error: 'Geçersiz aşama.' }, { status: 400 });
      }
      const oncekiIdx = ASAMALAR.indexOf((deal.shipment_stage ?? '') as Asama);
      const yeniIdx = ASAMALAR.indexOf(stage as Asama);
      if (yeniIdx <= oncekiIdx) {
        return NextResponse.json({ error: 'Önceki bir aşamaya geçilemez.' }, { status: 409 });
      }

      const plaka = typeof vehicle_plate === 'string' ? vehicle_plate.trim().toUpperCase().replace(/\s/g, '').slice(0, 15) : null;
      const sofor = typeof driver_name === 'string' ? driver_name.trim().slice(0, 100) : null;
      const dispatchNot = typeof dispatch_notes === 'string' ? dispatch_notes.trim().slice(0, 500) : null;
      const hariciAd = typeof external_carrier_name === 'string' ? external_carrier_name.trim().slice(0, 200) : null;
      const hariciTel = typeof external_carrier_phone === 'string' ? external_carrier_phone.trim().replace(/\s/g, '').slice(0, 20) : null;

      const ASAMA_TIMESTAMP: Record<string, string> = {
        assigned: 'assigned_at', loaded: 'loaded_at', on_road: 'on_road_at', delivered: 'delivered_at',
      };

      // 'assigned': araç/nakliyeci bilgisi + statüyü in_transit'e taşı.
      // Plakayı carrier_vehicles'a da kaydet — harici nakliyeciler için de
      // tekrar kullanılabilsin. (Sadece plaka girdiyse.)
      // 15 Ağu 2026 — nakliyeci adı/telefonu da kaydediliyor (`carrier_name`/
      // `carrier_phone` kolonları eklendi); önceden yalnız şoför adı
      // hatırlanıyordu, aynı plaka yeniden girildiğinde firma bilgisi kaybolurdu.
      if (stage === 'assigned' && plaka) {
        await svc.from('carrier_vehicles').upsert(
          { user_id: user.id, plate: plaka, driver_name: sofor, carrier_name: hariciAd, carrier_phone: hariciTel, last_used_at: simdi },
          { onConflict: 'user_id,plate' }
        );
      }

      const isExternalDeal = !deal.carrier_id;

      yama = {
        shipment_stage: stage,
        [ASAMA_TIMESTAMP[stage]]: simdi,
        ...(stage === 'assigned' ? {
          // Statü değişimi: matched → in_transit
          ...(deal.status === 'matched' ? { status: 'in_transit', transit_at: simdi } : {}),
          ...(plaka ? { vehicle_plate: plaka } : {}),
          ...(sofor ? { driver_name: sofor } : {}),
          ...(dispatchNot ? { dispatch_notes: dispatchNot } : {}),
          ...(hariciAd ? { external_carrier_name: hariciAd } : {}),
          ...(hariciTel ? { external_carrier_phone: hariciTel } : {}),
        } : {}),
        // 'delivered' = teslim edildi. Harici deal'de tek taraf yeter → hemen completed.
        // Yükegel deal'de shipper'ın tamamla beyanı sayılır (carrier henüz yapmadıysa
        // yarı-tamamlanmış; yapmışsa bu ikinci onay → completed).
        ...(stage === 'delivered' ? {
          completed_declared_by: user.id,
          completed_declared_at: simdi,
          ...(isExternalDeal || deal.completed_declared_by ? {
            status: 'completed',
            completed_at: simdi,
            review_deadline: new Date(Date.now() + KOR_PENCERE_GUN * 86400_000).toISOString(),
            ...(deal.payment_terms_days !== null && deal.payment_terms_days !== undefined
              ? { payment_maturity_date: new Date(Date.now() + deal.payment_terms_days * 86400_000).toISOString().slice(0, 10) }
              : {}),
          } : {}),
        } : {}),
      };
      break;
    }

    default:
      return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const { data: guncel, error } = await svc
    .from('deals')
    .update({ ...yama, updated_at: simdi })
    .eq('id', id)
    // ⚠️ Durum yarışına karşı: okuduğumuz durum hâlâ aynıysa yaz. İki taraf aynı
    //    anda "tamamla" derse ikisi de "beyan" yazıp onay adımı atlanabilirdi.
    .eq('status', deal.status)
    .select(`id, status, matched_at, transit_at, completed_declared_by, completed_at,
      review_deadline, payment_maturity_date, cancelled_at, cancel_type, cancel_reason,
      vehicle_plate, driver_name, dispatch_notes,
      shipment_stage, assigned_at, loaded_at, on_road_at, delivered_at,
      external_carrier_name, external_carrier_phone`)
    .maybeSingle();

  if (error) {
    structuredLog('ERROR', 'db-transaction', 'Anlaşma durumu güncellenemedi', {
      supabase_error: error.message, deal_id: id, action,
    });
    return NextResponse.json({ error: 'Güncellenemedi.' }, { status: 500 });
  }
  if (!guncel) {
    return NextResponse.json({ error: 'Kayıt bu arada değişti, sayfayı yenileyin.' }, { status: 409 });
  }

  // ── Mühürlenme yan etkileri ────────────────────────────────────────────
  if (action === 'onayla') {
    // Yük satıldı: ilan feed'den çıkar.
    // ⚠️ `listings.status` alfabesinde 'matched' YOK ve eklenmedi: feed, panel
    //    (`durumHesapla`), moderatör filtreleri ve indeksler 'active'/'passive'
    //    varsayıyor. Yeni bir durum eklemek o beş yeri birden değiştirmek
    //    demekti. Mühürlenmenin GERÇEĞİ `deals`te; `listings` yalnız yayından
    //    çekiliyor. (Panelde "Pasif" yerine "Anlaşıldı" göstermek FAZ 3'te.)
    await svc.from('listings').update({ status: 'passive' }).eq('id', deal.listing_id);

    // Rakip talepler otomatik düşer — yoksa nakliyeciler yanıt bekleyip kalır.
    await svc.from('deals')
      .update({ status: 'cancelled', cancelled_at: simdi, cancel_reason: 'Yük başka nakliyeciyle anlaşıldı' })
      .eq('listing_id', deal.listing_id)
      .eq('status', 'requested')
      .neq('id', id);
  }

  // ── İptal yan etkisi: mühürlenmiş bir kayıt bozulduğunda ────────────────
  // 🚨 11 Ağu 2026'da düzeltilen bug — bkz. dosya başındaki not. Yalnız
  // GERÇEKTEN mühürlenmiş (listings'i passive yapmış) bir kayıt iptal
  // olduğunda çalışır; 'requested' iptalinde listings hiç dokunulmamıştı.
  if (guncel.status === 'cancelled' && guncel.cancel_type === 'anlasma') {
    // Eşleşme bozuldu ama iş hâlâ geçerli — ilan tekrar canlıya döner ki
    // başka bir nakliyeci talep edebilsin.
    await svc.from('listings').update({ status: 'active' }).eq('id', deal.listing_id);
  }
  // cancel_type === 'is' için EK İŞLEM YOK: listings zaten passive, işin
  // kendisi bittiği için canlıya dönmemesi doğru — "İş iptal ise ilan
  // yayından kalkar" isteğinin karşılığı zaten bu (bir daha active olmaz).

  if (guncel.status === 'completed') {
    // Panelin "Tamamla" düğmesiyle tutarlı kalsın.
    // ⚠️ `listings.completed_at` TEK TARAFLI bir alandı; artık iki taraflı
    //    mutabakattan da doluyor. İkisi ayrışmasın diye burada da yazılıyor.
    await svc.from('listings')
      .update({ completed_at: simdi, status: 'passive' })
      .eq('id', deal.listing_id);
  }

  structuredLog('INFO', 'db-transaction', 'Anlaşma durumu değişti', {
    deal_id: id, action, yeni_durum: guncel.status, user_id: user.id,
  });

  return NextResponse.json({ success: true, deal: guncel });
}
