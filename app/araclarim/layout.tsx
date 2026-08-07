import type { Metadata } from 'next';

/**
 * `page.tsx` bir `'use client'` bileşeni — client bileşenleri `metadata`
 * EXPORT EDEMEZ (Next derlemede hata verir). Tek yol kardeş bir sunucu
 * layout'u; `app/auth/layout.tsx` ile aynı kalıp.
 *
 * Oturum zorunlu, kişiye özel araç listesi: indexlenecek bir şey yok.
 * robots.txt zaten `Disallow: /araclarim/` diyor ama o SADECE alt yolları
 * kapsıyor ve crawler'ın robots.txt'i okuduğunu varsayıyor; meta robots
 * ikinci ve bağlayıcı kayıt.
 *
 * Canonical VERMİYORUZ (bkz. app/layout.tsx): kök katmandan miras alınan
 * `canonical: '/'` bu sayfayı ana sayfanın kopyası ilan ediyordu.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AraclarimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
