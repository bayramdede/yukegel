import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '../../../lib/auth';
import { structuredLog } from '../../../lib/logger';
import { ilanYaz, bugunISO } from '../../../lib/ilan-yaz';
import { ilNormalize, aracTipiNormalize, utsyapiNormalize, ilKey } from '../../../lib/ilan-sabitler';
import {
  MAX_SATIR, MAX_ILAN,
  type TopluYukleIstek, type TopluYukleYanit,
  type HamSatir, type OnizlemeSatiri, type OnaySatiri, type KayitSonucu, type AlanDurumu,
} from '../../../lib/toplu-yukle-sozlesme';

/**
 * `ILAN_VER_ANALIZ` B1 — bu route BAŞTAN YAZILDI.
 *
 * Eski hâli `formData().get('file')` okuyup Excel'i SUNUCUDA ayrıştırıyordu ve
 * `'Kalkış Şehri'` sütununu arıyordu; istemci ise JSON `{action, rows, userId}`
 * yolluyor ve şablonda `'Kalkış İli'` yazıyordu. İki bağımsız uyuşmazlık, özellik
 * fiilen ölü. Sözleşme artık `lib/toplu-yukle-sozlesme.ts`'te tek yerde.
 *
 * Ayrıca eski hâli kendi `listings` INSERT'ini yazıyordu: `arac_tipi` doğrulanmadan
 * diziye konuyor, `moderation_status: 'auto_published'` sabitleniyordu — yani W0'da
 * kapatılan V1/V3 delikleri BURADA açık kalıyordu. Artık `lib/ilan-yaz.ts` üzerinden
 * geçiyor; iki yol ayrışamaz.
 *
 * ⚠️ `userId` istemciden ALINMAZ (eski istemci yolluyordu). Oturumdan okunur.
 */

// B2 kısmî: Vercel'de varsayılan 10sn; toplu yükleme satır başına birkaç sorgu yapar.
export const maxDuration = 60;

function yanit(v: TopluYukleYanit, status = 200) {
  return NextResponse.json(v, { status });
}

/** Boş/dolu/tanındı üçlüsünü tek yerde üretir. */
function durumEtiketi(ham: string, norm: string | null, tanınmayanHata: boolean): AlanDurumu {
  if (!ham.trim()) return 'empty';
  if (norm) return 'ok';
  return tanınmayanHata ? 'error' : 'warn';
}

