import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServiceSupabase } from '../../../../lib/auth';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────
// Türkiye 81 il merkez koordinatları — coğrafi kısıtlama için
// ─────────────────────────────────────────────────────────────
const IL_KOORDINAT: Record<string, { lat: number; lng: number; radius: number }> = {
  'Adana':          { lat: 37.0000, lng: 35.3213, radius: 80000 },
  'Adıyaman':       { lat: 37.7648, lng: 38.2786, radius: 60000 },
  'Afyonkarahisar': { lat: 38.7507, lng: 30.5567, radius: 80000 },
  'Ağrı':           { lat: 39.7191, lng: 43.0503, radius: 80000 },
  'Amasya':         { lat: 40.6499, lng: 35.8353, radius: 60000 },
  'Ankara':         { lat: 39.9334, lng: 32.8597, radius: 80000 },
  'Antalya':        { lat: 36.8969, lng: 30.7133, radius: 80000 },
  'Artvin':         { lat: 41.1828, lng: 41.8183, radius: 50000 },
  'Aydın':          { lat: 37.8444, lng: 27.8458, radius: 70000 },
  'Balıkesir':      { lat: 39.6484, lng: 27.8826, radius: 80000 },
  'Bilecik':        { lat: 40.1508, lng: 29.9792, radius: 50000 },
  'Bingöl':         { lat: 38.8847, lng: 40.4983, radius: 60000 },
  'Bitlis':         { lat: 38.4006, lng: 42.1095, radius: 60000 },
  'Bolu':           { lat: 40.5760, lng: 31.5788, radius: 60000 },
  'Burdur':         { lat: 37.7203, lng: 30.2906, radius: 60000 },
  'Bursa':          { lat: 40.1826, lng: 29.0665, radius: 70000 },
  'Çanakkale':      { lat: 40.1553, lng: 26.4142, radius: 70000 },
  'Çankırı':        { lat: 40.6013, lng: 33.6134, radius: 60000 },
  'Çorum':          { lat: 40.5506, lng: 34.9556, radius: 70000 },
  'Denizli':        { lat: 37.7765, lng: 29.0864, radius: 70000 },
  'Diyarbakır':     { lat: 37.9144, lng: 40.2306, radius: 80000 },
  'Edirne':         { lat: 41.6818, lng: 26.5623, radius: 60000 },
  'Elazığ':         { lat: 38.6810, lng: 39.2264, radius: 60000 },
  'Erzincan':       { lat: 39.7500, lng: 39.5000, radius: 70000 },
  'Erzurum':        { lat: 39.9000, lng: 41.2700, radius: 80000 },
  'Eskişehir':      { lat: 39.7767, lng: 30.5206, radius: 70000 },
  'Gaziantep':      { lat: 37.0662, lng: 37.3833, radius: 70000 },
  'Giresun':        { lat: 40.9128, lng: 38.3895, radius: 60000 },
  'Gümüşhane':      { lat: 40.4386, lng: 39.4814, radius: 60000 },
  'Hakkari':        { lat: 37.5744, lng: 43.7408, radius: 50000 },
  'Hatay':          { lat: 36.4018, lng: 36.3498, radius: 70000 },
  'Isparta':        { lat: 37.7648, lng: 30.5566, radius: 60000 },
  'Mersin':         { lat: 36.8000, lng: 34.6333, radius: 80000 },
  'İstanbul':       { lat: 41.0082, lng: 28.9784, radius: 50000 },
  'İzmir':          { lat: 38.4192, lng: 27.1287, radius: 70000 },
  'Kars':           { lat: 40.6013, lng: 43.0975, radius: 60000 },
  'Kastamonu':      { lat: 41.3887, lng: 33.7827, radius: 70000 },
  'Kayseri':        { lat: 38.7312, lng: 35.4787, radius: 70000 },
  'Kırklareli':     { lat: 41.7333, lng: 27.2167, radius: 60000 },
  'Kırşehir':       { lat: 39.1425, lng: 34.1709, radius: 60000 },
  'Kocaeli':        { lat: 40.8533, lng: 29.8815, radius: 50000 },
  'Konya':          { lat: 37.8714, lng: 32.4846, radius: 100000 },
  'Kütahya':        { lat: 39.4242, lng: 29.9833, radius: 70000 },
  'Malatya':        { lat: 38.3552, lng: 38.3095, radius: 70000 },
  'Manisa':         { lat: 38.6191, lng: 27.4289, radius: 70000 },
  'Kahramanmaraş':  { lat: 37.5858, lng: 36.9371, radius: 70000 },
  'Mardin':         { lat: 37.3212, lng: 40.7245, radius: 70000 },
  'Muğla':          { lat: 37.2153, lng: 28.3636, radius: 80000 },
  'Muş':            { lat: 38.7462, lng: 41.5064, radius: 60000 },
  'Nevşehir':       { lat: 38.6939, lng: 34.6857, radius: 60000 },
  'Niğde':          { lat: 37.9667, lng: 34.6833, radius: 60000 },
  'Ordu':           { lat: 40.9839, lng: 37.8764, radius: 60000 },
  'Rize':           { lat: 41.0201, lng: 40.5234, radius: 50000 },
  'Sakarya':        { lat: 40.6940, lng: 30.4358, radius: 60000 },
  'Samsun':         { lat: 41.2867, lng: 36.3300, radius: 70000 },
  'Siirt':          { lat: 37.9333, lng: 41.9500, radius: 60000 },
  'Sinop':          { lat: 42.0231, lng: 35.1531, radius: 50000 },
  'Sivas':          { lat: 39.7477, lng: 37.0179, radius: 80000 },
  'Tekirdağ':       { lat: 40.9833, lng: 27.5167, radius: 70000 },
  'Tokat':          { lat: 40.3167, lng: 36.5500, radius: 70000 },
  'Trabzon':        { lat: 41.0015, lng: 39.7178, radius: 60000 },
  'Tunceli':        { lat: 39.1079, lng: 39.5482, radius: 50000 },
  'Şanlıurfa':      { lat: 37.1591, lng: 38.7969, radius: 80000 },
  'Uşak':           { lat: 38.6823, lng: 29.4082, radius: 60000 },
  'Van':            { lat: 38.4942, lng: 43.3800, radius: 80000 },
  'Yozgat':         { lat: 39.8181, lng: 34.8147, radius: 70000 },
  'Zonguldak':      { lat: 41.4564, lng: 31.7987, radius: 60000 },
  'Aksaray':        { lat: 38.3687, lng: 34.0370, radius: 60000 },
  'Bayburt':        { lat: 40.2552, lng: 40.2249, radius: 50000 },
  'Karaman':        { lat: 37.1759, lng: 33.2287, radius: 60000 },
  'Kırıkkale':      { lat: 39.8468, lng: 33.5153, radius: 50000 },
  'Batman':         { lat: 37.8812, lng: 41.1351, radius: 60000 },
  'Şırnak':         { lat: 37.5164, lng: 42.4611, radius: 60000 },
  'Bartın':         { lat: 41.6344, lng: 32.3375, radius: 50000 },
  'Ardahan':        { lat: 41.1105, lng: 42.7022, radius: 50000 },
  'Iğdır':          { lat: 39.9167, lng: 44.0450, radius: 50000 },
  'Yalova':         { lat: 40.6500, lng: 29.2667, radius: 40000 },
  'Karabük':        { lat: 41.2061, lng: 32.6204, radius: 50000 },
  'Kilis':          { lat: 36.7184, lng: 37.1212, radius: 40000 },
  'Osmaniye':       { lat: 37.0742, lng: 36.2461, radius: 50000 },
  'Düzce':          { lat: 40.8438, lng: 31.1565, radius: 50000 },
};

