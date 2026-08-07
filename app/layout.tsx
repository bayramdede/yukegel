import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { getConfigs } from "../lib/config";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * SPRINT_01 S1 — `metadataBase` + OG + Twitter + canonical.
 *
 * `NEXT_PUBLIC_SITE_URL` `sitemap.ts` ile AYNI değişken ve AYNI fallback'i kullanır;
 * ikisi ayrışırsa sitemap bir alan adını, canonical başka bir alan adını işaret eder
 * ve Google ikisini farklı site sanar.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yukegel.com';

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getConfigs(
    ['site_basligi', 'site_aciklamasi', 'favicon_url'],
    {
      site_basligi: "Yükegel - Türkiye'nin Nakliye İlan Platformu",
      site_aciklamasi: 'Yük ve araç ilanları. Ücretsiz, hızlı, güvenilir.',
      favicon_url: '/favicon.ico',
    }
  );
  return {
    // ⚠️ `metadataBase` OLMADAN göreli OG/canonical URL'leri Next tarafından
    // ÜRETİLMEZ (build'de uyarı verir, sessizce atlar). Paylaşım kartının hiç
    // görünmemesinin en sık sebebi budur.
    metadataBase: new URL(SITE_URL),
    title: cfg.site_basligi,
    description: cfg.site_aciklamasi,
    icons: { icon: cfg.favicon_url },
    // 🚨 BURADA `alternates` YOK VE OLMAYACAK — eskiden `{ canonical: '/' }` vardı.
    //
    // Yanındaki yorum "alt sayfalar kendi `alternates`'ini vermezse Next bunu
    // MİRAS ALMAZ" diyordu. YANLIŞTI. Next'in birleştiricisi (6 Ağu 2026'da
    // `node_modules/next/dist/lib/metadata/resolve-metadata.js:166` okundu):
    //
    //     const newResolvedMetadata = structuredClone(resolvedMetadata);
    //     for (const key_ in metadata) { switch (key) { case 'alternates': … } }
    //
    // Yani ÜST katmanın çözülmüş metadata'sı klonlanıp başlangıç alınıyor ve
    // YALNIZCA çocuğun kendi nesnesinde bulunan anahtarlar eziliyor. `alternates`
    // vermeyen her sayfa üsttekini AYNEN devralır.
    //
    // Sonuç: kendi canonical'ını yazmayan /kvkk, /nasil-calisir, /u/… gibi TÜM
    // sayfalar `<link rel="canonical" href="https://yukegel.com/">` yayınlıyordu.
    // Google bunu "bu sayfa aslında ana sayfanın kopyası" diye okur ve sayfayı
    // indeksten düşürür — sitemap'e koymak da bunu kurtarmaz.
    //
    // Kök katmandan çekilince varsayılan "canonical yok" olur; Google o durumda
    // sayfayı KENDİ URL'ine self-canonical sayar. Yani yanlış cevap yerine
    // güvenli sessizlik. Ana sayfanın canonical'ı artık `app/page.tsx`'te.
    openGraph: {
      type: 'website',
      // Nakliye sektöründe paylaşım WhatsApp üzerinden yürüyor; WhatsApp
      // `og:locale`'a bakarak metni yönlendirmiyor ama Facebook/LinkedIn bakıyor.
      locale: 'tr_TR',
      siteName: 'Yükegel',
      url: SITE_URL,
      title: cfg.site_basligi,
      description: cfg.site_aciklamasi,
      // Görsel `app/opengraph-image.tsx` tarafından üretiliyor; Next dosya
      // konvansiyonunu görüp `og:image`'ı KENDİSİ ekler. Burada tekrar
      // tanımlamıyoruz — iki kaynak olursa hangisinin kazandığı sürüme bağlı.
    },
    twitter: {
      card: 'summary_large_image',
      title: cfg.site_basligi,
      description: cfg.site_aciklamasi,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${ibmPlexSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
