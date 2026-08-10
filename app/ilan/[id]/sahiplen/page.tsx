'use client';
import { useEffect, useState } from 'react';
import { createClient } from '../../../../lib/supabase';
import { ilAdi } from '../../../../lib/lokasyon';

const supabase = createClient();

// ⚠️ SPRINT_01 L1d — `contact_phone` bilinçli olarak YOK.
// Bu sayfa herkese açık ve id tahmin edilebilir; anon key ile numarayı çekmek
// sahiplenilmemiş her ilanın numarasını misafire vermek demekti. Numara artık
// istemciye hiç gelmiyor: önizlemede /api/ilan/[id]/sahiplen'den MASKELİ hâli
// alınıyor, OTP gönderimi ve doğrulaması da aynı endpoint'te sunucuda yapılıyor.
interface IlanBilgi {
  id: string;
  listing_type: string;
  origin_province_id: number | null;
  origin_district: string | null;
  user_id: string | null;
  trust_level: string | null;
  listing_stops: Array<{ province_id: number | null; district: string | null; stop_order: number }>;
}

// 🚨 10 Ağu 2026 — '"Telefon Doğrulandı" rozeti eklenir' MADDESİ ÇIKARILDI.
//    O rozet kaldırıldı (`users.phone_verified` istemciden yazılabiliyordu), yani
//    burada vaat etmeye devam etmek KARŞILIĞI OLMAYAN bir söz olurdu — kullanıcı
//    sahiplenir, rozeti bekler, hiç gelmez. Vaat edilen fayda ile teslim edilen
//    davranış aynı commit'te değişmek zorunda.
const FAYDALAR = [
  { ikon: '⚠️', metin: '"Doğrulanmamış İlan" etiketi kalkar, ilanınız daha fazla görünür' },
  { ikon: '📞', metin: 'Telefonunuz size ait olarak görünür, alıcı doğrudan size ulaşır' },
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
  const [maskeliTelefon, setMaskeliTelefon] = useState('');
  // SPRINT_01 A4b — sunucu 60 sn bekletiyor; sayaç burada sadece görsel karşılığı.
  // Gerçek kontrol /api/ilan/[id]/sahiplen içinde (istemci sayacı devtools'la sıfırlanabilir).
  const [bekleme, setBekleme] = useState(0);

  useEffect(() => {
    if (bekleme <= 0) return;
    const sayac = setInterval(() => setBekleme(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(sayac);
  }, [bekleme]);

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setId(resolved.id);

      const { data } = await supabase
        .from('listings')
        .select(`
          id, listing_type, origin_province_id, origin_district,
          user_id, trust_level,
          listing_stops ( stop_order, province_id, district )
        `)
        .eq('id', resolved.id)
        .maybeSingle();

      if (!data) { setAdim('hata'); setYukleniyor(false); return; }
      if (data.user_id) { setAdim('hata'); setYukleniyor(false); return; }

      // Maskeli numara + uygunluk kontrolü sunucudan.
      const res = await fetch(`/api/ilan/${resolved.id}/sahiplen`);
      if (!res.ok) { setAdim('hata'); setYukleniyor(false); return; }
      const bilgi = await res.json().catch(() => ({}));
      setMaskeliTelefon(bilgi?.maskeliTelefon || '');

      setIlan(data);
      setYukleniyor(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function otpGonder() {
    if (!id || bekleme > 0) return;
    setIslemYukleniyor(true);
    setHata('');
    try {
      const res = await fetch(`/api/ilan/${id}/sahiplen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adim: 'gonder' }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHata(veri?.error || 'SMS gönderilemedi. Lütfen tekrar deneyin.');
        // 429 → sunucudaki kalan süreyi sayaca yansıt.
        if (res.status === 429 && typeof veri?.kalan === 'number') setBekleme(veri.kalan);
      } else {
        setAdim('otp');
        setBekleme(typeof veri?.bekleme === 'number' ? veri.bekleme : 60);
      }
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setIslemYukleniyor(false);
    }
  }

  async function otpDogrula() {
    if (!id || otp.length < 4) return;
    setIslemYukleniyor(true);
    setHata('');
    try {
      const res = await fetch(`/api/ilan/${id}/sahiplen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adim: 'dogrula', kod: otp }),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) { setHata(veri?.error || 'Kod hatalı veya süresi dolmuş.'); return; }
      setAdim('tamamlandi');
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setIslemYukleniyor(false);
    }
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
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ilAdi(ilan?.origin_province_id) ?? ''}</span>
            {ilan?.origin_district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {ilan.origin_district}</span>}
          </div>
          {stops.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#f97316', fontSize: '0.72rem', fontWeight: 700 }}>V</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ilAdi(s.province_id) ?? ''}</span>
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
              İlandaki telefon numarasına (<strong style={{ color: '#e2e8f0' }}>{maskeliTelefon || '…'}</strong>) SMS kodu göndereceğiz.
            </div>
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="button" onClick={otpGonder} disabled={islemYukleniyor || bekleme > 0}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: (islemYukleniyor || bekleme > 0) ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: bekleme > 0 ? 'not-allowed' : 'pointer' }}>
              {islemYukleniyor ? 'Gönderiliyor...' : bekleme > 0 ? `Tekrar göndermek için ${bekleme} sn` : 'SMS Kodu Gönder →'}
            </button>
          </div>
        )}

        {/* OTP — kod girişi */}
        {adim === 'otp' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 20 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>Doğrulama kodu</div>
            <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 20 }}>
              📱 {maskeliTelefon || 'İlandaki'} numarasına SMS gönderdik.
            </div>
            {/* SPRINT_01 A4b — Twilio Verify kodu 4 HANE. Burası 6 bekliyordu: buton
                hiç aktifleşmiyordu, yani sahiplenme akışı fiilen tamamlanamıyordu.
                /giris sayfası zaten 4 kullanıyor; ikisi hizalandı. */}
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 4))}
              placeholder="4 haneli kod"
              maxLength={4}
              autoFocus
              style={{ ...inp, fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700, marginBottom: 12 }}
            />
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="button" onClick={otpDogrula} disabled={islemYukleniyor || otp.length < 4}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: otp.length === 4 ? '#22c55e' : '#166534', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 10 }}>
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
