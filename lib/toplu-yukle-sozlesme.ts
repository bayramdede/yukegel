// lib/toplu-yukle-sozlesme.ts — TOPLU YÜKLEME İSTEMCİ↔ROUTE SÖZLEŞMESİ.
//
// 🚨 `ILAN_VER_ANALIZ` B1. Bu özellik aylarca ÇALIŞMADI ve kimse fark etmedi:
// `TopluYukle.tsx` JSON `{action, rows, userId}` yolluyordu, `/api/excel-import`
// ise `formData().get('file')` okuyordu. İki taraf farklı protokol konuşuyordu ve
// TypeScript göremedi çünkü `fetch` gövdesi `any`. Üstelik istemci şablonu
// `'Kalkış İli'`, route `'Kalkış Şehri'` bekliyordu — ikinci, bağımsız bir kırık.
//
// KURAL: `fetch` ile konuşan her istemci↔route çifti sözleşmesini TEK bir dosyada
// tanımlar; iki taraf da BURADAN import eder. İstemci `satisfies` ile gövdeyi
// mühürler, route `gövdeAyristir()` ile çözer. Böylece ayrışma derleme zamanında
// yakalanır, canlıda değil.
//
// ⚠️ `userId` sözleşmede YOK ve olmayacak. Kullanıcı kimliği OTURUMDAN okunur.

/** Excel'den okunmuş ham satır — hiçbir doğrulamadan geçmemiş hâli. */
export interface HamSatir {
  seferNo: string;
  kalkisIli: string;
  kalkisIlce: string;
  varisIli: string;
  varisIlce: string;
  /**
   * ⚠️ Şablonda kolon var, sözleşmede alan var, route satırı taşıyor — ama HİÇBİR YERDE
   * OKUNMUYOR. Kullanıcı doldurup gönderiyor ve değeri sessizce yok oluyor.
   * Ya bir anlam kazandırılmalı (yükleme/boşaltma ayrımı) ya da şablondan çıkarılmalı.
   */
  durakTipi: string;
  aracTipi: string;
  ustYapi: string;
  tonaj: string;
  palet: string;
  fiyat: string;
  yukCinsi: string;
  not: string;
}

export type AlanDurumu = 'ok' | 'error' | 'warn' | 'empty';

/** Sunucunun normalize edip durum etiketi eklediği satır. */
export interface OnizlemeSatiri extends HamSatir {
  rowIndex: number;
  kalkisIliNorm: string | null; kalkisIliStatus: AlanDurumu;
  varisIliNorm: string | null;  varisIliStatus: AlanDurumu;
  aracTipiNorm: string | null;  aracTipiStatus: AlanDurumu;
  ustYapiNorm: string | null;   ustYapiStatus: AlanDurumu;
  hasErrors: boolean;
}

/**
 * Kaydedilecek satır. İstemci önizlemedeki `*Norm` alanlarını elle düzeltebilir
 * (tanınmayan şehir için açılır liste), o yüzden bunlar geri gönderilir.
 * ⚠️ Sunucu bunlara YİNE DE güvenmez — `ilanYaz()` hepsini baştan doğrular.
 */
export interface OnaySatiri extends OnizlemeSatiri {}

export type TopluYukleIstek =
  | { action: 'preview'; rows: HamSatir[] }
  | { action: 'commit'; rows: OnaySatiri[]; tarih: string };

/** Bir grup (Sefer No) için sonuç. */
export interface KayitSonucu {
  seferNo: string;
  ok: boolean;
  id?: string;
  durum?: 'yayinda' | 'incelemede' | 'reddedildi';
  hata?: string;
}

export type TopluYukleYanit =
  | { ok: true; action: 'preview'; preview: OnizlemeSatiri[] }
  | { ok: true; action: 'commit'; olusturulan: number; sonuclar: KayitSonucu[] }
  | { ok: false; hata: string };

/** Tek seferde işlenebilecek en fazla Excel satırı (`ILAN_VER_ANALIZ` B2). */
export const MAX_SATIR = 300;
/** Tek istekte oluşturulabilecek en fazla ilan (grup). */
export const MAX_ILAN = 50;

/**
 * Excel hücresindeki TÜRKÇE yazılmış sayıyı `Number()`'ın anladığı biçime çevirir.
 * Çözemezse `''` döner (çağıran tarafta `null`'a düşer).
 *
 * 🚨 Bunun neden gerektiği: `Number("5.000")` JavaScript'te **5**'tir. Türkiye'de
 * "5.000" beş bindir. Yani fiyat sütununa `5.000` yazan kullanıcının ilanı sessizce
 * **5 TL**'ye kaydolurdu — hata yok, uyarı yok, sadece yanlış veri. `"2,5"` ise
 * `NaN` verip tonajı büsbütün düşürüyordu.
 *
 * Kural: virgül varsa ondalık ayırıcıdır, noktalar binliktir. Virgül yoksa ve
 * noktalar `1.234.567` kalıbına uyuyorsa binliktir; uymuyorsa ondalıktır
 * (`2.5` gibi İngilizce yazımı da kabul ediyoruz — reddetmek kullanıcıyı cezalandırır).
 */
export function sayiMetniCoz(ham: unknown): string {
  if (typeof ham === 'number') return Number.isFinite(ham) ? String(ham) : '';
  if (typeof ham !== 'string') return '';

  const temiz = ham.replace(/[^\d.,-]/g, '').trim();
  if (!temiz) return '';

  let normal: string;
  if (temiz.includes(',')) {
    normal = temiz.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(temiz)) {
    normal = temiz.replace(/\./g, '');
  } else {
    normal = temiz;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? String(n) : '';
}

export const SABLON_HEADERS = [
  'Sefer No', 'Kalkış İli', 'Kalkış İlçesi', 'Varış İli', 'Varış İlçesi',
  'Durak Tipi', 'Araç Tipi', 'Üst Yapı', 'Tonaj (ton)', 'Palet',
  'Fiyat (TL)', 'Yük Cinsi', 'Not',
] as const;
