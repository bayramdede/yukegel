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
 *      tamamla         : İKİ TARAF (biri beyan eder, diğeri onaylar)
 *      iptal           : İKİ TARAF (tamamlanmadan önce)
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

  const { action, cancel_reason, cancel_type } = await req.json().catch(() => ({}));
  const svc = getServiceSupabase();

  const { data: deal } = await svc
    .from('deals')
    .select('id, listing_id, shipper_id, carrier_id, status, completed_declared_by, payment_terms_days')
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
      yama = { status: 'in_transit', transit_at: simdi };
      break;
    }

    // ── Tamamlama: BEYAN + KARŞI ONAY (PRD md.2) ─────────────────────────
    case 'tamamla': {
      if (!['matched', 'in_transit'].includes(deal.status)) {
        return NextResponse.json({ error: 'Bu kayıt tamamlanabilir durumda değil.' }, { status: 409 });
      }
      if (!deal.completed_declared_by) {
        // 1. adım: beyan. Durum DEĞİŞMİYOR — karşı taraf onaylayana kadar iş bitmedi.
        yama = { completed_declared_by: user.id, completed_declared_at: simdi };
        break;
      }
      // 🚨 Aynı kişi iki kez basarak tek taraflı tamamlayamaz.
      if (deal.completed_declared_by === user.id) {
        return NextResponse.json({
          error: 'Tamamlandı beyanınız alındı; karşı tarafın onayı bekleniyor.',
        }, { status: 409 });
      }
      // 2. adım: karşı onay → mühürlenir, sayaçlar başlar.
      const vade = deal.payment_terms_days;
      yama = {
        status: 'completed',
        completed_at: simdi,
        // Çift kör pencere
        review_deadline: new Date(Date.now() + KOR_PENCERE_GUN * 86400_000).toISOString(),
        // Ödeme vadesi: PRD "completed_at + N gün"
        ...(vade !== null && vade !== undefined
          ? { payment_maturity_date: new Date(Date.now() + vade * 86400_000).toISOString().slice(0, 10) }
          : {}),
      };
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
      yama = { status: 'cancelled', cancelled_at: simdi, cancelled_by: user.id,
               cancel_type: muhurlenmisti ? cancel_type : null,
               cancel_reason: typeof cancel_reason === 'string' ? cancel_reason.slice(0, 500) : null };
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
      review_deadline, payment_maturity_date, cancelled_at, cancel_type, cancel_reason`)
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
