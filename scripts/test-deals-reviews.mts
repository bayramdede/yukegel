// scripts/test-deals-reviews.mts — Güvenli Etkileşim Faz 2 sözleşmesi.
//
// 🚨 NEDEN GERÇEK HTTP + GERÇEK OTURUM: bu modülün değeri tamamen YETKİ
// TABLOSUNA bağlı. "Yalnız ilan veren onaylar", "aynı kişi tek başına
// tamamlayamaz", "yalnız tamamlanmış iş değerlendirilir" kuralları istemciden
// atlanabilir olursa itibar sistemi baskı/sahtekârlık aracına döner. Bunları
// ancak KARŞI TARAFIN oturumuyla deneyerek kanıtlayabiliriz.
//
// ⚠️ CANLI DB'YE YAZAR: 2 geçici kullanıcı + 1 ilan + kayıtlar; sonunda SİLER.
// ÇALIŞTIRMA: dev sunucusu açıkken `npm run test:deals`

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
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

async function oturum(eposta: string, sifre: string) {
  const jar: { name: string; value: string }[] = [];
  const c = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => jar, setAll: (x) => { for (const k of x) jar.push({ name: k.name, value: k.value }); } },
  });
  const { error } = await c.auth.signInWithPassword({ email: eposta, password: sifre });
  if (error) throw new Error('giriş: ' + error.message);
  return jar.map(k => `${k.name}=${k.value}`).join('; ');
}
const cagir = (cookie: string, yol: string, method: string, govde?: unknown) =>
  fetch(`${TABAN}${yol}`, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: govde ? JSON.stringify(govde) : undefined,
  }).then(async r => ({ durum: r.status, veri: await r.json().catch(() => ({})) }));

const sifre = 'Dl!' + Math.random().toString(36).slice(2) + 'Aa1';
const epostaS = `deal-s-${Date.now()}@yukegel-test.local`;
const epostaC = `deal-c-${Date.now()}@yukegel-test.local`;
const epostaX = `deal-x-${Date.now()}@yukegel-test.local`;
let sId = '', cId = '', xId = '', ilanId = '', dealId = '';

