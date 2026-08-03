// scripts/test-lokasyon.mts — `npm run test:lokasyon`
//
// 🚨 EN KRİTİK KONTROL: `locations.json` sırası ↔ `ILLER` sırası ↔ plaka kodu.
// `province_id` = `locations.json` index + 1 sözleşmesine dayanıyor. Biri yeniden
// sıralanırsa DB'deki TÜM province_id'ler sessizce yanlış ile işaret eder —
// hiçbir yerde patlamaz, ilanlar sadece yanlış şehirde görünür. Bu test o yüzden
// var; `locations.json` ya da `ILLER` her değiştiğinde çalıştır.

import { ILLER } from '../lib/ilan-sabitler';
import { ILLER_TAM, IL_ADLARI, IL_ADLARI_ALFABETIK, ilId, ilAdi, ilceler, ilceNormalize, ilAra, ilceAra, ilCiftYazim, ilceResmiMi } from '../lib/lokasyon';

let hata = 0;
const ok = (ad: string, kosul: boolean) => { if (!kosul) { console.log('❌', ad); hata++; } else console.log('✓', ad); };

// 1. locations.json ↔ ILLER sözleşmesi
ok('81 il', ILLER_TAM.length === 81 && ILLER.length === 81);
ok('id = index+1 ve ad ILLER ile birebir',
  ILLER_TAM.every((p, i) => p.id === i + 1 && p.name === ILLER[i]));
ok('plate sıfır dolgulu ve id ile tutarlı',
  ILLER_TAM.every(p => p.plate === String(p.id).padStart(2, '0')));
ok('973 ilçe', ILLER_TAM.reduce((a, p) => a + p.districts.length, 0) === 973);
ok('il içi ilçe kopyası yok',
  ILLER_TAM.every(p => new Set(p.districts).size === p.districts.length));

// 1.b IL_ADLARI / IL_ADLARI_ALFABETIK — dropdown'ların TEK kaynağı (Görev #36)
//
// 🚨 Bu üç kontrol, repoda dört yerde ELLE kopyalanmış 81 elemanlı listelerin
//    yerini alan türetilmiş dizileri koruyor. Kritik olan ilki: moderatör il
//    filtresi `ilAdi(id) === seçilenAd` diye TAM EŞİTLİK karşılaştırıyor, yani
//    dropdown ile `ilAdi()` aynı metni üretmek ZORUNDA. Aşağıdaki eşitlik
//    bozulursa filtre patlamaz — sessizce boş sonuç döndürür.
ok('IL_ADLARI ILLER ile birebir aynı sırada',
  IL_ADLARI.length === 81 && IL_ADLARI.every((ad, i) => ad === ILLER[i]));
ok('IL_ADLARI_ALFABETIK aynı kümenin permütasyonu',
  IL_ADLARI_ALFABETIK.length === 81 &&
  new Set(IL_ADLARI_ALFABETIK).size === 81 &&
  IL_ADLARI_ALFABETIK.every(ad => IL_ADLARI.includes(ad)));
// `Intl.Collator('tr')` şart: varsayılan sıralama Ş/İ/Ğ'yi yanlış yere koyar.
// Eski elle yazılmış RadarClient listesi tam bu hatayı taşıyordu.
ok('IL_ADLARI_ALFABETIK Türkçe kurallı sıralı',
  IL_ADLARI_ALFABETIK.every((ad, i) =>
    i === 0 || new Intl.Collator('tr').compare(IL_ADLARI_ALFABETIK[i - 1], ad) < 0));

// 2. ilId
ok('ilId ad', ilId('İstanbul') === 34 && ilId('istanbul') === 34 && ilId('ISTANBUL') === 34);
ok('ilId bozuk yazım (W5 vakası)', ilId('Istanbul') === 34 && ilId('Izmir') === 35 && ilId('Mugla') === 48);
ok('ilId sayı/plaka', ilId(34) === 34 && ilId('34') === 34 && ilId('07') === 7);
ok('ilId sınır', ilId(0) === null && ilId(82) === null && ilId(-1) === null && ilId('999') === null);
ok('ilId çöp', ilId('') === null && ilId('   ') === null && ilId(null) === null &&
  ilId(undefined) === null && ilId({}) === null && ilId('Yukegel') === null && ilId(3.5) === null);
ok('ilId 81 ilin hepsini çözer', ILLER.every((ad, i) => ilId(ad) === i + 1));

// 3. ilAdi / ilCiftYazim
ok('ilAdi', ilAdi(34) === 'İstanbul' && ilAdi(46) === 'Kahramanmaraş' && ilAdi(99) === null);
ok('ilCiftYazim', JSON.stringify(ilCiftYazim('istanbul')) === '{"id":34,"ad":"İstanbul"}'
  && ilCiftYazim('Atlantis') === null);

// 4. ilçe
ok('İstanbul 39 ilçe', ilceler(34).length === 39);
ok('ilceNormalize resmî yazımı düzeltir',
  ilceNormalize(34, 'kadikoy')?.ad === 'Kadıköy' && ilceNormalize(34, 'KADIKÖY')?.resmi === true);
ok('ilceNormalize serbest girişi işaretler',
  ilceNormalize(34, 'İkitelli')?.resmi === false && ilceNormalize(34, '  İSTOÇ  ')?.ad === 'İSTOÇ');
ok('ilceNormalize boş → null', ilceNormalize(34, '   ') === null && ilceNormalize(34, null) === null);
ok('ilçe ile bağlı — Kadıköy Ankara ilçesi değil',
  ilceResmiMi(34, 'Kadıköy') === true && ilceResmiMi(6, 'Kadıköy') === false);
ok('bilinmeyen il → boş ilçe', ilceler(999).length === 0);

// 5. arama
ok('ilAra', ilAra('mar').map(p => p.name).join(',') === 'Kahramanmaraş,Mardin' && ilAra('').length === 81);
ok('ilceAra aksansız', ilceAra(34, 'uskudar').join(',') === 'Üsküdar');

console.log(hata === 0 ? '\n✅ TÜM KONTROLLER GEÇTİ' : `\n❌ ${hata} KONTROL BAŞARISIZ`);
process.exit(hata === 0 ? 0 : 1);
