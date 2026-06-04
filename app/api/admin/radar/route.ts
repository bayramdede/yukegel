import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';

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

  if (!fromCity || !toCity) {
    return NextResponse.json(
      { error: 'from_city ve to_city zorunludur' },
      { status: 400 }
    );
  }

  const { data, error } = await svc.rpc('get_radar_intelligence', {
    p_from_city: fromCity,
    p_to_city:   toCity,
    p_days:      days,
  });

  if (error) {
    console.error('[radar] RPC hatası:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    filters: { from_city: fromCity, to_city: toCity, days, mode },
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
      'id, created_at, origin_city, raw_text, listing_type, moderation_status, status, vehicle_type, listing_stops(city, stop_order)'
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
