import type { Metadata } from 'next';

/**
 * SPRINT_01 S2 — `/giris` arama motorlarına kapalı.
 *
 * NEDEN AYRI BİR `layout.tsx`:
 *   `page.tsx` `'use client'` — client component'ten `metadata` export EDİLEMEZ
 *   (Next sessizce yok sayar, hata bile vermez). Route segment'ine bir server
 *   `layout.tsx` koymak, sayfayı istemci bırakıp metadata eklemenin tek yolu.
 *
 * NEDEN NOINDEX:
 *   Giriş ekranının arama sonucunda hiçbir değeri yok; üstelik indekslenmesi
 *   `?redirect=`, `?hesap=` gibi parametrelerle onlarca kopya URL üretir ve
 *   crawler bütçesini gerçek ilan sayfalarından çalar.
 *
 * `follow: true` bilinçli: sayfadaki "Kayıt ol" / ana sayfa bağlantıları izlensin,
 * yalnız bu URL indekslenmesin.
 */
export const metadata: Metadata = {
  title: 'Giriş Yap — Yükegel',
  robots: { index: false, follow: true },
};

export default function GirisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
