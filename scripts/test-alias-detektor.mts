// scripts/test-alias-detektor.mts — `npm run test:alias`
//
// 🚨 NE KORUYOR: `lib/alias-normalize.ts::ilceIlUyarisi` — alias tablosuna yeni
// bir (il, ilçe) çelişkisi girmesini önleyen onay-anı uyarısı (#51).
//
// ⚠️ BU TESTİN ASIL İŞİ "UYARI ÇIKIYOR MU" DEĞİL, **SUSMASI GEREKEN YERDE
//    SUSUYOR MU**. Detektör aşırı konuşkan olursa admin uyarıyı okumayı bırakır
//    ve kanca fiilen sökülmüş olur — hatayı yakalamamaktan daha kötüsü, yakaladı
//    sanmaktır. O yüzden aşağıdaki 14 "sessiz" ve "zayıf" beklentisi, 7 "güçlü"
//    beklentisi kadar önemli.
//
// 📌 DÜRÜST KAPSAM: bu detektör, 4 Ağu'da elle bulunan ÜÇ canlı hatadan yalnız
//    BİRİNİ (`bigadi→Çanakkale`) kesin kanıtla yakalar. `orhanli→Sakarya` ve
//    `selimpaşa→Tekirdağ` hiçbir ilin resmî ilçesi olmayan MAHALLE adları; ikisi
//    de İstanbul mahallesi ama bunu `locations.json` bilemez. Onlar yalnız zayıf
//    kodla ekrana gelir ve kararı insan verir. Testin bunu iddia etmesi lazım ki
//    ileride "detektör var, demek ki kapsanıyor" varsayımı doğmasın.
//
// ℹ️ AŞAĞIDAKİ ÇİFTLER CANLI ALIAS SATIRI DEĞİL, COĞRAFYA GERÇEĞİ. Üç hata da
//    4 Ağu'da düzeltildi (`2831 bigadi` silindi, `2777`/`2662` İstanbul'a çekildi)
//    — ama `Çanakkale + Bigadiç`in bir çelişki olduğu, alias tablosu ne derse
//    desin değişmez. Testler alias tablosuna DEĞİL `lokasyon.ts` saf fonksiyonuna
//    baktığı için veri düzeltmelerinden etkilenmiyorlar; canlıda o id'leri arama.

import { ilceIlUyarisi } from '../lib/alias-normalize';

let hata = 0;
type Beklenen = 'guclu' | 'zayif' | 'sessiz';

const ok = (il: string | null, ilce: string | null, beklenen: Beklenen, not = '') => {
  const u = ilceIlUyarisi(il, ilce);
  const oldu: Beklenen = u ? u.seviye : 'sessiz';
  const ek = u?.gercekIller.length ? ` → ${u.gercekIller.slice(0, 3).join(', ')}` : '';
  if (oldu !== beklenen) {
    hata++;
    console.log(`❌ ${il} / ${ilce}: "${beklenen}" bekleniyordu, "${oldu}" geldi${ek}  ${not}`);
  } else {
    console.log(`✓ ${String(il).padEnd(11)} | ${String(ilce ?? '').padEnd(16)} ${oldu}${ek}`);
  }
};

// ── 1. Elle bulunan üç canlı hata ───────────────────────────────────────────
// Kapsam iddiasının kendisi: biri güçlü, ikisi zayıf. Bu satırlar değişirse
// yukarıdaki "DÜRÜST KAPSAM" notu da değişmek zorunda.
console.log('— üç canlı hata (#51) —');
ok('Çanakkale', 'Bigadiç', 'guclu', '(Bigadiç Balıkesir ilçesi)');
ok('Sakarya', 'Orhanlı', 'zayif', '(Tuzla/İstanbul mahallesi — coğrafya kanıtlayamaz)');
ok('Tekirdağ', 'Selimpaşa', 'zayif', '(Silivri/İstanbul mahallesi — coğrafya kanıtlayamaz)');

// ── 2. Güçlü kod: ad başka ilin resmî ilçesi ────────────────────────────────
console.log('— güçlü —');
// 🟠 BİLİNEN YANLIŞ POZİTİF — canlı satır `3016 pinabaşı → İzmir/Pınarbaşı` DOĞRU.
//    Pınarbaşı Kastamonu ve Kayseri ilçesi; İzmir'deki Bornova mahallesi. Detektör
//    "güçlü" basar ve basmalı — "yanlış" değil, "iki kayıt çelişiyor, bak" demek.
//    Bu satır testte duruyor ki yanlış pozitif GÖRÜNÜR olsun, sürpriz olmasın.
ok('İzmir', 'Pınarbaşı', 'guclu');
ok('Sakarya', 'Orhaneli', 'guclu');  // parser'ın kaydığı gerçek ilçe: Bursa
ok('İstanbul', 'Gebze', 'guclu');    // Gebze Kocaeli
ok('Amasya', 'Havza', 'guclu');      // Havza Samsun (4 Ağu alias hatası)

// ── 3. Zayıf kod: meşru mahalle/belde — ASLA blok değil ─────────────────────
console.log('— zayıf (meşru serbest metin) —');
ok('İstanbul', 'Merter', 'zayif');
ok('İzmir', 'Işıkkent', 'zayif');
ok('İstanbul', 'İkitelli', 'zayif');
ok('İstanbul', 'Hadımköy', 'zayif');
// 🚨 `Merkez` 51 ilde var, büyükşehirlerde yok. Güçlü koda düşerse uyarı 51 il
//    adı basar ve gürültüye boğar — YAYGIN_ILCE_ESIGI tam bunun için.
ok('Konya', 'Merkez', 'zayif', '(51 ilde var → kanıt değeri yok)');
ok('İstanbul', 'Merkez', 'zayif');

// ── 4. Tutarlı çiftler: sessiz ──────────────────────────────────────────────
console.log('— sessiz —');
ok('İstanbul', 'Kadıköy', 'sessiz');
ok('Ankara', 'Gölbaşı', 'sessiz');    // aynı ad iki ilde — ikisi de doğru
ok('Adıyaman', 'Gölbaşı', 'sessiz');
ok('Kocaeli', 'Gebze', 'sessiz');
ok('Bursa', 'Orhaneli', 'sessiz');
ok('Samsun', 'Havza', 'sessiz');
ok('Tekirdağ', 'Marmaraereğlisi', 'sessiz'); // JSON bitişik yazıyor
ok('Çankırı', 'Merkez', 'sessiz');
ok('Manisa', 'TURGUTLU', 'sessiz');   // büyük harf katlanmalı
ok('istanbul', 'kadikoy', 'sessiz');  // ASCII katlanmalı

// ── 5. Kenar durumlar: sessiz ───────────────────────────────────────────────
// `type='vehicle'` satırlarında `normalized` araç tipi. Tip filtresi çağıranda
// DEĞİL, `ilId()` çözemediği için burada kendiliğinden var — o davranış test
// edilmezse ileride "neden vehicle'a uyarı çıkıyor" diye geri gelir.
console.log('— kenar —');
ok('tir', 'Kadıköy', 'sessiz', '(vehicle satırı)');
ok(null, 'Kadıköy', 'sessiz');
ok('İstanbul', null, 'sessiz');
ok('İstanbul', '   ', 'sessiz');
ok('Bilinmeyenil', 'Kadıköy', 'sessiz');

console.log(hata === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
