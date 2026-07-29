import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yukegel.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Aktif, onaylı, shadow-ban'sız ilanlar
  //
  // SPRINT_01 S3 — select'e `user_id` eklendi. Amacı ilan URL'i değil, PROFİL
  // URL'lerini bu listeden TÜRETMEK (aşağıya bak): ayrı bir `users` sorgusu atmadan,
  // "en az bir yayında ilanı olan kullanıcı" kümesini bedavaya elde ediyoruz.
  const { data: ilanlar } = await supabase
    .from('listings')
    .select('id, user_id, created_at, available_date')
    .eq('status', 'active')
    .eq('is_shadow_banned', false)
    .in('moderation_status', ['approved', 'auto_published'] as string[])
    .order('created_at', { ascending: false })
    .limit(5000);

  const ilanUrls: MetadataRoute.Sitemap = (ilanlar ?? []).map((ilan) => ({
    url: `${SITE_URL}/ilan/${ilan.id}`,
    lastModified: new Date(ilan.available_date ?? ilan.created_at),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  /**
   * SPRINT_01 S3 — herkese açık profil sayfaları (`/u/…`).
   *
   * 🚨 URL'DEKİ DEĞER `username` DEĞİL, KULLANICI **ID**'Sİ.
   *    Route klasörü `app/u/[username]` diye adlandırılmış ama sayfa param'ı
   *    `.eq('id', userId)` ile kullanıyor ve panel de linki `/u/${userId}` olarak
   *    üretiyor. Klasör adı yanıltıcı; `users.username` kolonu ROUTING'DE KULLANILMIYOR.
   *    Buraya `username` yazmak 404 üretirdi.
   *
   * NEDEN `users` TABLOSUNU TARAMIYORUZ:
   *   Tüm kullanıcıları listelemek, ilanı olmayan yüzlerce BOŞ profil sayfasını
   *   sitemap'e sokardı. Google bunu "thin content" sayar ve sitemap'in tamamına
   *   olan güvenini düşürür. Yalnız yukarıda gerçekten yayında ilanı olduğunu
   *   doğruladığımız kullanıcıları veriyoruz — dolu sayfa garantisi.
   *
   * `user_id` NULL olabilir: WhatsApp/Excel içe aktarımından gelen ilanların sahibi
   * yok. Bu satırlar profil listesine girmez.
   */
  const profilSonTarih = new Map<string, Date>();
  for (const ilan of ilanlar ?? []) {
    if (!ilan.user_id) continue;
    const tarih = new Date(ilan.available_date ?? ilan.created_at);
    const mevcut = profilSonTarih.get(ilan.user_id);
    // Kullanıcının EN YENİ ilanının tarihi = profil sayfasının gerçek `lastModified`'ı.
    if (!mevcut || tarih > mevcut) profilSonTarih.set(ilan.user_id, tarih);
  }

  const profilUrls: MetadataRoute.Sitemap = [...profilSonTarih].map(([id, tarih]) => ({
    url: `${SITE_URL}/u/${id}`,
    lastModified: tarih,
    // İlan sayfasından düşük: profil bir toplama sayfası, arama sonucunda asıl
    // gösterilmesini istediğimiz şey tek tek ilanlar.
    changeFrequency: 'daily',
    priority: 0.5,
  }));

  const statikUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL,                              lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${SITE_URL}/yol-rehberi`,             lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/nasil-calisir`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/hakkimizda`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/kvkk`,                    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/kullanim-kosullari`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];

  return [...statikUrls, ...ilanUrls, ...profilUrls];
}
