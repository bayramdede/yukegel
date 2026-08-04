// lib/lokasyon.ts — COĞRAFİ VERİNİN TEK KAYNAĞI (30 Tem 2026)
//
// 🚨 NEDEN VAR: İl adı projede metin olarak taşınıyordu (`listings.origin_city`,
// `listing_stops.city`). Metin taşımanın üç bedeli vardı:
//   1. Aynı il iki yazımla birikiyordu (`Istanbul` / `İstanbul` — W5'in kök sebebi).
//      Filtre iki yazımı ayrı sayıyor, kullanıcı ilanların bir kısmını hiç görmüyordu.
//   2. `WHERE origin_city = 'İstanbul'` index'lense bile metin karşılaştırması;
//      `İ`/`I` katlaması yüzünden `ILIKE`'a düşülüyor, index kullanılamıyordu.
//   3. İlçe serbest metindi → "Kadıköy", "kadikoy", "KADIKOY", "Kadikoy/İst" hepsi
//      ayrı değer olarak birikiyordu.
//
// Yeni kural: **il = `province_id` (integer, plaka kodu), ilçe = metin ama SEÇMELİ.**
// İlçe için ayrı tablo AÇILMAZ — `locations.json` zaten resmî listeyi taşıyor,
// tablo açmak JOIN maliyeti ve senkron borcu getirir, karşılığında bir şey vermez.
//
// ⚠️ `id` = plaka kodu. Bu tesadüf değil, sözleşme: `locations.json` sırası
// `lib/ilan-sabitler.ts::ILLER` dizisiyle BİREBİR aynı (index + 1 = id). İkisinden
// birini yeniden sıralayan diğerini bozar; `npm run test:lokasyon` bunu yakalar.

import locationsJson from './constants/locations.json';
import { ilKey } from './ilan-sabitler';

export type Il = {
  /** Plaka kodu. 1..81. `province_id` kolonlarına yazılan değer budur. */
  readonly id: number;
  /** Sıfır dolgulu plaka ("01", "34") — yalnız gösterim için. */
  readonly plate: string;
  /** Resmî Türkçe yazım. Saklanan değer DEĞİL; ekrana basılan değer. */
  readonly name: string;
  /** Resmî ilçeler, Türkçe alfabetik sıralı. */
  readonly districts: readonly string[];
};

export const ILLER_TAM: readonly Il[] = locationsJson as readonly Il[];

/** 81 il, plaka sırasında. Dropdown'lar bunu doğrudan map'leyebilir. */
export const IL_SAYISI = ILLER_TAM.length;

/**
 * 81 il ADI, plaka sırasında (`index + 1 = province_id`).
 *
 * 🚨 3 AĞU 2026 (Görev #36) — BU DİZİ NEDEN VAR: aynı 81 elemanlı liste repoda
 * DÖRT YERDE daha elle kopyalanmıştı (`moderator/page.tsx`, `poi-onay`,
 * `u/[username]/page.tsx`, `radar/RadarClient.tsx`). Hiçbiri test edilmiyordu;
 * `lib/ilan-sabitler.ts::ILLER` ↔ `locations.json` sözleşmesini `test:lokasyon`
 * korurken bu dördü sessizce ayrışabilirdi.
 *
 * ⚠️ ASIL RİSK KOZMETİK DEĞİL: dropdown ile ekrana basılan ad AYNI KAYNAKTAN
 *    gelmek ZORUNDA. `moderator/page.tsx`'teki il filtresi Dalga 5'ten sonra
 *    `ilAdi(id) === filtreKalkis` diye TAM EŞİTLİK karşılaştırıyor — `ilAdi()`
 *    buradaki `ILLER_TAM`'dan okuyor. Dropdown ayrı bir kopyadan beslenirse
 *    tek harflik bir sapma (bir "Hakkari"/"Hakkâri") filtreyi SESSİZCE hiçbir
 *    şey döndürmez hale getirir. Türetmek bu sınıf hatayı imkânsız kılıyor.
 *
 * `lib/ilan-sabitler.ts::ILLER` ile birebir aynıdır — o dosya `ilKey`'i buraya
 * verdiği için ters yönde import EDEMEZ (döngü); iki dizinin eşitliğini
 * `scripts/test-lokasyon.mts` ("id = index+1 ve ad ILLER ile birebir") tutuyor.
 */
export const IL_ADLARI: readonly string[] = ILLER_TAM.map(il => il.name);

