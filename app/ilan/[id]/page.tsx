import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Aksiyonlar from './Aksiyonlar';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { durakToplami } from '../../../lib/ilan-liste';
import { ilAdi } from '../../../lib/lokasyon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 8 Ağu 2026 — tek kaynak; canonical/og:url artık yönlenmeyen host (bkz. lib/site.ts).
import { SITE_URL } from '../../../lib/site';

// ── Ortak veri çekici — `generateMetadata` VE sayfa bileşeni paylaşır.
//
// 🚨 7 Ağu 2026 (performans): Next.js her `/ilan/[id]` isteğinde `generateMetadata`
// ile sayfa bileşenini AYRI AYRI çalıştırır. Bu fonksiyon eskiden `fetchIlanTemel`
// adıyla dar bir alan kümesiyle SADECE `generateMetadata` içindeydi; sayfa bileşeni
// KENDİ (daha geniş alanlı) sorgusunu ayrıca atıyordu — yani her sayfa açılışında
// AYNI satır için İKİ ayrı DB gidip-gelmesi oluyordu. `React.cache()` bunu tek
// istek içinde (aynı `id` argümanıyla) TEK çağrıya indiriyor — Next.js'in kendi
// önerdiği "generateMetadata + page dedup" deseni. Alan kümesi ikisinin
// İHTİYACININ BİRLEŞİMİ: `status` yalnız `generateMetadata`nın robots kuralında,
// `contact_phone`/`price_negotiable`/vb. yalnız sayfa gövdesinde kullanılıyor.
// 🚨 10 Ağu 2026 — `audit_score` bu SELECT'ten ÇIKARILDI. Sayfadaki dört yayın
//    noktası da kaldırıldığı için tüketicisi kalmadı; ayrıca kolon anon rolünden
//    `revoke` edilmiş durumda. İstemeye devam etmek, ileride birinin "hazır
//    geliyor" diye yeniden yayınlamasına davetiye olurdu. Bekçi: `npm run test:jsonld`.
const getIlan = cache(async (id: string) => {
  const { data } = await supabase
    .from('listings')
    .select(`
      id, listing_type, origin_province_id, origin_district,
      contact_phone, price_offer, price_negotiable,
      available_date, date_flexible, notes, source,
      created_at, moderation_status, is_shadow_banned, status,
      trust_level, user_id,
      vehicle_type, body_type,
      listing_stops (
        stop_order, province_id, district,
        vehicle_count, cargo_type, weight_ton, pallet_count, notes
      )
    `)
    .eq('id', id)
    .single();
  return data;
});

