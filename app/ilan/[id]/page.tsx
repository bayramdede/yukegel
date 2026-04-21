import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Aksiyonlar from './Aksiyonlar';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function IlanDetay({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data: ilan } = await supabase
    .from('listings')
    .select(`
      id, listing_type, origin_city, origin_district,
      contact_phone, price_offer, price_negotiable,
      available_date, date_flexible, notes, source,
      created_at, moderation_status,
      listing_stops (
        stop_order, city, district,
        vehicle_count, cargo_type, weight_ton, pallet_count, notes
      )
    `)
    .eq('id', id)
    .single();

  if (!ilan || ilan.moderation_status === 'rejected') return notFound();

  // Kullanıcı giriş yapmış mı?
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();

  const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
  const isYuk = ilan.listing_type === 'yuk';

  const KAYNAK_ETIKET: Record<string, { label: string; bg: string; color: string }> = {
    form:     { label: 'Yükegel',      bg: '#0d2b1a', color: '#22c55e' },
    whatsapp: { label: '📱 WhatsApp',  bg: '#0d2b0d', color: '#4ade80' },
    facebook: { label: '👥 Facebook',  bg: '#1e3a5f', color: '#60a5fa' },
  };
  const kaynak = KAYNAK_ETIKET[ilan.source] || KAYNAK_ETIKET.form;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          <a href="/" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Tüm İlanlar
          </a>
        </div>
      </nav>


      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>

        {/* Üst: Tip + Kaynak */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            background: isYuk ? '#7f1d1d' : '#14532d',
            color: isYuk ? '#fca5a5' : '#86efac',
            fontSize: '0.78rem', fontWeight: 700, padding: '4px 12px', borderRadius: 6
          }}>
            {isYuk ? '🔴 YÜK İLANI' : '🟢 ARAÇ İLANI'}
          </span>
          <span style={{ background: kaynak.bg, color: kaynak.color, fontSize: '0.78rem', fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>
            {kaynak.label}
          </span>
          <span style={{ color: '#4b5563', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {/* Rota Kartı */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>ROTA</div>

          {/* Kalkış */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <div style={{ width: 2, background: '#30363d', flex: 1, minHeight: 24, marginTop: 4 }} />
            </div>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 2 }}>KALKIŞ</div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }}>{ilan.origin_city}</div>
              {ilan.origin_district && (
                <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>{ilan.origin_district}</div>
              )}
            </div>
          </div>

          {/* Varış noktaları */}
          {stops.map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < stops.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                {i < stops.length - 1 && <div style={{ width: 2, background: '#30363d', flex: 1, minHeight: 24, marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 2 }}>
                  {stops.length > 1 ? `VARIŞ ${i + 1}` : 'VARIŞ'}
                </div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem' }}>{s.city}</div>
                {s.district && <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>{s.district}</div>}

                {/* Durak detayları */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {s.vehicle_count > 1 && (
                    <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4 }}>
                      🚛 {s.vehicle_count} araç
                    </span>
                  )}
                  {s.weight_ton && (
                    <span style={{ background: '#1a2a1a', color: '#86efac', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4 }}>
                      ⚖ {s.weight_ton} ton
                    </span>
                  )}
                  {s.pallet_count && (
                    <span style={{ background: '#1a2a1a', color: '#86efac', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4 }}>
                      📦 {s.pallet_count} palet
                    </span>
                  )}
                  {s.cargo_type && (
                    <span style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.78rem', padding: '3px 10px', borderRadius: 4 }}>
                      {s.cargo_type}
                    </span>
                  )}
                </div>
                {s.notes && (
                  <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 6 }}>📝 {s.notes}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detay Kartı */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>DETAYLAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {ilan.available_date && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Tarih</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {new Date(ilan.available_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  {ilan.date_flexible && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 6 }}>(esnek)</span>}
                </div>
              </div>
            )}
            {ilan.price_offer && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Ücret</div>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem' }}>
                  ₺{Number(ilan.price_offer).toLocaleString('tr-TR')}
                  {ilan.price_negotiable && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 6 }}>(pazarlık)</span>}
                </div>
              </div>
            )}
          </div>
          {ilan.notes && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #30363d' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 6 }}>Not</div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.6 }}>{ilan.notes}</div>
            </div>
          )}
        </div>

        {/* İletişim Kartı */}
        <div style={{ background: '#161b22', border: '1px solid #166534', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>İLETİŞİM</div>
          
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: '#e2e8f0', fontSize: '1.1rem', fontWeight: 700 }}>
                📞 {ilan.contact_phone}
              </div>
              <a href={`tel:${ilan.contact_phone}`}
                style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}>
                Hemen Ara
              </a>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 12 }}>
                Telefon numarasını görmek için giriş yapın.
              </div>
              <a href={`/giris?redirect=/ilan/${ilan.id}`}
                style={{ display: 'inline-block', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}>
                🔐 Giriş Yap / Kaydol
              </a>
            </div>
          )}
          
          <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 12 }}>
            Telefon numarası ilan sahibine aittir. Yükegel aracılık yapmaz.
          </div>
        </div>
<Aksiyonlar ilanId={ilan.id} />
      </main>
    </div>
  );
}