/**
 * Aynı 81 ad, TÜRKÇE alfabetik. Yalnız gösterim sırası için — değer yine il adı.
 *
 * ⚠️ `Intl.Collator('tr')` şart: varsayılan sıralama `Ş`/`İ`/`Ğ` harflerini
 *    yanlış yere koyar. `radar/RadarClient.tsx`'teki elle yazılmış eski liste
 *    tam olarak bu hataya sahipti — `Şanlıurfa` Siirt'ten ÖNCE, `Kilis`
 *    `Kırıkkale`'den önce geliyordu. Buraya geçiş o sırayı DÜZELTİR (dokuz
 *    satır yer değiştirir); seçilen DEĞER değişmediği için filtre davranışı
 *    aynı kalır, yalnız liste doğru Türkçe sırada görünür.
 */
export const IL_ADLARI_ALFABETIK: readonly string[] =
  [...IL_ADLARI].sort(new Intl.Collator('tr').compare);

const ID_INDEKS: ReadonlyMap<number, Il> = new Map(ILLER_TAM.map(il => [il.id, il]));
const AD_INDEKS: ReadonlyMap<string, Il> = new Map(ILLER_TAM.map(il => [ilKey(il.name), il]));

/** İlçe indeksleri il bazında tembel kurulur — 973 girdinin tamamını peşin kurmak gereksiz. */
const ILCE_INDEKS = new Map<number, ReadonlyMap<string, string>>();

