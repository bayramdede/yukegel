'use client';
import { useState } from 'react';

export interface ParsedListingResult {
  listing_type?: 'yuk' | 'arac' | null;
  origin_city?: string | null;
  origin_district?: string | null;
  contact_phone?: string | null;
  vehicle_type?: string | null;
  body_type?: string[] | null;
  price?: number | null;
  available_date?: string | null;
  date_flexible?: boolean | null;
  stops?: Array<{
    city?: string | null;
    district?: string | null;
    weight_ton?: number | null;
    pallet_count?: number | null;
    cargo_type?: string | null;
  }> | null;
  notes?: string | null;
}

interface Props {
  onParsed: (result: ParsedListingResult, rawText: string) => void;
}

const ORNEKLER = [
  `Yarın İstanbul Tuzla'dan Ankara Sincan'a 24 ton tekstil yükümüz var.\nTenteli TIR aranıyor. Pazarlık payı vardır.\n0532 123 45 67`,
  `Boş tırım var, İzmir'de bekliyor.\nİstanbul, Bursa, Kocaeli yönüne yük arıyorum.\nKapalı kasa, 90 m³.\n0533 555 11 22`,
  `Adana → Mersin\n10 palet meyve, frigo, 5 ton\nyarın yüklenecek\n0541 888 77 66`,
];

export default function MetindenIlan({ onParsed }: Props) {
  const [metin, setMetin] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  const ayristir = async () => {
    if (metin.trim().length < 10) {
      setHata('Lütfen daha uzun bir ilan metni girin.');
      return;
    }
    setYukleniyor(true);
    setHata('');
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: metin }),
      });
      const data = await res.json();
      if (!data.success) {
        setHata(data.error || 'Ayrıştırma başarısız oldu.');
      } else {
        onParsed(data.result || {}, metin);
      }
    } catch (err: any) {
      setHata(err?.message || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const ornekKullan = (o: string) => {
    setMetin(o);
    setHata('');
  };

  const az = metin.trim().length < 10;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', margin: '0 0 6px 0' }}>✍️ Metinden İlan</h1>
        <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
          WhatsApp mesajınızı, e-posta içeriğinizi veya kendi yazdığınız ilan metnini yapıştırın.
          Yapay zeka kalkış-varış, araç, tarih ve telefon bilgilerini ayrıştırsın; sonrasında önizlemede
          kontrol edip yayınlayın.
        </p>
      </div>

      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            İlan Metni
          </label>
          <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{metin.length} karakter</span>
        </div>
        <textarea
          value={metin}
          onChange={e => setMetin(e.target.value)}
          rows={9}
          placeholder={`Örnek:\nYarın İstanbul'dan Ankara'ya 24 ton tekstil yükümüz var.\nTenteli TIR aranıyor.\n0532 123 45 67`}
          style={{
            background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d',
            borderRadius: 6, padding: '12px', fontSize: '0.95rem', width: '100%',
            outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: '#6b7280', fontSize: '0.75rem', alignSelf: 'center' }}>Örnek:</span>
            {ORNEKLER.map((o, i) => (
              <button key={i} type="button" onClick={() => ornekKullan(o)}
                style={{ background: '#0d1f1a', border: '1px solid #14532d', color: '#22c55e', borderRadius: 5, padding: '3px 10px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                {i + 1}
              </button>
            ))}
          </div>
          {metin.length > 0 && (
            <button type="button" onClick={() => setMetin('')}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer' }}>
              Temizle
            </button>
          )}
        </div>
      </div>

      {hata && (
        <div style={{ background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {hata}
        </div>
      )}

      <button type="button" onClick={ayristir} disabled={yukleniyor || az}
        style={{
          width: '100%', padding: '14px', borderRadius: 8, border: 'none',
          background: (yukleniyor || az) ? '#166534' : '#22c55e',
          color: '#000', fontWeight: 800, fontSize: '1rem',
          cursor: (yukleniyor || az) ? 'not-allowed' : 'pointer',
          opacity: (yukleniyor || az) ? 0.55 : 1,
          marginBottom: 16,
        }}>
        {yukleniyor ? '🤖 Ayrıştırılıyor…' : '✨ Ayrıştır ve Önizle'}
      </button>

      <div style={{ background: '#0d1f1a', border: '1px solid #14532d', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ color: '#22c55e', fontSize: '0.78rem', fontWeight: 700, marginBottom: 8 }}>💡 Nasıl çalışır?</div>
        <ol style={{ color: '#8b949e', fontSize: '0.82rem', margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>İlan metnini yapıştırın (WhatsApp, e-posta, not vb.).</li>
          <li>Yapay zeka kalkış–varış, araç, tarih, telefon bilgilerini ayrıştırır.</li>
          <li>Önizlemede tüm alanları kontrol edin, gerekirse düzeltin.</li>
          <li>Yayınla butonuyla ilanınızı paylaşın.</li>
        </ol>
      </div>
    </div>
  );
}
