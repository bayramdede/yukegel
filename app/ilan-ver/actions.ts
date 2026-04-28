'use server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function ilanKaydet(formData: {
  tip: string;
  kalkis: string;
  kalkis_ilce: string;
  tel: string;
  fiyat: string;
  fiyat_pazarlik: boolean;
  tarih: string;
  tarih_esnek: boolean;
  genel_not: string;
  // Ortak araç bilgileri
  arac_tipi: string;
  utsyapi: string[];
  arac_adet: number;
  yuk_cinsi: string;
  // Varış noktaları
  duraklar: Array<{
    sehir: string;
    ilce: string;
    ton: string;
    palet: string;
    notlar: string;
  }>;
}) {
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

  // 1. listings'e yaz
  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      listing_type: formData.tip,
      origin_city: formData.kalkis,
      origin_district: formData.kalkis_ilce || null,
      contact_phone: formData.tel,
      price_offer: formData.fiyat ? parseFloat(formData.fiyat) : null,
      price_negotiable: formData.fiyat_pazarlik,
      available_date: formData.tarih || null,
      date_flexible: formData.tarih_esnek,
      notes: formData.genel_not || null,
      source: 'form',
      moderation_status: 'auto_published', // Form ilanları direkt yayına
      trust_level: 'verified',
      user_id: user?.id || null,
      // Ortak araç bilgileri listings seviyesinde
      vehicle_type: formData.arac_tipi ? [formData.arac_tipi] : null,
      body_type: formData.utsyapi.length > 0 ? formData.utsyapi : null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. listing_stops'a yaz — araç bilgileri her durağa ortak yazılır
  const stops = formData.duraklar.map((d, i) => ({
    listing_id: listing.id,
    stop_order: i + 1,
    city: d.sehir,
    district: d.ilce || null,
    vehicle_count: formData.arac_adet,
    cargo_type: formData.yuk_cinsi || null,
    weight_ton: d.ton ? parseFloat(d.ton) : null,
    pallet_count: d.palet ? parseInt(d.palet) : null,
    notes: d.notlar || null,
  }));

  const { error: stopError } = await supabase
    .from('listing_stops')
    .insert(stops);

  if (stopError) throw new Error(stopError.message);

  return { success: true, id: listing.id };
}

// Kullanıcının telefon numarasını getir
export async function kullanicitelefon(): Promise<string | null> {
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
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .single();

  return data?.phone || null;
}
