// lib/kota.ts — SPRINT_01 G1/G2
//
// Basit, bellek içi kayan pencere (sliding window) sayacı.
//
// ⚠️ SINIRLARI ÖNCE OKU — bu bir savunma katmanı, sihirli kalkan değil:
//   1. Sayaç PROCESS BELLEĞİNDE. Vercel'de birden çok lambda/instance çalışırsa her biri
//      kendi sayacını tutar; gerçek limit ≈ (limit × instance sayısı). Kör döngüleri ve
//      amatör kötüye kullanımı keser, kararlı bir saldırganı durdurmaz.
//      Kalıcı çözüm: Vercel KV / Upstash Redis. Trafik artınca `kotaDene`'nin gövdesini
//      oraya taşımak yeterli — çağıran taraflar değişmez.
//   2. Deploy/soğuk başlangıç sayaçları sıfırlar.
//   3. IP `x-forwarded-for`'dan okunuyor; proxy arkasında güvenilir, doğrudan erişimde
//      taklit edilebilir. Bu yüzden IP kotası TEK savunma olmamalı.
//
// Yine de: A4b'deki (`sahiplen`) bellek içi cooldown gerçek bir SMS bombardımanını
// kesti. Aynı desen burada genelleştiriliyor.

type Kayit = { t: number; d?: string }

// ad → anahtar → olaylar
const depo = new Map<string, Map<string, Kayit[]>>()

export type KotaSonuc =
  | { izinli: true; kalan: number }
  | { izinli: false; bekleSn: number }

/**
 * Kayan pencerede olay sayar.
 *
 * @param ad        Sayaç adı (ör. 'otp-ip'). Farklı adlar birbirini etkilemez.
 * @param anahtar   Kimlik (IP, e-posta, ilan id…).
 * @param limit     Pencere içinde izin verilen olay sayısı.
 * @param pencereMs Pencere uzunluğu.
 * @param deger     Verilirse FARKLI değer sayılır (ör. bir IP'nin kaç farklı numaraya
 *                  SMS attırdığı). Aynı değerin tekrarı kotayı tüketmez.
 * @param sayma     true ise sadece BAKAR, olayı kaydetmez (ön kontrol için).
 */
export function kotaDene(opts: {
  ad: string
  anahtar: string
  limit: number
  pencereMs: number
  deger?: string
  sayma?: boolean
}): KotaSonuc {
  const { ad, anahtar, limit, pencereMs, deger, sayma } = opts
  const simdi = Date.now()

  let adDepo = depo.get(ad)
  if (!adDepo) { adDepo = new Map(); depo.set(ad, adDepo) }

  // Bellek sızıntısını önle: depo şişince süresi dolmuş anahtarları at.
  if (adDepo.size > 5_000) {
    for (const [k, v] of adDepo) {
      const kalanlar = v.filter(x => simdi - x.t < pencereMs)
      if (kalanlar.length === 0) adDepo.delete(k); else adDepo.set(k, kalanlar)
    }
  }

  const olaylar = (adDepo.get(anahtar) ?? []).filter(x => simdi - x.t < pencereMs)

  // Kaç birim tüketilmiş? `deger` varsa FARKLI değer sayısı, yoksa olay sayısı.
  const tuketim = deger === undefined
    ? olaylar.length
    : new Set(olaylar.map(x => x.d)).size

  // `deger` zaten pencerede varsa yeni birim tüketmez (aynı numaraya tekrar kod istemek
  // "farklı numara" kotasını yakmasın — onu ayrı bir cooldown sayacı kısıtlar).
  const zatenVar = deger !== undefined && olaylar.some(x => x.d === deger)

  if (!zatenVar && tuketim >= limit) {
    // Pencereden ilk hangi olay düşecek? O ana kadar beklemek gerekiyor.
    const enEski = olaylar.reduce((a, b) => (a.t < b.t ? a : b))
    const bekleSn = Math.max(1, Math.ceil((pencereMs - (simdi - enEski.t)) / 1000))
    return { izinli: false, bekleSn }
  }

  if (!sayma) {
    olaylar.push({ t: simdi, d: deger })
    adDepo.set(anahtar, olaylar)
  }

  const yeniTuketim = deger === undefined
    ? olaylar.length
    : new Set(olaylar.map(x => x.d)).size
  return { izinli: true, kalan: Math.max(0, limit - yeniTuketim) }
}

/** Sayaçtan bir anahtarı tamamen sil (ör. başarılı girişten sonra hata sayacını sıfırla). */
export function kotaSifirla(ad: string, anahtar: string): void {
  depo.get(ad)?.delete(anahtar)
}

/**
 * İstek IP'si. Vercel `x-forwarded-for` zincirinin İLK elemanını gerçek istemci olarak
 * verir. Yoksa `x-real-ip`. Hiçbiri yoksa 'bilinmeyen' — o durumda tüm IP'siz istekler
 * aynı kovaya düşer (kasıtlı: kotasız kalmaktansa toplu kısıtlansın).
 */
export function istekIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const ilk = xff.split(',')[0]?.trim()
    if (ilk) return ilk
  }
  return request.headers.get('x-real-ip')?.trim() || 'bilinmeyen'
}
