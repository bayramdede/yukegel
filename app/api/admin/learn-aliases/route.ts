import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '../../../../lib/auth';
// W5/D2 — dört yazma noktasının tamamı bu yardımcıdan geçer; gerekçesi lib dosyasında.
import {
  aliasKey,
  normalizeAliasFields,
  aliasCakismaBul,
  baskinYazimaHizala,
  aliasSatirlariniYukle,
  ilceIlUyarisi,
  // 21 Ağu 2026 — "tepeören→Dilovası" vakasından sonra eklendi, bkz.
  // `lib/alias-normalize.ts` başlığındaki gerekçe.
  cakisanSehirBul,
  yayginKelimeCakismasiUyarisi,
  aktifAliasListesi,
} from '../../../../lib/alias-normalize';
// Dalga 5 — :454'teki `origin_city` predikatı `origin_province_id`'ye çevrildi.
import { ilId } from '../../../../lib/lokasyon';

export const runtime = 'nodejs';
export const maxDuration = 60; // LLM keşif çağrısı için

// 🚨 31 Tem 2026 — "LLM 8 saniyede yanit vermedi" HATASININ KAYNAĞI.
// `maxDuration` 60 sn bütçe veriyordu ama LLM fetch'i 8000 ms'de abort ediliyordu:
// fonksiyonun 52 saniyesi hiç kullanılmadan çöpe gidiyordu. Keşif prompt'u küçük
// değil — `mevcutMap` 500'e kadar alias çiftini (~15 kB) taşıyor, üstüne 10×200
// karakter ilan metni ve 1024 token çıktı geliyor. Haiku'nun bunu 8 sn'de
// bitirmesi garanti değil; limit=10 ile bile patlıyordu.
// Bütçe: 60 sn toplam − ~5 sn (iki DB select + öneri yazma turu) − ~2 sn soğuk
// başlangıç payı ⇒ LLM'e 45 sn. Vercel fonksiyonu kendi 60 sn'sinde ölmeden
// önce bizim abort'umuz devreye girsin diye üst sınırın altında bırakıldı;
// böylece kullanıcı anlamlı bir hata görür, 504 duvarı görmez.
const LLM_TIMEOUT_MS = 45_000;

