'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = createClient();

export default function ModeratorGiris() {
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  const handleGiris = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    setHata('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: sifre,
    });

    if (error) {
      setHata('E-posta veya şifre hatalı.');
      setYukleniyor(false);
    } else {
      router.push('/moderator');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 48, height: 48, marginBottom: 12 }} />
          <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span>
            <span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          <div style={{ color: '#fb923c', fontSize: '0.85rem', marginTop: 4, fontWeight: 600 }}>
            Moderatör Girişi
          </div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleGiris}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                E-posta
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="moderator@yukegel.com"
                style={{ width: '100%', background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Şifre
              </label>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)}
                required placeholder="••••••••"
                style={{ width: '100%', background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {hata && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>
                ⚠️ {hata}
              </div>
            )}

            <button type="submit" disabled={yukleniyor}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#451a03' : '#fb923c', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
              {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/giris" style={{ color: '#4b5563', fontSize: '0.75rem', textDecoration: 'none' }}>
            ← Kullanıcı girişine dön
          </a>
        </div>
      </div>
    </div>
  );
}