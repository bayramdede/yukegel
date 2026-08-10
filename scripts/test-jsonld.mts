// scripts/test-jsonld.mts — /ilan/[id] yapılandırılmış verisinin SÖZLEŞMESİ.
//
// 🚨 NEDEN VAR: JSON-LD hiçbir derleyici/lint tarafından denetlenmiyor. Bozulursa
// (kaçırılmış karakter, eksik zorunlu alan, tek durağın tonajının toplam sanılması)
// hata VERMEZ — Google sessizce "öğe algılanmadı" der ve bunu ancak aylar sonra
// Search Console'da fark edersin. Bu test o sessiz bozulmayı yakalar.
//
// Kapsam:
//   · JSON-LD blokları GERÇEKTEN ayrıştırılabiliyor mu (json.loads eşdeğeri)
//   · `Service` zorunlu/beklenen alanları + fiyat (`offers`) + tonaj
//   · `BreadcrumbList` Google'ın istediği biçimde mi (position/name/item)
//   · Kırıntı URL'leri GERÇEKTEN VAR MI (uydurma rota kontrolü — 200 dönmeli)
//   · `</script>` kaçışı: enjeksiyon/kırılma testi (canlı veriyle değil,
//     doğrudan kaçış fonksiyonuyla)
//   · Tonaj TOPLAM mı (çok duraklı ilanda ilk durağın değeri değil)
//
// ÇALIŞTIRMA: dev sunucusu açıkken `npm run test:jsonld`
//   (başka port: TEST_TABAN=http://localhost:3000 npm run test:jsonld)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const TABAN = process.env.TEST_TABAN ?? 'http://localhost:3199';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let gecti = 0; const hatalar: string[] = [];
const ok = (ad: string, kosul: boolean, ek = '') => {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); } else hatalar.push(`✗ ${ad}${ek ? `\n    ${ek}` : ''}`);
};

function bloklar(html: string): any[] {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const out: any[] = [];
  for (const m of html.matchAll(re)) out.push(JSON.parse(m[1])); // bozuksa burada patlar
  return out;
}

// ── Test edilecek ilanı DB'den seç: çok duraklı + tonajlı + fiyatlı olsun ──
const { data: aday } = await svc
  .from('listings')
  .select('id, origin_province_id, origin_district, price_offer, status, listing_stops(weight_ton, district)')
  .in('moderation_status', ['approved', 'auto_published'])
  .eq('is_shadow_banned', false)
  .not('price_offer', 'is', null)
  .limit(50);

const cokDurakli = (aday ?? []).find(l => (l.listing_stops as any[])?.length > 1
  && (l.listing_stops as any[]).some((s: any) => s.weight_ton));
if (!cokDurakli) { console.error('❌ uygun test ilanı bulunamadı'); process.exit(1); }

const beklenenTon = (cokDurakli.listing_stops as any[])
  .reduce((t, s) => t + Number(s.weight_ton ?? 0), 0);
const ilkDurakTon = Number((cokDurakli.listing_stops as any[])[0]?.weight_ton ?? 0);

console.log(`test ilanı: ${cokDurakli.id} · ${(cokDurakli.listing_stops as any[]).length} durak · toplam ${beklenenTon} ton\n`);

const html = await fetch(`${TABAN}/ilan/${cokDurakli.id}`).then(r => r.text());

// ── 1. Ayrıştırılabilirlik ────────────────────────────────────────────
let bl: any[] = [];
try { bl = bloklar(html); ok('JSON-LD blokları geçerli JSON', true); }
catch (e: any) { ok('JSON-LD blokları geçerli JSON', false, e.message); }

const service = bl.find(b => b['@type'] === 'Service');
const bc = bl.find(b => b['@type'] === 'BreadcrumbList');
ok('Service bloğu var', Boolean(service));
ok('BreadcrumbList bloğu var', Boolean(bc));

