import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanHash(text: string): Promise<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function normalizeArrows(s: string): string {
  return (s || '')
    .replace(/➡️?|→|--?>|==>/g, ' -> ')
    .replace(/⬅️?|←/g, ' <- ')
    .replace(/\s+/g, ' ').trim();
}

function trNorm(s: string): string {
  return normalizeArrows(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .toLowerCase()
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's')
    .replace(/ü/g, 'u').replace(/â/g, 'a').replace(/î/g, 'i')
    .replace(/û/g, 'u').replace(/[^a-z0-9\s\.>-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractPhones(text: string): string[] {
  const phones: string[] = [];
  const t = text
    .replace(/\+\s*9\s*0\s*/g, '0')
    .replace(/[()]/g, ' ');
  const re = /0\s*5(?:\s*\d){9}/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('05')) {
      phones.push(digits);
    }
  }
  return [...new Set(phones)];
}

function parseChatTxt(content: string): Array<{ sender: string; timestamp: string; message: string }> {
  const lines = content.split('\n');
  const messages: Array<{ sender: string; timestamp: string; message: string }> = [];
  const patternAndroid = /^\[(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)\]\s(.+?):\s(.*)$/;
  const patternIOS    = /^(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2})\s?-\s(.+?):\s(.*)$/;
  let current: { sender: string; timestamp: string; lines: string[] } | null = null;
  const SISTEM = ['katıldı', 'ekledi', 'çıkardı', 'ayrıldı', 'silindi', 'şifreli', 'güvenlik kodu',
    'değiştirdi', 'e-fatura', 'gider fişi', 'medya dahil edilmedi', 'bu mesaj silindi',
    'süreli mesajlar', 'uçtan uca', 'missed voice call', 'missed video call', 'this message was deleted'];
  for (const line of lines) {
    const trimmed = line.replace(/[\u200e\u202a\u202c\u200f\u200b]/g, '').trim();
    if (!trimmed) continue;
    const match = patternAndroid.exec(trimmed) || patternIOS.exec(trimmed);
    if (match) {
      if (current && current.lines.length > 0) {
        const msg = current.lines.join('\n').trim();
        if (!SISTEM.some(s => msg.toLowerCase().includes(s)) && msg.length > 10)
          messages.push({ sender: current.sender, timestamp: current.timestamp, message: msg });
      }
      current = { sender: match[2].trim(), timestamp: match[1], lines: [match[3]] };
    } else if (current) {
      current.lines.push(trimmed);
    }
  }
  if (current && current.lines.length > 0) {
    const msg = current.lines.join('\n').trim();
    if (!SISTEM.some(s => msg.toLowerCase().includes(s)) && msg.length > 10)
      messages.push({ sender: current.sender, timestamp: current.timestamp, message: msg });
  }
  return messages;
}

// Sync version — DB çağrısı yok, tüm veriler bellekte
function gatekeeper_sync(message: string, aliases: any[]): { isAd: boolean; score: number; phones: string[]; cities: string[]; vehicles: string[] } {
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
    if (norm.includes(aliasNorm) || norm.split(' ').includes(aliasNorm))
      if (!foundCities.includes(ca.normalized)) foundCities.push(ca.normalized);
  }
  const vehicleAliases = aliases.filter(a => a.type === 'vehicle');
  const foundVehicles: string[] = [];
  for (const va of vehicleAliases) {
    if (norm.includes(trNorm(va.alias)))
      if (!foundVehicles.includes(va.normalized)) foundVehicles.push(va.normalized);
  }
  let score = 0;
  score += phones.length > 0 ? 40 : 0;
  score += foundVehicles.length > 0 ? 30 : 0;
  score += foundCities.length >= 2 ? 20 : foundCities.length === 1 ? 10 : 0;
  score += foundCities.length >= 2 && foundVehicles.length > 0 ? 10 : 0;
  const isAd = phones.length > 0 && (foundVehicles.length > 0 || foundCities.length >= 2);
  return { isAd, score, phones, cities: foundCities, vehicles: foundVehicles };
}

