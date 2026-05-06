import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yukegel.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Aktif, onaylı, shadow-ban'sız ilanlar
  const { data: ilanlar } = await supabase
    .from('listings')
    .select('id, created_at, available_date')
    .eq('status', 'active')
    .eq('is_shadow_banned', false)
    .in('moderation_status', ['approved', 'auto_published'])
    .order('created_at', { ascending: false })
    .limit(5000);

  const ilanUrls: MetadataRoute.Sitemap = (ilanlar ?? []).map((ilan) => ({
    url: `${SITE_URL}/ilan/${ilan.id}`,
    lastModified: new Date(ilan.available_date ?? ilan.created_at),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const statikUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL,                              lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/nasil-calisir`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/hakkimizda`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/kvkk`,                    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/kullanim-kosullari`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];

  return [...statikUrls, ...ilanUrls];
}
