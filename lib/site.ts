// lib/site.ts — SİTE KÖK ADRESİNİN TEK KAYNAĞI.
//
// 🚨 NEDEN VAR (8 Ağu 2026, canlıda ölçülerek bulundu): aynı fallback beş ayrı
// dosyada elle yazılmıştı (`layout.tsx`, `sitemap.ts`, `ilan/[id]/page.tsx`,
// `api/auth/dogrulama-tekrar`, `hakkimizda/page.tsx`) ve HEPSİ YANLIŞ HOST'u
// gösteriyordu.
//
// ⚠️ ASIL KUSUR — KANONİK HOST `www`:
//   curl -sI https://yukegel.com      → 307, location: https://www.yukegel.com/
//   curl -sI https://www.yukegel.com  → 200
// Yani sitenin gerçek adresi `www.yukegel.com`; apex ona YÖNLENDİRİYOR.
// Ama `NEXT_PUBLIC_SITE_URL` üretimde tanımlı olmadığı için kod apex'e düşüyordu
// ve canlıda şunlar yayınlanıyordu (curl ile doğrulandı):
//   <link rel="canonical" href="https://yukegel.com"/>
//   <meta property="og:url" content="https://yukegel.com"/>
//   sitemap.xml → <loc>https://yukegel.com</loc> (TÜM URL'ler)
//
// Bu ZARARSIZ DEĞİL: canonical, YÖNLENDİREN bir URL'i işaret ediyordu. Google'a
// "bu sayfanın kanonik hâli X" deyip X'i 307 ile Y'ye göndermek çelişkili sinyal;
// Search Console bunu "Yönlendirmeli sayfa" olarak işaretler ve sitemap'teki
// 5000 URL'in tamamı gereksiz bir sıçrama harcar. Paylaşım önizlemelerinde de
// (WhatsApp/Twitter) fazladan bir redirect turu demek.
//
// KURAL: site kökünü ELLE YAZMA — buradan import et. `NEXT_PUBLIC_SITE_URL`
// tanımlıysa o kazanır (staging/preview ortamları için); yoksa üretim kanoniği.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yukegel.com';

/** Mutlak URL üretir: `mutlakUrl('/ilan/abc')` → `https://www.yukegel.com/ilan/abc` */
export function mutlakUrl(yol: string): string {
  return `${SITE_URL}${yol.startsWith('/') ? yol : `/${yol}`}`;
}