// ─────────────────────────────────────────────────────────────
// Kategori yapılandırması
// ─────────────────────────────────────────────────────────────
const KATEGORI_CONFIG: Record<string, {
  terms: string[];
  type?: string;
  exclude?: string[];
  min_reviews?: number;
  skip_claude?: boolean;  // true → Claude filtresi atlanır, heuristic + il doğrulama yeterli
}> = {
  // ── Akaryakıt & Enerji ─────────────────────────────────────
  akaryakit_istasyonu: {
    terms: ['tır yakıt istasyonu', 'kamyon akaryakıt istasyonu'],
    type: 'gas_station',
    exclude: ['çocuk', 'market', 'büfe'],
    skip_claude: true,
  },
  elektrik_sarj: {
    terms: ['elektrikli araç şarj istasyonu', 'EV şarj noktası'],
    type: 'electric_vehicle_charging_station',
    skip_claude: true,
  },

  // ── Park & Konaklama ────────────────────────────────────────
  tir_parki: {
    terms: ['tır parkı', 'kamyon parkı'],
    type: 'parking',
    exclude: ['çocuk parkı', 'millet bahçesi', 'botanik', 'olimpiyat parkı', 'avm otoparkı'],
  },
  otel_pansiyon: {
    terms: ['kamyoncu moteli', 'şoför moteli', 'yol moteli'],
    type: 'lodging',
    exclude: ['hilton', 'sheraton', 'marriott', 'hyatt', 'radisson', 'sofitel',
              'intercontinental', 'kempinski', 'four seasons', 'ritz-carlton'],
  },

  // ── Tamir & Bakım ───────────────────────────────────────────
  motor_mekanik: {
    terms: ['tır motor ustası', 'kamyon motor tamiri', 'tır mekanik tamirhanesi'],
    type: 'car_repair',
    exclude: ['lastik', 'elektrik', 'kaporta', 'boya', 'yıkama'],
    skip_claude: true,
  },
  lastikci: {
    terms: ['tır lastikçi', 'kamyon lastik tamiri'],
    type: 'car_repair',
    exclude: ['motor', 'elektrik', 'kaporta', 'yıkama'],
    skip_claude: true,
  },
  elektrik_takograf: {
    terms: ['tır elektrikçi', 'kamyon elektrik tamiri', 'takograf servisi'],
    type: 'car_repair',
    exclude: ['lastik', 'motor', 'kaporta', 'yıkama'],
    skip_claude: true,
  },
  branda_dorse: {
    terms: ['dorse tamircisi', 'tır branda tenteci', 'dorse branda tamiri'],
    type: 'car_repair',
    skip_claude: true,
  },
  yikama_yaglama: {
    terms: ['tır yıkama', 'kamyon yıkama', 'tır yağlama'],
    type: 'car_wash',
    exclude: ['mutfak', 'restoran', 'lokanta', 'yemek', 'oto yıkama', 'araba yıkama', 'binek', 'detailing', 'car wash'],
  },
  acil_yol_yardim: {
    terms: ['tır yol yardım', 'kamyon acil yardım', 'çekici yol yardım'],
    type: 'car_repair',
    skip_claude: true,
  },

  // ── Yeme & İçme ─────────────────────────────────────────────
  dinlenme_tesisi: {
    terms: ['kamyoncu dinlenme tesisi', 'şoför dinlenme yeri', 'otoyol tesisi'],
    type: 'restaurant',
    exclude: ['sushi', 'pub', 'bar ', 'nightclub'],
    skip_claude: true,
  },
  esnaf_lokantasi: {
    terms: ['kamyoncu lokantası', 'şoför lokantası', 'esnaf lokantası'],
    type: 'restaurant',
    exclude: ['sushi', 'pub', 'bar ', 'nightclub', 'fine dining'],
  },

  // ── Operasyon Noktaları ─────────────────────────────────────
  kantar: {
    terms: ['tır kantarı', 'kamyon tartı istasyonu', 'taşıt kantarı'],
    exclude: ['baskül üretici', 'baskül imalat', 'tartı sistemleri san.', 'terazi satış'],
  },
  nakliyeciler_sitesi: {
    terms: ['nakliyeciler sitesi', 'taşıyıcılar sitesi', 'kamyon garajı'],
    skip_claude: true,
  },
  gumruk_sinir: {
    terms: ['gümrük kapısı', 'sınır kapısı', 'gümrük müdürlüğü'],
    skip_claude: true,
  },
  antrepo_depo: {
    terms: ['antrepo', 'lojistik depo', 'soğuk depo'],
    skip_claude: true,
  },

  // ── Eski kategoriler (backward compat) ──────────────────────
  motorcu:         { terms: ['tır motor ustası'], type: 'car_repair', skip_claude: true },
  elektrikci:      { terms: ['tır elektrikçi'], type: 'car_repair', skip_claude: true },
  kaportaci:       { terms: ['tır kaportacı', 'kamyon kaporta boya'], type: 'car_repair', skip_claude: true },
  dorse_branda:    { terms: ['dorse tamircisi', 'tır branda tenteci'], type: 'car_repair', skip_claude: true },
  frigo_ustasi:    { terms: ['frigo tamir', 'thermo king servis'], type: 'car_repair', skip_claude: true },
  lokanta:         { terms: ['kamyoncu lokantası'], type: 'restaurant', exclude: ['sushi', 'pub'] },
  konaklama:       { terms: ['kamyoncu moteli'], type: 'lodging' },
  yikama:          { terms: ['tır yıkama', 'kamyon yıkama'], type: 'car_wash', exclude: ['oto yıkama', 'araba yıkama', 'binek', 'detailing'] },
  park_dinlenme:   { terms: ['tır parkı'], type: 'parking', exclude: ['çocuk', 'millet', 'avm'] },
  yemek:           { terms: ['kamyoncu lokantası'], type: 'restaurant', min_reviews: 5 },
  tamirci:         { terms: ['tır tamircisi'], type: 'car_repair' },
  tesis_akaryakit: { terms: ['akaryakıt istasyonu'], type: 'gas_station' },
  kantar_resmi:    { terms: ['kamyon tartı istasyonu'], min_reviews: 1 },
};

