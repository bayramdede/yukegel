import type { Metadata } from 'next';

/**
 * SPRINT_01 S2 — `/auth/*` ALTININ TAMAMI arama motorlarına kapalı.
 *
 * Segment layout'u bilinçli olarak `/auth/reset`'e değil `/auth`'a konuldu:
 * `/auth/callback` ve `/auth/devir` de aynı muameleyi hak ediyor ve ileride
 * eklenecek her `/auth/*` rotası bu kuralı **otomatik** devralsın istiyoruz.
 * Sayfa başına layout yazmak, S4'te robots.txt'te yaşadığımız "listeler zamanla
 * birbirinden ayrışıyor" sorununu buraya taşırdı.
 *
 * `follow: false`: bu URL'ler tek kullanımlık token taşır (`?code=`, recovery hash).
 * Crawler'ın bağlantıları izlemesi, en iyi ihtimalle boşa istek; en kötü ihtimalle
 * bir kullanıcının token'ını tüketen istek demek.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
