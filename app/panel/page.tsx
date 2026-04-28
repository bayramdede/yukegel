import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import IlanYonetim from './IlanYonetim';

export default async function Panel() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/giris');

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: ilanlar }, { data: araclar }, { data: profil }] = await Promise.all([
    supabaseAdmin
      .from('listings')
      .select(`id, listing_type, origin_city, origin_district, status, moderation_status, created_at, expires_at, contact_phone, price_offer, carrier_note, completed_at, listing_stops ( stop_order, city, district )`)
      .eq('user_id', user.id)
      .in('moderation_status', ['approved', 'auto_published'])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('vehicles')
      .select('id, plate, vehicle_type, body_types, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('users')
      .select('display_name, username, user_type')
      .eq('id', user.id)
      .single(),
  ]);

  const isAracSahibi = profil?.user_type === 'arac_sahibi';
  const toplamIlan = (ilanlar || []).length;
  const aktifIlan = (ilanlar || []).filter(i => i.status === 'active' && !i.completed_at).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
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

        {/* Başlık */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.4rem', marginBottom: 4 }}>Panelim</h1>
          <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            {profil?.display_name || user.email || user.phone}
          </div>
        </div>

        {/* Özet kartlar */}
        <div style={{ display: 'grid', gridTemplateColumns: isAracSahibi ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Toplam İlan', value: toplamIlan, color: '#e2e8f0' },
            { label: 'Aktif', value: aktifIlan, color: '#22c55e' },
            { label: 'Araçlarım', value: (araclar || []).length, color: '#60a5fa', href: isAracSahibi ? '/araclarim' : null },
          ].filter(k => isAracSahibi || k.label !== 'Araçlarım').map(k => (
            k.href ? (
              <a key={k.label} href={k.href} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', textDecoration: 'none', display: 'block' }}>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>{k.label}</div>
                <div style={{ color: k.color, fontWeight: 800, fontSize: '1.5rem' }}>{k.value}</div>
                <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 4 }}>Yönet →</div>
              </a>
            ) : (
              <div key={k.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px' }}>
                <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>{k.label}</div>
                <div style={{ color: k.color, fontWeight: 800, fontSize: '1.5rem' }}>{k.value}</div>
              </div>
            )
          ))}
        </div>

        {/* Araç sahibi ama araç eklememişse uyarı */}
        {isAracSahibi && (araclar || []).length === 0 && (
          <div style={{ background: '#1a2535', border: '1px solid #1e3a5f', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>🚛 Araç eklenmemiş</div>
              <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>Araç ilanı verebilmek için önce aracınızı ekleyin.</div>
            </div>
            <a href="/araclarim" style={{ background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem', padding: '7px 16px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Araç Ekle →
            </a>
          </div>
        )}

        {/* İlan yönetim — client component */}
        <IlanYonetim ilanlar={ilanlar || []} userId={user.id} />

      </main>
    </div>
  );
}
