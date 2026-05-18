import { createServerClient } from '@supabase/ssr';

/**
 * Public (anon key) server-side Supabase client.
 * Cookie bağımsız — sadece herkese açık sorgulanlar için kullanılır.
 * Auth gerektiren işlemler için createServerAuthClient (cookies) kullanın.
 */
export function createPublicServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
