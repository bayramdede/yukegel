// lib/ilan-limit.ts — V6: İLAN OLUŞTURMA TAVANI + 24 SAATLİK MÜKERRER TESPİTİ
//
// `ILAN_VER_ANALIZ` V6. `ilanYaz()` bugüne kadar KAÇ ilan açıldığına hiç bakmıyordu:
// tek bir oturumla dakikada yüzlerce ilan açmak mümkündü ve aynı seferin onlarca
// kopyası listeyi doldurabiliyordu.
//
// 🚨 V7'DEN DEVRALINAN KURAL: KAPI İLE SAYAÇ AYNI OLAYI ÖLÇMELİ.
// Burada bu kural KENDİLİĞİNDEN sağlanıyor — çünkü sayılan olay ("bir ilan yazıldı")
// zaten `listings` tablosunda bir SATIR bırakıyor. LLM tarafındaki tuzak (ücretli
// çağrı yapılıp kayıt oluşmayınca sayacın hiç artmaması) burada YOK. Bu yüzden
// AS­IL sayaç DB, `lib/kota.ts` ise yalnız ek bir patlama (burst) siperi:
//
//   - DB sayımı doğrudur ama İKİ EŞZAMANLI istek ikisi de "19 var" okuyup geçebilir.
//   - Bellek sayacı o yarışı aynı instance içinde kapatır, ama soğuk başlangıçta
//     sıfırlanır ve çok instance'ta böler (`lib/kota.ts` başlığındaki sınırlar).
//
// İkisi birbirinin eksiğini kapatıyor, o yüzden tüketim = MAKSİMUM(DB, bellek).
// TOPLAMAK yanlış olurdu: yazılan bir ilan iki sayaçta da görünür, toplamak onu
// iki kez sayardı (aynı gerekçe `lib/ai-kota.ts`'te de yazılı).

import { getServiceSupabase } from './auth';
import { kotaDene } from './kota';

export const ILAN_SAAT_MS = 60 * 60 * 1000;
export const ILAN_GUN_MS = 24 * 60 * 60 * 1000;

export const ILAN_AD_SAATLIK = 'ilan-saatlik';
export const ILAN_AD_GUNLUK = 'ilan-gunluk';

/**
 * Admin `system_config`'ten anahtarı silerse/bozarsa devreye giren tabanlar.
 * `ILAN_VER_ANALIZ` V6 önerisi 20/saat–60/gün'dü; canlıda `spam_threshold`
 * zaten 12/saat yazıyor ve admin değeri KAZANIR (aşağıdaki `ilanLimitOku`).
 */
const FALLBACK_SAATLIK = 20;
const FALLBACK_GUNLUK = 60;

export interface IlanLimitAyar {
  saatlik: number;
  gunluk: number;
}

/**
 * Tavanları `system_config.rate_limit.spam_threshold`'tan okur.
 *
 * ⚠️ YENİ ANAHTAR AÇILMADI, VAR OLAN KULLANILDI. `spam_threshold` bugün yalnız
 * `app/api/whatsapp-parse/route.ts` tarafından okunuyordu ve `max_listings_per_hour`
 * alanı zaten "kullanıcı başına saatlik ilan tavanı" demek. İkinci bir anahtar
 * açmak aynı kavramı iki yerden yönetmek olurdu — biri güncellenip diğeri unutulur.
 * `app/admin/sistem-ayarlari` `rate_limit` kategorisini zaten listeliyor, yani
 * yönetim arayüzü bedava geliyor.
 *
 * `max_listings_per_day` bugün JSON'da YOK; eklenene kadar fallback geçerli.
 * Eklemek için: `update system_config set value = value || '{"max_listings_per_day":60}'
 * where category='rate_limit' and key='spam_threshold';`
 */
export async function ilanLimitOku(): Promise<IlanLimitAyar> {
  try {
    const svc = getServiceSupabase();
    const { data } = await svc
      .from('system_config')
      .select('value')
      .eq('category', 'rate_limit')
      .eq('key', 'spam_threshold')
      .maybeSingle();

    const v = (data?.value ?? {}) as Record<string, unknown>;
    const saatlik = pozitifTamSayi(v.max_listings_per_hour, FALLBACK_SAATLIK);
    const gunluk = pozitifTamSayi(v.max_listings_per_day, FALLBACK_GUNLUK);
    // Günlük < saatlik anlamsız (admin yanlış girmiş olabilir) — saatliğe çek.
    return { saatlik, gunluk: Math.max(saatlik, gunluk) };
  } catch {
    return { saatlik: FALLBACK_SAATLIK, gunluk: FALLBACK_GUNLUK };
  }
}

