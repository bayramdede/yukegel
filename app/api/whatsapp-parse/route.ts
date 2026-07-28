import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../../../lib/auth';
import { structuredLog } from '../../../lib/logger';
// Sohbet ayrıştırma TEK KAYNAKTAN gelir — tarayıcı tarafı (WhatsappYukle.tsx) da
// aynı modülü kullanır. İkisi ayrışırsa mesajlar sessizce kaybolur.
import { parseChatTxt, grupAdiTuret, sohbetTxtSec } from '../../../lib/whatsapp/chatParser';

export const runtime = 'nodejs';
export const maxDuration = 60; // Çoklu ZIP parse + hash + DB batch işlemleri için

// Service-role client — RLS bypass eder. SADECE requireStaff() geçtikten sonra kullanılır.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Basit in-memory rate limit ────────────────────────────────────────────────
// Vercel'de her instance kendi sayacını tutar; amaç mutlak sınır değil, kazara/kötü
// niyetli seri isteklerde tek bir instance'ın DB'yi yormasını engellemek.
const RATE_LIMIT_PENCERE_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const istekGecmisi = new Map<string, number[]>();

function rateLimitAsildi(userId: string): boolean {
  const simdi = Date.now();
  const gecmis = (istekGecmisi.get(userId) || []).filter(t => simdi - t < RATE_LIMIT_PENCERE_MS);
  if (gecmis.length >= RATE_LIMIT_MAX) {
    istekGecmisi.set(userId, gecmis);
    return true;
  }
  gecmis.push(simdi);
  istekGecmisi.set(userId, gecmis);
  // Map'in sınırsız büyümesini engelle
  if (istekGecmisi.size > 500) {
    for (const [k, v] of istekGecmisi) {
      if (v.every(t => simdi - t >= RATE_LIMIT_PENCERE_MS)) istekGecmisi.delete(k);
    }
  }
  return false;
}

// ── Süre bütçesi ──────────────────────────────────────────────────────────────
// Vercel maxDuration 60sn. 60'a dayanınca fonksiyon ÖLDÜRÜLÜR ve platform JSON
// değil HTML hata sayfası döner → frontend'de "Unexpected token" patlaması.
// Bu yüzden 45sn'de kendimiz durup ELİMİZDEKİ sonucu düzgün JSON olarak döneriz;
// `tamamlanmadi: true` görünce istemci kalanı yeniden gönderir (hash dedup
// sayesinde tekrar göndermek güvenli — zaten yazılanlar `skipped` olur).
const SURE_BUTCESI_MS = 45_000;

// PostgREST `.in(...)` filtreyi URL'e gömer. Binlerce hash tek sorguya konunca
// URL onlarca KB'a çıkıyor ve sorgu ya reddediliyor ya da çok yavaşlıyor.
const IN_PARCA_BOYU = 150;

// Supabase bağlantı havuzunu tıkamamak için eşzamanlı istek tavanı.
const ESZAMANLI = 6;

function parcala<T>(dizi: T[], boyut: number): T[][] {
  const parcalar: T[][] = [];
  for (let i = 0; i < dizi.length; i += boyut) parcalar.push(dizi.slice(i, i + boyut));
  return parcalar;
}

/** Sınırlı eşzamanlılıkla çalıştırır. Promise.all(500 istek) havuzu tıkar ve
 *  paralellik sanılan şey sıraya girip toplam süreyi uzatır. */
async function sirayla<T, R>(
  ogeler: T[],
  tavan: number,
  isle: (oge: T) => Promise<R>
): Promise<R[]> {
  const sonuclar: R[] = new Array(ogeler.length);
  let sonraki = 0;
  const isciler = Array.from({ length: Math.min(tavan, ogeler.length) }, async () => {
    for (;;) {
      const i = sonraki++;
      if (i >= ogeler.length) return;
      sonuclar[i] = await isle(ogeler[i]);
    }
  });
  await Promise.all(isciler);
  return sonuclar;
}

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

