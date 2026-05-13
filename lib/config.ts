// lib/config.ts — system_config tablosundan parametre okuma
// next/headers bağımlılığı yok — server component ve layout içinde kullanılabilir.
import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * system_config tablosundan tek bir değer okur.
 * Bulunamazsa `defaultValue` döner.
 */
export async function getConfig(key: string, defaultValue: string = ''): Promise<string> {
  const supabase = getClient();
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
  const supabase = getClient();
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
