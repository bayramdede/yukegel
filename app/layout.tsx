import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { getConfigs } from "../lib/config";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
    title: cfg.site_basligi,
    description: cfg.site_aciklamasi,
    icons: { icon: cfg.favicon_url },
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
    </html>
  );
}
