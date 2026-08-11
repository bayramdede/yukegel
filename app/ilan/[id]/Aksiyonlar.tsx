'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SIKAYET_SECENEKLERI = [
  'Yanlış / yanıltıcı bilgi',
  'Sahte ilan / dolandırıcılık',
  'Uygunsuz içerik',
  'Spam / tekrar ilan',
  'Diğer',
];

interface Props {
  ilanId: string;
  dogrulanmamis?: boolean;
  contactPhone?: string | null;
  uyeGiris?: boolean; // Server'dan gelecek
  // Güvenli Etkileşim Faz 2 — "Bu İşi Al" görünürlüğü.
  ilanSahipVar?: boolean;
  isOwner?: boolean;
  // 11 Ağu 2026 — eskiden yalnız `ilanTamamlandi` (completed_at) bakıyordu;
  // bu, `status !== 'active'` olan (ör. mühürlenmiş/iptal-sonrası pasif kalmış)
  // bir ilanda "Bu İşi Al"ı YANLIŞLIKLA göstermeye devam ediyordu — sunucu
  // 409 ile reddederdi ama kullanıcı boşuna tıklardı. Tek, geniş bayrağa
  // (`app/ilan/[id]/page.tsx`'teki `ilanAktif`) taşındı.
  ilanAktif?: boolean;
}

