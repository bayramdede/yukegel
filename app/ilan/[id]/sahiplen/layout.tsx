import type { Metadata } from 'next';

/**
 * İlan sahiplenme akışı: oturum + tek kullanımlık doğrulama gerektiren bir
 * işlem sayfası, indexlenecek içerik yok. robots.txt bu yolu joker (yıldız)
 * kalıbıyla kapatıyor ama joker desteği crawler'a göre değişir; meta robots
 * kesin kayıt.
 *
 * (Kalıbı buraya birebir YAZMIYORUZ: içindeki yıldız-eğik çizgi ikilisi blok
 *  yorumu erken kapatıyor ve dosyayı derlenmez hale getiriyor.)
 *
 * `follow: false` bilinçli — `app/auth/layout.tsx`'teki mantık: bu sayfadaki
 * bağlantıları izlemek, en iyi ihtimalle boşa istek.
 *
 * ⚠️ `/ilan/[id]/page.tsx`'in canonical'ı buraya MİRAS KALMAZ. Miras zinciri
 * yalnızca LAYOUT'lardan + yaprak sayfadan oluşur; kardeş bir `page.tsx`
 * zincirde yer almaz. Miras eden şey kök `layout.tsx` — ve oradan canonical
 * bilinçli olarak kaldırıldı (gerekçe app/layout.tsx'te). Yani bu rota
 * canonical'sız kalıyor, doğrusu da bu: noindex zaten devrede.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SahiplenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
