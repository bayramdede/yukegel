import type { Metadata } from 'next';

/**
 * `/admin/*` ALTININ TAMAMI arama motorlarına kapalı — `app/auth/layout.tsx`
 * ile aynı gerekçe: kuralı sayfa başına yazmak, listelerin zamanla ayrışmasına
 * davetiye. Segment layout'u yeni eklenen her `/admin/*` rotasına OTOMATİK
 * uygulanır; bugün 10 sayfa var ve hiçbirinde meta robots yoktu.
 *
 * robots.txt zaten `Disallow: /admin/` diyor ama iki farkı var: (1) yalnızca
 * o kuralı okuyan crawler'ları bağlar, (2) disallow "indexleme" demek değildir
 * — dış bağlantı varsa Google URL'i taramadan da indeksleyebilir. `noindex`
 * bunu kesin olarak kapatır.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
