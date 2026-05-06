'use client';
import { useState } from 'react';

type Tab = 'musteri' | 'nakliyeci';

const MUSTERI_ADIMLAR = [
  {
    no: '01',
    baslik: 'Kayıt Ol',
    aciklama: 'Telefon numaranız veya e-posta adresinizle dakikalar içinde üye olun. Ek belge veya onay beklemenize gerek yok.',
    ikon: '📱',
    detay: ['SMS ile doğrulama kodu', 'Google ile hızlı giriş', 'Ücretsiz, sınırsız kullanım'],
  },
  {
    no: '02',
    baslik: 'İlan Ver',
    aciklama: 'Yükünüzün kalkış ve varış noktasını, tarihini ve özelliklerini girin. İlanınız anında yayına girer.',
    ikon: '📦',
    detay: ['Kalkış / Varış ili ve ilçesi', 'Araç tipi ve yük cinsi', 'Fiyat teklifi (opsiyonel)'],
  },
  {
    no: '03',
    baslik: 'Nakliyeciler Sizi Arasın',
    aciklama: 'Bölgenizdeki nakliyeciler ilanınızı görür ve doğrudan telefon numaranızdan sizi arar. Ara katman yok.',
    ikon: '📞',
    detay: ['Telefon numaranız üyelere görünür', 'Pazarlık serbesttir', 'Onlarca nakliyeciye tek seferde ulaşın'],
  },
  {
    no: '04',
    baslik: 'Anlaşın & Taşıtın',
    aciklama: 'Nakliyeciyle anlaştıktan sonra ilanınızı pasife alın. İşiniz tamamlandığında karşılıklı değerlendirme yapın.',
    ikon: '✅',
    detay: ['İlanı dilediğinizde pasife alın', 'Nakliyeciyi puanlayın', 'Geçmiş ilanlarınızı takip edin'],
  },
];

const NAKLIYECI_ADIMLAR = [
  {
    no: '01',
    baslik: 'Kayıt Ol & Araç Ekle',
    aciklama: 'Hesabınızı oluşturun, aracınızın plakasını, tipini ve üst yapısını sisteme ekleyin. Profiliniz nakliyeci olarak aktifleşir.',
    ikon: '🚛',
    detay: ['Plaka, araç tipi, üst yapı', 'TCKN ile güvenilir profil', 'Birden fazla araç eklenebilir'],
  },
  {
    no: '02',
    baslik: 'İlanları Keşfet',
    aciklama: 'Ana sayfada kalkış ve varış noktasına göre filtreleyerek size uygun yük ilanlarını bulun.',
    ikon: '🔍',
    detay: ['İl / ilçe bazlı filtreleme', 'Araç tipine göre uygun ilanlar', 'Anlık güncellenen liste'],
  },
  {
    no: '03',
    baslik: 'Yük Sahibini Ara',
    aciklama: 'Beğendiğiniz ilanın telefon numarasını görüntüleyin ve doğrudan yük sahibiyle görüşün. Platform aracılık ücreti almaz.',
    ikon: '📞',
    detay: ['Telefon numaraları üyelere açık', 'Direkt iletişim, ara katman yok', 'Anında pazarlık imkânı'],
  },
  {
    no: '04',
    baslik: 'İşi Al & Taşı',
    aciklama: 'Anlaştıktan sonra işi tamamlayın. Yük sahibi memnuniyetinize göre sizi değerlendirir ve profiliniz güçlenir.',
    ikon: '🏆',
    detay: ['Güven skoru ile öne çıkın', 'Olumlu yorumlar yeni işler getirir', 'Aracım Boşta ilanıyla aktif kalın'],
  },
];

