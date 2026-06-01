import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getServiceSupabase } from '../../../lib/auth';
import { getAiQuotaForUser, countAiListingsLast24h } from '../../../lib/auditLimits';
import { structuredLog } from '../../../lib/logger';

export const runtime = 'nodejs';

// ── TwiML yardımcısı ──────────────────────────────────────────────────────────
function twiml(msg: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}

// ── Twilio imza doğrulama (HMAC-SHA1) ────────────────────────────────────────
function validateTwilioSignature(req: NextRequest, body: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;

  const signature = req.headers.get('x-twilio-signature') || '';
  const url = `https://${req.headers.get('host')}/api/whatsapp`;

  // Parametreleri alfabetik sıraya diz, URL'e ekle
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const paramStr = sortedKeys.map(k => `${k}${params.get(k)}`).join('');

  const expected = createHmac('sha1', token)
    .update(url + paramStr)
    .digest('base64');

  return expected === signature;
}

// ── Telefon normalizasyonu: "whatsapp:+905321234567" → "+905321234567" ────────
function normalizePhone(from: string): string {
  return from
    .replace('whatsapp:', '')
    .trim()
    .replace(/^\+90/, '0');  // +905380855996 → 05380855996
}

// ── LLM parse (parse-text ile aynı prompt) ───────────────────────────────────
async function parseWithLLM(text: string): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const bugun = new Date().toISOString().split('T')[0];

  const prompt = `Türk nakliye ilanı metnini ayrıştır. SADECE geçerli JSON döndür, hiçbir açıklama yapma.

GİRDİ METNİ:
"""
${text.substring(0, 2000)}
"""

ÇIKTI ŞEMASI:
{
  "listing_type": "yuk",
  "origin_city": "İstanbul",
  "origin_district": null,
  "contact_phone": "05XXXXXXXXX",
  "vehicle_type": "TIR",
  "body_type": ["Tenteli"],
  "price": null,
  "available_date": "${bugun}",
  "date_flexible": false,
  "stops": [
    { "city": "Ankara", "district": null, "weight_ton": null, "pallet_count": null, "cargo_type": null }
  ],
  "notes": null
}

KURALLAR:
- listing_type: nakliyeci boş araç duyuruyorsa "arac", yük taşıtacak müşteriyse "yuk". Kararsızsan "yuk".
- origin_city: Türkiye ili, doğru Türkçe yazımıyla.
- vehicle_type: "TIR" | "Kırkayak" | "Kamyon" | "Kamyonet" | "Panelvan" veya null.
- body_type: ["Tenteli"|"Açık Kasa"|"Kapalı Kasa"|"Frigorifik"|"Damperli"|"Lowbed"|"Liftli"|"Silo"]. Yoksa [].
- price: TL sayısı veya null.
- available_date: YYYY-MM-DD. Bugün: ${bugun}. "yarın" => bugün+1. Belirsizse null.
- stops: en az 1 varış. Her stop için city zorunlu, diğerleri null olabilir.
- contact_phone: 11 haneli, "05" ile başlayan. Bulamazsan null.
- Bilinmeyenleri null/[] bırak. UYDURMA.

ÇIKTI: yalnızca JSON.`;

  try {
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); }
    catch { const m = clean.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const bodyText = await req.text();

  // 1. İmza doğrulama (production'da aktif, dev/sandbox'ta atlanır)
  if (process.env.NODE_ENV === 'production') {
    if (!validateTwilioSignature(req, bodyText)) {
      structuredLog('WARN', 'whatsapp-webhook', 'Geçersiz Twilio imzası', {});
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const params = new URLSearchParams(bodyText);
  const from = params.get('From') || '';        // "whatsapp:+905321234567"
  const messageBody = (params.get('Body') || '').trim();

  if (!from || !messageBody) return twiml('Mesajınız alınamadı.');

  const phone = normalizePhone(from);           // "+905321234567"
  const svc = getServiceSupabase();

  // ── 1. Kayıt kontrolü ──────────────────────────────────────────────────────
  const { data: userRow } = await svc
    .from('users')
    .select('id, is_active')
    .eq('phone', phone)
    .maybeSingle();

  if (!userRow) {
    // Kayıtsız numara → shadow profile upsert (fire-and-forget, hata ana akışı etkilemez)
    void svc.rpc('upsert_shadow_profile', { p_phone: phone }).then(() => {});
    structuredLog('INFO', 'whatsapp-webhook', 'Kayıtsız numara → shadow profile upsert + kayıt linki gönderildi', { phone });
    return twiml(
      'Merhaba! 👋 Bu numara YÜKEGEL\'de kayıtlı değil.\n\nKayıt olmak için: https://www.yukegel.com/giris\n\nKayıt sonrası WhatsApp\'tan ilan oluşturabilirsiniz.'
    );
  }

  if (!userRow.is_active) {
    return twiml('Hesabınız askıya alınmış. Destek için: https://www.yukegel.com/iletisim');
  }

  // ── 2. AI kota kontrolü (LLM'den önce) ────────────────────────────────────
  const userId = userRow.id;
  const [quota, kullanim] = await Promise.all([
    getAiQuotaForUser(userId),
    countAiListingsLast24h(userId),
  ]);

  if (quota === 0) {
    return twiml('AI ile ilan oluşturma özelliği hesabınız için kapalı. İlan oluşturmak için: https://www.yukegel.com/ilan-ver');
  }

  if (kullanim >= quota) {
    structuredLog('WARN', 'whatsapp-webhook', 'WhatsApp AI kota aşıldı', { user_id: userId, quota, kullanim });
    return twiml(
      `Günlük AI ilan limitinize ulaştınız (${kullanim}/${quota}). ⏰\n\n24 saat sonra tekrar deneyebilir veya ilanlarınızı buradan oluşturabilirsiniz: https://www.yukegel.com/ilan-ver`
    );
  }

  // ── 3. LLM parse ──────────────────────────────────────────────────────────
  const parsed = await parseWithLLM(messageBody);

  if (!parsed) {
    return twiml('Mesajınızdan ilan bilgileri çıkarılamadı. Lütfen şu şekilde yazın:\n"Konya\'dan İstanbul\'a, 20 ton buğday, yarın, tır lazım"');
  }

  const hasOrigin = !!(parsed.origin_city?.trim());
  const hasStop = Array.isArray(parsed.stops) && parsed.stops.some((s: any) => s?.city?.trim());

  if (!hasOrigin && !hasStop) {
    return twiml('Mesajınızdan kalkış/varış bilgisi çıkarılamadı. Lütfen şehir isimlerini belirtin.\nÖrnek: "Ankara\'dan İzmir\'e kamyon"');
  }

  // ── 4. Listing oluştur ────────────────────────────────────────────────────
  const contactPhone = parsed.contact_phone || phone.replace('+90', '0');

  const { data: listing, error: listingErr } = await svc
    .from('listings')
    .insert({
      user_id: userId,
      source: 'whatsapp',
      listing_type: parsed.listing_type || 'yuk',
      origin_city: parsed.origin_city || null,
      origin_district: parsed.origin_district || null,
      vehicle_type: parsed.vehicle_type ? [parsed.vehicle_type] : null,
      body_type: parsed.body_type?.length ? parsed.body_type : null,
      price_offer: parsed.price || null,
      price_negotiable: !parsed.price,
      available_date: parsed.available_date || null,
      date_flexible: parsed.date_flexible ?? false,
      contact_phone: contactPhone,
      notes: parsed.notes || null,
      raw_text: messageBody,    // kota sayımı için zorunlu (countAiListingsLast24h)
      moderation_status: 'pending',
      status: 'active',
    })
    .select('id')
    .single();

  if (listingErr || !listing) {
    structuredLog('ERROR', 'whatsapp-webhook', 'listing insert hatası', { user_id: userId, error: listingErr?.message });
    return twiml('İlan kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
  }

  // listing_stops
  if (Array.isArray(parsed.stops) && parsed.stops.length > 0) {
    const stops = parsed.stops
      .filter((s: any) => s?.city?.trim())
      .map((s: any, i: number) => ({
        listing_id: listing.id,
        city: s.city,
        district: s.district || null,
        stop_order: i + 1,
        weight_ton: s.weight_ton || null,
        pallet_count: s.pallet_count || null,
        cargo_type: s.cargo_type || null,
      }));

    if (stops.length > 0) await svc.from('listing_stops').insert(stops);
  }

  structuredLog('INFO', 'whatsapp-webhook', 'WhatsApp ilan oluşturuldu', {
    user_id: userId,
    listing_id: listing.id,
    origin: parsed.origin_city,
    quota_used: kullanim + 1,
    quota_limit: quota,
  });

  return twiml(
    `İlanınız yayına alındı! ✅\n\nDetay ve düzenleme: https://www.yukegel.com/ilan/${listing.id}\n\nKalan günlük limit: ${quota - kullanim - 1}/${quota}`
  );
}
