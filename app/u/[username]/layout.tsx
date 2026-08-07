import type { Metadata } from 'next';

/**
 * `page.tsx` bir `'use client'` bileşeni (`useParams` + client fetch) —
 * client bileşenleri `metadata` export edemez. Kardeş sunucu layout'u tek yol;
 * `app/auth/layout.tsx` ile aynı kalıp.
 *
 * ⚠️ Rota parametresinin adı `username` AMA taşıdığı değer KULLANICI ID'sidir.
 * `app/sitemap.ts` bu URL'leri `listings.user_id`'den türetiyor. İsim yanıltıcı;
 * canonical'ı gelen değeri AYNEN kullanarak kuruyoruz ki sitemap'teki adresle
 * bire bir aynı olsun — ayrışırsa Google iki farklı sayfa görür.
 *
 * `params` Next 16'da Promise; await zorunlu.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  return {
    alternates: { canonical: `/u/${username}` },
  };
}

export default function KullaniciProfilLayout({ children }: { children: React.ReactNode }) {
  return children;
}
