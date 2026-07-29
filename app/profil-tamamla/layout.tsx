import type { Metadata } from 'next';

/**
 * SPRINT_01 S2 — `/profil-tamamla` arama motorlarına kapalı.
 *
 * Bu sayfa yalnız oturum açmış ve profili eksik kullanıcı için anlamlı; misafir
 * geldiğinde zaten `/giris`'e düşer. İndekslenmesi hem anlamsız hem de
 * `?redirect=` varyasyonlarıyla kopya URL üretir.
 */
export const metadata: Metadata = {
  title: 'Profilini Tamamla — Yükegel',
  robots: { index: false, follow: false },
};

export default function ProfilTamamlaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