const GECERLI_KATEGORILER = Object.keys(KATEGORI_CONFIG);

// ─────────────────────────────────────────────────────────────
// Kalite katmanı 1: Ad + adres bazlı heuristic filtre
// ─────────────────────────────────────────────────────────────
function heuristicFiltre(
  ad: string,
  adres: string,
  kategori: string,
  reviewCount: number,
): { gecti: boolean; sebep?: string } {
  const adKucuk   = ad.toLowerCase();
  const adresKucuk = adres.toLowerCase();
  const config    = KATEGORI_CONFIG[kategori];

  // Exclude listesi kontrolü
  if (config?.exclude) {
    for (const kelime of config.exclude) {
      if (adKucuk.includes(kelime.toLowerCase())) {
        return { gecti: false, sebep: `exclude: "${kelime}"` };
      }
    }
  }

  // Minimum yorum sayısı
  const minReviews = config?.min_reviews ?? 0;
  if (reviewCount < minReviews) {
    return { gecti: false, sebep: `yorum sayısı yetersiz (${reviewCount} < ${minReviews})` };
  }

  // Tır parkı özel: çok kısa isimler atla
  if (kategori === 'tir_parki' || kategori === 'park_dinlenme') {
    if (ad.trim().length <= 3) return { gecti: false, sebep: 'çok kısa isim' };
  }

  // Nakliyeciler sitesi: yalnızca adında "nakliyeciler/garaj/lojistik/terminal" geçen yerler
  // (truck service, lastikçi gibi genel işyerleri buraya karışmasın)
  if (kategori === 'nakliyeciler_sitesi') {
    const nakliyeAnahtar = ['nakliyeciler', 'nakliyeci', 'kamyon garaj', 'kamyon garajı', 'lojistik', 'terminal', 'taşıyıcılar', 'taşıyıcı sitesi', 'kargo merkezi'];
    const eslesiyorMu = nakliyeAnahtar.some(k => adKucuk.includes(k));
    if (!eslesiyorMu) {
      return { gecti: false, sebep: 'nakliyeciler_sitesi: isimde anahtar kelime yok' };
    }
  }

  // Kantar özel: baskül satıcısı değil, tartı noktası olmalı
  if (kategori === 'kantar' || kategori === 'kantar_resmi') {
    const saticiKelime = ['ltd', 'a.ş', 'sti.', 'şti.', 'sanayi', 'ticaret', 'san.', 'tic.'];
    const saticiMi = saticiKelime.some(k => adKucuk.includes(k));
    const kantarKelime = ['kantar', 'tartı', 'baskül istasyon', 'tartım'];
    const kantarMi = kantarKelime.some(k => adKucuk.includes(k));
    // Sadece "satıcı" olan ve "kantar/tartı" adında geçmeyen yerler atla
    if (saticiMi && !kantarMi) {
      return { gecti: false, sebep: 'baskül satıcısı (tartı noktası değil)' };
    }
  }

  return { gecti: true };
}

