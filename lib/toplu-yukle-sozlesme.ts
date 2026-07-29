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

export const SABLON_HEADERS = [
  'Sefer No', 'Kalkış İli', 'Kalkış İlçesi', 'Varış İli', 'Varış İlçesi',
  'Durak Tipi', 'Araç Tipi', 'Üst Yapı', 'Tonaj (ton)', 'Palet',
  'Fiyat (TL)', 'Yük Cinsi', 'Not',
] as const;
