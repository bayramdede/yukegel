import { requireAdmin } from '../../../lib/auth';
import CrmClient from './CrmClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CRM — Yükegel Admin' };

export default async function CrmPage() {
  const user = await requireAdmin();
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                <span style={{ color: '#22c55e' }}>YÜKE</span>
                <span style={{ color: '#e2e8f0' }}>GEL</span>
              </span>
            </a>
            <span style={{ color: '#30363d' }}>/</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem' }}>CRM</span>
          </div>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.5rem', margin: 0, marginBottom: 6 }}>
            📊 Müşteri & Potansiyel Kullanıcı Tabanı (CRM)
          </h1>
          <p style={{ color: '#8b949e', fontSize: '0.88rem', margin: 0 }}>
            WhatsApp gruplarından tespit edilen kayıtsız kullanıcılar. Gölge profil kaydı, sisteme ilan düşen her yeni numarada otomatik oluşur.
          </p>
        </div>
        <CrmClient />
      </main>
    </div>
  );
}
