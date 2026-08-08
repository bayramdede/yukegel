// scripts/test-toplu-duzenle.mts — Excel toplu yüklemede ÖNİZLEME DÜZENLEME'nin
// uçtan uca sözleşmesi. GERÇEK tarayıcı + gerçek oturum + gerçek Excel dosyası.
//
// 🚨 NE KORUYOR — "gördüğün şey kaydedilen şeydir":
// Önizlemede düzenlenen değerin `commit` gövdesine girmesi İSTEMCİDEKİ bir
// birleştirme adımına bağlı (`effectiveRows` → `finalRows`). Bu adım eskiden
// YALNIZ iki alanı (kalkış/varış ili) birleştiriyordu. Düzenleme tüm alanlara
// açılırken burası güncellenmeseydi kullanıcı ekranda düzelttiği tonajın/fiyatın
// kaydedilmediğini ancak ilan oluştuktan SONRA fark ederdi — sessiz veri kaybı.
// Bu test o birleştirmeyi DB'den okuyarak doğrular.
//
// ⚠️ CANLI DB'YE YAZAR: geçici kullanıcı + ilan oluşturur, sonunda SİLER.
//
// ÇALIŞTIRMA:
//   1) bir kez: `npx playwright install chromium`  (tarayıcı ikilisi indirir)
//   2) `npx next dev -p 3199` açıkken: `npm run test:toplu-duzenle`
//   (başka portta ise `TEST_TABAN=http://localhost:3000 npm run test:toplu-duzenle`)

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import { SABLON_HEADERS } from '../lib/toplu-yukle-sozlesme';

const TABAN = process.env.TEST_TABAN ?? 'http://localhost:3199';
const GECICI = '/tmp/yukegel-toplu-test.xlsx';

