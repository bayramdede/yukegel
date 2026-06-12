import { requireAdmin, getServiceSupabase } from '../../../lib/auth';
import KullaniciTablosu from './KullaniciTablosu';

export const dynamic = 'force-dynamic';

export default async function KullanicilarPage() {
  const user = await requireAdmin();
  const service = getServiceSupabase();

  const { data: kullanicilar } = await service
    .from('users')
    .select('id, display_name, email, phone, role, is_active, user_type, moderator_sources, ai_listing_quota_daily, created_at, auth_providers')
    .order('created_at', { ascending: false });

  // auth.users'dan email, phone ve last_sign_in_at çek (public.users'da null olabilir)
  const authMap: Record<string, { email: string | null; phone: string | null; last_sign_in_at: string | null }> = {};
  let page = 1;
  while (true) {
    const { data: authData } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (!authData?.users?.length) break;
    for (const u of authData.users) {
      authMap[u.id] = {
        email: u.email ?? null,
        phone: u.phone ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      };
    }
    if (authData.users.length < 1000) break;
    page++;
  }

  // public.users verisini auth verisiyle birleştir
  const merged = (kullanicilar || []).map(k => ({
    ...k,
    email: k.email || authMap[k.id]?.email || null,
    phone: k.phone || authMap[k.id]?.phone || null,
    last_sign_in_at: authMap[k.id]?.last_sign_in_at || null,
  }));

  // Sistem default'unu admin tablosunda "— (default: N)" gösterebilmek için oku
  const { data: cfg } = await service
    .from('system_config')
    .select('value')
    .eq('category', 'llm')
    .eq('key', 'ai_listing_quota_default')
    .maybeSingle();
  const aiQuotaDefault = Number(cfg?.value ?? 5) || 5;

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

        <KullaniciTablosu kullanicilar={merged} aiQuotaDefault={aiQuotaDefault} />
      </main>
    </div>
  );
}