async function repostListings(sourceRawPostId: string, newRawPostId: string): Promise<void> {
  const { data: originalListings } = await supabase.from('listings').select('*, listing_stops(*)').eq('raw_post_id', sourceRawPostId);
  if (!originalListings || originalListings.length === 0) return;
  for (const original of originalListings) {
    const stops = original.listing_stops || [];
    const { listing_stops, id, created_at, updated_at, ...listingFields } = original;
    const { data: newListing } = await supabase.from('listings').insert({ ...listingFields, raw_post_id: newRawPostId, is_repost: true, moderation_status: 'pending', status: 'active', created_at: new Date().toISOString() }).select().single();
    if (!newListing) continue;
    for (const stop of stops) {
      const { id: stopId, listing_id, created_at: stopCreated, ...stopFields } = stop;
      await supabase.from('listing_stops').insert({ ...stopFields, listing_id: newListing.id });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const saatFiltre = parseInt(formData.get('saat_filtre') as string || '12');
    const cutoff = new Date(Date.now() - saatFiltre * 60 * 60 * 1000);
    const groupName = (formData.get('group_name') as string) ||
      files[0]?.name
        .replace(/\.zip$/i, '').replace(/\.txt$/i, '')
        .replace(/WhatsApp Sohbeti - /i, '').replace(/WhatsApp Chat - /i, '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u200e\u202a\u202c\u200f\u200b]/g, '')
        .replace(/\s+/g, ' ').trim() || 'Bilinmiyor';

    if (!files || files.length === 0)
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });

    // ── 1. Dosyaları oku ──────────────────────────────────────────────────────
    const fileContents: { name: string; content: string }[] = [];
    for (const file of files) {
      let content = '';
      if (file.name.endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const allTxts = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.toLowerCase().endsWith('.txt'));
        const chatFile = allTxts.find(n => n.toLowerCase().includes('_chat')) ||
                         allTxts.find(n => n.toLowerCase().includes('chat')) ||
                         allTxts.find(n => n.toLowerCase().includes('sohbet')) ||
                         (allTxts.length === 1 ? allTxts[0] : null);
        if (!chatFile) continue;
        content = await zip.files[chatFile].async('string');
      } else if (file.name.endsWith('.txt')) {
        content = new TextDecoder('utf-8').decode(await file.arrayBuffer());
      } else continue;
      fileContents.push({ name: file.name, content });
    }

    // ── 2. DB'den aliases + config'i PARALEL çek (tek seferlik) ──────────────
    const [aliasesRes, configRes] = await Promise.all([
      supabase.from('aliases').select('*').eq('is_active', true),
      supabase.from('system_config').select('value').eq('key', 'spam_threshold').single(),
    ]);
    const aliases = aliasesRes.data || [];
    const spamEsik: number = configRes.data?.value?.max_listings_per_hour ?? 3;

    // ── 3. Tüm mesajları parse et + gatekeeper (tamamen in-memory, DB yok) ───
    type Candidate = {
      msg: { sender: string; timestamp: string; message: string };
      msgDate: string;
      msgTimestamp: string;
      hash: string;
      phone: string | null;
      gate: { isAd: boolean; score: number; phones: string[]; cities: string[]; vehicles: string[] };
    };

    let totalMessages = 0;
    const rawCandidates: Omit<Candidate, 'hash'>[] = [];
    const debugLog: string[] = [];

    for (const fc of fileContents) {
      const messages = parseChatTxt(fc.content);
      totalMessages += messages.length;
      for (const msg of messages) {
        let msgDate = '';
        let msgTimestamp = new Date().toISOString();
        try {
          const tsClean = msg.timestamp.replace(',', '').replace(/\s+/g, ' ').trim();
          const tsParts = tsClean.split(' ');
          if (tsParts.length < 2) { debugLog.push(`SKIP ts_split: ${msg.timestamp}`); continue; }
          const [datePart, timePart] = tsParts;
          const dateSplit = datePart.split('.');
          if (dateSplit.length < 3) { debugLog.push(`SKIP date_split: ${datePart}`); continue; }
          const [day, month, year] = dateSplit;
          const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          const d = new Date(`${isoDate}T${timePart}`);
          if (isNaN(d.getTime())) { debugLog.push(`SKIP invalid_date: ${isoDate}T${timePart}`); continue; }
          if (d < cutoff) { debugLog.push(`SKIP cutoff: ${isoDate}T${timePart}`); continue; }
          msgDate = isoDate;
          msgTimestamp = d.toISOString();
        } catch (e: any) { debugLog.push(`SKIP ts_error: ${e.message}`); continue; }

        const gate = gatekeeper_sync(msg.message, aliases);
        debugLog.push(`MSG ${msgDate} | isAd=${gate.isAd} score=${gate.score} phones=${gate.phones.length} cities=${gate.cities.join(',')} vehicles=${gate.vehicles.join(',')} | ${msg.message.slice(0, 60).replace(/\n/g, ' ')}`);
        if (!gate.isAd || gate.score < 30) continue;

        rawCandidates.push({ msg, msgDate, msgTimestamp, phone: gate.phones[0] || null, gate });
      }
    }

    if (rawCandidates.length === 0) {
      return NextResponse.json({
        success: true, total_messages: totalMessages, passed_gate: 0,
        saved_to_db: 0, skipped: 0, spam_blocked: 0, reposted: 0,
        cutoff: cutoff.toISOString(), saat_filtre: saatFiltre,
        aliases_count: aliases.length, debug: debugLog,
      });
    }

    // ── 4. Hash'leri PARALEL hesapla ─────────────────────────────────────────
    const candidates: Candidate[] = await Promise.all(
      rawCandidates.map(async c => ({ ...c, hash: await cleanHash(c.msg.message) }))
    );

    // ── 5. BATCH DB sorguları (3 sorgu toplam) ────────────────────────────────
    const allHashes = [...new Set(candidates.map(c => c.hash))];
    const allPhones = [...new Set(candidates.map(c => c.phone).filter(Boolean) as string[])];
    const birSaatOnce = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [existingPostsRes, recentByPhoneRes, repostCandidatesRes] = await Promise.all([
      // 5a. Aynı hash'e sahip tüm mevcut kayıtlar
      supabase.from('raw_posts')
        .select('id, clean_hash, message_date, contact_phone')
        .in('clean_hash', allHashes),
      // 5b. Son 1 saatte bu telefonlardan kaç kayıt var (spam kontrolü)
      allPhones.length > 0
        ? supabase.from('raw_posts')
            .select('contact_phone')
            .in('contact_phone', allPhones)
            .gte('created_at', birSaatOnce)
        : Promise.resolve({ data: [] as any[], error: null }),
      // 5c. Repost tespiti: aynı hash + aynı telefon ama farklı tarih
      allPhones.length > 0
        ? supabase.from('raw_posts')
            .select('id, clean_hash, contact_phone, message_date')
            .in('clean_hash', allHashes)
            .in('contact_phone', allPhones)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    // Lookup map'leri oluştur (O(1) erişim)
    const existingMap = new Map<string, { id: string; contact_phone: string | null }>();
    for (const row of existingPostsRes.data || []) {
      existingMap.set(`${row.clean_hash}__${row.message_date}`, { id: row.id, contact_phone: row.contact_phone });
    }

    const phoneCountMap = new Map<string, number>();
    for (const row of recentByPhoneRes.data || []) {
      if (row.contact_phone)
        phoneCountMap.set(row.contact_phone, (phoneCountMap.get(row.contact_phone) || 0) + 1);
    }

    // Repost map: (hash + phone) → en son kayıt id'si
    const repostMap = new Map<string, { id: string; message_date: string }>();
    for (const row of repostCandidatesRes.data || []) {
      const key = `${row.clean_hash}__${row.contact_phone}`;
      const existing = repostMap.get(key);
      if (!existing || row.message_date > existing.message_date)
        repostMap.set(key, { id: row.id, message_date: row.message_date });
    }

    // ── 6. Her adayı değerlendir ─────────────────────────────────────────────
    let skipped = 0, spamEngel = 0;
    const toInsert: any[] = [];
    const phoneUpdates: Array<{ rawPostId: string; phone: string }> = [];
    const batchKeys = new Set<string>(); // intra-batch dedup: aynı (hash,phone,date) batch içinde çakışmasın

    for (const c of candidates) {
      const exactKey = `${c.hash}__${c.msgDate}`;
      const exactMatch = existingMap.get(exactKey);
      if (exactMatch) {
        if (!exactMatch.contact_phone && c.phone) {
          phoneUpdates.push({ rawPostId: exactMatch.id, phone: c.phone });
          debugLog.push(`PHONE_UPDATE queued: ${exactMatch.id} → ${c.phone}`);
        }
        skipped++;
        continue;
      }

      if (c.phone && (phoneCountMap.get(c.phone) || 0) >= spamEsik) {
        spamEngel++;
        continue;
      }

      const batchKey = `${c.hash}__${c.phone ?? ''}__${c.msgDate}`;
      if (batchKeys.has(batchKey)) { skipped++; continue; }
      batchKeys.add(batchKey);

      let isRepost = false;
      let sourceRawPostId: string | null = null;
      if (c.phone) {
        const repostKey = `${c.hash}__${c.phone}`;
        const prev = repostMap.get(repostKey);
        if (prev && prev.message_date !== c.msgDate) {
          isRepost = true;
          sourceRawPostId = prev.id;
        }
      }

      toInsert.push({
        source: 'whatsapp',
        source_group: groupName,
        sender_name: c.msg.sender,
        raw_text: c.msg.message,
        clean_hash: c.hash,
        contact_phone: c.phone,
        is_repost: isRepost,
        source_raw_post_id: sourceRawPostId,
        message_timestamp: c.msgTimestamp,
        quality_score: c.gate.score,
        processing_status: 'pending',
        detected_ad_count: 1,
        message_date: c.msgDate,
        post_date: c.msgDate,
        // geçici meta — insert sonrası repost için, DB'ye gitmez
        _sourceRawPostId: sourceRawPostId,
        _isRepost: isRepost,
      });
    }

    // ── 7. Phone güncellemelerini PARALEL yap ────────────────────────────────
    if (phoneUpdates.length > 0) {
      await Promise.all(phoneUpdates.map(u =>
        Promise.all([
          supabase.from('raw_posts').update({ contact_phone: u.phone }).eq('id', u.rawPostId),
          supabase.from('listings').update({ contact_phone: u.phone }).eq('raw_post_id', u.rawPostId),
        ])
      ));
    }

    // ── 8. Yeni kayıtları BATCH INSERT (100'lük chunk'lar) ───────────────────
    let savedToDb = 0, reposted = 0;
    if (toInsert.length > 0) {
      const repostMeta = toInsert.map(r => ({ sourceRawPostId: r._sourceRawPostId, isRepost: r._isRepost }));
      const cleanRows = toInsert.map(({ _sourceRawPostId, _isRepost, ...rest }) => rest);

      const CHUNK = 100;
      for (let i = 0; i < cleanRows.length; i += CHUNK) {
        const chunk = cleanRows.slice(i, i + CHUNK);
        const meta = repostMeta.slice(i, i + CHUNK);
        const { data: inserted, error } = await supabase.from('raw_posts').insert(chunk).select('id');
        if (error) {
          if (error.code !== '23505') console.error('batch insert hatası:', error.message);
          continue;
        }
        savedToDb += (inserted || []).length;

        // Repost olanlar için listing kopyala (paralel)
        await Promise.all(
          (inserted || []).map((row, idx) => {
            const m = meta[idx];
            if (m.isRepost && m.sourceRawPostId) {
              reposted++;
              return repostListings(m.sourceRawPostId, row.id);
            }
            return Promise.resolve();
          })
        );
      }
    }

    return NextResponse.json({
      success: true,
      total_messages: totalMessages,
      passed_gate: savedToDb + skipped,
      saved_to_db: savedToDb,
      skipped,
      spam_blocked: spamEngel,
      reposted,
      cutoff: cutoff.toISOString(),
      saat_filtre: saatFiltre,
      aliases_count: aliases.length,
      debug: debugLog,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
