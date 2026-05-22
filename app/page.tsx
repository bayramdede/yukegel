// Server component — listings server-side fetch (ISR 30s), HomeClient + Footer
import HomeClient from './_components/HomeClient';
import Footer from './_components/Footer';
import { createPublicServerClient } from '../lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// Service role client — RLS'i bypass eder; listings + listing_stops birlikte çekilir
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// 30 saniyede bir arka planda yenilenir (stale-while-revalidate)
export const revalidate = 30;

function yeniUye(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

async function fetchInitialIlanlar() {
  try {
    // Service role: listing_stops RLS anon'u blokluyor; joined query ile tek seferde çek
    const serviceSupabase = createServiceClient();
    const publicSupabase = createPublicServerClient();

    const { data, error } = await serviceSupabase
      .from('listings')
      .select(`
        id, listing_type, origin_city, origin_district,
        contact_phone, price_offer, source, created_at,
        trust_level, user_id, vehicle_type, body_type,
        available_date, date_flexible,
        listing_stops ( listing_id, stop_order, city, district, vehicle_count, cargo_type, weight_ton, pallet_count )
      `)
      .in('moderation_status', ['approved', 'auto_published'])
      .eq('is_shadow_banned', false)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return [];

    const userIds = [...new Set(data.map((i) => i.user_id).filter(Boolean))];
    const kullaniciMap: Record<string, { phone_verified: boolean; created_at: string }> = {};
    if (userIds.length > 0) {
      const { data: ks } = await publicSupabase
        .from('users')
        .select('id, phone_verified, created_at')
        .in('id', userIds as string[]);
      for (const k of (ks || []) as any[]) kullaniciMap[k.id] = k;
    }

    return data.map((ilan: any) => {
      const stops = ((ilan.listing_stops || []) as any[])
        .sort((a: any, b: any) => a.stop_order - b.stop_order);
      const aracTipiList: string[] = ilan.vehicle_type?.length
        ? ilan.vehicle_type
        : ([...new Set(stops.map((s: any) => s.cargo_type).filter(Boolean))] as string[]);
      const kb = ilan.user_id ? kullaniciMap[ilan.user_id] : null;
      return {
        id: ilan.id,
        tip: ilan.listing_type,
        kalkis: ilan.origin_city,
        kalkis_ilce: ilan.origin_district || '',
        duraklar: stops.map((s: any) => ({
          sehir: s.city,
          ilce: s.district || '',
          ton: s.weight_ton,
          palet: s.pallet_count,
          arac_adet: s.vehicle_count,
        })),
        kaynak: ilan.source || 'form',
        sure: new Date(ilan.created_at).toLocaleDateString('tr-TR'),
        tel: ilan.contact_phone,
        fiyat: ilan.price_offer?.toString() ?? null,
        tarih: ilan.available_date,
        tarihEsnek: ilan.date_flexible,
        aracTipleri: aracTipiList,
        ustyapilari: (ilan.body_type || []) as string[],
        dogrulanmamis: !ilan.user_id || ilan.trust_level === 'social',
        telefonDogrulandi: kb?.phone_verified === true,
        yeniUye: kb ? yeniUye(kb.created_at) : false,
        user_id: ilan.user_id,
      };
    });
  } catch {
    return [];
  }
}

export default async function Home() {
  const initialIlanlar = await fetchInitialIlanlar();

  return (
    <>
      <HomeClient initialIlanlar={initialIlanlar} />
      <Footer />
    </>
  );
}