// NOT: Eskiden burada `repostListings()` vardı — repost tespit edilen mesaj için
// orijinal ilanı listings'e KOPYALIYORDU. Ancak raw_posts INSERT trigger'ı zaten
// parse-listing Edge Function'ı çağırıyor ve o da aynı mesajdan bir ilan üretiyor;
// sonuç: tek mesaj → İKİ ilan. Artık tek üretici parse-listing'dir ve repost
// bayrağını raw_posts.is_repost üzerinden kendisi taşır.

export async function POST(request: NextRequest) {
  // ── 0. Yetki kontrolü ─────────────────────────────────────────────────────
  // Bu route service-role ile raw_posts'a yazıyor ve raw_posts INSERT'i trigger
  // üzerinden listings üretiyor. proxy.ts '/api/' yolunu açık rota saydığı için
  // yetkilendirme burada yapılmak ZORUNDA — aksi halde endpoint herkese açık.
  const yetki = await requireStaff();
  if (!yetki.ok) {
    structuredLog('WARN', 'whatsapp-import', 'Yetkisiz erişim denemesi', {
      output_status: yetki.status,
    });
    return NextResponse.json({ error: yetki.error }, { status: yetki.status });
  }

  if (rateLimitAsildi(yetki.user.id)) {
    return NextResponse.json(
      { error: 'Çok fazla istek — bir dakika bekleyip tekrar dene.' },
      { status: 429 }
    );
  }

  const baslangic = Date.now();

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const saatFiltre = parseInt(formData.get('saat_filtre') as string || '12');
    const cutoff = new Date(Date.now() - saatFiltre * 60 * 60 * 1000);
    const groupName = (formData.get('group_name') as string) ||
      (files[0]?.name ? grupAdiTuret(files[0].name) : '') || 'Bilinmiyor';

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
        const allTxts = Object.keys(zip.files).filter(name => !zip.files[name].dir);
        const chatFile = sohbetTxtSec(allTxts);
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
    let cozulemeyenZaman = 0;
    const rawCandidates: Omit<Candidate, 'hash'>[] = [];
    const debugLog: string[] = [];

    for (const fc of fileContents) {
      // parseChatTxt zaman damgasını sabit +03:00 varsayarak çözer; sunucu (UTC) ile
      // tarayıcı (UTC+3) aynı sonucu üretir. Kendi başımıza new Date('...T..:..')
      // YAPMIYORUZ — o çağrı host saat dilimine göre kayar.
      const { mesajlar, cozulemeyenZaman: cz } = parseChatTxt(fc.content);
      totalMessages += mesajlar.length;
      cozulemeyenZaman += cz;
      for (const msg of mesajlar) {
        if (msg.tarih < cutoff) {
          debugLog.push(`SKIP cutoff: ${msg.timestamp}`);
          continue;
        }
        const msgDate = msg.yerelTarih;
        const msgTimestamp = msg.tarih.toISOString();

        const gate = gatekeeper_sync(msg.message, aliases);
        debugLog.push(`MSG ${msgDate} | isAd=${gate.isAd} score=${gate.score} phones=${gate.phones.length} cities=${gate.cities.join(',')} vehicles=${gate.vehicles.join(',')} | ${msg.message.slice(0, 60).replace(/\n/g, ' ')}`);
        if (!gate.isAd || gate.score < 30) continue;

        rawCandidates.push({ msg, msgDate, msgTimestamp, phone: gate.phones[0] || null, gate });
      }
    }

    if (rawCandidates.length === 0) {
      return NextResponse.json({
        success: true, total_messages: totalMessages,
        unparsed_timestamps: cozulemeyenZaman, passed_gate: 0,
        saved_to_db: 0, skipped: 0, spam_blocked: 0, reposted: 0,
        insert_failed: 0, errors: [] as string[],
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

    // Sorgular PARÇALANARAK atılır: `.in()` filtresi URL'e gömüldüğü için binlerce
    // hash'i tek sorguya koymak URL'i onlarca KB yapıyor ve sorguyu ya patlatıyor
    // ya da dakikalara çıkarıyordu — 60sn timeout'un ana sebeplerinden biri buydu.
    const [mevcutSatirlar, sonSaatTelefonlar] = await Promise.all([
      // 5a. Aynı hash'e sahip tüm mevcut kayıtlar.
      //     (Eski 5c sorgusu KALDIRILDI: repost tespiti için gereken tüm kolonlar
      //      —id, clean_hash, contact_phone, message_date— zaten burada dönüyor.)
      sirayla(parcala(allHashes, IN_PARCA_BOYU), ESZAMANLI, async parca => {
        const { data } = await supabase.from('raw_posts')
          .select('id, clean_hash, message_date, contact_phone')
          .in('clean_hash', parca);
        return data || [];
      }).then(r => r.flat()),
      // 5b. Son 1 saatte bu telefonlardan kaç kayıt var (spam kontrolü)
      allPhones.length === 0 ? Promise.resolve([] as any[]) :
        sirayla(parcala(allPhones, IN_PARCA_BOYU), ESZAMANLI, async parca => {
          const { data } = await supabase.from('raw_posts')
            .select('contact_phone')
            .in('contact_phone', parca)
            .gte('created_at', birSaatOnce);
          return data || [];
        }).then(r => r.flat()),
    ]);

    // Lookup map'leri oluştur (O(1) erişim)
    const existingMap = new Map<string, { id: string; contact_phone: string | null }>();
    // clean_hash üzerinde UNIQUE index var — aynı hash farklı tarihle de yazılamaz.
    // Bu set sayesinde repost adayları insert'e hiç gönderilmez (yoksa her repost
    // 23505 alıp satır-satır retry'a düşüyordu: chunk başına ~100 ekstra istek).
    const mevcutHashler = new Set<string>();
    const phoneSet = new Set(allPhones);
    const repostMap = new Map<string, { id: string; message_date: string }>();

    for (const row of mevcutSatirlar) {
      existingMap.set(`${row.clean_hash}__${row.message_date}`, { id: row.id, contact_phone: row.contact_phone });
      mevcutHashler.add(row.clean_hash);
      // Repost map: (hash + phone) → en son kayıt id'si
      if (row.contact_phone && phoneSet.has(row.contact_phone)) {
        const key = `${row.clean_hash}__${row.contact_phone}`;
        const oncekiKayit = repostMap.get(key);
        if (!oncekiKayit || row.message_date > oncekiKayit.message_date)
          repostMap.set(key, { id: row.id, message_date: row.message_date });
      }
    }

    const phoneCountMap = new Map<string, number>();
    for (const row of sonSaatTelefonlar) {
      if (row.contact_phone)
        phoneCountMap.set(row.contact_phone, (phoneCountMap.get(row.contact_phone) || 0) + 1);
    }

    // ── 6. Her adayı değerlendir ─────────────────────────────────────────────
    let skipped = 0, spamEngel = 0;
    const toInsert: any[] = [];
    const phoneUpdates: Array<{ rawPostId: string; phone: string }> = [];
    const batchKeys = new Set<string>(); // intra-batch dedup: aynı (hash,phone,date) batch içinde çakışmasın
    // batchKey (hash__phone__date) → kopyalanacak kaynak raw_post id'si.
    // Dizi indeksi yerine doğal anahtar kullanılıyor: insert dönüşü eksik/sırasız
    // gelirse indeks eşlemesi kayar ve YANLIŞ ilanlar repost olarak kopyalanırdı.
    const repostPlan = new Map<string, string>();

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
      });

      // Repost meta'sı satırın İÇİNDE taşınmıyor (DB'ye sızmasın diye);
      // insert sonrası doğal anahtarla (hash|phone|date) geri eşleştirilecek.
      if (isRepost && sourceRawPostId) {
        repostPlan.set(batchKey, sourceRawPostId);
      }
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
    // Dönen satırları doğal anahtarla (clean_hash|contact_phone|message_date)
    // geri eşleştiriyoruz — böylece hangi kaydın repost olduğu indekse bağlı kalmıyor.
    const SELECT_KOLONLARI = 'id, clean_hash, contact_phone, message_date';
    const satirAnahtari = (r: { clean_hash: string; contact_phone: string | null; message_date: string }) =>
      `${r.clean_hash}__${r.contact_phone ?? ''}__${r.message_date}`;

    let savedToDb = 0, reposted = 0, insertHatasi = 0;
    const hatalar: string[] = [];
    const eklenenSatirlar: Array<{ id: string; anahtar: string }> = [];

    if (toInsert.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { data: inserted, error } = await supabase
          .from('raw_posts').insert(chunk).select(SELECT_KOLONLARI);

        if (!error) {
          for (const row of inserted || []) eklenenSatirlar.push({ id: row.id, anahtar: satirAnahtari(row) });
          continue;
        }

        // ── Chunk başarısız ───────────────────────────────────────────────────
        // ÖNCEDEN: `continue` deniyordu — tek bir çakışan satır yüzünden chunk'taki
        // 99 geçerli kayıt da sessizce kaybolıyordu. ARTIK: satır satır tekrar
        // denenir, yalnızca gerçekten çakışan satır düşer.
        if (error.code === '23505') {
          const tekTekSonuc = await Promise.all(
            chunk.map(async row => {
              const { data, error: satirHata } = await supabase
                .from('raw_posts').insert(row).select(SELECT_KOLONLARI).maybeSingle();
              if (satirHata || !data) return null;
              return { id: data.id, anahtar: satirAnahtari(data) };
            })
          );
          for (const r of tekTekSonuc) {
            if (r) eklenenSatirlar.push(r);
            else skipped++; // çakışan (zaten var olan) satır — tekrar sayılır
          }
          continue;
        }

        // 23505 dışı hata — sessizce yutma, kullanıcıya bildir
        insertHatasi += chunk.length;
        const mesaj = `Chunk ${Math.floor(i / CHUNK) + 1}: ${error.message}`;
        if (!hatalar.includes(mesaj)) hatalar.push(mesaj);
        structuredLog('ERROR', 'whatsapp-import', 'raw_posts batch insert hatası', {
          output_status: 'error',
          error_code: error.code,
          error_message: error.message,
          chunk_size: chunk.length,
        });
      }

      savedToDb = eklenenSatirlar.length;

      // ── Repost sayımı (anahtar bazlı eşleşme) ──────────────────────────────
      // Sadece RAPORLAMA için sayılır; ilanı trigger → parse-listing üretir ve
      // is_repost bayrağını raw_posts satırından taşır. Dizi indeksi yerine doğal
      // anahtar kullanılıyor: insert dönüşü eksik/sırasız gelirse indeks kayar.
      reposted = eklenenSatirlar.filter(r => repostPlan.has(r.anahtar)).length;
    }

    structuredLog(insertHatasi > 0 ? 'WARN' : 'INFO', 'whatsapp-import', 'ZIP/TXT import tamamlandı', {
      output_status: insertHatasi > 0 ? 'partial' : 'success',
      source_group: groupName,
      file_count: fileContents.length,
      total_messages: totalMessages,
      saved: savedToDb,
      skipped,
      spam_blocked: spamEngel,
      reposted,
      insert_failed: insertHatasi,
      unparsed_timestamps: cozulemeyenZaman,
      duration_ms: Date.now() - baslangic,
    });

    return NextResponse.json({
      success: true,
      total_messages: totalMessages,
      unparsed_timestamps: cozulemeyenZaman,
      passed_gate: candidates.length,
      saved_to_db: savedToDb,
      skipped,
      spam_blocked: spamEngel,
      reposted,
      insert_failed: insertHatasi,
      errors: hatalar,
      cutoff: cutoff.toISOString(),
      saat_filtre: saatFiltre,
      aliases_count: aliases.length,
      debug: debugLog,
    });
  } catch (error: any) {
    structuredLog('ERROR', 'whatsapp-import', 'Import beklenmeyen hata', {
      output_status: 'error',
      error_message: error?.message ?? String(error),
      duration_ms: Date.now() - baslangic,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
