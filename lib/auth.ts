// lib/auth.ts — Server-side auth & rol helper'ları
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'user' | 'moderator' | 'admin';

/**
 * SSR Supabase client — auth cookie'leri okuyabilir.
 * Server component / server action içinde kullan.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

/**
 * Service-role client — RLS bypass eder.
 * Sadece admin/moderator kontrol edildikten sonra kullan.
 */
export function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Mevcut kullanıcıyı + rolünü döner. Giriş yapmamışsa null.
 */
export async function getCurrentUser(): Promise<{ id: string; email: string | null; role: UserRole } | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profil } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', user.id)
    .single();

  return {
    id: user.id,
    email: profil?.email || user.email || null,
    role: (profil?.role as UserRole) || 'user',
  };
}

/**
 * Admin olmayanı /giris'e atar. Admin'i geri döndürür.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    redirect('/giris?redirect=/admin');
  }
  return user;
}

/**
 * Moderator veya admin olmayanı /giris'e atar.
 */
export async function requireModerator() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
    redirect('/giris?redirect=/moderator');
  }
  return user;
}

/**
 * Role'e göre default landing page döner.
 */
export function landingForRole(role: UserRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'moderator') return '/moderator';
  return '/panel';
}
