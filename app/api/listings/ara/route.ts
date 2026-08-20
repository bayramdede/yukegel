import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ILAN_LIMITI, ILAN_SELECT, ilanNormalize, type RozetBilgi } from '../../../../lib/ilan-liste';
import { ilId } from '../../../../lib/lokasyon';

export const runtime = 'nodejs';

/**
 * GET /api/listings/ara?kalkis=34&varis=6&tip=yuk
 *
 * 🚨 NEDEN VAR (Dalga 3, 31 Tem 2026): ana sayfanın il filtresi bugüne kadar
 * TAMAMEN İSTEMCİDE çalışıyordu. Sayfa en yeni `ILAN_LIMITI` (200) ilanı çekip
 * `origin_city.includes(kalkis)` ile eliyordu. İki ayrı sorunu vardı:
 *
 *   1. 200'LÜK PENCERE YALAN SÖYLÜYORDU. Pencere `created_at`e göre kesiliyor,
 *      ile göre değil. Muş'ta ilan olsa bile son 200 ilanın hepsi İstanbul/
 *      Ankara/Bursa'dan geliyorsa kullanıcı "Muş" seçtiğinde BOŞ LİSTE
 *      görüyordu. Hata yok, uyarı yok — ilanlar yok sayılıyordu. (SPRINT_01 L4
 *      sayaç için aynı tuzağı kapatmıştı; filtrenin kendisi açık kalmıştı.)
 *
 *   2. `includes` METİN KARŞILAŞTIRMASIYDI. Yazım bozulursa index'e de
 *      düşülemiyordu. Dalga 5'te `origin_city` düşünce büsbütün kırılacaktı.
 *
 * Artık filtre `origin_province_id` / `listing_stops.province_id` tamsayı
 * eşitliğiyle SUNUCUDA çalışıyor; `province_id` index'leri (bkz.
 * docs/20260730_province_id.sql §index) doğrudan kullanılıyor.
 *
 * ⚠️ NEDEN SERVICE ROLE: `listing_stops`'un anon SELECT politikası var ama bu
 *    depoda bir SQL dosyasının varlığı onun canlıda olduğunu göstermiyor
 *    (Dalga 3'ün radar dersi). SSR yolu da (`app/page.tsx`) aynı sebeple service
 *    role kullanıyor; filtre yolunun ondan farklı davranması, filtre açıkken
 *    durakların sessizce kaybolması demekti. Kolon listesi `ILAN_SELECT` ile
 *    sabit ve `contact_phone` içermiyor — RLS bypass'ının bedeli burada
 *    ödenmiyor.
 *
 * ⚠️ ARAÇ/KASA TİPİ BURADA FİLTRELENMİYOR — bilinçli. `aracTipleri` alanı
 *    `vehicle_type` boşsa durakların `cargo_type`'ına düşüyor; bu türetme SQL'e
 *    taşınırsa iki yerde iki ayrı tanım olur. Bunlar il seçildikten SONRAKİ
 *    daraltmalar, istemcide kalıyorlar.
 */

