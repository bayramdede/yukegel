/**
 * SPRINT_01 L2 — ince bir GA olay sarmalayıcısı.
 *
 * NEDEN AYRI DOSYA:
 *   GA `@next/third-parties/google` ile yükleniyor ve `window.gtag`'ı GLOBAL olarak
 *   bırakıyor. Her çağrı yerinde `typeof window !== 'undefined' && window.gtag?.(…)`
 *   yazmak hem gürültülü hem de bir yerde unutulduğunda SSR'da patlar. Tek kapı.
 *
 * NEDEN HER ŞEY SESSİZCE YUTULUYOR:
 *   Ölçüm asla kullanıcı akışını bozmamalı. GA yüklenmemişse (reklam engelleyici,
 *   `NEXT_PUBLIC_GA_ID` tanımsız, ağ hatası) fonksiyon hiçbir şey yapmaz.
 *
 * ⚠️ ASLA KİŞİSEL VERİ GÖNDERME. Telefon, e-posta, TCKN/VKN, tam ad → GA'ya gitmez.
 *    Yalnızca kategorik/sayısal alanlar (`tip: 'yuk' | 'arac'` gibi) gönderilir.
 *    Bu KVKK gereği; GA verisi yurt dışına çıkar.
 */

declare global {
  interface Window {
    gtag?: (komut: string, olay: string, parametreler?: Record<string, unknown>) => void;
  }
}

export function olayGonder(olay: string, parametreler?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', olay, parametreler);
  } catch {
    // Ölçüm hatası akışı bozmaz.
  }
}
