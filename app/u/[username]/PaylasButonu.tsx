'use client';

export default function PaylasButonu({ isim }: { isim: string }) {
  return (
    <button
        onClick={async () => {
            try {
                if (navigator.share) {
                await navigator.share({ title: isim, url: window.location.href });
                } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Bağlantı kopyalandı!');
                }
            } catch (err) {
                // Kullanıcı vazgeçti, sessizce geç
            }
            }}
      style={{ background: '#1f2937', color: '#8b949e', border: '1px solid #30363d', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
      🔗 Paylaş
    </button>
  );
}