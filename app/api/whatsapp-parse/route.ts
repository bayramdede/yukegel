import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Clean hash — duplicate tespiti için
async function cleanHash(text: string): Promise<string> {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Türkçe karakter normalizasyonu
function trNorm(s: string): string {
  return (s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's')
    .replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/û/g, 'u').replace(/[^a-z0-9\s\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Telefon numarası çıkarma
function extractPhones(text: string): string[] {
  const phones: string[] = [];

  const matches1 = text.match(/0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || [];
  const matches2 = text.match(/\+?\s*9\s*0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || [];
  const matches3 = text.match(/5\d{9}/g) || [];

  const all = [...matches1, ...matches2, ...matches3];

  for (const m of all) {
    const d = m.replace(/\D/g, '');
    let norm = d;
    if (norm.startsWith('90') && norm.length >= 12) norm = norm.slice(2);
    if (norm.startsWith('0') && norm.length === 11) norm = norm.slice(1);
    if (norm.length === 10 && norm.startsWith('5')) {
      phones.push('0' + norm);
    }
  }

  return [...new Set(phones)];
}

// WhatsApp _chat.txt parse
function parseChatTxt(content: string): Array<{ sender: string; timestamp: string; message: string }> {
  const lines = content.split('\n');
  const messages: Array<{ sender: string; timestamp: string; message: string }> = [];

  const pattern = /^\[(\d{1,2}\.\d{1,2}\.\d{4}\s\d{1,2}:\d{1,2}:\d{1,2})\]\s(.+?):\s(.*)$/;

  let current: { sender: string; timestamp: string; lines: string[] } | null = null;

  const SISTEM_MESAJLARI = [
    'katıldı', 'ekledi', 'çıkardı', 'ayrıldı', 'silindi',
    'şifreli', 'güvenlik kodu', 'değiştirdi', 'e-fatura',
    'gider fişi', 'medya dahil edilmedi', 'bu mesaj silindi',
    'süreli mesajlar', 'uçtan uca',
  ];

  for (const line of lines) {
    const trimmed = line.replace(/[\u200e\u202a\u202c]/g, '').trim();
    if (!trimmed) continue;

    const match = pattern.exec(trimmed);
    if (match) {
      if (current && current.lines.length > 0) {
        const msg = current.lines.join('\n').trim();
        const isSistem = SISTEM_MESAJLARI.some(s => msg.toLowerCase().includes(s));
        if (!isSistem && msg.length > 10) {
          messages.push({ sender: current.sender, timestamp: current.timestamp, message: msg });
        }
      }
      current = { sender: match[2].trim(), timestamp: match[1], lines: [match[3]] };
    } else if (current) {
      current.lines.push(trimmed);
    }
  }

  if (current && current.lines.length > 0) {
    const msg = current.lines.join('\n').trim();
    const isSistem = SISTEM_MESAJLARI.some(s => msg.toLowerCase().includes(s));
    if (!isSistem && msg.length > 10) {
      messages.push({ sender: current.sender, timestamp: current.timestamp, message: msg });
    }
  }

  return messages;
}

// Gatekeeper — ilan mı değil mi?
async function gatekeeper(message: string, aliases: any[]): Promise<{
  isAd: boolean; score: number; phones: string[]; cities: string[]; vehicles: string[];
}> {
  const norm = trNorm(message);
  const phones = extractPhones(message);

  const blacklist = aliases.filter(a => a.type === 'blacklist').map(a => trNorm(a.alias));
  for (const bl of blacklist) {
    if (norm.includes(bl)) return { isAd: false, score: 0, phones: [], cities: [], vehicles: [] };
  }

  const cityAliases = aliases.filter(a => a.type === 'city');
  const foundCities: string[] = [];
  for (const ca of cityAliases) {
    const aliasNorm = trNorm(ca.alias);
    if (norm.includes(aliasNorm) || norm.split(' ').includes(aliasNorm)) {
      if (!foundCities.includes(ca.normalized)) foundCities.push(ca.normalized);
    }
  }

  const vehicleAliases = aliases.filter(a => a.type === 'vehicle');
  const foundVehicles: string[] = [];
  for (const va of vehicleAliases) {
    if (norm.includes(trNorm(va.alias))) {
      if (!foundVehicles.includes(va.normalized)) foundVehicles.push(va.normalized);
    }
  }

  let score = 0;
  score += phones.length > 0 ? 40 : 0;
  score += foundVehicles.length > 0 ? 30 : 0;
  score += foundCities.length >= 2 ? 20 : foundCities.length === 1 ? 10 : 0;
  score += foundCities.length >= 2 && foundVehicles.length > 0 ? 10 : 0;

  const isAd = phones.length > 0 && (foundVehicles.length > 0 || foundCities.length >= 2);

  return { isAd, score, phones, cities: foundCities, vehicles: foundVehicles };
}

// Repost: önceki listings'i kopyala, yeni tarihli oluştur
async function repostListings(sourceRawPostId: string, newRawPostId: string): Promise<void> {
  // Orijinal raw_post'un listings'lerini bul
  const { data: originalListings } = await supabase
    .from('listings')
    .select('*, listing_stops(*)')
    .eq('raw_post_id', sourceRawPostId);

  if (!originalListings || originalListings.length === 0) return;

  for (const original of originalListings) {
    const stops = original.listing_stops || [];

    // listing_stops'u ayır
    const { listing_stops, id, created_at, updated_at, ...listingFields } = original;

    // Yeni listing oluştur
    const { data: newListing } = await supabase
      .from('listings')
      .insert({
        ...listingFields,
        raw_post_id: newRawPostId,
        is_repost: true,
        moderation_status: 'pending',
        status: 'active',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!newListing) continue;

    // Stops'ları kopyala
    for (const stop of stops) {
      const { id: stopId, listing_id, created_at: stopCreated, ...stopFields } = stop;
      await supabase.from('listing_stops').insert({
        ...stopFields,
        listing_id: newListing.id,
      });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const saatFiltre = parseInt(formData.get('saat_filtre') as string || '12');
    const cutoff = new Date(Date.now() - saatFiltre * 60 * 60 * 1000);
    const groupName =
      (formData.get('group_name') as string) ||
      files[0]?.name
        .replace(/\.zip$/i, '').replace(/\.txt$/i, '')
        .replace(/WhatsApp Sohbeti - /i, '')
        .replace(/WhatsApp Chat - /i, '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u200e\u202a\u202c\u200f\u200b]/g, '')
        .replace(/\s+/g, ' ').trim() ||
      'Bilinmiyor';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
    }

    const fileContents: { name: string; content: string }[] = [];
    for (const file of files) {
      let content = '';
      if (file.name.endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const chatFile = Object.keys(zip.files).find(
          name => name.toLowerCase().includes('chat') && name.toLowerCase().endsWith('.txt')
        );
        if (!chatFile) continue;
        content = await zip.files[chatFile].async('string');
      } else if (file.name.endsWith('.txt')) {
        const buffer = await file.arrayBuffer();
        content = new TextDecoder('utf-8').decode(buffer);
      } else {
        continue;
      }
      fileContents.push({ name: file.name, content });
    }

    let totalMessages = 0;
    for (const fc of fileContents) {
      totalMessages += parseChatTxt(fc.content).length;
    }

    const responsePromise = NextResponse.json({
      success: true,
      total_messages: totalMessages,
      passed_gate: null,
      saved_to_db: null,
      info: 'Mesajlar arka planda işleniyor. Bekleyenler sekmesini yenileyin.',
    });

    // Arka planda asenkron işle
    ;(async () => {
      const { data: aliases } = await supabase.from('aliases').select('*').eq('is_active', true);
      let savedToDb = 0;
      let skipped = 0;
      let reposted = 0;

      for (const fc of fileContents) {
        const messages = parseChatTxt(fc.content);

        for (const msg of messages) {
          // Tarih kontrolü
          let msgDate: string = new Date().toISOString().split('T')[0];
          try {
            const [date, time] = msg.timestamp.split(' ');
            const [day, month, year] = date.split('.');
            const d = new Date(`${year}-${month}-${day}T${time}`);
            if (d < cutoff) continue;
            msgDate = `${year}-${month}-${day}`;
          } catch { /* devam */ }

          // Gatekeeper
          const gate = await gatekeeper(msg.message, aliases || []);
          if (!gate.isAd || gate.score < 30) continue;

          const hash = await cleanHash(msg.message);
          const phone = gate.phones[0] || null;

          // Kural 1: Aynı hash + aynı telefon + aynı gün → atla
          if (phone) {
            const { data: exactMatch } = await supabase
              .from('raw_posts')
              .select('id')
              .eq('clean_hash', hash)
              .eq('contact_phone', phone)
              .eq('message_date', msgDate)
              .maybeSingle();

            if (exactMatch) {
              skipped++;
              continue;
            }
          }

          // Kural 2: Aynı hash + aynı telefon + farklı gün → repost
          let isRepost = false;
          let sourceRawPostId: string | null = null;

          if (phone) {
            const { data: prevMatch } = await supabase
              .from('raw_posts')
              .select('id, message_date')
              .eq('clean_hash', hash)
              .eq('contact_phone', phone)
              .neq('message_date', msgDate)
              .order('message_date', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (prevMatch) {
              isRepost = true;
              sourceRawPostId = prevMatch.id;
            }
          }

          // raw_post kaydet
          const { data: newPost, error } = await supabase
            .from('raw_posts')
            .insert({
              source: 'whatsapp',
              source_group: groupName,
              sender_name: msg.sender,
              raw_text: msg.message,
              clean_hash: hash,
              contact_phone: phone,
              is_repost: isRepost,
              source_raw_post_id: sourceRawPostId,
              message_timestamp: (() => {
                try {
                  const [date, time] = msg.timestamp.split(' ');
                  const [day, month, year] = date.split('.');
                  return new Date(`${year}-${month}-${day}T${time}`).toISOString();
                } catch { return new Date().toISOString(); }
              })(),
              quality_score: gate.score,
              processing_status: isRepost ? 'repost' : 'pending',
              detected_ad_count: 1,
              message_date: msgDate,
            })
            .select()
            .single();

          if (error) {
            if (error.code !== '23505') {
              console.error('raw_posts insert hatası:', error.message);
            }
            continue;
          }

          savedToDb++;

          // Repost ise önceki listings'i kopyala
          if (isRepost && sourceRawPostId && newPost) {
            await repostListings(sourceRawPostId, newPost.id);
            reposted++;
          }
        }
      }

      console.log(`WhatsApp parse tamamlandı. Kaydedilen: ${savedToDb}, Atlanan: ${skipped}, Repost: ${reposted}`);
    })();

    return responsePromise;

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
