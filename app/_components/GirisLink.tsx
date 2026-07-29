'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { girisAdresi } from '../../lib/redirect';

/**
 * Giriş / kayıt bağlantısı — dönülecek sayfayı KENDİSİ ekler (29 Tem 2026).
 *
 * 🚨 NEDEN VAR: header ve footer'daki "Giriş Yap" / "Üye Ol" bağlantıları çıplak
 * `/giris`e gidiyordu. Kullanıcı hangi sayfadan basarsa bassın giriş sonrası ANA
 * SAYFAYA düşüyordu. Paylaşılan bir `/u/<id>` ilan listesinde bu, bağlantıyı komple
 * boşa çıkarıyor. Ayrıntı: `lib/redirect.ts → girisAdresi`.
 *
 * ⚠️ `usePathname()` KULLANILIYOR, `useSearchParams()` DEĞİL. İkincisi sayfayı
 *    Suspense sınırına mecbur eder ve statik render'ı bozar; buna karşılık kazancı
 *    yalnızca filtre parametrelerini korumak olurdu. Yol yeter — kullanıcı doğru
 *    sayfaya döner, filtresini yeniden seçer.
 *
 * ⚠️ `<Link>` (`<a>` değil): footer'daki F2 kuralı — site içi her hedef next/link
 *    olmalı, yoksa tam sayfa yenilemesi olur.
 *
 * ⚠️ Sunucu bileşeninden çağrılabilir; bu dosya `'use client'` olduğu için sınır
 *    burada çizilir. Footer'ın `async` sunucu bileşeni olması sorun değil.
 */
export default function GirisLink({
  mod,
  style,
  title,
  children,
}: {
  mod?: 'kayit';
  style?: React.CSSProperties;
  title?: string;
  children: React.ReactNode;
}) {
  const yol = usePathname();
  return (
    <Link href={girisAdresi(yol, mod)} style={style} title={title}>
      {children}
    </Link>
  );
}
