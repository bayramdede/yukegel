import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hakkımızda | Yükegel — Türkiye\'nin Nakliye Platformu',
  description: 'Yükegel, karayolu taşımacılığını dijitalleştiriyor. Dağınık veriyi güvenilir bilgiye dönüştürerek yük sahipleri ile nakliyecileri doğrudan buluşturuyoruz.',
  openGraph: {
    title: 'Hakkımızda | Yükegel',
    description: 'Yük sahipleri ile nakliyecileri doğrudan buluşturan, Türkiye\'nin yeni nesil nakliye ve iş takip platformu.',
    url: 'https://yukegel.com/hakkimizda',
    siteName: 'Yükegel',
    locale: 'tr_TR',
    type: 'website',
  },
  alternates: { canonical: 'https://yukegel.com/hakkimizda' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Yükegel',
  url: 'https://yukegel.com',
  logo: 'https://yukegel.com/logo.svg',
  description: 'Türkiye karayolu taşımacılığını dijitalleştiren, yük sahipleri ile nakliyecileri buluşturan nakliye ve iş takip platformu.',
  foundingDate: '2024',
  areaServed: 'TR',
  contactPoint: { '@type': 'ContactPoint', email: 'merhaba@yukegel.com', contactType: 'customer support' },
  sameAs: ['https://yukegel.com'],
};

