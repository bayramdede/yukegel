// scripts/test-mukerrer.mts — `npm run test:mukerrer`
//
// Birleşik mükerrer hash'i (Bayram, 11 Ağu 2026). İki katman:
//   A) `dedupHashHesapla()` birim davranışı — hangi alan farkı hash'i
//      değiştirir, hangisi (biçim farkı) DEĞİŞTİRMEZ.
//   B) `ilanYaz()` uçtan uca — CANLI DB'ye gerçek yazar, sonra siler:
//      · aynı ilan ikinci kez → mükerrer (engellenir)
//      · ilçe/araç/tonaj farkı → mükerrer DEĞİL
//      · tamamlanmış (completed_at) bir işin aynısı → mükerrer DEĞİL
//        (11 Ağu'da düzeltilen bug'ın regresyon bekçisi)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const { dedupHashHesapla } = await import('../lib/dedup');
const { ilanYaz } = await import('../lib/ilan-yaz');

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let gecti = 0; const hatalar: string[] = [];
const ok = (ad: string, kosul: boolean, ek = '') => {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); } else hatalar.push(`✗ ${ad}${ek ? `\n    ${ek}` : ''}`);
};

// ── A) BİRİM: dedupHashHesapla ─────────────────────────────────────────────
const temel = {
  tip: 'yuk', telefon: '05001112233',
  rota: [{ province_id: 59, district: 'Çorlu' }, { province_id: 34, district: 'Merkez' }],
  vehicleType: ['TIR'], bodyType: ['Tenteli'], toplamTon: 20, toplamPalet: 10, tarih: '2026-12-15',
};
const h = (o: Partial<typeof temel>) => dedupHashHesapla({ ...temel, ...o } as any);

ok('aynı girdi → aynı hash', h({}) === h({}));
ok('telefon biçimi (+90 / 0) fark ETMEZ', h({ telefon: '+905001112233' }) === h({ telefon: '05001112233' }),
   'aynı numara farklı format aynı hash olmalı');
ok('ilçe büyük/küçük/aksan fark ETMEZ', h({ rota: [{ province_id: 59, district: 'ÇORLU' }, { province_id: 34, district: 'merkez' }] }) === h({}));
ok('araç/kasa SIRASI fark ETMEZ', dedupHashHesapla({ ...temel, vehicleType: ['Kamyon', 'TIR'] } as any)
   === dedupHashHesapla({ ...temel, vehicleType: ['TIR', 'Kamyon'] } as any));
ok('🚨 ilçe FARKI hash degistirir (Corlu->Ergene)',
   h({ rota: [{ province_id: 59, district: 'Ergene' }, { province_id: 34, district: 'Merkez' }] }) !== h({}));
ok('🚨 arac tipi farki hash degistirir', h({ vehicleType: ['Kamyon'] }) !== h({}));
ok('🚨 tonaj farki hash degistirir', h({ toplamTon: 25 }) !== h({}));
ok('🚨 tarih farki hash degistirir', h({ tarih: '2026-12-16' }) !== h({}));
ok('🚨 tip farki (yuk/arac) hash degistirir', h({ tip: 'arac' }) !== h({}));

// ── B) UÇTAN UCA: ilanYaz ──────────────────────────────────────────────────
const eposta = `mukerrer-${Date.now()}@yukegel-test.local`;
let userId = '';
const yazilanIdler: string[] = [];

async function yaz(over: Partial<Parameters<typeof ilanYaz>[1]> = {}) {
  return ilanYaz(userId, {
    tip: 'yuk', kalkis: 'Tekirdağ', kalkis_ilce: 'Çorlu', tarih: '2026-12-15',
    arac_tipi: 'TIR',
    duraklar: [{ sehir: 'İstanbul', ilce: 'Merkez', ton: '20', palet: '10' }],
    ...over,
  }, 'form');
}

try {
  const { data } = await svc.auth.admin.createUser({
    email: eposta, password: 'Dl!' + Math.random().toString(36).slice(2) + 'Aa1', email_confirm: true,
  });
  userId = data.user!.id;
  await svc.from('users').update({ user_type: 'yuk_sahibi', display_name: 'MUKERRER', phone: '05001112233' }).eq('id', userId);

  let r = await yaz();
  ok('ilk ilan yazıldı', r.ok, JSON.stringify(r));
  if (r.ok) yazilanIdler.push(r.id);

  r = await yaz();
  ok('🚨 birebir aynı ilan İKİNCİ kez → mükerrer', !r.ok && !!(r as any).mukerrer,
     JSON.stringify(r));

  r = await yaz({ kalkis_ilce: 'Ergene' });
  ok('kalkış ilçesi farklı (Çorlu→Ergene) → mükerrer DEĞİL', r.ok, JSON.stringify(r));
  if (r.ok) yazilanIdler.push(r.id);

  r = await yaz({ arac_tipi: 'Kamyon' });
  ok('araç tipi farklı → mükerrer DEĞİL', r.ok, JSON.stringify(r));
  if (r.ok) yazilanIdler.push(r.id);

  r = await yaz({ duraklar: [{ sehir: 'İstanbul', ilce: 'Merkez', ton: '25', palet: '10' }] });
  ok('tonaj farklı → mükerrer DEĞİL', r.ok, JSON.stringify(r));
  if (r.ok) yazilanIdler.push(r.id);

  // 🚨 Regresyon: tamamlanmış işin aynısı yeniden girilebilmeli.
  // İlk ilanı "tamamlanmış" işaretle (completed_at dolu), sonra AYNISINI gir.
  await svc.from('listings').update({ completed_at: new Date().toISOString(), status: 'passive' }).eq('id', yazilanIdler[0]);
  r = await yaz();
  ok('🚨 tamamlanmış (completed_at) işin aynısı → mükerrer DEĞİL (regresyon)', r.ok, JSON.stringify(r));
  if (r.ok) yazilanIdler.push(r.id);

} finally {
  if (yazilanIdler.length) {
    await svc.from('listing_stops').delete().in('listing_id', yazilanIdler);
    await svc.from('listings').delete().in('id', yazilanIdler);
  }
  // Güvenlik: kullanıcının bu testte kalan tüm ilanlarını da temizle.
  if (userId) {
    const { data: kalan } = await svc.from('listings').select('id').eq('user_id', userId);
    for (const l of kalan ?? []) {
      await svc.from('listing_stops').delete().eq('listing_id', l.id);
      await svc.from('listings').delete().eq('id', l.id);
    }
    await svc.from('users').delete().eq('id', userId);
    await svc.auth.admin.deleteUser(userId);
  }
  console.log('\n🧹 geçici kullanıcı ve ilanlar silindi');
}

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
