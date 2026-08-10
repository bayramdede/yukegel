// lib/metin-denetim.ts — SERBEST METİN DENETİMİNİN TEK KAYNAĞI (server-only).
//
// 🚨 NEDEN VAR (10 Ağu 2026): `safety_rules` taraması `app/api/ilan/duzelt`
// içinde GÖMÜLÜ duruyordu. GuvenEtkilesim PRD'si (md.5) aynı taramayı YORUM
// metinleri için de istiyor. Kopyalasam iki ayrı tarama olurdu ve bu projede
// o hata sınıfının adı var: aynı kuralın iki yerde iki yazımı zamanla ayrışır
// (bkz. `alias-normalize`'ın W5/D2'de dört yazma noktasına indirilmesi).
//
// ⚠️ EŞİK ANLAMI TERS OKUNMAYA MÜSAİT — bu dosyayı kullanan herkes bilmeli:
//    skor bir RİSK ölçüsüdür. YÜKSEK = KÖTÜ.
//      skor <  autoPublishScoreMax (vars. 31) → temiz
//      skor >= rejectScoreMin      (vars. 71) → gizlenmeli/reddedilmeli
//    "Kalite skoru" DEĞİLDİR. (Bu karışıklık canlıda bir hataya yol açtı;
//     `docs/YAPILACAKLAR.md` başındaki ters-skor maddesine bakınız.)

import { getServiceSupabase } from './auth';
import { getAuditThresholds } from './auditLimits';
import { structuredLog } from './logger';

/**
 * 🚨 10 AĞU 2026 — KRİTİK DÜZELTME. `safety_rules.pattern` değerleri POSTGRES
 * sözdizimiyle yazılmış ve satır içi bayrak taşıyor: `(?i)(silah|...)`.
 * JavaScript'in `RegExp`i satır içi bayrağı DESTEKLEMEZ:
 *   new RegExp('(?i)(silah)', 'i') → SyntaxError: Invalid group
 *
 * Eski kod bunu `catch {}` ile SESSİZCE atlıyordu. Sonuç: 10 kuralın 8'i
 * JavaScript tarafında HİÇ ÇALIŞMIYORDU — ve atlananlar en ağır olanlardı:
 *   silah/uyuşturucu (100) · göçmen taşıma (100) · ağır küfür (100) ·
 *   5607 kaçakçılık (100) · kapora/IBAN dolandırıcılığı (90) ·
 *   belgesiz nakliye (80) · kaba dil (40) · sosyal medya/URL (30)
 * Yalnız `(?i)` içermeyen telefon/e-posta kuralı (70) çalışıyordu.
 *
 * ⚠️ KAPSAM: asıl tarama Postgres'teki `audit_listing_fn`de ve ORADA hepsi
 *    çalışıyor (`~*` operatörü `(?i)`yi kabul eder). Boşluk YALNIZ JavaScript
 *    yolundaydı: `api/ilan/duzelt` — yani kullanıcının ilanını DÜZENLEME yolu.
 *    Pratik sonucu: girişte doğru şekilde işaretlenmiş bir ilan, düzenlenerek
 *    "silah"/"kapora" eklenip yeniden puanlandığında ~0 alıp `approved` +
 *    `active` olabiliyordu. Yani DÜZENLEYEREK DENETİM ATLATILABİLİYORDU.
 *    (9 Ağu'da düzenlemeyi yayındaki ilanlara da açtığım için bu yol daha da
 *     erişilebilir hale gelmişti.)
 *
 * ÇÖZÜM: deseni derlemeden ÖNCE satır içi bayrakları ayıkla; `i` bayrağını
 * zaten ayrıca veriyoruz, yani anlam DEĞİŞMİYOR. Veriye dokunmuyoruz — kurallar
 * admin panelinden Postgres sözdizimiyle yazılmaya devam edebilir.
 */
function desenAyikla(ham: string): string {
  // (?i) (?s) (?m) (?im) … → kaldır. Sadece BAYRAK gruplarını hedefler;
  // (?:…) (?=…) (?!…) (?<…>) gibi gerçek gruplara DOKUNMAZ.
  return ham.replace(/\(\?[imsxu]+\)/g, '');
}

export interface AtesLenenKural {
  rule_id: string;
  description: string | null;
  weight: number;
  /** 'iletisim' → Sarı Bayrak mesajı; null → genel akış. */
  category?: string | null;
}

export interface DenetimSonucu {
  /** 0-100 arası RİSK skoru (yüksek = kötü). */
  skor: number;
  atesLenen: AtesLenenKural[];
  /**
   * Ateşlenen kuralların TAMAMI iletişim kategorisinde mi?
   * Bayram'ın 10 Ağu kararı: bu durumda ilan KAPATILMAZ, kullanıcıya
   * "iletişim bilgileri moderatör onayına düştü" (Sarı Bayrak) mesajı gösterilir.
   * ⚠️ "TAMAMI" şart: metinde hem telefon hem silah varsa sarı bayrak mesajı
   *    göstermek asıl ihlali gizlemek olurdu.
   */
  yalnizIletisim: boolean;
  /** `skor < autoPublishScoreMax` — hiç müdahale gerekmez. */
  temiz: boolean;
  /** `skor >= rejectScoreMin` — gizlenmeli (shadow) + insan incelemesi. */
  gizlenmeli: boolean;
  /** Kayda yazılacak denetim izi (jsonb kolonları için). */
  iz: {
    score: number;
    fired_rules: AtesLenenKural[];
    scanned_at: string;
    source: string;
  };
}

