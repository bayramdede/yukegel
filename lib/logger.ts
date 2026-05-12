// lib/logger.ts — Yükegel Merkezi Structured Logger
// Vercel Logs / Supabase Edge Function Logs JSON modunda otomatik parse edilir.
// KVKK: Ham telefon/TCKN/VKN/IP asla loglanmaz — maskele() fonksiyonları zorunlu.

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export type LogContext =
  | 'phone-privacy'
  | 'moderator-actions'
  | 'audit-engine'
  | 'llm-parser'
  | 'db-transaction'
  | 'excel-import'
  | 'llm-quota'
  | 'rls-monitor'
  | 'auth'

interface LogEntry {
  level: LogLevel
  service: 'yukegel-api'
  context: LogContext
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

// ── Maskeleme yardımcıları (KVKK) ────────────────────────────────────

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const clean = phone.replace(/\D/g, '')
  if (clean.length < 7) return '***'
  return clean.slice(0, 4) + '***' + clean.slice(-3)
}

export function maskTckn(val: string | null | undefined): string {
  if (!val) return '—'
  if (val.length < 6) return '***'
  return val.slice(0, 3) + '****' + val.slice(-3) + '*'
}

export function maskVkn(val: string | null | undefined): string {
  if (!val) return '—'
  if (val.length < 5) return '***'
  return val.slice(0, 3) + '****' + val.slice(-2) + '*'
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '—'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`
  const v6parts = ip.split(':')
  if (v6parts.length > 2) return v6parts.slice(0, 2).join(':') + ':****'
  return '***'
}

// ── Ana log fonksiyonu ───────────────────────────────────────────────

export function structuredLog(
  level: LogLevel,
  context: LogContext,
  message: string,
  metadata: Record<string, unknown> = {}
): void {
  const entry: LogEntry = {
    level,
    service: 'yukegel-api',
    context,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  }
  // Vercel: stdout JSON satırları otomatik ayrıştırılır
  console.log(JSON.stringify(entry))
}

// ── SecurityLogger: Yetkisiz / eksik profil ile hassas veri erişimi ──

/**
 * Telefon numarası görüntüleme olayını logla.
 * profile_completed = false ise WARN (yetkisiz erişim girişimi).
 */
export function logPhoneAccess(params: {
  viewerId: string | 'anonim'
  targetListingId?: string
  profileCompleted: boolean
}): void {
  structuredLog(
    params.profileCompleted ? 'INFO' : 'WARN',
    'phone-privacy',
    params.profileCompleted
      ? 'Telefon numarası erişimi'
      : 'Yetkisiz telefon numarası erişim girişimi — profil tamamlanmamış',
    {
      viewer_id: params.viewerId,
      target_listing_id: params.targetListingId ?? null,
      profile_completed: params.profileCompleted,
    }
  )
}

/**
 * RLS 42501 hatasını standardize ederek logla.
 * Sadece code === '42501' olan Supabase hatalarını işler.
 */
export function logRlsError(params: {
  userId: string | 'anonim'
  route: string
  table: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  rawError?: unknown
}): void {
  const err = params.rawError as { code?: string } | null
  if (!err?.code || err.code !== '42501') return
  structuredLog('WARN', 'rls-monitor', 'RLS 42501 — Permission Denied', {
    user_id: params.userId,
    route: params.route,
    table: params.table,
    operation: params.operation,
    supabase_error_code: '42501',
  })
}

/**
 * Moderatör / admin toplu işlem audit logu.
 */
export function logModeratorAction(params: {
  adminId: string
  action: string
  affectedIds: string[]
  reason?: string
}): void {
  structuredLog('INFO', 'moderator-actions', 'Toplu işlem gerçekleştirildi', {
    admin_id: params.adminId,
    action: params.action,
    affected_ids: params.affectedIds,
    reason: params.reason ?? null,
  })
}
