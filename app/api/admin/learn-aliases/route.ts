import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60; // LLM keşif çağrısı için

async function yetkiKontrol() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// GET — 3 sekme verisi
//   ?sekme=aliases   → Tüm onaylı alias'lar (CRUD)
//   ?sekme=no_lane   → raw_posts.processing_status='no_lane'
//                    + listings.origin_city IS NULL
//   ?sekme=pending   → AI önerisi bekleyen alias'lar (is_approved=false)
// ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const sekme = req.nextUrl.searchParams.get('sekme') ?? 'aliases';
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '200'), 500);

  // ── Sekme 1: Alias Kütüphanesi ──
  if (sekme === 'aliases') {
    const { data, error } = await svc
      .from('aliases')
      .select('id, alias, normalized, type, is_active, priority, district, created_by_ai, is_approved, llm_confidence, created_at')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('type', { ascending: true })
      .order('normalized', { ascending: true })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  // ── Sekme 2: no_lane kayıtlar ──
  if (sekme === 'no_lane') {
    // 1. WhatsApp no_lane raw_posts
    const { data: rawPosts, error: rawErr } = await svc
      .from('raw_posts')
      .select('id, raw_text, contact_phone, created_at, processing_status, source_group, slh_scanned_at')
      .eq('processing_status', 'no_lane')
      .is('slh_scanned_at', null)          // sadece hic taranmamislar
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.7));

    // 2. Form ilanları — origin_city boş + SLH taranmamış
    const { data: noOrigin, error: noOrgErr } = await svc
      .from('listings')
      .select('id, raw_text, source, origin_city, notes, created_at, moderation_status')
      .is('origin_city', null)
      .not('raw_text', 'is', null)
      .is('slh_scanned_at', null)        // sadece hiç taranmamışlar
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.3));

    if (rawErr) return NextResponse.json({ error: rawErr.message }, { status: 500 });

    return NextResponse.json({
      raw_posts: rawPosts ?? [],
      listings_no_origin: noOrigin ?? [],
      total: (rawPosts?.length ?? 0) + (noOrigin?.length ?? 0),
    });
  }

  // ── Sekme 3: Onay bekleyen AI önerileri ──
  if (sekme === 'pending') {
    const { data, error } = await svc
      .from('aliases')
      .select('id, alias, normalized, district, type, llm_confidence, source_listing_ids, created_at')
      .eq('created_by_ai', true)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  // ── Sekme: source — raw_post id'leri için ham metni getir ──
  if (sekme === 'source') {
    const rawIds = (req.nextUrl.searchParams.get('ids') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (rawIds.length === 0) return NextResponse.json({ data: [] });
    const { data, error } = await svc
      .from('raw_posts')
      .select('id, raw_text')
      .in('id', rawIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  return NextResponse.json({ error: 'Gecersiz sekme' }, { status: 400 });
}

// ──────────────────────────────────────────────
// POST — İşlemler
//   { action: 'create', alias, normalized, type }  → Manuel alias ekle
//   { action: 'discover', limit? }                 → LLM ile no_lane keşfi
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const body = await req.json();

  // ── Manuel alias oluştur ──
  if (body.action === 'create') {
    const { alias, normalized, type } = body;
    if (!alias?.trim() || !normalized?.trim()) {
      return NextResponse.json({ error: 'alias ve normalized zorunlu' }, { status: 400 });
    }
    const { data, error } = await svc
      .from('aliases')
      .insert({
        alias: alias.trim(),
        normalized: normalized.trim(),
        type: type ?? 'city',
        district: body.district?.trim() || null,
        is_active: true,
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
    const limit = Math.min(Number(body.limit ?? 10), 50); // frontend default 10

    // 1. raw_posts çek
    const { data: rawPosts, error: fetchErr } = await svc
      .from('raw_posts')
      .select('id, raw_text')
      .eq('processing_status', 'no_lane')
      .is('slh_scanned_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!rawPosts || rawPosts.length === 0) {
      return NextResponse.json({ success: true, message: 'Kesfedilecek no_lane kayit yok', suggestions: [] });
    }

    // 2. Mevcut alias'ları çek
    const { data: mevcutAliaslar } = await svc
      .from('aliases')
      .select('alias, normalized, type')
      .eq('is_approved', true)
      .eq('is_active', true)
      .in('type', ['city', 'district'])
      .limit(500);

    const mevcutMap = (mevcutAliaslar ?? [])
      .map((a: any) => `"${a.alias}"=>"${a.normalized}"`)
      .join(', ');

    // 3. Metinleri birleştir (lone surrogate'leri temizle — JSON serialize hatasını önler)
    const stripSurr = (s: string) => s.replace(/[\uD800-\uDFFF]/g, '')
    const metinler = rawPosts
      .map((r: any, i: number) => `[${i + 1}] (ID:${r.id})\n${stripSurr((r.raw_text || '').substring(0, 200))}`)
      .join('\n\n---\n\n'); // 400→200 char: prompt boyutunu yarıya indir

    // 4. Haiku çağrısı
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY eksik' }, { status: 500 });

    const prompt = `Turk nakliye ilan metinlerinden YER ADI ALIAS'LARINI kesvet.

MEVCUT ALIAS'LAR (bunlari tekrar onerme): ${mevcutMap || '(bos)'}

ASAGIDA ${rawPosts.length} ADET ROTALARI COZULEMAMIS ILAN VAR:
${metinler}

GOREV:
Bu metinlerde gecen yer isimlerinden standart Turkiye il/ilce listesinde OLMAYANLARI tespit et.
Bunlarin standart karsiligini bul.
Ornekler:
- "G.Antep"  => normalized:"Gaziantep", district:null     (il)
- "eskiseh"  => normalized:"Eskisehir", district:null     (il)
- "izmit"    => normalized:"Kocaeli",   district:"Izmit"  (ilce)
- "gebze"    => normalized:"Kocaeli",   district:"Gebze"  (ilce)
- "tuzla"    => normalized:"Istanbul",  district:"Tuzla"  (ilce)
- "ikitelli" => normalized:"Istanbul",  district:"Ikitelli" (ilce)
- "corlu"    => normalized:"Tekirdag",  district:"Corlu"  (ilce)
- "antakya"  => normalized:"Hatay",     district:"Antakya" (ilce)

SADECE GECERLI JSON ARRAY DONDUR, baska hicbir sey yazma:
[
  {
    "alias": "bulunan_kelime_veya_kisaltma",
    "normalized": "bagli_oldugu_il_adi_turkce",
    "district": "ilce_adi_turkce_veya_null",
    "type": "city",
    "confidence": 85,
    "source_ids": ["id1"]
  }
]

KURALLAR:
- type: her zaman "city" kullan
- normalized: DAIMA il adi (ornek: "Istanbul", "Kocaeli", "Gaziantep")
- district: eger alias bir ILCE ise ilcenin dogru Turkce adi; eger alias IL ise null
- confidence: 0-100. Sadece >=70 gonder.
- Mevcut listede olan alias'lari tekrar onerme
- Hic bulamazsan: [] dondur`;

    let llmResponse: any;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s hard timeout
      let res: Response;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,  // 512 cok kucuktu, JSON truncate oluyordu
            messages: [{ role: 'user', content: prompt }],
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!res!.ok) {
        const err = await res!.text();
        return NextResponse.json({ error: `LLM hata (${res!.status}): ${err.slice(0, 200)}` }, { status: 502 });
      }
      llmResponse = await res!.json();
    } catch (e: any) {
      const mesaj = e?.name === 'AbortError'
        ? 'LLM 8 saniyede yanit vermedi — limit azalt veya tekrar dene'
        : `LLM erisim hatasi: ${e.message}`;
      console.error('[learn-aliases] Anthropic fetch hatasi:', e?.name, e?.message, e?.cause);
      return NextResponse.json({ error: mesaj }, { status: 502 });
    }

    const rawText = llmResponse.content?.[0]?.text ?? '';
    const clean = rawText.replace(/```json|```/g, '').trim();

    let suggestions: any[] = [];
    try {
      const m = clean.match(/\[[\s\S]*\]/);
      suggestions = m ? JSON.parse(m[0]) : [];
    } catch {
      return NextResponse.json({ error: 'LLM yaniti parse edilemedi', raw: clean.slice(0, 500) }, { status: 502 });
    }

    const now = new Date().toISOString();
    const rawPostIds = rawPosts.map((r: any) => r.id);

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);
      return NextResponse.json({ success: true, message: 'LLM yeni alias bulamadi', suggestions: [] });
    }

    // 5a. Confidence ≥70 olanları filtrele
    const adaylar = suggestions
      .filter((s: any) => s.alias && s.normalized && (s.confidence ?? 0) >= 70)
      .map((s: any) => ({
        alias: String(s.alias).trim().toLowerCase(),
        normalized: String(s.normalized).trim(),
        type: 'city',
        district: s.district ? String(s.district).trim() : null,
        is_active: false,
        created_by_ai: true,
        is_approved: false,
        llm_confidence: Math.min(100, Math.max(0, Number(s.confidence ?? 80))),
        source_listing_ids: Array.isArray(s.source_ids) ? s.source_ids : [],
      }));

    if (adaylar.length === 0) {
      await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);
      return NextResponse.json({
        success: true,
        message: 'Guvenilir oneri bulunamadi (confidence < 70)',
        suggestions,
      });
    }

    // 5b. Zaten onaylanmış alias'ları hariç tut — upsert bunları ezip is_approved=false yapmasın
    const { data: mevcutOnaylilar } = await svc
      .from('aliases')
      .select('alias')
      .in('alias', adaylar.map((a: any) => a.alias))
      .eq('is_approved', true);

    const onayliSet = new Set((mevcutOnaylilar ?? []).map((a: any) => a.alias));
    const kayitlar = adaylar.filter((a: any) => !onayliSet.has(a.alias));

    if (kayitlar.length === 0) {
      await svc
        .from('raw_posts')
        .update({ slh_scanned_at: new Date().toISOString() })
        .in('id', rawPosts.map((r: any) => r.id));
      await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);
      return NextResponse.json({
        success: true,
        message: 'LLM onerilerinin tamami zaten mevcut — yeni alias yok',
        suggestions: [],
      });
    }

    const { error: insertErr } = await svc
      .from('aliases')
      .upsert(kayitlar, { onConflict: 'alias', ignoreDuplicates: false });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Taranmis raw_posts'lari isaretle
    const taranmisIds = rawPosts.map((r: any) => r.id);
    await svc
      .from('raw_posts')
      .update({ slh_scanned_at: new Date().toISOString() })
      .in('id', taranmisIds);

    // Bu batch'te kesfedilen normalized degerleri ile eslesen listings'leri de isaretle
    const kesfedilenNorm = kayitlar.map((k: any) => k.normalized);
    if (kesfedilenNorm.length > 0) {
      await svc
        .from('listings')
        .update({ slh_scanned_at: new Date().toISOString() })
        .is('slh_scanned_at', null)
        .in('origin_city', kesfedilenNorm);
    }

    return NextResponse.json({
      success: true,
      message: `${kayitlar.length} yeni alias onerisi kaydedildi (onay bekliyor)`,
      suggestions: kayitlar,
      scanned_count: rawPosts.length,
    });
  }

  return NextResponse.json({ error: 'Gecersiz action' }, { status: 400 });
}

// ──────────────────────────────────────────────
// PATCH — Onayla / güncelle
// ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  if (!(await yetkiKontrol())) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const svc = getServiceSupabase();
  const { id, action, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  if (action === 'approve') {
    const payload: Record<string, any> = {
      is_approved: true,
      is_active: true,
      approved_at: new Date().toISOString(),
    };
    // Düzeltme alanları varsa güncelle (düzenle + onayla akışı)
    if (updates.alias !== undefined) payload.alias = String(updates.alias).trim().toLowerCase();
    if (updates.normalized !== undefined) payload.normalized = String(updates.normalized).trim();
    if ('district' in updates) payload.district = updates.district?.trim() || null;
    const { error } = await svc.from('aliases').update(payload).eq('id', id);
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
  if (updates.alias !== undefined) izinli.alias = String(updates.alias).trim().toLowerCase();
  if (updates.normalized !== undefined) izinli.normalized = String(updates.normalized).trim();
  if (updates.type !== undefined) izinli.type = updates.type;
  if ('district' in updates) izinli.district = updates.district?.trim() || null;

  if (Object.keys(izinli).length === 0) {
    return NextResponse.json({ error: 'Guncellenecek alan yok' }, { status: 400 });
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
