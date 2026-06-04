import { requireAdmin } from '../../../../lib/auth';
import AnalitikClient from './AnalitikClient';

export const dynamic = 'force-dynamic';

export default async function RadarAnalitikPage() {
  const user = await requireAdmin();
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 7 }}>
              <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
              </span>
            </a>
            <span style={{ color: '#30363d' }}>›</span>
            <a href="/admin/radar" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Radar</a>
            <span style={{ color: '#30363d' }}>›</span>
            <span style={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 600 }}>📊 Analitik</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <a href="/admin/radar" style={{
              color: '#8b949e', fontSize: '0.78rem', textDecoration: 'none',
              border: '1px solid #30363d', borderRadius: 6, padding: '4px 10px',
            }}>
              🔍 Lead Radar →
            </a>
            <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>{user.email}</span>
          </div>
        </div>
      </nav>
      <AnalitikClient />
    </div>
  );
}