// ── 2. Service içeriği ────────────────────────────────────────────────
if (service) {
  ok('@context schema.org', service['@context'] === 'https://schema.org');
  ok('name dolu', Boolean(service.name));
  ok('provider.url kanonik host (www)', String(service.provider?.url).startsWith('https://www.'),
     `bulunan: ${service.provider?.url}`);
  ok('areaServed dizi', Array.isArray(service.areaServed));

  const adresli = (service.areaServed ?? []).filter((a: any) => a.address);
  const ilceliDurak = (cokDurakli.listing_stops as any[]).filter((s: any) => s.district).length
                    + (cokDurakli.origin_district ? 1 : 0);
  ok('ilçesi olan şehirlerde PostalAddress var', adresli.length === ilceliDurak,
     `PostalAddress'li: ${adresli.length}, ilçesi olan: ${ilceliDurak}`);
  if (adresli[0]) {
    ok('PostalAddress alanları doğru', adresli[0].address.addressCountry === 'TR'
      && Boolean(adresli[0].address.addressLocality) && Boolean(adresli[0].address.addressRegion),
      JSON.stringify(adresli[0].address));
  }

  // Fiyat
  ok('offers.price var', typeof service.offers?.price === 'number', JSON.stringify(service.offers));
  ok('offers.priceCurrency TRY', service.offers?.priceCurrency === 'TRY');
  ok('offers.availability status ile tutarlı',
     service.offers?.availability === (cokDurakli.status === 'active'
       ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'),
     `status=${cokDurakli.status} availability=${service.offers?.availability}`);

  const pv = Object.fromEntries((service.additionalProperty ?? []).map((p: any) => [p.name, p.value]));
  ok('from_city / to_city var', Boolean(pv.from_city && pv.to_city), JSON.stringify(pv));

  // 🚨 Tonaj TOPLAM mı? Bu hata sınıfı metadata tarafında bir kez yaşandı:
  //    çok duraklı ilanda İLK durağın tonajı yayınlanıyordu.
  ok('total_weight_ton TOPLAM (ilk durağın değeri değil)',
     Number(pv.total_weight_ton) === beklenenTon,
     `beklenen ${beklenenTon}, bulunan ${pv.total_weight_ton}, ilk durak ${ilkDurakTon}`);
}

// ── 3. BreadcrumbList biçimi (Google'ın istediği) ─────────────────────
if (bc) {
  const li = bc.itemListElement ?? [];
  ok('itemListElement dolu', li.length >= 2, `uzunluk: ${li.length}`);
  ok('her ListItem position/name/item taşıyor',
     li.every((x: any) => x['@type'] === 'ListItem' && typeof x.position === 'number' && x.name && x.item),
     JSON.stringify(li));
  ok('position 1..N sıralı', li.every((x: any, i: number) => x.position === i + 1));

  // ⚠️ UYDURMA KIRINTI KONTROLÜ: her URL gerçekten var olmalı.
  for (const x of li) {
    const yol = String(x.item).replace(/^https:\/\/www\.yukegel\.com/, TABAN);
    const durum = await fetch(yol, { redirect: 'manual' }).then(r => r.status).catch(() => 0);
    ok(`kırıntı URL çalışıyor: ${x.name}`, durum >= 200 && durum < 400, `${yol} → ${durum}`);
  }
}

// ── 4. `</script>` kaçışı ─────────────────────────────────────────────
// Kaçış fonksiyonunun kendisini sınıyoruz: kötü niyetli metin script etiketini
// kapatamamalı ama JSON anlamı DEĞİŞMEMELİ.
const kotu = { x: '</script><img src=x onerror=alert(1)>', y: 'A & B < C > D' };
const kacisli = JSON.stringify(kotu).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
ok('kaçışlı çıktıda ham `</script>` YOK', !kacisli.includes('</script>') && !kacisli.includes('<'));
ok('kaçış JSON anlamını BOZMUYOR', JSON.parse(kacisli).x === kotu.x && JSON.parse(kacisli).y === kotu.y);

// Sayfadaki gerçek script bloklarında da ham `</script>` sızıntısı olmamalı
const hamBlok = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).join('');
ok('sayfadaki JSON-LD içinde ham `<` yok', !hamBlok.includes('<'));

// ── 5. JobPosting KULLANILMAMALI (Google: yalnız gerçek iş ilanı) ─────
ok('JobPosting şeması KULLANILMIYOR (Google politikası)',
   !bl.some(b => b['@type'] === 'JobPosting'),
   'Yük ilanı bir iş ilanı değildir; yanlış kullanım manuel işlem riski taşır.');

