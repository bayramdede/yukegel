import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { authEventsGetir, searchQueriesGetir, listingViewsGetir, adminActionsGetir } from '../../../../../lib/loglar';
import { tarihFormat, kullaniciEtiket, kullaniciAramayaUyar, ilanOzeti, type Sekme } from '../../../../../lib/loglar-format';

export const runtime = 'nodejs';

// 21 Ağu 2026 — `/admin/loglar`daki "CSV'ye Aktar". Ekran SATIR_LIMIT=300 ile
// sınırlı (performans); export bunu 5000'e çıkarıyor — aynı aralık/filtrede
// ekranda görünmeyen ama tabloda duran satırları da kapsasın diye. Veri
// çekme `lib/loglar.ts`'teki AYNI fonksiyonlar — ekranla export ayrışmasın.
const EXPORT_LIMIT = 5000;

const GECERLI_SEKME = new Set<Sekme>(['auth', 'search', 'view', 'admin']);

function csvHucre(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvOlustur(basliklar: string[], satirlar: (string | number)[][]): string {
  // ﻿ — Excel (TR) UTF-8'i BOM olmadan Latin-1 sanıp Türkçe karakterleri
  // bozuyor. `;` ayraç — TR yerelinde `,` ondalık ayracı olduğu için Excel
  // varsayılan olarak `;`yi CSV ayracı bekliyor.
  const satirYaz = (hucreler: (string | number)[]) => hucreler.map(csvHucre).join(';');
  return '﻿' + [satirYaz(basliklar), ...satirlar.map(satirYaz)].join('\r\n');
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sekmeHam = searchParams.get('sekme') || 'auth';
  if (!GECERLI_SEKME.has(sekmeHam as Sekme)) {
    return NextResponse.json({ error: 'Geçersiz sekme' }, { status: 400 });
  }
  const sekme = sekmeHam as Sekme;

  const basParam = searchParams.get('bas') || '';
  const sonParam = searchParams.get('son') || '';
  const bas = basParam ? `${basParam}T00:00:00.000Z` : null;
  const son = sonParam ? `${sonParam}T23:59:59.999Z` : null;
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  let basliklar: string[];
  let satirlar: (string | number)[][];

  switch (sekme) {
    case 'auth': {
      const rows = await authEventsGetir({ bas, son, limit: EXPORT_LIMIT });
      const filtreli = rows.filter(r => kullaniciAramayaUyar(r.kullanici, q));
      basliklar = ['Zaman', 'Olay', 'Yöntem', 'Kullanıcı', 'Sebep', 'IP'];
      satirlar = filtreli.map(r => [
        tarihFormat(r.created_at), r.event, r.method, kullaniciEtiket(r.kullanici), r.reason ?? '', r.ip ?? '',
      ]);
      break;
    }
    case 'search': {
      const rows = await searchQueriesGetir({ bas, son, limit: EXPORT_LIMIT });
      const filtreli = rows.filter(r => kullaniciAramayaUyar(r.kullanici, q));
      basliklar = ['Zaman', 'Kaynak', 'Kalkış', 'Varış', 'Tip', 'Sonuç', 'Kullanıcı', 'IP'];
      satirlar = filtreli.map(r => [
        tarihFormat(r.created_at),
        r.kaynak === 'yakin_konum' ? 'Yakın konum' : 'İl filtre',
        r.kalkis_il_adi ?? '', r.varis_il_adi ?? '', r.tip ?? '',
        r.sonuc_sayisi ?? '', kullaniciEtiket(r.kullanici), r.ip ?? '',
      ]);
      break;
    }
    case 'view': {
      const rows = await listingViewsGetir({ bas, son, limit: EXPORT_LIMIT });
      const filtreli = rows.filter(r => kullaniciAramayaUyar(r.kullanici, q));
      basliklar = ['Zaman', 'İlan Tipi', 'İlan Özeti', 'İlan ID', 'Görüntüleyen', 'IP'];
      satirlar = filtreli.map(r => [
        tarihFormat(r.created_at),
        r.ilan?.listing_type === 'yuk' ? 'Yük' : r.ilan?.listing_type === 'arac' ? 'Araç' : '',
        ilanOzeti(r.ilan), r.listing_id, kullaniciEtiket(r.kullanici), r.ip ?? '',
      ]);
      break;
    }
    case 'admin': {
      const rows = await adminActionsGetir({ bas, son, limit: EXPORT_LIMIT });
      const filtreli = rows.filter(r => kullaniciAramayaUyar(r.aktor, q) || kullaniciAramayaUyar(r.hedef, q));
      basliklar = ['Zaman', 'Yapan', 'Kime', 'Alan', 'Eski Değer', 'Yeni Değer'];
      satirlar = filtreli.map(r => [
        tarihFormat(r.created_at), kullaniciEtiket(r.aktor), kullaniciEtiket(r.hedef),
        r.alan, JSON.stringify(r.eski_deger ?? {}), JSON.stringify(r.yeni_deger ?? {}),
      ]);
      break;
    }
  }

  const csv = csvOlustur(basliklar, satirlar);
  const tarihEki = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yukegel_loglar_${sekme}_${tarihEki}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
