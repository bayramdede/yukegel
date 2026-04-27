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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini status:', response.status);
    console.log('Gemini text:', text.substring(0, 500));

    if (!text) {
      return NextResponse.json({ success: false, error: `Gemini boş yanıt döndürdü (status: ${response.status})` }, { status: 500 });
    }

    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('LLM parse error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