// ── Adım 1: Dinamik Metadata
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const ilan = await getIlan(id);
  if (!ilan || ilan.moderation_status === 'rejected' || ilan.is_shadow_banned) {
    return { title: 'İlan Bulunamadı | Yükegel' };
  }

  const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
  const varis = ilAdi(stops.at(-1)?.province_id) ?? '';
  const aracTip = (ilan.vehicle_type as string[] | null)?.[0] ?? '';
  const isYuk = ilan.listing_type === 'yuk';
  // Dalga 5: metin kolonu düştü, gösterim id'den türüyor.
  const kalkis = ilAdi(ilan.origin_province_id) ?? '';

  const baslik = [
    kalkis,
    varis && `→ ${varis}`,
    aracTip,
    isYuk ? 'Yük İlanı' : 'Araç İlanı',
    '| Yükegel',
  ].filter(Boolean).join(' ');

  // 🚨 Eskiden `stops.find(s => s.weight_ton)?.weight_ton` idi: çok duraklı bir
  // ilanda Google'a ve paylaşım önizlemesine SADECE ilk durağın tonajı gidiyordu
  // (25 tonluk ilan "8 ton" diye indeksleniyordu). Artık toplam.
  const agirlik = durakToplami(stops, ['weight_ton']);
  const kargoTip = stops.find((s: any) => s.cargo_type)?.cargo_type;

  // 8 Ağu 2026 — açıklama yeniden yazıldı. Eskisi virgülle dizilmiş bir liste
  // üretiyordu ("Tekirdağ (Çorlu), → İzmir, TIR aranıyor.") — okun önündeki virgül
  // bozuk duruyordu ve DURAK SAYISI hiç yoktu (çok duraklı ilanın en ayırt edici
  // bilgisi). Artık cümle kuruyor.
  //
  // ⚠️ TÜRKÇE HÂL EKİ (İzmir'DEN İstanbul'A) BİLEREK ÜRETİLMİYOR: özel adlarda
  //    ek seçimi ünlü uyumu + son ünsüzün sertliği + `Kırklareli`/`Çanakkale`
  //    gibi düzensiz biçimlerle birlikte güvenilir biçimde türetilemiyor.
  //    Yanlış ek ("İzmir'a") indekslenmiş metinde okla yazmaktan DAHA kötü
  //    görünür. "X → Y rotasında" hem eksiz hem doğru hem de arama sorgusuyla
  //    ("İzmir'den İstanbul'a") aynı iki il adını taşıyor.
  const rota = `${kalkis}${ilan.origin_district ? ` (${ilan.origin_district})` : ''}` +
    (varis ? ` → ${varis}` : '');
  const yuk = [agirlik ? `${agirlik} ton` : null, kargoTip]
    .filter(Boolean).join(' ');
  const description = [
    isYuk
      ? `${rota} rotasında ${yuk ? `${yuk} yükü` : 'yük'} için ${aracTip || 'araç'} aranıyor.`
      : `${rota} rotasında ${aracTip || 'araç'} müsait.`,
    stops.length > 1 ? `${stops.length} duraklı rota.` : null,
    // 🚨 10 Ağu 2026 — BURADA "Kalite Skoru: X/100" VARDI VE TERSİYDİ.
    //    `audit_score` bir RİSK skorudur (yüksek = kötü); Google bu metni
    //    indeksliyordu, yani en riskli ilanlar "Kalite Skoru: 100" diye
    //    aranabilir hâle geliyordu. Karar (Bayram, 10 Ağu): ibare tamamen kalksın.
    //    Denetim skoru İÇ VERİDİR — zaten öyle tasarlanmış (`audit_score` anon'dan
    //    `revoke` edilmiş durumda). Ayrıntı: `lib/metin-denetim.ts` başı.
    'Yükegel\'de nakliye ilanları.',
  ].filter(Boolean).join(' ');

  const url = `${SITE_URL}/ilan/${id}`;

  return {
    title: baslik,
    description,
    openGraph: {
      title: baslik,
      description,
      url,
      siteName: 'Yükegel',
      locale: 'tr_TR',
      type: 'website',
      // ⚠️ `images` BURADA YOK — `opengraph-image.tsx` dosya kuralı onu kendisi
      //    ekliyor (og:image + width/height/alt). Elle yazmak ikinci, ayrışabilir
      //    bir kaynak olurdu.
    },
    // 🚨 8 Ağu 2026 — `twitter` BLOĞU EKLENDİ. Yoksa kök layout'un site geneli
    //    başlığı/açıklaması miras alınıyordu: canlıda ölçüldü, ilan sayfasında
    //    twitter:title = "Yükegel - Türkiye'nin Nakliye İlan Platformu" çıkıyordu.
    //    Yani X/Twitter kartı ROTAYI DEĞİL genel sloganı gösteriyordu — og
    //    tarafı doğruyken twitter tarafı sessizce yanlıştı.
    twitter: {
      card: 'summary_large_image',
      title: baslik,
      description,
    },
    alternates: { canonical: url },
    robots: ilan.status === 'passive'
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

function yeniUye(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const otuzGunOnce = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return new Date(createdAt) > otuzGunOnce;
}

function dedupNormalize(arr: string[]): string[] {
  const norm = (s: string) => s.toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ş/g, 's')
    .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]/g, '');
  const seen = new Set<string>();
  return arr.filter(item => {
    const k = norm(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4 };
}

/** schema.org `City` düğümü; ilçe varsa `PostalAddress` ile zenginleştirir. */
function sehirDugumu(il: string, ilce: string | null | undefined) {
  return {
    '@type': 'City',
    name: il,
    ...(ilce
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: ilce,   // ilçe
            addressRegion: il,       // il
            addressCountry: 'TR',
          },
        }
      : {}),
  };
}

