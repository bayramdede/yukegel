'use client';
import { useRef, useState, useTransition } from 'react';
import { dosyaYukle } from './actions';

const KABUL: Record<string, string> = {
  logo_url:    '.svg,.png,.jpg,.jpeg',
  favicon_url: '.ico,.png,.svg',
};

const ETIKET: Record<string, string> = {
  logo_url:    'Logo',
  favicon_url: 'Favicon',
};

export default function DosyaYukleButonu({
  configKey,
  mevcutUrl,
}: {
  configKey: string;
  mevcutUrl: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [onizleme, setOnizleme] = useState<string>(mevcutUrl);
  const [mesaj, setMesaj]       = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null);
  const [isPending, start]      = useTransition();

  function dosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Anlık önizleme
    const reader = new FileReader();
    reader.onload = ev => setOnizleme(ev.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('key', configKey);

    setMesaj(null);
    start(async () => {
      const r = await dosyaYukle(fd);
      if (r.ok && r.url) {
        setOnizleme(r.url);
        setMesaj({ tip: 'ok', metin: '✓ Yüklendi ve kaydedildi' });
        setTimeout(() => setMesaj(null), 3000);
      } else {
        setMesaj({ tip: 'hata', metin: r.hata || 'Hata oluştu' });
        setOnizleme(mevcutUrl); // geri al
      }
      // Input'u sıfırla (aynı dosya tekrar seçilebilsin)
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  const isFavicon = configKey === 'favicon_url';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* Önizleme */}
      <div style={{
        width: isFavicon ? 32 : 80,
        height: isFavicon ? 32 : 32,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {onizleme ? (
          <img
            src={onizleme}
            alt={ETIKET[configKey] || configKey}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={() => setOnizleme('')}
          />
        ) : (
          <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>?</span>
        )}
      </div>

      {/* Mevcut URL (readonly) */}
      <div style={{
        flex: 1,
        background: '#010409',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: '0.78rem',
        color: '#6b7280',
        fontFamily: 'ui-monospace, monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {onizleme || '—'}
      </div>

      {/* Gizli input */}
      <input
        ref={inputRef}
        type="file"
        accept={KABUL[configKey] || 'image/*'}
        style={{ display: 'none' }}
        onChange={dosyaSec}
      />

      {/* Yükle butonu */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        style={{
          padding: '8px 14px',
          borderRadius: 6,
          border: '1px solid #30363d',
          background: isPending ? '#1f2937' : '#161b22',
          color: isPending ? '#6b7280' : '#e2e8f0',
          fontWeight: 600,
          fontSize: '0.82rem',
          cursor: isPending ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {isPending ? 'Yükleniyor…' : `${ETIKET[configKey] || 'Dosya'} Yükle`}
      </button>

      {/* Mesaj */}
      {mesaj && (
        <div style={{
          width: '100%',
          fontSize: '0.78rem',
          color: mesaj.tip === 'ok' ? '#22c55e' : '#ef4444',
          marginTop: 2,
        }}>
          {mesaj.metin}
        </div>
      )}
    </div>
  );
}
