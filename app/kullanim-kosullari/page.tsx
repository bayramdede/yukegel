const GUNCELLEME = '6 Mayıs 2026';

const BOLUMLER = [
  {
    baslik: '1. Taraflar ve Kapsam',
    icerik: `Bu Kullanım Koşulları ("Koşullar"), Yükegel Teknoloji A.Ş. ("Yükegel", "biz") ile platformu kullanan gerçek veya tüzel kişiler ("Kullanıcı", "siz") arasındaki ilişkiyi düzenler.

Platforma üye olarak veya hizmetlerden yararlanarak bu Koşulları kabul etmiş sayılırsınız. Koşulları kabul etmiyorsanız platformu kullanmayınız.`,
  },
  {
    baslik: '2. Platformun Niteliği',
    icerik: `Yükegel, yük sahipleri ile nakliyecileri buluşturan bir ilan platformudur. Yükegel:

• Taşıma sözleşmesinin tarafı değildir.
• Nakliye hizmeti sağlayıcısı değildir.
• Kullanıcılar arasındaki anlaşmazlıklarda taraf değildir.
• Kullanıcılar arasında gerçekleşen taşıma işlemlerinden sorumlu tutulamaz.

Platform yalnızca iletişim ve ilan yayın altyapısı sunar.`,
  },
  {
    baslik: '3. Üyelik ve Hesap',
    icerik: `• Platforma üye olmak için gerçek ve doğru bilgiler sağlamak zorundasınız.
• Her kullanıcı yalnızca bir hesap oluşturabilir.
• Hesabınızın güvenliğinden siz sorumlusunuz. Yetkisiz erişim şüphesinde derhal bildirim yapınız.
• 18 yaşından küçükler platform hizmetlerinden yararlanamaz.
• Yükegel, gerekli gördüğü hallerde herhangi bir gerekçe göstermeksizin üyeliği askıya alma veya sonlandırma hakkını saklı tutar.`,
  },
  {
    baslik: '4. İlan Kuralları',
    icerik: `Kullanıcılar ilan oluştururken aşağıdaki kurallara uymakla yükümlüdür:

• İlan içerikleri gerçek ve doğru olmalıdır.
• Yanıltıcı, sahte veya aldatıcı ilan yayınlanamaz.
• Yasal olmayan yük veya taşıma türlerine ilişkin ilan verilemez.
• Başkalarının iletişim bilgileri izinsiz paylaşılamaz.
• Spam, tekrarlayan veya içeriksiz ilanlar yayınlanamaz.

Kurallara aykırı ilanlar moderasyon süreci sonucunda kaldırılabilir, hesap askıya alınabilir.`,
  },
  {
    baslik: '5. Yasaklı Kullanımlar',
    icerik: `Aşağıdaki kullanımlar kesinlikle yasaktır:

• Platformu dolandırıcılık, sahtecilik veya yanıltma amacıyla kullanmak
• Diğer kullanıcıları taciz etmek, tehdit etmek veya zarar vermek
• Platformun teknik altyapısını bozmaya yönelik girişimlerde bulunmak
• Otomasyon araçları, botlar veya scraper kullanmak
• Rekabete aykırı faaliyetlerde bulunmak
• Üçüncü tarafların fikri mülkiyet haklarını ihlal etmek`,
  },
  {
    baslik: '6. İçerik ve Fikri Mülkiyet',
    icerik: `• Platform tasarımı, yazılımı, logosu ve marka unsurları Yükegel'e aittir.
• Kullanıcılar tarafından oluşturulan ilan içerikleri kullanıcıya aittir; ancak kullanıcı bu içerikleri yayınlamak için Yükegel'e lisans tanır.
• Platform içeriği izinsiz kopyalanamaz, çoğaltılamaz veya dağıtılamaz.`,
  },
  {
    baslik: '7. Sorumluluk Sınırlaması',
    icerik: `• Yükegel, kullanıcılar arasındaki işlemlerden, anlaşmazlıklardan veya kayıplardan sorumlu değildir.
• Platform "olduğu gibi" sunulmaktadır; kesintisiz veya hatasız hizmet garantisi verilmemektedir.
• Yükegel'in herhangi bir nedenle doğabilecek sorumluluğu, ilgili dönemde ödenen üyelik ücreti (varsa) ile sınırlıdır.`,
  },
  {
    baslik: '8. Gizlilik',
    icerik: `Kişisel verilerinizin işlenmesine ilişkin detaylı bilgi için KVKK Aydınlatma Metnimizi inceleyiniz. Platforma üye olarak kişisel verilerinizin Aydınlatma Metni kapsamında işlenmesini kabul etmiş sayılırsınız.`,
  },
  {
    baslik: '9. Değişiklikler',
    icerik: `Yükegel bu Koşulları önceden bildirimde bulunmaksızın değiştirme hakkını saklı tutar. Güncel Koşullar her zaman bu sayfada yayınlanır. Değişiklikler yayınlandıktan sonra platformu kullanmaya devam etmek, güncel Koşulları kabul ettiğiniz anlamına gelir.`,
  },
  {
    baslik: '10. Uygulanacak Hukuk ve Yetki',
    icerik: `Bu Koşullar Türk Hukuku'na tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.`,
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

export default function KullanimKosullari() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <NavBar />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 16px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 14px', marginBottom: 16 }}>
            <span style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700 }}>Yasal Metin</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 2rem)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Kullanım Koşulları
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

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '20px 24px', marginTop: 24 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>📧 İletişim</div>
          <div style={{ color: '#8b949e', fontSize: '0.83rem', lineHeight: 1.7 }}>
            Kullanım Koşulları hakkında sorularınız için{' '}
            <strong style={{ color: '#e2e8f0' }}>merhaba@yukegel.com</strong> adresine ulaşabilirsiniz.
          </div>
        </div>

        <div style={{ marginTop: 32, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a href="/kvkk" style={{ color: '#60a5fa', fontSize: '0.82rem', textDecoration: 'none' }}>
            KVKK Aydınlatma Metni →
          </a>
          <a href="/" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none' }}>
            Ana Sayfa
          </a>
        </div>
      </div>
    </div>
  );
}
