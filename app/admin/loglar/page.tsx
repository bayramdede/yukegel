import { requireAdmin } from '../../../lib/auth';
import { authEventsGetir, searchQueriesGetir, listingViewsGetir, adminActionsGetir } from '../../../lib/loglar';
import LoglarClient from './LoglarClient';

export const dynamic = 'force-dynamic';

const SATIR_LIMIT = 300;

// 21 Ağu 2026 — SPRINT: "kullanıcıların loglarını ve sorgularını arşivle".
// Dört ayrı log tablosu (auth_events, search_queries, listing_views,
// admin_actions) burada TEK sayfada birleştirilip görüntüleniyor. Detaylar
// için docs/20260821_kullanici_arsiv.sql ve PROJE_HARITASI.md §9.
//
// 21 Ağu 2026 (aynı gün) — zaman filtresi + CSV export eklendi. `bas`/`son`
// URL search param'ları (YYYY-MM-DD) — LoglarClient bunları `router.push` ile
// değiştiriyor, Next.js bu sayfayı (RSC) YENİDEN ÇALIŞTIRIYOR ama tam sayfa
// reload YAPMIYOR: LoglarClient unmount olmadığı için kendi `sekme` state'i
// hayatta kalıyor. Veri çekme mantığı `lib/loglar.ts`'te — CSV export route'u
// (`/api/admin/loglar/export`) AYNI fonksiyonları çağırıyor, ekranla export
// birbirinden ayrışmasın diye.
export default async function LoglarPage({
  searchParams,
}: {
  searchParams: Promise<{ bas?: string; son?: string }>;
}) {
  const user = await requireAdmin();
  const { bas, son } = await searchParams;
  const basISO = bas ? `${bas}T00:00:00.000Z` : null;
  const sonISO = son ? `${son}T23:59:59.999Z` : null;

  const [authEvents, searchQueries, listingViews, adminActions] = await Promise.all([
    authEventsGetir({ bas: basISO, son: sonISO, limit: SATIR_LIMIT }),
    searchQueriesGetir({ bas: basISO, son: sonISO, limit: SATIR_LIMIT }),
    listingViewsGetir({ bas: basISO, son: sonISO, limit: SATIR_LIMIT }),
    adminActionsGetir({ bas: basISO, son: sonISO, limit: SATIR_LIMIT }),
  ]);

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
            Ekranda seçilen aralıkta en yeni {SATIR_LIMIT} kayıt gösterilir — daha fazlası için CSV&apos;ye aktarın.
          </div>
        </div>

        <LoglarClient
          authEvents={authEvents}
          searchQueries={searchQueries}
          listingViews={listingViews}
          adminActions={adminActions}
          satirLimit={SATIR_LIMIT}
          bas={bas ?? ''}
          son={son ?? ''}
        />
      </main>
    </div>
  );
}