/**
 * 🚨 RAKAM NORMALİZASYONU (Bayram'ın 10 Ağu kararı: "normalizasyon sonrası
 * mevcut regex ile devam"). Telefon kuralı `(0[0-9]{9,10})` yalnız BİTİŞİK
 * numarayı yakalıyordu; `0532 111 22 33` / `0532.111.22.33` / `0532-111-22-33`
 * — insanların en doğal yazımı — tamamen kaçıyordu (57.363 ilanda ölçüldü).
 * Regex'i değiştirmek yerine METNİ normalize ediyoruz: rakamlar arasındaki 1-2
 * ayraç silinir, mevcut kural olduğu gibi kalır.
 *
 * ⚠️ YANLIŞ POZİTİF RİSKİ ÖLÇÜLDÜ: tarih/fiyat/saat birleşip telefona benzer mi?
 *    Canlı veride yeni yakalanan 94.102 ilanın 94.102'si `05` ile başlıyor
 *    (yani gerçek cep numarası); şüpheli eşleşme SIFIR. Sentetik testler de
 *    temiz: "01.09.2026 20 ton" → 8 haneli, kural 10-11 istiyor → tetiklemiyor.
 */
function rakamNormalize(metin: string): string {
  return metin.replace(/(?<=\d)[ .\-]{1,2}(?=\d)/g, '');
}

export interface DenetlenecekMetin {
  /** Kullanıcının KENDİ yazdığı alan (not, yorum). Tüm kurallar buna uygulanır. */
  kullanici?: string | null;
  /**
   * Ham kaynak metni (WhatsApp mesajı vb.).
   * ⚠️ `applies_to='user_text'` olan kurallar BUNA UYGULANMAZ — ilanın kazındığı
   *    mesajda "whatsapp" geçmesi ihlal değil, kaynağın kendisi.
   */
  kaynakMetin?: string | null;
}

/**
 * Metni aktif `safety_rules` (REGEX) kurallarına karşı tarar.
 *
 * @param metin  Kullanıcı metni ve (varsa) ham kaynak metni.
 * @param etiket Denetim izine yazılacak etiket ('review', 'user_correction'…).
 */
export async function metniDenetle(
  metin: DenetlenecekMetin,
  etiket: string,
): Promise<DenetimSonucu> {
  const svc = getServiceSupabase();

  const { data: kurallar } = await svc
    .from('safety_rules')
    .select('id, rule_type, pattern, risk_weight, description, applies_to, category')
    .eq('is_active', true)
    .eq('rule_type', 'REGEX');

  // ⚠️ `toLowerCase()` + regex'lerin kendi `i` bayrağı BİRLİKTE: kurallar
  //    tarihsel olarak küçük harf varsayımıyla yazılmış, bayrağı kaldırmak
  //    eski kuralları sessizce kaçırırdı.
  const kullaniciMetni = (metin.kullanici ?? '').toLowerCase();
  const tumMetin = [metin.kullanici, metin.kaynakMetin].filter(Boolean).join(' ').toLowerCase();

  // Her kapsam için HAM ve NORMALİZE edilmiş hâli birlikte taranır: normalize
  // etmek bazı eşleşmeleri kazandırır ama hiçbirini KAYBETTİRMEMELİ.
  const samanlik = {
    all:       tumMetin + ' ' + rakamNormalize(tumMetin),
    user_text: kullaniciMetni + ' ' + rakamNormalize(kullaniciMetni),
  };

  let skor = 0;
  const atesLenen: AtesLenenKural[] = [];

  for (const kural of kurallar ?? []) {
    try {
      const hedef = kural.applies_to === 'user_text' ? samanlik.user_text : samanlik.all;
      if (hedef.trim() && new RegExp(desenAyikla(kural.pattern), 'i').test(hedef)) {
        skor += kural.risk_weight;
        atesLenen.push({
          rule_id: kural.id,
          description: kural.description,
          weight: kural.risk_weight,
          category: kural.category ?? null,
        });
      }
    } catch (e: any) {
      // Bozuk desen tüm denetimi düşürmesin — kuralı atla.
      // 🚨 AMA SESSİZCE ATLAMA: bu `catch`in sessiz olması, 8 kuralın aylarca
      //    hiç çalışmadığını gizleyen şeydi. Artık ERROR seviyesinde loglanıyor
      //    ki bir daha aynı boşluk fark edilmeden yaşamasın.
      structuredLog('ERROR', 'audit-engine', 'Güvenlik kuralı derlenemedi — KURAL ATLANDI', {
        rule_id: kural.id,
        description: kural.description,
        hata: e?.message,
      });
    }
  }
  skor = Math.min(skor, 100);

  const { autoPublishScoreMax, rejectScoreMin } = await getAuditThresholds();

  return {
    skor,
    atesLenen,
    yalnizIletisim: atesLenen.length > 0 && atesLenen.every(k => k.category === 'iletisim'),
    temiz: skor < autoPublishScoreMax,
    gizlenmeli: skor >= rejectScoreMin,
    iz: {
      score: skor,
      fired_rules: atesLenen,
      scanned_at: new Date().toISOString(),
      source: etiket,
    },
  };
}