const SVC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GECERLI_TIP = new Set(['yuk', 'arac']);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // ⚠️ "gönderilmedi" ile "gönderildi ama tanınmadı" AYRI. `ilId()` ikisine de
  // null döner. Ayırmazsak "Ankra" yazan biri hata yerine TÜM İLLERİN sonucunu
  // görür — sessiz yanlış sonuç, açık hatadan kötüdür (radar route'larıyla aynı
  // sözleşme).
  function ilParam(ad: string): number | null | 'gecersiz' {
    const ham = searchParams.get(ad)?.trim();
    if (!ham) return null;
    const id = ilId(ham);
    return id === null ? 'gecersiz' : id;
  }

  const kalkisId = ilParam('kalkis');
  if (kalkisId === 'gecersiz') {
    return NextResponse.json({ error: 'Tanınmayan kalkış ili' }, { status: 400 });
  }
  const varisId = ilParam('varis');
  if (varisId === 'gecersiz') {
    return NextResponse.json({ error: 'Tanınmayan varış ili' }, { status: 400 });
  }

  if (kalkisId === null && varisId === null) {
    return NextResponse.json({ error: 'En az bir il filtresi gerekli' }, { status: 400 });
  }

  const tipHam = searchParams.get('tip')?.trim() || null;
  if (tipHam !== null && !GECERLI_TIP.has(tipHam)) {
    return NextResponse.json({ error: 'Geçersiz tip' }, { status: 400 });
  }

  const svc = createClient(SVC_URL, SVC_KEY);

  // ── 1) Varış ili varsa önce EŞLEŞEN İLAN ID'LERİ ────────────────────────────
  //
  // ⚠️ `listing_stops!inner` + kolon filtresi TEK sorguyla çözerdi AMA gömülü
  //    `listing_stops` dizisini de filtreler: çok duraklı bir ilanda yalnız
  //    eşleşen durak dönerdi. Kart tonajı tüm durakların TOPLAMI
  //    (`durakToplami`, ilan-liste.ts) — durakları kırpmak fiyat/tonaj bilgisini
  //    doğrudan yanlış gösterirdi. O yüzden inner join YALNIZ id toplamak için,
  //    gövde ikinci sorguda tam duraklarla çekiliyor.
  let idListesi: string[] | null = null;

  if (varisId !== null) {
    let idSorgu = svc
      .from('listings')
      .select('id, listing_stops!inner(province_id)')
      .eq('listing_stops.province_id', varisId)
      .in('moderation_status', ['approved', 'auto_published'])
      .eq('is_shadow_banned', false)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(ILAN_LIMITI);

    if (kalkisId !== null) idSorgu = idSorgu.eq('origin_province_id', kalkisId);
    if (tipHam !== null) idSorgu = idSorgu.eq('listing_type', tipHam);

    const { data: idData, error: idHata } = await idSorgu;
    if (idHata) {
      return NextResponse.json({ error: idHata.message }, { status: 500 });
    }
    idListesi = [...new Set((idData ?? []).map((r: any) => r.id as string))];
    if (idListesi.length === 0) {
      return NextResponse.json({ success: true, data: [], total: 0, kirpildi: false });
    }
  }

  // ── 2) Gövde ────────────────────────────────────────────────────────────────
  let sorgu = svc
    .from('listings')
    .select(ILAN_SELECT)
    .in('moderation_status', ['approved', 'auto_published'])
    .eq('is_shadow_banned', false)
    .eq('status', 'active')
    // 20 Ağu 2026 — Sürekli Yük bloğu ana sayfayla aynı sırayı korusun.
    .order('is_recurring', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(ILAN_LIMITI);

  if (idListesi !== null) sorgu = sorgu.in('id', idListesi);
  if (kalkisId !== null) sorgu = sorgu.eq('origin_province_id', kalkisId);
  if (tipHam !== null) sorgu = sorgu.eq('listing_type', tipHam);

  const { data, error } = await sorgu;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ success: true, data: [], total: 0, kirpildi: false });
  }

  // ── 3) Rozetler ─────────────────────────────────────────────────────────────
  // Ana sayfanın istemci yolu bunu ikinci bir istekle yapıyordu; filtre yolunda
  // tek yanıtta veriyoruz ki kartlar "Yeni Üye"/"Doğrulanmış" rozetleri olmadan
  // bir kare titremesin.
  const userIds = [...new Set((data as any[]).map(i => i.user_id).filter(Boolean))] as string[];
  const rozetMap: Record<string, RozetBilgi> = {};
  if (userIds.length > 0) {
    const { data: ks } = await svc
      .from('users')
      .select('id, created_at')
      .in('id', userIds);
    for (const k of (ks || []) as any[]) rozetMap[k.id] = k;
  }

  const ilanlar = (data as any[]).map(ilan =>
    ilanNormalize(ilan, ilan.user_id ? rozetMap[ilan.user_id] : null)
  );

  return NextResponse.json({
    success: true,
    data: ilanlar,
    total: ilanlar.length,
    // İstemci "en yeni N ilan" ön ekini buna göre basar — 200'e dayandıysa
    // sunucu kesmiş demektir, liste o il için TAM DEĞİLDİR.
    kirpildi: ilanlar.length >= ILAN_LIMITI,
    filtre: { kalkis_il_id: kalkisId, varis_il_id: varisId, tip: tipHam },
  });
}