try {
  // ── Kullanıcılar: shipper (ilan veren), carrier (nakliyeci), x (ilgisiz) ──
  for (const [ep, hedef] of [[epostaS, 's'], [epostaC, 'c'], [epostaX, 'x']] as const) {
    const { data, error } = await svc.auth.admin.createUser({ email: ep, password: sifre, email_confirm: true });
    if (error) throw new Error(error.message);
    const uid = data.user!.id;
    await svc.from('users').update({
      user_type: hedef === 'c' ? 'arac_sahibi' : 'yuk_sahibi',
      display_name: hedef.toUpperCase(), phone: '05001112233', phone_verified: true,
    }).eq('id', uid);
    if (hedef === 's') sId = uid; else if (hedef === 'c') cId = uid; else xId = uid;
  }

  // ── Shipper'a ait YAYINDA bir ilan ──
  const { data: ilan } = await svc.from('listings').insert({
    user_id: sId, listing_type: 'yuk', origin_province_id: 34,
    moderation_status: 'approved', status: 'active', is_shadow_banned: false,
    notes: 'deal testi', source: 'form', available_date: '2026-12-01',
  }).select('id').single();
  ilanId = ilan!.id;
  await svc.from('listing_stops').insert({ listing_id: ilanId, stop_order: 1, province_id: 6, district: 'Merkez' });

  const ck = { s: await oturum(epostaS, sifre), c: await oturum(epostaC, sifre), x: await oturum(epostaX, sifre) };

  // ── 1. Talep ────────────────────────────────────────────────────────────
  let r = await cagir(ck.s, '/api/deals', 'POST', { listing_id: ilanId, agreed_price: 5000 });
  ok('ilan veren KENDİ ilanına talep gönderemez', r.durum === 400, `${r.durum} ${JSON.stringify(r.veri)}`);

  r = await cagir(ck.c, '/api/deals', 'POST', { listing_id: ilanId, payment_terms_days: 30 });
  ok('🚨 fiyatsız talep reddedilir (agreed_price ZORUNLU)', r.durum === 400, `${r.durum} ${JSON.stringify(r.veri)}`);

  r = await cagir(ck.c, '/api/deals', 'POST', { listing_id: ilanId, payment_terms_days: 30, agreed_price: -5 });
  ok('🚨 negatif fiyat reddedilir', r.durum === 400, `${r.durum}`);

  r = await cagir(ck.c, '/api/deals', 'POST', {
    listing_id: ilanId, payment_terms_days: 30, agreed_price: 12500, note: 'Yükleme yardımcısı sende olsun.',
  });
  ok('nakliyeci talep gönderdi', r.durum === 200 && r.veri.deal?.status === 'requested',
     `${r.durum} ${JSON.stringify(r.veri)}`);
  ok('fiyat ve not kaydedildi', r.veri.deal?.agreed_price === 12500 && r.veri.deal?.note === 'Yükleme yardımcısı sende olsun.',
     JSON.stringify(r.veri.deal));
  dealId = r.veri.deal?.id;

  r = await cagir(ck.c, '/api/deals', 'POST', { listing_id: ilanId, agreed_price: 8000 });
  ok('aynı nakliyeci ikinci talep gönderemez', r.durum === 409, `${r.durum}`);

  // ── 2. YETKİ: onaylama yalnız ilan verende ──────────────────────────────
  r = await cagir(ck.c, `/api/deals/${dealId}`, 'PATCH', { action: 'onayla' });
  ok('🚨 nakliyeci KENDİ kaydını onaylayamaz', r.durum === 403, `${r.durum} ${JSON.stringify(r.veri)}`);

  r = await cagir(ck.x, `/api/deals/${dealId}`, 'PATCH', { action: 'onayla' });
  ok('🚨 ilgisiz kullanıcı kaydı göremez/onaylayamaz', r.durum === 403, `${r.durum}`);

  r = await cagir(ck.c, `/api/deals/${dealId}`, 'PATCH', { action: 'yola_cikti' });
  ok('mühürlenmemiş kayıt yola çıkamaz', r.durum === 409, `${r.durum}`);

  // ── 3. Mühürleme + yan etkiler ──────────────────────────────────────────
  r = await cagir(ck.s, `/api/deals/${dealId}`, 'PATCH', { action: 'onayla' });
  ok('ilan veren onayladı → matched', r.durum === 200 && r.veri.deal?.status === 'matched',
     `${r.durum} ${JSON.stringify(r.veri)}`);
  const { data: ilanSonra } = await svc.from('listings').select('status').eq('id', ilanId).single();
  ok('mühürlenince ilan feed’den çıktı (passive)', ilanSonra!.status === 'passive', `bulunan: ${ilanSonra!.status}`);

  // ── 4. Değerlendirme, TAMAMLANMADAN yapılamaz ───────────────────────────
  r = await cagir(ck.s, '/api/reviews', 'POST', { deal_id: dealId, rating: 1 });
  ok('🚨 tamamlanmamış işe değerlendirme YAZILAMAZ', r.durum === 409, `${r.durum} ${JSON.stringify(r.veri)}`);

  // ── 5. Tamamlama: beyan + KARŞI onay ────────────────────────────────────
  await cagir(ck.c, `/api/deals/${dealId}`, 'PATCH', { action: 'yola_cikti' });
  r = await cagir(ck.c, `/api/deals/${dealId}`, 'PATCH', { action: 'tamamla' });
  ok('nakliyeci "tamamlandı" beyan etti (durum değişmedi)',
     r.durum === 200 && r.veri.deal?.status === 'in_transit', `${r.durum} ${JSON.stringify(r.veri)}`);

  r = await cagir(ck.c, `/api/deals/${dealId}`, 'PATCH', { action: 'tamamla' });
  ok('🚨 AYNI kişi ikinci basışla tek taraflı tamamlayamaz', r.durum === 409, `${r.durum} ${JSON.stringify(r.veri)}`);

  r = await cagir(ck.s, `/api/deals/${dealId}`, 'PATCH', { action: 'tamamla' });
  ok('karşı taraf onayladı → completed', r.durum === 200 && r.veri.deal?.status === 'completed',
     `${r.durum} ${JSON.stringify(r.veri)}`);
  ok('çift kör penceresi (review_deadline) kuruldu', Boolean(r.veri.deal?.review_deadline));
  ok('ödeme vadesi hesaplandı (30 gün)', Boolean(r.veri.deal?.payment_maturity_date),
     `bulunan: ${r.veri.deal?.payment_maturity_date}`);

  // ── 6. Çift körleme uçtan uca ───────────────────────────────────────────
  r = await cagir(ck.s, '/api/reviews', 'POST', {
    deal_id: dealId, rating: 5,
    sub_ratings: { zamanindalik: 5, mal_guvenligi: 4, iletisim: 5, UYDURMA_ALAN: 9 },
    comment: 'Temiz iş, zamanında teslim.',
  });
  ok('ilan veren değerlendirdi, HENÜZ yayınlanmadı', r.durum === 200 && r.veri.yayinlandi === false,
     `${r.durum} ${JSON.stringify(r.veri)}`);

  const { data: rev1 } = await svc.from('reviews').select('sub_ratings, reviewer_role').eq('deal_id', dealId).single();
  ok('alt kriterler beyaz listeden geçti (uydurma alan atıldı)',
     !('UYDURMA_ALAN' in (rev1!.sub_ratings as object)) && (rev1!.sub_ratings as any).zamanindalik === 5,
     JSON.stringify(rev1!.sub_ratings));

  r = await cagir(ck.c, '/api/reviews', 'POST', { deal_id: dealId, rating: 4, comment: 'Ödeme hızlıydı.' });
  ok('karşı taraf da yazdı → İKİSİ yayınlandı', r.durum === 200 && r.veri.yayinlandi === true,
     `${r.durum} ${JSON.stringify(r.veri)}`);

  const { data: hepsi } = await svc.from('reviews')
    .select('published_at, is_hidden').eq('deal_id', dealId);
  ok('iki yorum da yayında', (hepsi ?? []).length === 2 && (hepsi ?? []).every(x => x.published_at));
  ok('yayın zamanları EŞ (eş zamanlı açılma)',
     new Set((hepsi ?? []).map(x => x.published_at)).size === 1);

  r = await cagir(ck.s, '/api/reviews', 'POST', { deal_id: dealId, rating: 1 });
  ok('mükerrer değerlendirme engellendi', r.durum === 409, `${r.durum}`);

  // ── 7. Denetim motoru: ihlalli metin sessizce gizlenir ──────────────────
  const { data: ilan2 } = await svc.from('listings').insert({
    user_id: sId, listing_type: 'yuk', origin_province_id: 35,
    moderation_status: 'approved', status: 'active', is_shadow_banned: false,
    notes: 'ikinci', source: 'form', available_date: '2026-12-01',
  }).select('id').single();
  const { data: d2 } = await svc.from('deals').insert({
    listing_id: ilan2!.id, shipper_id: sId, carrier_id: cId, status: 'completed',
    completed_at: new Date().toISOString(),
    review_deadline: new Date(Date.now() + 14 * 86400_000).toISOString(),
  }).select('id').single();

  // `safety_rules`taki GERÇEK bir kuralı eşiğin ÜSTÜNE çıkaracak metin.
  // ⚠️ Metin seçimi önemli: "İlan içine telefon gizlenmiş" kuralı 70 puan ama
  //    gizleme eşiği (reject_score_min) 71 — yani telefon TEK BAŞINA yetmiyor.
  //    "Dolandırıcılık Riski: platform dışı ödeme/kapora" kuralı 90 puan ve
  //    PRD md.5'in birebir örneği (IBAN talebi), o yüzden onu kullanıyoruz.
  r = await cagir(ck.s, '/api/reviews', 'POST', {
    deal_id: d2!.id, rating: 5, comment: 'Parayı iban ile disardan gonder, kapora ver',
  });
  const { data: gizliRev } = await svc.from('reviews')
    .select('is_hidden, audit_score, published_at').eq('deal_id', d2!.id).single();
  ok('ihlalli yorum 200 döndü (kullanıcıya hata GÖSTERİLMİYOR)', r.durum === 200, `${r.durum}`);
  ok('ihlalli yorum gizlendi ve yayınlanmadı',
     gizliRev!.is_hidden === true && gizliRev!.published_at === null,
     `is_hidden=${gizliRev!.is_hidden} audit=${gizliRev!.audit_score} published=${gizliRev!.published_at}`);

} finally {
  for (const uid of [sId, cId, xId].filter(Boolean)) {
    const { data: ids } = await svc.from('listings').select('id').eq('user_id', uid);
    for (const r of ids ?? []) {
      await svc.from('reviews').delete().in('deal_id',
        ((await svc.from('deals').select('id').eq('listing_id', r.id)).data ?? []).map(d => d.id));
      await svc.from('deals').delete().eq('listing_id', r.id);
      await svc.from('listing_stops').delete().eq('listing_id', r.id);
    }
    await svc.from('reviews').delete().eq('reviewer_id', uid);
    await svc.from('deals').delete().or(`shipper_id.eq.${uid},carrier_id.eq.${uid}`);
    await svc.from('listings').delete().eq('user_id', uid);
    await svc.from('users').delete().eq('id', uid);
    await svc.auth.admin.deleteUser(uid);
  }
  console.log('\n🧹 geçici kullanıcılar, ilanlar, kayıtlar ve yorumlar silindi');
}

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
