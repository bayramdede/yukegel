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

/**
 * Bir ilanın TÜM duraklarındaki sayısal bir alanın toplamı (29 Tem 2026).
 *
 * 🚨 NEDEN VAR: kartlar eskiden `duraklar[0].ton` / `stops[0].weight_ton` yazıyordu —
 * yani ÇOK DURAKLI ilanda yalnızca BİRİNCİ durağın tonajı görünüyordu. Mersin 8t +
 * Adana 12t + Hatay 5t olan bir ilan listede "⚖ 8 ton" diye çıkıyordu: yükün %68'i
 * ekranda yok. Nakliyeci aracını 8 tona göre seçip ilana giriyor, gerçek yükü orada
 * öğreniyordu. Aynı hata palet sayısında da vardı. İki ayrı ekranda (ana sayfa +
 * /panel) aynı kopyala-yapıştır hatası olduğu için düzeltme burada, TEK yerde.
 *
 * 🔁 `PROJE_HARITASI §9`'daki "rota verisi `listings`'te değil `listing_stops`'ta"
 * kuralının devamı: durak verisi ÇOKLU'dur, ilk satırı okumak veriyi kırpar.
 *
 * ⚠️ Alan adı ekrandan ekrana değişiyor (ana sayfa objesi `ton`/`palet`'e
 * normalize ediyor, panel ham `weight_ton`/`pallet_count` kullanıyor), o yüzden
 * birden çok aday anahtar kabul ediliyor.
 *
 * ⚠️ `weight_ton` Postgres'te `numeric`; PostgREST bunu bazen STRING döndürür
 * ("8.50"). Düz `+` string birleştireceği için `Number()` zorunlu. Ondalık
 * toplamdaki kayan nokta artığı (0.1+0.2 = 0.30000000000000004) 2 haneye
 * yuvarlanarak kesiliyor.
 *
 * @returns toplam; hiçbir durakta geçerli/pozitif değer yoksa `null`
 *          (0 ile "veri yok" karışmasın diye — çip 0 ise hiç basılmamalı).
 */
export function durakToplami(duraklar: unknown, alanlar: string[]): number | null {
  if (!Array.isArray(duraklar) || duraklar.length === 0) return null;
  let toplam = 0;
  let varMi = false;
  for (const d of duraklar) {
    if (!d || typeof d !== 'object') continue;
    for (const alan of alanlar) {
      const ham = (d as Record<string, unknown>)[alan];
      if (ham === null || ham === undefined || ham === '') continue;
      const n = Number(ham);
      if (Number.isFinite(n) && n > 0) {
        toplam += n;
        varMi = true;
      }
      break; // ilk dolu aday anahtar kazanır; aynı değeri iki kez saymayalım
    }
  }
  if (!varMi) return null;
  return Math.round(toplam * 100) / 100;
}
