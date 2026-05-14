import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

async function yetkiKontrol() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// GET  — 3 sekme verisi
//   ?sekme=aliases   → Tüm onaylı alias'lar
//   ?sekme=no_lane   → raw_posts.processing_status='no_lane' (parse edilememiş WA mesajları)
//                      + listings.origin_city IS NULL (formdaki eksik ilanlar)
//   ?sekme=pending   → AI önerisi bekleyen alias'lar (is_approved=false)
// ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const sekme = req.nextUrl.searchParams.get('sekme') ?? 'aliases';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '200'), 500);

  if (sekme === 'aliases') {
    const { data, error } = await svc
      .from('aliases')
      .select('id, alias, canonical, type, created_by_ai, is_approved, llm_confidence, created_at')
      .eq('is_approved', true)
      .order('canonical', { ascending: true })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  if (sekme === 'no_lane') {
    // 1. WhatsApp no_lane raw_posts (parse edilemedi)
    const { data: rawPosts, error: rawErr } = await svc
      .from('raw_posts')
      .select('id, message_text, phone_number, created_at, processing_status')
      .eq('processing_status', 'no_lane')
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.7));

    // 2. Form ilanları — origin_city boş olanlar
    const { data: noOrigin, error: noOrgErr } = await svc
      .from('listings')
      .select('id, raw_text, source, origin_city, notes, created_at, moderation_status')
      .is('origin_city', null)
      .not('raw_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.3));

    if (rawErr) return NextResponse.json({ error: rawErr.message }, { status: 500 });

    return NextResponse.json({
      raw_posts: rawPosts ?? [],
      listings_no_origin: noOrigin ?? [],
      total: (rawPosts?.length ?? 0) + (noOrigin?.length ?? 0),
    });
  }

  if (sekme === 'pending') {
    const { data, error } = await svc
      .from('aliases')
      .select('id, alias, canonical, type, llm_confidence, source_listing_ids, created_at')
      .eq('created_by_ai', true)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  return NextResponse.json({ error: 'Geçersiz sekme' }, { status: 400 });
}

