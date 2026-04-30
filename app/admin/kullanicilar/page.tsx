import { requireAdmin, getServiceSupabase } from '../../../lib/auth';
import KullaniciTablosu from './KullaniciTablosu';

export const dynamic = 'force-dynamic';

export default async function KullanicilarPage() {
  const user = await requireAdmin();
  const service = getServiceSupabase();

  const { data: kullanicilar } = await service
    .from('users')
    .select('id, display_name, email, phone, role, is_active, user_type, moderator_sources, created_at, auth_providers')
    .order('created_at', { ascending: false });

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/admin" style={{ textDecoration: 'none', color: '#8b949e', fontSize: '0.85rem' }}>
            ← Yönetim Paneli
          </a>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', margin: 0, marginBottom: 6 }}>
            👥 Kullanıcı Yönetimi
          </h1>
          <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            Kullanıcılara rol atayın, aktif/pasif yapın ve moderatör kaynak kısıtlamalarını belirleyin.
          </div>
        </div>

        <KullaniciTablosu kullanicilar={kullanicilar || []} />
      </main>
    </div>
  );
}
