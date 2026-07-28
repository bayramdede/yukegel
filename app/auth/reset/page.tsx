'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';

const supabase = createClient();

/**
 * SPRINT_01 R1 — bu sayfa eskiden formu KOŞULSUZ gösteriyordu.
 *
 * İki ayrı sorun vardı:
 *  1) Sıfırlama linki olmadan gelen kullanıcı formu dolduruyor, "Şifre güncellenemedi"
 *     diye anlamsız bir hata alıp ne yapacağını bilemiyordu.
 *  2) Daha kötüsü: tarayıcıda NORMAL (recovery olmayan) bir oturum açıksa
 *     `updateUser({ password })` BAŞARIYLA çalışıyordu. Yani birinin açık kalmış
 *     oturumuna erişen kişi, eski şifreyi bilmeden şifreyi değiştirebiliyordu.
 *
 * Artık form yalnızca gerçek bir PASSWORD_RECOVERY oturumu varsa gösteriliyor.
 */
type Durum = 'kontrol' | 'hazir' | 'gecersiz';

// URL'deki recovery işaretini supabase-js hash'i TÜKETMEDEN ÖNCE yakala.
// (Modül seviyesinde okuyoruz; supabase istemcisi hash'i ilk fırsatta siliyor.)
function urlRecoveryIsareti(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const arama = window.location.search || '';
  return hash.includes('type=recovery') || arama.includes('type=recovery') || arama.includes('code=');
}

export default function SifreSifirla() {
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [hata, setHata] = useState('');
  const [tamamlandi, setTamamlandi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  // Lazy initializer — effect içinde setState etme (react-hooks/set-state-in-effect).
  const [durum, setDurum] = useState<Durum>(() => (urlRecoveryIsareti() ? 'kontrol' : 'gecersiz'));
  const router = useRouter();

  useEffect(() => {
    if (durum === 'gecersiz') return;
    let bitti = false;

    // PASSWORD_RECOVERY: supabase-js recovery hash'ini çözdüğünde tetiklenir.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (bitti) return;
      if (event === 'PASSWORD_RECOVERY') { bitti = true; setDurum('hazir'); }
    });

    // PKCE akışında hash yerine `?code=` gelir; oturumu elle takas et.
    const kod = new URLSearchParams(window.location.search).get('code');
    if (kod) {
      supabase.auth.exchangeCodeForSession(kod)
        .then(({ error }: { error: unknown }) => { if (!bitti && !error) { bitti = true; setDurum('hazir'); } })
        .catch(() => {});
    }

    // Emniyet supabası: 4 sn içinde recovery olayı gelmediyse link geçersiz/süresi dolmuş.
    const zamanlayici = setTimeout(() => {
      if (!bitti) { bitti = true; setDurum('gecersiz'); }
    }, 4000);

    return () => { clearTimeout(zamanlayici); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (error) {
      setHata('Şifre güncellenemedi. Linkin süresi dolmuş olabilir.');
      setYukleniyor(false);
      return;
    }

    // SPRINT_01 R1 — recovery oturumu tam yetkili bir oturuma dönüşmesin.
    // Kullanıcı yeni şifresiyle temiz giriş yapsın; ayrıca linki eline geçiren
    // birinin oturumu açık kalmaz.
    await supabase.auth.signOut().catch(() => {});
    setTamamlandi(true);
    setYukleniyor(false);
  }

  // SPRINT_01 R1 — recovery oturumu doğrulanana kadar formu GÖSTERME.
  if (durum === 'kontrol') return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>Link doğrulanıyor…</div>
    </div>
  );

  if (durum === 'gecersiz') return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔗</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Bu sayfaya link ile gelinmeli</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
          Şifre sıfırlama linki geçersiz veya süresi dolmuş. Güvenlik gereği yeni bir link istemeniz gerekiyor.
        </div>
        <button onClick={() => router.push('/giris')}
          style={{ background: '#22c55e', color: '#000', fontWeight: 700, borderRadius: 8, border: 'none', padding: '11px 28px', cursor: 'pointer', fontSize: '0.95rem' }}>
          Yeni link iste →
        </button>
      </div>
    </div>
  );

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
