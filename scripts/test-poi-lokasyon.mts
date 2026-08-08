// scripts/test-poi-lokasyon.mts — `lib/poi-lokasyon.ts` sözleşmesi.
//
// 🚨 BU DOSYANIN ASIL İŞİ: `poiIlceCoz()` ile SQL'deki ikizi
// `public.poi_ilce_coz()` AYNI kararı vermeli. Ayrışırlarsa backfill'in "resmî"
// dediği bir kaydı kullanıcı düzenleyip kaydettiğinde `district_official`
// sessizce `false`a döner — hata vermez, veri bozulur. Buradaki vakalar
// canlı veriden (9.178 POI) ölçülerek seçildi.

import { poiKonumCoz, poiIlceCoz, ilceKey } from '../lib/poi-lokasyon';
import { ilId } from '../lib/lokasyon';

let gecti = 0;
const hatalar: string[] = [];

function esit(ad: string, bulunan: unknown, beklenen: unknown) {
  if (JSON.stringify(bulunan) === JSON.stringify(beklenen)) {
    gecti++;
    console.log(`✓ ${ad}`);
  } else {
    hatalar.push(`✗ ${ad}\n    beklenen: ${JSON.stringify(beklenen)}\n    bulunan : ${JSON.stringify(bulunan)}`);
  }
}

// ── ilceKey: ilKey üstündeki iki katlama ──────────────────────────────
esit('ilceKey U+0307 temizler', ilceKey('Osmangazi̇'), 'osmangazi');
esit('ilceKey şapkayı katlar',  ilceKey('Hakkâri'), 'hakkari');
esit('ilceKey Kâhta',           ilceKey('Kâhta'), 'kahta');
esit('ilceKey normal davranış bozulmadı', ilceKey('Çorlu'), 'corlu');

// ── poiIlceCoz: üç kalıp ──────────────────────────────────────────────
const EDIRNE = ilId('Edirne')!;
const DENIZLI = ilId('Denizli')!;
const BURSA = ilId('Bursa')!;
const HAKKARI = ilId('Hakkari')!;
const DUZCE = ilId('Düzce')!;
const ANKARA = ilId('Ankara')!;
const BALIKESIR = ilId('Balıkesir')!;
const ISTANBUL = ilId('İstanbul')!;

esit('1) doğrudan eşleşme',        poiIlceCoz(ISTANBUL, 'kadikoy'), 'Kadıköy');
esit('2) "<İl> Merkez" öneki',     poiIlceCoz(EDIRNE, 'Edirne Merkez'), 'Merkez');
esit('2) "<İl> Merkezefendi"',     poiIlceCoz(DENIZLI, 'Denizli Merkezefendi'), 'Merkezefendi');
esit('2) şapkalı önek',            poiIlceCoz(HAKKARI, 'Hakkâri Merkez'), 'Merkez');
esit('U+0307 bulaşmış ilçe',       poiIlceCoz(BURSA, 'Osmangazi̇'), 'Osmangazi');
esit('3) ilçe=il adı → Merkez',    poiIlceCoz(DUZCE, 'Düzce'), 'Merkez');

// ── UYDURMAMA garantileri (en kritik kısım) ───────────────────────────
// Büyükşehirde "Merkez" resmî ilçe DEĞİL; hangi ilçe olduğu bilinemez.
esit('Ankara/Ankara → null (Merkez yok)',        poiIlceCoz(ANKARA, 'Ankara'), null);
esit('Balıkesir Merkez → null (Merkez yok)',     poiIlceCoz(BALIKESIR, 'Balıkesir Merkez'), null);
// Başka ilin ilçesi sızmamalı — önek kuralı YALNIZ kendi il adıyla çalışır.
esit('Isparta/"Burdur Merkez" → null',           poiIlceCoz(ilId('Isparta')!, 'Burdur Merkez'), null);
esit('Sivas/"Tokat Merkez" → null',              poiIlceCoz(ilId('Sivas')!, 'Tokat Merkez'), null);
// Gerçek mahalle/semt serbest kalmalı.
esit('İstanbul/Bebek → null (mahalle)',          poiIlceCoz(ISTANBUL, 'Bebek'), null);
esit('İstanbul/Sirkeci → null (semt)',           poiIlceCoz(ISTANBUL, 'Sirkeci'), null);
// Kadıköy Ankara'nın ilçesi değil.
esit('Ankara/Kadıköy → null',                    poiIlceCoz(ANKARA, 'Kadıköy'), null);

// ── poiKonumCoz: uçtan uca ────────────────────────────────────────────
esit('kanonik il + resmî ilçe', poiKonumCoz('edirne', 'Edirne Merkez'),
  { provinceId: EDIRNE, city: 'Edirne', district: 'Merkez', districtOfficial: true });

esit('serbest ilçe işaretlenir', poiKonumCoz('İstanbul', 'İkitelli'),
  { provinceId: ISTANBUL, city: 'İstanbul', district: 'İkitelli', districtOfficial: false });

esit('bozuk il yazımı kanonikleşir', poiKonumCoz('ISTANBUL', 'kadikoy'),
  { provinceId: ISTANBUL, city: 'İstanbul', district: 'Kadıköy', districtOfficial: true });

esit('ilçe yoksa districtOfficial null', poiKonumCoz('Bursa', ''),
  { provinceId: BURSA, city: 'Bursa', district: null, districtOfficial: null });

// Türkiye dışı / çözülemeyen il: metin korunur, ilçe "resmî" DİYE işaretlenmez.
esit('çözülemeyen il korunur', poiKonumCoz('Kıbrıs', 'Lefkoşa'),
  { provinceId: null, city: 'Kıbrıs', district: 'Lefkoşa', districtOfficial: null });

esit('boş girdi', poiKonumCoz(null, null),
  { provinceId: null, city: null, district: null, districtOfficial: null });

// ── Sonuç ─────────────────────────────────────────────────────────────
console.log('');
if (hatalar.length > 0) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
