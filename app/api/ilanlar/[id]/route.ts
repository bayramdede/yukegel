import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ilAdi } from '@/lib/lokasyon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Public AI-readable API endpoint.
 * GET /api/ilanlar/:id → temiz JSON (botlar ve AI ajanları için)
 *
 * Hassas veriler (telefon, user_id) döndürülmez.
 * Sadece onaylı, aktif ve shadow-ban'sız ilanlar erişilebilir.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: ilan, error } = await supabase
    .from('listings')
    .select(`
      id, listing_type, source,
      origin_province_id, origin_district,
      vehicle_type, body_type,
      price_offer, price_negotiable,
      available_date, date_flexible,
      notes,
      moderation_status, status,
      is_shadow_banned, trust_level,
      created_at,
      listing_stops (
        stop_order, province_id, district,
        vehicle_count, cargo_type,
        weight_ton, pallet_count, notes
      )
    `)
    .eq('id', id)
    .single();

  if (error || !ilan) {
    return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
  }

  // Gizlilik: reddedilmiş, shadow-ban'lı veya pasif ilanlar kamuya açık değil
  if (
    ilan.moderation_status === 'rejected' ||
    ilan.is_shadow_banned ||
    ilan.status === 'passive'
  ) {
    return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
  }

  const stops = (ilan.listing_stops || [])
    .sort((a: any, b: any) => a.stop_order - b.stop_order)
    .map((s: any) => ({
      sira: s.stop_order,
      // 🚨 PUBLIC API SÖZLEŞMESİ. Dalga 5'te kaynak `city` metninden
      //    `ilAdi(province_id)`'ye geçti; ALAN ADI ve DEĞER TİPİ (il adı metni)
      //    bilerek AYNI kaldı. Dış tüketici bu geçişi görmemeli.
      sehir: ilAdi(s.province_id) ?? null,
      ilce: s.district ?? null,
      arac_sayisi: s.vehicle_count ?? null,
      kargo_tipi: s.cargo_type ?? null,
      agirlik_ton: s.weight_ton ?? null,
      palet_sayisi: s.pallet_count ?? null,
      notlar: s.notes ?? null,
    }));

  const son_durak = stops.at(-1);

  const yanit = {
    id: ilan.id,
    ilan_tipi: ilan.listing_type, // 'yuk' | 'arac'
    kaynak: ilan.source,
    rota: {
      kalkis: {
        sehir: ilAdi(ilan.origin_province_id) ?? null,
        ilce: ilan.origin_district ?? null,
      },
      duraklar: stops,
      durak_sayisi: stops.length,
    },
    arac: {
      tipler: ilan.vehicle_type ?? [],
      ustyapi: ilan.body_type ?? [],
    },
    fiyat: ilan.price_offer
      ? {
          tutar: ilan.price_offer,
          pazarlik: ilan.price_negotiable ?? false,
        }
      : null,
    tarih: {
      yukle: ilan.available_date ?? null,
      esnek: ilan.date_flexible ?? false,
    },
    notlar: ilan.notes ?? null,
    meta: {
      // 🚨 10 Ağu 2026 — `kalite_skoru: ilan.audit_score` KALDIRILDI. `audit_score`
      //    bir RİSK skorudur (yüksek = kötü, `>= 71` → shadow ban); "kalite" adıyla
      //    yayınlamak değeri TERS okutuyordu. Bu uç makine-okunur olduğu için
      //    yanlış anlamın en pahalı olduğu yerdi: tüketen taraf yüksek sayıyı
      //    "iyi ilan" diye sıralar. Yerine bir şey konmadı — gerçek kalite
      //    sinyali Faz 3'te gelecek. Ayrıntı: `docs/YAPILACAKLAR.md` madde 1/3.
      moderasyon: ilan.moderation_status,
      guven_seviyesi: ilan.trust_level ?? null,
      olusturulma: ilan.created_at,
    },
    // AI arama için hazır özet string
    ozet: [
      ilAdi(ilan.origin_province_id),
      son_durak?.sehir,
      ilan.listing_type === 'yuk' ? 'yük ilanı' : 'araç ilanı',
      ...(ilan.vehicle_type ?? []),
    ]
      .filter(Boolean)
      .join(' - '),
  };

  return NextResponse.json(yanit, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
