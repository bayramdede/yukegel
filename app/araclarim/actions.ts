'use server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function aracEkle(formData: {
  plate: string;
  vehicle_type: string;
  body_types: string[];
  brand: string;
  model: string;
  year: string;
  capacity_ton: string;
}) {
  const user = await getUser();
  if (!user) throw new Error('Giriş yapılmamış');

  const { error } = await supabaseAdmin.from('vehicles').insert({
    user_id: user.id,
    plate: formData.plate.toUpperCase().replace(/\s/g, ''),
    vehicle_type: formData.vehicle_type,
    body_types: formData.body_types,
    brand: formData.brand || null,
    model: formData.model || null,
    year: formData.year ? parseInt(formData.year) : null,
    capacity_ton: formData.capacity_ton ? parseFloat(formData.capacity_ton) : null,
    is_active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/araclarim');
}

export async function aracSil(id: string) {
  const user = await getUser();
  if (!user) throw new Error('Giriş yapılmamış');

  const { error } = await supabaseAdmin
    .from('vehicles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/araclarim');
}

export async function aracGuncelle(id: string, formData: {
  plate: string;
  vehicle_type: string;
  body_types: string[];
  brand: string;
  model: string;
  year: string;
  capacity_ton: string;
}) {
  const user = await getUser();
  if (!user) throw new Error('Giriş yapılmamış');

  const { error } = await supabaseAdmin
    .from('vehicles')
    .update({
      plate: formData.plate.toUpperCase().replace(/\s/g, ''),
      vehicle_type: formData.vehicle_type,
      body_types: formData.body_types,
      brand: formData.brand || null,
      model: formData.model || null,
      year: formData.year ? parseInt(formData.year) : null,
      capacity_ton: formData.capacity_ton ? parseFloat(formData.capacity_ton) : null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/araclarim');
}
