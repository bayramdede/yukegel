import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../../../../lib/auth';
import { structuredLog } from '../../../../lib/logger';
import { telefonlariCikar } from '../../../../lib/whatsapp/telefon';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * `contact_phone`'u boş kalmış `raw_posts` satırlarını `raw_text`'ten yeniden
 * çıkarılan numarayla doldurur ve bağlı `listings` satırına da yansıtır.
 *
 * NEDEN AYRI BİR ENDPOINT:
 * Bu iş eskiden `/api/whatsapp-parse` içinde yapılıyordu. İçe aktarmanın
 * doğruluğunu hiç etkilemiyor — yeni yazılan satırların telefonu zaten dolu —
 * ama satır başına 2 UPDATE atıyor ve tam da 60sn'lik Vercel bütçesinin dolduğu
 * yerde duruyordu. Ayrıldı; içe aktarma artık sadece yazma yolunu yapıyor.
 *
 * İdempotent: yalnızca `contact_phone IS NULL` olan satırlara dokunur, aynı
 * girdiyle tekrar çalıştırmak güvenlidir. Bütçe dolarsa `tamamlanmadi: true`
 * döner; kalanı için tekrar çağır.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SURE_BUTCESI_MS = 45_000;
const ESZAMANLI = 6;
const VARSAYILAN_LIMIT = 500;
const MAX_LIMIT = 2000;

async function sirayla<T, R>(ogeler: T[], tavan: number, isle: (oge: T) => Promise<R>): Promise<R[]> {
  const sonuclar: R[] = new Array(ogeler.length);
  let sonraki = 0;
  const isciler = Array.from({ length: Math.min(tavan, ogeler.length) }, async () => {
    for (;;) {
      const i = sonraki++;
      if (i >= ogeler.length) return;
      sonuclar[i] = await isle(ogeler[i]);
    }
  });
  await Promise.all(isciler);
  return sonuclar;
}

export async function POST(request: NextRequest) {
  const baslangic = Date.now();

  const yetki = await requireStaff();
  if (!yetki.ok) {
    return NextResponse.json({ success: false, error: yetki.error }, { status: yetki.status });
  }

  try {
    const govde = await request.json().catch(() => ({}));
    const limit = Math.min(Number(govde?.limit) || VARSAYILAN_LIMIT, MAX_LIMIT);

    // Telefonsuz satırları en yeniden eskiye tara — güncel veri önce düzelsin.
    const { data: satirlar, error: sorguHatasi } = await supabase
      .from('raw_posts')
      .select('id, raw_text')
      .is('contact_phone', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sorguHatasi) {
      structuredLog('ERROR', 'whatsapp-import', 'telefon-doldur sorgusu başarısız', {
        output_status: 'error',
        error: sorguHatasi.message,
      });
      return NextResponse.json({ success: false, error: sorguHatasi.message }, { status: 500 });
    }

    const adaylar = (satirlar || [])
      .map(r => ({ id: r.id as string, phone: telefonlariCikar(r.raw_text || '')[0] || null }))
      .filter((r): r is { id: string; phone: string } => r.phone !== null);

    let guncellenen = 0;
    let listingGuncellenen = 0;
    let tamamlanmadi = false;

    await sirayla(adaylar, ESZAMANLI, async aday => {
      if (Date.now() - baslangic > SURE_BUTCESI_MS) {
        tamamlanmadi = true;
        return;
      }
      const [rawSonuc, listingSonuc] = await Promise.all([
        supabase.from('raw_posts')
          .update({ contact_phone: aday.phone })
          .eq('id', aday.id)
          .is('contact_phone', null)     // yarış koşuluna karşı: sadece hâlâ boşsa yaz
          .select('id'),
        supabase.from('listings')
          .update({ contact_phone: aday.phone })
          .eq('raw_post_id', aday.id)
          .is('contact_phone', null)
          .select('id'),
      ]);
      if (!rawSonuc.error && (rawSonuc.data?.length || 0) > 0) guncellenen++;
      if (!listingSonuc.error) listingGuncellenen += listingSonuc.data?.length || 0;
    });

    const sure = Date.now() - baslangic;
    structuredLog('INFO', 'whatsapp-import', 'telefon-doldur tamamlandı', {
      output_status: tamamlanmadi ? 'partial' : 'ok',
      scanned: satirlar?.length || 0,
      matched: adaylar.length,
      updated: guncellenen,
      duration_ms: sure,
    });

    return NextResponse.json({
      success: true,
      taranan: satirlar?.length || 0,
      telefon_bulunan: adaylar.length,
      raw_posts_guncellenen: guncellenen,
      listings_guncellenen: listingGuncellenen,
      tamamlanmadi,
      duration_ms: sure,
    });
  } catch (e: any) {
    structuredLog('ERROR', 'whatsapp-import', 'telefon-doldur beklenmeyen hata', {
      output_status: 'error',
      error: e?.message || String(e),
    });
    return NextResponse.json({ success: false, error: e?.message || 'Bilinmeyen hata' }, { status: 500 });
  }
}
