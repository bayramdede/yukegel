import { requireAdmin } from '../../lib/auth';

export const dynamic = 'force-dynamic';

const KARTLAR = [
  {
    yol: '/admin/sistem-ayarlari',
    ikon: '⚙️',
    baslik: 'Sistem Ayarları',
    aciklama: 'Rate limit, expire süresi, OTP süresi gibi parametreler.',
    aktif: true,
  },
  {
    yol: '/admin/blacklist',
    ikon: '🚫',
    baslik: 'Blacklist',
    aciklama: 'Spam ve istenmeyen kelime listesi yönetimi.',
    aktif: false,
  },
  {
    yol: '/admin/kullanicilar',
    ikon: '👥',
    baslik: 'Kullanıcılar',
    aciklama: 'Kullanıcı listesi, rol ve durum yönetimi.',
    aktif: true,
  },
  {
    yol: '/moderator',
    ikon: '📝',
    baslik: 'Moderatör Paneli',
    aciklama: 'İlan moderasyonu, onaylama ve düzenleme.',
    aktif: true,
  },
];

export default async function AdminAna() {
  const user = await requireAdmin();

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
            <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>ADMIN</span>
          </a>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1024, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', margin: 0, marginBottom: 6 }}>Yönetim Paneli</h1>
          <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>Sistem genelini buradan yönetirsiniz.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {KARTLAR.map(k => {
            const Inner = (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.8rem' }}>{k.ikon}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{k.baslik}</span>
                    {!k.aktif && (
                      <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>YAKINDA</span>
                    )}
                  </div>
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.5 }}>{k.aciklama}</div>
              </>
            );

            const stil: React.CSSProperties = {
              display: 'block',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 10,
              padding: 20,
              textDecoration: 'none',
              cursor: k.aktif ? 'pointer' : 'not-allowed',
              opacity: k.aktif ? 1 : 0.55,
            };

            return k.aktif ? (
              <a key={k.yol} href={k.yol} style={stil}>{Inner}</a>
            ) : (
              <div key={k.yol} style={stil}>{Inner}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
