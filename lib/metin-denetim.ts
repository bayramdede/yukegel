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
}

export interface DenetimSonucu {
  /** 0-100 arası RİSK skoru (yüksek = kötü). */
  skor: number;
  atesLenen: AtesLenenKural[];
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
 * Metni aktif `safety_rules` (REGEX) kurallarına karşı tarar.
 *
 * @param metinler Birleştirilip taranacak parçalar (null/undefined atlanır).
 * @param kaynak   Denetim izine yazılacak etiket ('review', 'user_correction'…).
 */
export async function metniDenetle(
  metinler: (string | null | undefined)[],
  kaynak: string,
): Promise<DenetimSonucu> {
  const svc = getServiceSupabase();

  const { data: kurallar } = await svc
    .from('safety_rules')
    .select('id, rule_type, pattern, risk_weight, description')
    .eq('is_active', true)
    .eq('rule_type', 'REGEX');

  // ⚠️ `toLowerCase()` + regex'lerin kendi `i` bayrağı BİRLİKTE: kurallar
  //    tarihsel olarak küçük harf varsayımıyla yazılmış, bayrağı kaldırmak
  //    eski kuralları sessizce kaçırırdı.
  const samanlik = metinler.filter(Boolean).join(' ').toLowerCase();

  let skor = 0;
  const atesLenen: AtesLenenKural[] = [];

  for (const kural of kurallar ?? []) {
    try {
      if (new RegExp(desenAyikla(kural.pattern), 'i').test(samanlik)) {
        skor += kural.risk_weight;
        atesLenen.push({
          rule_id: kural.id,
          description: kural.description,
          weight: kural.risk_weight,
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
    temiz: skor < autoPublishScoreMax,
    gizlenmeli: skor >= rejectScoreMin,
    iz: {
      score: skor,
      fired_rules: atesLenen,
      scanned_at: new Date().toISOString(),
      source: kaynak,
    },
  };
}
