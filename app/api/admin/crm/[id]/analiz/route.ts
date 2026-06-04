import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SISTEM_PROMPT = `Sen bir Türk lojistik sektörü analistsin. Sana bir numaraya ait WhatsApp ilan mesajları verilecek. Bu mesajları okuyarak kişi hakkında profil çıkar. SADECE geçerli JSON döndür, başka hiçbir şey yazma.

Şema:
{
  "ozet": "2-3 cümle genel profil",
  "tip": "nakliyeci veya komisyoncu veya musteri veya belirsiz",
  "tip_aciklama": "neden bu tipi seçtin",
  "aktif_rotalar": ["sehir1-sehir2"],
  "arac_tipleri": ["TIR"],
  "yuk_tipleri": ["Dokme"],
  "calisma_stili": "bolgesel veya ulusal veya sehir ici",
  "aktivite_yogunlugu": "dusuk veya orta veya yuksek",
  "ilginc_notlar": [],
  "isim_tahmini": "mesajlarda imza veya isim geciyorsa yaz, yoksa null",
  "firma_tahmini": "mesajlarda firma adi geciyorsa yaz, yoksa null",
  "notlar_tahmini": "bu kisi icin adminin bilmesi gereken 1-2 cumle ozet not",
  "etiket_tahmini": "vip veya guvenilir veya normal veya suphelı veya spam"
}

Etiket secim kurallari:
- vip: cok aktif (10+ ilan), tutarli rota, profesyonel nakliyeci
- guvenilir: duzenli paylasim, net ilan bilgisi, samimi
- normal: ortalama kullanici, belirgin bir ozellik yok
- suphelı: tutarsiz bilgi, cok farkli numaralardan ayni icerik, komisyoncu olabilir
- spam: tek tip kopyala-yapistir, reklam icerigi, anlamsiz mesajlar`;

// Lone surrogate + kontrol karakterlerini temizle (WhatsApp emoji kalıntıları JSON'u bozar)
function temizle(s: string): string {
  return s
    .replace(/[\uD800-\uDFFF]/g, '')               // lone surrogates
    .replace(/\x00/g, '')                           // null byte
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // kontrol karakterleri
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 400);
}


// GET — kaydedilmiş analizi getir
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await params;
  const svc = getServiceSupabase();

  const { data } = await svc
    .from('shadow_profiles')
    .select('ai_analiz, ai_analiz_at')
    .eq('id', id)
    .maybeSingle();

  if (!data?.ai_analiz) return NextResponse.json({ analiz: null });
  return NextResponse.json({ analiz: data.ai_analiz, ai_analiz_at: data.ai_analiz_at });
}

// POST — yeni analiz çalıştır ve kaydet
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { id } = await params;
  const svc = getServiceSupabase();

  try {
    // 1. İlanları çek
    const { data: listings, error: listErr } = await svc
      .from('listings')
      .select('raw_text, origin_city, created_at')
      .eq('shadow_profile_id', id)
      .not('raw_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (listErr) {
      return NextResponse.json({ error: 'DB hatası: ' + listErr.message }, { status: 500 });
    }

    if (!listings || listings.length === 0) {
      return NextResponse.json({ error: 'Ham mesaj bulunamadı (shadow_profile_id eşleşmesi yok veya raw_text boş).' }, { status: 400 });
    }

    // 2. Mesajları temizle ve birleştir
    const mesajlar = listings
      .map((l, i) => {
        const t = new Date(l.created_at).toLocaleDateString('tr-TR');
        return `[${i + 1}] ${t}: ${temizle(String(l.raw_text ?? ''))}`;
      })
      .join('\n');

    // 3. API anahtarı
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY eksik' }, { status: 500 });

    // 4. LLM çağrısı
    const llmRes = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{ role: 'user', content: `${listings.length} ilan:\n${mesajlar}` }],
      }),
    });

    if (!llmRes.ok) {
      const errBody = await llmRes.text();
      return NextResponse.json({
        error: `Anthropic ${llmRes.status}: ${errBody.substring(0, 300)}`,
      }, { status: 500 });
    }

    // 5. Yanıtı parse et
    const llmData = await llmRes.json();
    const rawText = String(llmData.content?.[0]?.text ?? '');
    const clean = rawText.replace(/```json|```/g, '').trim();

    let analiz: object | null = null;
    try { analiz = JSON.parse(clean); } catch {
      const m = clean.match(/\{[\s\S]*\}/);
      if (m) { try { analiz = JSON.parse(m[0]); } catch { /* fall */ } }
    }

    if (!analiz) {
      return NextResponse.json({ error: 'LLM JSON parse hatası: ' + rawText.substring(0, 200) }, { status: 500 });
    }

    // 6. Kaydet
    const now = new Date().toISOString();
    await svc.from('shadow_profiles').update({ ai_analiz: analiz, ai_analiz_at: now }).eq('id', id);

    return NextResponse.json({ analiz, mesaj_sayisi: listings.length, ai_analiz_at: now });

  } catch (err: any) {
    return NextResponse.json({ error: 'Beklenmeyen hata: ' + (err?.message ?? String(err)) }, { status: 500 });
  }
}
