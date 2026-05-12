import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import * as XLSX from 'xlsx';
import { structuredLog, logRlsError } from '../../../lib/logger';

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // ── Auth kontrolü
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });
  }

  // ── Kullanıcı bilgisi
  const { data: profil } = await svc
    .from('users')
    .select('id, phone, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profil) {
    return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 403 });
  }

  // ── Dosya al
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return NextResponse.json({ error: 'Excel dosyası okunamadı' }, { status: 400 });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    return NextResponse.json({ error: 'Dosya boş veya okunamadı' }, { status: 400 });
  }

  const hatalar: { satir: number; mesaj: string }[] = [];
  const olusturulanlar: string[] = [];
  const baslangic = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const satir = i + 2; // Excel satır no (başlık = 1)

    const kalkis = String(row['Kalkış Şehri'] || row['kalkis'] || '').trim();
    const varis  = String(row['Varış Şehri']  || row['varis']  || '').trim();

    if (!kalkis || !varis) {
      hatalar.push({ satir, mesaj: 'Kalkış ve Varış şehri zorunludur' });
      structuredLog('WARN', 'excel-import', 'Excel validasyon hatası', {
        user_id: profil.id,
        filename: file.name,
        row: satir,
        field: 'kalkis|varis',
        reason: 'Kalkış ve Varış şehri zorunludur',
      });
      continue;
    }

    const aracTipi  = String(row['Araç Tipi']  || '').trim();
    const kasaTipi  = String(row['Kasa Tipi']   || '').trim();
    const agirlik   = parseFloat(String(row['Ağırlık (ton)'] || row['agirlik'] || '')) || null;
    const fiyat     = parseFloat(String(row['Fiyat (TL)']   || row['fiyat']   || '')) || null;
    const tarih     = String(row['Yükleme Tarihi'] || '').trim() || null;
    const notlar    = String(row['Notlar'] || '').trim() || null;
    const varisSehir2 = String(row['2. Varış Şehri'] || '').trim() || null;

    // ── Listing oluştur
    const { data: listing, error: lErr } = await svc
      .from('listings')
      .insert({
        user_id: profil.id,
        listing_type: 'yuk',
        source: 'excel',
        origin_city: kalkis,
        vehicle_type: aracTipi ? [aracTipi] : [],
        body_type: kasaTipi ? [kasaTipi] : [],
        price_offer: fiyat,
        available_date: tarih || null,
        notes: notlar,
        contact_phone: profil.phone,
        moderation_status: 'auto_published',
        status: 'active',
      })
      .select('id')
      .single();

    if (lErr || !listing) {
      hatalar.push({ satir, mesaj: lErr?.message || 'İlan oluşturulamadı' });
      logRlsError({
        userId: profil.id,
        route: '/api/excel-import',
        table: 'listings',
        operation: 'INSERT',
        rawError: lErr,
      });
      if (lErr && lErr.code !== '42501') {
        structuredLog('ERROR', 'excel-import', 'Listing INSERT hatası', {
          user_id: profil.id,
          filename: file.name,
          row: satir,
          error_message: lErr?.message ?? 'İlan oluşturulamadı',
        });
      }
      continue;
    }

    // ── Duraklar
    const duraklar = [{ sehir: varis, sira: 1 }];
    if (varisSehir2) duraklar.push({ sehir: varisSehir2, sira: 2 });

    for (const durak of duraklar) {
      await svc.from('listing_stops').insert({
        listing_id: listing.id,
        stop_order: durak.sira,
        city: durak.sehir,
        weight_ton: agirlik,
      });
    }

    olusturulanlar.push(listing.id);
  }

  const tamamlanmaSuresi = Date.now() - baslangic;
  structuredLog('INFO', 'excel-import', 'Excel yükleme tamamlandı', {
    user_id: profil.id,
    filename: file.name,
    row_count: rows.length,
    created: olusturulanlar.length,
    error_count: hatalar.length,
    processing_time_ms: tamamlanmaSuresi,
    validation_errors: hatalar,
  });

  return NextResponse.json({
    basarili: olusturulanlar.length,
    hatali: hatalar.length,
    hatalar,
    ilanlar: olusturulanlar,
  });
}
