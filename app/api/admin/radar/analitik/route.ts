import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../lib/auth';
import { ilId } from '../../../../../lib/lokasyon';
import { onbellekli } from '../../../../../lib/radar-cache';

export const dynamic = 'force-dynamic';

// GET /api/admin/radar/analitik?view=overview&days=30
// GET /api/admin/radar/analitik?view=city&city=Antalya&direction=departure&days=30

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });
  }

  const svc = getServiceSupabase();
  const { searchParams } = new URL(req.url);
  const view      = searchParams.get('view') || 'overview';
  const days      = Math.min(90, Math.max(7, parseInt(searchParams.get('days') || '30')));
  const city      = searchParams.get('city')?.trim() || '';
  const direction = searchParams.get('direction') || 'departure';
  // `taze=1` → önbelleği atla (arayüzdeki "↻ Yenile"). Bkz. lib/radar-cache.ts.
  const taze      = searchParams.get('taze') === '1';

  if (view === 'overview') {
    // 8 Ağu 2026 — 90 sn'lik bellek önbelleği. Gerekçesi `lib/radar-cache.ts`
    // başında: soğuk sorgu 3-8 sn, tekrar 45-250 ms; admin bu ekranlar arasında
    // ileri-geri geziyor. Hata ÖNBELLEKLENMEZ (throw ediyoruz, dönmüyoruz).
    const s = await onbellekli(`ozet:${days}`, async () => {
      const { data, error } = await svc.rpc('get_radar_city_overview', { p_days: days });
      if (error) throw new Error(error.message);
      return data ?? [];
    }, taze).catch((e: Error) => ({ hata: e.message }) as any);
    if (s?.hata) return NextResponse.json({ error: s.hata }, { status: 500 });
    return NextResponse.json({ cities: s.veri, onbellek: s.onbellek, yas_sn: s.yasSn });
  }

  if (view === 'city') {
    if (!city) return NextResponse.json({ error: 'city parametresi gerekli' }, { status: 400 });

    // Dalga 3: RPC `province_id` alıyor; HTTP katmanı il adı almaya devam ediyor.
    // Tanınmayan ad → 400. Sessizce null geçmek "filtresiz" anlamına gelir ve
    // kullanıcı yanlış veriye bakar.
    const provinceId = ilId(city);
    if (provinceId === null) {
      return NextResponse.json({ error: `Tanınmayan il: ${city}` }, { status: 400 });
    }

    const counterpart = searchParams.get('counterpart')?.trim() || null;
    const counterpartId = counterpart ? ilId(counterpart) : null;
    if (counterpart && counterpartId === null) {
      return NextResponse.json({ error: `Tanınmayan karşı il: ${counterpart}` }, { status: 400 });
    }

    // p_counterpart_id her zaman geçilir (null dahil) — Supabase overload
    // belirsizliğini önlemek için (bkz. 20260616_radar_analitik_indexes.sql).
    const s = await onbellekli(
      `il:${provinceId}:${direction}:${days}:${counterpartId ?? '-'}`,
      async () => {
        const { data, error } = await svc.rpc('get_radar_city_detail', {
          p_province_id:    provinceId,
          p_direction:      direction,
          p_days:           days,
          p_counterpart_id: counterpartId,
        });
        if (error) throw new Error(error.message);
        return data ?? {};
      },
      taze,
    ).catch((e: Error) => ({ hata: e.message }) as any);
    if (s?.hata) return NextResponse.json({ error: s.hata }, { status: 500 });
    return NextResponse.json({ ...(s.veri as object), onbellek: s.onbellek, yas_sn: s.yasSn });
  }

  return NextResponse.json({ error: 'Geçersiz view' }, { status: 400 });
}
