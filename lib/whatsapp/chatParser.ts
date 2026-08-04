// lib/whatsapp/chatParser.ts
// WhatsApp sohbet export'u (.txt) ayrıştırma — TEK KAYNAK.
//
// NEDEN ORTAK MODÜL:
// Bu mantık eskiden hem `app/api/whatsapp-parse/route.ts` (sunucu) hem
// `app/moderator/WhatsappYukle.tsx` (tarayıcı) içinde AYRI AYRI yazılıydı.
// İkisi birbirinden ayrışınca hatalar sessizce doğuyordu: tarayıcı bir mesajı
// "yeni" sayıp gönderiyor, sunucu aynı mesajı "eski" sayıp atıyordu.
// Artık iki taraf da buradan import ediyor. Saf TS — Node/tarayıcı ayrımı yok.

// ── Saat dilimi ───────────────────────────────────────────────────────────────
// WhatsApp export'undaki saatler, dışa aktarımı yapan kişinin YEREL saatidir ve
// metinde hiçbir saat dilimi bilgisi taşımaz.
//
// KRİTİK: `new Date("2026-07-28T14:30")` — offset'siz format — çalıştığı makinenin
// yerel saatiyle yorumlanır. Tarayıcı Türkiye'de (UTC+3), Vercel sunucusu UTC'de
// çalıştığı için aynı mesaj iki tarafta 3 saat farklı konumlanıyordu; cutoff
// karşılaştırması kayıyor ve message_timestamp DB'ye yanlış yazılıyordu.
// Çözüm: offset'i HER ZAMAN açıkça belirt.
export const VARSAYILAN_TZ = '+03:00';

export interface ChatMesaji {
  sender: string;
  /** Export'ta yazdığı haliyle ham zaman damgası (debug/log için) */
  timestamp: string;
  message: string;
  /** Doğru an (saat dilimi uygulanmış) */
  tarih: Date;
  /** Export'taki YEREL takvim günü, YYYY-MM-DD. Dedup anahtarı bunu kullanır —
   *  UTC'ye çevrilmiş gün kullanılırsa gece yarısı civarı mesajlar gün kaydırır. */
  yerelTarih: string;
}

