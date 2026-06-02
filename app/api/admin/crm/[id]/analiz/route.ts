import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SISTEM_PROMPT = `Sen bir lojistik sektörü analistsin. Sana bir telefon numarasına ait WhatsApp ilan mesajları verilecek.
Bu mesajları okuyarak kişi hakkında kısa ve net bir profil çıkar.

ÇIKTI FORMATI (kesinlikle bu JSON şemasına uy, başka hiçbir şey yazma):
{
  "ozet": "2-3 cümle genel profil özeti",
  "tip": "nakliyeci" | "komisyoncu" | "musteri" | "belirsiz",
  "tip_aciklama": "neden bu tipi seçtiğini kısa açıkla",
  "aktif_rotalar": ["şehir1-şehir2", ...],  // en sık geçen rotalar
  "arac_tipleri": ["TIR", "Kamyon", ...],   // kullandığı araç tipleri
  "yuk_tipleri": ["Dökme", "Palet", ...],   // taşıdığı yük tipleri
  "calisma_stili": "bölgesel" | "ulusal" | "şehir içi",
  "aktivite_yogunlugu": "düşük" | "orta" | "yüksek",
  "ilginc_notlar": ["dikkat çeken detaylar", ...]  // boş olabilir
}`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await params;
  const svc = getServiceSupabase();

  // Profil + ilanları çek (raw_text dolu olanlar)
  const { data: listings } = await svc
    .from('listings')
    .select('raw_text, origin_city, created_at')
    .eq('shadow_profile_id', id)
    .not('raw_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!listings || listings.length === 0) {
    return NextResponse.json({ error: 'Analiz edilecek ham mesaj bulunamadı.' }, { status: 400 });
  }

  // Mesajları birleştir — her birini tarih + içerik olarak numaralandır
  const mesajlar = listings
    .map((l, i) => {
      const tarih = new Date(l.created_at).toLocaleDateString('tr-TR');
      return `[${i + 1}] ${tarih}\n${(l.raw_text ?? '').substring(0, 500)}`;
    })
    .join('\n\n---\n\n');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key eksik' }, { status: 500 });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SISTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Aşağıdaki ${listings.length} ilan mesajını analiz et:\n\n${mesajlar}`,
      }],
    }),
  });

  if (!res.ok) return NextResponse.json({ error: 'LLM hatası' }, { status: 500 });

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    const analiz = JSON.parse(clean);
    return NextResponse.json({ analiz, mesaj_sayisi: listings.length });
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return NextResponse.json({ analiz: JSON.parse(m[0]), mesaj_sayisi: listings.length }); }
      catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'LLM yanıtı parse edilemedi', raw }, { status: 500 });
  }
}
