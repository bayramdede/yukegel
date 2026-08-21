import { requireAdmin, getServiceSupabase } from '../../../lib/auth';
import { ilAdi } from '../../../lib/lokasyon';
import LoglarClient from './LoglarClient';

export const dynamic = 'force-dynamic';

const SATIR_LIMIT = 300;

// 21 Ağu 2026 — SPRINT: "kullanıcıların loglarını ve sorgularını arşivle".
// Dört ayrı log tablosu (auth_events, search_queries, listing_views,
// admin_actions) burada TEK sayfada birleştirilip görüntüleniyor. Detaylar
// için docs/20260821_kullanici_arsiv.sql ve PROJE_HARITASI.md §9.
export default async function LoglarPage() {
  const user = await requireAdmin();
  const svc = getServiceSupabase();

  const [authRes, searchRes, viewRes, actionRes] = await Promise.all([
    svc.from('auth_events').select('id, event, method, reason, user_id, ip, user_agent, created_at')
      .order('created_at', { ascending: false }).limit(SATIR_LIMIT),
    svc.from('search_queries').select('id, user_id, kaynak, kalkis_il_id, varis_il_id, tip, sonuc_sayisi, ip, created_at')
      .order('created_at', { ascending: false }).limit(SATIR_LIMIT),
    svc.from('listing_views').select('id, listing_id, viewer_user_id, ip, created_at')
      .order('created_at', { ascending: false }).limit(SATIR_LIMIT),
    svc.from('admin_actions').select('id, actor_id, target_user_id, alan, eski_deger, yeni_deger, created_at')
      .order('created_at', { ascending: false }).limit(SATIR_LIMIT),
  ]);

  const authEvents = authRes.data ?? [];
  const searchQueries = searchRes.data ?? [];
  const listingViews = viewRes.data ?? [];
  const adminActions = actionRes.data ?? [];

  // ── Tüm satırlarda geçen user_id'leri TEK sorguda topla ────────────────
  const userIdSet = new Set<string>();
  for (const r of authEvents) if (r.user_id) userIdSet.add(r.user_id);
  for (const r of searchQueries) if (r.user_id) userIdSet.add(r.user_id);
  for (const r of listingViews) if (r.viewer_user_id) userIdSet.add(r.viewer_user_id);
  for (const r of adminActions) {
    if (r.actor_id) userIdSet.add(r.actor_id);
    if (r.target_user_id) userIdSet.add(r.target_user_id);
  }

  const kullaniciMap: Record<string, { display_name: string | null; email: string | null; phone: string | null }> = {};
  if (userIdSet.size > 0) {
    const { data: kullanicilar } = await svc
      .from('users')
      .select('id, display_name, email, phone')
      .in('id', [...userIdSet]);
    for (const k of kullanicilar ?? []) {
      kullaniciMap[k.id] = { display_name: k.display_name, email: k.email, phone: k.phone };
    }
  }

  // ── listing_views için ilan başlığı/rotası ──────────────────────────────
  const listingIdSet = new Set(listingViews.map(r => r.listing_id).filter(Boolean));
  const listingMap: Record<string, { origin_province_id: number | null; listing_type: string | null }> = {};
  if (listingIdSet.size > 0) {
    const { data: ilanlar } = await svc
      .from('listings')
      .select('id, origin_province_id, listing_type')
      .in('id', [...listingIdSet]);
    for (const i of ilanlar ?? []) {
      listingMap[i.id] = { origin_province_id: i.origin_province_id, listing_type: i.listing_type };
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/admin" style={{ textDecoration: 'none', color: '#8b949e', fontSize: '0.85rem' }}>
            ← Yönetim Paneli
          </a>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', margin: 0, marginBottom: 6 }}>
            🗂️ Log Arşivi
          </h1>
          <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            Giriş olayları, arama sorguları, ilan görüntülemeleri ve admin/moderatör kullanıcı-yönetimi işlemleri.
            Her sekme en yeni {SATIR_LIMIT} kaydı gösterir.
          </div>
        </div>

        <LoglarClient
          authEvents={authEvents.map(r => ({ ...r, kullanici: r.user_id ? kullaniciMap[r.user_id] ?? null : null }))}
          searchQueries={searchQueries.map(r => ({
            ...r,
            kullanici: r.user_id ? kullaniciMap[r.user_id] ?? null : null,
            kalkis_il_adi: r.kalkis_il_id != null ? ilAdi(r.kalkis_il_id) : null,
            varis_il_adi: r.varis_il_id != null ? ilAdi(r.varis_il_id) : null,
          }))}
          listingViews={listingViews.map(r => ({
            ...r,
            kullanici: r.viewer_user_id ? kullaniciMap[r.viewer_user_id] ?? null : null,
            ilan: listingMap[r.listing_id] ? {
              ...listingMap[r.listing_id],
              il_adi: listingMap[r.listing_id].origin_province_id != null ? ilAdi(listingMap[r.listing_id].origin_province_id) : null,
            } : null,
          }))}
          adminActions={adminActions.map(r => ({
            ...r,
            aktor: r.actor_id ? kullaniciMap[r.actor_id] ?? null : null,
            hedef: r.target_user_id ? kullaniciMap[r.target_user_id] ?? null : null,
          }))}
        />
      </main>
    </div>
  );
}
