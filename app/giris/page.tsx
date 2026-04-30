'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const supabase = createClient();

type Mod = 'giris' | 'kayit' | 'reset' | 'reset_tamam' | 'dogrulama_bekle' | 'merge_onay';
type Sekme = 'telefon' | 'eposta';

function GirisIci() {
  const [sekme, setSekme] = useState<Sekme>('telefon');
  const [mod, setMod] = useState<Mod>('giris');

  // Telefon
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [otpAdim, setOtpAdim] = useState(false);
  const [mergeHedef, setMergeHedef] = useState<{ id: string; email: string | null; display_name: string | null } | null>(null);
  const [mergeYukleniyor, setMergeYukleniyor] = useState(false);

  // E-posta
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');

  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bilgi, setBilgi] = useState('');
  const redirect = searchParams.get('redirect');

  function temizle() { setHata(''); }

  // Başarılı giriş sonrası yönlendirme
  // - Explicit redirect varsa oraya git
  // - Yoksa role'e göre: admin -> /admin, moderator -> /moderator, diğerleri -> /
  async function yonlendir() {
    if (redirect) { router.push(redirect); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }
    const { data: profil } = await supabase
      .from('users').select('role').eq('id', user.id).single();
    const role = (profil as any)?.role || 'user';
    if (role === 'admin') router.push('/admin');
    else if (role === 'moderator') router.push('/moderator');
    else router.push('/');
  }

  // ── Telefon akışı ───────────────────────────────────────────────
  async function otpGonder(e: React.FormEvent) {
    e.preventDefault(); setYukleniyor(true); temizle();
    const temiz = telefon.replace(/\D/g, '');
    const fmt = temiz.startsWith('90') ? `+${temiz}` : temiz.startsWith('0') ? `+9${temiz}` : `+90${temiz}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: fmt });
    if (error) setHata('SMS gönderilemedi. Numarayı kontrol edin.');
    else setOtpAdim(true);
    setYukleniyor(false);
  }

  async function otpDogrula(e: React.FormEvent) {
    e.preventDefault(); setYukleniyor(true); temizle();
    const temiz = telefon.replace(/\D/g, '');
    const fmt = temiz.startsWith('90') ? `+${temiz}` : temiz.startsWith('0') ? `+9${temiz}` : `+90${temiz}`;
    const { data, error } = await supabase.auth.verifyOtp({ phone: fmt, token: otp, type: 'sms' });
    if (error) { setHata('Kod hatalı veya süresi dolmuş.'); setYukleniyor(false); return; }

    const mevcutUserId = data.user?.id;
    if (!mevcutUserId) { setHata('Giriş yapılamadı, lütfen tekrar deneyin.'); setYukleniyor(false); return; }

    // 1. Mevcut kullanıcının kendi profilini kontrol et
    const { data: mevcutProfil } = await supabase
      .from('users')
      .select('merged_into, is_active, user_type')
      .eq('id', mevcutUserId)
      .maybeSingle();

    // 2. Daha önce merge edilmiş — asıl hesaba magic link ile geç
    if (mevcutProfil?.merged_into) {
      const res = await fetch('/api/auth/switch-account', { method: 'POST' });
      const json = await res.json();
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl;
      } else {
        setHata('Giriş yapılamadı, lütfen tekrar deneyin.');
        setYukleniyor(false);
      }
      return;
    }

    // 3. Aktif profil varsa direkt giriş
    if (mevcutProfil?.is_active && mevcutProfil?.user_type) {
      await yonlendir();
      setYukleniyor(false);
      return;
    }

    // 4. DB'de 05xx / 5xx formatında başka profil var mı? (ilk kez merge)
    const telefonTemiz = fmt.startsWith('+90') ? '0' + fmt.slice(3) : fmt;
    const telefonKisa  = fmt.startsWith('+90') ? fmt.slice(3) : fmt;

    // Bu telefon başka bir users kaydında var mı?
    const { data: eskiProfil } = await supabase
      .from('users')
      .select('id, email, display_name')
      .or(`phone.eq.${telefonTemiz},phone.eq.${telefonKisa}`)
      .eq('is_active', true)
      .neq('id', mevcutUserId)
      .maybeSingle();

    if (eskiProfil) {
      const res = await fetch('/api/auth/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepUserId: eskiProfil.id, mergeUserId: mevcutUserId }),
      });
      if (!res.ok) {
        setMergeHedef(eskiProfil);
        setMod('merge_onay');
        setYukleniyor(false);
        return;
      }
      const json = await res.json();
      window.location.href = json.redirectUrl || '/panel';
      return;
    }

    // Profil var mı, tamamlanmış mı?
    const { data: profil } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', mevcutUserId)
      .maybeSingle();

    if (!profil?.user_type) {
      router.push('/profil-tamamla');
    } else {
      await yonlendir();
    }
    setYukleniyor(false);
  }

  async function mergeOnayla() {
    if (!mergeHedef) return;
    setMergeYukleniyor(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMergeYukleniyor(false); return; }

    const res = await fetch('/api/auth/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepUserId: user.id, mergeUserId: mergeHedef.id }),
    });

    if (!res.ok) {
      setHata('Hesap birleştirme başarısız oldu. Lütfen tekrar deneyin.');
      setMod('giris'); setMergeHedef(null);
    } else {
      await yonlendir();
    }
    setMergeYukleniyor(false);
  }

  // ── E-posta giriş ───────────────────────────────────────────────
  async function epostaGiris(e: React.FormEvent) {
    e.preventDefault(); setYukleniyor(true); temizle();
    const { error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre });
    if (error) {
      if (error.message.includes('Invalid login')) setHata('E-posta veya şifre hatalı.');
      else if (error.message.includes('Email not confirmed')) setHata('E-posta adresinizi doğrulamadınız. Gelen kutunuzu kontrol edin.');
      else setHata(error.message);
    } else {
      await yonlendir();
    }
    setYukleniyor(false);
  }

  // ── E-posta kayıt ───────────────────────────────────────────────
  async function epostaKayit(e: React.FormEvent) {
    e.preventDefault(); temizle();
    if (sifre.length < 8) { setHata('Şifre en az 8 karakter olmalı.'); return; }
    if (sifre !== sifreTekrar) { setHata('Şifreler eşleşmiyor.'); return; }
    setYukleniyor(true);
    const { error } = await supabase.auth.signUp({
      email: eposta,
      password: sifre,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      if (error.message.includes('already registered')) setHata('Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.');
      else setHata(error.message);
    } else {
      setMod('dogrulama_bekle');
    }
    setYukleniyor(false);
  }

  // ── Şifremi unuttum ─────────────────────────────────────────────
  async function sifreSifirla(e: React.FormEvent) {
    e.preventDefault(); setYukleniyor(true); temizle();
    const { error } = await supabase.auth.resetPasswordForEmail(eposta, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) setHata('E-posta gönderilemedi.');
    else setMod('reset_tamam');
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

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <img src="/logo.svg" alt="Yükegel" style={{ width: 44, height: 44, marginBottom: 10 }} />
      <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>
        <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
      </div>
    </div>
  );

  // Merge onay ekranı
  if (mod === 'merge_onay' && mergeHedef) return (
    <Wrap><Logo />
      <div style={{ background: '#161b22', border: '1px solid #f59e0b', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>🔗</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 8, textAlign: 'center' }}>Bu telefon başka bir hesapla bağlantılı</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 20, textAlign: 'center' }}>
          <strong style={{ color: '#e2e8f0' }}>{mergeHedef.display_name || mergeHedef.email || 'Mevcut hesap'}</strong> adlı hesabın geçmişi (ilanlar, işler, puanlar) bu hesaba taşınacak.
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: '0.78rem', color: '#6b7280' }}>
          ⚠️ Bu işlem geri alınamaz. Eski hesap pasife alınır.
        </div>
        {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
        <button onClick={mergeOnayla} disabled={mergeYukleniyor}
          style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 10 }}>
          {mergeYukleniyor ? 'Birleştiriliyor...' : 'Evet, hesapları birleştir'}
        </button>
        <button onClick={() => { setMod('giris'); setMergeHedef(null); temizle(); }}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer' }}>
          Hayır, ayrı tut
        </button>
      </div>
    </Wrap>
  );

  // Doğrulama bekleniyor
  if (mod === 'dogrulama_bekle') return (
    <Wrap><Logo />
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📧</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Doğrulama e-postası gönderildi</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 20 }}>
          <strong style={{ color: '#e2e8f0' }}>{eposta}</strong> adresine doğrulama linki gönderdik. Linke tıkladıktan sonra giriş yapabilirsiniz.
        </div>
        <div style={{ color: '#4b5563', fontSize: '0.78rem', marginBottom: 20 }}>Spam klasörünüzü de kontrol edin.</div>
        <button onClick={() => { setMod('giris'); setSifre(''); setSifreTekrar(''); }}
          style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: '0.85rem' }}>
          ← Giriş sayfasına dön
        </button>
      </div>
    </Wrap>
  );

  // Şifre sıfırlama tamam
  if (mod === 'reset_tamam') return (
    <Wrap><Logo />
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>Şifre sıfırlama linki gönderildi</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 20 }}>
          <strong style={{ color: '#e2e8f0' }}>{eposta}</strong> adresine şifre sıfırlama linki gönderdik.
        </div>
        <button onClick={() => setMod('giris')}
          style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: '0.85rem' }}>
          ← Giriş sayfasına dön
        </button>
      </div>
    </Wrap>
  );

  // Şifremi unuttum
  if (mod === 'reset') return (
    <Wrap><Logo />
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 4 }}>Şifremi Unuttum</div>
        <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 20 }}>E-posta adresinize şifre sıfırlama linki göndereceğiz.</div>
        <form onSubmit={sifreSifirla}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>E-posta</label>
            <input type="email" value={eposta} onChange={e => setEposta(e.target.value)} placeholder="ornek@mail.com" required style={inp} autoFocus />
          </div>
          {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
          <button type="submit" disabled={yukleniyor}
            style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 10 }}>
            {yukleniyor ? 'Gönderiliyor...' : 'Link Gönder →'}
          </button>
          <button type="button" onClick={() => { setMod('giris'); temizle(); }}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer' }}>
            ← Giriş sayfasına dön
          </button>
        </form>
      </div>
    </Wrap>
  );

  return (
    <Wrap>
      <Logo />

      {/* Sekmeler */}
      <div style={{ display: 'flex', background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {(['telefon', 'eposta'] as Sekme[]).map(s => (
          <button key={s} onClick={() => { setSekme(s); setMod('giris'); setOtpAdim(false); temizle(); }}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: sekme === s ? '#22c55e' : 'none', color: sekme === s ? '#000' : '#8b949e', transition: 'all 0.15s' }}>
            {s === 'telefon' ? '📱 Telefon' : '✉️ E-posta'}
          </button>
        ))}
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24 }}>

        {/* ── TELEFON ── */}
        {sekme === 'telefon' && (
          <>
            {!otpAdim ? (
              <form onSubmit={otpGonder}>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Telefon Numarası</label>
                  <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="05xx xxx xx xx" required style={inp} autoFocus />
                  <div style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: 6 }}>SMS ile doğrulama kodu gönderilecek.</div>
                </div>
                {bilgi && <div style={{ color: '#22c55e', fontSize: '0.82rem', marginBottom: 12, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 6, padding: '10px 12px' }}>✓ {bilgi}</div>}
                {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
                <button type="submit" disabled={yukleniyor}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
                  {yukleniyor ? 'Gönderiliyor...' : 'Kod Gönder →'}
                </button>
              </form>
            ) : (
              <form onSubmit={otpDogrula}>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Doğrulama Kodu</label>
                  <div style={{ color: '#8b949e', fontSize: '0.82rem', marginBottom: 12 }}>📱 {telefon} numarasına SMS gönderdik.</div>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 4))} placeholder="4 haneli kod" required maxLength={4}
                    style={{ ...inp, fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }} autoFocus />
                </div>
                {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
                <button type="submit" disabled={yukleniyor || otp.length < 4}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: otp.length === 4 ? '#22c55e' : '#166534', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 10 }}>
                  {yukleniyor ? 'Doğrulanıyor...' : 'Giriş Yap →'}
                </button>
                <button type="button" onClick={() => { setOtpAdim(false); setOtp(''); temizle(); }}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer' }}>
                  ← Telefonu değiştir
                </button>
              </form>
            )}
          </>
        )}

        {/* ── E-POSTA GİRİŞ ── */}
        {sekme === 'eposta' && mod === 'giris' && (
          <form onSubmit={epostaGiris}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>E-posta</label>
              <input type="email" value={eposta} onChange={e => setEposta(e.target.value)} placeholder="ornek@mail.com" required style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Şifre</label>
                <button type="button" onClick={() => { setMod('reset'); temizle(); }}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                  Şifremi unuttum
                </button>
              </div>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" required style={inp} />
            </div>
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="submit" disabled={yukleniyor}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 14 }}>
              {yukleniyor ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
            </button>
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.82rem' }}>
              Hesabın yok mu?{' '}
              <button type="button" onClick={() => { setMod('kayit'); temizle(); setSifre(''); setSifreTekrar(''); }}
                style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                Kayıt Ol
              </button>
            </div>
          </form>
        )}

        {/* ── E-POSTA KAYIT ── */}
        {sekme === 'eposta' && mod === 'kayit' && (
          <form onSubmit={epostaKayit}>
            <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 16 }}>Yeni Hesap Oluştur</div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>E-posta</label>
              <input type="email" value={eposta} onChange={e => setEposta(e.target.value)} placeholder="ornek@mail.com" required style={inp} autoFocus />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Şifre</label>
              <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="En az 8 karakter" required style={inp} />
              {sifre.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[sifre.length >= 8, /[0-9]/.test(sifre), /[A-Z]/.test(sifre)].map((ok, i) => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: ok ? '#22c55e' : '#374151', transition: 'background 0.2s' }} />
                  ))}
                </div>
              )}
              <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 4 }}>En az 8 karakter, sayı ve büyük harf içermeli.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Şifre Tekrar</label>
              <input type="password" value={sifreTekrar} onChange={e => setSifreTekrar(e.target.value)} placeholder="••••••••" required style={{ ...inp, borderColor: sifreTekrar && sifreTekrar !== sifre ? '#ef4444' : '#30363d' }} />
              {sifreTekrar && sifreTekrar !== sifre && <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: 4 }}>Şifreler eşleşmiyor.</div>}
            </div>
            {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}
            <button type="submit" disabled={yukleniyor}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginBottom: 14 }}>
              {yukleniyor ? 'Kayıt yapılıyor...' : 'Kayıt Ol →'}
            </button>
            <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.82rem' }}>
              Zaten hesabın var mı?{' '}
              <button type="button" onClick={() => { setMod('giris'); temizle(); setSifre(''); setSifreTekrar(''); }}
                style={{ background: 'none', border: 'none', color: '#22c55e', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                Giriş Yap
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Google */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#30363d' }} />
        <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>veya</span>
        <div style={{ flex: 1, height: 1, background: '#30363d' }} />
      </div>
      <button type="button" onClick={async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
      }}
        style={{ width: '100%', padding: '11px', borderRadius: 8, border: '1px solid #30363d', background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google ile Giriş Yap
      </button>

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <a href="/moderator-giris" style={{ color: '#4b5563', fontSize: '0.75rem', textDecoration: 'none' }}>Moderatör girişi</a>
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
        {children}
      </div>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense>
      <GirisIci />
    </Suspense>
  );
}
