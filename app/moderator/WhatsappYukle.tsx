'use client';
import { useState } from 'react';

export default function WhatsappYukle() {
  const [acik, setAcik] = useState(false);
  const [dosyalar, setDosyalar] = useState<File[]>([]);
  const [grupAdi, setGrupAdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);
  const [saatFiltre, setSaatFiltre] = useState(12);


  async function yukle() {
    if (dosyalar.length === 0) return;
    setYukleniyor(true);
    setSonuc(null);

    const formData = new FormData();
    dosyalar.forEach(f => formData.append('files', f));
    formData.append('group_name', grupAdi || 'Bilinmiyor');
    formData.append('saat_filtre', saatFiltre.toString());

    const res = await fetch('/api/whatsapp-parse', { method: 'POST', body: formData });
    const data = await res.json();
    setSonuc(data);
    setYukleniyor(false);
    if (data.success) setDosyalar([]);
  }

  return (
    <div style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8px 16px' }}>
        <button onClick={() => setAcik(!acik)}
          style={{ background: 'none', border: '1px solid #166534', color: '#22c55e', borderRadius: 6, padding: '5px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
          📱 WhatsApp ZIP Yükle {acik ? '▲' : '▼'}
        </button>

        {acik && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>GRUP ADI</div>
              <input value={grupAdi} onChange={e => setGrupAdi(e.target.value)}
                placeholder="Nakliye TR Grubu"
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', outline: 'none', width: 200 }} />
            </div>

            <div>
            <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>SON KAÇ SAAT</div>
                <select value={saatFiltre} onChange={e => setSaatFiltre(Number(e.target.value))}
                    style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', outline: 'none' }}>
                    <option value={6}>6 saat</option>
                    <option value={12}>12 saat</option>
                    <option value={24}>24 saat</option>
                    <option value={48}>48 saat</option>
                    <option value={72}>72 saat</option>
                    <option value={168}>7 gün</option>
                </select>
            </div>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>ZIP / TXT DOSYALAR (çoklu)</div>
              <input type="file" multiple accept=".zip,.txt"
                    onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setDosyalar(files);
                        if (files.length > 0) {
                            const ad = files[0].name
                            .replace('.zip', '').replace('.txt', '')
                            .replace('WhatsApp Sohbeti - ', '')
                            .replace('WhatsApp Chat - ', '')
                            .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
                            .replace(/[\u200e\u202a\u202c\u200f\u200b]/g, '')
                            .replace(/[^\w\s\-\u00C0-\u024F]/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                            setGrupAdi(ad);
                        }
                    }}
                style={{ color: '#e2e8f0', fontSize: '0.82rem' }} />
            </div>

            <button onClick={yukle} disabled={yukleniyor || dosyalar.length === 0}
              style={{ background: dosyalar.length > 0 ? '#22c55e' : '#1f2937', color: '#000', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
              {yukleniyor ? 'Yükleniyor...' : `Yükle (${dosyalar.length} dosya)`}
            </button>

            {sonuc && (
              <div style={{ background: sonuc.success ? '#0d2b1a' : '#2a0d0d', border: `1px solid ${sonuc.success ? '#166534' : '#7f1d1d'}`, borderRadius: 6, padding: '8px 14px', fontSize: '0.82rem' }}>
                {sonuc.success ? (
                  <span style={{ color: '#22c55e' }}>
                    ✅ {sonuc.total_messages} mesaj → {sonuc.passed_gate} ilan → {sonuc.saved_to_db} kaydedildi
                  </span>
                ) : (
                  <span style={{ color: '#ef4444' }}>⚠️ {sonuc.error}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}