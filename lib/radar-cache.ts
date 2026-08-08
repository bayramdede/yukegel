// lib/radar-cache.ts — Radar/analitik yanıtları için kısa ömürlü bellek önbelleği.
//
// 🚨 NEDEN VAR (8 Ağu 2026, ölçümle): radar sorgularının maliyeti SICAK durumda
// 45-250 ms, ama HER YENİ ROTADA (soğuk sayfa) 3-7 saniye. Ölçüm:
//   34→6: 2.876 ms · 35→16: 5.404 ms · 1→42: 7.304 ms · 7→33: 4.539 ms
//   (aynı rotanın 2. çağrısı: 45-250 ms)
// Sebep `listings` tablosunun 495 MB olması (133 MB'ı `raw_text`); her rota
// farklı heap sayfalarına dokunuyor ve diskten okuyor.
//
// Bunu tek bir sorgu ayarıyla çözemedik — kapsayıcı indeksler okunan sayfayı
// belirgin düşürdü (bkz. `docs/20260808_radar_hizlandirma.sql`) ama soğuk
// başlangıç maliyeti yapısal. Gerçek kullanım deseni ise TEKRARLI: admin aynı
// rotayı/ili ileri-geri açıyor, `days` filtresini değiştirip geri alıyor,
// sekmeler arasında gidip geliyor. Bu deseni önbellek tamamen düzleştiriyor.
//
// ⚠️ SÜREÇ BAŞINA bellek — `lib/kota.ts`teki desenle aynı. Sunucusuz ortamda her
// örnek kendi önbelleğini tutar; soğuk başlangıçta kaybolur. Bu KABUL EDİLEBİLİR:
// önbellek doğruluğun değil hızın parçası, ıskalarsa sorgu normal çalışır.
//
// ⚠️ TTL kısa (90 sn) çünkü radar CANLI veriye bakan bir istihbarat aracı:
// dakikalar önceki veriyi göstermek kabul edilebilir, saatler öncesini DEĞİL.
// Yanıt `onbellek: true` ve `yas_sn` ile geldiğini söylüyor — ekranda
// gösteriliyor, admin baktığı verinin tazeliğini BİLİYOR (sessiz bayat veri
// bu projede tekrarlayan bir hata sınıfı; gizlemiyoruz).

const TTL_MS = 90_000;
/** Rota/il kombinasyonu çok olabilir; sınırsız büyümesin. */
const MAX_GIRDI = 200;

type Girdi = { veri: unknown; yazildi: number };
const kutu = new Map<string, Girdi>();

/** En eski girdiyi atarak tavanı korur (basit LRU-benzeri; ekleme sırası yeter). */
function budan() {
  while (kutu.size > MAX_GIRDI) {
    const ilk = kutu.keys().next();
    if (ilk.done) break;
    kutu.delete(ilk.value);
  }
}

export type OnbellekSonuc<T> = { veri: T; onbellek: boolean; yasSn: number };

/**
 * `uret()` sonucunu `anahtar` altında TTL süresince paylaşır.
 *
 * ⚠️ Aynı anahtar için EŞZAMANLI istekler ayrı ayrı `uret()` çağırır (tek uçuş
 * / single-flight YOK). Bilinçli: radar admin aracı, eşzamanlılık düşük;
 * single-flight eklemek hata durumunda bekleyen istekleri de zehirler.
 */
export async function onbellekli<T>(
  anahtar: string,
  uret: () => Promise<T>,
  /**
   * `true` → önbellek OKUMAYI atla, yeniden üret ve üzerine yaz.
   * ⚠️ Arayüzdeki "↻ Yenile" butonu bunu göndermek ZORUNDA; göndermezse buton
   * aynı önbellekli yanıtı geri alır ve kullanıcıya YALAN söyler
   * (bastığı hâlde veri tazelenmemiş olur).
   */
  zorla = false,
): Promise<OnbellekSonuc<T>> {
  const simdi = Date.now();
  const mevcut = kutu.get(anahtar);
  if (!zorla && mevcut && simdi - mevcut.yazildi < TTL_MS) {
    return {
      veri: mevcut.veri as T,
      onbellek: true,
      yasSn: Math.round((simdi - mevcut.yazildi) / 1000),
    };
  }

  const veri = await uret();
  // Hata `uret()` içinden fırlarsa buraya gelmez → hatalı yanıt ÖNBELLEKLENMEZ.
  kutu.set(anahtar, { veri, yazildi: Date.now() });
  budan();
  return { veri, onbellek: false, yasSn: 0 };
}

/** Testler ve elle tazeleme için. */
export function onbellekTemizle() {
  kutu.clear();
}
