import type { Metadata } from 'next';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { girisAdresi } from '../../lib/redirect';
import PanelClient from './PanelClient';

export const dynamic = 'force-dynamic';

/**
 * Oturum zorunlu sayfa; crawler burada yalnızca `/giris`'e yönlendirilir.
 * `index:false` bunu açıkça söylüyor — robots.txt'teki `Disallow: /panel/`
 * SADECE alt yolları kapatıyordu, çıplak `/panel` kapsam dışıydı.
 *
 * `canonical: null` bilinçli: kök layout'tan miras alınan `/` değeri bu sayfayı
 * ana sayfanın kopyası ilan ediyordu. Miras artık kaldırıldı (bkz. app/layout.tsx)
 * ama açık `null` niyeti kayda geçiriyor — canonical YOK, self-canonical yeter.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function Panel() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  // 29 Tem 2026 — çıplak `/giris` DEĞİL. Normalde proxy bu rotayı zaten yakalar
  // (`KORUNMALI` listesinde), ama oturum tam burada — proxy geçtikten sonra —
  // düşerse tek yönlendiren burasıdır ve kullanıcıyı ana sayfaya bırakırdı.
  if (!user) redirect(girisAdresi('/panel'));

  const svc = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: profil }, { data: ilanlar }, { data: araclar }, { data: anlasmalar }, { data: yorumlarim }] = await Promise.all([
    svc.from('users')
      .select('display_name, email, phone, phone_verified, user_type, tckn, vkn, company_name, bio, username')
      .eq('id', user.id).single(),
    svc.from('listings')
      // Dalga 5 (3 Ağu 2026): metin kolonları düştü, gösterim `ilAdi(id)`'den.
      // ⚠️ Bu ilanlar PanelClient'a HAM gidiyor (normalize edilmeden), yani
      //    `origin_province_id` adı tüketicide de aynen görünür. Çeviri
      //    PanelClient/IlanYonetim içinde, gösterim anında yapılıyor.
      // ⚠️ 8 Ağu 2026 — `price_negotiable` ve `date_flexible` BURAYA EKLENDİ.
      //    Panel'deki düzenleme formu bu iki alanı da gönderiyor; select'te
      //    olmasalar form onları hep `false` görür ve KAYDEDERKEN kullanıcının
      //    gerçek değerini sessizce ezerdi (moderatör panelindeki `user_id`
      //    eksikliğiyle aynı hata sınıfı).
      // 15 Ağu 2026 — "paneli hızlandır": `expires_at`/`contact_phone`
      // (listings) ve `id`/`cargo_type`/`weight_ton`/`pallet_count`/
      // `vehicle_count` (listing_stops) `PanelClient.tsx`de HİÇ okunmuyordu
      // (grep ile doğrulandı) — Bayram'ın test hesabında 206 ilan × 369 durak
      // için her istekte boşuna taşınıyordu. Yeni bir alan PanelClient'a
      // eklenirse buraya da eklenmeli, yoksa `undefined` gelir.
      .select(`id, listing_type, origin_province_id, origin_district, status, moderation_status, created_at,
        price_offer, price_negotiable, completed_at, vehicle_type, body_type,
        available_date, date_flexible, notes,
        internal_audit_logs,
        listing_stops ( stop_order, province_id, district )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    svc.from('vehicles')
      .select('id, plate, vehicle_type, body_types, brand, model, year, capacity_ton, is_active')
      .eq('user_id', user.id).order('created_at', { ascending: false }),
    // Güvenli Etkileşim Faz 2 (10 Ağu 2026) — `deals` + `reviews` panele ilk kez
    // geliyor. Servis rolüyle okunuyor ama filtre OTURUMDAN geliyor (aynen
    // `GET /api/deals`'teki gibi) — istemci başkasının kaydını isteyemez.
    // Joinler yalnız GÖSTERİM için: rota başlığı (listing) ve karşı taraf adı
    // (shipper/carrier). Çoklu `users` FK'si yüzünden hint ZORUNLU, aksi hâlde
    // PostgREST hangi kolon üzerinden join yapacağını bilemez.
    svc.from('deals')
      .select(`id, listing_id, shipper_id, carrier_id, status, matched_at, transit_at,
        completed_declared_by, completed_declared_at, completed_at,
        payment_terms_days, payment_maturity_date, review_deadline,
        agreed_price, note, carrier_phone_consent,
        vehicle_plate, driver_name, dispatch_notes,
        external_carrier_name, external_carrier_phone,
        shipment_stage, assigned_at, loaded_at, on_road_at, delivered_at,
        cancelled_at, cancelled_by, cancel_type, cancel_reason, created_at,
        listing:listings!deals_listing_id_fkey ( id, listing_type, origin_province_id, price_offer, contact_phone,
          listing_stops ( province_id, stop_order ) ),
        shipper:users!deals_shipper_id_fkey ( display_name, phone ),
        carrier:users!deals_carrier_id_fkey ( display_name, phone )`)
      .or(`shipper_id.eq.${user.id},carrier_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200),
    // Kendi yazdığım yorumlar — "bu deal'i zaten değerlendirdim mi?" kontrolü.
    // RLS zaten `reviewer_id = auth.uid()`e izin veriyor; servis rolüyle okuyoruz
    // çünkü sayfanın geri kalanı da öyle, ama filtre yine oturumdan.
    svc.from('reviews')
      .select('id, deal_id, rating, comment, published_at')
      .eq('reviewer_id', user.id),
  ]);

  // Telefon numaralarını yalnız eşleşmiş/yoldaki/tamamlanmış deal'lerde göster.
  // Ham `phone` sunucu tarafında damıtılıyor — istemciye ham users.phone gitmez.
  const TELEFON_GORUNEN = new Set(['matched', 'in_transit', 'completed']);
  const anlasmalarTemiz = (anlasmalar || []).map((d: any) => {
    const gorunsun = TELEFON_GORUNEN.has(d.status);
    return {
      ...d,
      // Nakliyecinin telefonu: yalnız onay verdiyse ve deal aktifse
      carrier_phone: gorunsun && d.carrier_phone_consent ? (d.carrier?.phone ?? null) : null,
      // İlan sahibinin telefonu: listing'deki contact_phone (zaten yarı-kamuya açık)
      shipper_phone: gorunsun ? (d.listing?.contact_phone ?? d.shipper?.phone ?? null) : null,
      // Ham phone alanlarını istemciye gönderme
      shipper: d.shipper ? { display_name: d.shipper.display_name } : null,
      carrier: d.carrier ? { display_name: d.carrier.display_name } : null,
    };
  });

  return (
    <PanelClient
      userId={user.id}
      userEmail={user.email || null}
      profil={profil}
      ilanlar={ilanlar || []}
      araclar={araclar || []}
      anlasmalar={anlasmalarTemiz}
      yorumlarim={yorumlarim || []}
    />
  );
}
