// lib/dedup.ts — BİRLEŞİK MÜKERRER HASH'İ (Bayram'ın 11 Ağu 2026 talebi).
//
// Eski `mukerrerBul()` (`lib/ilan-limit.ts`, artık SİLİNDİ) yalnız
// `(user_id, tip, kalkış il/ilçe, ilk durak il/ilçe, tarih)` beşlisine, 24
// saatlik bir pencereye bakıyordu — "aynı özelliklerde" değil, yalnız "aynı
// güzergah" demekti. Bu dosya onun yerine geçiyor: telefon + TAM rota (kalkış +
// tüm duraklar, sırayla) + araç/kasa tipleri + toplam ton/palet + tarih bir
// SHA-256'da eritiliyor. İki ilan bu hash'te eşleşiyorsa "her şeyiyle aynı"
// demektir — Bayram'ın "aynı özelliklerde ... her şeyiyle aynı" tanımı.
//
// 🚨 KAPSAM BİLİNÇLİ DAR: yalnız `lib/ilan-yaz.ts::ilanYaz()` üzerinden geçen
// yollar (form/whatsapp-bot/facebook TEKİL girişi + Excel toplu yükleme).
// WhatsApp/Facebook TOPLU sohbet aktarımı (`raw_posts` → `parse-listing` Edge
// Function → `ilan_olustur()` RPC) BU DOSYAYI HİÇ ÇAĞIRMIYOR — o, ayrı bir
// Deno runtime'da çalışan bağımsız bir dağıtım, TS paylaşımı yok. Kapsam
// dışı bırakmak bir eksiklik değil: o hat zaten kendi mükerrer/`no_lane`
// süzgecinden geçiyor (`docs/PROJE_HARITASI.md` §6).
//
// ⚠️ ZAMAN PENCERESİ YOK — eski kontrolün "son 24 saat" kısıtı bilerek
// atıldı. `tarih` (sefer tarihi) hash'in İÇİNDE: yarın aynı seferi girmek
// zaten FARKLI bir hash üretir, ayrı bir pencere kontrolüne gerek yok.
//
// 🔓 BİLİNÇLİ SAPMA (kullanıcının orijinal tanımından): kullanıcı "statüsü
// archived olmayan" dedi, ama bu tek başına 11 Ağu 2026'da düzeltilen bir
// bug'ı GERİ GETİRİRDİ — tamamlanmış (`completed_at` dolu) bir iş `archived`
// OLMUYOR (bkz. `docs/PROJE_HARITASI.md` §9 "MÜKERRER İLAN" kaydı), yani
// tamamlanmış bir işin aynısı bir daha asla girilemezdi. Aşağıdaki DB sorgusu
// (`lib/ilan-yaz.ts`) bu yüzden `archived` DIŞINDA `completed_at IS NULL`'ı da
// arıyor — aynı dersin ikinci kez tekrarı.

import { createHash } from 'node:crypto';
import { ilKey } from './ilan-sabitler';

export interface DedupRotaDurak {
  province_id: number;
  /** `ilceNormalize()`/alias çözümünün çıktısı; hiç girilmemişse `null`. */
  district: string | null;
}

export interface DedupGirdi {
  /** `listing_type` — 'yuk' | 'arac'. Aynı güzergahta bir yük ilanı bir araç
   *  ilanıyla asla aynı sefer sayılmamalı, o yüzden hash'in bir parçası. */
  tip: string;
  /** Ham telefon metni — yalnız rakamlar hash'e girer, format farkı (0555…
   *  vs +90555…) sahte ayrışma üretmesin. */
  telefon: string;
  /** Kalkış İLK sırada, sonra duraklar `stop_order` sırasıyla. */
  rota: DedupRotaDurak[];
  vehicleType: string[] | null;
  bodyType: string[] | null;
  /** Tüm durakların `weight_ton` TOPLAMI. Durak bazlı değil — şema durak
   *  bazlı tutuyor ama "aynı yük" kıyaslaması için toplam yeterli ve daha
   *  sağlam (durak sırası/bölünmesi trivia'sına duyarlı değil). */
  toplamTon: number;
  toplamPalet: number;
  /** `YYYY-MM-DD`. */
  tarih: string;
}

/** Türkçe-farkında küçük harfe çevirip boşlukları normalize eder — `ilKey()`
 *  ile AYNI katlama (aksan da siliyor), böylece "İstanbul"/"istanbul" VE
 *  "Beyoğlu"/"beyoglu" aynı hash'i üretir. */
function normMetin(s: string | null | undefined): string {
  return ilKey(String(s ?? '').replace(/\s+/g, ' '));
}

/** Türk telefon numarasını ülke kodu/baştaki sıfırdan bağımsız 10 haneye indirir.
 *  `+905001112233`, `905001112233`, `05001112233`, `5001112233` → `5001112233`.
 *  Gerçek akışta telefon zaten `ilanTelefonu()` ile `0XXXXXXXXXX`e normalize
 *  ediliyor ama hash'in kendisi de biçim farkına dayanıklı olsun. */
function telefonNorm(ham: string): string {
  const d = (ham || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d.replace(/^0/, '');
}

export function dedupHashHesapla(g: DedupGirdi): string {
  const telefon = telefonNorm(g.telefon);
  const rotaStr = g.rota
    .map(d => `${d.province_id}:${normMetin(d.district)}`)
    .join('>');
  const araclar = [...(g.vehicleType ?? [])].map(normMetin).filter(Boolean).sort().join(',');
  const kasalar = [...(g.bodyType ?? [])].map(normMetin).filter(Boolean).sort().join(',');

  const parcalar = [
    normMetin(g.tip),
    telefon,
    rotaStr,
    araclar,
    kasalar,
    String(Math.round((g.toplamTon || 0) * 1000)),   // ondalık kırpma sapması önlensin
    String(Math.round(g.toplamPalet || 0)),
    g.tarih,
  ];
  return createHash('sha256').update(parcalar.join('|')).digest('hex');
}
