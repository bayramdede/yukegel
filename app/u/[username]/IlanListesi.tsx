'use client';

export default function IlanListesi({ ilanlar }: { ilanlar: any[] }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {ilanlar.map(ilan => {
        const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
        const isYuk = ilan.listing_type === 'yuk';
        return (
          <a key={ilan.id} href={`/ilan/${ilan.id}`}
            style={{ display: 'block', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px', textDecoration: 'none', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#22c55e')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#30363d')}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
                  </span>
                </div>
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
              {ilan.price_offer && (
                <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1rem' }}>
                  ₺{ilan.price_offer}
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}