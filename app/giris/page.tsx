'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = createClient();

export default function Giris() {
  const [adim, setAdim] = useState<'telefon' | 'otp'>('telefon');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  async function otpGonder(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata('');

    // Telefonu +90 formatına çevir
    const temizTelefon = telefon.replace(/\D/g, '');
    const formatliTelefon = temizTelefon.startsWith('90')
      ? `+${temizTelefon}`
      : temizTelefon.startsWith('0')
      ? `+9${temizTelefon}`
      : `+90${temizTelefon}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: formatliTelefon,
    });

    if (error) {
      setHata('SMS gönderilemedi. Numarayı kontrol edin.');
    } else {
      setAdim('otp');
    }
    setYukleniyor(false);
  }

  async function otpDogrula(e: React.FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setHata('');

    const temizTelefon = telefon.replace(/\D/g, '');
    const formatliTelefon = temizTelefon.startsWith('90')
      ? `+${temizTelefon}`
      : temizTelefon.startsWith('0')
      ? `+9${temizTelefon}`
      : `+90${temizTelefon}`;

    const { error } = await supabase.auth.verifyOtp({
      phone: formatliTelefon,
      token: otp,
      type: 'sms',
    });

    if (error) {
      setHata('Kod hatalı veya süresi dolmuş.');
    } else {
      router.push('/');
    }
    setYukleniyor(false);
  }

  const inputStyle = {
    width: '100%', background: '#0d1117', color: '#e2e8f0',
    border: '1px solid #30363d', borderRadius: 6,
    padding: '10px 12px', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const
  };

  const labelStyle = {
    color: '#8b949e', fontSize: '0.78rem', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    display: 'block', marginBottom: 6
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 48, height: 48, marginBottom: 12 }} />
          <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span>
            <span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: 4 }}>
            {adim === 'telefon' ? 'Giriş Yap / Kayıt Ol' : 'Doğrulama Kodu'}
          </div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>

          {adim === 'telefon' ? (
            <form onSubmit={otpGonder}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Telefon Numarası</label>
                <input
                  type="tel" value={telefon}
                  onChange={e => setTelefon(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  required style={inputStyle}
                  autoFocus
                />
                <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 6 }}>
                  Size SMS ile doğrulama kodu göndereceğiz.
                </div>
              </div>

              {hata && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>
                  ⚠️ {hata}
                </div>
              )}

              <button type="submit" disabled={yukleniyor}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                  background: yukleniyor ? '#166534' : '#22c55e',
                  color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer'
                }}>
                {yukleniyor ? 'Gönderiliyor...' : 'Kod Gönder →'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpDogrula}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Doğrulama Kodu</label>
                <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 12 }}>
                  📱 {telefon} numarasına SMS gönderdik.
                </div>
                <input
                  type="text" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  placeholder="6 haneli kod"
                  required maxLength={6}
                  style={{
                    ...inputStyle,
                    fontSize: '1.5rem', textAlign: 'center',
                    letterSpacing: '0.3em', fontWeight: 700
                  }}
                  autoFocus
                />
              </div>

              {hata && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 16, textAlign: 'center' }}>
                  ⚠️ {hata}
                </div>
              )}

              <button type="submit" disabled={yukleniyor || otp.length < 6}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                  background: otp.length === 6 ? '#22c55e' : '#166534',
                  color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer'
                }}>
                {yukleniyor ? 'Doğrulanıyor...' : 'Giriş Yap →'}
              </button>

              <button type="button" onClick={() => { setAdim('telefon'); setOtp(''); setHata(''); }}
                style={{
                  width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
                  border: '1px solid #30363d', background: 'none',
                  color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer'
                }}>
                ← Telefon numarasını değiştir
              </button>
            </form>
          )}
        </div>
{/* AYRAÇ */}
<div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
  <div style={{ flex: 1, height: 1, background: '#30363d' }} />
  <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>veya</span>
  <div style={{ flex: 1, height: 1, background: '#30363d' }} />
</div>

{/* GOOGLE BUTONU */}
<button
  type="button"
  onClick={async () => {
    const { createClient } = await import('../../lib/supabase');
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }}
  style={{
    width: '100%', padding: '11px', borderRadius: 8,
    border: '1px solid #30363d', background: '#161b22',
    color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10
  }}>
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
  Google ile Giriş Yap
</button>
        {/* Moderatör girişi linki */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/moderator-giris" style={{ color: '#4b5563', fontSize: '0.75rem', textDecoration: 'none' }}>
            Moderatör girişi
          </a>
        </div>
      </div>
    </div>
  );
}