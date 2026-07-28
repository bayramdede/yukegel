import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '../../../lib/auth';
import { structuredLog } from '../../../lib/logger';
// Sohbet ayrıştırma TEK KAYNAKTAN gelir — tarayıcı tarafı (WhatsappYukle.tsx) da
// aynı modülü kullanır. İkisi ayrışırsa mesajlar sessizce kaybolur.
import { parseChatTxt, grupAdiTuret, sohbetTxtSec } from '../../../lib/whatsapp/chatParser';
import { telefonlariCikar } from '../../../lib/whatsapp/telefon';

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

// Sync version — DB çağrısı yok, tüm veriler bellekte
function gatekeeper_sync(message: string, aliases: any[]): { isAd: boolean; score: number; phones: string[]; cities: string[]; vehicles: string[] } {
  const norm = trNorm(message);
  const phones = telefonlariCikar(message);
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
          .select('id, clean_hash, message_date, post_date, contact_phone')
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
    const phoneSet = new Set(allPhones);
    const repostMap = new Map<string, { id: string; message_date: string }>();

    for (const row of mevcutSatirlar) {
      // Anahtar `post_date` üzerinden kurulur, `message_date` üzerinden DEĞİL:
      // benzersizliği dayatan indeks idx_raw_posts_hash_day (clean_hash, post_date).
      // Kod ikisine de aynı değeri yazıyor ama eski satırlarda ayrışmış olabilir;
      // indeksle aynı kolonu kullanmak "önce kontrol ettim, yine de 23505 aldım"
      // durumunu ortadan kaldırır.
      existingMap.set(`${row.clean_hash}__${row.post_date}`, { id: row.id, contact_phone: row.contact_phone });
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
    // Batch-içi dedup anahtarı DB'nin GERÇEK unique indeksiyle aynı olmalı:
    //   idx_raw_posts_hash_day UNIQUE (clean_hash, post_date) WHERE clean_hash IS NOT NULL
    // ÖNCEDEN anahtar (hash,phone,date) idi → telefon içerdiği için, aynı gün
    // aynı metni FARKLI iki kişi paylaştığında uygulama bunları ayrı satır sanıyor,
    // DB ise 23505 ile TÜM chunk'ı reddediyordu. Nakliye gruplarında aynı yükün
    // iletilmesi çok yaygın olduğu için 23505 fırtınasının asıl kaynağı buydu.
    const batchKeys = new Set<string>();
    // batchKey (hash__phone__date) → kopyalanacak kaynak raw_post id'si.
    // Dizi indeksi yerine doğal anahtar kullanılıyor: insert dönüşü eksik/sırasız
    // gelirse indeks eşlemesi kayar ve YANLIŞ ilanlar repost olarak kopyalanırdı.
    const repostPlan = new Map<string, string>();

    for (const c of candidates) {
      const exactKey = `${c.hash}__${c.msgDate}`;
      const exactMatch = existingMap.get(exactKey);
      if (exactMatch) {
        skipped++;
        continue;
      }

      if (c.phone && (phoneCountMap.get(c.phone) || 0) >= spamEsik) {
        spamEngel++;
        continue;
      }

      const dedupAnahtari = `${c.hash}__${c.msgDate}`;      // DB unique indeksiyle birebir
      if (batchKeys.has(dedupAnahtari)) { skipped++; continue; }
      batchKeys.add(dedupAnahtari);
      // Insert dönüşünü geri eşlemek için kullanılan anahtar AYRI: PostgREST
      // yalnızca yazdığı kolonları döndürdüğü için telefonu da içermesi gerekiyor.
      const satirAnahtar = `${c.hash}__${c.phone ?? ''}__${c.msgDate}`;

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
        repostPlan.set(satirAnahtar, sourceRawPostId);
      }
    }

    // ── 7. (KALDIRILDI) Telefon geriye-doldurma ──────────────────────────────
    // Burada, mevcut ama `contact_phone`'u boş olan satırlara telefon yazılıyordu.
    // İçe aktarmanın DOĞRULUĞUNU hiç etkilemiyor (yeni satırlar telefonu zaten
    // dolu geliyor) ama satır başına 2 UPDATE atıyor ve tam da süre bütçesinin
    // dolduğu yerde duruyordu. Ayrı bir işe taşındı:
    //   POST /api/raw-posts/telefon-doldur
    // Orası içe aktarma bağlamına ihtiyaç duymaz — `contact_phone IS NULL` olan
    // satırları kendisi bulup `raw_text`'ten telefonu yeniden çıkarır.

    // ── 8. Yeni kayıtları BATCH INSERT (100'lük chunk'lar) ───────────────────
    // Dönen satırları doğal anahtarla (clean_hash|contact_phone|message_date)
    // geri eşleştiriyoruz — böylece hangi kaydın repost olduğu indekse bağlı kalmıyor.
    const SELECT_KOLONLARI = 'id, clean_hash, contact_phone, message_date';
    const satirAnahtari = (r: { clean_hash: string; contact_phone: string | null; message_date: string }) =>
      `${r.clean_hash}__${r.contact_phone ?? ''}__${r.message_date}`;

    let savedToDb = 0, reposted = 0, insertHatasi = 0;
    let tamamlanmadi = false, islenmeyen = 0;
    const hatalar: string[] = [];
    const eklenenSatirlar: Array<{ id: string; anahtar: string }> = [];

    if (toInsert.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        // ── Süre bütçesi ──────────────────────────────────────────────────────
        // Bütçe dolduysa DUR. Vercel'in bizi 60sn'de öldürmesi HTML hata sayfası
        // döndürüyor ve o ana kadar yazdıklarımız hakkında hiçbir bilgi kalmıyordu.
        // Böyle çıkınca elimizdeki sayaçlar düzgün JSON olarak gidiyor.
        if (Date.now() - baslangic > SURE_BUTCESI_MS) {
          tamamlanmadi = true;
          islenmeyen = toInsert.length - i;
          structuredLog('WARN', 'whatsapp-import', 'Süre bütçesi doldu — kısmi kayıt', {
            output_status: 'partial',
            processed: i,
            remaining: islenmeyen,
            duration_ms: Date.now() - baslangic,
          });
          break;
        }

        const chunk = toInsert.slice(i, i + CHUNK);
        const { data: inserted, error } = await supabase
          .from('raw_posts').insert(chunk).select(SELECT_KOLONLARI);

        if (!error) {
          for (const row of inserted || []) eklenenSatirlar.push({ id: row.id, anahtar: satirAnahtari(row) });
          continue;
        }

        // ── Chunk başarısız ───────────────────────────────────────────────────
        // En eski hali `continue` diyordu → tek çakışma yüzünden 99 geçerli kayıt
        // sessizce kayboluyordu. Sonraki hali satır satır retry ediyordu → çakışma
        // yoğun olduğunda chunk başına ~100 ekstra istek çıkarıp 60sn'i yiyordu.
        // ŞİMDİ: tek sorguyla "hangileri zaten var" öğrenilir, sadece kalanlar
        // yeniden denenir → çakışan chunk başına 100 istek yerine 2 istek.
        //
        // Çakışma testi (clean_hash, post_date) ÇİFTİ üzerinden yapılır — tek başına
        // `clean_hash` DEĞİL. Gerçek indeks idx_raw_posts_hash_day (clean_hash, post_date);
        // sadece hash'e bakmak, aynı içeriğin BAŞKA bir güne ait meşru repost'unu da
        // "zaten var" sayıp sessizce eler.
        if (error.code === '23505') {
          const { data: cakisanlar } = await supabase
            .from('raw_posts').select('clean_hash, post_date')
            .in('clean_hash', chunk.map(r => r.clean_hash));
          const cakisanSet = new Set(
            (cakisanlar || []).map(r => `${r.clean_hash}__${r.post_date}`),
          );
          const kalan = chunk.filter(r => !cakisanSet.has(`${r.clean_hash}__${r.post_date}`));
          skipped += chunk.length - kalan.length;

          if (kalan.length === 0) continue;

          const { data: ikinciDeneme, error: ikinciHata } = await supabase
            .from('raw_posts').insert(kalan).select(SELECT_KOLONLARI);

          if (!ikinciHata) {
            for (const row of ikinciDeneme || []) eklenenSatirlar.push({ id: row.id, anahtar: satirAnahtari(row) });
            continue;
          }

          // Hâlâ çakışıyor → unique kısıt `clean_hash`ten farklı bir kolon setinde.
          // Son çare: satır satır, ama TAVANLI ve süre bütçesine tabi.
          const tekTekSonuc = await sirayla(kalan, ESZAMANLI, async row => {
            if (Date.now() - baslangic > SURE_BUTCESI_MS) return 'butce' as const;
            const { data, error: satirHata } = await supabase
              .from('raw_posts').insert(row).select(SELECT_KOLONLARI).maybeSingle();
            if (satirHata || !data) return null;
            return { id: data.id, anahtar: satirAnahtari(data) };
          });
          for (const r of tekTekSonuc) {
            if (r === 'butce') { islenmeyen++; tamamlanmadi = true; }
            else if (r) eklenenSatirlar.push(r);
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

    structuredLog(insertHatasi > 0 || tamamlanmadi ? 'WARN' : 'INFO', 'whatsapp-import', 'ZIP/TXT import tamamlandı', {
      output_status: insertHatasi > 0 || tamamlanmadi ? 'partial' : 'success',
      tamamlanmadi,
      unprocessed: islenmeyen,
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
      // İstemci bunu görünce aynı grubu tekrar gönderir: hash dedup sayesinde
      // yeniden gönderim güvenli, zaten yazılmış olanlar `skipped` olarak döner.
      tamamlanmadi,
      islenmeyen,
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
