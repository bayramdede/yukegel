'use client';
import { useState, useTransition } from 'react';
import { ayarKaydet } from './actions';

type Ayar = {
  category: string;
  key: string;
  value: any;
  data_type: string;
  description: string | null;
  updated_at: string | null;
};

export default function AyarSatiri({ ayar }: { ayar: Ayar }) {
  const baslangicDeger = formatla(ayar.value, ayar.data_type);
  const [deger, setDeger] = useState(baslangicDeger);
  const [orijinal] = useState(baslangicDeger);
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [isPending, start] = useTransition();

  const degisti = deger !== orijinal;

  function kaydet() {
    setMesaj(null);
    start(async () => {
      const r = await ayarKaydet(ayar.category, ayar.key, deger, ayar.data_type);
      if (r.ok) {
        setMesaj({ tip: 'ok', metin: '✓ Kaydedildi' });
        setTimeout(() => setMesaj(null), 2500);
      } else {
        setMesaj({ tip: 'hata', metin: r.hata || 'Hata oluştu' });
      }
    });
  }

  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <code style={{ color: '#22c55e', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{ayar.key}</code>
        <span style={{ color: '#4b5563', fontSize: '0.7rem', fontFamily: 'ui-monospace, monospace' }}>{ayar.data_type}</span>
      </div>
      {ayar.description && (
        <div style={{ color: '#8b949e', fontSize: '0.78rem', marginBottom: 10, lineHeight: 1.4 }}>{ayar.description}</div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {ayar.data_type === 'boolean' ? (
          <select value={deger} onChange={e => setDeger(e.target.value)} style={inp}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : ayar.data_type === 'json' ? (
          <textarea value={deger} onChange={e => setDeger(e.target.value)}
            rows={Math.min(8, Math.max(2, deger.split('\n').length))}
            style={{ ...inp, fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', resize: 'vertical' }} />
        ) : (
          <input type={ayar.data_type === 'number' || ayar.data_type === 'integer' ? 'number' : 'text'}
            value={deger} onChange={e => setDeger(e.target.value)} style={inp} />
        )}

        <button onClick={kaydet} disabled={!degisti || isPending}
          style={{
            padding: '0 14px', borderRadius: 6, border: 'none',
            background: degisti && !isPending ? '#22c55e' : '#1f2937',
            color: degisti && !isPending ? '#000' : '#6b7280',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: degisti && !isPending ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}>
          {isPending ? '...' : 'Kaydet'}
        </button>
      </div>

      {mesaj && (
        <div style={{ marginTop: 8, fontSize: '0.78rem', color: mesaj.tip === 'ok' ? '#22c55e' : '#ef4444' }}>
          {mesaj.metin}
        </div>
      )}
    </div>
  );
}

function formatla(value: any, dataType: string): string {
  if (value === null || value === undefined) return '';
  if (dataType === 'json') return JSON.stringify(value, null, 2);
  return String(value);
}

const inp: React.CSSProperties = {
  flex: 1,
  background: '#010409',
  color: '#e2e8f0',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: '0.85rem',
  outline: 'none',
};