export async function POST(request: NextRequest) {
  // ── Auth: kimlik OTURUMDAN.
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return yanit({ ok: false, hata: 'Giriş gerekli.' }, 401);

  let govde: TopluYukleIstek;
  try {
    govde = await request.json();
  } catch {
    return yanit({ ok: false, hata: 'Geçersiz istek gövdesi.' }, 400);
  }

  const rows = Array.isArray((govde as { rows?: unknown }).rows) ? govde.rows : null;
  if (!rows || rows.length === 0) {
    return yanit({ ok: false, hata: 'Satır bulunamadı.' }, 400);
  }
  if (rows.length > MAX_SATIR) {
    return yanit({ ok: false, hata: `Tek seferde en fazla ${MAX_SATIR} satır yüklenebilir. (${rows.length} satır gönderildi)` }, 400);
  }

  // ── Alias sözlüğü: "ist", "ant." gibi kısaltmaları çözer.
  // `ILAN_VER_ANALIZ` M2 — anahtar `ilKey()` ile katlanıyor, `aliasKey()` ile
  // aynı kurallar (İ→i ÖNCE, sonra lower). İkisi ayrışırsa alias hiç eşleşmez.
  const svc = getServiceSupabase();
  const { data: aliasSatirlari } = await svc
    .from('aliases')
    .select('alias, normalized, type')
    .in('type', ['city', 'vehicle', 'body'])
    .eq('is_active', true);

  const sehirAlias = new Map<string, string>();
  const aracAlias = new Map<string, string>();
  const utsAlias = new Map<string, string>();
  for (const a of aliasSatirlari ?? []) {
    const k = ilKey(String(a.alias ?? ''));
    const v = String(a.normalized ?? '');
    if (!k || !v) continue;
    if (a.type === 'city' && !sehirAlias.has(k)) sehirAlias.set(k, v);
    if (a.type === 'vehicle' && !aracAlias.has(k)) aracAlias.set(k, v);
    if (a.type === 'body' && !utsAlias.has(k)) utsAlias.set(k, v);
  }

  const sehirCoz = (v: string) => ilNormalize(v) ?? ilNormalize(sehirAlias.get(ilKey(v)) ?? '');
  const aracCoz  = (v: string) => aracTipiNormalize(v) ?? aracTipiNormalize(aracAlias.get(ilKey(v)) ?? '');
  const utsCoz   = (v: string) => utsyapiNormalize(v) ?? utsyapiNormalize(utsAlias.get(ilKey(v)) ?? '');

  // ── ÖNİZLEME ─────────────────────────────────────────────────────────────
  if (govde.action === 'preview') {
    const preview: OnizlemeSatiri[] = (rows as HamSatir[]).map((r, i) => {
      const kalkisIli = String(r?.kalkisIli ?? '');
      const varisIli = String(r?.varisIli ?? '');
      const aracTipi = String(r?.aracTipi ?? '');
      const ustYapi = String(r?.ustYapi ?? '');

      const kalkisIliNorm = sehirCoz(kalkisIli);
      const varisIliNorm = sehirCoz(varisIli);
      const aracTipiNorm = aracCoz(aracTipi);
      const ustYapiNorm = utsCoz(ustYapi);

      // Şehir ZORUNLU → boş da tanınmayan da 'error'; kullanıcı listeden seçmeli.
      // (Boşu 'empty' bırakmak istemcinin "hazır" demesine yol açıyordu, sunucu ise
      //  reddediyordu — hata kullanıcıya kayıt anında, düzeltemeyeceği yerde çıkıyordu.)
      // Araç/üst yapı İSTEĞE BAĞLI → tanınmazsa 'warn', boşsa 'empty'; ilan yine kurulur.
      const kalkisIliStatus: AlanDurumu = kalkisIliNorm ? 'ok' : 'error';
      const varisIliStatus: AlanDurumu = varisIliNorm ? 'ok' : 'error';
      const aracTipiStatus = durumEtiketi(aracTipi, aracTipiNorm, false);
      const ustYapiStatus = durumEtiketi(ustYapi, ustYapiNorm, false);

      return {
        seferNo: String(r?.seferNo ?? ''),
        kalkisIli, kalkisIlce: String(r?.kalkisIlce ?? ''),
        varisIli, varisIlce: String(r?.varisIlce ?? ''),
        durakTipi: String(r?.durakTipi ?? ''),
        aracTipi, ustYapi,
        tonaj: String(r?.tonaj ?? ''),
        palet: String(r?.palet ?? ''),
        fiyat: String(r?.fiyat ?? ''),
        yukCinsi: String(r?.yukCinsi ?? ''),
        not: String(r?.not ?? ''),
        rowIndex: i,
        kalkisIliNorm, kalkisIliStatus,
        varisIliNorm, varisIliStatus,
        aracTipiNorm, aracTipiStatus,
        ustYapiNorm, ustYapiStatus,
        hasErrors: kalkisIliStatus === 'error' || varisIliStatus === 'error',
      };
    });

    return yanit({ ok: true, action: 'preview', preview });
  }

  // ── KAYIT ────────────────────────────────────────────────────────────────
  if (govde.action !== 'commit') {
    return yanit({ ok: false, hata: 'Bilinmeyen işlem.' }, 400);
  }

  // Şablonda tarih sütunu yok; istemci tek bir yükleme tarihi soruyor.
  const tarih = /^\d{4}-\d{2}-\d{2}$/.test(String(govde.tarih ?? '')) ? govde.tarih : null;
  if (!tarih) return yanit({ ok: false, hata: 'Geçerli bir yükleme tarihi seçin.' }, 400);
  if (tarih < bugunISO()) return yanit({ ok: false, hata: 'Geçmiş bir tarih seçilemez.' }, 400);

  // Sefer No ile grupla; boşsa her satır ayrı ilan (istemcideki mantığın AYNISI).
  const gruplar = new Map<string, OnaySatiri[]>();
  (rows as OnaySatiri[]).forEach((row, i) => {
    const anahtar = String(row?.seferNo ?? '').trim() || `__${i}`;
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar)!.push(row);
  });

  if (gruplar.size > MAX_ILAN) {
    return yanit({ ok: false, hata: `Tek seferde en fazla ${MAX_ILAN} ilan oluşturulabilir. (${gruplar.size} ilan)` }, 400);
  }

  const baslangic = Date.now();
  const sonuclar: KayitSonucu[] = [];

  for (const [anahtar, grupSatirlari] of gruplar) {
    const ilk = grupSatirlari[0];
    const seferNo = anahtar.startsWith('__') ? '' : anahtar;

    // İstemcinin elle düzelttiği değere ÖNCELİK ver, ama yine de normalize et —
    // `ilanYaz()` zaten reddeder, burada erken ve anlaşılır hata veriyoruz.
    const kalkis = sehirCoz(String(ilk?.kalkisIliNorm ?? ilk?.kalkisIli ?? ''));
    if (!kalkis) {
      sonuclar.push({ seferNo, ok: false, hata: `Kalkış ili tanınamadı: "${String(ilk?.kalkisIli ?? '').slice(0, 30)}"` });
      continue;
    }

    const duraklar = grupSatirlari.map(r => ({
      sehir: String(r?.varisIliNorm ?? r?.varisIli ?? ''),
      ilce: String(r?.varisIlce ?? ''),
      ton: String(r?.tonaj ?? ''),
      palet: String(r?.palet ?? ''),
      notlar: String(r?.not ?? ''),
      // B4 — her durak KENDİ yük cinsini taşır.
      yuk_cinsi: String(r?.yukCinsi ?? ''),
    }));

    const sonuc = await ilanYaz(
      user.id,
      {
        tip: 'yuk',
        kalkis,
        kalkis_ilce: String(ilk?.kalkisIlce ?? ''),
        fiyat: String(ilk?.fiyat ?? ''),
        tarih,
        genel_not: String(ilk?.not ?? ''),
        arac_tipi: aracCoz(String(ilk?.aracTipi ?? '')) ?? undefined,
        utsyapi: [utsCoz(String(ilk?.ustYapi ?? ''))].filter((u): u is string => Boolean(u)),
        arac_adet: 1,
        duraklar,
      },
      'excel',
    );

    sonuclar.push(
      sonuc.ok
        ? { seferNo, ok: true, id: sonuc.id, durum: sonuc.durum }
        : { seferNo, ok: false, hata: sonuc.hata }
    );
  }

  const olusturulan = sonuclar.filter(s => s.ok).length;

  structuredLog('INFO', 'excel-import', 'Toplu yükleme tamamlandı', {
    user_id: user.id,
    row_count: rows.length,
    group_count: gruplar.size,
    created: olusturulan,
    error_count: sonuclar.length - olusturulan,
    processing_time_ms: Date.now() - baslangic,
  });

  return yanit({ ok: true, action: 'commit', olusturulan, sonuclar });
}
