// lib/ai-kota.ts — V7: ÜCRETLİ LLM ÇAĞRISININ KOTASI
//
// 🚨 KAPI İLE SAYAÇ AYNI OLAYI ÖLÇMELİ.
// Eskiden kapı `parse` anındaydı ama sayaç `kayıt` üzerindeydi:
// `countAiListingsLast24h()` `listings`te `raw_text IS NOT NULL` satırları sayar.
// Ayrıştırıp KAYDETMEYEN kullanıcının sayacı hiç artmıyordu → Anthropic'e sınırsız
// ücretli çağrı. Aynı ders SMS'te (`/api/auth/otp`) bir kez öğrenilmişti;
// LLM'e uygulanmamıştı. Artık gerçek sayaç ÇAĞRIYI sayıyor.
//
// TEK BÜTÇE, İKİ KANAL. `/api/parse-text` (web) ve `/api/whatsapp` (Twilio) aynı
// `ai-parse-kullanici` kovasını paylaşır. Bu KASITLI: ikisi de aynı kullanıcı adına
// aynı Anthropic hesabından para harcıyor; ayrı kova açmak günlük limiti sessizce
// ikiye katlardı. (`ILAN_VER_ANALIZ` V7 bu paylaşımı "kirli sayaç" diye işaretlemişti;
// kirli olan sayacın DB tarafıydı — kanalların bütçeyi paylaşması doğru davranış.)
//
// ⚠️ `lib/kota.ts` process-local: çok instance'ta gerçek limit ≈ (limit × instance),
// deploy/soğuk başlangıç sıfırlar. Bu yüzden DB sayacı ATILMADI — tüketim iki sayacın
// MAKSİMUMU. Soğuk başlangıçta bellek 0'a düşse bile DB tarafı taban oluşturur;
// ikisini TOPLAMAK ise kaydedilen bir ilanı iki kez sayardı.
//
// §9 kuralı: önce `bak()` (kaydetmez), sayaç yalnız Anthropic çağrısı BAŞARILI
// döndükten sonra `isle()` ile işlenir — sağlayıcı arızası kullanıcının kotasını yakmaz.
import { kotaDene } from './kota'

export const AI_GUN_MS = 24 * 60 * 60 * 1000
export const AI_SAAT_MS = 60 * 60 * 1000

/** IP başına saatlik tavan. Kullanıcı kotası KİŞİ başı olduğu için tek başına yetmez:
 *  çok hesap açmak onu çarpar, IP tavanı o çarpanı kısar. */
export const AI_IP_SAATLIK = 30

export const AI_AD_KULLANICI = 'ai-parse-kullanici'
export const AI_AD_IP = 'ai-parse-ip'

export type AiKotaDurum = {
  /** Gerçek tüketim: max(DB sayacı, bellek çağrı sayacı). */
  kullanim: number
  /** Kullanıcı günlük kotası doldu mu? */
  doldu: boolean
  /** IP saatlik tavanı doldu mu? (`ip` verilmediyse her zaman false) */
  ipDoldu: boolean
  /** IP tavanı dolduysa kaç saniye beklenecek. */
  ipBekleSn: number
  /** Yalnızca teşhis/log için — DB ve bellek sayaçları ayrı ayrı. */
  cagriKullanim: number
}

/**
 * Kotaya BAKAR, hiçbir şey saymaz.
 *
 * @param userId    Kullanıcı id'si — günlük kovanın anahtarı.
 * @param quota     `getAiQuotaForUser()` sonucu (günlük çağrı hakkı).
 * @param dbKullanim `countAiListingsLast24h()` sonucu — taban olarak kullanılır.
 * @param ip        Verilirse IP saatlik tavanı da kontrol edilir. WhatsApp webhook'unda
 *                  VERİLMEZ: istek Twilio'nun IP'sinden gelir, orada IP kovası tüm
 *                  kullanıcıları tek kovaya toplayıp topluca kilitlerdi.
 */
export function aiKotaBak(
  userId: string, quota: number, dbKullanim: number, ip?: string
): AiKotaDurum {
  const cagriBak = kotaDene({
    ad: AI_AD_KULLANICI, anahtar: userId, limit: quota, pencereMs: AI_GUN_MS, sayma: true,
  })
  // `kalan` limitten düşülünce gerçek tüketim çıkar; kova doluysa tüketim = quota.
  const cagriKullanim = cagriBak.izinli ? quota - cagriBak.kalan : quota
  const kullanim = Math.max(dbKullanim, cagriKullanim)

  let ipDoldu = false
  let ipBekleSn = 0
  if (ip) {
    const ipBak = kotaDene({
      ad: AI_AD_IP, anahtar: ip, limit: AI_IP_SAATLIK, pencereMs: AI_SAAT_MS, sayma: true,
    })
    if (!ipBak.izinli) { ipDoldu = true; ipBekleSn = ipBak.bekleSn }
  }

  return { kullanim, doldu: kullanim >= quota, ipDoldu, ipBekleSn, cagriKullanim }
}

/**
 * Sayacı İŞLER. YALNIZCA Anthropic çağrısı başarılı döndükten sonra çağır —
 * o an para harcanmıştır. Sonraki JSON ayrıştırma/doğrulama hataları sayacı GERİ ALMAZ:
 * maliyet zaten oluştu, "kötü çıktı" bedava tekrar hakkı değil.
 */
export function aiKotaIsle(userId: string, quota: number, ip?: string): void {
  kotaDene({ ad: AI_AD_KULLANICI, anahtar: userId, limit: quota, pencereMs: AI_GUN_MS })
  if (ip) kotaDene({ ad: AI_AD_IP, anahtar: ip, limit: AI_IP_SAATLIK, pencereMs: AI_SAAT_MS })
}
