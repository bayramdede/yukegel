import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  // Önce tüm metinden sadece rakamları içeren olası telefon bölgelerini bul
  const cleaned = text.replace(/[\s\-\.\(\)]/g, '');
  const phones: string[] = [];
  
  // 05xx formatı
  const matches1 = text.match(/0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || [];
  // +905xx formatı  
  const matches2 = text.match(/\+?\s*9\s*0\s*5\s*\d[\s\.\-]?\d{2}[\s\.\-]?\d{3}[\s\.\-]?\d{2}[\s\.\-]?\d{2}/g) || [];
  // Emoji arasındaki numaralar — sadece rakam dizisi
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
function parseChatTxt(content: string): Array<{sender: string, timestamp: string, message: string}> {
  const lines = content.split('\n');
  const messages: Array<{sender: string, timestamp: string, message: string}> = [];
  
  // Format: [GG.AA.YYYY SS:DD:SS] İsim: Mesaj
  const pattern = /^\[(\d{1,2}\.\d{1,2}\.\d{4}\s\d{1,2}:\d{1,2}:\d{1,2})\]\s(.+?):\s(.*)$/;
  
  let current: {sender: string, timestamp: string, lines: string[]} | null = null;

  const SISTEM_MESAJLARI = [
    'katıldı', 'ekledi', 'çıkardı', 'ayrıldı', 'silindi',
    'şifreli', 'güvenlik kodu', 'değiştirdi', 'e-fatura',
    'gider fişi', 'medya dahil edilmedi', 'bu mesaj silindi',
    'süreli mesajlar', 'uçtan uca'
  ];

  for (const line of lines) {
    const trimmed = line.replace(/[\u200e\u202a\u202c]/g, '').trim();
    if (!trimmed) continue;

    const match = pattern.exec(trimmed);
    if (match) {
      // Önceki mesajı kaydet
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

  // Son mesajı kaydet
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
  isAd: boolean, score: number, phones: string[], cities: string[], vehicles: string[]
}> {
  const norm = trNorm(message);
  const phones = extractPhones(message);

  // Kara liste kontrolü
  const blacklist = aliases.filter(a => a.type === 'blacklist').map(a => trNorm(a.alias));
  for (const bl of blacklist) {
    if (norm.includes(bl)) return { isAd: false, score: 0, phones: [], cities: [], vehicles: [] };
  }

  // Şehir tespiti
  const cityAliases = aliases.filter(a => a.type === 'city');
  const foundCities: string[] = [];
  for (const ca of cityAliases) {
    const aliasNorm = trNorm(ca.alias);
    if (norm.includes(aliasNorm) || norm.split(' ').includes(aliasNorm)) {
      if (!foundCities.includes(ca.normalized)) foundCities.push(ca.normalized);
    }
  }

  // Araç tipi tespiti
  const vehicleAliases = aliases.filter(a => a.type === 'vehicle');
  const foundVehicles: string[] = [];
  for (const va of vehicleAliases) {
    if (norm.includes(trNorm(va.alias))) {
      if (!foundVehicles.includes(va.normalized)) foundVehicles.push(va.normalized);
    }
  }

  // Skor hesapla
  let score = 0;
  score += phones.length > 0 ? 40 : 0;
  score += foundVehicles.length > 0 ? 30 : 0;
  score += foundCities.length >= 2 ? 20 : foundCities.length === 1 ? 10 : 0;
  score += foundCities.length >= 2 && foundVehicles.length > 0 ? 10 : 0;

  const isAd = phones.length > 0 && (foundVehicles.length > 0 || foundCities.length >= 2);

  return { isAd, score, phones, cities: foundCities, vehicles: foundVehicles };
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
        .replace(/WhatsApp Sohbeti - /i, '')
        .replace(/WhatsApp Chat - /i, '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u200e\u202a\u202c\u200f\u200b]/g, '')
        .replace(/\s+/g, ' ').trim()
    || 'Bilinmiyor';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
    }

    // Dosyaları belleğe al (stream kapanmadan önce)
    const fileContents: { name: string; content: string }[] = [];
    for (const file of files) {
      let content = '';
      if (file.name.endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        const chatFile = Object.keys(zip.files).find(name =>
          name.toLowerCase().includes('chat') && name.toLowerCase().endsWith('.txt')
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

    // Toplam mesaj sayısını hızlıca hesapla (tahmini)
    let totalMessages = 0;
    for (const fc of fileContents) {
      totalMessages += parseChatTxt(fc.content).length;
    }

    // Hemen response dön — arka planda işlemeye devam et
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
      let passedGate = 0;
      let savedToDb = 0;

      for (const fc of fileContents) {
        const messages = parseChatTxt(fc.content);

        for (const msg of messages) {
          // Tarih kontrolü
          try {
            const [date, time] = msg.timestamp.split(' ');
            const [day, month, year] = date.split('.');
            const msgDate = new Date(`${year}-${month}-${day}T${time}`);
            if (msgDate < cutoff) continue;
          } catch { /* devam */ }

          const gate = await gatekeeper(msg.message, aliases || []);
          if (!gate.isAd || gate.score < 30) continue;
          passedGate++;

          const { error } = await supabase.from('raw_posts').insert({
            source: 'whatsapp',
            source_group: groupName,
            sender_name: msg.sender,
            raw_text: msg.message,
            message_timestamp: (() => {
              try {
                const [date, time] = msg.timestamp.split(' ');
                const [day, month, year] = date.split('.');
                return new Date(`${year}-${month}-${day}T${time}`).toISOString();
              } catch { return new Date().toISOString(); }
            })(),
            quality_score: gate.score,
            processing_status: 'pending',
            detected_ad_count: 1,
            message_date: (() => {
              try {
                const [date] = msg.timestamp.split(' ');
                const [day, month, year] = date.split('.');
                return `${year}-${month}-${day}`;
              } catch { return new Date().toISOString().split('T')[0]; }
            })(),
          });

          // Duplicate ise sessizce atla (unique index ihlali)
          if (!error || error.code === '23505') {
            if (!error) savedToDb++;
          }
        }
      }
    })();

    return responsePromise;

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}