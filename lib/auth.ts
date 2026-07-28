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
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component'ta çağrılırsa hata fırlatır — middleware halleder
          }
        },
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
  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Geçersiz refresh token — sessizce null dön, middleware temizler
      if (
        error.message.includes('refresh_token_not_found') ||
        error.message.includes('Invalid Refresh Token') ||
        error.status === 400
      ) {
        return null;
      }
      return null;
    }
    user = data.user;
  } catch {
    return null;
  }
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
 * API route'ları için rol kontrolü — redirect ETMEZ, sonucu döner.
 * `requireAdmin` server component'ler için tasarlandı ve `redirect()` çağırıyor;
 * API route içinde bu NEXT_REDIRECT fırlatıp 500'e dönüşüyor. Route'larda bunu kullan.
 *
 * Kullanım:
 *   const yetki = await requireStaff();
 *   if (!yetki.ok) return NextResponse.json({ error: yetki.error }, { status: yetki.status });
 */
export async function requireStaff(
  izinliRoller: UserRole[] = ['admin', 'moderator']
): Promise<
  | { ok: true; user: { id: string; email: string | null; role: UserRole } }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: 'Giriş gerekli' };
  if (!izinliRoller.includes(user.role)) return { ok: false, status: 403, error: 'Yetkisiz' };
  return { ok: true, user };
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

