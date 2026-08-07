import type { Metadata } from 'next';

/**
 * `page.tsx` bir `'use client'` bileşeni (sekme durumu `useState` ile
 * tutuluyor) — client bileşenleri `metadata` export edemez. Kardeş sunucu
 * layout'u tek yol; `app/auth/layout.tsx` ile aynı kalıp.
 *
 * Bu sayfa AKSİNE indexlenmeli: platformun ne yaptığını anlatan, arama
 * niyetiyle birebir örtüşen kamuya açık içerik. Buradaki asıl düzeltme
 * canonical: kök layout'tan miras alınan `/` değeri sayfayı ana sayfanın
 * kopyası gösterip indeksten düşürüyordu.
 */
export const metadata: Metadata = {
  title: 'Nasıl Çalışır? — Yükegel',
  description: 'Yük sahibi ve nakliyeci olarak Yükegel\'i adım adım nasıl kullanacağınız.',
  alternates: { canonical: '/nasil-calisir' },
};

export default function NasilCalisirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
