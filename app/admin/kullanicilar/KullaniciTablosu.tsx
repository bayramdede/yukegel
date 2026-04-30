'use client';
import { useState } from 'react';

type Kullanici = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  user_type: string | null;
  moderator_sources: string[] | null;
  created_at: string;
  auth_providers: string[] | null;
};

async function guncelle(id: string, alan: string, deger: unknown) {
  const res = await fetch('/api/admin/kullanici', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, alan, deger }),
  });
  if (!res.ok) throw new Error('Güncelleme başarısız');
}

export default function KullaniciTablosu({ kullanicilar: ilk }: { kullanicilar: Kullanici[] }) {
  const [liste, setListe] = useState<Kullanici[]>(ilk);
  const [yukleniyor, setYukleniyor] = useState<Record<string, boolean>>({});
  const [hata, setHata] = useState<Record<string, string>>({});
  const [arama, setArama] = useState('');

  async function kaydet(id: string, alan: string, deger: unknown) {
    setYukleniyor(p => ({ ...p, [`${id}_${alan}`]: true }));
    setHata(p => ({ ...p, [id]: '' }));
    try {
      await guncelle(id, alan, deger);
      setListe(prev => prev.map(u => u.id === id ? { ...u, [alan]: deger } : u));
    } catch {
      setHata(p => ({ ...p, [id]: 'Hata oluştu' }));
    }
    setYukleniyor(p => ({ ...p, [`${id}_${alan}`]: false }));
  }

  const filtreli = liste.filter(u => {
    const q = arama.toLowerCase();
    return !q ||
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q);
  });

  const kaynakSecenekleri = [
    { value: null, label: 'Tüm kaynaklar' },
    { value: ['whatsapp'], label: 'Sadece WhatsApp' },
    { value: ['web'], label: 'Sadece Web' },
  ];

  const td: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid #21262d',
    color: '#e2e8f0',
    fontSize: '0.82rem',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  };

  const th: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'left',
    color: '#8b949e',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: '1px solid #30363d',
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="🔍  Ad, e-posta veya telefon ara..."
          style={{
            width: '100%', maxWidth: 360, background: '#0d1117', color: '#e2e8f0',
            border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px',
            fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <span style={{ marginLeft: 12, color: '#4b5563', fontSize: '0.78rem' }}>
          {filtreli.length} kullanıcı
        </span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #30363d' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#161b22' }}>
          <thead>
            <tr>
              <th style={th}>Kullanıcı</th>
              <th style={th}>İletişim</th>
              <th style={th}>Üye Türü</th>
              <th style={th}>Giriş Yöntemi</th>
              <th style={th}>Rol</th>
              <th style={th}>Mod. Kaynağı</th>
              <th style={th}>Aktif</th>
            </tr>
          </thead>
          <tbody>
            {filtreli.map(u => {
              const rolYukleniyor = yukleniyor[`${u.id}_role`];
              const aktifYukleniyor = yukleniyor[`${u.id}_is_active`];
              const kaynakYukleniyor = yukleniyor[`${u.id}_moderator_sources`];
              const providers = u.auth_providers || [];

              const mevcutKaynakIdx = kaynakSecenekleri.findIndex(k => {
                if (k.value === null && !u.moderator_sources) return true;
                if (Array.isArray(k.value) && Array.isArray(u.moderator_sources))
                  return JSON.stringify(k.value) === JSON.stringify(u.moderator_sources);
                return false;
              });

              return (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.45 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {u.display_name || <span style={{ color: '#4b5563' }}>—</span>}
                    </div>
                    {hata[u.id] && (
                      <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 2 }}>⚠️ {hata[u.id]}</div>
                    )}
                  </td>

                  <td style={{ ...td, maxWidth: 200 }}>
                    <div style={{ color: '#8b949e', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email || '—'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>{u.phone || '—'}</div>
                  </td>

                  <td style={td}>
                    <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                      {u.user_type || '—'}
                    </span>
                  </td>

                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {providers.includes('google') && (
                        <span style={{ background: '#1c2d1e', color: '#4ade80', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4 }}>Google</span>
                      )}
                      {providers.includes('phone') && (
                        <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4 }}>OTP</span>
                      )}
                      {providers.length === 0 && <span style={{ color: '#374151' }}>—</span>}
                    </div>
                  </td>

                  <td style={td}>
                    <select
                      value={u.role}
                      disabled={rolYukleniyor}
                      onChange={e => kaydet(u.id, 'role', e.target.value)}
                      style={{
                        background: '#0d1117', color: '#e2e8f0',
                        border: '1px solid #30363d', borderRadius: 6,
                        padding: '5px 8px', fontSize: '0.8rem', cursor: 'pointer',
                        opacity: rolYukleniyor ? 0.5 : 1,
                      }}
                    >
                      <option value="user">Kullanıcı</option>
                      <option value="moderator">Moderatör</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td style={td}>
                    {u.role === 'moderator' ? (
                      <select
                        value={mevcutKaynakIdx >= 0 ? mevcutKaynakIdx : 0}
                        disabled={kaynakYukleniyor}
                        onChange={e => {
                          const secilen = kaynakSecenekleri[Number(e.target.value)];
                          kaydet(u.id, 'moderator_sources', secilen.value);
                        }}
                        style={{
                          background: '#0d1117', color: '#e2e8f0',
                          border: '1px solid #30363d', borderRadius: 6,
                          padding: '5px 8px', fontSize: '0.8rem', cursor: 'pointer',
                          opacity: kaynakYukleniyor ? 0.5 : 1,
                        }}
                      >
                        {kaynakSecenekleri.map((k, i) => (
                          <option key={i} value={i}>{k.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>

                  <td style={td}>
                    <button
                      disabled={aktifYukleniyor}
                      onClick={() => kaydet(u.id, 'is_active', !u.is_active)}
                      title={u.is_active ? 'Aktif – kapat' : 'Pasif – aç'}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none',
                        background: u.is_active ? '#22c55e' : '#374151',
                        cursor: aktifYukleniyor ? 'not-allowed' : 'pointer',
                        position: 'relative', transition: 'background 0.2s',
                        opacity: aktifYukleniyor ? 0.6 : 1,
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: u.is_active ? 22 : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                      }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtreli.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
            Kullanıcı bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
