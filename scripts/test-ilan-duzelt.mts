// scripts/test-ilan-duzelt.mts — `POST /api/ilan/duzelt` UÇTAN UCA sözleşmesi.
//
// 🚨 NEDEN GERÇEK HTTP: bu rota kullanıcının KENDİ ilanını düzenlediği bir
// YAZMA yolu. Korumaların hepsi sunucuda: sahiplik, düzenlenebilir durum
// beyaz listesi, araç/kasa tipi beyaz listesi, geçmiş tarih kuralı ve
// "kullanıcının pasif kararını ezme" koruması. Bunları istemciden okuyarak
// doğrulamak bir şey kanıtlamaz — istemci zaten atlatılabilir. Bu yüzden test
// GERÇEK bir oturum çerezi üretip rotayı HTTP üzerinden çağırıyor.
//
// ⚠️ CANLI DB'YE YAZAR: geçici bir kullanıcı + ilan oluşturur, sonunda SİLER.
// Test ilanı DAİMA `status='passive'` — hiçbir aşamada herkese açık feed'e
// düşmez. Çalıştırma: DEV SUNUCUSU AÇIKKEN `npm run test:ilan-duzelt`.

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync } from 'node:fs';

const TABAN = process.env.TEST_TABAN ?? 'http://localhost:3199';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY);

let gecti = 0; const hatalar: string[] = [];
function ok(ad: string, kosul: boolean, ek = '') {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); }
  else hatalar.push(`✗ ${ad}${ek ? '\n    ' + ek : ''}`);
}

const eposta = `duzelt-test-${Date.now()}@yukegel-test.local`;
const sifre = 'Test!' + Math.random().toString(36).slice(2) + 'Aa1';
let userId = '', ilanId = '', cookieHeader = '';

