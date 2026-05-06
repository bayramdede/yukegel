import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/auth';

// POST /api/auth/tekil-kontrol
// Body: { alan: 'telefon' | 'tckn' | 'vkn', deger: string, mevcutId?: string }
// Response: { mevcut: boolean }
// Güvenlik: service role ile RLS bypass, mevcutId ile kendi kaydı hariç tutulur.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.alan || !body?.deger) {
    return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });
  }

  const { alan, deger, mevcutId } = body as {
    alan: 'telefon' | 'tckn' | 'vkn';
    deger: string;
    mevcutId?: string;
  };

  const supabase = getServiceSupabase();
  let query = supabase.from('users').select('id', { count: 'exact', head: true });

  if (alan === 'telefon') {
    // Hem 05xx hem +90 formatını kontrol et
    const temiz = deger.replace(/\D/g, '');
    const kisa = temiz.startsWith('90') ? temiz.slice(2) : temiz.startsWith('0') ? temiz.slice(1) : temiz;
    const fmt0 = '0' + kisa;       // 05xx...
    const fmtPlus = '+90' + kisa;  // +905xx...
    query = query.or(`phone.eq.${fmt0},phone.eq.${fmtPlus}`);
  } else if (alan === 'tckn') {
    query = query.eq('tckn', deger);
  } else if (alan === 'vkn') {
    query = query.eq('vkn', deger);
  } else {
    return NextResponse.json({ error: 'Geçersiz alan' }, { status: 400 });
  }

  if (mevcutId) {
    query = query.neq('id', mevcutId);
  }

  const { count, error } = await query;

  if (error) {
    console.error('[tekil-kontrol]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mevcut: (count ?? 0) > 0 });
}
