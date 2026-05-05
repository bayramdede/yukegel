import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// ── Türkçe normalizasyon (Edge Function ile aynı mantık) ──
function trNorm(s: string): string {
  return (s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type AliasRow = {
  type: string;
  alias: string;
  normalized: string;
  priority: number;
  district: string | null;
};

function matchCity(input: string, aliases: AliasRow[]): { normalized: string; district: string | null } | null {
  if (!input?.trim()) return null;
  const norm = trNorm(input.trim());
  const cityAliases = aliases
    .filter(a => a.type === 'city')
    .sort((a, b) => (b.priority || 50) - (a.priority || 50));

  // 1. Tam eşleşme
  const exact = cityAliases.find(a => trNorm(a.alias) === norm);
  if (exact) return { normalized: exact.normalized, district: exact.district };

  // 2. Kısmi: "ant" → "antalya", "ist" → "istanbul"
  const partial = cityAliases.find(
    a => trNorm(a.alias).startsWith(norm) || norm.startsWith(trNorm(a.alias))
  );
  if (partial) return { normalized: partial.normalized, district: partial.district };

  return null;
}

function matchVehicle(input: string, aliases: AliasRow[]): string | null {
  if (!input?.trim()) return null;
  const norm = trNorm(input.trim());
  return (
    aliases
      .filter(a => a.type === 'vehicle')
      .sort((a, b) => (b.priority || 50) - (a.priority || 50))
      .find(a => norm.includes(trNorm(a.alias)) || trNorm(a.alias).includes(norm))
      ?.normalized ?? null
  );
}

function matchBody(input: string, aliases: AliasRow[]): string | null {
  if (!input?.trim()) return null;
  const norm = trNorm(input.trim());
  return (
    aliases
      .filter(a => a.type === 'body')
      .sort((a, b) => (b.priority || 50) - (a.priority || 50))
      .find(a => norm.includes(trNorm(a.alias)) || trNorm(a.alias).includes(norm))
      ?.normalized ?? null
  );
}

function parseNum(s: string): number | null {
  if (!s?.trim()) return null;
  const n = parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Tipler ──
export interface RawRow {
  seferNo: string;
  kalkisIli: string;
  kalkisIlce: string;
  varisIli: string;
  varisIlce: string;
  durakTipi: string;
  aracTipi: string;
  ustYapi: string;
  tonaj: string;
  palet: string;
  fiyat: string;
  yukCinsi: string;
  not: string;
}

export interface PreviewRow extends RawRow {
  rowIndex: number;
  kalkisIliNorm: string | null;
  kalkisIliStatus: 'ok' | 'error' | 'empty';
  varisIliNorm: string | null;
  varisIliStatus: 'ok' | 'error' | 'empty';
  aracTipiNorm: string | null;
  aracTipiStatus: 'ok' | 'warn' | 'empty';
  ustYapiNorm: string | null;
  ustYapiStatus: 'ok' | 'warn' | 'empty';
  hasErrors: boolean;
}

// ── Handler ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── PREVIEW ──
    if (body.action === 'preview') {
      const rows: RawRow[] = body.rows;
      const supabase = getSupabase();
      const { data: aliases } = await supabase
        .from('aliases')
        .select('*')
        .eq('is_active', true);
      const al = (aliases || []) as AliasRow[];

      const preview: PreviewRow[] = rows.map((row, i) => {
        const kM = matchCity(row.kalkisIli, al);
        const vM = matchCity(row.varisIli, al);
        const aM = matchVehicle(row.aracTipi, al);
        const bM = matchBody(row.ustYapi, al);

        const kS = !row.kalkisIli?.trim() ? 'empty' : kM ? 'ok' : 'error';
        const vS = !row.varisIli?.trim() ? 'empty' : vM ? 'ok' : 'error';
        const aS = !row.aracTipi?.trim() ? 'empty' : aM ? 'ok' : 'warn';
        const bS = !row.ustYapi?.trim() ? 'empty' : bM ? 'ok' : 'warn';

        return {
          ...row,
          rowIndex: i,
          kalkisIliNorm: kM?.normalized ?? null,
          kalkisIliStatus: kS as PreviewRow['kalkisIliStatus'],
          varisIliNorm: vM?.normalized ?? null,
          varisIliStatus: vS as PreviewRow['varisIliStatus'],
          aracTipiNorm: aM,
          aracTipiStatus: aS as PreviewRow['aracTipiStatus'],
          ustYapiNorm: bM,
          ustYapiStatus: bS as PreviewRow['ustYapiStatus'],
          hasErrors: kS === 'error' || vS === 'error',
        };
      });

      return NextResponse.json({ success: true, preview });
    }

    // ── COMMIT ──
    if (body.action === 'commit') {
      const { rows, userId }: { rows: PreviewRow[]; userId: string } = body;
      if (!userId) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

      const supabase = getSupabase();

      // Kullanıcının telefon numarasını çek → contact_phone olarak kullan
      const { data: userData } = await supabase
        .from('users')
        .select('phone')
        .eq('id', userId)
        .single();
      const contactPhone = userData?.phone || null;

      // Sefer No'ya göre grupla
      const groups = new Map<string, PreviewRow[]>();
      rows.forEach((row, i) => {
        const key = row.seferNo?.trim() || `__row_${i}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      });

      let created = 0;
      const errors: string[] = [];

      for (const [, groupRows] of groups) {
        const first = groupRows[0];
        const originCity = first.kalkisIliNorm || first.kalkisIli;
        if (!originCity) {
          errors.push(`Satır ${first.rowIndex + 2}: Kalkış şehri belirlenemedi`);
          continue;
        }

        try {
          const { data: listing, error: lErr } = await supabase
            .from('listings')
            .insert({
              listing_type: 'yuk',
              origin_city: originCity,
              origin_district: first.kalkisIlce || null,
              source: 'excel',
              moderation_status: 'pending',
              user_id: userId,
              contact_phone: contactPhone,
              vehicle_type: first.aracTipiNorm
                ? [first.aracTipiNorm]
                : first.aracTipi ? [first.aracTipi] : null,
              body_type: first.ustYapiNorm
                ? [first.ustYapiNorm]
                : first.ustYapi ? [first.ustYapi] : null,
              price_offer: parseNum(first.fiyat),
              notes: first.not || null,
            })
            .select('id')
            .single();

          if (lErr) throw lErr;

          for (let i = 0; i < groupRows.length; i++) {
            const row = groupRows[i];
            const stopCity = row.varisIliNorm || row.varisIli;
            if (!stopCity) continue;

            await supabase.from('listing_stops').insert({
              listing_id: listing!.id,
              stop_order: i + 1,
              city: stopCity,
              district: row.varisIlce || null,
              weight_ton: parseNum(row.tonaj),
              pallet_count: row.palet ? parseInt(row.palet) || null : null,
              cargo_type: row.yukCinsi || null,
              vehicle_count: 1,
            });
          }
          created++;
        } catch (err: any) {
          errors.push(`Satır ${first.rowIndex + 2}: ${err.message}`);
        }
      }

      return NextResponse.json({ success: true, created, errors });
    }

    return NextResponse.json({ error: 'Geçersiz aksiyon' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