// ── 6. 🚨 `audit_score` HİÇBİR YOLLA DIŞARI SIZMAMALI (10 Ağu 2026) ───
// `audit_score` bir RİSK skorudur (yüksek = kötü, >= 71 → shadow ban). Dört ayrı
// yerde "Kalite Skoru" olarak yayınlanıyordu ve değer TERS okunuyordu: rozet
// koşulu `>= 70` olduğu için tam olarak EN RİSKLİ ilanlara "✓ Doğrulanmış Veri"
// diyordu. Dördü birlikte kaldırıldı; bu blok geri gelmesini engelliyor.
//
// ⚠️ Neden metin araması: sızıntı dört FARKLI biçimde olabiliyordu (JSON-LD
//    PropertyValue, meta description, `data-quality-score` niteliği, görünür
//    rozet). Tek tek tip kontrolü yapmak birini kaçırırdı — tuzağın kendisi
//    "aynı sayı dört yerde" olmasıydı.
const props: any[] = (service?.additionalProperty ?? []) as any[];
ok('JSON-LD içinde `quality_score` YOK',
   !props.some(p => p?.name === 'quality_score'),
   'audit_score bir RİSK skoru — "quality" adıyla yayınlanamaz.');
ok('HTML içinde `data-quality-score` niteliği YOK',
   !html.includes('data-quality-score'));
ok('sayfada "Kalite Skoru" ibaresi YOK (rozet + meta description)',
   !html.includes('Kalite Skoru'),
   'Rozet koşulu `audit_score >= 70` idi; ban eşiği 71 — en riskliye "doğrulanmış" diyordu.');
ok('sayfada "Doğrulanmış Veri" rozeti YOK',
   !html.includes('Doğrulanmış Veri'));

// Makine-okunur uç da aynı sözleşmeye tabi.
//
// 🚨 BU BLOK BİR KEZ BOŞA GEÇTİ — mutasyon testi yakaladı, kaydı onun için duruyor.
// İlk hâli JSON-LD testinin kullandığı `cokDurakli` ilanını sorguluyordu. Ama o
// ilan `passive` (platformda çoğu ilan öyle) ve API bilerek 404 döndürüyor →
// `apiYanit.meta` `undefined` → `'kalite_skoru' in {}` = **false** → kontrol
// "geçti" diyordu. `kalite_skoru: 99` mutasyonu uygulandığında test bunu
// GÖRMEDİ. Boş nesne/dizi üzerinde yapılan "yok mu?" kontrolü her zaman geçer.
//
// Düzeltme iki parçalı: (1) API'nin GERÇEKTEN servis ettiği bir ilan seçilir,
// (2) böyle bir ilan yoksa kontrol SESSİZCE ATLANMAZ, açıkça düşer.
const { data: apiGorunur } = await svc
  .from('listings')
  .select('id')
  .neq('moderation_status', 'rejected')
  .eq('is_shadow_banned', false)
  .neq('status', 'passive')
  .limit(1)
  .maybeSingle();

if (!apiGorunur) {
  ok('API görünür bir ilan bulundu (kalite_skoru kontrolü için)', false,
     'Hiç aktif ilan yok → API sözleşmesi DOĞRULANAMADI. Bu kontrol boşa geçmesin ' +
     'diye bilerek düşürülüyor: WhatsApp beslemesi durmuşsa önce onu çalıştır.');
} else {
  const apiYanit = await fetch(`${TABAN}/api/ilanlar/${apiGorunur.id}`)
    .then(r => r.json()).catch(() => null);
  // ⚠️ ÖNCE yanıtın gerçekten bir ilan olduğunu kanıtla — aşağıdaki iki kontrol
  //    ancak o zaman anlamlı. `id` yoksa hata gövdesi geldi demektir.
  ok('API yanıtı gerçek bir ilan döndürdü (kontroller boşa geçmiyor)',
     Boolean(apiYanit?.id), `yanıt: ${JSON.stringify(apiYanit)?.slice(0, 200)}`);
  ok('/api/ilanlar/[id] yanıtında `kalite_skoru` YOK',
     Boolean(apiYanit?.id) && !('kalite_skoru' in (apiYanit.meta ?? {})),
     `meta: ${JSON.stringify(apiYanit?.meta)}`);
  ok('/api/ilanlar/[id] yanıtının hiçbir yerinde `audit_score` YOK',
     Boolean(apiYanit?.id) && !JSON.stringify(apiYanit).includes('audit_score'));
}

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
