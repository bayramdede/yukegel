'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

const supabase = createClient();

const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ background: bg, color, fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

interface Stop { id?: string; stop_order: number; city: string; district: string; cargo_type: string; weight_ton: string; pallet_count: string; vehicle_count: string; }

export default function IlanYonetim({ ilanlar, userId }: { ilanlar: any[]; userId: string }) {
  const [liste, setListe] = useState(ilanlar);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  useEffect(() => { setPublicUrl(`${window.location.origin}/u/${userId}`); }, [userId]);

  function linkKopyala() {
    navigator.clipboard.writeText(publicUrl);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2000);
  }

  function guncelle(id: string, patch: Partial<any>) {
    setListe(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  const yirmidortSaatOnce = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const guncel = liste.filter(i => !i.completed_at && new Date(i.created_at) > yirmidortSaatOnce);
  const tamamlananlar = liste.filter(i => i.completed_at);
  const arsiv = liste.filter(i => !i.completed_at && new Date(i.created_at) <= yirmidortSaatOnce);

  return (
    <div>
      <div style={{ background: '#161b22', border: '1px solid #166534', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>📤 İlan listeni paylaş</div>
          <div style={{ color: '#4b5563', fontSize: '0.78rem', fontFamily: 'monospace' }}>{publicUrl || `yukegel.com/u/${userId}`}</div>
        </div>
        <button onClick={linkKopyala}
          style={{ background: kopyalandi ? '#14532d' : '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '8px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {kopyalandi ? '✓ Kopyalandı!' : '🔗 Linki Kopyala'}
        </button>
      </div>

      <Bolum baslik={`GÜNCEL (${guncel.length})`} renk="#8b949e">
        {guncel.length === 0
          ? <div style={{ color: '#4b5563', fontSize: '0.82rem', padding: '16px 0' }}>Güncel ilan yok.</div>
          : guncel.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onGuncelle={guncelle} />)}
      </Bolum>

      {tamamlananlar.length > 0 && (
        <Bolum baslik={`TAMAMLANANLAR (${tamamlananlar.length})`} renk="#8b949e">
          {tamamlananlar.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onGuncelle={guncelle} />)}
        </Bolum>
      )}

      {arsiv.length > 0 && (
        <Bolum baslik={`ARŞİV — 24 SAATTEN ESKİ (${arsiv.length})`} renk="#4b5563" soluk>
          {arsiv.map(ilan => <IlanKart key={ilan.id} ilan={ilan} onGuncelle={guncelle} />)}
        </Bolum>
      )}
    </div>
  );
}

function Bolum({ baslik, renk, soluk, children }: { baslik: string; renk: string; soluk?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28, opacity: soluk ? 0.55 : 1 }}>
      <div style={{ color: renk, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>{baslik}</div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </div>
  );
}

function IlanKart({ ilan, onGuncelle }: { ilan: any; onGuncelle: (id: string, patch: any) => void }) {
  const [duzenle, setDuzenle] = useState(false);
  const isYuk = ilan.listing_type === 'yuk';
  const tamamlandi = !!ilan.completed_at;
  const stops = [...(ilan.listing_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
  const ilkStop = stops[0];

  async function tamamlandiToggle() {
    const val = tamamlandi ? null : new Date().toISOString();
    await supabase.from('listings').update({ completed_at: val }).eq('id', ilan.id);
    onGuncelle(ilan.id, { completed_at: val });
  }

  return (
    <div style={{ background: '#161b22', border: `1px solid ${tamamlandi ? '#166534' : duzenle ? '#22c55e' : '#30363d'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      {/* Kart başlığı */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Etiketler */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
              </span>
              {tamamlandi && <span style={{ background: '#14532d', color: '#22c55e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✅ Araç Bulundu</span>}
              {ilan.price_offer && <span style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✓ Fiyat Belli</span>}
              <span style={{ color: '#4b5563', fontSize: '0.7rem', marginLeft: 2 }}>
                {new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Güzergah */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>K</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{ilan.origin_city}</span>
              {ilan.origin_district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {ilan.origin_district}</span>}
            </div>
            {stops.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>V</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{s.city}</span>
                {s.district && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {s.district}</span>}
                {s.vehicle_count > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem', marginLeft: 4 }}>{s.vehicle_count} araç</span>}
              </div>
            ))}

            {/* Chip'ler */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {(ilan.vehicle_type || []).map((t: string) => <Chip key={t} label={'🚛 ' + t} bg='#1a2535' color='#60a5fa' />)}
              {(ilan.body_type || []).map((u: string) => <Chip key={u} label={u} bg='#1f2937' color='#94a3b8' />)}
              {ilkStop?.weight_ton && <Chip label={'⚖ ' + ilkStop.weight_ton + ' ton'} bg='#1a2a1a' color='#86efac' />}
              {ilkStop?.pallet_count && <Chip label={'📦 ' + ilkStop.pallet_count + ' palet'} bg='#1a2a1a' color='#86efac' />}
              {ilan.available_date && <Chip label={'📅 ' + new Date(ilan.available_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (ilan.date_flexible ? ' ±' : '')} bg='#1f2937' color='#94a3b8' />}
            </div>
          </div>

          {/* Sağ panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
            {ilan.price_offer && (
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', marginBottom: 2 }}>
                ₺{Number(ilan.price_offer).toLocaleString('tr-TR')}
              </div>
            )}
            {tamamlandi ? (
              <button onClick={tamamlandiToggle}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#9ca3af', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ↩ Tekrar Aktif
              </button>
            ) : (
              <button onClick={tamamlandiToggle}
                style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#14532d', color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✅ Araç Bulundu
              </button>
            )}
            <button onClick={() => setDuzenle(d => !d)}
              style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${duzenle ? '#22c55e' : '#374151'}`, background: duzenle ? '#14532d' : 'none', color: duzenle ? '#22c55e' : '#6b7280', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✏️ Düzenle
            </button>
            <a href={`/ilan/${ilan.id}`}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #30363d', color: '#6b7280', fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center' }}>
              Detay
            </a>
          </div>
        </div>
      </div>

      {/* Düzenleme formu */}
      {duzenle && (
        <DuzenleFormu
          ilan={ilan}
          stops={stops}
          onKaydet={(patch, yeniStops) => {
            onGuncelle(ilan.id, { ...patch, listing_stops: yeniStops });
            setDuzenle(false);
          }}
          onIptal={() => setDuzenle(false)}
        />
      )}
    </div>
  );
}

function DuzenleFormu({ ilan, stops, onKaydet, onIptal }: {
  ilan: any;
  stops: any[];
  onKaydet: (patch: any, yeniStops: any[]) => void;
  onIptal: () => void;
}) {
  const [kalkisSehir, setKalkisSehir] = useState(ilan.origin_city || '');
  const [kalkisIlce, setKalkisIlce] = useState(ilan.origin_district || '');
  const [duraklar, setDuraklar] = useState<Stop[]>(
    stops.length > 0
      ? stops.map(s => ({ id: s.id, stop_order: s.stop_order, city: s.city || '', district: s.district || '', cargo_type: s.cargo_type || '', weight_ton: s.weight_ton?.toString() || '', pallet_count: s.pallet_count?.toString() || '', vehicle_count: s.vehicle_count?.toString() || '' }))
      : [{ stop_order: 1, city: '', district: '', cargo_type: '', weight_ton: '', pallet_count: '', vehicle_count: '' }]
  );
  const [aracTipleri, setAracTipleri] = useState<string[]>(ilan.vehicle_type || []);
  const [ustyapi, setUstyapi] = useState<string[]>(ilan.body_type || []);
  const [tarih, setTarih] = useState(ilan.available_date || '');
  const [tarihEsnek, setTarihEsnek] = useState(!!ilan.date_flexible);
  const [fiyat, setFiyat] = useState(ilan.price_offer?.toString() || '');
  const [fiyatMuzakere, setFiyatMuzakere] = useState(!!ilan.price_negotiable);
  const [telefon, setTelefon] = useState(ilan.contact_phone || '');
  const [notlar, setNotlar] = useState(ilan.notes || '');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  function durakGuncelle(idx: number, field: keyof Stop, val: string) {
    setDuraklar(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  }

  function durakEkle() {
    setDuraklar(prev => [...prev, { stop_order: prev.length + 1, city: '', district: '', cargo_type: '', weight_ton: '', pallet_count: '', vehicle_count: '' }]);
  }

  function durakSil(idx: number) {
    setDuraklar(prev => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, stop_order: i + 1 })));
  }

  function toggleAracTipi(t: string) {
    setAracTipleri(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function toggleUstyapi(u: string) {
    setUstyapi(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  }

  async function kaydet() {
    if (!kalkisSehir.trim()) { setHata('Kalkış şehri gerekli.'); return; }
    if (duraklar.some(d => !d.city.trim())) { setHata('Tüm varış şehirlerini doldurun.'); return; }
    setYukleniyor(true); setHata('');

    const patch = {
      origin_city: kalkisSehir.trim(),
      origin_district: kalkisIlce.trim() || null,
      vehicle_type: aracTipleri,
      body_type: ustyapi,
      available_date: tarih || null,
      date_flexible: tarihEsnek,
      price_offer: fiyat ? Number(fiyat) : null,
      price_negotiable: fiyatMuzakere,
      contact_phone: telefon.trim() || null,
      notes: notlar.trim() || null,
    };

    const { error } = await supabase.from('listings').update(patch).eq('id', ilan.id);
    if (error) { setHata('Kayıt hatası: ' + error.message); setYukleniyor(false); return; }

    // Durakları sil + yeniden ekle
    await supabase.from('listing_stops').delete().eq('listing_id', ilan.id);
    const yeniStoplar = duraklar.map((d, i) => ({
      listing_id: ilan.id,
      stop_order: i + 1,
      city: d.city.trim(),
      district: d.district.trim() || null,
      cargo_type: d.cargo_type.trim() || null,
      weight_ton: d.weight_ton ? Number(d.weight_ton) : null,
      pallet_count: d.pallet_count ? Number(d.pallet_count) : null,
      vehicle_count: d.vehicle_count ? Number(d.vehicle_count) : null,
    }));
    const { data: insertedStops } = await supabase.from('listing_stops').insert(yeniStoplar).select();

    onKaydet(patch, insertedStops || yeniStoplar);
    setYukleniyor(false);
  }

  const inp: React.CSSProperties = { width: '100%', background: '#0d1117', color: '#e2e8f0', border: '1px solid #374151', borderRadius: 6, padding: '8px 10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { color: '#6b7280', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 5 };

  return (
    <div style={{ borderTop: '1px solid #22c55e', background: '#0d1117', padding: '20px 16px' }}>
      <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', marginBottom: 16 }}>✏️ İlanı Düzenle</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={lbl}>Kalkış Şehri *</label>
          <input value={kalkisSehir} onChange={e => setKalkisSehir(e.target.value)} placeholder="İstanbul" style={inp} />
        </div>
        <div>
          <label style={lbl}>Kalkış İlçesi</label>
          <input value={kalkisIlce} onChange={e => setKalkisIlce(e.target.value)} placeholder="Pendik" style={inp} />
        </div>
      </div>

      {/* Varış durakları */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Varış Durakları *</label>
        {duraklar.map((d, i) => (
          <div key={i} style={{ background: '#161b22', border: '1px solid #1f2937', borderRadius: 8, padding: '12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#f97316', fontSize: '0.72rem', fontWeight: 700 }}>DURAK {i + 1}</span>
              {duraklar.length > 1 && (
                <button type="button" onClick={() => durakSil(i)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                  × Sil
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input value={d.city} onChange={e => durakGuncelle(i, 'city', e.target.value)} placeholder="Şehir *" style={inp} />
              <input value={d.district} onChange={e => durakGuncelle(i, 'district', e.target.value)} placeholder="İlçe" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input value={d.weight_ton} onChange={e => durakGuncelle(i, 'weight_ton', e.target.value)} placeholder="Ton" type="number" min="0" style={inp} />
              <input value={d.pallet_count} onChange={e => durakGuncelle(i, 'pallet_count', e.target.value)} placeholder="Palet" type="number" min="0" style={inp} />
              <input value={d.cargo_type} onChange={e => durakGuncelle(i, 'cargo_type', e.target.value)} placeholder="Yük tipi" style={inp} />
            </div>
          </div>
        ))}
        <button type="button" onClick={durakEkle}
          style={{ background: 'none', border: '1px dashed #374151', color: '#6b7280', borderRadius: 6, padding: '7px 14px', fontSize: '0.8rem', cursor: 'pointer', width: '100%' }}>
          + Durak Ekle
        </button>
      </div>

      {/* Araç tipi */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Araç Tipi</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ARAC_TIPLERI.map(t => (
            <button key={t} type="button" onClick={() => toggleAracTipi(t)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.8rem', cursor: 'pointer', borderColor: aracTipleri.includes(t) ? '#3b82f6' : '#374151', background: aracTipleri.includes(t) ? '#1a2a4a' : '#161b22', color: aracTipleri.includes(t) ? '#60a5fa' : '#8b949e', fontWeight: aracTipleri.includes(t) ? 700 : 400 }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Üst yapı */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Üst Yapı</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {UTSYAPI.map(u => (
            <button key={u} type="button" onClick={() => toggleUstyapi(u)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.78rem', cursor: 'pointer', borderColor: ustyapi.includes(u) ? '#374151' : '#374151', background: ustyapi.includes(u) ? '#1f2937' : '#161b22', color: ustyapi.includes(u) ? '#94a3b8' : '#6b7280', fontWeight: ustyapi.includes(u) ? 700 : 400 }}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Tarih + Fiyat */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Yükleme Tarihi</label>
          <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} style={inp} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={tarihEsnek} onChange={e => setTarihEsnek(e.target.checked)} />
            <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>Tarih esnek</span>
          </label>
        </div>
        <div>
          <label style={lbl}>Fiyat (₺)</label>
          <input type="number" value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="Fiyat teklifi" min="0" style={inp} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={fiyatMuzakere} onChange={e => setFiyatMuzakere(e.target.checked)} />
            <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>Müzakereye açık</span>
          </label>
        </div>
      </div>

      {/* Telefon + Notlar */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>İletişim Telefonu</label>
        <input value={telefon} onChange={e => setTelefon(e.target.value)} placeholder="05xx xxx xx xx" style={inp} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Notlar</label>
        <textarea value={notlar} onChange={e => setNotlar(e.target.value)} placeholder="Ek bilgi, özel istek..." rows={2}
          style={{ ...inp, resize: 'vertical' }} />
      </div>

      {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={kaydet} disabled={yukleniyor}
          style={{ flex: 1, background: yukleniyor ? '#166534' : '#22c55e', color: '#000', border: 'none', borderRadius: 7, padding: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
          {yukleniyor ? 'Kaydediliyor...' : '✓ Kaydet'}
        </button>
        <button onClick={onIptal}
          style={{ background: 'none', border: '1px solid #374151', color: '#6b7280', borderRadius: 7, padding: '10px 20px', fontSize: '0.85rem', cursor: 'pointer' }}>
          İptal
        </button>
      </div>
    </div>
  );
}
