// lib/redirect.ts — SPRINT_01 A7
//
// Sorun: kullanıcı `/ilan-ver`'e tıklıyor, proxy onu `/giris?redirect=/ilan-ver`'e atıyor.
// Ama giriş yolu Google OAuth veya magic-link üzerinden geçiyorsa o query param KAYBOLUYOR:
//   - Google: Supabase `redirectTo`'yu allow-list'e göre normalize eder
//   - magic-link (merge / switch-account): dönüş adresi link üretilirken sabitlenmiş
//   - `?hesap=tasindi` / `?hesap=eslesme` dallarında zaten hiç taşınmıyordu
// Sonuç: kullanıcı üç ekran sonra anasayfaya bırakılıyor, ne yapmak istediğini unutmuş oluyor.
//
// Çözüm: hedefi query param'a EK OLARAK kısa ömürlü bir cookie'de tut. Cookie tüm
// yönlendirme zincirinden sağ çıkar; ilk kullanımda silinir.
//
// Güvenlik: bu değer tarayıcıdan gelen bir yönlendirme hedefi, yani AÇIK YÖNLENDİRME
// (open redirect) riski taşır. `guvenliRedirect` dışında ASLA doğrudan kullanma.

export const REDIRECT_COOKIE = 'yk_redirect';
export const REDIRECT_COOKIE_MAX_AGE = 600; // 10 dk — bir giriş akışına fazlasıyla yeter

/**
 * Yönlendirme hedefini doğrula. Yalnız kendi sitemizde, tek eğik çizgiyle başlayan
 * göreli yollar geçerli.
 *
 * Reddedilenler:
 *   `https://kotu.site`  → mutlak URL
 *   `//kotu.site`        → protokol-göreli URL (tarayıcı dış siteye gider)
 *   `/\kotu.site`        → bazı tarayıcılarda `//` gibi yorumlanır
 *   `/giris...`          → giriş sonrası tekrar girişe atmak döngü demek
 */
export function guvenliRedirect(ham: string | null | undefined): string | null {
  if (!ham) return null;
  let deger = ham.trim();
  if (deger.length === 0 || deger.length > 512) return null;

  // Kaçırılmış (`%2f%2f`) formlar için bir kez çöz — çözemezsek reddet.
  if (deger.includes('%')) {
    try { deger = decodeURIComponent(deger); } catch { return null; }
  }

  if (!deger.startsWith('/')) return null;
  if (deger.startsWith('//') || deger.startsWith('/\\')) return null;
  if (deger.includes('\n') || deger.includes('\r')) return null;

  // Giriş/çıkış ekranlarına geri dönmek anlamsız (ve döngü riski).
  const yol = deger.split('?')[0];
  if (yol === '/giris' || yol === '/cikis' || yol.startsWith('/auth/')) return null;

  return deger;
}