export default function Hakkimizda() {
  const degerler = [
    { ikon: '🤝', baslik: 'Şeffaflık', aciklama: 'Hiçbir gizli ücret, aracı komisyonu veya belirsiz kural yoktur. Platform nasıl çalışıyorsa öyle çalışır.' },
    { ikon: '⚡', baslik: 'Hız', aciklama: 'Veri saniyeler içinde işlenir ve listelenir. Nakliyeciler aynı anda ilanınızı görür. Bürokratik süreç yoktur.' },
    { ikon: '🔒', baslik: 'Güven', aciklama: 'Kimlik doğrulama, telefon onayı ve sürekli denetim mekanizmaları ile platforma duyulan güveni her şeyin üstünde tutarız.' },
    { ikon: '🇹🇷', baslik: 'Yerlilik', aciklama: 'Türkiye karayolu taşımacılığının dinamiklerini, şoförün ihtiyacını ve yük sahibinin hassasiyetlerini bilerek kurulduk. Çözümlerimiz sektörün gerçeklerine dayanır.' },
  ];

  const odaklar = [
    { ikon: '🧠', baslik: 'Evrensel Veri Ayrıştırma', aciklama: 'Verinin nereden geldiğine değil, nasıl işlendiğine odaklanırız. Her türlü platformdan gelen dağınık verileri alır, AI altyapımızla sınıflandırıp yapılandırılmış listelere dönüştürürüz.' },
    { ikon: '🎯', baslik: 'Akıllı Listeleme ve İş Takibi', aciklama: 'İlan yayınlandıktan sonra kaybolmaz. Gelişmiş filtreleme ve takip sistemimizle sektörün dağınık bilgisi güvenilir bir operasyon merkezine kavuşur.' },
    { ikon: '🛡️', baslik: 'Denetlenmiş Güven Ekosistemi', aciklama: 'Gelişmiş dijital doğrulama sistemleri ve platform kurallarımızla "sahte ilan" ve "güvensiz profil" sorununu ortadan kaldırırız.' },
  ];

  const rakamlar = [
    { sayi: '10.000+', etiket: 'Kayıtlı Kullanıcı' },
    { sayi: '50.000+', etiket: 'İlan Yayınlandı' },
    { sayi: '81', etiket: 'İl Kapsamı' },
    { sayi: '2024', etiket: 'Kuruluş Yılı' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 16px 80px' }}>

        {/* BAŞLIK */}
        <header style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>Hakkımızda</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Karayolu taşımacılığını dijitalleştiriyor,<br />
            <span style={{ color: '#22c55e' }}>dağınık veriyi güvenilir bilgiye dönüştürüyoruz.</span>
          </h1>
          <p style={{ color: '#8b949e', fontSize: '1rem', maxWidth: 600, margin: '0 auto', lineHeight: 1.8 }}>
            Yükegel, yük sahipleri ile nakliyecileri doğrudan buluşturan, Türkiye&apos;nin yeni nesil nakliye, akıllı listeleme ve iş takip platformudur.
          </p>
        </header>

        {/* MİSYON */}
        <section aria-label="Misyonumuz" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <h2 style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Misyonumuz</h2>
          <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.8, margin: 0, fontWeight: 500 }}>
            Türkiye&apos;deki milyonlarca nakliye işleminde karmaşık veriyi temiz, erişilebilir ve güvenilir bilgiye dönüştürerek;
            yük sahiplerini ve nakliyecileri <strong style={{ color: '#22c55e' }}>gereksiz aracılar olmadan</strong> hızla bir araya getirmek.
            Her gün tekerlekler dönsün, işler yürüsün.
          </p>
        </section>

        {/* HİKAYE */}
        <section aria-label="Hikayemiz" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <h2 style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>Hikayemiz</h2>
          <div style={{ color: '#8b949e', fontSize: '0.92rem', lineHeight: 1.9 }}>
            <p style={{ margin: '0 0 16px' }}>
              Türkiye&apos;de her gün binlerce yük ilanı farklı dijital kanallara, mesajlaşma uygulamalarına ve gruplara saçılır.
              Bu iletişim kanalları hızlı olsa da, üretilen devasa veri buralarda kaydedilmez, aranmaz, filtrelenmez ve doğrulanamaz.
              Kritik bir ilan, kısa süre içinde mesaj yığınları arasında kaybolur gider.
            </p>
            <p style={{ margin: '0 0 16px' }}>
              Yükegel, sektördeki bu veri kaosunu sona erdirmek için doğdu. Bizim için verinin hangi ortamda doğduğunun
              veya nereden geldiğinin bir önemi yoktur. Hangi kanaldan gelirse gelsin, her türlü düzensiz metni alıyor,
              akıllı algoritmalarımızla saniyeler içinde sınıflandırıyor ve profesyonel, aranabilir bir listeye dönüştürüyoruz.
            </p>
            <p style={{ margin: 0 }}>
              Dağınık veriyi bilgiye çeviriyor, güvenilir bir iş takip merkezi sunuyoruz. Böylece karmaşa bitiyor;
              arayan, aradığını her zaman kolayca ve güvenle buluyor.
              2024 yılında başladığımız bu yolculukta binlerce kullanıcıya ulaştık — ama sektörü dijitalleştirme,
              şeffaflaştırma ve güvenli hale getirme kararlılığımız çok güçlü.
            </p>
          </div>
        </section>

        {/* STRATEJİK ODAK */}
        <section aria-label="Stratejik Odağımız" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <h2 style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 24px' }}>Stratejik Odağımız</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {odaklar.map(o => (
              <div key={o.baslik} style={{ display: 'flex', gap: 16 }}>
                <div style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 2 }} aria-hidden="true">{o.ikon}</div>
                <div>
                  <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 6px' }}>{o.baslik}</h3>
                  <p style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.7, margin: 0 }}>{o.aciklama}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RAKAMLAR */}
        <section aria-label="Rakamlarla Yükegel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {rakamlar.map(r => (
            <div key={r.etiket} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.8rem', marginBottom: 4 }}>{r.sayi}</div>
              <div style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>{r.etiket}</div>
            </div>
          ))}
        </section>

        {/* DEĞERLER */}
        <section aria-label="Değerlerimiz" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <h2 style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 24px' }}>Değerlerimiz</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {degerler.map(d => (
              <div key={d.baslik}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }} aria-hidden="true">{d.ikon}</div>
                <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 6px' }}>{d.baslik}</h3>
                <p style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.7, margin: 0 }}>{d.aciklama}</p>
              </div>
            ))}
          </div>
        </section>

        {/* İLETİŞİM */}
        <section aria-label="İletişim" style={{ background: '#0d2b1a', border: '1px solid #166534', borderRadius: 16, padding: '32px', marginBottom: 40 }}>
          <h2 style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px' }}>İletişim</h2>
          <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', margin: '0 0 16px' }}>Sorularınız veya önerileriniz için bize ulaşın.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { etiket: '📧 E-posta', deger: 'merhaba@yukegel.com' },
              { etiket: '🌐 Web', deger: 'yukegel.com' },
              { etiket: '📍 Konum', deger: 'İstanbul, Türkiye' },
            ].map(item => (
              <div key={item.etiket} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '0.82rem', minWidth: 80 }}>{item.etiket}</span>
                <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{item.deger}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', margin: '0 0 8px' }}>Platforma katılın</p>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: '0 0 24px' }}>Binlerce nakliyeci ve yük sahibiyle aynı platformda buluşun.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/giris"
              style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.95rem', padding: '12px 28px', borderRadius: 8, textDecoration: 'none' }}>
              Ücretsiz Başla →
            </a>
            <a href="/nasil-calisir"
              style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem', padding: '12px 28px', borderRadius: 8, textDecoration: 'none', border: '1px solid #30363d' }}>
              Nasıl Çalışır?
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
