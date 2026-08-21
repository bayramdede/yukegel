import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enYakinIl } from '../../../../lib/il-koordinatlari';
import { ilId } from '../../../../lib/lokasyon';
import { maskIp } from '../../../../lib/logger';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 21 Ağu 2026 — `search_queries` arşivi. Ham GPS koordinatı (lat/lng) BİLEREK
// yazılmıyor — yalnız çözümlenen il. `after()` yanıttan sonra çalışır (bkz.
// app/api/listings/ara/route.ts'teki aynı desenin notu).
function loglaYakinSorgusu(req: NextRequest, ilId: number, sonucSayisi: number) {
  after(async () => {
    try {
      const cookieStore = await cookies();
      const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
      );
      const { data: { user } } = await authClient.auth.getUser();

      const xff = req.headers.get('x-forwarded-for');
      const ipHam = xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip');

      const { error } = await supabase.from('search_queries').insert({
        user_id: user?.id ?? null,
        kaynak: 'yakin_konum',
        varis_il_id: ilId,
        sonuc_sayisi: sonucSayisi,
        ip_masked: ipHam ? maskIp(ipHam) : null,
      });
      if (error) console.error('[search_queries] yazılamadı (yakin):', error.message);
    } catch (e) {
      console.error('[search_queries] beklenmeyen hata (yakin):', e instanceof Error ? e.message : e);
    }
  });
}

/**
 * GET /api/listings/yakin?lat=..&lng=..
 * GPS konumuna en yakın ili (offline haversine, il merkezine göre)
 * hesaplar, o ildeki aktif+onaylı yük ilanlarını döner.
 *
 * Faz 1 (il bazlı) — gerçek yarıçap mesafesi değil, "hangi ile
 * en yakınsın" mantığı. Faz 2'de listings'e gerçek koordinat
 * eklenince PostGIS bbox sorgusuna geçilecek (bkz. PROJE_HARITASI.md §14).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng gerekli' }, { status: 400 });
  }

  const { il, mesafe_km } = enYakinIl(lat, lng);

  // Dalga 3: RPC adı `_by_city` → `_by_province` ve parametresi `province_id`.
  // `enYakinIl` IL_KOORDINAT'tan gelir; o tablonun 81 anahtarı locations.json
  // ile birebir doğrulandı, dolayısıyla burada null BEKLENMİYOR. Yine de
  // sessizce "tüm iller" sorgusuna düşmemek için 500 veriyoruz — null gelirse
  // bu bir veri bütünlüğü bozulmasıdır, kullanıcı hatası değil.
  const provinceId = ilId(il);
  if (provinceId === null) {
    console.error('[yakin] IL_KOORDINAT ↔ locations.json uyuşmazlığı:', il);
    return NextResponse.json({ error: 'İl çözümlenemedi' }, { status: 500 });
  }

  const { data, error } = await supabase.rpc('get_nearby_listings_by_province', {
    p_province_id: provinceId,
    p_district: null,
    p_limit: 20,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  loglaYakinSorgusu(req, provinceId, data?.length ?? 0);

  return NextResponse.json({
    success: true,
    il,
    il_id: provinceId,
    il_merkezine_mesafe_km: mesafe_km,
    data: data ?? [],
    total: data?.length ?? 0,
  });
}
