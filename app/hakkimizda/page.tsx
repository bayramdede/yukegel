export default function Hakkimizda() {
  const degerler = [
    { ikon: '🤝', baslik: 'Şeffaflık', aciklama: 'Hiçbir gizli ücret, aracı komisyonu veya belirsiz kural yoktur. Platform nasıl çalışıyorsa öyle çalışır.' },
    { ikon: '⚡', baslik: 'Hız', aciklama: 'İlan vermek 2 dakika alır. Nakliyeciler aynı anda ilanınızı görür. Bürokratik süreç yoktur.' },
    { ikon: '🔒', baslik: 'Güven', aciklama: 'Kimlik doğrulama, telefon onayı ve karşılıklı değerlendirme sistemi ile platforma duyulan güveni artırırız.' },
    { ikon: '🇹🇷', baslik: 'Yerlilik', aciklama: 'Türkiye karayolu taşımacılığının dinamiklerini bilerek kurulduk. Çözümlerimiz sektörün gerçeklerine dayanır.' },
  ];

  const rakamlar = [
    { sayi: '10.000+', etiket: 'Kayıtlı Kullanıcı' },
    { sayi: '50.000+', etiket: 'İlan Yayınlandı' },
    { sayi: '81', etiket: 'İl Kapsamı' },
    { sayi: '2024', etiket: 'Kuruluş Yılı' },
  ];

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

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 16px 80px' }}>

        {/* BAŞLIK */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>Hakkımızda</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Karayolu taşımacılığını<br />
            <span style={{ color: '#22c55e' }}>dijitalleştiriyoruz.</span>
          </h1>
          <p style={{ color: '#8b949e', fontSize: '1rem', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
            Yükegel, yük sahipleri ile nakliyecileri doğrudan buluşturan Türkiye'nin nakliye ilan platformudur.
          </p>
        </div>

        {/* MİSYON */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <div style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Misyonumuz</div>
          <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.8, margin: 0, fontWeight: 500 }}>
            Türkiye'deki milyonlarca nakliye işleminde yük sahiplerini ve nakliyecileri
            <strong style={{ color: '#22c55e' }}> gereksiz aracılar olmadan</strong>, doğrudan ve hızla bir araya getirmek.
            Her gün tekerlekler dönsün, işler yürüsün.
          </p>
        </div>

        {/* HİKAYE */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <div style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Hikayemiz</div>
          <div style={{ color: '#8b949e', fontSize: '0.92rem', lineHeight: 1.9 }}>
            <p style={{ margin: '0 0 16px' }}>
              Türkiye'de her gün binlerce yük, WhatsApp grupları üzerinden nakliyeci arar.
              Bu gruplar verimli çalışır ama bir yerde kaydedilmez, aranmaz, filtrelenmez.
              Bir ilan sabah sabah gönderilir, öğlene kadar yukarı kaybolur.
            </p>
            <p style={{ margin: '0 0 16px' }}>
              Yükegel bu sorunu çözmek için kuruldu. WhatsApp gruplarından gelen ilanları yapılandırarak
              dijital bir marketplace'e dönüştürüyoruz. Hem nakliyeciler hem yük sahipleri için
              aranabilir, filtrelenebilir ve güvenilir bir platform sunuyoruz.
            </p>
            <p style={{ margin: 0 }}>
              2024 yılında başladığımız bu yolculukta binlerce kullanıcıya ulaştık.
              Henüz başlangıçtayız — ama sektörü dönüştürme kararlılığımız güçlü.
            </p>
          </div>
        </div>

        {/* RAKAMLAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {rakamlar.map(r => (
            <div key={r.etiket} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.8rem', marginBottom: 4 }}>{r.sayi}</div>
              <div style={{ color: '#6b7280', fontSize: '0.78rem', fontWeight: 600 }}>{r.etiket}</div>
            </div>
          ))}
        </div>

        {/* DEĞERLER */}
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 16, padding: '36px 32px', marginBottom: 24 }}>
          <div style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>Değerlerimiz</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {degerler.map(d => (
              <div key={d.baslik}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{d.ikon}</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>{d.baslik}</div>
                <div style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.7 }}>{d.aciklama}</div>
              </div>
            ))}
          </div>
        </div>

        {/* İLETİŞİM */}
        <div style={{ background: '#0d2b1a', border: '1px solid #166534', borderRadius: 16, padding: '32px', marginBottom: 40 }}>
          <div style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>İletişim</div>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Sorularınız veya önerileriniz için bize ulaşın.</div>
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
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Platforma katılın</div>
          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>Binlerce nakliyeci ve yük sahibiyle aynı platformda buluşun.</div>
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
      </div>
    </div>
  );
}