// ⚠️ `is_active` / `is_approved` TUZAĞI (W5/D2'de tespit edildi, bilinçli olarak
// DEĞİŞTİRİLMEDİ — kapsam dışı):
// `parse-listing/index.ts:44` ve `whatsapp-parse/route.ts:344` alias listesini
// çekerken yalnız `.eq('is_active', true)` filtreliyor, `is_approved`'a BAKMIYOR.
// Şu an güvenli, çünkü bu route'ta AI önerileri `is_active: false` doğuyor ve
// onay anında ikisi birlikte `true` oluyor. Yani güvenlik iki bayrağın senkron
// kalmasına bağlı — kırılgan varsayım. `is_active: true, is_approved: false` bir
// satır herhangi bir yoldan oluşursa onaylanmamış alias canlı parse'a girer.
// Değiştirilecekse eşleşme tarafına `is_approved` filtresi eklenmeli.

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

    // 2. Form ilanları — kalkış ili ÇÖZÜLEMEMİŞ + SLH taranmamış
    //
    // 🚨 DALGA 5 / BÖLÜM 2.2 — BU PREDİKAT ZORUNLU DEĞİŞİKLİKTİ, kozmetik değil.
    //    Eski hali `.is('origin_city', null)` idi. `ilan_olustur` v4 metin
    //    kolonuna YAZMAYI BIRAKIYOR; o an itibarıyla `origin_city` her YENİ
    //    satırda NULL olur. Yani bu kuyruk, ili gayet güzel çözülmüş ilanlarla
    //    dolardı — ölçüm anındaki tabloda ~234 bin satır. "Öğrenme merkezi"
    //    ekranı kullanılamaz hale gelir, gerçek çözülemeyenler gürültüde kaybolur.
    //    Kolon BÖLÜM 5'te düştüğünde ise aynı satır 42703 atardı.
    //
    //    `origin_province_id IS NULL` hem bugün hem v4'ten sonra AYNI şeyi
    //    sorar: "bu ilanın kalkış ili çözülemedi". Zaten kastedilen buydu;
    //    metin kolonu yalnızca o dönemki taşıyıcıydı.
    //
    //    ⚠️ `origin_city` select listesinden de ÇIKARILDI — id'ye çevrilmedi.
    //    Tüketici `OgrenmeMerkeziClient.tsx` bu alanı hiç basmıyor (yalnız
    //    `source`, `created_at`, `raw_text` gösteriliyor). Predikatın tanımı
    //    gereği de değeri her zaman NULL; taşımanın bir anlamı yok.
    const { data: noOrigin, error: noOrgErr } = await svc
      .from('listings')
      .select('id, raw_text, source, notes, created_at, moderation_status')
      .is('origin_province_id', null)
      .not('raw_text', 'is', null)
      .is('slh_scanned_at', null)        // sadece hiç taranmamışlar
      .order('created_at', { ascending: false })
      .limit(Math.floor(limit * 0.3));

    if (rawErr) return NextResponse.json({ error: rawErr.message }, { status: 500 });
    // 8 Ağu 2026 — `noOrgErr` yakalanıyordu ama HİÇ okunmuyordu: ikinci sorgu
    // patlarsa `noOrigin` `null` olur, `?? []` bunu sessizce "0 çözülemeyen ilan"
    // gibi gösterirdi — panelin tek var oluş sebebi olan backlog sayısını yanlış
    // raporlar. Diğer üç sekme zaten kendi hatasını kontrol ediyordu, bu atlanmıştı.
    if (noOrgErr) return NextResponse.json({ error: noOrgErr.message }, { status: 500 });

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
      .select('id, alias, normalized, district, type, priority, llm_confidence, source_listing_ids, created_at')
      .eq('created_by_ai', true)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 🚨 21 Ağu 2026 — "tepeören→Dilovası" vakası: liste ekrana gelmeden ÖNCE her
    // öneri için "onaylanırsa Pass 2'yi kandırır mı?" sorusunu sorup rozet
    // basıyoruz — admin "Onayla"ya basmadan önce görsün. N+1 sorgudan kaçınmak
    // için `aktifAliaslar` ve kaynak `raw_posts` TEK SEFERDE yükleniyor, döngü
    // yalnız bellek içi `cakisanSehirBul` (saf fonksiyon) çalıştırıyor.
    const satir = (data ?? []) as any[];
    let sonuc = satir;
    if (satir.length > 0) {
      const tumKaynakIdler = Array.from(
        new Set(satir.flatMap(s => (Array.isArray(s.source_listing_ids) ? s.source_listing_ids : []))),
      ).slice(0, 500);

      const [{ data: kaynakSatirlar }, tumAktifAliaslar] = await Promise.all([
        tumKaynakIdler.length > 0
          ? svc.from('raw_posts').select('id, raw_text').in('id', tumKaynakIdler)
          : Promise.resolve({ data: [] as any[] }),
        aliasSatirlariniYukle(svc, 'city').then(aktifAliasListesi),
      ]);
      const rawTextMap = new Map<string, string | null>((kaynakSatirlar ?? []).map((r: any) => [r.id, r.raw_text]));

      sonuc = satir.map(s => {
        const kaynakMetinler = (Array.isArray(s.source_listing_ids) ? s.source_listing_ids : [])
          .map((id: string) => rawTextMap.get(id))
          .filter((t: string | null | undefined): t is string => !!t);
        const cakisma_uyarisi = cakisanSehirBul(
          { alias: s.alias, normalized: s.normalized, priority: s.priority },
          kaynakMetinler,
          tumAktifAliaslar,
        );
        return { ...s, cakisma_uyarisi };
      });
    }

    return NextResponse.json({ data: sonuc });
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
    // 🚨 W5/D2 — Bu yol eskiden alias'ı lowercase ETMİYORDU (AI yolu ve PATCH
    // ediyordu). Büyük harfli alias eşleşme tarafında hiç tutmaz: `findPlaces` ve
    // `whatsapp-parse` trNorm'lanmış metinle karşılaştırıyor. Sessizce ölü kayıt
    // üretiyordu.
    const tip = type ?? 'city';
    const alanlar = normalizeAliasFields({ alias, normalized, district: body.district ?? null, type: tip });
    const cakisma = await aliasCakismaBul(svc, { type: tip, ...alanlar });
    if (cakisma) {
      // 409: sessizce ezmiyoruz — hangi yazımın kazandığını admin görmeli.
      return NextResponse.json({ error: cakisma.mesaj, conflict: cakisma }, { status: 409 });
    }

    const { data, error } = await svc
      .from('aliases')
      .insert({
        alias: alanlar.alias,
        normalized: alanlar.normalized,
        type: tip,
        district: alanlar.district ?? null,
        is_active: true,
        created_by_ai: false,
        is_approved: true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // #51 — ilçe/il tutarsızlığı UYARI olarak döner, yazmayı engellemez. Gerekçe
    // `lib/alias-normalize.ts::ilceIlUyarisi` başlığında.
    return NextResponse.json({
      success: true,
      data,
      warning: ilceIlUyarisi(alanlar.normalized, alanlar.district) ?? undefined,
    });
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

    // ⚠️ Bu liste prompt'un en büyük parçası: 500 çift ≈ 15 kB, ilan metinlerinin
    // toplamından kat kat fazla. Gecikmenin ana kaynağı bu (31 Tem timeout'unun
    // arka planı). Kısaltmak CAZİP ama YAPILMADI: aşağıdaki 5b filtresi mevcut
    // alias'ları zaten sunucu tarafında eliyor, yani liste doğruluk için değil
    // VERİM için burada — LLM'e "bunları önerme" demezsen tur başına gelen yeni
    // alias sayısı düşer, tekrarlar 5b'de silinip boşa dönersin.
    const mevcutMap = (mevcutAliaslar ?? [])
      .map((a: any) => `"${a.alias}"=>"${a.normalized}"`)
      .join(', ');

    // 3. Metinleri birleştir (lone surrogate'leri temizle — JSON serialize hatasını önler)
    // 🚨 #86 (6 Ağu 2026): eski hali `/[\uD800-\uDFFF]/g` idi, `u` bayrağı yok →
    // GEÇERLİ vekil çiftlerini de siliyordu. Burada risk ekstra yüksekti: emoji
    // boşluk bırakmadan silinince "MERSİN👉İRAN" → "MERSİNİRAN" olur ve Haiku
    // bu yapışık token'dan UYDURMA alias öğrenebilir. Yalnız EŞSİZ vekiller atılır.
    const stripSurr = (s: string) =>
      s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    const metinler = rawPosts
      .map((r: any, i: number) => `[${i + 1}] (ID:${r.id})\n${stripSurr((r.raw_text || '').substring(0, 200))}`)
      .join('\n\n---\n\n'); // 400→200 char: prompt boyutunu yarıya indir

    // 4. Haiku çağrısı
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY eksik' }, { status: 500 });

    // 🚨 W5/D1 — Prompt'un kendisi bozuk yazim ogretiyordu (29 Tem 2026).
    // Eski surumde asagidaki orneklerin HEPSI ASCII'ye indirgenmisti ("Istanbul",
    // "Eskisehir", "Tekirdag"...). LLM kurali degil ORNEGI taklit eder; boylece
    // aliases.normalized'a hem "Istanbul" hem "İstanbul" yaziliyordu. Sonucu:
    // findPlaces bunlari iki ayri sehir sayip sahte "İstanbul→İstanbul" guzergahi
    // uretiyor, sehir filtresi de ilanlarin bir kismini hic gostermiyordu.
    // Bu yuzden il/ilce ORNEKLERI dogru Turkce yazimda olmak ZORUNDA.
    // ⚠️ Prompt govdesindeki TALIMAT metinleri (GOREV, KURALLAR) ASCII kalabilir —
    // onlar veriye kopyalanmiyor, yalniz ornekler kopyalaniyor.
    const prompt = `Turk nakliye ilan metinlerinden YER ADI ALIAS'LARINI kesvet.

EN ONEMLI KURAL — TURKCE YAZIM:
"normalized" ve "district" degerleri Turkiye'deki RESMI yazimla yazilacak.
Turkce karakterler (ı ğ ü ş ö ç İ) AYNEN korunacak, ASCII'ye indirgenmeyecek.
DOGRU:  "İstanbul", "İzmir", "Eskişehir", "Tekirdağ", "Muğla", "Çorlu", "Bingöl"
YANLIS: "Istanbul", "Izmir", "Eskisehir", "Tekirdag", "Mugla", "Corlu", "Bingol"
Asagidaki MEVCUT ALIAS listesinde ASCII'ye indirgenmis ESKI kayitlar bulunabilir.
Onlari ornek alma — her zaman dogru Turkce yazimi uret.

MEVCUT ALIAS'LAR (bunlari tekrar onerme): ${mevcutMap || '(bos)'}

ASAGIDA ${rawPosts.length} ADET ROTALARI COZULEMAMIS ILAN VAR:
${metinler}

GOREV:
Bu metinlerde gecen yer isimlerinden standart Turkiye il/ilce listesinde OLMAYANLARI tespit et.
Bunlarin standart karsiligini bul.
Ornekler:
- "G.Antep"  => normalized:"Gaziantep", district:null     (il)
- "eskiseh"  => normalized:"Eskişehir", district:null     (il)
- "izmit"    => normalized:"Kocaeli",   district:"İzmit"  (ilce)
- "gebze"    => normalized:"Kocaeli",   district:"Gebze"  (ilce)
- "tuzla"    => normalized:"İstanbul",  district:"Tuzla"  (ilce)
- "ikitelli" => normalized:"İstanbul",  district:"İkitelli" (ilce)
- "corlu"    => normalized:"Tekirdağ",  district:"Çorlu"  (ilce)
- "antakya"  => normalized:"Hatay",     district:"Antakya" (ilce)

SADECE GECERLI JSON ARRAY DONDUR, baska hicbir sey yazma:
[
  {
    "alias": "bulunan_kelime_veya_kisaltma",
    "normalized": "bagli_oldugu_il_adi_turkce_karakterlerle",
    "district": "ilce_adi_turkce_karakterlerle_veya_null",
    "type": "city",
    "confidence": 85,
    "source_ids": ["id1"]
  }
]

KURALLAR:
- type: her zaman "city" kullan
- normalized: DAIMA il adi, Turkce karakterlerle (ornek: "İstanbul", "Kocaeli", "Muğla")
- district: eger alias bir ILCE ise ilcenin dogru Turkce adi (Turkce karakterlerle);
  eger alias IL ise null
- confidence: 0-100. Sadece >=70 gonder.
- Mevcut listede olan alias'lari tekrar onerme
- Hic bulamazsan: [] dondur`;

    let llmResponse: any;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
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
      // ⚠️ Mesaj sabit yazilmaz: sure LLM_TIMEOUT_MS'ten turetilir. Eski surumde
      // "8 saniyede" metne gomuluydu ve timeout degisince yalan soylemeye basladi.
      // Ayrica eski metin "limit azalt" diyordu — panelin en dusuk secenegi zaten
      // 10; kullanicinin yapabilecegi bir sey yoktu, olu tavsiyeydi.
      const mesaj = e?.name === 'AbortError'
        ? `LLM ${Math.round(LLM_TIMEOUT_MS / 1000)} saniyede yanit vermedi — tekrar dene, surerse Anthropic tarafinda gecikme var demektir`
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

    // 🚨 W5/D2 — Mevcut yazımlara hizalama için tam city indeksi.
    // LLM prompt'una giden 500'lük örnek yetmez: canonical yazım o örneğin dışında
    // kalabilir. Ayrıca `is_active`/`is_approved` filtresi YOK — pasif bir kopya da
    // çakışmadır (D3 indeksi bayraklara bakmayacak).
    const cityIndeksi = await aliasSatirlariniYukle(svc, 'city');
    const mevcutNormDegerleri = cityIndeksi.map(s => s.normalized);
    const mevcutDistrictDegerleri = cityIndeksi.map(s => s.district);
    const hizalananlar: { alias: string; alan: string; llm: string; kullanilan: string }[] = [];

    // 5a. Confidence ≥70 olanları filtrele
    const adaylar = suggestions
      .filter((s: any) => s.alias && s.normalized && (s.confidence ?? 0) >= 70)
      .map((s: any) => {
        const alanlar = normalizeAliasFields({
          alias: s.alias,
          normalized: s.normalized,
          district: s.district ?? null,
          type: 'city',
        });
        // Öneriyi 409 ile reddetmek yerine mevcut baskın yazıma çekiyoruz: bunlar
        // `is_approved=false` ÖNERİ, admin zaten tek tek onaylıyor. Ama neyin
        // değiştiği yanıtta raporlanır — sessiz düzeltme yok.
        const norm = baskinYazimaHizala(alanlar.normalized ?? null, mevcutNormDegerleri);
        const dist = baskinYazimaHizala(alanlar.district ?? null, mevcutDistrictDegerleri);
        if (norm !== alanlar.normalized) {
          hizalananlar.push({ alias: alanlar.alias ?? '', alan: 'normalized', llm: alanlar.normalized ?? '', kullanilan: norm ?? '' });
        }
        if (dist !== alanlar.district) {
          hizalananlar.push({ alias: alanlar.alias ?? '', alan: 'district', llm: alanlar.district ?? '', kullanilan: dist ?? '' });
        }
        return {
          alias: alanlar.alias ?? '',
          normalized: norm ?? '',
          type: 'city',
          district: dist,
          is_active: false,
          created_by_ai: true,
          is_approved: false,
          llm_confidence: Math.min(100, Math.max(0, Number(s.confidence ?? 80))),
          source_listing_ids: Array.isArray(s.source_ids) ? s.source_ids : [],
        };
      });

    if (adaylar.length === 0) {
      await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);
      return NextResponse.json({
        success: true,
        message: 'Guvenilir oneri bulunamadi (confidence < 70)',
        suggestions,
      });
    }

    // 5b. Zaten onaylanmış alias'ları hariç tut — upsert bunları ezip is_approved=false yapmasın
    // ⚠️ W5/D2 — Karşılaştırma artık KATLANMIŞ anahtarla. Eskiden ham `in('alias', ...)`
    // eşitliğiydi: onaylı "çorlu" varken LLM "corlu" önerirse ikisi ayrı sayılıp tabloya
    // ikinci bir kopya giriyordu. Bu sorgu ayrıca kalktı — indeks yukarıda zaten yüklü.
    const onayliKatlanmis = new Set(
      cityIndeksi.filter(s => s.is_approved).map(s => aliasKey(s.alias)),
    );
    const kayitlar = adaylar.filter((a: any) => !onayliKatlanmis.has(aliasKey(a.alias)));

    if (kayitlar.length === 0) {
      // 8 Ağu 2026 — burada AYNI güncelleme iki kez atılıyordu (kopyala-yapıştır
      // artığı): ilki `rawPosts.map(r=>r.id)`, ikincisi `rawPostIds` — ikisi de
      // :370'te tanımlı AYNI id listesi. Zararsız (idempotent) ama gereksiz bir
      // DB turuydu; tek çağrıya indirildi.
      await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);
      return NextResponse.json({
        success: true,
        message: 'LLM onerilerinin tamami zaten mevcut — yeni alias yok',
        suggestions: [],
        hizalanan_yazimlar: hizalananlar,
      });
    }

    const { error: insertErr } = await svc
      .from('aliases')
      .upsert(kayitlar, { onConflict: 'alias', ignoreDuplicates: false });

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Taranmis raw_posts'lari isaretle
    await svc.from('raw_posts').update({ slh_scanned_at: now }).in('id', rawPostIds);

    // Bu batch'te kesfedilen illerle eslesen listings'leri de isaretle.
    //
    // 🚨 DALGA 5 (4 Ağu 2026) — `.in('origin_city', kesfedilenNorm)` idi.
    //    `origin_city` Dalga 5'te DÜŞÜYOR; kaldığı yerde bırakılsa bu satır
    //    drop'tan sonra 42703 atardı. Ayrıca `ilan_olustur` v4 metin kolonuna
    //    yazmayı bıraktığı için predikat YENİ satırların hiçbirini zaten
    //    tutmuyor — sessizce kapsam kaybediyordu.
    //
    //    `normalized` bu route'ta HER ZAMAN bir il adıdır (yukarıda
    //    `type: 'city'` sabit yazılı, :380/:396), yani `ilId()` ile plaka
    //    koduna birebir çevrilebilir. Çeviremediğimiz değer olursa
    //    (`ilId` → null) onu sessizce atmak yerine AYIKLIYORUZ: LLM'in
    //    il olmayan bir `normalized` üretmesi başlı başına bir sinyal.
    const kesfedilenIlIds = Array.from(
      new Set(
        kayitlar
          .map((k: any) => ilId(k.normalized))
          .filter((id: number | null): id is number => id !== null),
      ),
    );
    const cozulemeyenNorm = kayitlar
      .map((k: any) => k.normalized)
      .filter((n: string) => ilId(n) === null);
    if (cozulemeyenNorm.length > 0) {
      console.warn('[learn-aliases] normalized il adına çözülemedi:', cozulemeyenNorm);
    }
    if (kesfedilenIlIds.length > 0) {
      await svc
        .from('listings')
        .update({ slh_scanned_at: new Date().toISOString() })
        .is('slh_scanned_at', null)
        .in('origin_province_id', kesfedilenIlIds);
    }

    return NextResponse.json({
      success: true,
      message: `${kayitlar.length} yeni alias onerisi kaydedildi (onay bekliyor)`,
      suggestions: kayitlar,
      scanned_count: rawPosts.length,
      // W5/D2 — LLM'in ürettiği yazım mevcut baskın yazıma çekildiyse burada görünür.
      hizalanan_yazimlar: hizalananlar,
    });
  }

  // ── Eski no_lane kayitlari isaretleyerek yeniden taramayi engelle ──
  if (body.action === 'clean_no_lane') {
    const gunler = Math.min(Math.max(Number(body.days ?? 30), 1), 365);
    const esik = new Date(Date.now() - gunler * 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await svc
      .from('raw_posts')
      .update({ slh_scanned_at: new Date().toISOString() }, { count: 'exact' })
      .eq('processing_status', 'no_lane')
      .lt('created_at', esik);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: count ?? 0, days: gunler });
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
    // 🚨 W5/D2 — Onay anı bozulmanın son kapısı: burada "Istanbul" yazıp onaylamak
    // tabloya ikinci bir İstanbul yazımı sokuyordu. Artık katlanmış forma göre
    // çakışma varsa 409.
    const alanlar = normalizeAliasFields(updates);
    if (alanlar.alias !== undefined) payload.alias = alanlar.alias;
    if (alanlar.normalized !== undefined) payload.normalized = alanlar.normalized;
    if (alanlar.district !== undefined) payload.district = alanlar.district;

    // #51 — onay anı detektörün DOĞRU yeri: üç canlı hatanın üçü de AI keşfinden
    // `is_approved=false` doğdu, yani hepsi bu kapıdan geçti. Uyarı PATCH'te
    // gönderilmeyen alanları MEVCUT satırdan tamamlamak zorunda — yalnız
    // `district` düzenlenip onaylanırsa `normalized` `updates`'te olmaz ve
    // kontrol sessizce atlanırdı.
    const { data: mevcutSatir } = await svc
      .from('aliases')
      .select('type, normalized, district, alias, priority, created_by_ai, is_approved, source_listing_ids')
      .eq('id', id)
      .single();

    if (alanlar.alias !== undefined || alanlar.normalized !== undefined || alanlar.district) {
      // Tip gönderilmiyorsa mevcut satırdan oku — çakışma kontrolü tip bazlı.
      const cakisma = await aliasCakismaBul(svc, {
        type: mevcutSatir?.type ?? 'city',
        ...alanlar,
        excludeId: id,
      });
      if (cakisma) return NextResponse.json({ error: cakisma.mesaj, conflict: cakisma }, { status: 409 });
    }

    // 🚨 21 Ağu 2026 — "tepeören→Dilovası" vakası: bu, İLK onaydır (zaten
    // onaylıysa — admin sadece yazım düzeltiyorsa — tekrar sorma). Yalnız AI
    // önerileri (`created_by_ai`) kontrol edilir; öncelik>50 olanlarda fonksiyon
    // zaten `null` döner. `cakismayiKabulEt` GÖNDERİLMEDEN 409 döner — bu yüzden
    // `topluOnayla` (bulk approve, bu bayrağı HİÇ göndermez) çakışan önerileri
    // OTOMATİK ONAYLAYAMAZ, "başarısız" sayılıp bekleyende kalırlar. Tek tek
    // onay ekranı uyarıyı gösterip admine "yine de onayla" seçeneği sunar.
    if (mevcutSatir?.created_by_ai && !mevcutSatir?.is_approved && !updates.cakismayiKabulEt) {
      const kaynakIdler: string[] = Array.isArray(mevcutSatir?.source_listing_ids) ? mevcutSatir.source_listing_ids : [];
      let kaynakMetinler: (string | null)[] = [];
      if (kaynakIdler.length > 0) {
        const { data: kaynaklar } = await svc.from('raw_posts').select('raw_text').in('id', kaynakIdler);
        kaynakMetinler = (kaynaklar ?? []).map((k: any) => k.raw_text);
      }
      const cakismaUyarisi = await yayginKelimeCakismasiUyarisi(
        svc,
        {
          alias: alanlar.alias ?? mevcutSatir?.alias ?? '',
          normalized: alanlar.normalized ?? mevcutSatir?.normalized ?? '',
          priority: mevcutSatir?.priority,
        },
        kaynakMetinler,
      );
      if (cakismaUyarisi) {
        return NextResponse.json(
          { error: cakismaUyarisi.mesaj, cakisma_uyarisi: cakismaUyarisi, gerekliAlan: 'cakismayiKabulEt' },
          { status: 409 },
        );
      }
    }

    const { error } = await svc.from('aliases').update(payload).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      warning:
        ilceIlUyarisi(
          alanlar.normalized ?? mevcutSatir?.normalized,
          alanlar.district !== undefined ? alanlar.district : mevcutSatir?.district,
        ) ?? undefined,
    });
  }

  if (action === 'reject') {
    const { error } = await svc.from('aliases').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Alan güncelle
  // 🚨 W5/D2 — Dördüncü yazma noktası. Aynı normalizasyon + çakışma kapısı.
  const alanlar = normalizeAliasFields(updates);
  const izinli: Record<string, any> = {};
  if (alanlar.alias !== undefined) izinli.alias = alanlar.alias;
  if (alanlar.normalized !== undefined) izinli.normalized = alanlar.normalized;
  if (updates.type !== undefined) izinli.type = updates.type;
  if (alanlar.district !== undefined) izinli.district = alanlar.district;

  if (Object.keys(izinli).length === 0) {
    return NextResponse.json({ error: 'Guncellenecek alan yok' }, { status: 400 });
  }

  // #51 — dördüncü yazma noktası; uyarı burada da mevcut satırla tamamlanıyor.
  const { data: mevcutSatir } = await svc
    .from('aliases')
    .select('type, normalized, district')
    .eq('id', id)
    .single();

  if (alanlar.alias !== undefined || alanlar.normalized !== undefined || alanlar.district) {
    // Tip değişiyorsa YENİ tipe göre kontrol et — çakışma hedef tipte olur.
    const tip = (updates.type as string | undefined) ?? mevcutSatir?.type ?? 'city';
    const cakisma = await aliasCakismaBul(svc, { type: tip, ...alanlar, excludeId: id });
    if (cakisma) return NextResponse.json({ error: cakisma.mesaj, conflict: cakisma }, { status: 409 });
  }

  const { error } = await svc.from('aliases').update(izinli).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    warning:
      ilceIlUyarisi(
        alanlar.normalized ?? mevcutSatir?.normalized,
        alanlar.district !== undefined ? alanlar.district : mevcutSatir?.district,
      ) ?? undefined,
  });
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
