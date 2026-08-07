import type { Metadata } from 'next';

/**
 * `/moderator/*` — gerekçe `app/admin/layout.tsx` ile birebir aynı.
 * Ayrı bir layout gerekiyor çünkü `/moderator` ve `/admin` kardeş segmentler;
 * ortak bir üst layout yok (kök layout'a noindex koymak TÜM siteyi kapatırdı).
 *
 * Not: giriş sayfası `/moderator-giris` AYRI bir rota ve kendi layout'unda
 * zaten noindex taşıyor — bu layout onu kapsamaz.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
