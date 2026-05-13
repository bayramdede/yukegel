// lib/config.ts — system_config tablosundan parametre okuma
// Yasal metinler, marka adı, logo, favicon gibi dinamik değerler için kullanılır.
import { getServiceSupabase } from './auth';

/**
 * system_config tablosundan tek bir değer okur.
 * Bulunamazsa `defaultValue` döner.
 */
export async function getConfig(key: string, defaultValue: string = ''): Promise<string> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? defaultValue;
}

/**
 * Birden fazla key'i tek sorguda okur.
 * { key: value } map'i döner, bulunamayanlar için defaultValues kullanılır.
 */
export async function getConfigs(
  keys: string[],
  defaultValues: Record<string, string> = {}
): Promise<Record<string, string>> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('system_config')
    .select('key, value')
    .in('key', keys);

  const result: Record<string, string> = { ...defaultValues };
  (data || []).forEach((row: { key: string; value: string }) => {
    result[row.key] = row.value;
  });
  return result;
}
