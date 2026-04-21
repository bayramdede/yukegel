'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = createClient();

const KULLANICI_TIPLERI = [
  { value: 'yuk_sahibi', label: '📦 Yük Sahibi', desc: 'Taşıtmak istediğiniz yük var' },
  { value: 'arac_sahibi', label: '🚛 Araç Sahibi', desc: 'Taşımacılık yapıyorsunuz' },
  { value: 'sirket', label: '🏢 Şirket', desc: 'Lojistik firması' },
  { value: 'broker', label: '🤝 Komisyoncu', desc: 'Aracılık yapıyorsunuz' },
];

const ARAC_TIPLERI = ['Panelvan','Kamyonet','Kamyon','TIR','Kırkayak','Lowbed','Frigorifik'];

export default function ProfilTamamla() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState('');
  const [telefon, setTelefon] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [usernameHata, setUsernameHata] = useState('');
  const [telefonHata, setTelefonHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kontrol, setKontrol] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/giris'); return; }
      const fullName = user.user_metadata?.full_name || '';
      if (fullName) setDisplayName(fullName);
      const { data: profil } = await supabase
        .from('users')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profil?.username) router.push('/');
    }
    init();
  }, []);

  useEffect(() => {
    if (username.length < 3) { setUsernameHata(''); return; }
    const timer = setTimeout(async () => {
      setKontrol(true);
      const { data } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();
      setUsernameHata(data ? 'Bu kullanıcı adı alınmış' : '');
      setKontrol(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (usernameHata || telefonHata || username.length < 3 || !userType || telefon.length !== 11) return;
    if (userType === 'arac_sahibi' && !aracTipi) return;

    setYukleniyor(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('users').update({
      display_name: displayName,
      username: username.toLowerCase(),
      user_type: userType,
      phone: telefon,
    }).eq('id', user.id);

    console.log('HATA:', error);
    router.push('/');
  }

  const formGecerli = !usernameHata && !telefonHata && 
    username.length >= 3 && userType && displayName && telefon.length === 11 &&
    (userType !== 'arac_sahibi' || aracTipi);

  const inp = {
    width: '100%', background: '#0d1117', color: '#e2e8f0',
    border: '1px solid #30363d', borderRadius: 6,
    padding: '10px 12px', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box' as const
  };

  const lbl = {
    color: '#8b949e', fontSize: '0.78rem', fontWeight: 600,
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    display: 'block', marginBottom: 6
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: '24px 0' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 48, height: 48, marginBottom: 12 }} />
          <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span>
            <span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: 4 }}>Profilinizi tamamlayın</div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSubmit}>

            {/* Ad Soyad */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Ad Soyad *</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Bayram Dede" required style={inp} />
            </div>

            {/* Telefon */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Telefon *</label>
              <input value={telefon}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').substring(0, 11);
                  setTelefon(val);
                  if (val.length > 0 && (!val.startsWith('0') || val.length !== 11)) {
                    setTelefonHata('05xx ile başlayan 11 haneli numara girin');
                  } else {
                    setTelefonHata('');
                  }
                }}
                placeholder="05xx xxx xx xx" required style={inp} />
              {telefonHata && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>⚠️ {telefonHata}</div>}
            </div>

            {/* Kullanıcı adı */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Kullanıcı Adı *</label>
              <div style={{ position: 'relative' }}>
                <input value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="bayramdede" required minLength={3} style={inp} />
                {kontrol && <span style={{ position: 'absolute', right: 10, top: 10, color: '#8b949e', fontSize: '0.8rem' }}>⏳</span>}
                {!kontrol && username.length >= 3 && !usernameHata && (
                  <span style={{ position: 'absolute', right: 10, top: 10, color: '#22c55e', fontSize: '0.8rem' }}>✓</span>
                )}
              </div>
              {usernameHata && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>⚠️ {usernameHata}</div>}
              <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 4 }}>
                yukegel.com/u/{username || 'kullaniciadi'}
              </div>
            </div>

            {/* Kullanıcı tipi */}
            <div style={{ marginBottom: userType === 'arac_sahibi' ? 16 : 24 }}>
              <label style={lbl}>Hesap Türü *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {KULLANICI_TIPLERI.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => { setUserType(t.value); setAracTipi(''); }}
                    style={{
                      padding: '12px', borderRadius: 8, border: '2px solid',
                      borderColor: userType === t.value ? '#22c55e' : '#30363d',
                      background: userType === t.value ? '#14532d' : '#0d1117',
                      cursor: 'pointer', textAlign: 'left'
                    }}>
                    <div style={{ color: userType === t.value ? '#22c55e' : '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>
                      {t.label}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Araç tipi — sadece araç sahibi seçince */}
            {userType === 'arac_sahibi' && (
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>Araç Tipi *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ARAC_TIPLERI.map(t => (
                    <button key={t} type="button"
                      onClick={() => setAracTipi(t)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid',
                        borderColor: aracTipi === t ? '#22c55e' : '#30363d',
                        background: aracTipi === t ? '#14532d' : '#0d1117',
                        color: aracTipi === t ? '#22c55e' : '#8b949e',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" disabled={yukleniyor || !formGecerli}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: formGecerli ? '#22c55e' : '#1f2937',
                color: formGecerli ? '#000' : '#6b7280',
                fontWeight: 800, fontSize: '1rem', cursor: formGecerli ? 'pointer' : 'not-allowed'
              }}>
              {yukleniyor ? 'Kaydediliyor...' : 'Devam Et →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}