export type IlanTavanSonuc =
  | { asildi: false }
  | { asildi: true; hata: string; pencere: 'saat' | 'gun'; kullanim: number; limit: number };

/**
 * Tavana BAKAR, hiçbir şey saymaz. Sayaç yalnız yazma başarılı olunca
 * `ilanTavanIsle()` ile işlenir (§9 — başarısız istek kullanıcının hakkını yakmaz).
 *
 * TEK DB SORGUSU: son 24 saatin `created_at` listesi çekilip saatlik/günlük ikisi de
 * JS'te sayılıyor. İki ayrı `count` sorgusu atmak bu yolu her ilanda iki gidiş-dönüş
 * pahalandırırdı — Excel toplu yüklemede satır başına çarpılıyor.
 *
 * `limit` bilerek `gunluk + 1`: daha fazlasını çekmenin bilgi değeri yok, çünkü
 * `gunluk + 1` satır gelmesi zaten "günlük tavan dolu" demek. `order desc` şart —
 * sırasız kırpma saatlik sayımı bozardı.
 */
export async function ilanTavanBak(
  userId: string,
  ayar: IlanLimitAyar,
): Promise<IlanTavanSonuc> {
  const simdi = Date.now();
  const gunOnce = new Date(simdi - ILAN_GUN_MS).toISOString();

  let dbSaatlik = 0;
  let dbGunluk = 0;
  let saatlikEnEski: number | null = null;
  let gunlukEnEski: number | null = null;

  try {
    const svc = getServiceSupabase();
    const { data } = await svc
      .from('listings')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', gunOnce)
      .order('created_at', { ascending: false })
      .limit(ayar.gunluk + 1);

    for (const r of (data ?? []) as Array<{ created_at: string }>) {
      const t = Date.parse(r.created_at);
      if (!Number.isFinite(t)) continue;
      dbGunluk++;
      if (gunlukEnEski === null || t < gunlukEnEski) gunlukEnEski = t;
      if (simdi - t < ILAN_SAAT_MS) {
        dbSaatlik++;
        if (saatlikEnEski === null || t < saatlikEnEski) saatlikEnEski = t;
      }
    }
  } catch {
    // DB okunamadıysa TAVANI AÇMA değil, BELLEĞE GÜVEN: aşağıdaki `max` zaten
    // bellek sayacını kullanır. Erişilemeyen bir sayaç yüzünden ilan vermeyi
    // tamamen durdurmak, kötüye kullanımdan daha büyük bir hasar olurdu.
  }

  const bellekSaatlik = bellekKullanim(ILAN_AD_SAATLIK, userId, ayar.saatlik, ILAN_SAAT_MS);
  const bellekGunluk = bellekKullanim(ILAN_AD_GUNLUK, userId, ayar.gunluk, ILAN_GUN_MS);

  const saatlikKullanim = Math.max(dbSaatlik, bellekSaatlik);
  const gunlukKullanim = Math.max(dbGunluk, bellekGunluk);

  if (saatlikKullanim >= ayar.saatlik) {
    return {
      asildi: true,
      pencere: 'saat',
      kullanim: saatlikKullanim,
      limit: ayar.saatlik,
      hata: `Saatlik ilan sınırına ulaştınız (${ayar.saatlik} ilan/saat). ${bekleMetni(saatlikEnEski, ILAN_SAAT_MS, simdi)} tekrar deneyebilirsiniz.`,
    };
  }

  if (gunlukKullanim >= ayar.gunluk) {
    return {
      asildi: true,
      pencere: 'gun',
      kullanim: gunlukKullanim,
      limit: ayar.gunluk,
      hata: `Günlük ilan sınırına ulaştınız (${ayar.gunluk} ilan/gün). ${bekleMetni(gunlukEnEski, ILAN_GUN_MS, simdi)} tekrar deneyebilirsiniz.`,
    };
  }

  return { asildi: false };
}

/** Sayaçları İŞLER. YALNIZCA ilan gerçekten yazıldıktan sonra çağır. */
export function ilanTavanIsle(userId: string, ayar: IlanLimitAyar): void {
  kotaDene({ ad: ILAN_AD_SAATLIK, anahtar: userId, limit: ayar.saatlik, pencereMs: ILAN_SAAT_MS });
  kotaDene({ ad: ILAN_AD_GUNLUK, anahtar: userId, limit: ayar.gunluk, pencereMs: ILAN_GUN_MS });
}

