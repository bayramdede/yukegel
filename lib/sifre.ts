/**
 * SPRINT_01 R2 — şifre kuralının TEK kaynağı.
 *
 * ESKİ HALİNİN SORUNU: kural iki ayrı yerde, iki ayrı biçimde yaşıyordu.
 *   • `app/giris/page.tsx` kayıt formu ekranda ÜÇ çubuk gösteriyor ve altına
 *     "En az 8 karakter, sayı ve büyük harf içermeli." yazıyordu — ama
 *     `epostaKayit()` yalnızca `sifre.length < 8` kontrolü yapıyordu.
 *     Yani "aaaaaaaa" iki çubuğu kırmızı bırakmasına rağmen KABUL EDİLİYORDU.
 *   • `app/auth/reset/page.tsx` aynı üç çubuğu gösteriyor, aynı şekilde yalnız
 *     uzunluğu dayatıyor, üstelik başlıkta "En az 8 karakter kullanın." diyerek
 *     çubukların ne anlama geldiğini hiç açıklamıyordu.
 *
 * NEDEN ÖNEMLİ: gösterge ile dayatma ayrışınca kullanıcı ya (a) sağlamadığı
 * halde kabul edilince göstergeye güvenmeyi bırakır, ya da (b) sağlamadığı için
 * reddedildiğinde SEBEBİNİ göremez. İkisi de kaydı yarıda bıraktırır.
 *
 * ⚠️ İSTEMCİ KONTROLÜ GÜVENLİK DEĞİLDİR. Buradaki kurallar yalnız UX içindir;
 *    fetch ile `signUp` doğrudan çağrılabilir. Gerçek zorunluluk Supabase
 *    Dashboard → Authentication → Policies → Password Requirements'ta
 *    ayarlanmalı. Orası değişirse BURAYI DA değiştirin, yoksa kullanıcı
 *    istemcide yeşil görüp sunucudan hata yer.
 */

export const SIFRE_MIN = 8;

export type SifreKriter = { etiket: string; saglandi: boolean };

/**
 * ⚠️ TÜRKÇE TUZAĞI: büyük harf kontrolünde `/[A-Z]/` KULLANMAYIN.
 * "Şifre123" ya da "Ölçü1234" tamamen geçerli parolalar ama `[A-Z]` bunları
 * "büyük harf yok" diye reddeder. `\p{Lu}` Unicode'daki tüm büyük harfleri
 * kapsar (Ç, Ğ, İ, Ö, Ş, Ü dahil).
 */
const BUYUK_HARF = /\p{Lu}/u;
const RAKAM = /[0-9]/;

export function sifreKriterleri(sifre: string): SifreKriter[] {
  return [
    { etiket: `en az ${SIFRE_MIN} karakter`, saglandi: sifre.length >= SIFRE_MIN },
    { etiket: 'en az bir rakam', saglandi: RAKAM.test(sifre) },
    { etiket: 'en az bir büyük harf', saglandi: BUYUK_HARF.test(sifre) },
  ];
}

/** Formu göndermeden önce çağrılır. Sorun yoksa `null`. */
export function sifreHatasi(sifre: string): string | null {
  const eksik = sifreKriterleri(sifre).filter(k => !k.saglandi);
  if (eksik.length === 0) return null;
  return `Şifre ${eksik.map(k => k.etiket).join(', ')} içermeli.`;
}

/** Yardımcı metin ve placeholder'ların da tek kaynaktan gelmesi için. */
export const SIFRE_KURAL_METNI = `En az ${SIFRE_MIN} karakter, bir rakam ve bir büyük harf içermeli.`;
