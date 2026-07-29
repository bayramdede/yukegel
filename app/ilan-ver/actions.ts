'use server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '../../lib/auth';
import { structuredLog } from '../../lib/logger';
import { ilanYaz, type IlanYazGirdi, type IlanYazSonuc, type IlanDurumu } from '../../lib/ilan-yaz';

/**
 * `ILAN_VER_ANALIZ` W0/W1 — bu dosya artık YALNIZCA bir auth kapısı.
 *
 * Doğrulama, beyaz liste, telefon kaynağı ve moderasyon kararı `lib/ilan-yaz.ts`'e
 * taşındı; `/api/excel-import` de aynı fonksiyonu çağırıyor. İki yolun ayrışması
 * (biri sertleştirilmiş, öteki değil) W0'dan önceki hâlin ta kendisiydi.
 *
 * 🚨 Yeni bir ilan yazma kanalı eklerken INSERT'i kopyalama; `ilanYaz()` çağır.
 */

export type { IlanDurumu };
export type IlanKaydetGirdi = IlanYazGirdi;
export type IlanKaydetSonuc = IlanYazSonuc;

async function oturumKullanicisi() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user;
}

export async function ilanKaydet(formData: IlanKaydetGirdi): Promise<IlanKaydetSonuc> {
  // 🚨 SERVER ACTION'DAN İSTİSNA KAÇIRMA (29 Tem 2026).
  //
  // Bir server action `throw` ederse Next istemciye yalnızca şunu gösterir:
  // "An error occurred in the Server Components render. The specific message is
  // omitted in production builds…". Kullanıcı ne olduğunu anlamaz, biz de log'da
  // `digest`ten başka bir şey görmeyiz — ilan verme sessizce ölür. `ilanYaz()`
  // kendi hatalarını `{ok:false}` ile dönüyor ama ALTINDAKİ katmanlar (env eksik
  // service-role anahtarı, `cookies()`, ağ hatası, JSON serileştirme) hâlâ
  // fırlatabilir. Bu blok onları kullanıcıya anlaşılır bir cevaba, bize de
  // aranabilir bir log satırına çevirir.
  try {
    // ── V10: auth kapısı BURADA. `proxy.ts`'e güvenip atlamıyoruz — tek katmanlı
    // savunma `SPRINT_01 M1`'de bir kez kırıldı.
    const user = await oturumKullanicisi();
    if (!user) {
      return { ok: false, hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };
    }
    return await ilanYaz(user.id, formData, 'form');
  } catch (e) {
    const hata = e as { message?: string; name?: string; stack?: string };
    structuredLog('ERROR', 'db-transaction', 'ilanKaydet beklenmeyen istisna', {
      error_name: hata?.name ?? null,
      error_message: hata?.message ?? String(e),
      // Vercel'de tek satırda görünsün diye kısaltılmış stack.
      stack: typeof hata?.stack === 'string' ? hata.stack.slice(0, 1200) : null,
      // ⚠️ `formData` LOGLANMAZ: içinde `tel` var (KVKK). Yalnız şekli.
      tip: formData?.tip ?? null,
      kalkis: formData?.kalkis ?? null,
      durak_sayisi: Array.isArray(formData?.duraklar) ? formData.duraklar.length : null,
    });
    return { ok: false, hata: 'İlan kaydedilemedi. Teknik bir hata oluştu, kayıt altına alındı. Lütfen tekrar deneyin.' };
  }
}

export async function kullanicitelefon(): Promise<string | null> {
  const user = await oturumKullanicisi();
  if (!user) return null;

  // maybeSingle() — admin veya yeni kullanıcıda users satırı olmayabilir
  const { data } = await getServiceSupabase()
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle();

  return data?.phone || null;
}