function ilceIndeksi(ilId: number): ReadonlyMap<string, string> {
  let m = ILCE_INDEKS.get(ilId);
  if (!m) {
    const il = ID_INDEKS.get(ilId);
    m = new Map((il?.districts ?? []).map(d => [ilKey(d), d]));
    ILCE_INDEKS.set(ilId, m);
  }
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// İL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Herhangi bir girdiyi (`34`, `"34"`, `"istanbul"`, `"İSTANBUL"`) plaka id'sine
 * çevirir; tanınmazsa `null`.
 *
 * ⚠️ Bu fonksiyon **sunucu tarafı beyaz liste kapısıdır**. İstemciden gelen
 * `province_id`'yi doğrudan DB'ye yazma — önce buradan geçir. `null` dönerse
 * ilan REDDEDİLİR (`ILAN_VER_ANALIZ` V1'in il dalıyla aynı sözleşme).
 */
export function ilId(v: unknown): number | null {
  if (typeof v === 'number') {
    return Number.isInteger(v) && ID_INDEKS.has(v) ? v : null;
  }
  if (typeof v !== 'string') return null;
  const temiz = v.trim();
  if (!temiz) return null;
  // Sayısal string: "34" veya "07" (plaka). Ad olarak yorumlanamaz.
  if (/^\d{1,2}$/.test(temiz)) {
    const n = Number(temiz);
    return ID_INDEKS.has(n) ? n : null;
  }
  return AD_INDEKS.get(ilKey(temiz))?.id ?? null;
}

/** Plaka id → resmî il adı. Moderasyon/liste ekranlarında gösterim için. */
export function ilAdi(id: unknown): string | null {
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  return ID_INDEKS.get(id)?.name ?? null;
}

/** Plaka id → sıfır dolgulu plaka ("34", "07"). */
export function ilPlaka(id: number): string | null {
  return ID_INDEKS.get(id)?.plate ?? null;
}

/** Plaka id → tam kayıt (ad + ilçeler). */
export function ilGetir(id: number): Il | null {
  return ID_INDEKS.get(id) ?? null;
}

/**
 * Searchable Select için: sorguyu katlanmış anahtarla eşleştirir.
 * Boş sorgu tüm illeri döndürür (plaka sırası korunur).
 */
export function ilAra(q: string): readonly Il[] {
  const k = ilKey(q ?? '');
  if (!k) return ILLER_TAM;
  return ILLER_TAM.filter(il => ilKey(il.name).includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// İLÇE
// ─────────────────────────────────────────────────────────────────────────────

/** Bir ilin resmî ilçeleri (Türkçe alfabetik). Bilinmeyen id → boş dizi. */
export function ilceler(ilId: number): readonly string[] {
  return ID_INDEKS.get(ilId)?.districts ?? [];
}

/** İlçe dropdown'unun arama davranışı. */
export function ilceAra(ilId: number, q: string): readonly string[] {
  const k = ilKey(q ?? '');
  const liste = ilceler(ilId);
  if (!k) return liste;
  return liste.filter(d => ilKey(d).includes(k));
}

export type IlceSonuc = {
  /** DB'ye yazılacak metin. Resmî eşleşme varsa resmî yazım, yoksa temizlenmiş girdi. */
  ad: string;
  /** `true` → `locations.json`'daki resmî ilçe. `false` → kullanıcının serbest girdisi. */
  resmi: boolean;
};

/**
 * İlçe girdisini karara bağlar.
 *
 * Serbest girişe BİLEREK izin veriliyor (spec md.7): sektörde "İkitelli",
 * "İSTOÇ", "Sanayi" gibi resmî listede olmayan adlar günlük kullanımda.
 * Bunları reddetmek kullanıcıyı formdan kaçırır. Ama serbest değerleri
 * **işaretliyoruz** (`resmi: false`) ki:
 *   - DB'de `district_official` bayrağıyla ayrışsınlar,
 *   - sık tekrar edenler sonradan `aliases` tablosuna terfi edilebilsin,
 *   - filtre tarafı "resmî ilçe" ile "serbest etiket"i karıştırmasın.
 *
 * Boş/whitespace girdi → `null` (ilçe opsiyonel bir alan).
 */
export function ilceNormalize(ilId: number, v: unknown): IlceSonuc | null {
  if (typeof v !== 'string') return null;
  const temiz = v.replace(/\s+/g, ' ').trim();
  if (!temiz) return null;
  const resmi = ilceIndeksi(ilId).get(ilKey(temiz));
  if (resmi) return { ad: resmi, resmi: true };
  return { ad: temiz, resmi: false };
}

/** Kısa yol: verilen metin bu ilin resmî ilçesi mi? */
export function ilceResmiMi(ilId: number, v: string): boolean {
  return ilceIndeksi(ilId).has(ilKey(v));
}

/**
 * TERS ARAMA: verilen ilçe adı HANGİ illerin resmî ilçesi? Hiçbirinin değilse
 * boş dizi.
 *
 * 🚨 NEDEN VAR (#51, 4 Ağu 2026): `ilceResmiMi()` tek başına "hayır" der ve
 * susar. O "hayır" İKİ FARKLI ŞEYİ birden kapsıyor ve ikisinin doğru cevabı
 * zıt:
 *   a) ad hiçbir ilin ilçesi değil → mahalle/belde/bölge (Merter, Işıkkent,
 *      Hadımköy, İkitelli). `false` DOĞRU cevap, düzeltilecek bir şey yok.
 *   b) ad BAŞKA bir ilin ilçesi → ilçe ile il birbirini tutmuyor, biri yanlış.
 *      Alias tablosunda üç canlı hata tam olarak buydu (`orhanli→Sakarya`,
 *      `bigadi→Çanakkale`, `selimpaşa→Tekirdağ`) ve üçü de ilanlara yansımıştı.
 * (a)'yı uyarıya çevirirsek 19 meşru mahalle alias'ı için gürültü üretiriz ve
 * uyarı okunmaz hale gelir. Ayrımı yapabilmek için ters aramaya ihtiyaç var.
 *
 * ⚠️ Dönen dizi BİRDEN FAZLA il içerebilir ve bu normaldir: `Merkez` 51 ilde,
 *    `Gölbaşı` hem Ankara hem Adıyaman'da, 24 ad iki-üç ile yayılıyor. Yani
 *    "ilçe adı → il" tek değerli bir fonksiyon DEĞİL; `district_id` kolonunun
 *    açılmama sebebi de bu.
 */
export function ilceHangiIllerde(ad: string): readonly Il[] {
  const k = ilKey(ad ?? '');
  if (!k) return [];
  return ILLER_TAM.filter(il => ilceIndeksi(il.id).has(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// GEÇİŞ DÖNEMİ YARDIMCILARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Çift yazım döneminde (`origin_city` metni HÂLÂ yazılıyor) tek çağrıda hem id
 * hem resmî metin üretir. Kolonlar drop edildiğinde bu fonksiyon da silinecek.
 *
 * ⚠️ `docs/COGRAFI_GECIS.md` Dalga 4'e kadar her yazma yolu bunu kullanmalı —
 * yalnız id yazan bir yol, henüz metne bakan okuma yollarında (HomeClient varış
 * filtresi, radar RPC'leri) ilanı GÖRÜNMEZ yapar.
 */
export function ilCiftYazim(v: unknown): { id: number; ad: string } | null {
  const id = ilId(v);
  if (id === null) return null;
  return { id, ad: ID_INDEKS.get(id)!.name };
}
