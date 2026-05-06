const GUNCELLEME = '6 Mayıs 2026';

const BOLUMLER = [
  {
    baslik: '1. Veri Sorumlusu',
    icerik: `Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında Yükegel Teknoloji A.Ş. ("Yükegel") tarafından hazırlanmıştır.

Veri Sorumlusu: Yükegel Teknoloji A.Ş.
Adres: İstanbul, Türkiye
E-posta: kvkk@yukegel.com`,
  },
  {
    baslik: '2. İşlenen Kişisel Veriler',
    icerik: `Platform kullanımı sırasında aşağıdaki kişisel verileriniz işlenmektedir:

• Kimlik Bilgileri: Ad, soyad, TC Kimlik Numarası, Vergi Kimlik Numarası
• İletişim Bilgileri: Telefon numarası, e-posta adresi
• Araç Bilgileri: Plaka numarası, araç tipi, üst yapı özellikleri
• İşlem Bilgileri: Oluşturulan ilanlar, yorum ve değerlendirmeler
• Teknik Veriler: IP adresi, tarayıcı bilgisi, oturum verileri`,
  },
  {
    baslik: '3. Kişisel Verilerin İşlenme Amaçları',
    icerik: `Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:

• Üyelik ve hesap yönetimi
• İlan oluşturma, yayınlama ve yönetimi
• Kullanıcılar arasında iletişim kolaylaştırma
• Platform güvenliğinin sağlanması ve dolandırıcılığın önlenmesi
• Yasal yükümlülüklerin yerine getirilmesi
• Kullanıcı deneyiminin iyileştirilmesi`,
  },
  {
    baslik: '4. Kişisel Verilerin İşlenme Hukuki Dayanağı',
    icerik: `Kişisel verileriniz KVKK Madde 5 kapsamında aşağıdaki hukuki dayanıklara göre işlenmektedir:

• Sözleşmenin kurulması veya ifası için zorunlu olması
• Hukuki yükümlülüklerimizin yerine getirilmesi
• Meşru menfaatlerimizin korunması
• Açık rızanıza dayalı işleme (rızaya dayalı haller için)`,
  },
  {
    baslik: '5. Kişisel Verilerin Aktarılması',
    icerik: `Kişisel verileriniz aşağıdaki taraflara aktarılabilir:

• Altyapı hizmet sağlayıcıları (sunucu, veritabanı): Supabase Inc. (ABD — SCCs kapsamında)
• SMS doğrulama hizmet sağlayıcısı: Twilio Inc. (ABD — SCCs kapsamında)
• Yetkili kamu kurum ve kuruluşları (yasal zorunluluk halinde)

Yurt dışı aktarımlar, KVKK'nın 9. maddesi kapsamında gerekli güvenceler sağlanarak gerçekleştirilmektedir.`,
  },
  {
    baslik: '6. Kişisel Verilerin Saklanma Süresi',
    icerik: `Kişisel verileriniz:

• Üyelik süresince ve üyelik sonrası yasal saklama yükümlülükleri kapsamında saklanır.
• Vergi ve ticaret hukuku kapsamındaki veriler 5–10 yıl boyunca tutulur.
• Talep edilmesi halinde, yasal zorunluluk bulunmayan veriler silinir veya anonimleştirilir.`,
  },
  {
    baslik: '7. İlgili Kişinin Hakları',
    icerik: `KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:

• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenmişse buna ilişkin bilgi talep etme
• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
• Eksik veya yanlış işlenmiş olması halinde düzeltilmesini talep etme
• Kanun'da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini talep etme
• Otomatik sistemler aracılığıyla aleyhinize bir sonucun ortaya çıkmasına itiraz etme
• Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme

Taleplerinizi kvkk@yukegel.com adresine iletebilirsiniz. Başvurular en geç 30 gün içinde yanıtlanır.`,
  },
  {
    baslik: '8. Çerezler (Cookies)',
    icerik: `Platform, teknik zorunluluk ve oturum yönetimi amacıyla çerez kullanmaktadır. Üçüncü taraf reklam veya izleme çerezleri kullanılmamaktadır. Tarayıcı ayarlarınızdan çerezleri yönetebilirsiniz; ancak bazı işlevler çerez devre dışı bırakıldığında çalışmayabilir.`,
  },
  {
    baslik: '9. Değişiklikler',
    icerik: `Bu aydınlatma metni zaman zaman güncellenebilir. Önemli değişiklikler platform üzerinden duyurulur. Güncel metin her zaman bu sayfada yer alır.`,
  },
];

function NavBar() {
  return (
    <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
          <span style={{ fontWeight: 800, fontSize: '1.2rem', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
          </span>
        </a>
        <a href="/" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>← Ana Sayfa</a>
      </div>
    </nav>
  );
}

export default function Kvkk() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <NavBar />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 16px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>Yasal Metin</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 2rem)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Kişisel Verilerin Korunması<br />Aydınlatma Metni
          </h1>
          <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>
            Son güncelleme: {GUNCELLEME}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {BOLUMLER.map((bolum) => (
            <div key={bolum.baslik} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '24px 28px' }}>
              <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 14px' }}>
                {bolum.baslik}
              </h2>
              <div style={{ color: '#8b949e', fontSize: '0.85rem', lineHeight: 1.85, whiteSpace: 'pre-line' }}>
                {bolum.icerik}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#0d2b1a', border: '1px solid #166534', borderRadius: 10, padding: '20px 24px', marginTop: 24 }}>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>📧 Başvuru & İletişim</div>
          <div style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.7 }}>
            KVKK kapsamındaki taleplerinizi <strong style={{ color: '#e2e8f0' }}>kvkk@yukegel.com</strong> adresine iletebilirsiniz.
            Başvurular kimlik doğrulaması sonrası en geç 30 gün içinde yanıtlanır.
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="/kullanim-kosullari" style={{ color: '#60a5fa', fontSize: '0.82rem', textDecoration: 'none' }}>
            Kullanım Koşulları →
          </a>
          <a href="/" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>
            Ana Sayfa
          </a>
        </div>
      </div>
    </div>
  );
}
