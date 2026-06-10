'use client';

import { useState } from 'react';

const KATEGORILER = [
  { key: 'park_dinlenme',   label: '🅿️ Park & Dinlenme' },
  { key: 'yemek',           label: '🍲 Yemek' },
  { key: 'konaklama',       label: '🛏️ Konaklama' },
  { key: 'tamirci',         label: '🛠️ Tamirci & Usta' },
  { key: 'tesis_akaryakit', label: '⛽ Tesis & Akaryakıt' },
  { key: 'kantar_resmi',    label: '⚖️ Kantar & Resmi' },
];

const ETIKET_ONERILERI = [
  '7/24 Açık', 'Tır Park Yeri Var', 'Güvenlik Kameralı', 'Duş İmkanı',
  'WC', 'Kamyoncu Dostu', 'Sulu Yemek', 'Nöbetçi', 'Çekici',
  'Uygun Fiyat', 'Dorseyi Ayırmaya Gerek Yok',
];

interface Props {
  userLat: number | null;
  userLng: number | null;
  onKapat: () => void;
  onBasarili: () => void;
}

export default function PoiEkleModal({ userLat, userLng, onKapat, onBasarili }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    latitude: userLat?.toFixed(6) || '',
    longitude: userLng?.toFixed(6) || '',
    address: '',
    city: '',
    district: '',
    address_note: '',
    phone: '',
    is_emergency: false,
  });
  const [secilenEtiketler, setSecilenEtiketler] = useState<string[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [adimlar] = useState(0);

  const toggleEtiket = (e: string) => {
    setSecilenEtiketler(prev =>
      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
    );
  };

  const handleGonder = async () => {
    if (!form.name || !form.category || !form.latitude || !form.longitude) {
      setHata('İsim, kategori ve koordinat zorunludur.');
      return;
    }
    setGonderiliyor(true);
    setHata('');
    try {
      const res = await fetch('/api/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          tags: secilenEtiketler,
        }),
      });
      const json = await res.json();
      if (json.success) {
        onBasarili();
      } else {
        setHata(json.error || 'Bir hata oluştu.');
      }
    } catch {
      setHata('Bağlantı hatası.');
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <div
      onClick={onKapat}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1100, display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '92dvh',
          background: '#161b22', borderRadius: '16px 16px 0 0',
          overflowY: 'auto', padding: '0 0 40px',
        }}
      >
        {/* Başlık */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px', borderBottom: '1px solid #21262d',
          position: 'sticky', top: 0, background: '#161b22', zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#e6edf3' }}>
            Yeni Yer Ekle
          </div>
          <button
            onClick={onKapat}
            style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {adimlar === 0 && (
            <div style={{
              background: '#0d1117', borderRadius: 8, padding: 12, marginBottom: 16,
              fontSize: 13, color: '#8b949e', lineHeight: 1.5,
            }}>
              ℹ️ Eklediğiniz konum incelendikten sonra haritada yayınlanacaktır. Teşekkürler!
            </div>
          )}

          {/* İsim */}
          <label style={labelStyle}>İşletme / Konum Adı *</label>
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Örn: Güven Tır Parkı"
            style={inputStyle}
          />

          {/* Kategori */}
          <label style={labelStyle}>Kategori *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {KATEGORILER.map(k => (
              <button
                key={k.key}
                onClick={() => setForm({ ...form, category: k.key })}
                style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 13,
                  border: `1px solid ${form.category === k.key ? '#22c55e' : '#30363d'}`,
                  background: form.category === k.key ? '#14532d' : 'transparent',
                  color: form.category === k.key ? '#22c55e' : '#8b949e',
                  cursor: 'pointer',
                }}
              >
                {k.label}
              </button>
            ))}
          </div>

          {/* Koordinat */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <div>
              <label style={labelStyle}>Enlem (Lat) *</label>
              <input
                value={form.latitude}
                onChange={e => setForm({ ...form, latitude: e.target.value })}
                placeholder="39.9334"
                type="number"
                step="any"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Boylam (Lng) *</label>
              <input
                value={form.longitude}
                onChange={e => setForm({ ...form, longitude: e.target.value })}
                placeholder="32.8597"
                type="number"
                step="any"
                style={inputStyle}
              />
            </div>
          </div>
          {userLat && (
            <button
              onClick={() => setForm({ ...form, latitude: userLat.toFixed(6), longitude: (userLng || 0).toFixed(6) })}
              style={{ fontSize: 12, color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, padding: 0 }}
            >
              📍 Mevcut konumumu kullan
            </button>
          )}

          {/* Şehir + İlçe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Şehir</label>
              <input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="İzmir"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>İlçe</label>
              <input
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                placeholder="Bornova"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Adres */}
          <label style={labelStyle}>Adres</label>
          <input
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Atatürk Cad. No:12"
            style={inputStyle}
          />

          {/* Adres Tarifi */}
          <label style={labelStyle}>Adres Tarifi</label>
          <textarea
            value={form.address_note}
            onChange={e => setForm({ ...form, address_note: e.target.value })}
            placeholder="Örn: Kavşaktan sağa dön, sarı bina..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          {/* Telefon */}
          <label style={labelStyle}>Telefon</label>
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="0555 123 4567"
            type="tel"
            style={inputStyle}
          />

          {/* Açıklama */}
          <label style={labelStyle}>Açıklama</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Kısa bir açıklama..."
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          {/* Özellikler */}
          <label style={labelStyle}>Özellikler</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {ETIKET_ONERILERI.map(e => (
              <button
                key={e}
                onClick={() => toggleEtiket(e)}
                style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 12,
                  border: `1px solid ${secilenEtiketler.includes(e) ? '#22c55e' : '#30363d'}`,
                  background: secilenEtiketler.includes(e) ? '#14532d' : 'transparent',
                  color: secilenEtiketler.includes(e) ? '#22c55e' : '#8b949e',
                  cursor: 'pointer',
                }}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Nöbetçi */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_emergency}
              onChange={e => setForm({ ...form, is_emergency: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: '#ef4444' }}
            />
            <span style={{ fontSize: 13, color: '#8b949e' }}>🔴 Nöbetçi / 7/24 Acil Destek</span>
          </label>

          {hata && (
            <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{hata}</div>
          )}

          <button
            onClick={handleGonder}
            disabled={gonderiliyor}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 10,
              background: '#22c55e', color: '#0d1117',
              border: 'none', fontWeight: 700, fontSize: 15,
              cursor: gonderiliyor ? 'not-allowed' : 'pointer',
              opacity: gonderiliyor ? 0.7 : 1,
            }}
          >
            {gonderiliyor ? 'Gönderiliyor...' : 'İncelemeye Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 6, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0d1117', border: '1px solid #30363d',
  borderRadius: 8, color: '#e6edf3', padding: '10px 12px',
  fontSize: 14, marginBottom: 14, boxSizing: 'border-box',
  fontFamily: "'IBM Plex Sans', sans-serif",
};