try {
  // ── 1. Geçici kullanıcı + oturum çerezi ────────────────────────────────
  const { data: uData, error: uErr } = await svc.auth.admin.createUser({
    email: eposta, password: sifre, email_confirm: true,
  });
  if (uErr) throw new Error('kullanıcı oluşturulamadı: ' + uErr.message);
  userId = uData.user!.id;
  await svc.from('users').update({ user_type: 'yuk_sahibi', display_name: 'Düzelt Testi' }).eq('id', userId);

  // Çerez formatını ELLE kurmuyoruz — @supabase/ssr'ın kendisine yazdırıyoruz,
  // böylece sunucunun okuduğu formatla birebir aynı olur.
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(URL_, ANON, {
    cookies: { getAll: () => jar, setAll: (c) => { for (const k of c) jar.push({ name: k.name, value: k.value }); } },
  });
  const { error: sErr } = await ssr.auth.signInWithPassword({ email: eposta, password: sifre });
  if (sErr) throw new Error('giriş yapılamadı: ' + sErr.message);
  cookieHeader = jar.map(c => `${c.name}=${c.value}`).join('; ');
  ok('oturum çerezi üretildi', jar.length > 0, `çerez sayısı: ${jar.length}`);

  // ── 2. Test ilanı (DAİMA passive) ──────────────────────────────────────
  async function ilanKur(moderation: string, status = 'passive', ekstra: Record<string, unknown> = {}) {
    if (ilanId) await svc.from('listings').delete().eq('id', ilanId);
    const { data, error } = await svc.from('listings').insert({
      user_id: userId, listing_type: 'yuk', origin_province_id: 34,
      moderation_status: moderation, status,
      notes: 'baslangic notu', vehicle_type: ['TIR'], body_type: ['Tenteli'],
      price_offer: 1000, price_negotiable: false,
      available_date: '2026-12-01', date_flexible: false,
      source: 'form', ...ekstra,
    }).select('id').single();
    if (error) throw new Error('ilan kurulamadı: ' + error.message);
    ilanId = data.id;
  }
  const cagir = (govde: Record<string, unknown>) =>
    fetch(`${TABAN}/api/ilan/duzelt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify(govde),
    }).then(async r => ({ durum: r.status, veri: await r.json().catch(() => ({})) }));
  const oku = () => svc.from('listings')
    .select('notes, vehicle_type, body_type, price_offer, price_negotiable, available_date, date_flexible, moderation_status, status, is_shadow_banned')
    .eq('id', ilanId).single().then(r => r.data as any);

  // ── 3. Oturumsuz çağrı reddedilmeli ───────────────────────────────────
  const anon = await fetch(`${TABAN}/api/ilan/duzelt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' }),
  });
  ok('oturumsuz → 401', anon.status === 401, `gelen: ${anon.status}`);

  // ── 4. YENİ: yayındaki (approved) ilan düzenlenebilir ─────────────────
  await ilanKur('approved', 'passive');
  let r = await cagir({ id: ilanId, notes: 'yeni not', price_offer: 25000,
                        price_negotiable: true, available_date: '2026-12-15', date_flexible: true });
  ok('approved ilan düzenlenebiliyor (ESKİDEN 400 dönüyordu)', r.durum === 200,
     `${r.durum} ${JSON.stringify(r.veri).slice(0, 160)}`);
  let s = await oku();
  ok('not kaydedildi', s.notes === 'yeni not', `bulunan: ${s.notes}`);
  ok('fiyat kaydedildi', Number(s.price_offer) === 25000, `bulunan: ${s.price_offer}`);
  ok('pazarlık kaydedildi', s.price_negotiable === true);
  ok('tarih kaydedildi', s.available_date === '2026-12-15', `bulunan: ${s.available_date}`);
  ok('tarih esnek kaydedildi', s.date_flexible === true);
  // 🚨 EN KRİTİK: kullanıcının "pasif" kararı EZİLMEMELİ
  ok('pasif kararı korundu (status hâlâ passive)', s.status === 'passive', `bulunan: ${s.status}`);

  // ── 5. correction_needed → temiz düzenleme yayına almalı ──────────────
  await ilanKur('correction_needed', 'passive');
  r = await cagir({ id: ilanId, notes: 'temiz not' });
  s = await oku();
  ok('correction_needed → approved', r.durum === 200 && s.moderation_status === 'approved',
     `${r.durum} / ${s.moderation_status}`);
  ok('correction_needed → status active (moderasyonun pasifi kalkar)', s.status === 'active',
     `bulunan: ${s.status}`);

  // ── 6. rejected DÜZENLENEMEZ ──────────────────────────────────────────
  await ilanKur('rejected', 'passive');
  r = await cagir({ id: ilanId, notes: 'sizmaya calis' });
  s = await oku();
  ok('rejected → 400', r.durum === 400, `gelen: ${r.durum}`);
  ok('rejected ilanın notu DEĞİŞMEDİ', s.notes === 'baslangic notu', `bulunan: ${s.notes}`);

  // ── 7. tamamlanmış ilan DÜZENLENEMEZ ──────────────────────────────────
  await ilanKur('approved', 'passive', { completed_at: new Date().toISOString() });
  r = await cagir({ id: ilanId, notes: 'tamamlanmisi degistir' });
  ok('completed_at dolu → 400', r.durum === 400, `gelen: ${r.durum}`);

  // ── 8. Araç/kasa tipi BEYAZ LİSTE (eskiden doğrulanmıyordu) ───────────
  await ilanKur('approved', 'passive');
  r = await cagir({ id: ilanId, vehicle_type: ['TIR', 'UYDURMA_ARAC', 'x'.repeat(300)],
                    body_type: ['Tenteli', '<script>alert(1)</script>'] });
  s = await oku();
  ok('beyaz liste dışı araç tipi atıldı', JSON.stringify(s.vehicle_type) === JSON.stringify(['TIR']),
     `bulunan: ${JSON.stringify(s.vehicle_type)}`);
  ok('beyaz liste dışı kasa tipi atıldı', JSON.stringify(s.body_type) === JSON.stringify(['Tenteli']),
     `bulunan: ${JSON.stringify(s.body_type)}`);

  // ── 9. Geçmiş tarih: DEĞİŞTİRİLİRSE reddedilir ────────────────────────
  r = await cagir({ id: ilanId, available_date: '2020-01-01' });
  ok('geçmiş tarihe DEĞİŞTİRME → 400', r.durum === 400, `gelen: ${r.durum}`);

  // ── 10. Geçmiş tarih AYNEN geri gönderilirse engellenmez ──────────────
  //     (eski ilanın notunu düzeltirken kilitlenmemeli)
  await ilanKur('approved', 'passive', { available_date: '2020-05-05' });
  r = await cagir({ id: ilanId, notes: 'eski ilanin notu', available_date: '2020-05-05' });
  ok('değişmeyen geçmiş tarih engellemiyor', r.durum === 200, `gelen: ${r.durum} ${JSON.stringify(r.veri).slice(0,120)}`);

  // ── 11. BAŞKASININ ilanı düzenlenemez ─────────────────────────────────
  const { data: baskasi } = await svc.from('listings')
    .select('id').neq('user_id', userId).not('user_id', 'is', null).limit(1).single();
  if (baskasi) {
    r = await cagir({ id: baskasi.id, notes: 'baskasinin ilani' });
    ok('başkasının ilanı → 403', r.durum === 403, `gelen: ${r.durum}`);
  } else {
    console.log('… başkasına ait ilan bulunamadı, 403 kontrolü atlandı');
  }

  // ── 12. Gönderilmeyen alan MEVCUT değerini korur ──────────────────────
  await ilanKur('approved', 'passive');
  r = await cagir({ id: ilanId, notes: 'sadece not' });
  s = await oku();
  ok('gönderilmeyen fiyat korundu', Number(s.price_offer) === 1000, `bulunan: ${s.price_offer}`);
  ok('gönderilmeyen tarih korundu', s.available_date === '2026-12-01', `bulunan: ${s.available_date}`);
  ok('gönderilmeyen araç tipi korundu', JSON.stringify(s.vehicle_type) === JSON.stringify(['TIR']),
     `bulunan: ${JSON.stringify(s.vehicle_type)}`);

  // ── 13. 🟡 SARI BAYRAK (Bayram'ın 10 Ağu kararı) ──────────────────────
  // İletişim bilgisi tetiklenince ilan KAPATILMAMALI: moderatör onayına
  // düşmeli, shadow ban YEMEMELİ ve kullanıcı NE OLDUĞUNU anlamalı.
  await ilanKur('approved', 'active');
  r = await cagir({ id: ilanId, notes: 'Detay icin 0532 111 22 33 numarasindan ara' });
  s = await oku();
  ok('ayraçlı telefon artık yakalanıyor (normalizasyon)', s.moderation_status === 'pending',
     `moderation=${s.moderation_status} (eskiden ayraçlı numara kaçıyordu → approved kalırdı)`);
  ok('🟡 ilan KAPATILMADI (shadow ban yok)', s.is_shadow_banned === false,
     `is_shadow_banned=${s.is_shadow_banned}`);
  ok('🟡 kullanıcıya iletişim odaklı Sarı Bayrak mesajı gösterildi',
     String(r.veri?.mesaj || '').includes('iletişim bilgileri'),
     `mesaj: ${r.veri?.mesaj}`);
  ok('🟡 mesaj ilanın silinmediğini söylüyor',
     String(r.veri?.mesaj || '').includes('silinmedi'), `mesaj: ${r.veri?.mesaj}`);

  // WhatsApp daveti de aynı akışı tetiklemeli
  await ilanKur('approved', 'active');
  r = await cagir({ id: ilanId, notes: 'whatsapp tan yazin' });
  s = await oku();
  ok('whatsapp daveti moderatör onayına düşürüyor', s.moderation_status === 'pending',
     `moderation=${s.moderation_status}`);
  ok('whatsapp daveti ilanı KAPATMIYOR', s.is_shadow_banned === false);

  // ⚠️ Ama iletişim DIŞI ağır ihlal varsa Sarı Bayrak mesajı GÖSTERİLMEMELİ
  await ilanKur('approved', 'active');
  r = await cagir({ id: ilanId, notes: 'kapora gonder iban vereyim' });
  s = await oku();
  ok('ağır ihlal (kapora/IBAN) hâlâ kapatıyor', s.moderation_status === 'correction_needed'
     && s.is_shadow_banned === true, `moderation=${s.moderation_status} shadow=${s.is_shadow_banned}`);
  ok('ağır ihlalde Sarı Bayrak mesajı GÖSTERİLMİYOR',
     !String(r.veri?.mesaj || '').includes('iletişim bilgileri'), `mesaj: ${r.veri?.mesaj}`);

} finally {
  // ── Temizlik ───────────────────────────────────────────────────────────
  if (ilanId) await svc.from('listings').delete().eq('id', ilanId);
  if (userId) {
    await svc.from('listings').delete().eq('user_id', userId);
    await svc.from('users').delete().eq('id', userId);
    await svc.auth.admin.deleteUser(userId);
  }
  console.log(`\n🧹 temizlik: geçici kullanıcı ve ilan silindi (${eposta})`);
}

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
