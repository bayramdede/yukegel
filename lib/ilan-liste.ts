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
import { ilAdi } from '@/lib/lokasyon';

export const ILAN_LIMITI = 200;

/**
 * Ana sayfa listesinin ORTAK kolon listesi (31 Tem 2026, Dalga 3).
 *
 * 🚨 NEDEN TEK YERDE: aynı sorgu artık ÜÇ yerden atılıyor —
 *   • `app/page.tsx`               (SSR, service role, ISR 30 sn)
 *   • `app/_components/HomeClient` (istemci yenilemesi / "Tekrar dene")
 *   • `app/api/listings/ara`       (sunucu tarafı il filtresi, Dalga 3)
 * Kolon listesi üç yere ayrı ayrı yazıldığında birini güncelleyip diğerini
 * unutmak kaçınılmaz. Bu dosyanın başındaki L4 hikâyesi (limit iki yerde iki
 * ayrı sayıydı) aynı hatanın daha ucuz bir versiyonuydu; kolon listesinde aynı
 * hata "kart boş görünüyor" diye çıkar.
 *
 * ⚠️ SPRINT_01 L1 — `contact_phone` BURAYA ASLA EKLENMEZ. Bu select hem anon
 *    key'li istemci sorgusunda hem de ISR çıktısında (tüm ziyaretçilerle
 *    paylaşılan HTML) kullanılıyor. Telefon yalnızca /api/ilan/[id]/telefon.
 *
 * ✅ DALGA 5 (3 Ağu 2026) — metin kolonları bu select'ten ÇIKARILDI.
 *    Dalga 3'te `origin_province_id` / `listing_stops.province_id` metnin
 *    YANINA eklenmişti (id filtre için, metin gösterim için). Artık gösterim de
 *    id'den türüyor: `ilAdi(id)`. 81 il `lib/constants/locations.json`'da (25 KB)
 *    ve `lib/lokasyon.ts` haritayı bellekte tutuyor — `provinces` join'ine gerek
 *    yok, tel üzerindeki veri de küçülüyor (smallint ⟵ text).
 *
 * 🚨 BU SELECT METİN KOLONLARINDAN ÖNCE TEMİZLENDİ, BU BİLEREK.
 *    Sıra "önce okuyanlar, sonra yazanlar": `province_id` bugün %100 dolu
 *    (31 Tem 2026 ölçümü: `listings`te 0 NULL, `listing_stops`ta 0), yani bu
 *    değişiklik TEK BAŞINA güvenle canlıya çıkar. Ters sırada — önce v4 metne
 *    yazmayı bıraksa — yeni ilanlar okuma yolları dönene kadar boş şehir
 *    gösterirdi. Okuyucu önce dönerse böyle bir ara pencere hiç oluşmaz.
 */
export const ILAN_SELECT = `
  id, listing_type, origin_province_id, origin_district,
  price_offer, source, created_at,
  trust_level, user_id, vehicle_type, body_type,
  available_date, date_flexible,
  listing_stops ( listing_id, stop_order, province_id, district, vehicle_count, cargo_type, weight_ton, pallet_count )
`;

export type RozetBilgi = { phone_verified: boolean; created_at: string };

/** Üyelik 30 günden yeni mi — "🆕 Yeni Üye" rozeti. */
export function uyeYeniMi(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * Ham `listings` satırını ana sayfa kartının beklediği objeye çevirir.
 * `ILAN_SELECT` ile birebir eşleşir; ikisi birlikte değişir.
 *
 * ⚠️ `stop_order` sıralaması BURADA yapılıyor. PostgREST gömülü diziyi sıralı
 *    döndürmeyi GARANTİ ETMEZ; sıralamayı çağırana bırakmak "2. durak önce
 *    görünüyor" hatasını üç ayrı yerde ayrı ayrı doğurur.
 */
export function ilanNormalize(ilan: any, rozet?: RozetBilgi | null) {
  const stops = ((ilan.listing_stops || []) as any[])
    .sort((a: any, b: any) => a.stop_order - b.stop_order);
  const aracTipiList: string[] = ilan.vehicle_type?.length
    ? ilan.vehicle_type
    : ([...new Set(stops.map((s: any) => s.cargo_type).filter(Boolean))] as string[]);
  return {
    id: ilan.id,
    tip: ilan.listing_type,
    // Dalga 5: gösterim de id'den türüyor. `?? ''` — id NULL ise (yalnız
    // düzeltilmemiş eski satırlarda mümkün) kart boş şehir gösterir; `undefined`
    // basıp React'te sessizce kaybolmasındansa boş dize daha dürüst.
    kalkis: ilAdi(ilan.origin_province_id) ?? '',
    // Dalga 3: filtre bu alanı kullanır, `kalkis` yalnız gösterim.
    kalkis_il_id: (ilan.origin_province_id ?? null) as number | null,
    kalkis_ilce: ilan.origin_district || '',
    duraklar: stops.map((s: any) => ({
      sehir: ilAdi(s.province_id) ?? '',
      il_id: (s.province_id ?? null) as number | null,
      ilce: s.district || '',
      ton: s.weight_ton,
      palet: s.pallet_count,
      arac_adet: s.vehicle_count,
    })),
    kaynak: ilan.source || 'form',
    sure: new Date(ilan.created_at).toLocaleDateString('tr-TR'),
    // tel alanı bilinçli olarak yok — bkz. yukarıdaki L1 notu.
    fiyat: ilan.price_offer?.toString() ?? null,
    tarih: ilan.available_date,
    tarihEsnek: ilan.date_flexible,
    aracTipleri: aracTipiList,
    ustyapilari: (ilan.body_type || []) as string[],
    dogrulanmamis: !ilan.user_id || ilan.trust_level === 'social',
    telefonDogrulandi: rozet?.phone_verified === true,
    yeniUye: rozet ? uyeYeniMi(rozet.created_at) : false,
    user_id: ilan.user_id,
  };
}

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
