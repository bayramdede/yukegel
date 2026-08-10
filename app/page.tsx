// Server component — listings server-side fetch (ISR 30s), HomeClient + Footer
import type { Metadata } from 'next';
import HomeClient from './_components/HomeClient';
import Footer from './_components/Footer';
import { createPublicServerClient } from '../lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
// SPRINT_01 L4 — limit tek yerden; HomeClient'taki yenileme sorgusu da bunu kullanır.
// Dalga 3 — kolon listesi ve satır normalizasyonu da tek yerden (üç çağıran var).
import { ILAN_LIMITI, ILAN_SELECT, ilanNormalize, type RozetBilgi } from '../lib/ilan-liste';

// Service role client — RLS'i bypass eder; listings + listing_stops birlikte çekilir
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Ana sayfanın canonical'ı ARTIK BURADA. Eskiden kök `layout.tsx`'teydi ve oradan
 * kendi canonical'ını yazmayan HER sayfaya miras kalıyordu — yani /kvkk de kendini
 * ana sayfa ilan ediyordu. Gerekçenin tamamı `app/layout.tsx`'te.
 */
export const metadata: Metadata = { alternates: { canonical: '/' } };

// 30 saniyede bir arka planda yenilenir (stale-while-revalidate)
export const revalidate = 30;

async function fetchTotalIlanCount(): Promise<number> {
  try {
    const serviceSupabase = createServiceClient();
    const { count } = await serviceSupabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .in('moderation_status', ['approved', 'auto_published'])
      .eq('is_shadow_banned', false)
      .eq('status', 'active');
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchInitialIlanlar() {
  try {
    // Service role: listing_stops RLS anon'u blokluyor; joined query ile tek seferde çek
    const serviceSupabase = createServiceClient();
    const publicSupabase = createPublicServerClient();

    const { data, error } = await serviceSupabase
      .from('listings')
      // ⚠️ SPRINT_01 L1 — `contact_phone` ÇEKİLMEZ; kural artık `ILAN_SELECT`'in
      // başında yazılı (lib/ilan-liste.ts). Bu sayfa ISR'li (revalidate=30):
      // çıktı tüm ziyaretçiler arasında paylaşılıyor, oturuma göre koşullu
      // render mümkün değil. Telefon yalnızca /api/ilan/[id]/telefon üzerinden.
      .select(ILAN_SELECT)
      .in('moderation_status', ['approved', 'auto_published'])
      .eq('is_shadow_banned', false)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(ILAN_LIMITI);

    if (error || !data || data.length === 0) return [];

    const userIds = [...new Set((data as any[]).map((i) => i.user_id).filter(Boolean))];
    const kullaniciMap: Record<string, RozetBilgi> = {};
    if (userIds.length > 0) {
      const { data: ks } = await publicSupabase
        .from('users')
        .select('id, created_at')
        .in('id', userIds as string[]);
      for (const k of (ks || []) as any[]) kullaniciMap[k.id] = k;
    }

    return (data as any[]).map((ilan: any) =>
      ilanNormalize(ilan, ilan.user_id ? kullaniciMap[ilan.user_id] : null)
    );
  } catch {
    return [];
  }
}

export default async function Home() {
  const [initialIlanlar, totalCount] = await Promise.all([
    fetchInitialIlanlar(),
    fetchTotalIlanCount(),
  ]);

  return (
    <>
      <HomeClient initialIlanlar={initialIlanlar} totalCount={totalCount} />
      <Footer />
    </>
  );
}
