import { getConfig } from '../../../lib/config';

export default async function Footer() {
  const sirketUnvani = await getConfig('sirket_unvani', 'Yükegel');
  const yil = new Date().getFullYear();

  return (
    <footer style={{ borderTop: '1px solid #30363d', marginTop: 48, padding: '32px 16px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          <div style={{ color: '#4b5563', fontSize: '0.78rem' }}>Türkiye'nin nakliye ilan platformu</div>
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Platform</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/nasil-calisir" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Nasıl Çalışır?</a>
              <a href="/hakkimizda"    style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Hakkımızda</a>
              <a href="/ilan-ver"      style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>İlan Ver</a>
            </div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Hesap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/giris" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Giriş Yap</a>
              <a href="/giris" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Kayıt Ol</a>
              <a href="/panel" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Panelim</a>
            </div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Yasal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="/kvkk"               style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>KVKK</a>
              <a href="/kullanim-kosullari"  style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>Kullanım Koşulları</a>
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1280, margin: '24px auto 0', paddingTop: 20, borderTop: '1px solid #21262d', textAlign: 'center', color: '#4b5563', fontSize: '0.75rem' }}>
        © {yil} {sirketUnvani} · Tüm hakları saklıdır.
      </div>
    </footer>
  );
}
