// lib/auditLimits.ts — Audit eşikleri & AI ilan quota helper'ları
// Sistem ayarları sayfasından admin tarafından değiştirilebilen değerleri okur.
// Hard-coded fallback'ler güvenlik için bırakıldı (DB'de anahtar bulunmazsa devreye girer).

import { getServiceSupabase } from './auth';

export interface AuditThresholds {
  /** Bu skorun ALTINDA olan ilanlar otomatik yayında. Default: 31 */
  autoPublishScoreMax: number;
  /** Bu skor ve ÜZERİ olan ilanlar shadow_ban + archived. Default: 71 */
  rejectScoreMin: number;
}

const FALLBACK_AUTO_PUBLISH_MAX = 31;
const FALLBACK_REJECT_MIN = 71;
const FALLBACK_AI_QUOTA_DEFAULT = 5;

/**
 * Audit skoru eşiklerini system_config tablosundan okur.
 * Bağımlı: /api/ilan/duzelt — re-scan sonrası moderation_status kararı bu eşiklere göre verilir.
 * Trigger içindeki fonksiyon (audit_listing_fn) ayrıca aynı değerleri okur (DB tarafında).
 */
export async function getAuditThresholds(): Promise<AuditThresholds> {
  try {
    const svc = getServiceSupabase();
    const { data } = await svc
      .from('system_config')
      .select('key, value')
      .eq('category', 'parse')
      .in('key', ['auto_publish_score_max', 'reject_score_min']);

    const map: Record<string, any> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });

    const autoPublishScoreMax = toInt(map.auto_publish_score_max, FALLBACK_AUTO_PUBLISH_MAX);
    const rejectScoreMin = toInt(map.reject_score_min, FALLBACK_REJECT_MIN);

    return { autoPublishScoreMax, rejectScoreMin };
  } catch {
    return { autoPublishScoreMax: FALLBACK_AUTO_PUBLISH_MAX, rejectScoreMin: FALLBACK_REJECT_MIN };
  }
}

/**
 * Bir kullanıcının günlük AI ilan limitini döner.
 * Öncelik: users.ai_listing_quota_daily (per-user override)
 * Yoksa:   system_config.ai_listing_quota_default
 * Bulunamazsa: 5 (hard-coded fallback)
 */
export async function getAiQuotaForUser(userId: string): Promise<number> {
  if (!userId) return FALLBACK_AI_QUOTA_DEFAULT;
  try {
    const svc = getServiceSupabase();

    // Per-user override (NULL = default kullan)
    const { data: u } = await svc
      .from('users')
      .select('ai_listing_quota_daily')
      .eq('id', userId)
      .maybeSingle();

    if (u && u.ai_listing_quota_daily !== null && u.ai_listing_quota_daily !== undefined) {
      return Math.max(0, Number(u.ai_listing_quota_daily) || 0);
    }

    // System default
    const { data: cfg } = await svc
      .from('system_config')
      .select('value')
      .eq('category', 'llm')
      .eq('key', 'ai_listing_quota_default')
      .maybeSingle();

    return Math.max(0, toInt(cfg?.value, FALLBACK_AI_QUOTA_DEFAULT));
  } catch {
    return FALLBACK_AI_QUOTA_DEFAULT;
  }
}

/**
 * Son 24 saatte kullanıcının AI üzerinden açtığı ilan sayısı.
 * Tanım: listings.user_id = X AND raw_text IS NOT NULL AND created_at > now() - 24h
 * (Metinden İlan akışı raw_text'i doldurur — diğer kanallar genellikle null bırakır;
 *  WhatsApp/excel ilanlarının user_id'si NULL olduğu için zaten sayıma dahil olmazlar.)
 */
export async function countAiListingsLast24h(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const svc = getServiceSupabase();
    const yirmiDortSaatOnce = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await svc
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('raw_text', 'is', null)
      .gte('created_at', yirmiDortSaatOnce);
    return count || 0;
  } catch {
    return 0;
  }
}

function toInt(v: any, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
