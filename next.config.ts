import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache-Control: no-store kaldırıldı — ISR (revalidate=30) Vercel edge cache'ini kullanır.
  // Browser'lar her zaman fresh sayfa görür (Next.js ISR bunu otomatik yönetir).
  transpilePackages: ['leaflet', 'react-leaflet'],
};

export default nextConfig;