/**
 * JSON-LD'yi `<script>` içine GÜVENLE gömer.
 *
 * 🚨 9 Ağu 2026 — GİZLİ KIRILMA: `dangerouslySetInnerHTML` ile ham
 * `JSON.stringify` basılıyordu. JSON-LD'ye giren alanların bir kısmı SERBEST
 * METİN ve WhatsApp'tan geliyor (`cargo_type`, `district`). İçlerinden biri
 * `</script>` içerseydi tarayıcı script etiketini ORADA kapatır; JSON-LD
 * bozulur (Google "öğe algılanmadı" der) ve kalan metin SAYFAYA HTML olarak
 * enjekte edilir — yani aynı anda hem SEO hem XSS sorunu.
 *
 * ⚠️ Bugün veride `<`/`>`/`&` YOK (canlıda sorguladım: 4 alanın dördü de 0
 *    satır) — yani bu bug HENÜZ PATLAMAMIŞ. Düzeltmenin sebebi mevcut bir
 *    arıza değil, girdinin serbest olması: bir moderatör yük cinsine
 *    `</script>` yazdığı gün patlardı ve sebebi hiçbir testte görünmezdi.
 *
 * `<` → `<` kaçışı JSON içinde GEÇERLİDİR (aynı stringi üretir), yani
 * ayrıştırıcı için hiçbir şey değişmez; yalnız HTML ayrıştırıcısı script
 * sonunu erken görmez.
 */
