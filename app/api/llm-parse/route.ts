import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { raw_text, notes } = await request.json();

    const prompt = `Türk nakliye ilanı ayrıştır. Sadece JSON döndür.

İLAN SATIRI: ${notes || raw_text.split('\n')[0]}

TÜM MESAJ (bağlam için):
${raw_text.substring(0, 500)}

JSON format:
{"listing_type":"yuk","origin_city":"İl","origin_district":null,"contact_phone":"05XX","vehicle_type":["TIR"],"body_type":["Kapalı Kasa"],"stops":[{"city":"İl","district":null,"weight_ton":null,"pallet_count":null,"cargo_type":null}]}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    console.log('Anthropic status:', response.status);

    const text = data.content?.[0]?.text || '';
    console.log('Anthropic text:', text.substring(0, 300));

    if (!text) {
      return NextResponse.json({ success: false, error: `Anthropic boş yanıt (status: ${response.status}, error: ${JSON.stringify(data.error)})` }, { status: 500 });
    }

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('LLM parse error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
