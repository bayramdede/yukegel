import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import PaylasButonu from './PaylasButonu';
import IlanListesi from './IlanListesi';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEVIYE = (count: number) => {
  if (count >= 100) return { label: '🏆 Efsane', color: '#f59e0b' };
  if (count >= 50)  return { label: '🔧 Usta', color: '#a855f7' };
  if (count >= 20)  return { label: '🗺️ Yol Bilir', color: '#60a5fa' };
  if (count >= 5)   return { label: '🔑 Kontak', color: '#22c55e' };
  return { label: '🆕 Acemi', color: '#8b949e' };
};

const KULLANICI_TIP: Record<string, string> = {
  yuk_sahibi: '📦 Yük Sahibi',
  arac_sahibi: '🚛 Araç Sahibi',
  sirket: '🏢 Şirket',
  broker: '🤝 Komisyoncu',
};

export default async function ProfilSayfasi({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  // Kullanıcıyı bul
  const { data: profil } = await supabaseAdmin
    .from('users')
    .select('id, display_name, username, user_type, bio, listing_count, created_at, phone')
    .eq('username', username)
    .single();

  if (!profil) return notFound();

  // Aktif ilanları çek
  const { data: ilanlar } = await supabaseAdmin
    .from('listings')
    .select(`
      id, listing_type, origin_city, origin_district,
      price_offer, created_at, moderation_status, status,
      listing_stops ( stop_order, city, district )
    `)
    .eq('user_id', profil.id)
    .order('created_at', { ascending: false });

  const aktifIlanlar = (ilanlar || []).filter(i => i.moderation_status === 'approved' || i.moderation_status === 'auto_published');
  const seviye = SEVIYE(profil.listing_count || 0);

  // Giriş yapan kullanıcı
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  const kendiProfili = user?.id === profil.id;

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
          {kendiProfili && (
            <a href="/panel" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>← Panelim</a>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Profil kartı */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#000' }}>
                  {profil.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }}>
                    {profil.display_name || profil.username}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>@{profil.username}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {profil.user_type && (
                  <span style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.75rem', padding: '3px 10px', borderRadius: 4 }}>
                    {KULLANICI_TIP[profil.user_type] || profil.user_type}
                  </span>
                )}
                <span style={{ background: '#1f2937', color: seviye.color, fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 4 }}>
                  {seviye.label}
                </span>
                <span style={{ color: '#4b5563', fontSize: '0.75rem', padding: '3px 0' }}>
                  {profil.listing_count || 0} ilan
                </span>
              </div>

              {profil.bio && (
                <div style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: 10 }}>{profil.bio}</div>
              )}
            </div>

            {/* Paylaş butonu */}
            <div style={{ display: 'flex', gap: 8 }}>
              {kendiProfili && (
                <a href="/panel" style={{ background: '#1f2937', color: '#8b949e', border: '1px solid #30363d', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>
                  ✏️ Düzenle
                </a>
              )}
                <PaylasButonu isim={profil.display_name || profil.username} />
            </div>
          </div>
        </div>

        {/* İlanlar */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>
            AKTİF İLANLAR ({aktifIlanlar.length})
          </div>

          {aktifIlanlar.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</div>
              <div>Aktif ilan yok</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
                <IlanListesi ilanlar={aktifIlanlar} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}