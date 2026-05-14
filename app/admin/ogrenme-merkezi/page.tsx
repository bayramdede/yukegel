import { requireAdmin } from '../../../lib/auth';
import OgrenmeMerkeziClient from './OgrenmeMerkeziClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Öğrenme Merkezi — Admin' };

export default async function OgrenmeMerkeziPage() {
  const user = await requireAdmin();

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/logo.svg" alt="Yükegel" style={{ width: 26, height: 26 }} />
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                <span style={{ color: '#22c55e' }}>YÜKE</span>
                <span style={{ color: '#e2e8f0' }}>GEL</span>
              </span>
              <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>ADMIN</span>
            </a>
            <span style={{ color: '#30363d' }}>/</span>
            <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>Öğrenme Merkezi</span>
          </div>
          <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>
        {/* Başlık */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.5rem', margin: 0, marginBottom: 6 }}>
            🧠 Smart Learning Hub
          </h1>
          <p style={{ color: '#8b949e', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>
            Rotası çözülemeyen (<code style={{ color: '#f59e0b', background: '#0d1117', padding: '1px 5px', borderRadius: 3 }}>no_lane</code>) ilan oranını düşür.
            AI ile yeni yer adı alias'larını keşfet, onayla ve ilanları yeniden işle.
          </p>
        </div>

        {/* İstatistik Kartları — client tarafına bırakıldı (API'den dinamik) */}
        <OgrenmeMerkeziClient />
      </main>
    </div>
  );
}
