/**
 * Türk cep telefonu numarası çıkarımı.
 *
 * `whatsapp-parse` route'u ve `raw-posts/telefon-doldur` backfill'i AYNI mantığı
 * kullanmak zorunda: backfill farklı bir regex kullanırsa içe aktarmanın telefonsuz
 * bıraktığı satırlara başka numaralar yazar ve iki taraf sessizce ayrışır.
 *
 * NOT: `supabase/functions/parse-listing/index.ts` içinde Deno tarafında ikinci bir
 * kopya var (satır ~147). Deno/Next sınırı yüzünden import edilemiyor; birini
 * değiştirirken diğerini de güncelle.
 */

/** Metindeki tüm benzersiz 05XXXXXXXXX numaralarını döndürür. */
export function telefonlariCikar(text: string): string[] {
  const phones: string[] = [];
  const t = (text || '')
    .replace(/\+\s*9\s*0\s*/g, '0')
    .replace(/[()]/g, ' ');
  // Rakamlar arasında boşluk olabilir: "0 532 111 22 33"
  const re = /0\s*5(?:\s*\d){9}/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('05')) {
      phones.push(digits);
    }
  }
  return [...new Set(phones)];
}