function jsonLdGuvenli(veri: unknown): string {
  return JSON.stringify(veri)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export default async function IlanDetay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ── Auth istemcisi kurulumu ilan sorgusundan bağımsız — ikisi PARALEL atılır.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  // 🚨 7 Ağu 2026 (performans): `getIlan(id)` `generateMetadata` ile PAYLAŞILIYOR
  // (`React.cache()` — bkz. yukarıdaki tanım), yani bu çağrı ikinci bir DB
  // gidiş-gelişi DEĞİL, aynı isteğin önbelleğinden dönüyor. Ayrıca auth kontrolü
  // ilanı beklemeden AYNI ANDA başlıyor — ikisi de birbirinden bağımsız,
  // ardışık `await` iki ayrı ağ turu demekti.
  const [ilan, { data: { user } }] = await Promise.all([
    getIlan(id),
    supabaseAuth.auth.getUser(),
  ]);

  if (!ilan || ilan.moderation_status === 'rejected') return notFound();

  // ── Profil tamamlanmış mı (telefon gösterimi) + ilan sahibinin rozet bilgisi —
  // ikisi de BAĞIMSIZ satırlar (biri `user.id`, biri `ilan.user_id` sorguluyor),
  // aynı anda atılır.
  const [profilSonuc, kullaniciBilgiSonuc] = await Promise.all([
    user
      ? supabase.from('users').select('user_type').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null as { user_type: string | null } | null }),
    ilan.user_id
      ? supabase.from('users').select('phone_verified, created_at').eq('id', ilan.user_id).single()
      : Promise.resolve({ data: null as { phone_verified: boolean; created_at: string } | null }),
  ]);
  const profilTamamlandi = !!profilSonuc.data?.user_type;
  const kullaniciBilgi = kullaniciBilgiSonuc.data as { phone_verified: boolean; created_at: string } | null;

  // ── Sprint 1: Shadow ban kontrolü
  // Shadow banned ilan sadece ilan sahibi, moderatör ve admin tarafından görülebilir.
  // Nadir yol — yukarıdaki iki sorguyla paralelleştirilmedi: `user` yoksa zaten
  // hemen `notFound()` dönüyor, paralel atılan sorgular boşa gitmiş olurdu.
  if (ilan.is_shadow_banned) {
    if (!user) return notFound();
    const { data: profil } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = (profil as any)?.role;
    const isOwner = ilan.user_id === user.id;
    const isMod   = role === 'moderator' || role === 'admin';
    if (!isOwner && !isMod) return notFound();
  }

  const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
  const isYuk = ilan.listing_type === 'yuk';
  const kalkis = ilAdi(ilan.origin_province_id) ?? '';

  const aracTipleri = dedupNormalize(
    ilan.vehicle_type?.length
      ? ilan.vehicle_type
      : [...new Set(stops.map((s: any) => s.cargo_type).filter(Boolean))]
  );
  const ustyapilari = dedupNormalize(ilan.body_type || []);

  const dogrulanmamis = !ilan.user_id || ilan.trust_level === 'social';
  const telefonDogrulandi = kullaniciBilgi?.phone_verified === true;
  const isYeniUye = kullaniciBilgi ? yeniUye(kullaniciBilgi.created_at) : false;

  const KAYNAK_ETIKET: Record<string, { label: string; bg: string; color: string }> = {
    form:     { label: 'Yükegel',     bg: '#0d2b1a', color: '#22c55e' },
    whatsapp: { label: '📱 WhatsApp', bg: '#0d2b0d', color: '#4ade80' },
    facebook: { label: '👥 Facebook', bg: '#1e3a5f', color: '#60a5fa' },
  };
  const kaynak = KAYNAK_ETIKET[ilan.source] || KAYNAK_ETIKET.form;

  // ── Adım 2: JSON-LD (Structured Data)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: isYuk ? 'Karayolu Yük Nakliye İlanı' : 'Nakliye Aracı İlanı',
    description: `${kalkis} - ${ilAdi(stops.at(-1)?.province_id) ?? ''} arası nakliye`,
    provider: { '@type': 'Organization', name: 'Yükegel', url: SITE_URL },
    // ⚠️ schema.org `City` `name` alanı METİN bekler — id basılamaz. Bu yüzden
    //    JSON-LD, metin kolonunun düşmesinden sonra da `ilAdi()`'ye muhtaç.
    //
    // 9 Ağu 2026 — her şehre `PostalAddress` EKLENDİ. Önceden yalnız il ADI
    // vardı; ilçe bilgisi (`origin_district` / `stops[].district`) JSON-LD'ye
    // hiç girmiyordu, oysa DB'de duruyor. `addressRegion` = il, `addressLocality`
    // = ilçe, `addressCountry` = TR: bot "Konya'nın Kulu ilçesi" ayrımını
    // artık yapabiliyor.
    areaServed: [
      sehirDugumu(kalkis, ilan.origin_district),
      ...stops.map((s: any) => sehirDugumu(ilAdi(s.province_id) ?? '', s.district)),
    ],
    datePosted: ilan.created_at,
    ...(ilan.available_date && { availabilityStarts: ilan.available_date }),

    // 🚨 8 Ağu 2026 — FİYAT `offers` OLARAK EKLENDİ. Eskiden JSON-LD'de fiyat
    //    HİÇ YOKTU (ne `offers` ne `PropertyValue`) — yani botun en çok işine
    //    yarayacak iki alandan biri dışarıda kalıyordu.
    //    `PropertyValue` yerine `offers` seçildi: schema.org'un fiyat için
    //    KANONİK yolu bu; Google zengin sonuçlarda `Offer.price`i tanıyor,
    //    isimsiz bir PropertyValue'yu tanımıyor.
    //    ⚠️ `priceCurrency` ZORUNLU: para birimsiz `price` Rich Results
    //    testinde uyarı üretir ve "1400" hangi para birimi belirsiz kalır.
    ...(ilan.price_offer
      ? {
          offers: {
            '@type': 'Offer',
            price: Number(ilan.price_offer),
            priceCurrency: 'TRY',
            availability: ilan.status === 'active'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        }
      : {}),

    additionalProperty: [
      // Rota uçlarını AÇIKÇA da veriyoruz: `areaServed` sıralı bir yapı gibi
      // durmuyor (bir dizi şehir), oysa bot için "nereden/nereye" ayrımı kritik.
      { '@type': 'PropertyValue', name: 'from_city', value: kalkis },
      { '@type': 'PropertyValue', name: 'to_city', value: ilAdi(stops.at(-1)?.province_id) ?? '' },
      // TONAJ — spesifikasyonun istediği ikinci alan; bu da eksikti.
      // ⚠️ TOPLAM (`durakToplami`), tek durağın değeri DEĞİL: 12 duraklı bir
      //    ilanda ilk durağın tonajını yayınlamak yanlış veri indekslemek olur.
      { '@type': 'PropertyValue', name: 'total_weight_ton', value: durakToplami(stops, ['weight_ton']), unitText: 'TON' },
      { '@type': 'PropertyValue', name: 'total_pallet_count', value: durakToplami(stops, ['pallet_count']) },
      { '@type': 'PropertyValue', name: 'cargo_type', value: stops.find((s: any) => s.cargo_type)?.cargo_type ?? '' },
      { '@type': 'PropertyValue', name: 'vehicle_type', value: (ilan.vehicle_type as string[] | null)?.join(', ') ?? '' },
      { '@type': 'PropertyValue', name: 'body_type', value: (ilan.body_type as string[] | null)?.join(', ') ?? '' },
      { '@type': 'PropertyValue', name: 'stops_count', value: stops.length },
      // 🚨 10 Ağu 2026 — BURADA `quality_score: ilan.audit_score` VARDI VE TERSİYDİ.
      //    Yayınlanan her şey olgusal olmalı; `audit_score` bir RİSK ölçüsü ve
      //    "quality" adıyla AI botlarına gidiyordu. Kaldırıldı, yerine bir şey
      //    KONMADI: gerçek bir kalite sinyali üretmeden uydurmuş oluruz.
      //    Kalite/güven sinyali Faz 3'te (kullanıcı güven puanı) gelecek ve
      //    bu skordan BAĞIMSIZ olacak. Bekçi: `npm run test:jsonld`.
      { '@type': 'PropertyValue', name: 'source', value: ilan.source },
    ].filter(p => p.value !== '' && p.value !== null && p.value !== 0),
  };

  // ── BreadcrumbList — Google'ın ZENGİN SONUÇ ÜRETTİĞİ tipler arasında.
  //
  // 🚨 9 Ağu 2026, "hiçbir öğe algılanmadı" teşhisi: `Service` Google'ın
  //    desteklenen zengin sonuç tipleri listesinde YOK (developers.google.com/
  //    search/docs/appearance/structured-data/search-gallery). Yani o uyarı
  //    JSON-LD'nin BOZUK olduğunu değil, TİPİN o araç için uygun olmadığını
  //    söylüyordu — şema geçerliydi ve LLM/AI tarayıcıları onu zaten okuyor.
  //    `Breadcrumb` ise DESTEKLENEN bir tip; hem dürüst hem de araca "öğe"
  //    gösterecek olan bu.
  //
  // ⚠️ URL'LER GERÇEK OLMAK ZORUNDA — uydurma kırıntı, olmayan bir sayfaya
  //    işaret eden yapılandırılmış veridir. Bu sitede il bazlı ilan listesi
  //    rotası YOK (`HomeClient` URL'den yalnız `tip` okuyor), o yüzden
  //    "Konya ilanları" gibi bir kırıntı UYDURULMADI.
  //    `tip=yuk` VARSAYILAN olduğu için `/`ye normalize ediliyor (kod bunu
  //    bilerek yapıyor: aynı liste için iki URL oluşmasın). Bu yüzden yük
  //    ilanında ara kırıntı yok, araç ilanında `/?tip=arac` var.
  const kirintilar = [
    { name: 'Ana Sayfa', url: SITE_URL },
    ...(isYuk ? [] : [{ name: 'Araç İlanları', url: `${SITE_URL}/?tip=arac` }]),
    { name: `${kalkis} → ${ilAdi(stops.at(-1)?.province_id) ?? ''}`, url: `${SITE_URL}/ilan/${id}` },
  ];
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: kirintilar.map((k, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: k.name,
      item: k.url,
    })),
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Adım 2: JSON-LD — iki AYRI script.
          Tek bir dizi/`@graph` de geçerli ama ayrı etiketler her ayrıştırıcıda
          en güvenli okunan biçim; biri bozulsa diğeri ayakta kalır. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdGuvenli(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdGuvenli(breadcrumbLd) }}
      />

      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          <a href="/" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>← Tüm İlanlar</a>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

        {/* Üst etiketler */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6 }}>
            {isYuk ? '🔴 YÜK İLANI' : '🟢 ARAÇ İLANI'}
          </span>
          <span style={{ background: kaynak.bg, color: kaynak.color, fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>
            {kaynak.label}
          </span>

          {/* Doğrulanmamış İlan */}
          {dogrulanmamis && (() => {
            // ⚠️ SPRINT_01 L1c — wa.me linki numarayı URL'e gömüyor ve HTML'de herkese
            // görünüyordu. "Doğrulamasını İste" aksiyonu artık numara görme hakkı olan
            // (girişli + profili tamam) kullanıcıya açık; diğerlerine sadece rozet.
            const telefon = (user && profilTamamlandi) ? ilan.contact_phone?.replace(/\D/g, '') : null;
            const waNumara = telefon ? (telefon.startsWith('90') ? telefon : `90${telefon.replace(/^0/, '')}`) : null;
            const stops = (ilan.listing_stops as { stop_order: number; province_id: number | null }[] | null) ?? [];
            const varis = ilAdi(stops.sort((a, b) => a.stop_order - b.stop_order).at(-1)?.province_id);
            const ilanOzet = [kalkis, varis, ilan.vehicle_type].filter(Boolean).join('-');
            const mesaj = encodeURIComponent(`Merhaba, "${ilanOzet || 'yük'}" ilanınızı Yükegel'de gördüm.\nYükegel'de sahiplenerek yönetebilirsiniz: ${SITE_URL}/ilan/${ilan.id}/sahiplen`);
            return waNumara ? (
              <a href={`https://wa.me/${waNumara}?text=${mesaj}`} target="_blank" rel="noopener noreferrer"
                title="WhatsApp üzerinden ilan sahibinden doğrulamasını isteyin"
                style={{ background: '#292019', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                ⚠️ Doğrulanmamış İlan
                <span style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600, borderLeft: '1px solid #78350f', paddingLeft: 6 }}>
                  Doğrulamasını İste →
                </span>
              </a>
            ) : (
              <span title="Bu ilan Yükegel üyesi olmayan birinden geliyor."
                style={{ background: '#292019', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, cursor: 'help' }}>
                ⚠️ Doğrulanmamış İlan
              </span>
            );
          })()}

          {telefonDogrulandi && (
            <span title="Bu kullanıcının telefon numarası doğrulanmıştır."
              style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, cursor: 'help' }}>
              ✅ Telefon Doğrulandı
            </span>
          )}
          {isYeniUye && !dogrulanmamis && (
            <span title="Bu kullanıcı son 30 gün içinde üye olmuştur."
              style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, cursor: 'help' }}>
              🆕 Yeni Üye
            </span>
          )}
          {ilan.price_offer && (
            <span title="Fiyat bilgisi girilmiş."
              style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6, cursor: 'help' }}>
              ✓ Fiyat Belli
            </span>
          )}
          {/* Sprint 1: Moderatör/admin için shadow ban uyarısı */}
          {ilan.is_shadow_banned && (
            <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6 }}>
              👁 Shadow Ban (Sadece Sen Görüyorsun)
            </span>
          )}
          <span style={{ color: '#4b5563', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Adım 3: Semantik article + Rota

            🚨 10 Ağu 2026 — buradaki `data-quality-score={ilan.audit_score}`
            KALDIRILDI. Aynı ters skorun dördüncü yayın noktasıydı; `data-*`
            nitelikleri AI-readiness için makine-okunur olsun diye eklenmişti,
            yani bu da dışarıya açılan bir kanaldı. */}
        <article
          itemScope
          itemType="https://schema.org/Service"
          data-ai-label="listing"
          data-listing-id={ilan.id}
          data-listing-type={ilan.listing_type}
          data-verified={!dogrulanmamis ? 'true' : 'false'}
        >
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>ROTA</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <div style={{ width: 2, background: '#30363d', flex: 1, minHeight: 24, marginTop: 4 }} />
            </div>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 2 }}>KALKIŞ</div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }}>{kalkis}</div>
              {ilan.origin_district && <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>{ilan.origin_district}</div>}
            </div>
          </div>
          {/* Adım 3: Duraklar ol listesi olarak (semantik) */}
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Rota durakları">
          {stops.map((s: any, i: number) => {
          // ⚠️ `data-city` bir AI/scraper sözleşmesi — il ADI basmaya devam
          //    ediyor. Buraya id koymak dış tüketiciyi sessizce kırardı.
          const durakIl = ilAdi(s.province_id) ?? '';
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < stops.length - 1 ? 16 : 0 }} data-ai-label="stop" data-stop-order={s.stop_order} data-city={durakIl}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                {i < stops.length - 1 && <div style={{ width: 2, background: '#30363d', flex: 1, minHeight: 24, marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 2 }}>
                  {stops.length > 1 ? `VARIŞ ${i + 1}` : 'VARIŞ'}
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }} data-ai-label="city">{durakIl}</div>
                {s.district && <div style={{ color: '#8b949e', fontSize: '0.85rem' }} data-ai-label="district">{s.district}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {s.vehicle_count > 1 && <span key="adet" style={chipStyle('#1e3a5f', '#60a5fa')} data-ai-label="vehicle_count">🚛 {s.vehicle_count} araç</span>}
                  {s.weight_ton && <span key="ton" style={chipStyle('#1a2a1a', '#86efac')} data-ai-label="weight">{`⚖ ${s.weight_ton} ton`}</span>}
                  {s.pallet_count && <span key="palet" style={chipStyle('#1a2a1a', '#86efac')} data-ai-label="pallet_count">{`📦 ${s.pallet_count} palet`}</span>}
                </div>
                {s.notes && <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 6 }}>📝 {s.notes}</div>}
              </div>
            </li>
          );
          })}
          </ol>
        </div>

        {/* Araç Bilgileri */}
        {(aracTipleri.length > 0 || ustyapilari.length > 0) && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>ARAÇ BİLGİLERİ</div>
            {aracTipleri.length > 0 && (
              <div style={{ marginBottom: ustyapilari.length > 0 ? 14 : 0 }}>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 8 }}>Araç Tipi</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {aracTipleri.map(t => <span key={t} style={chipStyle('#1a2535', '#60a5fa')}>🚛 {t}</span>)}
                </div>
              </div>
            )}
            {ustyapilari.length > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 8 }}>Üst Yapı</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ustyapilari.map(u => <span key={u} style={chipStyle('#1f2937', '#94a3b8')}>{u}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detaylar */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>DETAYLAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {ilan.available_date && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Tarih</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {new Date(ilan.available_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  {ilan.date_flexible && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 6 }}>(esnek)</span>}
                </div>
              </div>
            )}
            {ilan.price_offer && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Ücret</div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem' }} data-ai-label="price">
                  ₺{Number(ilan.price_offer).toLocaleString('tr-TR')}
                  {ilan.price_negotiable && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 6 }}>(pazarlık)</span>}
                </div>
              </div>
            )}
          </div>
          {ilan.notes && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #30363d' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 6 }}>Not</div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>{ilan.notes}</div>
            </div>
          )}
        </div>

        {/* İletişim */}
        <div style={{ background: '#161b22', border: '1px solid #166534', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>İLETİŞİM</div>
          {user && profilTamamlandi ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700 }}>📞 {ilan.contact_phone}</div>
              <a href={`tel:${ilan.contact_phone}`}
                style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}>
                Hemen Ara
              </a>
            </div>
          ) : user && !profilTamamlandi ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 12 }}>
                Telefon numarasını görmek için profilinizi tamamlayın.
              </div>
              <a href="/profil-tamamla"
                style={{ display: 'inline-block', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}>
                Profili Tamamla
              </a>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 12 }}>
                Telefon numarasını görmek için giriş yapın.
              </div>
              {/* 🚨 10 Ağu 2026 — `rel="nofollow"` EKLENDİ, SAKIN KALDIRMA.
                  Search Console 8 Ağu'da "Robots.txt tarafından engellendi"
                  bildirimi gönderdi. Sebep buydu: bu bağlantı HER ilan sayfasında
                  var ve `redirect` parametresi yüzünden her ilan için AYRI bir URL
                  üretiyor. Google ilan sayfasını tarıyor (izinli), bu bağlantıyı
                  keşfediyor, sonra `Disallow: /giris` onu reddediyor — on binlerce
                  kez. robots.txt keşiften SONRA reddeder; `nofollow` keşfi
                  baştan engeller. Doğru katman bu.
                  ⚠️ Giriş sayfasının indekslenmemesi ZATEN doğru (arama değeri yok);
                  düzeltilen şey tarama bütçesi israfı ve rapor gürültüsü. */}
              <a href={`/giris?redirect=/ilan/${ilan.id}`} rel="nofollow"
                style={{ display: 'inline-block', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}>
                🔐 Giriş Yap / Kaydol
              </a>
            </div>
          )}
          <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 12 }}>
            Telefon numarası ilan sahibine aittir. Yükegel aracılık yapmaz.
          </div>
        </div>

        {/* 🚨 10 Ağu 2026 — "✓ Doğrulanmış Veri / Kalite Skoru: X/100" ROZETİ KALDIRILDI.
            SAKIN GERİ EKLEME. Koşulu `audit_score >= 70` idi ve `audit_score` bir
            RİSK skorudur (`>= 71` → shadow ban): rozet tam olarak **en riskli**
            ilanlara "doğrulanmış" diyordu. Kanıt: skoru >= 70 olan 166.657 ilanın
            TAMAMINDA `fired_rules` dolu. Üstelik ban eşiği 71 olduğu için rozet
            yalnız 70 puanlık — yani "bir kural ihlalinden shadow ban'a bir puan
            kalmış" — ilanlarda görünebiliyordu.

            Karar (Bayram, 10 Ağu): sayı ve ibare tamamen kalksın. Yerine bir şey
            KONMADI; sahte bir güven sinyali üretmemek için. Gerçek güven sinyali
            Faz 3'te gelecek (kullanıcı düzeyi güven puanı) ve bu skordan
            BAĞIMSIZ olacak — bkz. `docs/YAPILACAKLAR.md` madde 3. */}

        <Aksiyonlar
          ilanId={ilan.id}
          dogrulanmamis={dogrulanmamis}
          // SPRINT_01 L1c — client component prop'u flight payload'a serialize olur.
          // Numara yalnızca görme hakkı olana geçer; misafirde null.
          contactPhone={user && profilTamamlandi ? ilan.contact_phone : null}
          uyeGiris={!!user}
        />
        </article>
      </main>
    </div>
  );
}