// ─────────────────────────────────────────────────────────────
// Kalite katmanı 2: Adres → il doğrulama
// ─────────────────────────────────────────────────────────────
function ilDogrula(adresComponents: AddressComponent[], istenenIl: string): boolean {
  for (const c of adresComponents) {
    if (c.types.includes('administrative_area_level_1')) {
      const gelen = c.long_name
        .replace(/\s*(Province|İl|İli)$/i, '')
        .trim()
        .toLowerCase();
      const istenen = istenenIl.toLowerCase();
      // Tam eşleşme veya içerme (ör: "İstanbul" vs "istanbul")
      return gelen === istenen || gelen.includes(istenen) || istenen.includes(gelen);
    }
  }
  return true; // adres bileşeni yoksa geç (belirsizlik durumu)
}

// ─────────────────────────────────────────────────────────────
// Kalite katmanı 3: Claude toplu ön-eleme
// Batch başına max 10 yer; kesin "EVET/HAYIR" formatı
// ─────────────────────────────────────────────────────────────
async function claudeOnEleme(
  yerler: { ad: string; adres: string; rating?: number; reviewCount: number }[],
  kategori: string,
  il: string,
  anthropicKey: string,
): Promise<boolean[]> {
  const kategoriAciklama: Record<string, string> = {
    // Yeni
    akaryakit_istasyonu: 'Akaryakıt (mazot/dizel) satan tesis veya istasyon. TIR ve kamyonların girebileceği yerler dahil.',
    elektrik_sarj:       'Elektrikli araç şarj istasyonu veya noktası.',
    tir_parki:           'TIR, kamyon veya ağır araç park edebilecek alan. Yalnızca çocuk parkı, millet bahçesi, botanik bahçe gibi kesinlikle araç park yeri olmayan yerler elenir.',
    otel_pansiyon:       'Motel, pansiyon, han veya otel (kamyoncuların geceleme yapabileceği her türlü yer). Açık lüks resort veya tatil köyleri elenir.',
    motor_mekanik:       'Araç motor tamiri, bakımı veya mekanik usta (TIR/kamyon da gelen tamirhaneler dahil).',
    lastikci:            'Lastik satış, tamiri veya değiştirme (TIR lastiği de yapılan yerler dahil).',
    elektrik_takograf:   'Araç elektrik veya takograf tamiri (TIR/kamyon da kabul eden yerler dahil).',
    branda_dorse:        'Dorse tamiri, branda veya tente yapımı/tamiri.',
    yikama_yaglama:      'Sadece TIR, kamyon veya ağır araç yıkama ve yağlama yerleri. Normal oto yıkama, araba yıkama veya binek araç servisleri elenir.',
    acil_yol_yardim:     'Yol yardım, çekici hizmeti veya acil araç kurtarma.',
    dinlenme_tesisi:     'Kamyoncu dinlenme tesisi: kafe, yemek, WC, duş imkânı olan yol tesisleri.',
    esnaf_lokantasi:     'Yemek yenebilecek her türlü yer: lokanta, restoran, esnaf lokantası — kamyon şoförleri girebiliyorsa uygun.',
    kantar:              'Ağırlık ölçüm noktası veya tartı istasyonu. Yalnızca baskül/tartı aleti satan ya da üreten firmalar elenir.',
    nakliyeciler_sitesi: 'Nakliyeciler sitesi, kamyon garajı veya lojistik merkez.',
    gumruk_sinir:        'Gümrük kapısı veya sınır geçiş noktası.',
    antrepo_depo:        'Antrepo, lojistik depo veya soğuk depo.',
    // Eski
    motorcu:       'Araç motor tamiri, bakımı veya ustası (TIR/kamyon da gelen tamirhaneler dahil).',
    elektrikci:    'Araç elektrik tamiri (TIR/kamyon da kabul eden yerler dahil).',
    kaportaci:     'Araç kaporta, boya veya karoser tamiri.',
    dorse_branda:  'Dorse tamiri, branda veya tente yapımı/tamiri.',
    frigo_ustasi:  'Soğutuculu araç (frigorifik, thermo king) tamiri veya bakımı.',
    lokanta:       'Yemek yenebilecek her türlü yer — kamyon şoförleri girebiliyorsa uygun.',
    konaklama:     'Motel, pansiyon, han veya otel (kamyoncuların geceleme yapabileceği yer).',
    yikama:        'Araç yıkama veya yağlama yeri.',
  };

  const aciklama = kategoriAciklama[kategori] || kategori;
  const liste = yerler
    .map((y, i) =>
      `${i + 1}. Ad: "${y.ad}" | Adres: ${y.adres} | Puan: ${y.rating ?? '—'}/5 (${y.reviewCount} yorum)`
    )
    .join('\n');

  const prompt = `Aşağıdaki Google Maps yerleri "${il}" ilinde şu amaçla arandı: "${aciklama}"

${liste}

Bu yerlerden KESİNLİKLE alakasız olanları ele. Şüphe durumunda UYGUN say — admin zaten onay aşamasında görecek.
Uygun olan yerlerin numaralarını virgülle yaz. Örnek: "1,2,3,4"
Tamamı uygunsuzsa "-" yaz.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 64,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return yerler.map(() => true);

    const data = await res.json();
    const yanit = (data.content?.[0]?.text ?? '').trim();
    console.log(`[claudeOnEleme] kategori=${kategori} yanit="${yanit}"`);
    // Boş veya sadece tire → hepsi geç (Claude yanıt veremedi)
    if (!yanit) return yerler.map(() => true);
    // Açıkça "hiçbiri yok" sinyali
    if (yanit === '-') return yerler.map(() => false);

    const uygunlar = new Set(
      yanit
        .split(/[,\s]+/)
        .map((s: string) => parseInt(s.replace(/\D/g, ''), 10))
        .filter((n: number) => !isNaN(n) && n >= 1 && n <= yerler.length)
    );
    // Hiç sayı parse edilemeyen prose yanıt → tümünü geçir (filtre edemedi)
    if (uygunlar.size === 0) return yerler.map(() => true);
    return yerler.map((_, i) => uygunlar.has(i + 1));
  } catch {
    return yerler.map(() => true); // hata varsa hepsini geç
  }
}

// ─────────────────────────────────────────────────────────────
// Google Places Text Search — location bias ile
// ─────────────────────────────────────────────────────────────
// Google Places Text Search — tek sayfa, max 20 sonuç
// ─────────────────────────────────────────────────────────────
async function textSearch(
  query: string,
  type: string | undefined,
  ilKoordinat: { lat: number; lng: number; radius: number } | undefined,
  apiKey: string,
): Promise<GooglePlace[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('language', 'tr');
  url.searchParams.set('region', 'tr');
  if (type) url.searchParams.set('type', type);
  if (ilKoordinat) {
    url.searchParams.set('location', `${ilKoordinat.lat},${ilKoordinat.lng}`);
    url.searchParams.set('radius', String(ilKoordinat.radius));
  }
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Places Text Search HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`Google Places API: ${data.error_message || data.status}`);
  }
  return (data.results || []) as GooglePlace[];
}

// ─────────────────────────────────────────────────────────────
// Google Place Details
// ─────────────────────────────────────────────────────────────
async function placeDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields',
    'place_id,name,formatted_address,formatted_phone_number,geometry,rating,user_ratings_total,url,address_components,reviews'
  );
  url.searchParams.set('language', 'tr');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 'OK') return null;
  return data.result as GooglePlaceDetails;
}

function parseAdresComponents(components: AddressComponent[]): { il: string | null; ilce: string | null } {
  let il: string | null = null;
  let ilce: string | null = null;
  for (const c of components) {
    if (c.types.includes('administrative_area_level_1'))
      il = c.long_name.replace(/\s*(Province|İl|İli)$/i, '').trim();
    if (c.types.includes('administrative_area_level_2'))
      ilce = c.long_name.replace(/\s*(District|İlçesi)$/i, '').trim();
  }
  return { il, ilce };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/poi-import
// Body: { province, categories, limit_per_query?, claude_filter? }
// ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (!profil || profil.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sadece admin kullanabilir.' }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GOOGLE_PLACES_API_KEY tanımlı değil.' }, { status: 500 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const body = await request.json();
    const {
      province,
      categories,
      limit_per_query = 20,
      claude_filter = true,
    } = body as {
      province: string;
      categories: string[];
      limit_per_query?: number;
      claude_filter?: boolean;
    };

    if (!province?.trim()) return NextResponse.json({ success: false, error: 'province zorunludur.' }, { status: 400 });
    if (!Array.isArray(categories) || categories.length === 0)
      return NextResponse.json({ success: false, error: 'En az bir kategori seçilmeli.' }, { status: 400 });

    const gecersizKat = categories.filter(k => !GECERLI_KATEGORILER.includes(k));
    if (gecersizKat.length > 0)
      return NextResponse.json({ success: false, error: `Geçersiz kategoriler: ${gecersizKat.join(', ')}` }, { status: 400 });

    const il = province.trim();
    const ilKoordinat = IL_KOORDINAT[il]; // undefined ise location bias uygulanmaz

    // Daha önce eklenmiş place_id'leri önceden çek — elenenler listesinde tekrar gösterme
    const { data: mevcutRows } = await supabase
      .from('pois')
      .select('google_place_id')
      .not('google_place_id', 'is', null);
    const mevcutPlaceIds = new Set<string>(
      (mevcutRows ?? []).map((r: { google_place_id: string }) => r.google_place_id).filter(Boolean)
    );

    let eklenen = 0, atlanan = 0, filtrelenen = 0, hatali = 0;
    const hatalar: string[] = [];
    const elenenler: { ad: string; adres: string; kategori: string; sebep: string; place_id: string }[] = [];

    // Filtre sebebi sayaçları (debug için)
    const filtreSayac: Record<string, number> = {
      heuristic: 0,
      il_eslesme: 0,
      claude: 0,
      min_reviews: 0,
    };

    for (const kategori of categories) {
      const config = KATEGORI_CONFIG[kategori];
      if (!config) continue;

      const bulunanYerler: GooglePlace[] = [];

      for (const terim of config.terms) {
        const sorgu = `${terim} ${il}`;
        try {
          const sonuclar = await textSearch(sorgu, config.type, ilKoordinat, apiKey);
          bulunanYerler.push(...sonuclar);
          await sleep(200);
        } catch (err) {
          const mesaj = err instanceof Error ? err.message : String(err);
          hatalar.push(`"${sorgu}": ${mesaj}`);
        }
      }

      // google_place_id bazlı dedup
      const tekYerler = Array.from(
        new Map(bulunanYerler.map(y => [y.place_id, y])).values()
      );

      if (tekYerler.length === 0) continue;

      // ── Katman 1: Heuristic filtre (yer adı + review count) ──
      const katman1 = tekYerler.filter(y => {
        const { gecti, sebep } = heuristicFiltre(
          y.name,
          y.formatted_address || '',
          kategori,
          y.user_ratings_total ?? 0,
        );
        if (!gecti) {
          filtrelenen++;
          if (!mevcutPlaceIds.has(y.place_id)) {
            elenenler.push({ ad: y.name, adres: y.formatted_address || '', kategori, sebep: `Heuristic: ${sebep}`, place_id: y.place_id });
          }
          if (sebep?.includes('yorum')) filtreSayac.min_reviews++;
          else filtreSayac.heuristic++;
        }
        return gecti;
      });

      // ── Katman 2: İl doğrulama (Text Search sonuçlarında address_components yoksa atla) ──
      // Bu aşamada address_components mevcut olmayabilir; Place Details'de doğrulama yapılır

      if (katman1.length === 0) continue;

      // ── Katman 3: Claude ön-eleme ──
      let katman3 = katman1;
      if (claude_filter && anthropicKey && katman1.length > 0 && !config.skip_claude) {
        const girdi = katman1.map(y => ({
          ad: y.name,
          adres: y.formatted_address || '',
          rating: y.rating,
          reviewCount: y.user_ratings_total ?? 0,
        }));

        try {
          const sonuclar = await claudeOnEleme(girdi, kategori, il, anthropicKey);
          katman3 = katman1.filter((y, i) => {
            if (!sonuclar[i]) {
              filtrelenen++;
              filtreSayac.claude++;
              if (!mevcutPlaceIds.has(y.place_id)) {
                elenenler.push({ ad: y.name, adres: y.formatted_address || '', kategori, sebep: 'Claude: kategori dışı', place_id: y.place_id });
              }
              return false;
            }
            return true;
          });
        } catch {
          // Claude hatası → tüm sonuçları geç
        }
      }

      // ── Place Details + Katman 4: il adres doğrulama ──
      for (const yer of katman3.slice(0, limit_per_query)) {
        try {
          await sleep(120);
          const detay = await placeDetails(yer.place_id, apiKey);
          if (!detay) continue;

          // Katman 4: Dönen adresin ili istenen ile eşleşiyor mu?
          if (!ilDogrula(detay.address_components || [], il)) {
            filtrelenen++;
            filtreSayac.il_eslesme++;
            if (!mevcutPlaceIds.has(yer.place_id)) {
              elenenler.push({ ad: detay.name, adres: detay.formatted_address || '', kategori, sebep: `İl eşleşmedi (aranan: ${il})`, place_id: yer.place_id });
            }
            continue;
          }

          const { il: adresIl, ilce } = parseAdresComponents(detay.address_components || []);

          const { error } = await supabase
            .from('pois')
            .upsert({
              google_place_id:     detay.place_id,
              name:                detay.name,
              category:            kategori,
              latitude:            detay.geometry.location.lat,
              longitude:           detay.geometry.location.lng,
              location:            `SRID=4326;POINT(${detay.geometry.location.lng} ${detay.geometry.location.lat})`,
              address:             detay.formatted_address || null,
              city:                adresIl || il,
              district:            ilce || null,
              phone:               detay.formatted_phone_number || null,
              google_maps_url:     detay.url || null,
              google_rating:       detay.rating || null,
              google_review_count: detay.user_ratings_total || 0,
              status:              'pending',
              verified:            false,
              is_active:           true,
              last_synced_at:      new Date().toISOString(),
            }, { onConflict: 'google_place_id', ignoreDuplicates: true });

          if (error) {
            if (error.code === '23505') { atlanan++; }
            else { hatali++; console.error('[poi-import] Upsert error:', error); }
          } else {
            eklenen++;
          }
        } catch (err) {
          hatali++;
          console.error('[poi-import] Place detail error:', err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { eklenen, atlanan, filtrelenen, hatali },
      filtreSayac,
      elenenler,
      message: `${eklenen} yeni kayıt eklendi. ${filtrelenen} elendi. ${atlanan} zaten vardı.`,
      ...(hatalar.length > 0 && { hatalar }),
    });

  } catch (err) {
    console.error('[poi-import/POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/poi-import
// Elenen bir yeri zorla ekle — body: { place_id, kategori, il }
// ─────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const ssrClient = await getServerSupabase();
    const { data: { user } } = await ssrClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Giriş gerekli.' }, { status: 401 });

    const supabase = getServiceSupabase();
    const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    if (!profil || profil.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Sadece admin kullanabilir.' }, { status: 403 });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'GOOGLE_PLACES_API_KEY tanımlı değil.' }, { status: 500 });

    const { place_id, kategori, il } = await request.json() as { place_id: string; kategori: string; il: string };
    if (!place_id || !kategori) return NextResponse.json({ success: false, error: 'place_id ve kategori zorunludur.' }, { status: 400 });

    const detay = await placeDetails(place_id, apiKey);
    if (!detay) return NextResponse.json({ success: false, error: 'Google Places detay alınamadı.' }, { status: 502 });

    const { il: adresIl, ilce } = parseAdresComponents(detay.address_components || []);

    const { error } = await supabase
      .from('pois')
      .upsert({
        google_place_id:     detay.place_id,
        name:                detay.name,
        category:            kategori,
        latitude:            detay.geometry.location.lat,
        longitude:           detay.geometry.location.lng,
        location:            `SRID=4326;POINT(${detay.geometry.location.lng} ${detay.geometry.location.lat})`,
        address:             detay.formatted_address || null,
        city:                adresIl || il || null,
        district:            ilce || null,
        phone:               detay.formatted_phone_number || null,
        google_maps_url:     detay.url || null,
        google_rating:       detay.rating || null,
        google_review_count: detay.user_ratings_total || 0,
        status:              'pending',
        verified:            false,
        is_active:           true,
        last_synced_at:      new Date().toISOString(),
      }, { onConflict: 'google_place_id', ignoreDuplicates: false });

    if (error) {
      console.error('[poi-import/PUT] Upsert error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `"${detay.name}" eklendi.` });
  } catch (err) {
    console.error('[poi-import/PUT] Unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Beklenmeyen bir hata oluştu.' }, { status: 500 });
  }
}

// GET — desteklenen kategoriler ve yapılandırma
export async function GET() {
  return NextResponse.json({
    success: true,
    kategoriler: GECERLI_KATEGORILER,
    illerDestekleniyor: Object.keys(IL_KOORDINAT),
  });
}

// ─── Tipler ──────────────────────────────────────────────────

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  geometry: { location: { lat: number; lng: number } };
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  url?: string;
  address_components: AddressComponent[];
  reviews?: unknown[];
}
