import { requireAdmin } from '../../../lib/auth';
import GuvenlikClient from './GuvenlikClient';

export const dynamic = 'force-dynamic';

export default async function GuvenlikPage() {
  const user = await requireAdmin();

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/admin" style={{ textDecoration: 'none', color: '#8b949e', fontSize: '0.85rem' }}>
            ← Yönetim Paneli
          </a>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1024, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', margin: 0, marginBottom: 6 }}>
            🔒 Güvenlik & Denetim
          </h1>
          <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>
            Audit Engine kuralları, kara liste ve sistem sağlığı.
          </div>
        </div>
        <GuvenlikClient />
      </main>
    </div>
  );
}
