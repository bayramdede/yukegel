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

const ARAC_TIPLERI = ['Panelvan', 'Kamyonet', 'Kamyon', 'TIR', 'Kırkayak', 'Lowbed', 'Frigorifik'];

// TCKN algoritması (Türkiye kimlik numarası doğrulama)
function tcknGecerli(tckn: string): boolean {
  if (!/^\d{11}$/.test(tckn)) return false;
  if (tckn[0] === '0') return false;
  const d = tckn.split('').map(Number);
  const t1 = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  if (((t1 % 10) + 10) % 10 !== d[9]) return false;
  const t2 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  if (t2 % 10 !== d[10]) return false;
  return true;
}

// VKN format kontrolü (10 hane)
function vknGecerli(vkn: string): boolean {
  return /^\d{10}$/.test(vkn);
}

export default function ProfilTamamla() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [userType, setUserType] = useState('');
  const [telefon, setTelefon] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [tckn, setTckn] = useState('');
  const [vkn, setVkn] = useState('');
  const [usernameHata, setUsernameHata] = useState('');
  const [telefonHata, setTelefonHata] = useState('');
  const [tcknHata, setTcknHata] = useState('');
  const [vknHata, setVknHata] = useState('');
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

  // Username anlık kontrol
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

  // Kullanıcı tipi değişince kimlik alanlarını temizle
  useEffect(() => {
    setTckn('');
    setVkn('');
    setTcknHata('');
    setVknHata('');
    setAracTipi('');
  }, [userType]);

  function handleTckn(val: string) {
    const temiz = val.replace(/\D/g, '').substring(0, 11);
    setTckn(temiz);
    if (temiz.length === 0) { setTcknHata(''); return; }
    if (temiz.length < 11) { setTcknHata('TCKN 11 haneli olmalıdır'); return; }
    if (!tcknGecerli(temiz)) { setTcknHata('Geçersiz TCKN'); return; }
    setTcknHata('');
  }

  function handleVkn(val: string) {
    const temiz = val.replace(/\D/g, '').substring(0, 10);
    setVkn(temiz);
    if (temiz.length === 0) { setVknHata(''); return; }
    if (temiz.length < 10) { setVknHata('VKN 10 haneli olmalıdır'); return; }
    if (!vknGecerli(temiz)) { setVknHata('Geçersiz VKN'); return; }
    setVknHata('');
  }

  // Form geçerlilik kontrolü
  const kimlikGecerli = () => {
    if (userType === 'arac_sahibi') return tckn.length === 11 && !tcknHata;
    if (userType === 'sirket') return vkn.length === 10 && !vknHata;
    // yuk_sahibi ve broker için opsiyonel — girilmişse geçerli olmalı
    if (tckn.length > 0 && tcknHata) return false;
    if (vkn.length > 0 && vknHata) return false;
    return true;
  };

  const formGecerli =
    !usernameHata && !telefonHata &&
    username.length >= 3 && userType && displayName && telefon.length === 11 &&
    (userType !== 'arac_sahibi' || aracTipi) &&
    kimlikGecerli();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formGecerli) return;

    setYukleniyor(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('users').update({
      display_name: displayName,
      username: username.toLowerCase(),
      user_type: userType,
      phone: telefon,
      ...(tckn ? { tckn } : {}),
      ...(vkn ? { vkn } : {}),
    }).eq('id', user.id);

    if (error) console.error('Profil güncelleme hatası:', error);
    router.push('/');
  }

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

  const hata = { color: '#ef4444', fontSize: '0.78rem', marginTop: 4 };
  const ipucu = { color: '#4b5563', fontSize: '0.75rem', marginTop: 4 };

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
              {telefonHata && <div style={hata}>⚠️ {telefonHata}</div>}
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
              {usernameHata && <div style={hata}>⚠️ {usernameHata}</div>}
              <div style={ipucu}>yukegel.com/u/{username || 'kullaniciadi'}</div>
            </div>

            {/* Hesap Türü */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Hesap Türü *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {KULLANICI_TIPLERI.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => setUserType(t.value)}
                    style={{
                      padding: '12px', borderRadius: 8, border: '2px solid',
                      borderColor: userType === t.value ? '#22c55e' : '#30363d',
                      background: userType === t.value ? '#14532d' : '#0d1117',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{ color: userType === t.value ? '#22c55e' : '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>
                      {t.label}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Araç tipi — sadece araç sahibi */}
            {userType === 'arac_sahibi' && (
              <div style={{ marginBottom: 16 }}>
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
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TCKN — araç sahibi zorunlu, diğerleri opsiyonel (sirket hariç) */}
            {userType && userType !== 'sirket' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>
                  TC Kimlik No {userType === 'arac_sahibi' ? '*' : ''}
                  {userType !== 'arac_sahibi' && (
                    <span style={{ color: '#4b5563', fontWeight: 400, marginLeft: 6 }}>(opsiyonel)</span>
                  )}
                </label>
                <input
                  value={tckn}
                  onChange={e => handleTckn(e.target.value)}
                  placeholder="xxxxxxxxxxx"
                  required={userType === 'arac_sahibi'}
                  style={{
                    ...inp,
                    borderColor: tcknHata ? '#ef4444' : tckn.length === 11 && !tcknHata ? '#22c55e' : '#30363d',
                  }}
                />
                {tcknHata && <div style={hata}>⚠️ {tcknHata}</div>}
                {!tcknHata && tckn.length === 11 && (
                  <div style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: 4 }}>✓ Geçerli TCKN</div>
                )}
                {userType !== 'arac_sahibi' && !tcknHata && tckn.length === 0 && (
                  <div style={ipucu}>Kimlik bilgisi profil güvenilirliğinizi artırır.</div>
                )}
              </div>
            )}

            {/* VKN — şirket zorunlu, broker opsiyonel */}
            {(userType === 'sirket' || userType === 'broker') && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>
                  Vergi Kimlik No {userType === 'sirket' ? '*' : ''}
                  {userType === 'broker' && (
                    <span style={{ color: '#4b5563', fontWeight: 400, marginLeft: 6 }}>(opsiyonel)</span>
                  )}
                </label>
                <input
                  value={vkn}
                  onChange={e => handleVkn(e.target.value)}
                  placeholder="xxxxxxxxxx"
                  required={userType === 'sirket'}
                  style={{
                    ...inp,
                    borderColor: vknHata ? '#ef4444' : vkn.length === 10 && !vknHata ? '#22c55e' : '#30363d',
                  }}
                />
                {vknHata && <div style={hata}>⚠️ {vknHata}</div>}
                {!vknHata && vkn.length === 10 && (
                  <div style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: 4 }}>✓ Geçerli VKN</div>
                )}
              </div>
            )}

            <button type="submit" disabled={yukleniyor || !formGecerli}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: formGecerli ? '#22c55e' : '#1f2937',
                color: formGecerli ? '#000' : '#6b7280',
                fontWeight: 800, fontSize: '1rem',
                cursor: formGecerli ? 'pointer' : 'not-allowed',
                marginTop: 8,
              }}>
              {yukleniyor ? 'Kaydediliyor...' : 'Devam Et →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