const env: Record<string, string> = {};
for (const s of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = s.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let gecti = 0; const hatalar: string[] = [];
const ok = (ad: string, kosul: boolean, ek = '') => {
  if (kosul) { gecti++; console.log(`✓ ${ad}`); } else hatalar.push(`✗ ${ad}${ek ? '\n    ' + ek : ''}`);
};

const eposta = `toplu-test-${Date.now()}@yukegel-test.local`;
const sifre = 'Tp!' + Math.random().toString(36).slice(2) + 'Aa1';
let userId = ''; let tarayici: any = null;

try {
  // ── Geçici kullanıcı (TELEFON ŞART: commit yolu `ilanTelefonu()` istiyor) ──
  const { data: u, error: uErr } = await svc.auth.admin.createUser({
    email: eposta, password: sifre, email_confirm: true,
  });
  if (uErr) throw new Error('kullanıcı: ' + uErr.message);
  userId = u!.user!.id;
  await svc.from('users').update({
    user_type: 'yuk_sahibi', display_name: 'Toplu Testi',
    phone: '05001112233', phone_verified: true,
  }).eq('id', userId);

  // ── Excel: 2 ilan. Biri BOZUK il yazımı + Türkçe "5.000" fiyat kalıbı ──
  const satirlar = [
    [...SABLON_HEADERS],
    // Sefer S1: iki duraklı; kalkış ili KASITEN tanınmaz ("Isanbul")
    ['S1', 'Isanbul', 'Tuzla', 'Ankara', 'Merkez', '', 'TIR', 'Tenteli', '18', '24', '5.000', 'seramik', 'ilk not'],
    ['S1', 'Isanbul', 'Tuzla', 'Bursa',  'Nilüfer', '', 'TIR', 'Tenteli', '12', '10', '5.000', 'cam',     'ilk not'],
    // Tekil ilan: her şey doğru
    ['',   'İzmir',   'Bornova', 'Manisa', 'Merkez', '', 'Kamyon', 'Açık Kasa', '7', '5', '9000', 'tekstil', 'ikinci not'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(satirlar), 'İlanlar');
  XLSX.writeFile(wb, GECICI);

  // ── Oturum çerezi ──
  const jar: { name: string; value: string }[] = [];
  const ssr = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => jar, setAll: c => { for (const k of c) jar.push({ name: k.name, value: k.value }); } },
  });
  const { error: sErr } = await ssr.auth.signInWithPassword({ email: eposta, password: sifre });
  if (sErr) throw new Error('giriş: ' + sErr.message);

  tarayici = await chromium.launch();
  const ctx = await tarayici.newContext({ viewport: { width: 1200, height: 1000 } });
  await ctx.addCookies(jar.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/' })));
  const p = await ctx.newPage();
  p.on('dialog', (d: any) => d.accept());

  await p.goto(`${TABAN}/ilan-ver`, { waitUntil: 'networkidle' });
  // Yöntem seçimi: "Toplu Yükleme" kartı
  await p.locator('button', { hasText: 'Toplu Yükleme' }).first().click();
  await p.waitForTimeout(600);
  // Dosya girişi `display:none` — Playwright gizli input'a da dosya verebilir.
  await p.locator('input[type=file]').first().setInputFiles(GECICI);
  await p.waitForTimeout(3000);

  const onizlemeVar = await p.getByText('Yeniden Yükle', { exact: false }).count();
  ok('önizleme ekranı açıldı', onizlemeVar > 0);

  // Bozuk il "Isanbul" hata olarak işaretlenmiş olmalı
  const hataUyarisi = await p.getByText('tanımlanamayan şehir', { exact: false }).count();
  ok('tanınmayan kalkış ili hata olarak işaretlendi', hataUyarisi > 0);

  // ── Kart 1'i düzenle ──
  const duzenleButonlari = p.locator('button', { hasText: 'Düzenle' });
  ok('her kartta Düzenle butonu var', await duzenleButonlari.count() === 2,
     `bulunan: ${await duzenleButonlari.count()}`);
  await duzenleButonlari.first().click();
  await p.waitForTimeout(300);

  // Kalkış ilini düzelt, fiyatı/notu ve İLK durağın tonajını değiştir.
  // Seçiciler `aria-label` üzerinden — bu alanların etiketi `<div>` olduğu için
  // erişilebilir adları yoktu; eklendi (hem a11y hem kararlı test tutamağı).
  await p.getByLabel('Kalkış İli').selectOption('İstanbul');
  await p.waitForTimeout(250);
  await p.getByLabel('Fiyat').fill('37500');
  await p.getByLabel('Not', { exact: true }).fill('duzenlenmis not');
  // Tonaj alanı her varış durağında bir tane var; ilkini değiştir (18 → 22)
  await p.getByLabel('Tonaj').nth(0).fill('22');
  await p.waitForTimeout(300);

  const duzenlendiRozeti = await p.getByText('düzenlendi', { exact: false }).count();
  ok('"düzenlendi" rozeti çıktı', duzenlendiRozeti > 0);

  await p.screenshot({ path: '/tmp/yukegel-toplu-duzenle.png' });

  // Hata uyarısı kalkmalı (il düzeltildi)
  await p.waitForTimeout(300);
  const kalanHata = await p.getByText('tanımlanamayan şehir', { exact: false }).count();
  ok('il düzeltilince hata uyarısı kalktı', kalanHata === 0);

  // ── Onayla ──
  await p.locator('button', { hasText: 'Onayla' }).first().click();
  await p.waitForTimeout(6000);
  const basariliMi = await p.getByText('ilan oluşturuldu', { exact: false }).count();
  ok('ilanlar oluşturuldu', basariliMi > 0);

  // ── DB doğrulaması: EKRANDA DÜZENLENEN DEĞER KAYDEDİLDİ Mİ? ──
  const { data: ilanlar } = await svc.from('listings')
    .select('id, origin_province_id, origin_district, price_offer, notes, vehicle_type, body_type, listing_stops(stop_order, province_id, district, weight_ton, pallet_count, cargo_type)')
    .eq('user_id', userId).order('created_at', { ascending: true });

  ok('2 ilan oluştu', (ilanlar?.length ?? 0) === 2, `bulunan: ${ilanlar?.length}`);
  const cokDurakli = (ilanlar ?? []).find(i => (i.listing_stops as any[])?.length === 2) as any;
  ok('iki duraklı ilan (Sefer S1) var', Boolean(cokDurakli));

  if (cokDurakli) {
    ok('DÜZENLENEN kalkış ili kaydedildi (İstanbul=34)', cokDurakli.origin_province_id === 34,
       `bulunan: ${cokDurakli.origin_province_id}`);
    ok('DÜZENLENEN fiyat kaydedildi (37500)', Number(cokDurakli.price_offer) === 37500,
       `bulunan: ${cokDurakli.price_offer}`);
    ok('DÜZENLENEN not kaydedildi', String(cokDurakli.notes || '').includes('duzenlenmis not'),
       `bulunan: ${cokDurakli.notes}`);
    const s = [...(cokDurakli.listing_stops as any[])].sort((a, b) => a.stop_order - b.stop_order);
    ok('DÜZENLENEN durak tonajı kaydedildi (18→22)', Number(s[0].weight_ton) === 22,
       `bulunan: ${s[0].weight_ton}`);
    ok('düzenlenmeyen 2. durak tonajı korundu (12)', Number(s[1].weight_ton) === 12,
       `bulunan: ${s[1].weight_ton}`);
    ok('düzenlenmeyen kalkış ilçesi korundu (Tuzla)', cokDurakli.origin_district === 'Tuzla',
       `bulunan: ${cokDurakli.origin_district}`);
  }

  const tekil = (ilanlar ?? []).find(i => (i.listing_stops as any[])?.length === 1) as any;
  if (tekil) {
    ok('düzenlenmeyen ilan Excel değerleriyle kaydedildi (İzmir=35, 9000)',
       tekil.origin_province_id === 35 && Number(tekil.price_offer) === 9000,
       `bulunan: il=${tekil.origin_province_id} fiyat=${tekil.price_offer}`);
  }

} finally {
  if (tarayici) await tarayici.close();
  if (userId) {
    const { data: ids } = await svc.from('listings').select('id').eq('user_id', userId);
    for (const r of ids ?? []) await svc.from('listing_stops').delete().eq('listing_id', r.id);
    await svc.from('listings').delete().eq('user_id', userId);
    await svc.from('users').delete().eq('id', userId);
    await svc.auth.admin.deleteUser(userId);
  }
  console.log(`\n🧹 temizlik: geçici kullanıcı, ilanlar ve duraklar silindi (${eposta})`);
}

console.log('');
if (hatalar.length) {
  for (const h of hatalar) console.error(h);
  console.error(`\n❌ ${hatalar.length} KONTROL BAŞARISIZ (${gecti} geçti)`);
  process.exit(1);
}
console.log(`✅ TÜM KONTROLLER GEÇTİ (${gecti})`);
