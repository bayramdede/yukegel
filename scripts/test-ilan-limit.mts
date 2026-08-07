// scripts/test-ilan-limit.mts — `npm run test:ilan-limit`
//
// `ILAN_VER_ANALIZ` V6 — ilan tavanı + mükerrer tespiti.
//
// 🚨 BU TESTİN ASIL HEDEFİ `kanalTavani()` TABANI. Excel toplu yükleme TEK istekte
// `MAX_ILAN`(=50) ilan yazıyor. Tavan sadece "ayar × katsayı" olsaydı, admin
// `spam_threshold`'u düşürdüğü gün 50 ilanlık meşru bir dosya ortadan bölünür ve
// GERİYE YARIM İMPORT kalırdı — kimse de bunu ayar değiştirirken düşünmezdi.
// Taban o bağımlılığı kesiyor; aşağıdaki 3. kontrol tam olarak onu bekliyor.
//
// ⚠️ DB'ye ERİŞİM GEREKMİYOR ve bu kasıtlı: `ilanTavanBak()` DB sorgusunu
// try/catch içinde yapıyor, servis anahtarı yoksa DB sayımı 0 kalıp BELLEK
// sayacı devreye giriyor. Yani bu test `lib/kota.ts` siperini — patlama (burst)
// yolunu — gerçekten çalıştırıyor, taklit etmiyor.

import { ilanLimitOku, ilanTavanBak, ilanTavanIsle } from '../lib/ilan-limit';
import { kanalTavani } from '../lib/ilan-yaz';

let hata = 0;
const ok = (ad: string, kosul: boolean) => {
  if (!kosul) { console.log('❌', ad); hata++; } else console.log('✓', ad);
};

// Her kontrol TEMİZ bir anahtarla çalışsın: `lib/kota.ts` deposu process boyunca
// yaşıyor, aynı kullanıcı id'sini iki testte kullanmak ikinciyi kirletirdi.
let sayac = 0;
const yeniKullanici = () => `test-v6-${Date.now()}-${sayac++}`;

async function calistir() {
  // ── 1. Ayar okuma: DB yokken taban değerler ───────────────────────────────
  const ayar = await ilanLimitOku();
  ok('DB yokken fallback 20/60', ayar.saatlik === 20 && ayar.gunluk === 60);

  // ── 2. Kanal katsayısı ────────────────────────────────────────────────────
  const form = kanalTavani({ saatlik: 12, gunluk: 60 }, 'form');
  ok('form katsayısı 1 (12/60 aynen)', form.saatlik === 12 && form.gunluk === 60);

  const wa = kanalTavani({ saatlik: 12, gunluk: 60 }, 'whatsapp');
  ok('whatsapp katsayısı 1', wa.saatlik === 12 && wa.gunluk === 60);

  const excel = kanalTavani({ saatlik: 12, gunluk: 60 }, 'excel');
  ok('excel katsayısı 5 (60/300)', excel.saatlik === 60 && excel.gunluk === 300);

  // ── 3. ASIL KONTROL: excel tabanı ─────────────────────────────────────────
  // Admin 5/saat yazarsa 5×5=25 < MAX_ILAN(50). Taban devreye girip 50'ye çekmeli.
  const kisik = kanalTavani({ saatlik: 5, gunluk: 10 }, 'excel');
  ok('excel tabanı: kısık ayarda bile tek dosya (MAX_ILAN=50) sığar',
    kisik.saatlik >= 50 && kisik.gunluk >= 100);
  // Aynı kısık ayar tekil kanalları KISITLAMALI — taban yalnız excel'e ait.
  const kisikForm = kanalTavani({ saatlik: 5, gunluk: 10 }, 'form');
  ok('taban form kanalına SIZMAZ', kisikForm.saatlik === 5 && kisikForm.gunluk === 10);

  // ── 4. §9: BAKMAK saymaz ──────────────────────────────────────────────────
  // `ilanTavanBak` beş kez çağrılsa bile sayaç artmamalı; yoksa başarısız bir
  // istek kullanıcının hakkını yakar.
  const k1 = yeniKullanici();
  const dar = { saatlik: 3, gunluk: 10 };
  for (let i = 0; i < 5; i++) await ilanTavanBak(k1, dar);
  const bakSonrasi = await ilanTavanBak(k1, dar);
  ok('§9 — bakmak sayacı tüketmez', bakSonrasi.asildi === false);

  // ── 5. Saatlik tavan: işlenen sayaç kapıyı kapatır ────────────────────────
  const k2 = yeniKullanici();
  for (let i = 0; i < 3; i++) ilanTavanIsle(k2, dar);
  const saatlikSonuc = await ilanTavanBak(k2, dar);
  ok('3/3 sonrası saatlik tavan kapanır',
    saatlikSonuc.asildi === true && saatlikSonuc.pencere === 'saat');
  ok('saatlik hata metni limiti ve bekleme süresini söyler',
    saatlikSonuc.asildi === true &&
    saatlikSonuc.hata.includes('3') && /dakika|saat/.test(saatlikSonuc.hata));

  // ── 6. Günlük tavan ayrı bir pencere ──────────────────────────────────────
  // Saatlik bol, günlük dar: kapı GÜNLÜK pencereden kapanmalı.
  const k3 = yeniKullanici();
  const gunlukDar = { saatlik: 100, gunluk: 4 };
  for (let i = 0; i < 4; i++) ilanTavanIsle(k3, gunlukDar);
  const gunlukSonuc = await ilanTavanBak(k3, gunlukDar);
  ok('4/4 sonrası günlük tavan kapanır',
    gunlukSonuc.asildi === true && gunlukSonuc.pencere === 'gun');

  // ── 7. Sayaçlar kullanıcı bazında ayrık ───────────────────────────────────
  const k4 = yeniKullanici();
  const komsu = await ilanTavanBak(k4, dar);
  ok('bir kullanıcının dolu sayacı komşusunu etkilemez', komsu.asildi === false);

  console.log(hata === 0 ? '\n✅ tüm kontroller geçti' : `\n❌ ${hata} kontrol başarısız`);
  process.exit(hata === 0 ? 0 : 1);
}

calistir();
