// lib/kimlik.ts — SPRINT_01 K2b
//
// TCKN/VKN algoritmik doğrulaması. Aynı fonksiyon hem istemcide (anlık form uyarısı)
// hem sunucuda (`app/profil-tamamla/actions.ts`) kullanılır.
//
// NEDEN ORTAK MODÜL: iki ayrı kopya vardı ve birinin düzeltilip diğerinin unutulması
// sessiz bir tutarsızlık yaratır — istemci "geçerli" der, sunucu reddeder (ya da tersi,
// ki tehlikeli olan o). Tek kaynak.
//
// ⚠️ İstemci kontrolü GÜVENLİK DEĞİL, sadece UX. Sunucu tarafı doğrulama HER ZAMAN
// çalışmalı: istemci devtools'la atlanabilir, PostgREST'e doğrudan istek atılabilir.
// Bu modülü istemciden kaldırma; sunucudan ASLA kaldırma.
//
// Saf fonksiyonlar — 'use server' YOK, ikisi de import edebilsin.

/**
 * T.C. Kimlik Numarası doğrulaması (11 hane).
 * Kural: ilk hane 0 olamaz; 10. hane ((tek haneler toplamı×7) − çift haneler toplamı) mod 10;
 * 11. hane ilk 10 hanenin toplamının mod 10'u.
 */
export function tcknGecerli(tckn: string): boolean {
  if (!/^\d{11}$/.test(tckn) || tckn[0] === '0') return false;
  const d = tckn.split('').map(Number);
  const t1 = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  if (((t1 % 10) + 10) % 10 !== d[9]) return false;
  const t2 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return t2 % 10 === d[10];
}

/**
 * Vergi Kimlik Numarası doğrulaması (10 hane, GİB algoritması).
 */
export function vknGecerli(vkn: string): boolean {
  if (!/^\d{10}$/.test(vkn)) return false;
  const d = vkn.split('').map(Number);
  let toplam = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + 10 - (i + 1)) % 10;
    toplam += tmp === 9 ? 9 : (tmp * Math.pow(2, 10 - (i + 1))) % 9;
  }
  return d[9] === (10 - (toplam % 10)) % 10;
}
