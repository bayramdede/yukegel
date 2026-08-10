import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../lib/auth';
import { metniDenetle } from '../../../lib/metin-denetim';
import { structuredLog } from '../../../lib/logger';

export const runtime = 'nodejs';

/** PRD md.3 — rol bazlı alt kriterler. Beyaz liste: istemci uydurma anahtar yazamaz. */
const ALT_KRITERLER = {
  shipper: ['zamanindalik', 'mal_guvenligi', 'iletisim'] as const,       // nakliyeciyi puanlar
  carrier: ['odeme_guvenligi', 'tesis_kalitesi', 'bilgi_dogrulugu'] as const, // ilan vereni puanlar
};

const MAX_YORUM = 2000;

function altKriterleriAyikla(rol: 'shipper' | 'carrier', ham: unknown): Record<string, number> {
  const izinli = ALT_KRITERLER[rol];
  const out: Record<string, number> = {};
  if (!ham || typeof ham !== 'object') return out;
  for (const anahtar of izinli) {
    const v = (ham as Record<string, unknown>)[anahtar];
    const n = Number(v);
    // 1-5 dışını ve sayı olmayanı sessizce AT (istemciye hata döndürmek yerine
    // kısmi form kabul ediyoruz; alt kriterler zorunlu değil).
    if (Number.isInteger(n) && n >= 1 && n <= 5) out[anahtar] = n;
  }
  return out;
}

/**
 * POST /api/reviews — değerlendirme yaz (GuvenEtkilesim PRD md.3 + md.5)
 *
 * Body: { deal_id, rating (1-5), sub_ratings?, comment? }
 *
 * ÇİFT KÖRLEME: bu uç `published_at` YAZMAZ. Yayınlama kararı tamamen DB'de
 * (`reviews_ciftli_yayinla` trigger'ı + 14 gün cron'u). Böylece "ne zaman
 * görünür olur" mantığı tek yerde kalır; API'nin onu tekrar etmesi iki ayrı
 * doğruluk kaynağı üretirdi.
 */
export async function POST(req: NextRequest) {
  const ssr = await getServerSupabase();
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const { deal_id, rating, sub_ratings, comment } = await req.json().catch(() => ({}));
  if (!deal_id) return NextResponse.json({ error: 'deal_id gerekli' }, { status: 400 });

  const puan = Number(rating);
  if (!Number.isInteger(puan) || puan < 1 || puan > 5) {
    return NextResponse.json({ error: 'Puan 1-5 arası olmalı.' }, { status: 400 });
  }

  const svc = getServiceSupabase();

  const { data: deal } = await svc
    .from('deals')
    .select('id, shipper_id, carrier_id, status, completed_at, review_deadline')
    .eq('id', deal_id)
    .maybeSingle();

  if (!deal) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  const isShipper = deal.shipper_id === user.id;
  const isCarrier = deal.carrier_id === user.id;
  if (!isShipper && !isCarrier) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

  // 🚨 YALNIZ TAMAMLANMIŞ İŞ DEĞERLENDİRİLİR. Aksi hâlde bir taraf anlaşmayı
  //    bozup hemen 1 yıldız verebilir; itibar sistemi baskı aracına dönüşür.
  if (deal.status !== 'completed') {
    return NextResponse.json({
      error: 'Yalnız tamamlanmış taşımalar değerlendirilebilir.',
    }, { status: 409 });
  }

  const rol: 'shipper' | 'carrier' = isShipper ? 'shipper' : 'carrier';
  const revieweeId = isShipper ? deal.carrier_id : deal.shipper_id;
  const metin = typeof comment === 'string' ? comment.trim().slice(0, MAX_YORUM) : null;

  // ── Denetim motoru (PRD md.5) ──
  const denetim = await metniDenetle({ kullanici: metin }, 'review');

  // PRD: "kullanıcıya hata bildirmek yerine moderatör paneline düşürür"
  // → ihlalde 200 dönüyoruz, yorum kaydediliyor ama `is_hidden=true`.
  const gizli = denetim.gizlenmeli;

  const { data: review, error } = await svc
    .from('reviews')
    .insert({
      deal_id,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      reviewer_role: rol,
      rating: puan,
      sub_ratings: altKriterleriAyikla(rol, sub_ratings),
      comment: metin,
      is_hidden: gizli,
      audit_score: denetim.skor,
      audit_logs: denetim.iz,
      // published_at BİLEREK YAZILMIYOR — bkz. dosya başındaki not.
    })
    .select('id, created_at, is_hidden')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Bu taşıma için değerlendirmenizi zaten yaptınız.' }, { status: 409 });
    }
    structuredLog('ERROR', 'db-transaction', 'Değerlendirme kaydedilemedi', {
      supabase_error: error.message, deal_id, user_id: user.id,
    });
    return NextResponse.json({ error: 'Değerlendirme kaydedilemedi.' }, { status: 500 });
  }

  if (gizli) {
    structuredLog('WARN', 'audit-engine', 'Değerlendirme denetimden geçemedi, moderatöre düştü', {
      review_id: review.id, deal_id, user_id: user.id,
      audit_score: denetim.skor,
      fired: denetim.atesLenen.map(k => k.description),
    });
  }

  // Yayınlandı mı? (karşı taraf da yazmışsa trigger ikisini yayınlamış olabilir)
  const { data: son } = await svc
    .from('reviews').select('published_at').eq('id', review.id).maybeSingle();

  return NextResponse.json({
    success: true,
    review_id: review.id,
    // ⚠️ Kullanıcıya "gizlendi" DENMİYOR (PRD md.5: sessiz pasife alma).
    yayinlandi: Boolean(son?.published_at),
    mesaj: son?.published_at
      ? 'Değerlendirmeniz kaydedildi ve karşılıklı olarak yayınlandı.'
      : 'Değerlendirmeniz kaydedildi. Karşı taraf da yazdığında (veya 14 gün sonunda) yayınlanacak.',
  });
}
