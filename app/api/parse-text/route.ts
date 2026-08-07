import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../lib/auth';
import { getAiQuotaForUser, countAiListingsLast24h } from '../../../lib/auditLimits';
import { istekIp } from '../../../lib/kota';
import { aiKotaBak, aiKotaIsle, AI_IP_SAATLIK } from '../../../lib/ai-kota';
import { structuredLog } from '../../../lib/logger';

export const runtime = 'nodejs';

// ── V7: KOTA ARTIK ÇAĞRI BAZINDA — gerekçe `lib/ai-kota.ts` başlığında ────────

// ── URL çıkarma + arşivleme yardımcısı ──────────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s\u200b\u200c\u200d\u2060\u00A0]+/gi;

function extractUrlsFromText(text: string): Array<{ url: string; domain: string; category: string }> {
  const raw = (text.match(URL_REGEX) || []).map(u => u.replace(/[.,;!?)"']+$/, ''));
  const unique = [...new Set(raw)];
  return unique.map(url => {
    let domain = '';
    let category = 'other';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* malformed */ }
    if (domain === 'chat.whatsapp.com') category = 'whatsapp_group';
    else if (domain === 't.me' || domain.includes('telegram.')) category = 'telegram';
    else if (domain.includes('facebook.com') || domain === 'fb.com') category = 'facebook_group';
    else if (domain.includes('instagram.com')) category = 'instagram';
    else if (domain.includes('linkedin.com')) category = 'linkedin';
    return { url, domain, category };
  });
}

// Tek bir kullanıcı metnini Anthropic Haiku ile yapılandırılmış JSON'a çevirir.
// "regex/alias-first, LLM as last resort" felsefesine sadık kalmak için ileride
// alias-bazlı bir hızlı parse adımı eklenebilir; tekil mesajlarda doğruluk önemli
// olduğu için ilk versiyonda doğrudan LLM kullanılıyor (Haiku, kısa giriş, ucuz).
//
// ── COĞRAFİ SÖZLEŞME (`docs/COGRAFI_GECIS.md` Dalga 4) ──────────────────────
// 🚨 Bu uç nokta VERİTABANINA YAZMAZ. Çıktı `MetindenIlan.tsx` → `ilan-ver/page.tsx`
// `aiCiktisiniUygula()` → forma prefill → `ilanYaz()` yolunu izler; `province_id`
// orada `ilCiftYazim()` ile türetilir. Yani AI'ın plaka kodu üretmesine GEREK YOK
// ve İSTENMEZ — LLM'e sayı saydırmak, adı katlamaktan çok daha kırılgan.
// Prompt'un tek işi il adını KATLANABİLİR biçimde vermek.
//
// ⚠️ ASIL RİSK yazım hatası değil (`ilCiftYazim` "istanbul", "İSTANBUL", "Istanbul"
// hepsini katlar); AI'ın `origin_city`'ye İLÇE adı koyması. "Çorlu" gelirse
// `ilCiftYazim` null döner, `ilNormalize` alanı BOŞ bırakır ve kullanıcı kalkışı
// elle seçmek zorunda kalır. Prompt kuralları bunu engellemek için var.
// (Aynı prompt'un ikinci kopyası `app/api/whatsapp/route.ts` — orada aynı hata
//  formsuz olduğu için ilanı tamamen düşürür. İkisini BİRLİKTE güncelle.)

export async function POST(request: NextRequest) {
  try {
    // ── Auth: giriş gerekli (quota kullanıcı başına hesaplandığı için)
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });
    }

    // ── Quota: günlük AI ilan limiti
    const ip = istekIp(request);
    const [quota, dbKullanim] = await Promise.all([
      getAiQuotaForUser(user.id),
      countAiListingsLast24h(user.id),   // artık yalnız TABAN + raporlama
    ]);
    if (quota === 0) {
      structuredLog('WARN', 'llm-quota', 'Günlük AI ilan kotası kapatılmış (quota=0) — 429 döndürüldü', {
        user_id: user.id,
        quota_limit: 0,
        used_today: dbKullanim,
      });
      return NextResponse.json({
        success: false,
        error: 'AI ile ilan oluşturma özelliği hesabınız için kapalı. Lütfen tekil ilan formunu kullanın.',
        quotaReached: true, quota, used: dbKullanim,
      }, { status: 429 });
    }

    // Kotaya BAK (sayma) — kullanıcı günlük + IP saatlik.
    const durum = aiKotaBak(user.id, quota, dbKullanim, ip);
    const { kullanim, cagriKullanim } = durum;

    if (durum.doldu) {
      structuredLog('WARN', 'llm-quota', 'Günlük AI ilan kotası aşıldı — 429 döndürüldü', {
        user_id: user.id,
        quota_limit: quota,
        used_today: kullanim,
        db_used: dbKullanim,
        cagri_used: cagriKullanim,
      });
      return NextResponse.json({
        success: false,
        error: `Günlük AI ilan limitiniz doldu (${kullanim}/${quota}). 24 saat sonra tekrar deneyin veya tekil ilan formunu kullanın.`,
        quotaReached: true, quota, used: kullanim,
      }, { status: 429 });
    }

    if (durum.ipDoldu) {
      structuredLog('WARN', 'llm-quota', 'AI parse IP saatlik tavanı aşıldı — 429 döndürüldü', {
        ip, user_id: user.id, limit: AI_IP_SAATLIK, bekle_sn: durum.ipBekleSn,
      });
      return NextResponse.json({
        success: false,
        error: `Çok fazla AI isteği gönderildi. ${durum.ipBekleSn} saniye sonra tekrar deneyin.`,
        quotaReached: true, quota, used: kullanim,
      }, { status: 429 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ success: false, error: 'Lütfen daha uzun bir ilan metni girin.' }, { status: 400 });
    }

    // ── URL arşivleme (fire-and-forget, ana akışı etkilemez) ─────────────────
    const foundUrls = extractUrlsFromText(text);
    if (foundUrls.length > 0) {
      void Promise.resolve(
        ssrClient
          .from('archived_links')
          .upsert(
            foundUrls.map(({ url, domain, category }) => ({
              url, domain, category,
              source: 'user_text',
              user_id: user.id,
              status: 'pending_review',
            })),
            { onConflict: 'url', ignoreDuplicates: true }
          )
      ).catch(() => {});
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI servisi yapılandırılmamış.' }, { status: 500 });
    }

    const bugun = new Date().toISOString().split('T')[0];

    const prompt = `Türk nakliye ilanı metnini ayrıştır. SADECE geçerli JSON döndür, hiçbir açıklama yapma.

GİRDİ METNİ (kullanıcının yapıştırdığı):
"""
${text.substring(0, 2000)}
"""

ÇIKTI ŞEMASI (örnek):
{
  "listing_type": "yuk",
  "origin_city": "İstanbul",
  "origin_district": null,
  "contact_phone": "05XXXXXXXXX",
  "vehicle_type": "TIR",
  "body_type": ["Tenteli"],
  "price": null,
  "available_date": "2026-05-09",
  "date_flexible": false,
  "stops": [
    { "city": "Ankara", "district": null, "weight_ton": null, "pallet_count": null, "cargo_type": "Tekstil" }
  ],
  "notes": "ek bilgi varsa"
}

KURALLAR:
- listing_type: "yük taşıtacak müşteri" => "yuk", "boş aracı olan nakliyeci" => "arac". Kararsızsan "yuk".
- origin_city: SADECE 81 Türkiye İLİNDEN biri, doğru Türkçe yazımla (örn: "İstanbul", "Şanlıurfa", "Kahramanmaraş", "Muğla").
    ⚠️ ASLA ilçe/belde/semt/OSB adı yazma. Metinde yalnızca ilçe geçiyorsa (örn: "Çorlu",
    "Gebze", "İnegöl", "İkitelli") o adı origin_district'e koy, origin_city'ye BAĞLI OLDUĞU
    İLİ yaz ("Tekirdağ", "Kocaeli", "Bursa", "İstanbul"). İl hiç çıkarılamıyorsa null bırak.
- origin_district: ilçe/semt varsa Türkçe doğru yazılmış string, yoksa null.
- contact_phone: 11 haneli, "05" ile başlayan format. Bulamazsan null. Boşluk/parantez/+90 prefix'i temizle.
- vehicle_type: ŞU DEĞERLERDEN SADECE BİRİ veya null: "TIR" | "Kırkayak" | "Kamyon" | "Kamyonet" | "Panelvan".
- body_type: ŞU DEĞERLERDEN sıfır veya birden fazla içeren dizi: "Tenteli" | "Açık Kasa" | "Kapalı Kasa" | "Frigorifik" | "Damperli" | "Lowbed" | "Liftli" | "Silo". Yoksa boş dizi [].
- price: TL cinsinden sayı (örn: 25000), yoksa null.
- available_date: YYYY-MM-DD. Bugün: ${bugun}. "yarın" => bugün+1. "bugün" => ${bugun}. Belirsizse null.
- date_flexible: metinde "esnek", "her zaman", "haftaya" gibi ifade varsa true, aksi false.
- stops: en az 1 varış noktası içermeli. Çoklu varış varsa hepsini ekle. Her stop için:
    - city: zorunlu, SADECE 81 Türkiye İLİNDEN biri, doğru Türkçe yazımla.
      ⚠️ origin_city ile aynı kural: ilçe adını city'ye YAZMA, district'e koy ve city'ye
      bağlı olduğu ili yaz ("Çorlu" → city:"Tekirdağ", district:"Çorlu").
    - district, weight_ton, pallet_count, cargo_type: yoksa null.
- notes: yukarıdaki alanlara sığmayan kısa ek bilgi (yük cinsi, özel şartlar). Yoksa null.
- Bilinmeyen tüm alanları null/[] olarak bırak. UYDURMA.

ÇIKTI: yalnızca JSON nesnesi.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!response.ok) {
      const errText = await response.text();
      // Sayaç İŞLENMEDİ: sağlayıcı hatası kullanıcının kotasını yakmasın (§9).
      return NextResponse.json({ success: false, error: `AI servisi hatası (${response.status}): ${errText.slice(0, 200)}` }, { status: 502 });
    }

    // ✅ Anthropic çağrısı başarılı = PARA HARCANDI. Kapı burada kapanır.
    aiKotaIsle(user.id, quota, ip);

    const data = await response.json();
    const respText = data.content?.[0]?.text || '';
    if (!respText) {
      return NextResponse.json({ success: false, error: 'AI yanıtı boş geldi.' }, { status: 502 });
    }

    // Markdown code-block temizliği
    const clean = respText.replace(/```json|```/g, '').trim();

    let result: any;
    try {
      result = JSON.parse(clean);
    } catch {
      // Yanıt içinde başka metin varsa { ... } bloğunu çıkar
      const m = clean.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json({ success: false, error: 'AI yanıtı ayrıştırılamadı.' }, { status: 502 });
      }
      result = JSON.parse(m[0]);
    }

    // Minimum doğrulama: en az kalkış veya 1 stop city olmalı
    const hasOrigin = !!(result.origin_city && String(result.origin_city).trim());
    const hasStop = Array.isArray(result.stops) && result.stops.some((s: any) => s?.city && String(s.city).trim());
    if (!hasOrigin && !hasStop) {
      return NextResponse.json({
        success: false,
        error: 'Metinden anlamlı bir kalkış/varış bilgisi çıkarılamadı. Lütfen daha açıklayıcı yazın veya tekil ilan formunu kullanın.',
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      result,
      raw_text: text,
      quota: { limit: quota, used: kullanim, remaining: Math.max(0, quota - kullanim - 1) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}
