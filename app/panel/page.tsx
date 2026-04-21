import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';

export default async function Panel() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/giris');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: ilanlar } = await supabaseAdmin
    .from('listings')
    .select(`
      id, listing_type, origin_city, origin_district,
      status, moderation_status, created_at, expires_at,
      contact_phone, price_offer,
      listing_stops ( stop_order, city, district )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const aktif = (ilanlar || []).filter(i => i.status === 'active');
  const pasif = (ilanlar || []).filter(i => i.status !== 'active');

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/ilan-ver" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>
              + İlan Ver
            </a>
            <a href="/cikis" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>Çıkış</a>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Hoş geldin */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>
            Panelim
          </h1>
          <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            {user.email || user.phone || 'Hoş geldiniz'}
          </div>
        </div>

        {/* Özet */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Toplam İlan', value: (ilanlar || []).length, color: '#e2e8f0' },
            { label: 'Aktif', value: aktif.length, color: '#22c55e' },
            { label: 'Pasif', value: pasif.length, color: '#8b949e' },
          ].map(k => (
            <div key={k.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>{k.label}</div>
              <div style={{ color: k.color, fontWeight: 800, fontSize: '1.5rem' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* İlan listesi */}
        {(ilanlar || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz ilanınız yok</div>
            <a href="/ilan-ver" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}>
              İlk ilanınızı verin →
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {(ilanlar || []).map(ilan => {
              const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
              const isYuk = ilan.listing_type === 'yuk';
              const isAktif = ilan.status === 'active';
              const bekliyor = ilan.moderation_status === 'pending';

              return (
                <div key={ilan.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                    {/* Sol: Bilgiler */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                          {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
                        </span>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: bekliyor ? '#451a03' : isAktif ? '#14532d' : '#1f2937',
                          color: bekliyor ? '#fb923c' : isAktif ? '#22c55e' : '#9ca3af'
                        }}>
                          {bekliyor ? '⏳ Onay Bekliyor' : isAktif ? '✅ Aktif' : '💤 Pasif'}
                        </span>
                        <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>
                          {new Date(ilan.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </div>

                      {/* Rota */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700 }}>K</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ilan.origin_city}</span>
                        {ilan.origin_district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {ilan.origin_district}</span>}
                      </div>
                      {stops.map((s: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700 }}>V</span>
                          <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{s.city}</span>
                          {s.district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {s.district}</span>}
                        </div>
                      ))}
                    </div>

                    {/* Sağ: Aksiyonlar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <a href={`/ilan/${ilan.id}`}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
                        Görüntüle
                      </a>
                      {isAktif && (
                        <form action={`/api/ilan/pasif`} method="POST">
                          <input type="hidden" name="id" value={ilan.id} />
                          <button type="submit"
                            style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#9ca3af', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                            Pasife Al
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}