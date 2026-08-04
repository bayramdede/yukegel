// ─────────────────────────────────────────────────────────────────────────────
// W5/D2 — Alias yazma yolu normalizasyonu ve çakışma tespiti
//
// 🚨 NEDEN VAR: `aliases` tablosunda aynı şehir iki farklı yazımla duruyordu —
// `Istanbul` (13 satır) ve `İstanbul` (154 satır), aynı şekilde `Izmir`/`İzmir`,
// `Mugla`/`Muğla`, `Bingol`/`Bingöl`. Sebep iki katmanlıydı:
//   1. `learn-aliases` prompt'unun örnekleri ASCII'ye indirgenmişti (W5/D1'de
//      düzeltildi) — LLM kuralı değil örneği taklit ediyordu.
//   2. Dört yazma noktasının hiçbiri `normalized`/`district`'i normalize etmiyor,
//      sadece `.trim()` yapıyordu; `alias` ise yalnız üç yolda lowercase'leniyordu
//      (manuel `create` yolu atlıyordu).
//
// Hasarın çıktığı yer: `parse-listing/findPlaces` iki yazımı İKİ AYRI ŞEHİR sayıyor.
// İçinde hem `avcilar` (→`Istanbul`) hem `kadıköy` (→`İstanbul`) geçen bir mesaj
// "iki şehir bulmuş" oluyor ve `sameCity` koruması string eşitliği olduğu için
// devreye girmiyor → sahte **İstanbul→İstanbul** ilanı kaydediliyor. Ayrıca şehir
// filtresi de iki yazımı ayrı saydığı için kullanıcı ilanların bir kısmını hiç
// görmüyor.
//
// ⚠️ BURADA ASCII'YE ÇEVİRMİYORUZ. Doğru yazım Türkçe olan; ASCII katlama yalnız
// KARŞILAŞTIRMA anahtarı üretmek için var. Yazılan değer Türkçe kalır.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';
import { ilId, ilceResmiMi, ilceHangiIllerde } from './lokasyon';

/**
 * Karşılaştırma anahtarı: Türkçe/ASCII farkını yok sayan katlanmış form.
 *
 * 🚨 Bu fonksiyon, D3'te kurulacak UNIQUE indeksin ifadesiyle BİREBİR aynı olmak
 * zorunda — yoksa uygulama "çakışma yok" derken veritabanı 23505 ile patlar:
 *   translate(lower(replace(alias,'İ','i')), 'ıçğöşü', 'icgosu')
 * Sıra önemli: `İ` (U+0130) ÖNCE düz `i`ye çevrilir. Aksi halde Postgres'in
 * `lower()`'ı onu `i` + birleşen nokta (U+0307) olarak iki karaktere açar ve
 * JS `toLowerCase()` ile aynı sonucu vermez.
 * Birini değiştiren diğerini de değiştirmek zorunda.
 */
export function aliasKey(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .trim();
}

