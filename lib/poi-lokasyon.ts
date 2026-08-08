// lib/poi-lokasyon.ts — POI yazma yolunun TEK coğrafi kapısı (8 Ağu 2026).
//
// 🚨 NEDEN AYRI BİR DOSYA: `lib/lokasyon.ts::ilceNormalize()` KATI eşleşir —
// `ilKey()` ne katlıyorsa onu. `ilKey()` DEĞİŞTİRİLEMEZ, çünkü DB'deki ikizi
// `public.il_key()` ÜÇ fonksiyonel indeksin tanımında geçiyor
// (`provinces_il_key_uniq`, `districts_il_key_uniq`, `districts_ad_key_idx`).
// IMMUTABLE bir fonksiyonun gövdesini değiştirmek o indeksleri REINDEX'e kadar
// SESSİZCE yanlış sonuç verir hale getirir. Bu yüzden hoşgörü ÜSTE eklendi.
//
// POI verisi listings'ten FARKLI bir kaynaktan geliyor: Google Places adres
// bileşenleri. Ölçüldüğünde (9.178 satır) ilçelerin %46'sı "resmî değil"
// görünüyordu ama bunların %89'u üç MEKANİK kalıptı, gerçek serbest metin değil:
//   1. "<İl> Merkez"        → "Edirne Merkez", "Çorum Merkez"      (3.740 satır)
//   2. U+0307 bulaşması     → "Osmangazi̇" (İ'nin bozuk ayrışması)    (129 satır)
//   3. Şapkalı ünlü         → "Hakkâri Merkez", "Kâhta", "Elâzığ"
//   + ilçe = il adı         → "Düzce"/"Düzce" (Merkez resmîyse)      (113 satır)
//
// ⚠️ Bu dosyadaki mantık `public.poi_ilce_coz()` SQL fonksiyonuyla BİREBİR aynı
// olmak ZORUNDA. Ayrışırlarsa, backfill'in "resmî" dediği bir kaydı kullanıcı
// düzenleyip kaydettiğinde `district_official` sessizce `false`a döner
// (`docs/20260808_poi_cografi_standart.sql`'e bakınız — senkron kopya, tıpkı
// `lib/whatsapp/telefon.ts` ↔ Deno `parse-listing` gibi).

import { ilId, ilAdi, ilceler } from './lokasyon';
// ⚠️ `ilKey` `lokasyon.ts`ten DEĞİL kaynağından: `lokasyon.ts` onu içeri alıyor
// ama dışarı vermiyor (ters yön döngüyü kırmak için, bkz. o dosyanın başı).
import { ilKey } from './ilan-sabitler';

/**
 * `ilKey()` üstüne iki katlama daha. `ilKey()`in KENDİSİNE dokunulmaz (yukarıdaki
 * indeks gerekçesi) — SQL tarafındaki ikizi `public.ilce_key()`.
 */
export function ilceKey(v: string): string {
  return ilKey(
    (v ?? '')
      // U+0307 = combining dot above. "i" + U+0307 bileşimi 'İ'nin bozuk
      // ayrışmasından kalıyor; ekranda 'i' gibi görünür ama eşleşmez.
      .replace(/̇/g, '')
      // Şapkalı ünlüler resmî ilçe listesinde YOK; veride var.
      .replace(/[âÂ]/g, 'a').replace(/[îÎ]/g, 'i').replace(/[ûÛ]/g, 'u')
      .replace(/[êÊ]/g, 'e').replace(/[ôÔ]/g, 'o'),
  );
}

/**
 * Google Places'ten gelen ilçe metnini resmî ilçe adına çözer; çözemezse `null`.
 * Kademeli ve MUHAFAZAKÂR — tahmin etmez, yalnız bilinen üç kalıbı açar.
 */
export function poiIlceCoz(provinceId: number, ham: string): string | null {
  const liste = ilceler(provinceId);
  if (liste.length === 0) return null;

  const k = ilceKey(ham);
  if (!k) return null;
  const ilAd = ilAdi(provinceId);
  const ilK = ilAd ? ilceKey(ilAd) : '';

  // 1) Doğrudan eşleşme (şapka/U+0307 katlanmış hâliyle)
  const dogrudan = liste.find(d => ilceKey(d) === k);
  if (dogrudan) return dogrudan;

  // 2) "<İl> <İlçe>" öneki — Google adres bileşenlerinin ürettiği kalıp
  if (ilK && k.startsWith(ilK + ' ')) {
    const kalan = k.slice(ilK.length + 1).trim();
    const onekli = liste.find(d => ilceKey(d) === kalan);
    if (onekli) return onekli;
  }

  // 3) İlçe = il adının kendisi → o ilde 'Merkez' RESMÎ İSE Merkez.
  //    Ankara/Balıkesir gibi Merkez'i olmayan büyükşehirlerde `null` döner —
  //    "Balıkesir Merkez" hangi ilçedir (Karesi mi Altıeylül mü) BİLİNMEZ,
  //    uydurmak veriyi bozar. Serbest kalması DOĞRU davranış.
  if (ilK && k === ilK) {
    const merkez = liste.find(d => ilceKey(d) === 'merkez');
    if (merkez) return merkez;
  }

  return null;
}

/**
 * `city`/`district` metninden POI'nin coğrafi alanlarını üretir.
 * `pois` tablosuna il/ilçe yazan HER yol bundan geçer.
 */
export type PoiKonum = {
  /** Plaka kodu (1-81) veya `null`. FK olduğu için uydurma değer DB'de reddedilir. */
  provinceId: number | null;
  /** `province_id`den TÜRETİLMİŞ kanonik il adı. Çözülemezse girdi temizlenip korunur. */
  city: string | null;
  /** Resmî eşleşme varsa resmî yazım, yoksa temizlenmiş serbest metin. */
  district: string | null;
  /** `null` = ilçe girilmemiş ya da il çözülemedi. Üç değerli — `ilce_resmi()` ile aynı. */
  districtOfficial: boolean | null;
};

export function poiKonumCoz(cityHam: unknown, districtHam: unknown): PoiKonum {
  const cityMetin = typeof cityHam === 'string' ? cityHam.replace(/\s+/g, ' ').trim() : '';
  const distMetin = typeof districtHam === 'string' ? districtHam.replace(/\s+/g, ' ').trim() : '';

  const provinceId = ilId(cityMetin);

  if (provinceId === null) {
    // İl çözülemedi: metni koru (Kıbrıs gibi Türkiye dışı kayıtlar var), ama
    // ilçeyi "resmî" diye işaretleme — neye göre resmî olduğunu bilmiyoruz.
    return {
      provinceId: null,
      city: cityMetin || null,
      district: distMetin || null,
      districtOfficial: null,
    };
  }

  if (!distMetin) {
    return { provinceId, city: ilAdi(provinceId), district: null, districtOfficial: null };
  }

  const resmi = poiIlceCoz(provinceId, distMetin);
  return {
    provinceId,
    city: ilAdi(provinceId),
    district: resmi ?? distMetin,
    districtOfficial: resmi !== null,
  };
}
