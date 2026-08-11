// scripts/test-mukerrer.mts — `npm run test:mukerrer`
//
// 11 Ağu 2026 — Bayram'ın canlıda yaşadığı iki bug, `mukerrerBul()`
// (`lib/ilan-limit.ts`) üzerinde doğrudan (HTTP'siz, dev sunucusu GEREKMEZ):
//
//   1) TAMAMLANMIŞ bir iş (deal completed → listings.status='passive',
//      completed_at DOLU) aktif hiçbir ilan yokken bile "mükerrer" sayılıp
//      yeni ilanı engelliyordu. Düzeltme: `completed_at IS NOT NULL` artık
//      aday dışı.
//   2) Anahtar yalnız İL bazlıydı, İLÇE'ye bakmıyordu. Tekirdağ-Çorlu'dan
//      Tekirdağ-Ergene'ye çıkış ilçesi değiştirilince (aynı il, FARKLI ilçe)
//      yine "mükerrer" diye engellendi. Düzeltme: anahtara origin_district /
//      ilk durağın district'i eklendi.
//
// ⚠️ CANLI DB'YE YAZAR: 1 geçici kullanıcı + birkaç ilan; sonunda SİLER.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
// `lib/auth.ts::getServiceSupabase()` bu ikisini process.env'den okuyor —
// `mukerrerBul` onu ÇAĞIRDIĞI anda (import anında değil) okunduğu için burada
// atamak yeterli.
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const { mukerrerBul } = await import('../lib/ilan-limit');

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let gecti = 0; const hatalar: string[] = [];
const ok = (ad: string, kosul: boolean, ek = '') => {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); } else hatalar.push(`✗ ${ad}${ek ? `\n    ${ek}` : ''}`);
};

const TEKIRDAG = 59; // il id — `docs/COGRAFI_GECIS.md` plaka kodları
const ISTANBUL = 34;
const eposta = `mukerrer-${Date.now()}@yukegel-test.local`;
const tarih = '2026-12-15';
let userId = '';
const ilanIdler: string[] = [];

async function ilanAc(opts: {
  status: string; moderation_status: string; completed_at?: string | null;
  origin_district: string | null; durakIlce: string | null;
}) {
  const { data } = await svc.from('listings').insert({
    user_id: userId, listing_type: 'yuk', origin_province_id: TEKIRDAG,
    origin_district: opts.origin_district,
    moderation_status: opts.moderation_status, status: opts.status,
    is_shadow_banned: false, notes: 'mükerrer testi', source: 'form',
    available_date: tarih, completed_at: opts.completed_at ?? null,
  }).select('id').single();
  const id = data!.id as string;
  ilanIdler.push(id);
  await svc.from('listing_stops').insert({
    listing_id: id, stop_order: 1, province_id: ISTANBUL, district: opts.durakIlce,
  });
  return id;
}

try {
  const { data } = await svc.auth.admin.createUser({
    email: eposta, password: 'Dl!' + Math.random().toString(36).slice(2) + 'Aa1', email_confirm: true,
  });
  userId = data.user!.id;
  await svc.from('users').update({ user_type: 'yuk_sahibi', display_name: 'MÜKERRER-TEST' }).eq('id', userId);

  // ── 1. TAMAMLANMIŞ iş mükerrer SAYILMAMALI ──────────────────────────────
  await ilanAc({
    status: 'passive', moderation_status: 'approved', completed_at: new Date().toISOString(),
    origin_district: 'Çorlu', durakIlce: 'Merkez',
  });
  let sonuc = await mukerrerBul({
    userId, tip: 'yuk', kalkisIlId: TEKIRDAG, kalkisIlce: 'Çorlu',
    ilkDurakIlId: ISTANBUL, ilkDurakIlce: 'Merkez', tarih,
  });
  ok('🚨 tamamlanmış iş varken, aktif ilan yokken → mükerrer SAYILMAZ', sonuc === null,
     JSON.stringify(sonuc));

  // ── 2. AKTİF bir ilan aç: Tekirdağ-Çorlu → İstanbul-Merkez ──────────────
  const aktifId = await ilanAc({
    status: 'active', moderation_status: 'approved',
    origin_district: 'Çorlu', durakIlce: 'Merkez',
  });

  // Aynı il-ilçe, aynı tarih → GERÇEK mükerrer, yakalanmalı.
  sonuc = await mukerrerBul({
    userId, tip: 'yuk', kalkisIlId: TEKIRDAG, kalkisIlce: 'Çorlu',
    ilkDurakIlId: ISTANBUL, ilkDurakIlce: 'Merkez', tarih,
  });
  ok('aynı il-ilçe → aynı sefer, mükerrer YAKALANIR (regresyon yok)',
     sonuc?.id === aktifId, JSON.stringify(sonuc));

  // ── 3. 🚨 Çıkış ilçesi FARKLI (Tekirdağ-Ergene) — aynı İL, farklı İLÇE ──
  sonuc = await mukerrerBul({
    userId, tip: 'yuk', kalkisIlId: TEKIRDAG, kalkisIlce: 'Ergene',
    ilkDurakIlId: ISTANBUL, ilkDurakIlce: 'Merkez', tarih,
  });
  ok('🚨 Çorlu→Ergene (aynı il, FARKLI ilçe) → mükerrer SAYILMAZ', sonuc === null,
     JSON.stringify(sonuc));

  // ── 4. Varış ilçesi farklıysa da ayrışmalı (simetrik kontrol) ───────────
  sonuc = await mukerrerBul({
    userId, tip: 'yuk', kalkisIlId: TEKIRDAG, kalkisIlce: 'Çorlu',
    ilkDurakIlId: ISTANBUL, ilkDurakIlce: 'Kadıköy', tarih,
  });
  ok('varış ilçesi farklı → mükerrer SAYILMAZ', sonuc === null, JSON.stringify(sonuc));

} finally {
  if (ilanIdler.length) {
    await svc.from('listing_stops').delete().in('listing_id', ilanIdler);
    await svc.from('listings').delete().in('id', ilanIdler);
  }
  if (userId) {
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
