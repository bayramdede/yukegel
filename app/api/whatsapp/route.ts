import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getServiceSupabase } from '../../../lib/auth';
import { getAiQuotaForUser, countAiListingsLast24h } from '../../../lib/auditLimits';
import { structuredLog } from '../../../lib/logger';
import { ilanYaz, bugunISO, type DurakGirdi } from '../../../lib/ilan-yaz';

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
  //
  // 🚨 Burada eskiden kendi `listings` INSERT'i + ayrı `listing_stops` INSERT'i
  // vardı. Yani `ILAN_VER_ANALIZ`'in W0/W1'de kapattığı üç delik bu kanalda
  // AÇIK kalmıştı ve en kötü yerde açıktı: WhatsApp girdisi bir formdan değil,
  // LLM'in serbest metinden çıkardığı yorumdan geliyor.
  //   V1 — `vehicle_type` beyaz listeden geçmiyordu: LLM "Tır Dorse" derse kolona
  //        öyle yazılıyor, filtrelerde hiçbir zaman eşleşmeyen ölü ilan doğuyordu.
  //   V2 — `contact_phone` LLM'in metinden okuduğu numaraydı; mesajı gönderen
  //        kişinin profil numarası değil. Yani ilanın telefonu BAŞKASININ olabilirdi.
  //   V5 — durak INSERT'i patlarsa geriye duraksız ilan kalıyordu.
  // `ilanYaz()` üçünü de kapatıyor; `KANAL_POLITIKA.whatsapp.daimaIncele` de
  // buradaki "her ilan kuyruğa girer" davranışını koruyor.
  const duraklar: DurakGirdi[] = (Array.isArray(parsed.stops) ? parsed.stops : [])
    .filter((s: any) => typeof s?.city === 'string' && s.city.trim())
    .map((s: any) => ({
      sehir: String(s.city),
      ilce: s.district ? String(s.district) : undefined,
      ton: s.weight_ton ?? null,
      palet: s.pallet_count ?? null,
      yuk_cinsi: s.cargo_type ? String(s.cargo_type) : null,
    }));

  // LLM tarih uydurabilir ya da hiç bulamayabilir; geçmiş/boş tarihte ilanı
  // reddetmek yerine bugüne çekiyoruz — kullanıcı WhatsApp'ta tarih düzeltemez.
  const tarihHam = typeof parsed.available_date === 'string' ? parsed.available_date : '';
  const bugun = bugunISO();
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(tarihHam) && tarihHam >= bugun ? tarihHam : bugun;

  const sonuc = await ilanYaz(
    userId,
    {
      tip: parsed.listing_type === 'arac' ? 'arac' : 'yuk',
      kalkis: String(parsed.origin_city ?? ''),
      kalkis_ilce: parsed.origin_district ? String(parsed.origin_district) : undefined,
      fiyat: parsed.price ?? null,
      fiyat_pazarlik: !parsed.price,
      tarih,
      tarih_esnek: Boolean(parsed.date_flexible),
      genel_not: parsed.notes ? String(parsed.notes) : undefined,
      arac_tipi: parsed.vehicle_type ? String(parsed.vehicle_type) : undefined,
      utsyapi: Array.isArray(parsed.body_type) ? parsed.body_type.map(String) : [],
      duraklar,
      raw_text: messageBody,   // kota sayımı için zorunlu (countAiListingsLast24h)
      ai_parsed: true,
    },
    'whatsapp',
  );

  if (!sonuc.ok) {
    structuredLog('WARN', 'whatsapp-webhook', 'İlan oluşturulamadı', {
      user_id: userId, hata: sonuc.hata, origin: parsed.origin_city,
    });
    return twiml(`İlanınız oluşturulamadı: ${sonuc.hata}`);
  }

  structuredLog('INFO', 'whatsapp-webhook', 'WhatsApp ilan oluşturuldu', {
    user_id: userId,
    listing_id: sonuc.id,
    origin: parsed.origin_city,
    durum: sonuc.durum,
    quota_used: kullanim + 1,
    quota_limit: quota,
  });

  return twiml(
    `${sonuc.mesaj} ✅\n\nDetay ve düzenleme: https://www.yukegel.com/ilan/${sonuc.id}\n\nKalan günlük limit: ${quota - kullanim - 1}/${quota}`
  );
}
