'use server';
import { createClient } from '@supabase/supabase-js';

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
  duraklar: Array<{
    sehir: string;
    ilce: string;
    arac_tipi: string;
    utsyapi: string[];
    arac_adet: number;
    yuk_cinsi: string;
    ton: string;
    palet: string;
    notlar: string;
  }>;
}) {
  // 1. listings'e yaz
  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      listing_type: formData.tip,
      origin_city: formData.kalkis,
      origin_district: formData.kalkis_ilce,
      contact_phone: formData.tel,
      price_offer: formData.fiyat ? parseFloat(formData.fiyat) : null,
      price_negotiable: formData.fiyat_pazarlik,
      available_date: formData.tarih || null,
      date_flexible: formData.tarih_esnek,
      notes: formData.genel_not,
      source: 'form',
      moderation_status: 'pending',
      trust_level: 'unverified',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 2. listing_stops'a yaz
  const stops = formData.duraklar.map((d, i) => ({
    listing_id: listing.id,
    stop_order: i + 1,
    city: d.sehir,
    district: d.ilce,
    vehicle_count: d.arac_adet,
    cargo_type: d.yuk_cinsi || null,
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