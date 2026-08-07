import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/auth';
import { kotaDene, istekIp } from '../../../../lib/kota';

// POST /api/auth/tekil-kontrol
// Body: { alan: 'telefon' | 'tckn' | 'vkn', deger: string, mevcutId?: string }
// Response: { mevcut: boolean }
// Güvenlik: service role ile RLS bypass, mevcutId ile kendi kaydı hariç tutulur.
//
// 🚨 GÜVENLİK (7 Ağu 2026): bu route ne oturum ne kota istiyordu — projenin
// GERİ KALANINDA HER YERDE (`/api/auth/giris`, `/api/auth/otp`, `/api/auth/
// dogrulama-tekrar`) `lib/kota.ts` kullanılırken burası tek istisnaydı. Sonuç:
// herkes sınırsız hızda rastgele TCKN/VKN/telefon deneyip "bu kayıtlı mı"
// sorabiliyordu — bir kişinin bu platformu kullandığını doğrulamak (gizlilik
// sızıntısı) ve kayıtlı telefon numaralarını toplu taramak (spam/hedefli
// oltalama listesi) için kullanılabilir. IP başına kota eklendi — onBlur
// sırasında birkaç alanı art arda düzeltmeye yeter, toplu taramayı keser.
const TEKIL_KONTROL_IP_LIMIT = 20;
const TEKIL_KONTROL_PENCERE_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = istekIp(req);
  const kota = kotaDene({
    ad: 'tekil-kontrol-ip',
    anahtar: ip,
    limit: TEKIL_KONTROL_IP_LIMIT,
    pencereMs: TEKIL_KONTROL_PENCERE_MS,
  });
  if (!kota.izinli) {
    return NextResponse.json(
      { error: `Çok fazla istek. ${kota.bekleSn} saniye sonra tekrar deneyin.` },
      { status: 429 }
    );
  }

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
