// lib/ilan-sabitler.ts — İlan alanlarının TEK KAYNAĞI.
//
// `ILAN_VER_ANALIZ.md` M2: bu üç liste projede 9–11 ayrı dosyaya kopyalanmıştı.
// Yeni kod bu dosyadan import etmeli; eski kopyalar zamanla buraya çekilecek.
//
// ⚠️ Bu listeler yalnızca istemci gösterimi için değil, SUNUCU TARAFI BEYAZ LİSTE
// olarak da kullanılıyor (`app/ilan-ver/actions.ts`, `app/panel/actions.ts`).
// Bir değer eklerken/çıkarırken DB'deki mevcut satırların ne olacağını düşün.

export const ILLER = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
  'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
  'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
  'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
  'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat',
  'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın',
  'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
] as const;

export const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'] as const;

export const UTSYAPI = [
  'Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli',
  'Lowbed', 'Liftli', 'Silo',
] as const;

export const ARAC_TIPI_SETI: ReadonlySet<string> = new Set(ARAC_TIPLERI);
export const UTSYAPI_SETI: ReadonlySet<string> = new Set(UTSYAPI);

/**
 * Şehir adını katlanmış (case/aksan bağımsız) anahtara çevirir.
 *
 * ⚠️ `PROJE_HARITASI §9`: `İ` (U+0130) DÜZ `i`ye ÖNCE çevrilmeli. Aksi hâlde
 * `toLowerCase()` onu `i` + U+0307 olarak iki karaktere açar ve Postgres'in
 * `lower()` çıktısıyla ayrışır. Sıra kritik.
 */
export function ilKey(v: string): string {
  return v
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .trim();
}

const IL_INDEKS = new Map<string, string>(ILLER.map(il => [ilKey(il), il]));
const ARAC_INDEKS = new Map<string, string>(ARAC_TIPLERI.map(a => [ilKey(a), a]));
const UTS_INDEKS = new Map<string, string>(UTSYAPI.map(u => [ilKey(u), u]));

/**
 * Serbest metni resmî il adına çevirir; tanınmazsa `null`.
 * Saklanan değer HER ZAMAN Türkçe doğru yazımdır (`PROJE_HARITASI §9`).
 */
export function ilNormalize(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const temiz = v.trim();
  if (!temiz) return null;
  return IL_INDEKS.get(ilKey(temiz)) ?? null;
}

/**
 * Serbest metni beyaz listedeki araç tipine çevirir; tanınmazsa `null`.
 * `"tir"`, `"TIR"`, `"Tır"` → `'TIR'`. Excel'den gelen serbest yazım için şart
 * (`ILAN_VER_ANALIZ` B9: eşleşmeyen değer sessizce düşüyordu).
 */
export function aracTipiNormalize(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const temiz = v.trim();
  if (!temiz) return null;
  return ARAC_INDEKS.get(ilKey(temiz)) ?? null;
}

/** Serbest metni beyaz listedeki üst yapıya çevirir; tanınmazsa `null`. */
export function utsyapiNormalize(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const temiz = v.trim();
  if (!temiz) return null;
  return UTS_INDEKS.get(ilKey(temiz)) ?? null;
}
