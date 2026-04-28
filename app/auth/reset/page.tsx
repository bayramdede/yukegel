'use client';
import { useState } from 'react';
import { createClient } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = createClient();

export default function SifreSifirla() {
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [hata, setHata] = useState('');
  const [tamamlandi, setTamamlandi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  const inp = {
    width: '100%', background: '#0d1117', color: '#e2e8f0',
    border: '1px solid #30363d', borderRadius: 6,
    padding: '10px 12px', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const,
  };
  const lbl = {
    color: '#8b949e', fontSize: '0.78rem', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    display: 'block', marginBottom: 6,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sifre.length < 8) { setHata('Şifre en az 8 karakter olmalı.'); return; }
    if (sifre !== sifreTekrar) { setHata('Şifreler eşleşmiyor.'); return; }
    setYukleniyor(true); setHata('');

    const { error } = await supabase.auth.updateUser({ password: sifre });
    if (error) setHata('Şifre güncellenemedi. Linkin süresi dolmuş olabilir.');
    else setTamamlandi(true);
    setYukleniyor(false);
  }

  if (tamamlandi) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Şifreniz güncellendi</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>Yeni şifrenizle giriş yapabilirsiniz.</div>
        <button onClick={() => router.push('/giris')}
          style={{ background: '#22c55e', color: '#000', fontWeight: 700, borderRadius: 8, border: 'none', padding: '11px 28px', cursor: 'pointer', fontSize: '0.95rem' }}>
          Giriş Yap →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 44, height: 44, marginBottom: 10 }} />
          <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>Yeni Şifre Belirle</div>
          <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 20 }}>En az 8 karakter kullanın.</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Yeni Şifre</label>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" required style={inp} autoFocus />
              {sifre.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[sifre.length >= 8, /[0-9]/.test(sifre), /[A-Z]/.test(sifre)].map((ok, i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: ok ? '#22c55e' : '#374151', transition: 'background 0.2s' }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Şifre Tekrar</label>
              <input type="password" value={sifreTekrar} onChange={e => setSifreTekrar(e.target.value)} placeholder="••••••••" required
                style={{ ...inp, borderColor: sifreTekrar && sifreTekrar !== sifre ? '#ef4444' : '#30363d' }} />
              {sifreTekrar && sifreTekrar !== sifre && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 4 }}>Şifreler eşleşmiyor.</div>}
            </div>

            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}

            <button type="submit" disabled={yukleniyor}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
              {yukleniyor ? 'Kaydediliyor...' : 'Şifreyi Güncelle →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