// ── Mesaj başlığı regex'leri ──────────────────────────────────────────────────
// Desteklenen formatlar (WhatsApp'ın export formatı telefonun dil/bölge ayarına göre değişir):
//   [14.05.2026, 09:15:30] Ali: mesaj          → iOS / TR
//   [14.05.2026 09:15] Ali: mesaj              → iOS, virgülsüz
//   [14.05.2026, 9:15:30 ÖS] Ali: mesaj        → iOS / TR, 12 saatlik
//   [5/14/26, 9:15:30 AM] Ali: mesaj           → iOS / EN-US
//   14.05.2026, 09:15 - Ali: mesaj             → Android / TR
//   14/05/2026, 09:15 - Ali: mesaj             → Android / EN-GB
//   5/14/26, 9:15 AM - Ali: mesaj              → Android / EN-US
const TARIH_KALIBI = String.raw`\d{1,2}[./-]\d{1,2}[./-]\d{2,4}`;
const SAAT_KALIBI = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:ÖÖ|ÖS|öö|ös|AM|PM|am|pm|A\.M\.|P\.M\.))?`;

/** iOS: köşeli parantezli */
const IOS_RE = new RegExp(`^\\[\\s*(${TARIH_KALIBI})[,\\s]\\s*(${SAAT_KALIBI})\\s*\\]\\s*(.+?):\\s?(.*)$`);
/** Android: parantezsiz, gönderenden önce tire */
const ANDROID_RE = new RegExp(`^(${TARIH_KALIBI})[,\\s]\\s*(${SAAT_KALIBI})\\s*[-–—]\\s*(.+?):\\s?(.*)$`);

/**
 * Unicode `Cf` (format) sınıfı — GÖRÜNMEYEN, genişliği olmayan kontrol karakterleri.
 *
 * 🚨 4 AĞU 2026 — BUNLAR CANLI VERİDE BİR SALDIRI ARACI OLARAK BULUNDU. Bir gönderici
 * mesaja `S<U+200C>apanca` / `<U+2060>Sarar` gibi görünmez karakter serpip aynı ilanı
 * tekrar tekrar attırıyordu: `clean_hash` her seferinde değişiyor, tekilleştirme
 * delinmiş oluyordu. Ekranda hiçbir fark yok — mesaj gözle birebir aynı görünüyor.
 *
 * ⚠️ **Liste `\u` KAÇIŞIYLA yazılır, ham karakterle DEĞİL.** Bu satır 4 Ağu'ya kadar
 *    ham görünmezlerle yazılıydı ve üç karakteri EKSİKTİ (`200C`/`200D`/`2060`) —
 *    kimse fark edemedi, çünkü eksik olan şey görünmüyor. Bir editör/formatter ham
 *    karakteri silseydi koruma da görünmeden ölürdü.
 *
 * ⚠️ **U+FE0F (emoji varyasyon seçici) BİLEREK LİSTEDE YOK.** O `Cf` değil `Mn`, ve
 *    `➡️` `⚠️` `✅` gibi her yerde geçen emojilerin parçası. Silmek SAKLANAN metni ve
 *    dolayısıyla `clean_hash`'i binlerce eski mesajda değiştirir → yeniden içe
 *    aktarımda kopya seli. Yalnız EŞLEŞTİRME tarafında siliniyor
 *    (`whatsapp-parse::gorunmezleriSil`, `parse-listing`:74) — orada saklanan değer
 *    de hash de yok, risk yok. İki listenin FARKLI olması kasıtlıdır.
 */
const GORUNMEZ_CF = /[\u200b\u200c\u200d\u200e\u200f\u202a\u202c\u2060\ufeff]/g;

/** Görünmez `Cf` karakterlerini SİLER — boşluğa çevirmez, boşluk kelimeyi böler. */
export function gorunmezleriSil(s: string): string {
  return (s || '').replace(GORUNMEZ_CF, '');
}

/**
 * Görünmez / yön kontrol karakterlerini temizler.
 * U+202F (dar boşluk) ve U+00A0 iOS'ta AM/PM'den önce kullanılır — normal boşluğa
 * çevrilmezse saat kalıbı eşleşmez ve mesaj TAMAMEN kaybolur.
 *
 * 🚨 ÇIKTISI SAKLANIR (`raw_posts.message`) VE `clean_hash`'İN GİRDİSİDİR. Silme
 * listesini genişleten her değişiklik, o karakteri içeren eski satırların hash'ini
 * değiştirir ve yeniden içe aktarımda kopya üretir. Kapsam dar tutulur; gerekçe
 * `GORUNMEZ_CF` başlığında.
 */
export function satiriTemizle(line: string): string {
  return gorunmezleriSil(line.replace(/[\u202f\u00a0]/g, ' ')).trim();
}

export interface MesajBasligi {
  hamZaman: string;
  sender: string;
  metin: string;
}

/**
 * Satır bir mesaj başlangıcı mı? Değilse null (= önceki mesajın devam satırı).
 * Savunmacı: çağıran `satiriTemizle`'yi atlamış olsa da içeride normalize eder.
 */
export function mesajBasligiCoz(satir: string): MesajBasligi | null {
  const temizSatir = satiriTemizle(satir);
  const m = IOS_RE.exec(temizSatir) || ANDROID_RE.exec(temizSatir);
  if (!m) return null;
  return { hamZaman: `${m[1]} ${m[2]}`, sender: m[3].trim(), metin: m[4] };
}

// ── Zaman damgası çözümü ──────────────────────────────────────────────────────

function ikiHaneliYiliAc(y: number): number {
  if (y >= 100) return y;
  // WhatsApp 2 haneli yılı yalnızca yakın tarihlerde kullanır
  return y + 2000;
}

/**
 * "14.05.2026 09:15:30" / "5/14/26 9:15 PM" gibi ham damgayı Date'e çevirir.
 *
 * Gün/ay sırası belirsizliği (`5/14/26` ABD → M/G/Y, `14/05/2026` → G/A/Y):
 *   1. Bileşenlerden biri > 12 ise gün odur, sıra kesin belirlenir.
 *   2. Belirsizse ve AM/PM varsa ABD kabul edilir (M/G/Y).
 *   3. Aksi halde G/A/Y (Türkiye ve EN-GB varsayılanı).
 *
 * @returns null → çözülemedi (arayan taraf mesajı atlamalı)
 */
export function zamanDamgasiCoz(
  hamZaman: string,
  tzOffset: string = VARSAYILAN_TZ
): { tarih: Date; yerelTarih: string } | null {
  const temiz = hamZaman.replace(/[\u202f\u00a0]/g, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  const m = new RegExp(
    `^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{2,4})\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(ÖÖ|ÖS|öö|ös|AM|PM|am|pm|A\\.M\\.|P\\.M\\.)?$`
  ).exec(temiz);
  if (!m) return null;

  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const yil = ikiHaneliYiliAc(parseInt(m[3], 10));
  let saat = parseInt(m[4], 10);
  const dakika = parseInt(m[5], 10);
  const saniye = m[6] ? parseInt(m[6], 10) : 0;
  const yarim = (m[7] || '').toUpperCase().replace(/\./g, '');

  // 12 saatlik format → 24 saatlik
  const ogledenSonra = yarim === 'PM' || yarim === 'ÖS';
  const ogledenOnce = yarim === 'AM' || yarim === 'ÖÖ';
  if (ogledenSonra && saat < 12) saat += 12;
  if (ogledenOnce && saat === 12) saat = 0;

  let gun: number, ay: number;
  if (a > 12) { gun = a; ay = b; }
  else if (b > 12) { ay = a; gun = b; }
  else if (yarim) { ay = a; gun = b; }   // AM/PM → ABD yerelleştirmesi
  else { gun = a; ay = b; }

  if (ay < 1 || ay > 12 || gun < 1 || gun > 31 || saat > 23 || dakika > 59 || saniye > 59) return null;

  const p = (n: number, u = 2) => String(n).padStart(u, '0');
  const yerelTarih = `${p(yil, 4)}-${p(ay)}-${p(gun)}`;
  // Offset AÇIKÇA veriliyor — çalıştığı makinenin saat dilimi sonucu etkilemez.
  const tarih = new Date(`${yerelTarih}T${p(saat)}:${p(dakika)}:${p(saniye)}${tzOffset}`);
  if (isNaN(tarih.getTime())) return null;

  // Taşma kontrolü (31.02 gibi geçersiz günler Date tarafından kaydırılır)
  if (tarih.toISOString().slice(0, 10) !== yerelTarih && Math.abs(tarih.getUTCDate() - gun) > 1) return null;

  return { tarih, yerelTarih };
}

// ── Sistem mesajları ──────────────────────────────────────────────────────────
export const SISTEM_IFADELERI = [
  'katıldı', 'ekledi', 'çıkardı', 'ayrıldı', 'silindi', 'şifreli', 'güvenlik kodu',
  'değiştirdi', 'e-fatura', 'gider fişi', 'medya dahil edilmedi', 'bu mesaj silindi',
  'süreli mesajlar', 'uçtan uca', 'missed voice call', 'missed video call',
  'this message was deleted', 'messages and calls are end-to-end encrypted',
  'media omitted', 'görüntü dahil edilmedi',
];

/**
 * Türkçe aksanları düşürüp karşılaştırır. Aksansız yazım (uctan uca, sifreli)
 * ve farklı klavye/otomatik düzeltme varyantları da yakalansın diye —
 * düz `toLowerCase().includes()` bunları kaçırıyordu.
 */
function aksansiz(s: string): string {
  return s
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
}

const SISTEM_IFADELERI_NORM = SISTEM_IFADELERI.map(aksansiz);

function sistemMesajiMi(msg: string): boolean {
  const alt = aksansiz(msg);
  return SISTEM_IFADELERI_NORM.some(s => alt.includes(s));
}

// ── Ana ayrıştırıcı ───────────────────────────────────────────────────────────

export interface ParseSonucu {
  mesajlar: ChatMesaji[];
  /** Zaman damgası çözülemediği için atlanan mesaj sayısı — 0'dan büyükse
   *  desteklenmeyen bir export formatı var demektir, sessiz kalmamalı. */
  cozulemeyenZaman: number;
}

/**
 * Sohbet metnini mesajlara böler. Çok satırlı mesajlar birleştirilir,
 * sistem mesajları ve 10 karakterden kısa içerikler elenir.
 */
export function parseChatTxt(content: string, tzOffset: string = VARSAYILAN_TZ): ParseSonucu {
  const mesajlar: ChatMesaji[] = [];
  let cozulemeyenZaman = 0;
  let aktif: { sender: string; hamZaman: string; lines: string[] } | null = null;

  const bitir = () => {
    if (!aktif || aktif.lines.length === 0) return;
    const msg = aktif.lines.join('\n').trim();
    if (msg.length > 10 && !sistemMesajiMi(msg)) {
      const zaman = zamanDamgasiCoz(aktif.hamZaman, tzOffset);
      if (zaman) {
        mesajlar.push({
          sender: aktif.sender,
          timestamp: aktif.hamZaman,
          message: msg,
          tarih: zaman.tarih,
          yerelTarih: zaman.yerelTarih,
        });
      } else {
        cozulemeyenZaman++;
      }
    }
    aktif = null;
  };

  for (const line of content.split('\n')) {
    const temiz = satiriTemizle(line);
    if (!temiz) continue;
    const baslik = mesajBasligiCoz(temiz);
    if (baslik) {
      bitir();
      aktif = { sender: baslik.sender, hamZaman: baslik.hamZaman, lines: [baslik.metin] };
    } else if (aktif) {
      aktif.lines.push(temiz);
    }
  }
  bitir();

  return { mesajlar, cozulemeyenZaman };
}

/**
 * Metni SONDAN başa tarar, cutoff'tan eski ilk mesajı bulunca öncesini atar.
 * Tarayıcıda, dosyayı sunucuya göndermeden önce çalışır — yıllık gruplarda
 * payload'ı yalnızca işe yarayan son kısma indirir.
 *
 * Not: saat dilimi artık iki tarafta da açıkça uygulandığı için güvenlik payı
 * yalnızca gerçek gecikme/sınır durumları içindir, TZ hatasını maskelemek için değil.
 */
export function eskiIcerigiKirp(
  text: string,
  saatFiltreSaat: number,
  guvenlikPayiSaat = 2,
  tzOffset: string = VARSAYILAN_TZ
): string {
  const cutoff = new Date(Date.now() - (saatFiltreSaat + guvenlikPayiSaat) * 3600_000);
  const lines = text.split('\n');
  let kesimIndex = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const temiz = satiriTemizle(lines[i]);
    if (!temiz) continue;
    const baslik = mesajBasligiCoz(temiz);
    if (!baslik) continue; // devam satırı — aramaya devam et
    const zaman = zamanDamgasiCoz(baslik.hamZaman, tzOffset);
    if (!zaman) continue;
    if (zaman.tarih < cutoff) { kesimIndex = i + 1; break; }
  }
  return kesimIndex === 0 ? text : lines.slice(kesimIndex).join('\n');
}

/** ZIP/TXT dosya adından grup adı türetir (emoji, yön karakterleri, uzantı temizlenir). */
export function grupAdiTuret(dosyaAdi: string): string {
  return gorunmezleriSil(dosyaAdi)
    .replace(/\.(zip|txt)$/i, '')
    .replace(/WhatsApp (Sohbeti|Chat) (ile |- )/i, '')
    .replace(/WhatsApp (Sohbeti|Chat) - /i, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Bilinmiyor';
}

/** ZIP içindeki sohbet .txt'ini seçer. Bulunamazsa null. */
export function sohbetTxtSec(dosyaAdlari: string[]): string | null {
  const txts = dosyaAdlari.filter(n => n.toLowerCase().endsWith('.txt'));
  return txts.find(n => n.toLowerCase().includes('_chat'))
    || txts.find(n => n.toLowerCase().includes('chat'))
    || txts.find(n => n.toLowerCase().includes('sohbet'))
    || (txts.length === 1 ? txts[0] : null);
}
