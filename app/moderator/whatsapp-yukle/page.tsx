'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase';
import WhatsappYukle from '../WhatsappYukle';

const supabase = createClient();

// 7 Ağu 2026 — `WhatsappYukle` eskiden `/moderator` sayfasına (1349 satır, ~35
// state) gömülüydü, kendisi hiçbir prop/state PAYLAŞMIYORDU (bkz. bileşenin
// kendi imzası: `WhatsappYukle()`, parametresiz). Yani moderasyon kuyruğuyla
// aynı DOM ağacında yaşamasının tek sebebi tarihseldi ("her yeni özellik o
// dosyaya eklendi"), mimari bir gereklilik değildi. Ayrı bir route'a alındı:
// - Yükleme akışı (dakikalarca sürebilen ZIP açma/bölme/yeniden deneme döngüsü,
//   `WhatsappYukle.tsx`'e bkz.) artık 200 satırlık moderasyon tablosunun aynı
//   React ağacında tutulmuyor.
// - `/moderator`in kendi state karmaşası (35 useState) bu sayfayı etkilemiyor,
//   bu sayfa da onu etkilemiyor.
// Güvenlik: gerçek yetki sınırı zaten sunucuda (`/api/whatsapp-parse`
// `requireStaff()` ile) — buradaki kontrol yalnız UX (yetkisiz kullanıcıya
// formu hiç göstermemek), `/moderator/page.tsx`'teki kontrolün birebir aynısı.
export default function WhatsappYuklePage() {
  const router = useRouter();
  const [yetkiKontrol, setYetkiKontrol] = useState(true);

  useEffect(() => {
    async function kontrol() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/giris?redirect=/moderator/whatsapp-yukle'); return; }
      const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).single();
      const role = (profil as any)?.role;
      if (role !== 'moderator' && role !== 'admin') { router.push('/'); return; }
      setYetkiKontrol(false);
    }
    kontrol();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (yetkiKontrol) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Yükleniyor…
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117' }}>
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
            <span style={{ fontWeight: 800, fontSize: '1rem' }}><span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span></span>
            <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>/ Moderatör / WhatsApp Yükle</span>
          </div>
          <Link href="/moderator" style={{ color: '#60a5fa', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Moderasyona dön
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <WhatsappYukle />
      </div>
    </div>
  );
}
