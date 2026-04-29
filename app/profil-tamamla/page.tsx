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

const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli'];

// TCKN checksum doğrulama
function tcknGecerli(tckn: string): boolean {
  if (!/^\d{11}$/.test(tckn) || tckn[0] === '0') return false;
  const d = tckn.split('').map(Number);
  const t1 = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  if (((t1 % 10) + 10) % 10 !== d[9]) return false;
  const t2 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return t2 % 10 === d[10];
}

// VKN checksum doğrulama (Gemini algoritması)
function vknGecerli(vkn: string): boolean {
  if (!/^\d{10}$/.test(vkn)) return false;
  const d = vkn.split('').map(Number);
  let toplam = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i] + 10 - (i + 1)) % 10;
    toplam += tmp === 9 ? 9 : (tmp * Math.pow(2, 10 - (i + 1))) % 9;
  }
  const sonHane = (10 - (toplam % 10)) % 10;
  return d[9] === sonHane;
}

export default function ProfilTamamla() {
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState('');
  const [telefon, setTelefon] = useState('');
  const [tckn, setTckn] = useState('');
  const [vkn, setVkn] = useState('');
  const [telefonHata, setTelefonHata] = useState('');
  const [tcknHata, setTcknHata] = useState('');
  const [vknHata, setVknHata] = useState('');
  const [aracPlaka, setAracPlaka] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [aracUtsyapi, setAracUtsyapi] = useState<string[]>([]);
  const [telefonKilitli, setTelefonKilitli] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/giris'); return; }
      const fullName = user.user_metadata?.full_name || '';
      if (fullName) setDisplayName(fullName);
      // Telefon OTP ile giriş yapıldıysa numarayı otomatik doldur ve kilitle
      if (user.phone) {
        // +90'lı formatı 0'lı yerel formata çevir
        const yerel = user.phone.startsWith('+90') ? '0' + user.phone.slice(3) : user.phone;
        setTelefon(yerel);
        setTelefonKilitli(true);
      }
      const { data: profil } = await supabase.from('users').select('user_type').eq('id', user.id).single();
      if (profil?.user_type) router.push('/panel');
    }
    init();
  }, []);

  useEffect(() => {
    setTckn(''); setVkn(''); setTcknHata(''); setVknHata('');
    setAracPlaka(''); setAracTipi(''); setAracUtsyapi([]);
  }, [userType]);

  function handleTckn(val: string) {
    const temiz = val.replace(/\D/g, '').substring(0, 11);
    setTckn(temiz);
    if (!temiz) { setTcknHata(''); return; }
    if (temiz.length < 11) { setTcknHata('TCKN 11 haneli olmalıdır'); return; }
    if (!tcknGecerli(temiz)) { setTcknHata('Geçersiz TCKN'); return; }
    setTcknHata('');
  }

  function handleVkn(val: string) {
    const temiz = val.replace(/\D/g, '').substring(0, 10);
    setVkn(temiz);
    if (!temiz) { setVknHata(''); return; }
    if (temiz.length < 10) { setVknHata('VKN 10 haneli olmalıdır'); return; }
    if (!vknGecerli(temiz)) { setVknHata('Geçersiz VKN'); return; }
    setVknHata('');
  }

  function toggleUtsyapi(u: string) {
    setAracUtsyapi(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  }

  const kimlikGecerli = () => {
    if (userType === 'arac_sahibi') return tckn.length === 11 && !tcknHata;
    if (userType === 'sirket') return vkn.length === 10 && !vknHata;
    if (tckn.length > 0 && tcknHata) return false;
    if (vkn.length > 0 && vknHata) return false;
    return true;
  };

  const aracGecerli = userType !== 'arac_sahibi' || (aracPlaka.trim().length >= 4 && aracTipi !== '');

  const telefonGecerli = telefonKilitli || (telefon.length === 11 && !telefonHata);

  const formGecerli =
    displayName.trim().length >= 2 &&
    userType !== '' &&
    telefonGecerli &&
    kimlikGecerli() &&
    aracGecerli;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formGecerli) return;
    setYukleniyor(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setYukleniyor(false); return; }

    const { error } = await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      display_name: displayName.trim(),
      user_type: userType,
      phone: telefon,
      phone_verified: false,
      ...(tckn ? { tckn } : {}),
      ...(vkn ? { vkn } : {}),
    }, { onConflict: 'id' });

    if (error) {
      setHata('Profil kaydedilemedi: ' + error.message);
      setYukleniyor(false);
      return;
    }

    if (userType === 'arac_sahibi' && aracPlaka && aracTipi) {
      await supabase.from('vehicles').insert({
        user_id: user.id,
        plate: aracPlaka.toUpperCase().replace(/\s/g, ''),
        vehicle_type: aracTipi,
        body_types: aracUtsyapi,
        is_active: true,
      });
    }

    router.push('/panel');
    setYukleniyor(false);
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
  const hataStil = { color: '#ef4444', fontSize: '0.78rem', marginTop: 4 };
  const ipucu = { color: '#4b5563', fontSize: '0.75rem', marginTop: 4 };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: '24px 0' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 44, height: 44, marginBottom: 10 }} />
          <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span>
            <span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginTop: 4 }}>Hoş geldiniz! Hemen başlayalım.</div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>
          <form onSubmit={handleSubmit}>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Ad Soyad *</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ad Soyad" required style={inp} autoFocus />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Telefon *</label>
              <div style={{ position: 'relative' }}>
                <input value={telefon}
                  disabled={telefonKilitli}
                  onChange={e => {
                    if (telefonKilitli) return;
                    const val = e.target.value.replace(/\D/g, '').substring(0, 11);
                    setTelefon(val);
                    setTelefonHata(val.length > 0 && (val.length !== 11 || !val.startsWith('0')) ? '05xx ile başlayan 11 haneli numara girin' : '');
                  }}
                  placeholder="05xx xxx xx xx"
                  style={{ ...inp, ...(telefonKilitli ? { background: '#0a0f17', color: '#4b5563', cursor: 'not-allowed', borderColor: '#1f2937' } : {}) }} />
                {telefonKilitli && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', color: '#22c55e' }}>✓ Doğrulandı</span>
                )}
              </div>
              {telefonHata && <div style={hataStil}>⚠️ {telefonHata}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Ben bir... *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {KULLANICI_TIPLERI.map(t => (
                  <button key={t.value} type="button" onClick={() => setUserType(t.value)}
                    style={{ padding: '12px', borderRadius: 8, border: '2px solid', borderColor: userType === t.value ? '#22c55e' : '#30363d', background: userType === t.value ? '#14532d' : '#0d1117', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ color: userType === t.value ? '#22c55e' : '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', marginBottom: 2 }}>{t.label}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.72rem' }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {userType === 'arac_sahibi' && (
              <div style={{ background: '#0d1117', border: '1px solid #166534', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem', marginBottom: 14 }}>🚛 Aracınızı ekleyin</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Plaka *</label>
                  <input value={aracPlaka} onChange={e => setAracPlaka(e.target.value.toUpperCase())} placeholder="34 ABC 123" style={inp} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Araç Tipi *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ARAC_TIPLERI.map(t => (
                      <button key={t} type="button" onClick={() => setAracTipi(aracTipi === t ? '' : t)}
                        style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid', fontSize: '0.82rem', cursor: 'pointer', fontWeight: aracTipi === t ? 700 : 400, borderColor: aracTipi === t ? '#22c55e' : '#30363d', background: aracTipi === t ? '#14532d' : '#0d1117', color: aracTipi === t ? '#22c55e' : '#8b949e' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Üst Yapı <span style={{ color: '#4b5563', fontWeight: 400 }}>(opsiyonel)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {UTSYAPI.map(u => (
                      <button key={u} type="button" onClick={() => toggleUtsyapi(u)}
                        style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.78rem', cursor: 'pointer', fontWeight: aracUtsyapi.includes(u) ? 700 : 400, borderColor: aracUtsyapi.includes(u) ? '#60a5fa' : '#30363d', background: aracUtsyapi.includes(u) ? '#1e3a5f' : '#0d1117', color: aracUtsyapi.includes(u) ? '#60a5fa' : '#8b949e' }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {userType && userType !== 'sirket' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>TC Kimlik No {userType === 'arac_sahibi' ? '*' : <span style={{ color: '#4b5563', fontWeight: 400 }}> (opsiyonel)</span>}</label>
                <input value={tckn} onChange={e => handleTckn(e.target.value)} placeholder="xxxxxxxxxxx"
                  required={userType === 'arac_sahibi'}
                  style={{ ...inp, borderColor: tcknHata ? '#ef4444' : tckn.length === 11 && !tcknHata ? '#22c55e' : '#30363d' }} />
                {tcknHata && <div style={hataStil}>⚠️ {tcknHata}</div>}
                {!tcknHata && tckn.length === 11 && <div style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: 4 }}>✓ Geçerli TCKN</div>}
                {userType !== 'arac_sahibi' && !tckn && <div style={ipucu}>Kimlik bilgisi profil güvenilirliğinizi artırır.</div>}
              </div>
            )}

            {(userType === 'sirket' || userType === 'broker') && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Vergi Kimlik No {userType === 'sirket' ? '*' : <span style={{ color: '#4b5563', fontWeight: 400 }}> (opsiyonel)</span>}</label>
                <input value={vkn} onChange={e => handleVkn(e.target.value)} placeholder="xxxxxxxxxx"
                  required={userType === 'sirket'}
                  style={{ ...inp, borderColor: vknHata ? '#ef4444' : vkn.length === 10 && !vknHata ? '#22c55e' : '#30363d' }} />
                {vknHata && <div style={hataStil}>⚠️ {vknHata}</div>}
                {!vknHata && vkn.length === 10 && <div style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: 4 }}>✓ Geçerli VKN</div>}
              </div>
            )}

            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 10 }}>⚠️ {hata}</div>}
            <button type="submit" disabled={yukleniyor || !formGecerli}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: formGecerli ? '#22c55e' : '#1f2937', color: formGecerli ? '#000' : '#6b7280', fontWeight: 800, fontSize: '1rem', cursor: formGecerli ? 'pointer' : 'not-allowed', marginTop: 8 }}>
              {yukleniyor ? 'Kaydediliyor...' : 'Devam Et →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/giris'); }}
            style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '0.75rem', cursor: 'pointer' }}>
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
