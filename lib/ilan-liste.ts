/**
 * SPRINT_01 L4 — ana sayfa ilan listesinin TEK kaynağı olan sabitler.
 *
 * ESKİ HALİNİN SORUNU: aynı listenin limiti iki ayrı yerde, iki ayrı sayıydı.
 *   • `app/page.tsx` (SSR, ISR 30 sn) → `.limit(200)`
 *   • `app/_components/HomeClient.tsx` (istemci yenilemesi) → `.limit(30)`
 * Kullanıcı "Tekrar dene"ye bastığında ya da SSR boş döndüğünde liste sessizce
 * 200'den 30'a düşüyordu. Hiçbir hata yok, hiçbir uyarı yok — ilanlar "kayboluyor".
 *
 * İKİNCİ SORUN (sayaç): filtre bar'ındaki sayaç filtre yokken `totalCount`
 * gösteriyordu — yani PLATFORMDAKİ TÜM aktif ilanlar (her iki sekme dahil).
 * Ama altındaki liste yalnızca seçili sekmenin, kırpılmış ilk N ilanını
 * gösteriyor. "519 aktif ilan" yazıp 40 kart göstermek kullanıcıya sayfanın
 * bozuk olduğunu düşündürüyordu. Sayaç artık EKRANDAKİNİ sayar; platform
 * toplamı yalnız hero rozetinde (pazarlama bağlamında) kalır.
 *
 * ⚠️ Bu dosya İSTEMCİ bundle'ına giriyor: buraya asla sunucu-özel bir şey
 *    (service role key, next/headers, supabase-server) import etmeyin.
 */

/** Ana sayfada tek seferde çekilen azami ilan sayısı. SSR ve istemci AYNI değeri kullanır. */
export const ILAN_LIMITI = 200;