export default function Aksiyonlar({
  ilanId, dogrulanmamis, contactPhone, uyeGiris = false,
  ilanSahipVar = false, isOwner = false, ilanAktif = false,
}: Props) {
  const [sikayetAcik, setSikayetAcik] = useState(false);
  const [secim, setSecim] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [gonderildi, setGonderildi] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  // ── "Bu İşi Al" — GuvenEtkilesim PRD md.2, 1. aşama (POST /api/deals) ──
  const [anlasFormAcik, setAnlasFormAcik] = useState(false);
  const [vade, setVade] = useState('');
  const [anlasYukleniyor, setAnlasYukleniyor] = useState(false);
  const [anlasSonuc, setAnlasSonuc] = useState<{ ok: boolean; mesaj: string } | null>(null);

  async function talepGonder() {
    setAnlasYukleniyor(true);
    setAnlasSonuc(null);
    try {
      const vadeSayi = vade.trim() === '' ? undefined : parseInt(vade, 10);
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: ilanId,
          ...(Number.isInteger(vadeSayi) ? { payment_terms_days: vadeSayi } : {}),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setAnlasSonuc({ ok: true, mesaj: 'Talebiniz gönderildi. İlan sahibi onayladığında anlaşma mühürlenir — sonucu panelinizden takip edebilirsiniz.' });
      } else {
        setAnlasSonuc({ ok: false, mesaj: d.error || 'Talep gönderilemedi.' });
      }
    } catch (e: any) {
      setAnlasSonuc({ ok: false, mesaj: e.message || 'Bir hata oluştu.' });
    }
    setAnlasYukleniyor(false);
  }

  async function paylas() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Yükegel İlanı', url });
      } else {
        await navigator.clipboard.writeText(url);
        setKopyalandi(true);
        setTimeout(() => setKopyalandi(false), 2000);
      }
    } catch { /* vazgeçti */ }
  }

  function sahiplenMesajiAc() {
    const sahiplenLink = `${window.location.origin}/ilan/${ilanId}/sahiplen`;
    const mesaj = encodeURIComponent(
      `Merhaba, ilanınızı Yükegel'de gördüm. Sahiplenip yönetebilirsiniz: ${sahiplenLink}`
    );
    const telefon = contactPhone?.replace(/\D/g, '');
    const waNumara = telefon?.startsWith('90') ? telefon : `90${telefon?.replace(/^0/, '')}`;
    window.open(`https://wa.me/${waNumara}?text=${mesaj}`, '_blank');
  }

  async function sikayetGonder() {
    if (!secim) return;
    const { data } = await supabase
      .from('listings')
      .select('complaints, violation_count')
      .eq('id', ilanId)
      .single();

    const mevcutComplaints = data?.complaints || [];
    await supabase.from('listings').update({
      complaints: [...mevcutComplaints, { neden: secim, aciklama: secim === 'Diğer' ? aciklama : '', tarih: new Date().toISOString() }],
      violation_count: (data?.violation_count || 0) + 1,
    }).eq('id', ilanId);

    setGonderildi(true);
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1f2937' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Paylaş */}
          <button onClick={paylas}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: kopyalandi ? '#14532d' : '#1f2937', border: `1px solid ${kopyalandi ? '#166534' : '#374151'}`, color: kopyalandi ? '#22c55e' : '#9ca3af', borderRadius: 8, padding: '9px 18px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {kopyalandi ? <><span>✅</span> Kopyalandı</> : <><span style={{ fontSize: '1rem' }}>↗</span> Paylaş</>}
          </button>

          {/* İlan Sahibine Bildir — server'dan gelen uyeGiris prop'u ile */}
          {uyeGiris && dogrulanmamis && contactPhone && (
            <button onClick={sahiplenMesajiAc}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a2a1a', border: '1px solid #166534', color: '#4ade80', borderRadius: 8, padding: '9px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              <span>💬</span> İlan Sahibine Bildir
            </button>
          )}

          {/* Bu İşi Al — Güvenli Etkileşim Faz 2. Yalnız: giriş yapılmış, ilanın
              sahibi sen değilsin, ilanın gerçek bir sahibi var (sahipsiz ilanda
              taraf yok) ve ilan AKTİF (bkz. `ilanAktif` tanımı — completed_at,
              status, moderation_status'un hepsini kapsar). Kalan kural sunucuda. */}
          {uyeGiris && !isOwner && ilanSahipVar && ilanAktif && !anlasSonuc?.ok && (
            <button onClick={() => setAnlasFormAcik(a => !a)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: anlasFormAcik ? '#0d2b1a' : '#14532d', border: '1px solid #22c55e', color: '#4ade80', borderRadius: 8, padding: '9px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
              <span>🤝</span> Bu İşi Al
            </button>
          )}
        </div>

        {/* Şikayet */}
        {!gonderildi ? (
          <button onClick={() => setSikayetAcik(!sikayetAcik)}
            style={{ background: 'none', border: 'none', color: sikayetAcik ? '#ef4444' : '#4b5563', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', transition: 'color 0.15s' }}>
            <span>⚑</span> Şikayet Et
          </button>
        ) : (
          <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>✓ Şikayet alındı</span>
        )}
      </div>

      {/* Bu İşi Al — talep formu */}
      {anlasFormAcik && !anlasSonuc?.ok && (
        <div style={{ marginTop: 12, background: '#0d1117', border: '1px solid #166534', borderRadius: 10, padding: 20 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', marginBottom: 6 }}>
            Bu iş için talep gönder
          </div>
          <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 14 }}>
            Talebiniz ilan sahibine gider. Onayladığı an anlaşma mühürlenir ve iş süreci başlar.
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 }}>
              Ödeme Vadesi (gün, opsiyonel)
            </label>
            <input type="number" min={0} max={180} value={vade}
              onChange={e => setVade(e.target.value)} placeholder="Örn. 30"
              style={{ width: 160, background: '#161b22', color: '#e2e8f0', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          {anlasSonuc && !anlasSonuc.ok && (
            <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {anlasSonuc.mesaj}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={talepGonder} disabled={anlasYukleniyor}
              style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: anlasYukleniyor ? 'default' : 'pointer', opacity: anlasYukleniyor ? 0.6 : 1 }}>
              {anlasYukleniyor ? 'Gönderiliyor...' : 'Talep Gönder'}
            </button>
            <button onClick={() => { setAnlasFormAcik(false); setAnlasSonuc(null); }}
              style={{ background: 'none', border: '1px solid #374151', color: '#6b7280', borderRadius: 6, padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        </div>
      )}
      {anlasSonuc?.ok && (
        <div style={{ marginTop: 12, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 10, padding: '14px 20px', color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>
          ✅ {anlasSonuc.mesaj}
        </div>
      )}

      {/* Şikayet formu */}
      {sikayetAcik && !gonderildi && (
        <div style={{ marginTop: 12, background: '#0d1117', border: '1px solid #374151', borderRadius: 10, padding: 20 }}>
          <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', marginBottom: 14 }}>
            Bu ilanı neden şikayet ediyorsunuz?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {SIKAYET_SECENEKLERI.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, background: secim === s ? '#1a1a2e' : 'transparent', border: `1px solid ${secim === s ? '#4f46e5' : '#1f2937'}`, transition: 'all 0.15s' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${secim === s ? '#4f46e5' : '#374151'}`, background: secim === s ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {secim === s && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <input type="radio" name="sikayet" value={s} checked={secim === s} onChange={() => setSecim(s)} style={{ display: 'none' }} />
                <span style={{ color: secim === s ? '#e2e8f0' : '#9ca3af', fontSize: '0.88rem' }}>{s}</span>
              </label>
            ))}
          </div>
          {secim === 'Diğer' && (
            <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Açıklamanızı yazın..." rows={3}
              style={{ width: '100%', background: '#161b22', color: '#e2e8f0', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', fontSize: '0.85rem', outline: 'none', resize: 'none', marginBottom: 12, boxSizing: 'border-box' as const }} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={sikayetGonder} disabled={!secim}
              style={{ background: secim ? '#dc2626' : '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: secim ? 'pointer' : 'not-allowed' }}>
              Gönder
            </button>
            <button onClick={() => { setSikayetAcik(false); setSecim(''); setAciklama(''); }}
              style={{ background: 'none', border: '1px solid #374151', color: '#6b7280', borderRadius: 6, padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
