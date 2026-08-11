import type React from 'react';

// Panel'in ortak görsel dili — `PanelClient.tsx` ve `AnlasmalarSekmesi.tsx`
// (ve panele eklenecek sonraki sekmeler) BURADAN içe aktarır.
//
// 🚨 10 Ağu 2026 — bu dosya bir DAİRESEL IMPORT çökmesini düzeltmek için
// açıldı: `PanelClient.tsx` `AnlasmalarSekmesi`'ni içe aktarıyordu,
// `AnlasmalarSekmesi.tsx` da bu sabitleri GERİ `PanelClient.tsx`'ten
// alıyordu. Turbopack modül değerlendirme sırasında `AnlasmalarSekmesi`nin
// modül-seviyesi kodu (`DURUM_RENK` nesnesi `C.surface` kullanıyor) çalıştığı
// an `PanelClient` henüz kendi `const C = {...}` satırına ULAŞMAMIŞTI —
// sonuç: `ReferenceError: Cannot access 'C' before initialization`,
// `/panel` tamamen çöküyordu. `tsc`/`eslint`/`next build` bunu YAKALAMADI
// (tip kontrolü ve derleme sıra-bağımsız; hata yalnız ÇALIŞMA ZAMANINDA,
// tarayıcıda modül sırası kurulurken patlıyor). Ders: bu tür paylaşılan
// sabitler asla bir "kardeş" bileşen dosyasından değil, üçüncü bir ortak
// dosyadan gelmeli — aksi hâlde iki dosya birbirini içe aktarmaya başladığı
// an aynı çökme geri gelir.
export const C = {
  bg: '#0d1117', surface: '#161b22', border: '#30363d',
  text: '#e2e8f0', muted: '#8b949e', dim: '#4b5563',
  green: '#22c55e', greenBg: '#14532d', greenDark: '#0d2b1a',
  blue: '#60a5fa', blueBg: '#1e3a5f',
  red: '#ef4444', redBg: '#7f1d1d',
  amber: '#f59e0b', amberBg: '#451a03',
  purple: '#a78bfa', purpleBg: '#2e1065',
};

export const inp: React.CSSProperties = {
  width: '100%', background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '9px 12px', fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box',
};
export const lbl: React.CSSProperties = {
  color: C.muted, fontSize: '0.72rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
};
export const btn = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber'): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
  fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' as const,
  border: variant === 'secondary' || variant === 'ghost' ? `1px solid ${C.border}` : 'none',
  background:
    variant === 'primary' ? C.green :
    variant === 'danger' ? '#dc2626' :
    variant === 'amber' ? C.amber :
    variant === 'ghost' ? 'none' : C.surface,
  color:
    variant === 'primary' ? '#000' :
    variant === 'danger' ? '#fff' :
    variant === 'amber' ? '#000' :
    C.muted,
});