/** Boşluk temizliği: baş/son trim + içteki tekrar eden boşlukları teke indir. */
export function trTemizle(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

export type AliasYazmaGirdi = {
  alias?: unknown;
  normalized?: unknown;
  district?: unknown;
  type?: unknown;
};

export type AliasYazmaAlanlari = {
  alias?: string;
  normalized?: string;
  district?: string | null;
};

/**
 * Yazma öncesi alan normalizasyonu. Yalnızca gönderilen alanlara dokunur —
 * PATCH'te olmayan alanı `undefined` bırakmak şart, yoksa kolonu boşaltırız.
 *
 * ⚠️ `normalized`/`district` üzerinde yazım DÜZELTMESİ yapılmıyor (büyük harfe
 * çevirme, ASCII katlama vb. yok). Bunun sebebi `normalized`ın her zaman şehir
 * olmaması: `type='vehicle'` satırlarında `normalized` doğrudan `vehicle_type`
 * olarak ilana yazılıyor ("tir" → "Tir" yapmak eşleşmeyi bozar). Yanlış yazımı
 * biz sessizce düzeltmiyoruz — `aliasCakismaBul` yakalayıp admine soruyor.
 */
export function normalizeAliasFields(girdi: AliasYazmaGirdi): AliasYazmaAlanlari {
  const cikti: AliasYazmaAlanlari = {};
  // alias lowercase saklanır (görsel tutarlılık). `İ` → `i` dönüşümü
  // `.toLowerCase()`ten ÖNCE yapılmak ZORUNDA — `aliasKey()`:38 ile aynı sıra.
  //
  // 🚨 4 AĞU 2026'ya kadar burada düz `.toLowerCase()` vardı ve iki hasar üretti:
  //   1. `.toLowerCase('İ')` = `i` + U+0307 (birleşen nokta, İKİ karakter).
  //      `trNorm`in son adımı `[^a-z0-9\s]` → `' '` olduğu için U+0307 BOŞLUĞA
  //      dönüyordu: saklanan `i̇zmit` → `i zmit`, mesaj `izmit` → `izmit`.
  //      Asla eşleşmiyordu → sessiz ölü kayıt.
  //   2. `aliases_katlanmis_anahtar_uniq` ifadesi `replace(alias,'İ','i')` ile
  //      başlıyor; saklanan değerde büyük `İ` kalmadığı için U+0307 hayatta
  //      kalıyor ve katlanmış anahtar `izmit`ten AYRIŞIYORDU → tekillik indeksi
  //      baypas edildi, 24 gölge kopya birikti.
  //   Ölçüm ve onarım: `docs/20260804_u0307_alias_onarimi.sql`
  //
  // ⚠️ Bu satırın sırası `aliasKey()`:38 ve D3 indeks ifadesiyle bağlı.
  //    Birini değiştiren üçünü birden değiştirmek zorunda.
  //
  // ℹ️ NOT: lowercase'in kendisi EŞLEŞME için gerekli değil — `parse-listing`
  //    :323/337 ve `whatsapp-parse`:224/232 alias'ı OKUMA ANINDA `trNorm` ile
  //    katlıyor, yani büyük harfli alias da tutuyor. Burada yalnız saklama
  //    tutarlılığı için yapılıyor.
  if (girdi.alias !== undefined) {
    cikti.alias = trTemizle(String(girdi.alias)).replace(/İ/g, 'i').toLowerCase();
  }
  if (girdi.normalized !== undefined) cikti.normalized = trTemizle(String(girdi.normalized));
  if ('district' in girdi) {
    const d = girdi.district === null || girdi.district === undefined ? '' : trTemizle(String(girdi.district));
    cikti.district = d || null;
  }
  return cikti;
}

// ─────────────────────────────────────────────────────────────────────────────
// İLÇE ↔ İL TUTARLILIK DETEKTÖRÜ (#51)
// ─────────────────────────────────────────────────────────────────────────────

export type IlceUyarisi = {
  /**
   * `ilce_baska_ilde` — ad BAŞKA bir ilin resmî ilçesi. Güçlü kanıt: ya il ya
   *   ilçe yanlış. Meşru olabildiği tek durum, aynı adı taşıyan bir mahalle.
   * `ilce_hicbir_ilde` — ad hiçbir ilin resmî ilçesi değil. **Kanıt değil,
   *   bağlam.** Mahalle/belde/bölge yazmak bilerek serbest (Merter, İkitelli).
   *   Ama `2777 orhanli→Sakarya` ve `2662 selimpaşa→Tekirdağ` de tam olarak bu
   *   sınıfta doğdu; ikisi de mahalle adıydı ama İSTANBUL mahallesiydi.
   */
  kod: 'ilce_baska_ilde' | 'ilce_hicbir_ilde';
  /** `ilce_baska_ilde` → güçlü; `ilce_hicbir_ilde` → zayıf. UI ikisini ayrı göstersin. */
  seviye: 'guclu' | 'zayif';
  normalized: string;
  district: string;
  /** `district`'in GERÇEKTEN ilçesi olduğu illerin resmî adları. Zayıfta boş. */
  gercekIller: string[];
  mesaj: string;
};

/**
 * Bir ilçe adı kaç ilde birden geçerse "bu ilde yok" bilgisi o kadar değersizleşir.
 * `Merkez` 51 ilde var ve Konya/İstanbul gibi büyükşehirlerde YOK — yani
 * `Konya + Merkez` teknik olarak "başka ilin ilçesi" ama kanıt değil, sadece
 * kullanıcının "şehir merkezi" demesi. Ondan sonraki en yaygın ad 3 ilde.
 * Eşik 5: `Merkez`i eler, 24 gerçek çok-illi adı (2-3 il) elemez.
 */
const YAYGIN_ILCE_ESIGI = 5;

/**
 * `normalized` (il) ile `district` (ilçe) birbirini tutuyor mu?
 *
 * 🚨 NEDEN VAR: 1528 alias'ın 40'ında bu çift tutarsızdı ve **üçü canlı hataydı**
 * — `2777 orhanli→Sakarya` (Orhanlı Tuzla/İstanbul mahallesi; parser bir harf
 * ötedeki gerçek ilçe `Orhaneli`ye kaymış, 5 ilan yanlış ile yazıldı),
 * `2662 selimpaşa→Tekirdağ` (7 ilan + 2 durak), `2831 bigadi→Çanakkale`.
 * Üçünün de imzası aynı: AI üretimi, güven 75-90 — yani **güven skoru bu hatayı
 * ayırt ETMİYOR**, model kendinden emin biçimde yanlış il yazıyor. Hatalar 40
 * satırı ELLE tarayarak bulundu; kanca takılmazsa bir dahakini yine elle
 * aramak gerekir.
 *
 * ✅ ÜÇ SATIRIN ÜÇÜ DE 4 AĞU 2026'DA DÜZELTİLDİ — yani aşağıdaki id'leri canlıda
 *    ARAMA, tarihsel gerekçe olarak duruyorlar. Son hâl: `2777 orhanli` →
 *    İstanbul/Orhanlı (`is_active=false`, içeriği doğru ama kapalı),
 *    `2662 selimpaşa` → İstanbul/Selimpaşa, `2831 bigadi` → **silindi**
 *    (normalized Balıkesir'e çekilip tutarlı hâle gelmişti, sonra kaldırıldı).
 *    Geçmiş ilan satırları BİLEREK onarılmadı (#52) — ilan ömrü kısa, etki 5 satır.
 *
 * 🚨 BU DETEKTÖR ÜÇÜNDEN YALNIZ BİRİNİ (`bigadi`) KESİN YAKALAR — ölçüldü, 4 Ağu.
 *    `Orhanlı` ve `Selimpaşa` hiçbir ilin resmî ilçesi DEĞİL, dolayısıyla coğrafya
 *    tek başına onları `Merter`den ayıramaz: ikisi de mahalle: biri İstanbul'un,
 *    öbürü de İstanbul'un ama alias Sakarya/Tekirdağ diyor. Bunu `locations.json`
 *    bilemez. O yüzden ikinci, ZAYIF bir kod var: "hiçbir ilin ilçesi değil".
 *    Zayıf kod bir hüküm değil, onay anında admine gösterilen bağlam — üç hatanın
 *    üçü de zayıf ya da güçlü koddan en az biriyle ekrana gelir. Karar insanda.
 *
 * 🟠 BİLİNEN YANLIŞ POZİTİF (güçlü kod), ölçüldü 4 Ağu: `3016 pinabaşı →
 *    İzmir/Pınarbaşı`. `Pınarbaşı` Kastamonu ve Kayseri'nin resmî ilçesi, İzmir'de
 *    ise Bornova mahallesi — yani satır DOĞRU ama detektör "güçlü" basar.
 *    Aynı desen her büyükşehir mahallesinde tekrarlanabilir (bir taşra ilçesiyle
 *    ad çakışması). Güçlü kod "yanlış" demek DEĞİL, "iki kayıt çelişiyor, bak"
 *    demektir; UI metni bunu ima etmeyecek şekilde yazılmalı.
 *
 * ⚠️ BU BİR BLOK DEĞİL, UYARI — hiçbir kodda 409 vermiyoruz. `district` alanına
 *    mahalle/belde/bölge yazmak bilerek serbest (Merter, Işıkkent, Hadımköy,
 *    İkitelli — sektörde günlük kullanımda). Bloklarsak admin doğru kaydı
 *    ekleyemez.
 *
 * ⚠️ KAPSAM: yalnız `type='city'` için anlamlı. `type='vehicle'` satırlarında
 *    `normalized` bir araç tipi; `ilId()` onu çözemez ve fonksiyon `null` döner.
 *    Yani tip filtresi çağıranda DEĞİL, burada kendiliğinden var.
 *
 * ℹ️ `ilceHangiIllerde()` `locations.json`'dan okuyor; `public.districts` tablosu
 *    aynı JSON'dan üretildi ve ayrışmayı `npm run test:districts` tutuyor.
 *    Yani bu kontrol `ilce_resmi()` SQL fonksiyonuyla aynı cevabı verir, ama
 *    DB gidiş-dönüşü olmadan.
 */
export function ilceIlUyarisi(
  normalized: string | null | undefined,
  district: string | null | undefined,
): IlceUyarisi | null {
  const il = trTemizle(normalized);
  const ilce = trTemizle(district);
  if (!il || !ilce) return null;

  const id = ilId(il);
  if (id === null) return null; // il çözülemedi (vehicle vb.) → söyleyecek sözümüz yok
  if (ilceResmiMi(id, ilce)) return null; // tutarlı

  const baskaIller = ilceHangiIllerde(ilce);

  // `Merkez` gibi yaygın adlar: "bu ilde yok" bilgisi kanıt değeri taşımıyor,
  // zayıf koda düşürüyoruz. Gerekçe YAYGIN_ILCE_ESIGI'nde.
  if (baskaIller.length === 0 || baskaIller.length > YAYGIN_ILCE_ESIGI) {
    return {
      kod: 'ilce_hicbir_ilde',
      seviye: 'zayif',
      normalized: il,
      district: ilce,
      gercekIller: [],
      mesaj:
        `"${ilce}" hicbir ilin resmi ilcesi degil. Mahalle/belde/bolge ise sorun yok — ` +
        `ama BASKA bir ilin mahallesi olmadigina emin ol: "${il}" dogru mu? ` +
        `(orhanli->Sakarya ve selimpasa->Tekirdag tam boyle dogmustu; ikisi de Istanbul mahallesiydi.)`,
    };
  }

  const adlar = baskaIller.map(p => p.name);
  return {
    kod: 'ilce_baska_ilde',
    seviye: 'guclu',
    normalized: il,
    district: ilce,
    gercekIller: adlar,
    mesaj:
      `"${ilce}" ${il} ilinin ilcesi degil — ${adlar.join(', ')} ilinin/illerinin resmi ilcesi. ` +
      `Ya il yanlis ya ilce. Bu alias'tan gelen her yeni ilan yanlis ile yazilir. ` +
      `Mahalle/belde kastediyorsan (ayni adi tasiyan farkli bir yer) oldugu gibi birakabilirsin.`,
  };
}

export type AliasSatiri = {
  id: number | string;
  alias: string | null;
  normalized: string | null;
  district: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
};

// Gerçek istemci tipi kullanılıyor (yapısal taklit denendi, `from()` zinciri
// uyuşmuyor: `eq/order/range` `select()`in döndürdüğü builder'da). Böylece yeni
// dosyada `any` borcu da kalmıyor.
type SupabaseBenzeri = SupabaseClient;

export type AliasCakismasi = {
  kolon: 'alias' | 'normalized' | 'district';
  gelen: string;
  mevcut: string;
  mevcutId?: number | string;
  aynenVar: boolean;
  mesaj: string;
};

/**
 * Verilen tipteki TÜM alias satırlarını çeker.
 *
 * ⚠️ `is_active` / `is_approved` filtresi YOK ve olmamalı: D3'ün UNIQUE indeksi
 * bayraklara bakmadan tüm satırlara uygulanacak. Pasif bir kopyayı görmezden
 * gelirsek uygulama "çakışma yok" der, indeks reddeder.
 * ⚠️ Supabase varsayılan olarak 1000 satır döndürür; sayfalama şart.
 */
export async function aliasSatirlariniYukle(svc: SupabaseBenzeri, type: string): Promise<AliasSatiri[]> {
  const SAYFA = 1000;
  const TAVAN = 20000; // sonsuz döngüye karşı emniyet
  const satirlar: AliasSatiri[] = [];
  for (let bas = 0; bas < TAVAN; bas += SAYFA) {
    const { data, error } = await svc
      .from('aliases')
      .select('id, alias, normalized, district, is_active, is_approved')
      .eq('type', type)
      .order('id', { ascending: true })
      .range(bas, bas + SAYFA - 1);
    if (error) throw new Error(`alias indeksi okunamadi: ${error.message}`);
    const sayfa = (data ?? []) as AliasSatiri[];
    satirlar.push(...sayfa);
    if (sayfa.length < SAYFA) break;
  }
  return satirlar;
}

/**
 * Katlanmış forma göre çakışan ama yazımı farklı olan mevcut değerlerden
 * EN ÇOK KULLANILANI döndürür. Çoğunluk yazımını önermek doğru olan: 154 satır
 * `İstanbul` varken 13 satırlık `Istanbul` yazımını kazandırmak istemiyoruz.
 */
function baskinYazim(degerler: (string | null)[], gelen: string): string | null {
  const k = aliasKey(gelen);
  const sayac = new Map<string, number>();
  for (const d of degerler) {
    if (!d || d === gelen) continue;
    if (aliasKey(d) !== k) continue;
    sayac.set(d, (sayac.get(d) ?? 0) + 1);
  }
  let kazanan: string | null = null;
  let enYuksek = 0;
  for (const [deger, adet] of sayac) {
    if (adet > enYuksek) {
      enYuksek = adet;
      kazanan = deger;
    }
  }
  return kazanan;
}

/**
 * Yazmadan önce çakışma kontrolü. Çakışma varsa çağıran 409 dönmeli ve mevcut
 * değeri önermeli — sessizce ezmemeli. Sebep: hangi yazımın kazandığına admin
 * karar vermeli; kod kararı verirse bozulma tekrar sessizce birikir.
 *
 * `excludeId` → PATCH'te satırın kendisi çakışma sayılmasın.
 */
export async function aliasCakismaBul(
  svc: SupabaseBenzeri,
  girdi: { type?: string; alias?: string; normalized?: string; district?: string | null; excludeId?: number | string },
): Promise<AliasCakismasi | null> {
  const tip = girdi.type ?? 'city';
  const satirlar = await aliasSatirlariniYukle(svc, tip);
  const haric = girdi.excludeId === undefined ? null : String(girdi.excludeId);
  const digerleri = haric ? satirlar.filter(s => String(s.id) !== haric) : satirlar;

  // ── 1. alias çakışması: aynı tipte katlanmış hali eşit bir satır var mı? ──
  if (girdi.alias) {
    const k = aliasKey(girdi.alias);
    const carpan = digerleri.find(s => aliasKey(s.alias) === k);
    if (carpan) {
      const aynen = (carpan.alias ?? '') === girdi.alias;
      return {
        kolon: 'alias',
        gelen: girdi.alias,
        mevcut: carpan.alias ?? '',
        mevcutId: carpan.id,
        aynenVar: aynen,
        mesaj: aynen
          ? `"${girdi.alias}" alias'i bu tipte zaten kayitli (id=${carpan.id}).`
          : `"${girdi.alias}" mevcut "${carpan.alias}" (id=${carpan.id}) ile ayni sayilir — Turkce/ASCII farki. Hangi yazimin kalacagini sec: mevcudu duzenle ya da farkli bir alias gir.`,
      };
    }
  }

  // ── 2. normalized çakışması: aynı ili iki yazımla kaydetmeyi engelle ──
  if (girdi.normalized) {
    const mevcut = baskinYazim(digerleri.map(s => s.normalized), girdi.normalized);
    if (mevcut) {
      return {
        kolon: 'normalized',
        gelen: girdi.normalized,
        mevcut,
        aynenVar: false,
        mesaj: `normalized "${girdi.normalized}" yerine tabloda "${mevcut}" yazimi kullaniliyor. Ayni ili iki yazimla kaydetmek sahte guzergah ve eksik filtre sonucu uretir — "${mevcut}" kullan ya da once mevcut kayitlari topluca degistir.`,
      };
    }
  }

  // ── 3. district çakışması: aynı mantık ilçe adı için ──
  if (girdi.district) {
    const mevcut = baskinYazim(digerleri.map(s => s.district), girdi.district);
    if (mevcut) {
      return {
        kolon: 'district',
        gelen: girdi.district,
        mevcut,
        aynenVar: false,
        mesaj: `district "${girdi.district}" yerine tabloda "${mevcut}" yazimi kullaniliyor — "${mevcut}" kullan.`,
      };
    }
  }

  return null;
}

/**
 * Katlanmış forma göre mevcut baskın yazıma HİZALAR (çakışma varsa onu kullanır).
 *
 * Yalnız AI keşif yolunda kullanılır: oradaki kayıtlar `is_approved=false`
 * ÖNERİ olarak doğuyor, admin zaten tek tek onaylıyor. Öneriyi 409 ile reddetmek
 * yerine mevcut doğru yazıma çekmek daha faydalı — ama neyin değiştiği yanıtta
 * raporlanır, sessiz kalmaz.
 */
export function baskinYazimaHizala(deger: string | null, mevcutDegerler: (string | null)[]): string | null {
  if (!deger) return deger;
  return baskinYazim(mevcutDegerler, deger) ?? deger;
}
