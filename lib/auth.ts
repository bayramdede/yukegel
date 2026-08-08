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
  // 🚨 `process.env.X!` sadece TypeScript'i susturur, çalışma zamanında hiçbir şey
  // garanti etmez (29 Tem 2026). Anahtar eksik/boşsa supabase-js'in kendi hatası
  // gelir: "supabaseKey is required." — hangi env değişkeni, hangi ortam, hangi
  // çağıran belli değildir. Server action içinde bu istisna kullanıcıya "An error
  // occurred in the Server Components render..." olarak, `useEffect` içinde ise
  // HİÇBİR ŞEY olarak (sessizce reddedilen promise) yansır. Adını söyleyerek
  // patlamak, sessizce yanlış davranmaktan iyidir.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      `getServiceSupabase: ortam değişkeni eksik — ${[
        !url && 'NEXT_PUBLIC_SUPABASE_URL',
        !key && 'SUPABASE_SERVICE_ROLE_KEY',
      ].filter(Boolean).join(', ')}. Vercel → Settings → Environment Variables (Production kapsamı işaretli mi?).`
    );
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
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

  // 🚨 8 Ağu 2026 — servis rolü zorunlu: `email` 7 Ağu güvenlik düzeltmesinden
  // sonra `authenticated`'in SELECT yetkisinde değil (bkz. docs/20260807_
  // guvenlik_kayit_giris.sql). Bu fonksiyon yaygın kullanılan bir sunucu-yalnız
  // yardımcı (`requireAdmin`/`requireStaff` bunun üzerine kurulu); servis rolü
  // burada RLS bypass değil, ZATEN doğrulanmış tek bir kullanıcının kendi
  // satırını okuyor.
  const { data: profil } = await getServiceSupabase()
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

