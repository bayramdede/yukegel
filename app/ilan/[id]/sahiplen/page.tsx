'use client';
import { useEffect, useState } from 'react';
import { createClient } from '../../../../lib/supabase';

const supabase = createClient();

interface IlanBilgi {
  id: string;
  listing_type: string;
  origin_city: string;
  origin_district: string | null;
  contact_phone: string | null;
  user_id: string | null;
  trust_level: string | null;
  listing_stops: Array<{ city: string; district: string | null; stop_order: number }>;
}

const FAYDALAR = [
  { ikon: '⚠️', metin: '"Doğrulanmamış İlan" etiketi kalkar, ilanınız daha fazla görünür' },
  { ikon: '✅', metin: '"Telefon Doğrulandı" rozeti eklenir, nakliyeciler güvenle arar' },
  { ikon: '🔗', metin: 'İlanlarınızı tek linkten kolayca yönetirsiniz' },
  { ikon: '📋', metin: 'Panelden ilanı pasife alabilir, düzenleyebilirsiniz' },
  { ikon: '🚀', metin: 'Yeni ilanlarınızı saniyeler içinde yayınlarsınız' },
];

export default function SahiplenPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');
  const [ilan, setIlan] = useState<IlanBilgi | null>(null);
  const [adim, setAdim] = useState<'onizleme' | 'otp' | 'tamamlandi' | 'hata'>('onizleme');
  const [otp, setOtp] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islemYukleniyor, setIslemYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setId(resolved.id);

      const { data } = await supabase
        .from('listings')
        .select(`
          id, listing_type, origin_city, origin_district,
          contact_phone, user_id, trust_level,
          listing_stops ( stop_order, city, district )
        `)
        .eq('id', resolved.id)
        .single();

      if (!data) { setAdim('hata'); setYukleniyor(false); return; }
      if (data.user_id) { setAdim('hata'); setYukleniyor(false); return; }

      setIlan(data);
      setYukleniyor(false);
    }
    init();
  }, []);

  async function otpGonder() {
    if (!ilan?.contact_phone) return;
    setIslemYukleniyor(true);
    setHata('');

    const telefon = ilan.contact_phone.replace(/\D/g, '');
    const formatli = telefon.startsWith('90') ? `+${telefon}` :
      telefon.startsWith('0') ? `+9${telefon}` : `+90${telefon}`;

    const { error } = await supabase.auth.signInWithOtp({ phone: formatli });
    if (error) setHata('SMS gönderilemedi. Lütfen tekrar deneyin.');
    else setAdim('otp');
    setIslemYukleniyor(false);
  }

  async function otpDogrula() {
    if (!ilan?.contact_phone || otp.length < 6) return;
    setIslemYukleniyor(true);
    setHata('');

    const telefon = ilan.contact_phone.replace(/\D/g, '');
    const formatli = telefon.startsWith('90') ? `+${telefon}` :
      telefon.startsWith('0') ? `+9${telefon}` : `+90${telefon}`;

    const { data: authData, error: otpHata } = await supabase.auth.verifyOtp({
      phone: formatli, token: otp, type: 'sms',
    });

    if (otpHata || !authData.user) {
      setHata('Kod hatalı veya süresi dolmuş.');
      setIslemYukleniyor(false);
      return;
    }

    const { error: updateHata } = await supabase
      .from('listings')
      .update({ user_id: authData.user.id, trust_level: 'verified', claimed_at: new Date().toISOString() })
      .eq('id', id)
      .is('user_id', null);

    if (updateHata) {
      setHata('Sahiplenme sırasında bir hata oluştu.');
      setIslemYukleniyor(false);
      return;
    }

    const { data: mevcutProfil } = await supabase.from('users').select('id').eq('id', authData.user.id).single();
    if (!mevcutProfil) {
      await supabase.from('users').insert({
        id: authData.user.id,
        phone: ilan.contact_phone,
        phone_verified: true,
        user_type: 'yuk_sahibi',
      });
    }

    setAdim('tamamlandi');
    setIslemYukleniyor(false);
  }

  const inp = {
    background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d',
    borderRadius: 6, padding: '10px 12px', fontSize: '0.9rem',
    width: '100%', outline: 'none', boxSizing: 'border-box' as const,
  };

  if (yukleniyor) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#4b5563' }}>⏳ Yükleniyor...</div>
    </div>
  );

  if (adim === 'hata') return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 16px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Bu ilan sahiplenilemiyor</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>İlan bulunamadı veya zaten bir hesaba bağlı.</div>
        <a href="/" style={{ color: '#22c55e', fontWeight: 600, textDecoration: 'none' }}>← Ana sayfaya dön</a>
      </div>
    </div>
  );

  if (adim === 'tamamlandi') return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 16px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', marginBottom: 8 }}>İlan sahiplenildi!</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 32 }}>
          İlan artık hesabınıza bağlı. Yükegel'e hoş geldiniz!
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`/ilan/${id}`} style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none', border: '1px solid #30363d', padding: '8px 20px', borderRadius: 7 }}>
            İlanı Görüntüle
          </a>
          <a href="/panel" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', padding: '8px 20px', borderRadius: 7 }}>
            Panelime Git →
          </a>
        </div>
      </div>
    </div>
  );

  const stops = (ilan?.listing_stops || []).sort((a, b) => a.stop_order - b.stop_order);
  const isYuk = ilan?.listing_type === 'yuk';

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
        </div>
      </nav>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', marginBottom: 6 }}>
            Bu ilan size mi ait?
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            Sahiplenin, nakliyeciler doğrudan size ulaşsın.
          </div>
        </div>

        {/* İlan önizlemesi */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              {isYuk ? '🔴 YÜK İLANI' : '🟢 ARAÇ İLANI'}
            </span>
            <span style={{ background: '#292019', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              ⚠️ Doğrulanmamış İlan
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 700 }}>K</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ilan?.origin_city}</span>
            {ilan?.origin_district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {ilan.origin_district}</span>}
          </div>
          {stops.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#f97316', fontSize: '0.72rem', fontWeight: 700 }}>V</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{s.city}</span>
              {s.district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {s.district}</span>}
            </div>
          ))}
        </div>

        {/* Faydalar */}
        <div style={{ background: '#0d1f0d', border: '1px solid #166534', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem', marginBottom: 12 }}>
            Sahiplendikten sonra ne kazanırsınız?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAYDALAR.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{f.ikon}</span>
                <span style={{ color: '#86efac', fontSize: '0.82rem', lineHeight: 1.5 }}>{f.metin}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OTP — onizleme */}
        {adim === 'onizleme' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>Kimliğinizi doğrulayın</div>
            <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 20 }}>
              İlandaki telefon numarasına (<strong style={{ color: '#e2e8f0' }}>{ilan?.contact_phone}</strong>) SMS kodu göndereceğiz.
            </div>
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="button" onClick={otpGonder} disabled={islemYukleniyor}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: islemYukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
              {islemYukleniyor ? 'Gönderiliyor...' : 'SMS Kodu Gönder →'}
            </button>
          </div>
        )}

        {/* OTP — kod girişi */}
        {adim === 'otp' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>Doğrulama kodu</div>
            <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 20 }}>
              📱 {ilan?.contact_phone} numarasına SMS gönderdik.
            </div>
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
              placeholder="6 haneli kod"
              maxLength={6}
              autoFocus
              style={{ ...inp, fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700, marginBottom: 12 }}
            />
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="button" onClick={otpDogrula} disabled={islemYukleniyor || otp.length < 6}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: otp.length === 6 ? '#22c55e' : '#166534', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 10 }}>
              {islemYukleniyor ? 'Doğrulanıyor...' : 'İlanı Sahiplen →'}
            </button>
            <button type="button" onClick={() => { setAdim('onizleme'); setOtp(''); setHata(''); }}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer' }}>
              ← Geri dön
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
