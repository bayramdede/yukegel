import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';
import { ilId, ilAdi } from '../../../../lib/lokasyon';
import { onbellekli } from '../../../../lib/radar-cache';

export const dynamic = 'force-dynamic';

// ── GET /api/admin/radar ───────────────────────────────────────────────────
// Parametreler:
//   from_city, to_city — zorunlu
//   days               — opsiyonel (default: 30)
//   mode               — 'all' | 'contract' (default: 'all')
//
// GET /api/admin/radar/history?phone=+905...
//   → Belirli numaranın tüm ham mesaj geçmişi

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const svc = getServiceSupabase();
  const { searchParams } = new URL(req.url);

  // ── Geçmiş sorgusu (phone parametresi varsa) ──────────────────────────────
  const phone = searchParams.get('phone');
  if (phone) {
    return handlePhoneHistory(svc, phone);
  }

  // ── Ana radar sorgusu ─────────────────────────────────────────────────────
  const fromCity = searchParams.get('from_city')?.trim();
  const toCity   = searchParams.get('to_city')?.trim();
  const days     = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')));
  const mode     = searchParams.get('mode') || 'all'; // 'all' | 'contract'
  // `taze=1` → önbelleği ATLA. Arayüzdeki "↻ Yenile" butonu bunu gönderiyor;
  // göndermeseydi buton aynı önbellekli yanıtı geri alıp kullanıcıya yalan söylerdi.
  const taze     = searchParams.get('taze') === '1';

  if (!fromCity && !toCity) {
    return NextResponse.json(
      { error: 'En az kalkış veya varış ili girilmeli' },
      { status: 400 }
    );
  }

  // Dalga 3: RPC artık il ADI değil `province_id` alıyor. Çeviri route
  // sınırında yapılır — arayüz il adıyla çalışmaya devam eder.
  //
  // ⚠️ TANINMAYAN İL = 400, SESSİZ NULL DEĞİL. Eski gövde boş string'i
  // NULLIF ile NULL'a çeviriyordu; NULL "tüm iller" demek. `ilId()` tanımadığı
  // adı da null döndürür — o null'ı RPC'ye geçirseydik kullanıcı "Ankra" yazınca
  // hata yerine TÜM İLLERİN sonucunu görürdü. Sessiz yanlış sonuç, açık
  // hatadan kötüdür.
  const fromId = fromCity ? ilId(fromCity) : null;
  const toId   = toCity   ? ilId(toCity)   : null;

  if (fromCity && fromId === null) {
    return NextResponse.json({ error: `Tanınmayan kalkış ili: ${fromCity}` }, { status: 400 });
  }
  if (toCity && toId === null) {
    return NextResponse.json({ error: `Tanınmayan varış ili: ${toCity}` }, { status: 400 });
  }

  // 8 Ağu 2026 — 90 sn'lik bellek önbelleği; gerekçesi `lib/radar-cache.ts`
  // başında (soğuk rota 3-7 sn, tekrar 45-250 ms). Anahtar SORGUYU tanımlayan
  // üç değer; `mode` filtresi aşağıda ÖNBELLEKTEN SONRA uygulanıyor, böylece
  // "tümü"/"kontrat" arasında geçiş yeni sorgu tetiklemiyor.
  let onbellekBilgi = { onbellek: false, yasSn: 0 };
  let data: unknown;
  try {
    const s = await onbellekli(`rota:${fromId ?? '-'}:${toId ?? '-'}:${days}`, async () => {
      const { data: d, error } = await svc.rpc('get_radar_intelligence', {
        p_from_province_id: fromId,
        p_to_province_id:   toId,
        p_days:             days,
      });
      if (error) throw new Error(error.message);
      return d;
    }, taze);
    data = s.veri;
    onbellekBilgi = { onbellek: s.onbellek, yasSn: s.yasSn };
  } catch (e: any) {
    console.error('[radar] RPC hatası:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Radar sorgusu başarısız' }, { status: 500 });
  }

  const result = data as {
    route_stats: {
      total_listings_last_30_days: number;
      unique_publishers: number;
    };
    leads: Lead[];
  };

  // Mode filtresi: 'contract' seçiliyse sadece CONTRACT_POTENTIAL göster
  let leads = result.leads ?? [];
  if (mode === 'contract') {
    leads = leads.filter(
      l => l.route_analytics.classification === 'CONTRACT_POTENTIAL'
    );
  }

  return NextResponse.json({
    success: true,
    route_stats: result.route_stats,
    leads,
    // Ekranda gösteriliyor — admin baktığı verinin tazeliğini bilsin.
    // (Sessiz bayat veri bu projede tekrarlayan bir hata sınıfı.)
    onbellek: onbellekBilgi.onbellek,
    yas_sn:   onbellekBilgi.yasSn,
    // Kanonik ad döndürülüyor ("istanbul" → "İstanbul"); arayüz bunu başlıkta
    // gösteriyor, kullanıcının yazdığı hali değil.
    filters: {
      from_city:        fromId !== null ? ilAdi(fromId) : null,
      to_city:          toId   !== null ? ilAdi(toId)   : null,
      from_province_id: fromId,
      to_province_id:   toId,
      days,
      mode,
    },
  });
}

// ── Telefon geçmişi ────────────────────────────────────────────────────────
async function handlePhoneHistory(
  svc: ReturnType<typeof getServiceSupabase>,
  phone: string
) {
  // +905... veya 05... formatını normalize et
  const normalized = phone.startsWith('+')
    ? phone
    : phone.startsWith('0')
    ? '+90' + phone.slice(1)
    : '+90' + phone;

  // 05... formatında da ara (DB'de her ikisi de olabilir)
  const local = normalized.replace('+90', '0');

  const { data, error } = await svc
    .from('listings')
    .select(
      // Dalga 5: metin kolonları düştü; rota gösterimi id'den türüyor.
      // Bu uç noktanın TÜKETİCİSİ `app/admin/radar/RadarClient.tsx` — orada da
      // `HistoryListing` arayüzü ve rota satırı aynı anda değişti. İkisi ayrı
      // ayrı deploy edilemez.
      'id, created_at, origin_province_id, raw_text, listing_type, moderation_status, status, vehicle_type, listing_stops(province_id, stop_order)'
    )
    .or(`contact_phone.eq.${normalized},contact_phone.eq.${local}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ phone: normalized, listings: data ?? [] });
}

// ── Tip tanımı ─────────────────────────────────────────────────────────────
interface Lead {
  phone: string;
  is_registered: boolean;
  display_name: string | null;
  company_name: string | null;
  etiket: string | null;
  shadow_profile_id: string | null;
  route_analytics: {
    total_loads: number;
    recent_loads: number;
    unique_active_days: number;
    classification: 'SPOT' | 'CONTRACT_POTENTIAL';
  };
  has_contract_keywords: boolean;
  tags: string[];
  recent_raw_texts: string[];
  last_listing_at: string | null;
}