/**
 * Son 24 saatte AYNI seferin ilanı var mı?
 *
 * Anahtar: `(user_id, listing_type, origin_province_id, İLK durağın province_id,
 * available_date)`.
 *
 * ⚠️ `ILAN_VER_ANALIZ` V6'daki tanım "origin_city + ilk durak city" diyordu; o tanım
 * ARTIK UYGULANAMAZ. Dalga 5 (`docs/20260731_dalga5_metin_kolon_drop.sql`)
 * `listings.origin_city` ve `listing_stops.city` kolonlarını DÜŞÜRDÜ — şehir artık
 * yalnız `province_id`. Metin karşılaştırması zaten "İstanbul"/"istanbul"/"İSTANBUL"
 * üçlüsünde yanılırdı; id karşılaştırması hem mümkün olan hem doğru olan.
 *
 * `stop_order = 1` — `ilan_olustur()` durakları `with ordinality` ile numaralıyor,
 * yani ilk durak 1'dir (0 değil).
 *
 * Yalnız GÖRÜNÜR/KUYRUKTAKİ ilanlar mükerrer sayılır: `expired` olan bir ilanı
 * yenilemek meşru, `rejected`/`archived` olanı düzeltip yeniden vermek de öyle.
 */
export async function mukerrerBul(opts: {
  userId: string;
  tip: string;
  kalkisIlId: number;
  ilkDurakIlId: number;
  tarih: string;
}): Promise<{ id: string; createdAt: string } | null> {
  const { userId, tip, kalkisIlId, ilkDurakIlId, tarih } = opts;
  try {
    const svc = getServiceSupabase();
    const gunOnce = new Date(Date.now() - ILAN_GUN_MS).toISOString();

    // 1) Aday ilanlar — durak koşulu HARİÇ her şey.
    //    İki adımlı, çünkü PostgREST gömülü (`!inner`) filtreleri sessizce
    //    kapsam dışı davranabiliyor; iki düz sorgu okunabilir ve doğrulanabilir.
    //    Maliyet: ikinci sorgu YALNIZCA aday varsa atılıyor — normal akışta 1 sorgu.
    const { data: adaylar } = await svc
      .from('listings')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('listing_type', tip)
      .eq('origin_province_id', kalkisIlId)
      .eq('available_date', tarih)
      .gte('created_at', gunOnce)
      .in('status', ['active', 'passive'])
      .in('moderation_status', ['pending', 'approved', 'auto_published'])
      .order('created_at', { ascending: false })
      .limit(20);

    const liste = (adaylar ?? []) as Array<{ id: string; created_at: string }>;
    if (liste.length === 0) return null;

    // 2) Adaylardan hangisinin İLK durağı aynı ile gidiyor?
    const { data: duraklar } = await svc
      .from('listing_stops')
      .select('listing_id')
      .in('listing_id', liste.map(l => l.id))
      .eq('stop_order', 1)
      .eq('province_id', ilkDurakIlId)
      .limit(1);

    const eslesenId = (duraklar ?? [])[0]?.listing_id as string | undefined;
    if (!eslesenId) return null;

    const eslesen = liste.find(l => l.id === eslesenId);
    return { id: eslesenId, createdAt: eslesen?.created_at ?? '' };
  } catch {
    // Mükerrer sorgusu bir KOLAYLIK kontrolü; patlarsa ilan yazılmaya devam eder.
    return null;
  }
}

// ── Yardımcılar ────────────────────────────────────────────────────────────

function pozitifTamSayi(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  const t = Math.trunc(n);
  return t > 0 ? t : fallback;
}

/**
 * Bellek sayacındaki tüketimi verir. `sayma: true` — olayı KAYDETMEZ.
 * `kalan` limitten düşülünce tüketim çıkar; kova doluysa tüketim = limit.
 */
function bellekKullanim(ad: string, anahtar: string, limit: number, pencereMs: number): number {
  const bak = kotaDene({ ad, anahtar, limit, pencereMs, sayma: true });
  return bak.izinli ? limit - bak.kalan : limit;
}

/** "43 dakika sonra" / "6 saat sonra" — pencereden ilk olay ne zaman düşecek? */
function bekleMetni(enEski: number | null, pencereMs: number, simdi: number): string {
  if (enEski === null) return 'Bir süre sonra';
  const kalanMs = Math.max(60_000, pencereMs - (simdi - enEski));
  const dk = Math.ceil(kalanMs / 60_000);
  if (dk < 60) return `${dk} dakika sonra`;
  return `${Math.ceil(dk / 60)} saat sonra`;
}
