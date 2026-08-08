import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { ilAdi } from '../../../lib/lokasyon';
import { durakToplami } from '../../../lib/ilan-liste';

// 🚨 8 Ağu 2026 — İLAN BAŞINA DİNAMİK OG GÖRSELİ.
//
// ÖNCEDEN NE VARDI: yalnız kök `app/opengraph-image.jpg` (tek, statik, herkese
// aynı). Bir ilan WhatsApp'ta paylaşıldığında önizlemede genel Yükegel görseli
// çıkıyordu — rota, tonaj, araç tipi görünmüyordu. Yani paylaşımın en değerli
// bilgisi (nereden nereye, kaç ton) kartta YOKTU.
//
// ⚠️ VERİ NEDEN `page.tsx`'İN `getIlan()`'IYLA PAYLAŞILMIYOR: OG görseli
// tarayıcı/crawler tarafından AYRI BİR İSTEKLE çekiliyor. `React.cache()` yalnız
// TEK istek içinde paylaşır; burada paylaşılacak bir istek yok. O yüzden bu
// dosya kendi DAR sorgusunu atıyor (7 kolon) — `getIlan`'ın geniş alan kümesini
// buraya çekmek boşa maliyet olurdu.
//
// ⚠️ `contact_phone` BU SORGUDA YOK ve olmayacak: OG görseli herkese açık ve
// önbelleklenebilir bir kaynak (SPRINT_01 L1 kuralı burada da geçerli).

export const alt = 'Yükegel ilan önizlemesi — rota, tonaj ve araç tipi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const C = {
  bg: '#0d1117', kart: '#161b22', kenar: '#30363d',
  yesil: '#22c55e', mavi: '#60a5fa', turuncu: '#f97316',
  metin: '#e2e8f0', soluk: '#8b949e',
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: ilan } = await supabase
    .from('listings')
    .select(`
      listing_type, origin_province_id, origin_district, price_offer,
      moderation_status, is_shadow_banned, vehicle_type,
      listing_stops ( stop_order, province_id, district, weight_ton, pallet_count, cargo_type )
    `)
    .eq('id', id)
    .single();

  // Reddedilmiş/gölge-banlı ilan ya da bulunamayan id → MARKA KARTI döner.
  // Hata FIRLATMIYORUZ: OG görseli patlarsa paylaşım kartı görselsiz kalır ve
  // sebebi hiçbir yerde görünmez. Sessiz bozulma yerine nötr bir kart.
  const gizli = !ilan || ilan.moderation_status === 'rejected' || ilan.is_shadow_banned;

  if (gizli) {
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: C.bg,
        }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
            <span style={{ color: C.yesil }}>YÜKE</span>
            <span style={{ color: C.metin }}>GEL</span>
          </div>
          <div style={{ color: C.soluk, fontSize: 32, marginTop: 16 }}>
            Türkiye&apos;nin şoför dostu yük platformu
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const stops = [...(ilan.listing_stops ?? [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
  const kalkis = ilAdi(ilan.origin_province_id) ?? '—';
  const varis = ilAdi(stops.at(-1)?.province_id ?? null) ?? '—';
  const isYuk = ilan.listing_type === 'yuk';

  // ⚠️ TOPLAM tonaj/palet — `durakToplami` ile. Tek durağın değerini basmak çok
  //    duraklı ilanda yanlış bilgi yayınlamak olur (metadata tarafında bu hata
  //    daha önce yaşandı ve düzeltildi; aynısını burada tekrarlamıyoruz).
  const ton = durakToplami(stops, ['weight_ton']);
  const palet = durakToplami(stops, ['pallet_count']);
  const arac = (ilan.vehicle_type as string[] | null)?.[0] ?? '';
  // Uzun yük cinsi çipi kartı taşırabilir; kırp.
  const kargoHam = stops.find((s: any) => s.cargo_type)?.cargo_type ?? '';
  const kargo = kargoHam.length > 26 ? kargoHam.slice(0, 25) + '…' : kargoHam;

  // 🚨 `₺` (U+20BA) KULLANILMIYOR — ImageResponse'un varsayılan fontunda o glif
  //    YOK ve görselde tofu kutusu (▯) olarak çıkıyor. Tarayıcıda render edip
  //    gözle doğruladım: "▯25.000". Türk Lirası simgesi görece yeni bir karakter
  //    ve gömülü font altkümesinde bulunmuyor. Ekstra font indirmek yerine
  //    "TL" yazıyoruz — hem her fontta var hem paylaşım kartında daha okunur.
  const fiyat = ilan.price_offer
    ? `${Number(ilan.price_offer).toLocaleString('tr-TR')} TL`
    : null;

  const cipler = [
    ton ? { etiket: `${ton} ton`, renk: C.mavi } : null,
    palet ? { etiket: `${palet} palet`, renk: C.mavi } : null,
    arac ? { etiket: arac, renk: C.yesil } : null,
    kargo ? { etiket: kargo, renk: C.soluk } : null,
    stops.length > 1 ? { etiket: `${stops.length} duraklı`, renk: C.turuncu } : null,
  ].filter(Boolean) as { etiket: string; renk: string }[];

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: C.bg, padding: 56, justifyContent: 'space-between',
      }}>
        {/* Üst: marka + ilan tipi */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            <span style={{ color: C.yesil }}>YÜKE</span>
            <span style={{ color: C.metin }}>GEL</span>
          </div>
          <div style={{
            display: 'flex', background: isYuk ? '#450a0a' : '#0d2b1a',
            color: isYuk ? '#fca5a5' : '#86efac',
            fontSize: 28, fontWeight: 700, padding: '10px 24px', borderRadius: 10,
          }}>
            {isYuk ? 'YÜK İLANI' : 'ARAÇ İLANI'}
          </div>
        </div>

        {/* Orta: ROTA — kartın asıl bilgisi */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: C.metin, fontSize: 92, fontWeight: 800, letterSpacing: -3 }}>
              {kalkis}
            </span>
            <span style={{ color: C.turuncu, fontSize: 72, fontWeight: 800, margin: '0 28px' }}>→</span>
            <span style={{ color: C.metin, fontSize: 92, fontWeight: 800, letterSpacing: -3 }}>
              {varis}
            </span>
          </div>
          {(ilan.origin_district || stops.at(-1)?.district) && (
            <div style={{ display: 'flex', color: C.soluk, fontSize: 30, marginTop: 6 }}>
              {[ilan.origin_district, stops.at(-1)?.district].filter(Boolean).join('  →  ')}
            </div>
          )}
        </div>

        {/* Alt: çipler + fiyat */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {cipler.map((c, i) => (
              <div key={i} style={{
                display: 'flex', background: C.kart, border: `2px solid ${C.kenar}`,
                color: c.renk, fontSize: 30, fontWeight: 700,
                padding: '12px 24px', borderRadius: 10, marginRight: 14, marginTop: 10,
              }}>
                {c.etiket}
              </div>
            ))}
          </div>
          {fiyat && (
            <div style={{
              display: 'flex', background: '#14532d', color: C.yesil,
              fontSize: 46, fontWeight: 800, padding: '14px 32px', borderRadius: 12,
              marginLeft: 20,
            }}>
              {fiyat}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
