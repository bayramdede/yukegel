import type { Metadata } from 'next';

/**
 * `page.tsx` bir `'use client'` bileşeni (form durumu) — client bileşenleri
 * `metadata` export edemez. Kardeş sunucu layout'u tek yol;
 * `app/auth/layout.tsx` ile aynı kalıp.
 *
 * Sayfa indexlenebilir: "ücretsiz yük ilanı ver" araması bu forma inmeli.
 * Ama kök layout'tan miras alınan `canonical: '/'` sayfayı ana sayfanın
 * kopyası ilan ediyordu (gerekçe app/layout.tsx'te) — kendi canonical'ı şart.
 */
export const metadata: Metadata = {
  title: 'Ücretsiz İlan Ver — Yükegel',
  description: 'Yük veya araç ilanınızı dakikalar içinde ücretsiz yayınlayın.',
  alternates: { canonical: '/ilan-ver' },
};

export default function IlanVerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
