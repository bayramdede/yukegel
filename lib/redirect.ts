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

/**
 * `/giris` adresini HEDEFİYLE BİRLİKTE üret (29 Tem 2026).
 *
 * 🚨 NEDEN VAR: `guvenliRedirect` + `yk_redirect` cookie zinciri (A7) doğru çalışıyordu
 * ama YALNIZCA proxy'nin koruduğu 5 rota için (`/panel`, `/ilan-ver`, `/araclarim`,
 * `/profil`, `/moderator`). Diğer her yerde giriş bağlantısı ÇIPLAK `/giris` idi:
 * header, footer, "Üye Ol" butonu, `/hakkimizda`, `/nasil-calisir`…
 *
 * Somut şikâyet: bir kullanıcı ilanlarını `/u/<id>` adresiyle paylaşıyor. Gelen kişi
 * header'daki "Giriş Yap"a basıyor, giriş yapıyor ve ANA SAYFAYA düşüyor — paylaşılan
 * sayfa gitti, o kişinin ilanlarını bir daha bulamıyor. Bağlantı boşa gitmiş oluyor.
 *
 * Bu fonksiyon hedefi TEK yerden kurar ki her çağrı yeri `encodeURIComponent` ve
 * `guvenliRedirect` çağırmayı hatırlamak zorunda kalmasın (biri unutulunca sessizce
 * ana sayfaya düşüyoruz — hata vermiyor, sadece yanlış çalışıyor).
 *
 * ⚠️ `yol` GEÇERSİZSE (`/giris`in kendisi, mutlak URL, boş) `redirect` HİÇ eklenmez;
 *    `/giris`e `redirect=/giris` yazmak sonsuz döngü olurdu.
 *
 * @param yol  Dönülecek yer: `pathname` (+ istenirse `?query`).
 * @param mod  `'kayit'` verilirse doğrudan kayıt formu açılır (F1).
 */
export function girisAdresi(yol: string | null | undefined, mod?: 'kayit'): string {
  const params = new URLSearchParams();
  if (mod) params.set('mod', mod);
  const hedef = guvenliRedirect(yol);
  if (hedef) params.set('redirect', hedef);
  const qs = params.toString();
  return qs ? `/giris?${qs}` : '/giris';
}
