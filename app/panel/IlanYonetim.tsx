'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

const supabase = createClient();

export default function IlanYonetim({ ilanlar, userId }: { ilanlar: any[]; userId: string }) {
  const [liste, setListe] = useState(ilanlar);
  const [notDuzenle, setNotDuzenle] = useState<string | null>(null);
  const [notText, setNotText] = useState('');
  const [kopyalandi, setKopyalandi] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/u/${userId}`);
  }, [userId]);

  function linkKopyala() {
    navigator.clipboard.writeText(publicUrl);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2000);
  }

  async function tamamlandi(id: string) {
    await supabase.from('listings').update({ completed_at: new Date().toISOString() }).eq('id', id);
    setListe(prev => prev.map(i => i.id === id ? { ...i, completed_at: new Date().toISOString() } : i));
  }

  async function tekrarAktif(id: string) {
    await supabase.from('listings').update({ completed_at: null }).eq('id', id);
    setListe(prev => prev.map(i => i.id === id ? { ...i, completed_at: null } : i));
  }

  async function notKaydet(id: string) {
    await supabase.from('listings').update({ carrier_note: notText }).eq('id', id);
    setListe(prev => prev.map(i => i.id === id ? { ...i, carrier_note: notText } : i));
    setNotDuzenle(null);
  }

  const yirmidortSaatOnce = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const guncel = liste.filter(i => !i.completed_at && new Date(i.created_at) > yirmidortSaatOnce);
  const tamamlananlar = liste.filter(i => i.completed_at);
  const arsiv = liste.filter(i => !i.completed_at && new Date(i.created_at) <= yirmidortSaatOnce);

  return (
    <div>
      {/* Paylaş butonu */}
      <div style={{ background: '#161b22', border: '1px solid #166534', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>📤 İlan listeni paylaş</div>
          <div style={{ color: '#4b5563', fontSize: '0.78rem', fontFamily: 'monospace' }}>
            {publicUrl || `yukegel.com/u/${userId}`}
          </div>
        </div>
        <button onClick={linkKopyala}
          style={{ background: kopyalandi ? '#14532d' : '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {kopyalandi ? '✓ Kopyalandı!' : '🔗 Linki Kopyala'}
        </button>
      </div>

      {/* GÜNCEL */}
      <div style={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>
        GÜNCEL ({guncel.length})
      </div>
      {guncel.length === 0 ? (
        <div style={{ color: '#4b5563', fontSize: '0.82rem', marginBottom: 20, padding: '16px 0' }}>Güncel ilan yok.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {guncel.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onTamamlandi={tamamlandi} onTekrarAktif={tekrarAktif} notDuzenle={notDuzenle} setNotDuzenle={setNotDuzenle} notText={notText} setNotText={setNotText} onNotKaydet={notKaydet} />)}
        </div>
      )}

      {/* TAMAMLANANLAR */}
      {tamamlananlar.length > 0 && (
        <>
          <div style={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>
            TAMAMLANANLAR ({tamamlananlar.length})
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
            {tamamlananlar.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onTamamlandi={tamamlandi} onTekrarAktif={tekrarAktif} notDuzenle={notDuzenle} setNotDuzenle={setNotDuzenle} notText={notText} setNotText={setNotText} onNotKaydet={notKaydet} />)}
          </div>
        </>
      )}

      {/* ARŞİV */}
      {arsiv.length > 0 && (
        <>
          <div style={{ color: '#4b5563', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>
            ARŞİV — 24 SAATTEN ESKİ ({arsiv.length})
          </div>
          <div style={{ display: 'grid', gap: 10, opacity: 0.5 }}>
            {arsiv.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onTamamlandi={tamamlandi} onTekrarAktif={tekrarAktif} notDuzenle={notDuzenle} setNotDuzenle={setNotDuzenle} notText={notText} setNotText={setNotText} onNotKaydet={notKaydet} />)}
          </div>
        </>
      )}
    </div>
  );
}

function IlanKart({ ilan, onTamamlandi, onTekrarAktif, notDuzenle, setNotDuzenle, notText, setNotText, onNotKaydet }: any) {
  const isYuk = ilan.listing_type === 'yuk';
  const tamamlandi = !!ilan.completed_at;
  const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);

  return (
    <div style={{ background: '#161b22', border: `1px solid ${tamamlandi ? '#166534' : '#30363d'}`, borderRadius: 8, padding: '14px 16px', opacity: tamamlandi ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
            </span>
            {tamamlandi && (
              <span style={{ background: '#14532d', color: '#22c55e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                ✅ Araç Bulundu
              </span>
            )}
            <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>
              {new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>K</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{ilan.origin_city}</span>
            {ilan.origin_district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {ilan.origin_district}</span>}
          </div>
          {stops.map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>V</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{s.city}</span>
              {s.district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {s.district}</span>}
            </div>
          ))}

          {notDuzenle === ilan.id ? (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <input value={notText} onChange={e => setNotText(e.target.value)} placeholder="Kısa bir not ekle..."
                style={{ flex: 1, background: '#0d1117', color: '#e2e8f0', border: '1px solid #374151', borderRadius: 6, padding: '6px 10px', fontSize: '0.82rem', outline: 'none' }} autoFocus />
              <button onClick={() => onNotKaydet(ilan.id)}
                style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Kaydet</button>
              <button onClick={() => setNotDuzenle(null)}
                style={{ background: '#1f2937', color: '#8b949e', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', cursor: 'pointer' }}>İptal</button>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {ilan.carrier_note && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>📝 {ilan.carrier_note}</span>}
              <button onClick={() => { setNotDuzenle(ilan.id); setNotText(ilan.carrier_note || ''); }}
                style={{ background: 'none', border: 'none', color: '#4b5563', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                {ilan.carrier_note ? 'Notu düzenle' : '+ Not ekle'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {tamamlandi ? (
            <button onClick={() => onTekrarAktif(ilan.id)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#9ca3af', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ↩ Tekrar Aktif
            </button>
          ) : (
            <button onClick={() => onTamamlandi(ilan.id)}
              style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#14532d', color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✅ Araç Bulundu
            </button>
          )}
          <a href={`/ilan/${ilan.id}`}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #30363d', background: 'none', color: '#6b7280', fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center' }}>
            Detay
          </a>
        </div>
      </div>
    </div>
  );
}
