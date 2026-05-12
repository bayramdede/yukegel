'use server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { structuredLog } from '../../lib/logger';

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

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      listing_type: formData.tip,
      origin_city: formData.kalkis,
      origin_district: formData.kalkis_ilce || null,
      contact_phone: formData.tel || null,
      price_offer: formData.fiyat ? parseFloat(formData.fiyat) : null,
      price_negotiable: formData.fiyat_pazarlik,
      available_date: formData.tarih || null,
      date_flexible: formData.tarih_esnek,
      notes: formData.genel_not || null,
      raw_text: formData.raw_text || null,
      source: 'form',
      moderation_status: 'auto_published',
      trust_level: 'verified',
      user_id: user?.id || null,
      vehicle_type: formData.arac_tipi ? [formData.arac_tipi] : null,
      body_type: formData.utsyapi.length > 0 ? formData.utsyapi : null,
    })
    .select()
    .single();

  if (error) {
    structuredLog('ERROR', 'db-transaction', 'İlan oluşturma hatası', {
      user_id: user?.id ?? 'anonim',
      error_message: error.message,
      listing_type: formData.tip,
      origin_city: formData.kalkis,
    });
    throw new Error(error.message);
  }

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

  if (stopError) {
    structuredLog('ERROR', 'db-transaction', 'İlan durak oluşturma hatası', {
      user_id: user?.id ?? 'anonim',
      listing_id: listing.id,
      error_message: stopError.message,
    });
    throw new Error(stopError.message);
  }

  structuredLog('INFO', 'db-transaction', 'İlan oluşturuldu', {
    user_id: user?.id ?? 'anonim',
    listing_id: listing.id,
    listing_type: formData.tip,
    origin_city: formData.kalkis,
    stop_count: stops.length,
    ai_parsed: formData.ai_parsed ?? false,
    source: 'form',
  });

  return { success: true, id: listing.id };
}

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

  // maybeSingle() — admin veya yeni kullanıcıda users satırı olmayabilir
  const { data } = await supabase
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();

  return data?.phone || null;
}
