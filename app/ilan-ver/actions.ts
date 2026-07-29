'use server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '../../lib/auth';
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
  // ── V10: auth kapısı BURADA. `proxy.ts`'e güvenip atlamıyoruz — tek katmanlı
  // savunma `SPRINT_01 M1`'de bir kez kırıldı.
  const user = await oturumKullanicisi();
  if (!user) {
    return { ok: false, hata: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' };
  }
  return ilanYaz(user.id, formData, 'form');
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
