import { createClient as createSupabase } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import PanelClient from './PanelClient';

export const dynamic = 'force-dynamic';

export default async function Panel() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/giris');

  const svc = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: profil }, { data: ilanlar }, { data: araclar }] = await Promise.all([
    svc.from('users')
      .select('display_name, email, phone, phone_verified, user_type, tckn, vkn, company_name, bio, username')
      .eq('id', user.id).single(),
    svc.from('listings')
      .select(`id, listing_type, origin_city, origin_district, status, moderation_status, created_at,
        expires_at, price_offer, completed_at, vehicle_type, body_type, available_date, notes, contact_phone,
        internal_audit_logs,
        listing_stops ( id, stop_order, city, district, cargo_type, weight_ton, pallet_count, vehicle_count )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    svc.from('vehicles')
      .select('id, plate, vehicle_type, body_types, brand, model, year, capacity_ton, is_active')
      .eq('user_id', user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <PanelClient
      userId={user.id}
      userEmail={user.email || null}
      profil={profil}
      ilanlar={ilanlar || []}
      araclar={araclar || []}
    />
  );
}