function AdimKart({ adim, renk }: { adim: typeof MUSTERI_ADIMLAR[0]; renk: string }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 16, right: 20, fontSize: '2.5rem', opacity: 0.08 }}>{adim.ikon}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ background: renk === 'yesil' ? '#0d2b1a' : '#1a2535', color: renk === 'yesil' ? '#22c55e' : '#60a5fa', fontWeight: 800, fontSize: '1.1rem', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {adim.no}
        </div>
        <div style={{ fontSize: '1.3rem' }}>{adim.ikon}</div>
      </div>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{adim.baslik}</div>
      <div style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 16 }}>{adim.aciklama}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {adim.detay.map(d => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: renk === 'yesil' ? '#22c55e' : '#60a5fa', fontSize: '0.75rem' }}>✓</span>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SSS = [
  {
    s: 'Yükegel ücretsiz mi?',
    c: 'Evet. İlan vermek, ilanları görüntülemek ve nakliyecilerle iletişime geçmek tamamen ücretsizdir.',
  },
  {
    s: 'Nakliyecilerin güvenilirliği nasıl sağlanıyor?',
    c: 'Nakliyeciler TC Kimlik Numaraları ile kayıt olur, araç bilgilerini sisteme ekler. Tamamlanan işler sonrası karşılıklı değerlendirme sistemi güven skoru oluşturur.',
  },
  {
    s: 'İlanım ne kadar sürede yayına girer?',
    c: 'Form veya Excel ile verilen ilanlar anında yayına girer. WhatsApp gruplarından aktarılan ilanlar otomatik risk analizine tabi tutulur; düşük riskli olanlar anında yayınlanır, riskli görünenler moderatör incelemesine girer.',
  },
  {
    s: 'Telefon numaram herkese görünür mü?',
    c: 'Hayır. Telefon numaralarınız yalnızca kayıtlı üyelere görünür.',
  },
];

export default function NasilCalisir() {
  const [tab, setTab] = useState<Tab>('musteri');

  const adimlar = tab === 'musteri' ? MUSTERI_ADIMLAR : NAKLIYECI_ADIMLAR;
  const renk = tab === 'musteri' ? 'yesil' : 'mavi';

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>← İlanlar</a>
            <a href="/giris" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>Başla</a>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 16px 80px' }}>

        {/* BAŞLIK */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>Nasıl Çalışır?</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', margin: '0 0 16px', letterSpacing: '-0.03em' }}>
            Basit. Hızlı. Doğrudan.
          </h1>
          <p style={{ color: '#8b949e', fontSize: '1rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Yükegel'de yük sahipleri ve nakliyeciler arasında hiçbir aracı yoktur.
            İlanlar yayınlanır, taraflar birbirini bulur, anlaşma telefonda yapılır.
          </p>
        </div>

        {/* TAB SEÇİMİ */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 4, display: 'inline-flex', gap: 4 }}>
            <button onClick={() => setTab('musteri')}
              style={{ padding: '10px 24px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', background: tab === 'musteri' ? '#22c55e' : 'transparent', color: tab === 'musteri' ? '#000' : '#8b949e', transition: 'all 0.15s' }}>
              📦 Yük Sahibiyim
            </button>
            <button onClick={() => setTab('nakliyeci')}
              style={{ padding: '10px 24px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', background: tab === 'nakliyeci' ? '#60a5fa' : 'transparent', color: tab === 'nakliyeci' ? '#000' : '#8b949e', transition: 'all 0.15s' }}>
              🚛 Nakliyeciyim
            </button>
          </div>
        </div>

        {/* ADIMLAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 48 }}>
          {adimlar.map(adim => <AdimKart key={adim.no} adim={adim} renk={renk} />)}
        </div>

        {/* SIKÇA SORULAN SORULAR */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 32, marginBottom: 40 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 24 }}>Sık Sorulan Sorular</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {SSS.map(({ s, c }) => (
              <div key={s} style={{ borderBottom: '1px solid #21262d', paddingBottom: 20 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>❓ {s}</div>
                <div style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.6 }}>{c}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Hazır mısınız?</div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>Dakikalar içinde üye olun, hemen ilan verin.</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/giris"
              style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.95rem', padding: '12px 28px', borderRadius: 8, textDecoration: 'none' }}>
              Ücretsiz Başla →
            </a>
            <a href="/"
              style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', border: '1px solid #30363d' }}>
              İlanları Gör
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
