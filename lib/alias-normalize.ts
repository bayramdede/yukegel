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
