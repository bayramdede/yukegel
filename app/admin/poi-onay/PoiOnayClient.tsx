'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: '#0d1117', surface: '#161b22', border: '#30363d',
  text: '#e2e8f0', muted: '#8b949e', dim: '#4b5563',
  green: '#22c55e', greenBg: '#14532d', greenDark: '#0d2b1a',
  red: '#ef4444', redBg: '#7f1d1d',
  amber: '#f59e0b', amberBg: '#451a03',
};

const KATEGORI: Record<string, string> = {
  park_dinlenme:   '🅿️ Park & Dinlenme',
  yemek:           '🍲 Yemek',
  konaklama:       '🛏️ Konaklama',
  tamirci:         '🛠️ Tamirci & Usta',
  tesis_akaryakit: '⛽ Tesis & Akaryakıt',
  kantar_resmi:    '⚖️ Kantar & Resmi',
};

interface Poi {
  id: string;
  name: string;
  category: string;
  city: string | null;
  latitude: number;
  longitude: number;
  is_emergency: boolean;
  status: string;
  added_by: string | null;
  created_at: string;
  ekleyen: { display_name: string | null; email: string | null } | null;
}

export default function PoiOnayClient() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<Record<string, 'onay' | 'ret'>>({});
  const [hata, setHata] = useState('');
  const [gosterilen, setGosterilen] = useState<'pending' | 'approved' | 'rejected'>('pending');

  async function yukle(status: 'pending' | 'approved' | 'rejected') {
    setYukleniyor(true);
    setHata('');
    try {
      const res = await fetch(`/api/admin/poi?status=${status}`);
      const d = await res.json();
      if (d.success) setPois(d.data);
      else setHata(d.error || 'Veriler alınamadı.');
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setYukleniyor(false);
    }
  }

  useEffect(() => { yukle(gosterilen); }, [gosterilen]);

  async function durumGuncelle(id: string, status: 'approved' | 'rejected') {
    setIslem(prev => ({ ...prev, [id]: status === 'approved' ? 'onay' : 'ret' }));
    try {
      const res = await fetch(`/api/poi/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (d.success) {
        setPois(prev => prev.filter(p => p.id !== id));
      } else {
        setHata(d.error || 'İşlem başarısız.');
      }
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setIslem(prev => { const s = { ...prev }; delete s[id]; return s; });
    }
  }

  const tabs: { key: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { key: 'pending',  label: '⏳ Bekleyenler' },
    { key: 'approved', label: '✅ Onaylananlar' },
    { key: 'rejected', label: '❌ Reddedilenler' },
  ];

  return (
    <div>
      {/* Sekme çubuğu */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setGosterilen(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700,
              color: gosterilen === t.key ? C.green : C.muted,
              borderBottom: gosterilen === t.key ? `2px solid ${C.green}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => yukle(gosterilen)}
          style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer' }}
        >
          🔄 Yenile
        </button>
      </div>

      {hata && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
          ⚠️ {hata}
        </div>
      )}

      {yukleniyor ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim }}>Yükleniyor...</div>
      ) : pois.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 600, color: C.muted }}>
            {gosterilen === 'pending' ? 'Bekleyen POI yok.' : 'Kayıt bulunamadı.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pois.map(poi => (
            <div
              key={poi.id}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}
            >
              {/* Sol: bilgiler */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>{poi.name}</span>
                  {poi.is_emergency && (
                    <span style={{ background: C.redBg, color: C.red, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>🆘 ACİL</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ color: C.muted, fontSize: '0.8rem' }}>{KATEGORI[poi.category] ?? poi.category}</span>
                  {poi.city && <span style={{ color: C.dim, fontSize: '0.8rem' }}>📍 {poi.city}</span>}
                </div>
                <div style={{ color: C.dim, fontSize: '0.75rem' }}>
                  Ekleyen:{' '}
                  <span style={{ color: C.muted }}>
                    {poi.ekleyen?.display_name || poi.ekleyen?.email || (poi.added_by ? 'Kayıtlı kullanıcı' : 'Anonim')}
                  </span>
                  {' · '}
                  {new Date(poi.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Harita linki */}
              <a
                href={`https://maps.google.com/?q=${poi.latitude},${poi.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.muted, fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                🗺️ Haritada gör
              </a>

              {/* Sağ: butonlar (sadece pending'de göster) */}
              {gosterilen === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => durumGuncelle(poi.id, 'approved')}
                    disabled={!!islem[poi.id]}
                    style={{
                      background: islem[poi.id] === 'onay' ? C.greenBg : C.greenDark,
                      color: C.green, border: `1px solid ${C.greenBg}`,
                      borderRadius: 6, padding: '6px 16px',
                      fontSize: '0.82rem', fontWeight: 700,
                      cursor: islem[poi.id] ? 'wait' : 'pointer',
                      opacity: islem[poi.id] && islem[poi.id] !== 'onay' ? 0.4 : 1,
                    }}
                  >
                    {islem[poi.id] === 'onay' ? '...' : '✅ Onayla'}
                  </button>
                  <button
                    onClick={() => durumGuncelle(poi.id, 'rejected')}
                    disabled={!!islem[poi.id]}
                    style={{
                      background: islem[poi.id] === 'ret' ? C.redBg : 'transparent',
                      color: C.red, border: `1px solid ${C.redBg}`,
                      borderRadius: 6, padding: '6px 16px',
                      fontSize: '0.82rem', fontWeight: 700,
                      cursor: islem[poi.id] ? 'wait' : 'pointer',
                      opacity: islem[poi.id] && islem[poi.id] !== 'ret' ? 0.4 : 1,
                    }}
                  >
                    {islem[poi.id] === 'ret' ? '...' : '❌ Reddet'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!yukleniyor && pois.length > 0 && (
        <div style={{ color: C.dim, fontSize: '0.78rem', marginTop: 16, textAlign: 'right' }}>
          {pois.length} kayıt
        </div>
      )}
    </div>
  );
}
