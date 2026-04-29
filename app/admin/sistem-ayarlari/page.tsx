import { requireAdmin, getServiceSupabase } from '../../../lib/auth';
import AyarSatiri from './AyarSatiri';

export const dynamic = 'force-dynamic';

const KATEGORI_BASLIK: Record<string, { ikon: string; baslik: string; aciklama: string }> = {
  rate_limit: { ikon: '⏱️', baslik: 'Rate Limit', aciklama: 'API ve işlem hız sınırları.' },
  expire: { ikon: '📅', baslik: 'Süre & Expire', aciklama: 'İlan, OTP ve oturum süreleri.' },
  otp: { ikon: '🔐', baslik: 'OTP', aciklama: 'SMS doğrulama parametreleri.' },
  llm: { ikon: '🤖', baslik: 'LLM', aciklama: 'Yapay zeka entegrasyonu ayarları.' },
  parse: { ikon: '🔍', baslik: 'Parse', aciklama: 'WhatsApp/metin işleme parametreleri.' },
  general: { ikon: '⚙️', baslik: 'Genel', aciklama: 'Diğer sistem ayarları.' },
};

export default async function SistemAyarlari() {
  const user = await requireAdmin();
  const supabase = getServiceSupabase();

  const { data: ayarlar } = await supabase
    .from('system_config')
    .select('category, key, value, data_type, description, updated_at')
    .order('category')
    .order('key');

  // Kategori bazında grupla
  const gruplar: Record<string, any[]> = {};
  (ayarlar || []).forEach((a: any) => {
    const k = a.category || 'general';
    if (!gruplar[k]) gruplar[k] = [];
    gruplar[k].push(a);
  });

  const kategoriSira = ['rate_limit', 'expire', 'otp', 'llm', 'parse', 'general'];
  const sirali = [
    ...kategoriSira.filter(k => gruplar[k]),
    ...Object.keys(gruplar).filter(k => !kategoriSira.includes(k)),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/admin" style={{ textDecoration: 'none', color: '#8b949e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            ← Yönetim Paneli
          </a>
          <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>{user.email}</span>
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.6rem', margin: 0, marginBottom: 6 }}>
            ⚙️ Sistem Ayarları
          </h1>
          <div style={{ color: '#8b949e', fontSize: '0.9rem', lineHeight: 1.5 }}>
            Bu sayfadaki değişiklikler tüm sistemi etkiler. Dikkatli olun.
          </div>
        </div>

        {sirali.length === 0 && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 32, textAlign: 'center', color: '#8b949e' }}>
            Henüz ayar tanımlanmamış. <code style={{ color: '#22c55e' }}>system_config</code> tablosuna kayıt ekleyin.
          </div>
        )}

        {sirali.map(kat => {
          const meta = KATEGORI_BASLIK[kat] || { ikon: '📌', baslik: kat, aciklama: '' };
          return (
            <section key={kat} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #21262d' }}>
                <span style={{ fontSize: '1.2rem' }}>{meta.ikon}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{meta.baslik}</span>
                {meta.aciklama && <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>· {meta.aciklama}</span>}
                <span style={{ marginLeft: 'auto', color: '#4b5563', fontSize: '0.72rem' }}>{gruplar[kat].length} ayar</span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {gruplar[kat].map((ayar: any) => (
                  <AyarSatiri key={`${ayar.category}.${ayar.key}`} ayar={ayar} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
