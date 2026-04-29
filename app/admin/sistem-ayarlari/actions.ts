'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, getServiceSupabase } from '../../../lib/auth';

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
