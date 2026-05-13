'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, getServiceSupabase } from '../../../lib/auth';

export async function dosyaYukle(
  formData: FormData
): Promise<{ ok: boolean; url?: string; hata?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { ok: false, hata: 'Yetkisiz işlem.' };

  const file = formData.get('file') as File;
  const key  = formData.get('key')  as string; // 'logo_url' | 'favicon_url'

  if (!file || file.size === 0) return { ok: false, hata: 'Dosya seçilmedi.' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, hata: 'Dosya 2 MB\'dan büyük olamaz.' };

  const izinli = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
  if (!izinli.includes(file.type)) return { ok: false, hata: 'Desteklenmeyen dosya tipi (png/jpg/svg/ico).' };

  const ext = file.name.split('.').pop() ?? 'png';
  const dosyaAdi = `${key.replace('_url', '')}.${ext}`; // logo.svg, favicon.ico ...

  const supabase = getServiceSupabase();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('brand-assets')
    .upload(dosyaAdi, buf, { contentType: file.type, upsert: true });

  if (upErr) return { ok: false, hata: upErr.message };

  const { data: { publicUrl } } = supabase.storage
    .from('brand-assets')
    .getPublicUrl(dosyaAdi);

  const { error: updErr } = await supabase
    .from('system_config')
    .update({ value: publicUrl, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', key);

  if (updErr) return { ok: false, hata: updErr.message };

  revalidatePath('/admin/sistem-ayarlari');
  return { ok: true, url: publicUrl };
}

export async function ayarKaydet(category: string, key: string, yeniDeger: string, dataType: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return { ok: false, hata: 'Yetkisiz işlem.' };
  }

  // data_type'a göre parse et
  let parsed: any;
  try {
    if (dataType === 'number' || dataType === 'integer') {
      const sayi = Number(yeniDeger);
      if (Number.isNaN(sayi)) return { ok: false, hata: 'Geçerli bir sayı girin.' };
      parsed = sayi;
    } else if (dataType === 'boolean') {
      parsed = yeniDeger === 'true';
    } else if (dataType === 'json') {
      parsed = JSON.parse(yeniDeger);
    } else {
      // string varsayılan
      parsed = yeniDeger;
    }
  } catch (e: any) {
    return { ok: false, hata: 'Değer formatı geçersiz: ' + e.message };
  }

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('system_config')
    .update({
      value: parsed,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('category', category)
    .eq('key', key);

  if (error) return { ok: false, hata: error.message };

  revalidatePath('/admin/sistem-ayarlari');
  return { ok: true };
}
