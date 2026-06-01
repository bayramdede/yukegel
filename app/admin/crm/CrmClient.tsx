'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Tipler ────────────────────────────────────────────────────────────────────
interface ShadowProfile {
  id: string;
  phone: string;
  name: string | null;
  company_name: string | null;
  notes: string | null;
  status: 'active' | 'blocked' | 'converted';
  converted_user_id: string | null;
  created_at: string;
  updated_at: string;
  listing_count: number;
  last_listing_at: string | null;
  first_listing_at: string | null;
}

interface Listing {
  id: string;
  origin_city: string | null;
  listing_type: string;
  moderation_status: string;
  status: string;
  created_at: string;
  notes: string | null;
  vehicle_type: string[] | null;
  raw_text: string | null;
}

interface DetailData {
  profile: ShadowProfile;
  listings: Listing[];
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function tarih(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function durum_badge(s: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active:    { bg: '#0d2818', color: '#22c55e', label: 'Aktif' },
    blocked:   { bg: '#2d0a0a', color: '#f87171', label: 'Engelli' },
    converted: { bg: '#1e3a5f', color: '#60a5fa', label: 'Kayıt Oldu' },
  };
  const d = map[s] ?? { bg: '#1e293b', color: '#94a3b8', label: s };
  return (
    <span style={{ background: d.bg, color: d.color, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
      {d.label}
    </span>
  );
}

function mod_badge(s: string) {
  const map: Record<string, { bg: string; color: string }> = {
    approved:        { bg: '#0d2818', color: '#22c55e' },
    pending:         { bg: '#2d1f0a', color: '#f59e0b' },
    rejected:        { bg: '#2d0a0a', color: '#f87171' },
    auto_published:  { bg: '#0d2818', color: '#4ade80' },
    archived:        { bg: '#1e293b', color: '#94a3b8' },
  };
  const d = map[s] ?? { bg: '#1e293b', color: '#94a3b8' };
  return (
    <span style={{ background: d.bg, color: d.color, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
      {s}
    </span>
  );
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function CrmClient() {
  const [rows, setRows]            = useState<ShadowProfile[]>([]);
  const [total, setTotal]          = useState(0);
  const [page, setPage]            = useState(1);
  const [loading, setLoading]      = useState(false);
  const [search, setSearch]        = useState('');
  const [minListings, setMin]      = useState(0);
  const [selected, setSelected]    = useState<DetailData | null>(null);
  const [drawerOpen, setDrawer]    = useState(false);
  const [editDraft, setEditDraft]  = useState<Partial<ShadowProfile>>({});
  const [saving, setSaving]        = useState(false);
  const [detailLoading, setDL]     = useState(false);

  const LIMIT = 50;

  const load = useCallback(async (p = 1, q = search, min = minListings) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p), limit: String(LIMIT),
      min_listings: String(min),
    });
    if (q) params.set('search', q);
    const res = await fetch(`/api/admin/crm?${params}`);
    const json = await res.json();
    setRows(json.data ?? []);
    setTotal(json.total ?? 0);
    setPage(p);
    setLoading(false);
  }, [search, minListings]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Detay drawer aç
  async function openDetail(profile: ShadowProfile) {
    setDrawer(true);
    setDL(true);
    setSelected(null);
    setEditDraft({ name: profile.name ?? '', company_name: profile.company_name ?? '', notes: profile.notes ?? '', status: profile.status });
    const res = await fetch(`/api/admin/crm/${profile.id}`);
    const json = await res.json();
    setSelected(json);
    setDL(false);
  }

  // Kaydet
  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.profile.id, ...editDraft }),
    });
    setSaving(false);
    setDrawer(false);
    load(page);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      {/* ── Filtre Çubuğu ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <input
          placeholder="Telefon ara (05...)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1, search, minListings)}
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: '0.88rem', width: 220, outline: 'none' }}
        />
        <select
          value={minListings}
          onChange={e => { const v = parseInt(e.target.value); setMin(v); load(1, search, v); }}
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.88rem', outline: 'none' }}
        >
          <option value={0}>Tüm profiller</option>
          <option value={3}>3+ ilan</option>
          <option value={5}>5+ ilan</option>
          <option value={10}>10+ ilan (Balinalar)</option>
          <option value={20}>20+ ilan</option>
        </select>
        <button
          onClick={() => load(1, search, minListings)}
          style={{ background: '#22c55e', color: '#0d1117', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
        >
          Ara
        </button>
        <span style={{ color: '#8b949e', fontSize: '0.82rem', marginLeft: 4 }}>
          {total.toLocaleString('tr-TR')} profil
        </span>
      </div>

      {/* ── Tablo ── */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
              {['Telefon', 'İsim / Firma', 'İlan Sayısı', 'İlk İlan', 'Son İlan', 'Durum', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#8b949e', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>Yükleniyor…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>Kayıt bulunamadı.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.id}
                style={{ borderBottom: '1px solid #21262d', background: i % 2 === 0 ? '#0d1117' : '#0f1520', cursor: 'pointer' }}
                onClick={() => openDetail(r)}
              >
                <td style={{ padding: '10px 14px', color: '#e2e8f0', fontFamily: 'monospace' }}>{r.phone}</td>
                <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                  {r.name ? <span style={{ color: '#e2e8f0' }}>{r.name}</span> : <span style={{ color: '#4b5563' }}>—</span>}
                  {r.company_name && <span style={{ color: '#8b949e', fontSize: '0.78rem', display: 'block' }}>{r.company_name}</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    background: r.listing_count >= 10 ? '#2d1a00' : '#1a2020',
                    color: r.listing_count >= 10 ? '#f59e0b' : '#22c55e',
                    fontWeight: 800, fontSize: '0.9rem', padding: '2px 10px', borderRadius: 6
                  }}>
                    {r.listing_count}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#8b949e' }}>{tarih(r.first_listing_at)}</td>
                <td style={{ padding: '10px 14px', color: '#8b949e' }}>{tarih(r.last_listing_at)}</td>
                <td style={{ padding: '10px 14px' }}>{durum_badge(r.status)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>Detay →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Sayfalama ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18 }}>
          <button onClick={() => load(page - 1)} disabled={page === 1 || loading}
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
            ← Önceki
          </button>
          <span style={{ color: '#8b949e', padding: '6px 10px', fontSize: '0.85rem' }}>{page} / {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page === totalPages || loading}
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
            Sonraki →
          </button>
        </div>
      )}

      {/* ── Detay Drawer ── */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setDrawer(false); }}
        >
          {/* Overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)' }} />

          {/* Panel */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 520,
            background: '#0d1117', borderLeft: '1px solid #30363d',
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            {/* Başlık */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace' }}>
                  {selected?.profile.phone ?? '…'}
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: 3 }}>Gölge Profil Detayı</div>
              </div>
              <button onClick={() => setDrawer(false)}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.3rem', cursor: 'pointer', padding: 4 }}>✕</button>
            </div>

            {detailLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>Yükleniyor…</div>
            ) : selected ? (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>

                {/* İstatistik şerit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Toplam İlan', val: selected.profile.listing_count },
                    { label: 'İlk İlan', val: tarih(selected.profile.first_listing_at) },
                    { label: 'Son İlan', val: tarih(selected.profile.last_listing_at) },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>{c.label}</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{c.val}</div>
                    </div>
                  ))}
                </div>

                {/* Düzenleme formu */}
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: 14 }}>✏️ Profil Bilgileri</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {([
                      { field: 'name',         label: 'İsim',      placeholder: 'Ahmet Yılmaz' },
                      { field: 'company_name', label: 'Firma Adı', placeholder: 'Yılmaz Nakliyat' },
                    ] as const).map(f => (
                      <div key={f.field}>
                        <label style={{ color: '#8b949e', fontSize: '0.78rem', display: 'block', marginBottom: 5 }}>{f.label}</label>
                        <input
                          value={(editDraft as any)[f.field] ?? ''}
                          onChange={e => setEditDraft(d => ({ ...d, [f.field]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 7, padding: '8px 12px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                    <div>
                      <label style={{ color: '#8b949e', fontSize: '0.78rem', display: 'block', marginBottom: 5 }}>Özel Notlar</label>
                      <textarea
                        value={editDraft.notes ?? ''}
                        onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                        placeholder="Örn: Genelde Adana-Mersin arası çalışıyor, komisyoncu olabilir."
                        rows={3}
                        style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 7, padding: '8px 12px', fontSize: '0.88rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#8b949e', fontSize: '0.78rem', display: 'block', marginBottom: 5 }}>Durum</label>
                      <select
                        value={editDraft.status}
                        onChange={e => setEditDraft(d => ({ ...d, status: e.target.value as any }))}
                        style={{ background: '#0d1117', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 7, padding: '8px 12px', fontSize: '0.88rem', outline: 'none' }}
                      >
                        <option value="active">Aktif</option>
                        <option value="blocked">Engelli</option>
                        <option value="converted">Kayıt Oldu</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    style={{ marginTop: 16, background: '#22c55e', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>

                {/* İlan geçmişi */}
                <div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>
                    📋 İlan Geçmişi ({selected.listings.length})
                  </div>
                  {selected.listings.length === 0 ? (
                    <div style={{ color: '#8b949e', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>Henüz ilan yok.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selected.listings.map(l => (
                        <a
                          key={l.id}
                          href={`/ilan/${l.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '10px 14px', textDecoration: 'none', display: 'block' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>
                              {l.origin_city ?? '—'} · {l.listing_type === 'yuk' ? '📦 Yük' : '🚛 Araç'}
                            </span>
                            <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>{tarih(l.created_at)}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {mod_badge(l.moderation_status)}
                            {l.vehicle_type?.map(v => (
                              <span key={v} style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4 }}>{v}</span>
                            ))}
                          </div>
                          {l.notes && (
                            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.notes}
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
