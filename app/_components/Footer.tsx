import Link from 'next/link';
import { getConfig } from '../../lib/config';
import GirisLink from './GirisLink';

/**
 * SPRINT_01 F2 — buradaki bağlantılar `<a href>` idi, artık `next/link`.
 *
 * ESKİ HALİNİN SORUNU: `<a href="/kvkk">` tarayıcıya TAM SAYFA YENİLEMESİ yaptırır.
 * Next router devre dışı kalır: React ağacı, oturum istemcisi ve tüm önbellek
 * sıfırdan kurulur. 3G'deki bir şoför için bu her footer tıklamasında saniyeler.
 * `next/link` ise sadece o rotanın RSC payload'ını çeker ve görünür olduğunda
 * önden yükler (prefetch). `@next/next/no-html-link-for-pages` kuralı da tam
 * bunu yakalıyordu.
 *
 * ⚠️ KURAL: `/` ile başlayan her hedef `<Link>` olmalı. `<a>` yalnız DIŞ
 *    adresler, `mailto:` ve `tel:` için.
 */
export default async function Footer() {
  const sirketUnvani = await getConfig('sirket_unvani', 'Yükegel');
  const yil = new Date().getFullYear();
  const bag = { color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' };

  return (
    <footer style={{ borderTop: '1px solid #30363d', marginTop: 0, padding: '32px 16px', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
          </div>
          {/* `&apos;` — düz `'` JSX metninde `react/no-unescaped-entities` hatası veriyor. */}
          <div style={{ color: '#4b5563', fontSize: '0.78rem' }}>Türkiye&apos;nin nakliye ilan platformu</div>
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Platform</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/nasil-calisir" style={bag}>Nasıl Çalışır?</Link>
              <Link href="/hakkimizda"    style={bag}>Hakkımızda</Link>
              <Link href="/ilan-ver"      style={bag}>İlan Ver</Link>
            </div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Hesap</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* 29 Tem 2026 — `<Link href="/giris">` DEĞİL `<GirisLink>`: footer her
                  sayfada var, dolayısıyla bu iki bağlantı giriş sonrası "ana sayfaya
                  düşme" şikâyetinin en yaygın kaynağıydı. Bileşen bulunduğu sayfayı
                  `?redirect=` olarak kendisi ekler (bkz. lib/redirect.ts → girisAdresi). */}
              <GirisLink style={bag}>Giriş Yap</GirisLink>
              {/* SPRINT_01 F1 — eskiden bu da düz `/giris`e gidiyordu, yani "Kayıt Ol"
                  ile "Giriş Yap" AYNI ekranı açıyordu. `mod=kayit` doğrudan e-posta
                  sekmesindeki kayıt formunu açar (bkz. app/giris/page.tsx). */}
              <GirisLink mod="kayit" style={bag}>Kayıt Ol</GirisLink>
              <Link href="/panel" style={bag}>Panelim</Link>
            </div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Yasal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/kvkk"               style={bag}>KVKK</Link>
              <Link href="/kullanim-kosullari" style={bag}>Kullanım Koşulları</Link>
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
