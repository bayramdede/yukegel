'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SEKMELER, SEKME_ETIKET, tarihFormat, kullaniciEtiket, kullaniciAramayaUyar, ilanOzeti,
  type Sekme, type AuthEventSatir, type SearchQuerySatir, type ListingViewSatir, type AdminActionSatir,
} from '../../../lib/loglar-format';

const td: React.CSSProperties = {
  padding: '9px 12px', borderBottom: '1px solid #21262d', color: '#e2e8f0',
  fontSize: '0.8rem', verticalAlign: 'middle', whiteSpace: 'nowrap',
};
const th: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', color: '#8b949e', fontSize: '0.7rem',
  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  borderBottom: '1px solid #30363d', whiteSpace: 'nowrap',
};

const EVENT_RENK: Record<string, string> = {
  login_success: '#86efac', login_failed: '#fca5a5', otp_failed: '#fca5a5',
  otp_sent: '#94a3b8', kayit_tamamlandi: '#86efac', kayit_basarisiz: '#fca5a5',
  cikis: '#6b7280',
};

// ── Tarih yardımcıları — LOKAL tarih (UTC değil), admin'in gördüğü "bugün"
// tarayıcının saat dilimiyle eşleşsin diye.
function ymd(d: Date): string {
  const yil = d.getFullYear();
  const ay = String(d.getMonth() + 1).padStart(2, '0');
  const gun = String(d.getDate()).padStart(2, '0');
  return `${yil}-${ay}-${gun}`;
}
function gunOnce(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const HAZIR_ARALIKLAR: { etiket: string; bas: () => string; son: () => string }[] = [
  { etiket: 'Bugün', bas: () => ymd(new Date()), son: () => ymd(new Date()) },
  { etiket: 'Son 7 Gün', bas: () => ymd(gunOnce(6)), son: () => ymd(new Date()) },
  { etiket: 'Son 30 Gün', bas: () => ymd(gunOnce(29)), son: () => ymd(new Date()) },
  { etiket: 'Tümü', bas: () => '', son: () => '' },
];

export default function LoglarClient({
  authEvents, searchQueries, listingViews, adminActions, satirLimit, bas, son,
}: {
  authEvents: AuthEventSatir[];
  searchQueries: SearchQuerySatir[];
  listingViews: ListingViewSatir[];
  adminActions: AdminActionSatir[];
  satirLimit: number;
  bas: string;
  son: string;
}) {
  const router = useRouter();
  const [sekme, setSekme] = useState<Sekme>('auth');
  const [arama, setArama] = useState('');
  const q = arama.trim().toLowerCase();

  // Tarih girdileri: URL zaten kaynak — yerel state yalnız input'un ANLIK
  // değerini tutuyor, "Uygula"ya kadar URL'e (dolayısıyla sunucu sorgusuna)
  // dokunmuyor. Hazır aralık butonları direkt URL'i günceller.
  const [basTaslak, setBasTaslak] = useState(bas);
  const [sonTaslak, setSonTaslak] = useState(son);

  function aralikUygula(yeniBas: string, yeniSon: string) {
    const params = new URLSearchParams();
    if (yeniBas) params.set('bas', yeniBas);
    if (yeniSon) params.set('son', yeniSon);
    const qs = params.toString();
    router.push(qs ? `/admin/loglar?${qs}` : '/admin/loglar');
  }

  const authFiltreli = useMemo(() => authEvents.filter(r => kullaniciAramayaUyar(r.kullanici, q)), [authEvents, q]);
  const searchFiltreli = useMemo(() => searchQueries.filter(r => kullaniciAramayaUyar(r.kullanici, q)), [searchQueries, q]);
  const viewFiltreli = useMemo(() => listingViews.filter(r => kullaniciAramayaUyar(r.kullanici, q)), [listingViews, q]);
  const adminFiltreli = useMemo(
    () => adminActions.filter(r => kullaniciAramayaUyar(r.aktor, q) || kullaniciAramayaUyar(r.hedef, q)),
    [adminActions, q]
  );

  const sayilar: Record<Sekme, number> = {
    auth: authFiltreli.length, search: searchFiltreli.length,
    view: viewFiltreli.length, admin: adminFiltreli.length,
  };
  const yukluSayilar: Record<Sekme, number> = {
    auth: authEvents.length, search: searchQueries.length,
    view: listingViews.length, admin: adminActions.length,
  };

  const aktifHazirAralik = HAZIR_ARALIKLAR.find(h => h.bas() === bas && h.son() === son)?.etiket
    ?? (!bas && !son ? 'Tümü' : null);

  const exportHref = `/api/admin/loglar/export?sekme=${sekme}&bas=${encodeURIComponent(bas)}&son=${encodeURIComponent(son)}&q=${encodeURIComponent(arama.trim())}`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SEKMELER.map(s => (
          <button
            key={s}
            onClick={() => setSekme(s)}
            style={{
              background: sekme === s ? '#1c2d1e' : '#161b22',
              color: sekme === s ? '#86efac' : '#8b949e',
              border: `1px solid ${sekme === s ? '#22c55e' : '#30363d'}`,
              borderRadius: 8, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {SEKME_ETIKET[s]} <span style={{ opacity: 0.6 }}>({sayilar[s]})</span>
          </button>
        ))}
      </div>

      {/* ── Zaman filtresi ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12,
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 12px',
      }}>
        <span style={{ color: '#4b5563', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📅 Aralık:
        </span>
        {HAZIR_ARALIKLAR.map(h => (
          <button
            key={h.etiket}
            onClick={() => { setBasTaslak(h.bas()); setSonTaslak(h.son()); aralikUygula(h.bas(), h.son()); }}
            style={{
              background: aktifHazirAralik === h.etiket ? '#1e3a5f' : '#0d1117',
              color: aktifHazirAralik === h.etiket ? '#93c5fd' : '#8b949e',
              border: `1px solid ${aktifHazirAralik === h.etiket ? '#3b82f6' : '#30363d'}`,
              borderRadius: 6, padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {h.etiket}
          </button>
        ))}
        <span style={{ color: '#30363d' }}>|</span>
        <input
          type="date" value={basTaslak} onChange={e => setBasTaslak(e.target.value)}
          style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 8px', fontSize: '0.78rem' }}
        />
        <span style={{ color: '#4b5563', fontSize: '0.78rem' }}>—</span>
        <input
          type="date" value={sonTaslak} onChange={e => setSonTaslak(e.target.value)}
          style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 8px', fontSize: '0.78rem' }}
        />
        <button
          onClick={() => aralikUygula(basTaslak, sonTaslak)}
          style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Uygula
        </button>
        {(bas || son) && (
          <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>
            {yukluSayilar[sekme]} kayıt yüklendi{yukluSayilar[sekme] >= satirLimit ? ` (tavan ${satirLimit} — daha fazlası için CSV'ye aktarın)` : ''}
          </span>
        )}

        <a
          href={exportHref}
          style={{
            marginLeft: 'auto', background: '#161b22', color: '#86efac',
            border: '1px solid #22c55e', borderRadius: 6, padding: '5px 12px',
            fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          ⬇️ CSV&apos;ye Aktar
        </a>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={arama}
          onChange={e => setArama(e.target.value)}
          placeholder="🔍  Kullanıcı adı, e-posta veya telefonla filtrele..."
          style={{
            width: '100%', maxWidth: 360, background: '#0d1117', color: '#e2e8f0',
            border: '1px solid #30363d', borderRadius: 6, padding: '8px 12px',
            fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #30363d' }}>
        {sekme === 'auth' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#161b22' }}>
            <thead>
              <tr>
                <th style={th}>Zaman</th><th style={th}>Olay</th><th style={th}>Yöntem</th>
                <th style={th}>Kullanıcı</th><th style={th}>Sebep</th><th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {authFiltreli.map(r => (
                <tr key={r.id}>
                  <td style={td}>{tarihFormat(r.created_at)}</td>
                  <td style={{ ...td, color: EVENT_RENK[r.event] ?? '#e2e8f0', fontWeight: 600 }}>{r.event}</td>
                  <td style={td}>{r.method}</td>
                  <td style={td}>{kullaniciEtiket(r.kullanici)}</td>
                  <td style={{ ...td, whiteSpace: 'normal', maxWidth: 260, color: '#8b949e' }}>{r.reason || '—'}</td>
                  <td style={{ ...td, color: '#6b7280', fontFamily: 'monospace' }}>{r.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sekme === 'search' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#161b22' }}>
            <thead>
              <tr>
                <th style={th}>Zaman</th><th style={th}>Kaynak</th><th style={th}>Kalkış</th>
                <th style={th}>Varış</th><th style={th}>Tip</th><th style={th}>Sonuç</th>
                <th style={th}>Kullanıcı</th><th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {searchFiltreli.map(r => (
                <tr key={r.id}>
                  <td style={td}>{tarihFormat(r.created_at)}</td>
                  <td style={td}>{r.kaynak === 'yakin_konum' ? '📍 Yakın konum' : '🔍 İl filtre'}</td>
                  <td style={td}>{r.kalkis_il_adi || <span style={{ color: '#374151' }}>—</span>}</td>
                  <td style={td}>{r.varis_il_adi || <span style={{ color: '#374151' }}>—</span>}</td>
                  <td style={td}>{r.tip || <span style={{ color: '#374151' }}>—</span>}</td>
                  <td style={{ ...td, color: r.sonuc_sayisi === 0 ? '#fca5a5' : '#86efac', fontWeight: 600 }}>{r.sonuc_sayisi ?? '—'}</td>
                  <td style={td}>{kullaniciEtiket(r.kullanici)}</td>
                  <td style={{ ...td, color: '#6b7280', fontFamily: 'monospace' }}>{r.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sekme === 'view' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#161b22' }}>
            <thead>
              <tr>
                <th style={th}>Zaman</th><th style={th}>İlan</th><th style={th}>Görüntüleyen</th><th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {viewFiltreli.map(r => (
                <tr key={r.id}>
                  <td style={td}>{tarihFormat(r.created_at)}</td>
                  <td style={{ ...td, whiteSpace: 'normal', maxWidth: 320 }}>
                    {r.ilan?.listing_type && (
                      <span style={{
                        background: r.ilan.listing_type === 'yuk' ? '#1e293b' : '#1c2d1e',
                        color: r.ilan.listing_type === 'yuk' ? '#94a3b8' : '#86efac',
                        fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, marginRight: 6,
                      }}>
                        {r.ilan.listing_type === 'yuk' ? 'YÜK' : 'ARAÇ'}
                      </span>
                    )}
                    <a href={`/ilan/${r.listing_id}`} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none' }}>
                      {r.ilan ? ilanOzeti(r.ilan) : r.listing_id.slice(0, 8) + '…'}
                    </a>
                  </td>
                  <td style={td}>{kullaniciEtiket(r.kullanici)}</td>
                  <td style={{ ...td, color: '#6b7280', fontFamily: 'monospace' }}>{r.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sekme === 'admin' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#161b22' }}>
            <thead>
              <tr>
                <th style={th}>Zaman</th><th style={th}>Yapan</th><th style={th}>Kime</th>
                <th style={th}>Alan</th><th style={th}>Eski</th><th style={th}>Yeni</th>
              </tr>
            </thead>
            <tbody>
              {adminFiltreli.map(r => (
                <tr key={r.id}>
                  <td style={td}>{tarihFormat(r.created_at)}</td>
                  <td style={td}>{kullaniciEtiket(r.aktor)}</td>
                  <td style={td}>{kullaniciEtiket(r.hedef)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.alan}</td>
                  <td style={{ ...td, color: '#8b949e', fontFamily: 'monospace', fontSize: '0.72rem' }}>{JSON.stringify(r.eski_deger)}</td>
                  <td style={{ ...td, color: '#86efac', fontFamily: 'monospace', fontSize: '0.72rem' }}>{JSON.stringify(r.yeni_deger)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sayilar[sekme] === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#4b5563', fontSize: '0.85rem' }}>
            Kayıt bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
