'use client';
import { useMemo, useState } from 'react';

type Kullanici = { display_name: string | null; email: string | null; phone: string | null } | null;

type AuthEvent = {
  id: number; event: string; method: string; reason: string | null;
  user_id: string | null; ip: string | null; user_agent: string | null;
  created_at: string; kullanici: Kullanici;
};
type SearchQuery = {
  id: number; user_id: string | null; kaynak: string;
  kalkis_il_id: number | null; varis_il_id: number | null; tip: string | null;
  sonuc_sayisi: number | null; ip: string | null; created_at: string;
  kullanici: Kullanici; kalkis_il_adi: string | null; varis_il_adi: string | null;
};
type ListingView = {
  id: number; listing_id: string; viewer_user_id: string | null; ip: string | null;
  created_at: string; kullanici: Kullanici;
  ilan: { origin_province_id: number | null; listing_type: string | null; il_adi: string | null } | null;
};
type AdminAction = {
  id: number; actor_id: string | null; target_user_id: string | null; alan: string;
  eski_deger: unknown; yeni_deger: unknown; created_at: string;
  aktor: Kullanici; hedef: Kullanici;
};

function tarihFormat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function kullaniciEtiket(k: Kullanici): string {
  if (!k) return '—';
  return k.display_name || k.email || k.phone || '—';
}

function kullaniciAramayaUyar(k: Kullanici, q: string): boolean {
  if (!q) return true;
  const hedef = `${k?.display_name ?? ''} ${k?.email ?? ''} ${k?.phone ?? ''}`.toLowerCase();
  return hedef.includes(q);
}

const SEKMELER = ['auth', 'search', 'view', 'admin'] as const;
type Sekme = typeof SEKMELER[number];

const SEKME_ETIKET: Record<Sekme, string> = {
  auth: '🔐 Giriş Olayları',
  search: '🔍 Arama Sorguları',
  view: '👁️ İlan Görüntülemeleri',
  admin: '🛠️ Admin/Mod İşlemleri',
};

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

export default function LoglarClient({
  authEvents, searchQueries, listingViews, adminActions,
}: {
  authEvents: AuthEvent[];
  searchQueries: SearchQuery[];
  listingViews: ListingView[];
  adminActions: AdminAction[];
}) {
  const [sekme, setSekme] = useState<Sekme>('auth');
  const [arama, setArama] = useState('');
  const q = arama.trim().toLowerCase();

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
                  <td style={td}>
                    <a href={`/ilan/${r.listing_id}`} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none' }}>
                      {r.ilan ? `${r.ilan.il_adi ?? '?'} · ${r.ilan.listing_type === 'yuk' ? 'Yük' : 'Araç'}` : r.listing_id.slice(0, 8) + '…'}
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