// ──────────────────────────────────────────────
// POST — İşlemler
//   { action: 'create', alias, canonical, type }   → Manuel alias ekle
//   { action: 'discover', limit?: number }         → LLM ile no_lane keşfi
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const body = await req.json();

  // ── Manuel alias oluştur ──
  if (body.action === 'create') {
    const { alias, canonical, type } = body;
    if (!alias?.trim() || !canonical?.trim()) {
      return NextResponse.json({ error: 'alias ve canonical zorunlu' }, { status: 400 });
    }
    const { data, error } = await svc
      .from('aliases')
      .insert({
        alias: alias.trim(),
        canonical: canonical.trim(),
        type: type ?? 'city',
        created_by_ai: false,
        is_approved: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  // ── LLM Keşif ──
  if (body.action === 'discover') {
    const limit = Math.min(Number(body.limit ?? 50), 100);

    // 1. no_lane raw_posts çek (bunlar en zengin kaynak — ham WA metni)
    const { data: rawPosts, error: fetchErr } = await svc
      .from('raw_posts')
      .select('id, message_text')
      .eq('processing_status', 'no_lane')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!rawPosts || rawPosts.length === 0) {
      return NextResponse.json({ success: true, message: 'Keşfedilecek no_lane kayıt yok', suggestions: [] });
    }

    // 2. Mevcut (onaylı) alias listesini çek
    const { data: mevcutAliaslar } = await svc
      .from('aliases')
      .select('alias, canonical')
      .eq('is_approved', true)
      .limit(500);

    const mevcutMap = (mevcutAliaslar ?? [])
      .map((a: any) => `"${a.alias}"→"${a.canonical}"`)
      .join(', ');

    // 3. Ham metinleri birleştir
    const metinler = rawPosts
      .map((r: any, i: number) => `[${i + 1}] (ID:${r.id})\n${(r.message_text || '').substring(0, 400)}`)
      .join('\n\n---\n\n');

    // 4. LLM çağrısı (Haiku)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY eksik' }, { status: 500 });

    const prompt = `Türk nakliye ilan metinlerinden YER ADI ALIAS'LARINI keşfet.

MEVCUT ALIAS'LAR (bunları tekrar önerme): ${mevcutMap || '(boş)'}

AŞAĞIDA ${rawPosts.length} ADET ROTALARI ÇÖZÜLEMEMİŞ İLAN VAR:
${metinler}

GÖREV:
Bu metinlerde geçen yer isimlerinden standart Türkiye il/ilçe listesinde OLMAYANLARI tespit et.
Bunların standart karşılıklarını bul.
Örnekler: "G.Antep"→"Gaziantep", "İkitelli"→"İstanbul", "Eskişeh"→"Eskişehir",
           "Antep"→"Gaziantep", "Çorlu san."→"Çorlu", "D.Bakır"→"Diyarbakır"

SADECE GEÇERLİ JSON ARRAY DÖNDÜR, başka hiçbir şey yazma:
[
  {
    "alias": "bulunan_kelime_veya_kisaltma",
    "canonical": "standart_il_veya_ilce_adi",
    "type": "city|district",
    "confidence": 0-100,
    "source_ids": ["id1", "id2"]
  }
]

KURALLAR:
- type: il → "city", ilçe → "district"
- confidence: emin olma yüzdesi (0-100). Sadece ≥70 öneri gönder.
- canonical: Türkçe doğru yazım (örn: "Gaziantep", "Şanlıurfa", "Kahramanmaraş")
- Mevcut alias listesindeki girişleri tekrar önerme
- Hiç bulamazsan: [] döndür`;

    let llmResponse: any;
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
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `LLM hata (${res.status}): ${err.slice(0, 200)}` }, { status: 502 });
      }
      llmResponse = await res.json();
    } catch (e: any) {
      return NextResponse.json({ error: `LLM erişim hatası: ${e.message}` }, { status: 502 });
    }

    const rawText = llmResponse.content?.[0]?.text ?? '';
    const clean = rawText.replace(/```json|```/g, '').trim();

    let suggestions: any[] = [];
    try {
      const m = clean.match(/\[[\s\S]*\]/);
      suggestions = m ? JSON.parse(m[0]) : [];
    } catch {
      return NextResponse.json({ error: 'LLM yanıtı parse edilemedi', raw: clean.slice(0, 500) }, { status: 502 });
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json({ success: true, message: 'LLM yeni alias bulamadı', suggestions: [] });
    }

    // 5. Confidence ≥70 olanları pending olarak DB'ye yaz
    const kayitlar = suggestions
      .filter((s: any) => s.alias && s.canonical && (s.confidence ?? 0) >= 70)
      .map((s: any) => ({
        alias: String(s.alias).trim(),
        canonical: String(s.canonical).trim(),
        type: s.type ?? 'city',
        created_by_ai: true,
        is_approved: false,
        llm_confidence: Math.min(100, Math.max(0, Number(s.confidence ?? 80))),
        source_listing_ids: Array.isArray(s.source_ids) ? s.source_ids : [],
      }));

    if (kayitlar.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Güvenilir öneri bulunamadı (confidence < 70)',
        suggestions,
      });
    }

    const { error: insertErr } = await svc
      .from('aliases')
      .upsert(kayitlar, { onConflict: 'alias', ignoreDuplicates: false });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      message: `${kayitlar.length} yeni alias önerisi kaydedildi (onay bekliyor)`,
      suggestions: kayitlar,
      scanned_count: rawPosts.length,
    });
  }

  return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
}

// ──────────────────────────────────────────────
// PATCH — Alias onayla / güncelle
// ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const { id, action, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  if (action === 'approve') {
    const { error } = await svc
      .from('aliases')
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const { error } = await svc.from('aliases').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Alan güncelle
  const izinli: Record<string, any> = {};
  if (updates.alias !== undefined) izinli.alias = String(updates.alias).trim();
  if (updates.canonical !== undefined) izinli.canonical = String(updates.canonical).trim();
  if (updates.type !== undefined) izinli.type = updates.type;

  if (Object.keys(izinli).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const { error } = await svc.from('aliases').update(izinli).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// ──────────────────────────────────────────────
// DELETE — Alias sil
// ──────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  const { error } = await svc.from('aliases').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
