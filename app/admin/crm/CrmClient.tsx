'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Tipler ────────────────────────────────────────────────────────────────────
type Etiket = 'vip' | 'guvenilir' | 'normal' | 'suphelı' | 'spam' | null;

const ETIKETLER: { value: Etiket; label: string; bg: string; color: string; puan: number }[] = [
  { value: 'vip',      label: '⭐ VIP',        bg: '#2d1a00', color: '#f59e0b', puan: 5 },
  { value: 'guvenilir',label: '✅ Güvenilir',  bg: '#0d2818', color: '#22c55e', puan: 4 },
  { value: 'normal',   label: '○ Normal',      bg: '#1e293b', color: '#94a3b8', puan: 3 },
  { value: 'suphelı',  label: '⚠️ Şüpheli',   bg: '#2d1a0a', color: '#fb923c', puan: 2 },
  { value: 'spam',     label: '🚫 Spam',       bg: '#2d0a0a', color: '#f87171', puan: 1 },
];

function etiketMeta(v: Etiket) {
  return ETIKETLER.find(e => e.value === v) ?? { value: null, label: '— Etiket', bg: '#161b22', color: '#4b5563', puan: 0 };
}

interface ShadowProfile {
  id: string;
  phone: string;
  name: string | null;
  company_name: string | null;
  notes: string | null;
  status: 'active' | 'blocked' | 'converted';
  etiket: Etiket;
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

interface Analiz {
  ozet: string;
  tip: string;
  tip_aciklama: string;
  aktif_rotalar: string[];
  arac_tipleri: string[];
  yuk_tipleri: string[];
  calisma_stili: string;
  aktivite_yogunlugu: string;
  ilginc_notlar: string[];
  isim_tahmini: string | null;
  firma_tahmini: string | null;
  notlar_tahmini: string | null;
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
  const [siralama, setSiralama]    = useState<'listing_count' | 'etiket' | 'last_listing_at'>('listing_count');
  const [etiketPicker, setEtiketPicker] = useState<string | null>(null); // açık picker'ın row id'si
  const [selected, setSelected]    = useState<DetailData | null>(null);
  const [expandedRaw, setExpanded] = useState<Set<string>>(new Set());
  const [drawerTab, setDrawerTab]  = useState<'ilanlar' | 'analiz' | 'profil'>('ilanlar');
  const [analiz, setAnaliz]        = useState<Analiz | null>(null);
  const [analizLoading, setAL]     = useState(false);
  const [analizErr, setAE]         = useState('');
  const [analizAt, setAnalizAt]    = useState<string | null>(null);
  const [drawerOpen, setDrawer]    = useState(false);
  const [editDraft, setEditDraft]  = useState<Partial<ShadowProfile>>({});
  const [saving, setSaving]        = useState(false);
  const [detailLoading, setDL]     = useState(false);

  const LIMIT = 50;

  const load = useCallback(async (p = 1, q = search, min = minListings, sort = siralama) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p), limit: String(LIMIT),
      min_listings: String(min),
      sort,
    });
    if (q) params.set('search', q);
    const res = await fetch(`/api/admin/crm?${params}`);
    const json = await res.json();
    // Etiket sıralaması client-side (DB'de string sort yeterli değil, öncelik puanına göre)
    let data: ShadowProfile[] = json.data ?? [];
    if (sort === 'etiket') {
      data = [...data].sort((a, b) => (etiketMeta(b.etiket).puan - etiketMeta(a.etiket).puan) || (b.listing_count - a.listing_count));
    }
    setRows(data);
    setTotal(json.total ?? 0);
    setPage(p);
    setLoading(false);
  }, [search, minListings, siralama]);

  useEffect(() => { load(); }, []); // eslint-disable-line

  // Analiz sekmesi açıldığında kaydedilmiş analizi çek (tek seferlik)
  useEffect(() => {
    if (drawerTab === 'analiz' && selected && !analiz && !analizLoading && !analizErr) {
      loadAnaliz(selected.profile.id);
    }
  }, [drawerTab, selected]); // eslint-disable-line

  async function setEtiket(id: string, etiket: Etiket) {
    setEtiketPicker(null);
    setRows(prev => prev.map(r => r.id === id ? { ...r, etiket } : r));
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, etiket }),
    });
  }

  function toggleRaw(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // AI Analiz — kaydedilmiş sonucu yükle (GET)
  async function loadAnaliz(id: string) {
    const res = await fetch(`/api/admin/crm/${id}/analiz`);
    const json = await res.json();
    if (json.analiz) { setAnaliz(json.analiz); setAnalizAt(json.ai_analiz_at ?? null); }
  }

  // AI Analiz — yeni çalıştır ve kaydet (POST)
  async function runAnaliz(id: string) {
    setAL(true); setAE(''); setAnaliz(null); setAnalizAt(null);
    const res = await fetch(`/api/admin/crm/${id}/analiz`, { method: 'POST' });
    const json = await res.json();
    if (json.error) setAE(json.error);
    else { setAnaliz(json.analiz); setAnalizAt(json.ai_analiz_at ?? null); }
    setAL(false);
  }

  // Detay drawer aç
  async function openDetail(profile: ShadowProfile) {
    setExpanded(new Set());
    setDrawerTab('ilanlar');
    setAnaliz(null); setAE(''); setAnalizAt(null);
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
        <select
          value={siralama}
          onChange={e => { const v = e.target.value as typeof siralama; setSiralama(v); load(1, search, minListings, v); }}
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: '0.88rem', outline: 'none' }}
        >
          <option value="listing_count">↓ İlan Sayısı</option>
          <option value="etiket">↓ Etiket Puanı</option>
          <option value="last_listing_at">↓ Son Aktivite</option>
        </select>
        <button
          onClick={() => load(1, search, minListings, siralama)}
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
              {['Telefon', 'İsim / Firma', 'İlan Sayısı', 'İlk İlan', 'Son İlan', 'Etiket', 'Durum', ''].map(h => (
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
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {/* İstatistik şerit */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '16px 24px 0' }}>
                  {[
                    { label: 'Toplam İlan', val: selected.profile.listing_count },
                    { label: 'İlk İlan', val: tarih(selected.profile.first_listing_at) },
                    { label: 'Son İlan', val: tarih(selected.profile.last_listing_at) },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 3 }}>{c.label}</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{c.val}</div>
                    </div>
                  ))}
                </div>

                {/* Sekme çubuğu */}
                <div style={{ display: 'flex', borderBottom: '1px solid #21262d', padding: '14px 24px 0', gap: 4 }}>
                  {([
                    { id: 'ilanlar', label: `📋 İlanlar (${selected.listings.length})` },
                    { id: 'analiz',  label: '🤖 AI Profil Analizi' },
                    { id: 'profil',  label: '✏️ Profil Bilgileri' },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setDrawerTab(t.id)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '8px 14px', fontSize: '0.82rem', fontWeight: drawerTab === t.id ? 700 : 400,
                        color: drawerTab === t.id ? '#22c55e' : '#8b949e',
                        borderBottom: drawerTab === t.id ? '2px solid #22c55e' : '2px solid transparent',
                        marginBottom: -1,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sekme içerikleri */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

                  {/* ── Sekme: İlanlar ── */}
                  {drawerTab === 'ilanlar' && (
                    selected.listings.length === 0 ? (
                      <div style={{ color: '#8b949e', fontSize: '0.85rem', textAlign: 'center', paddingTop: 40 }}>Henüz ilan yok.</div>
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
                            {l.raw_text && (
                              <div onClick={e => { e.preventDefault(); e.stopPropagation(); toggleRaw(l.id); }} style={{ marginTop: 8 }}>
                                <span style={{ color: '#4b9eff', fontSize: '0.72rem', cursor: 'pointer', userSelect: 'none' }}>
                                  {expandedRaw.has(l.id) ? '▲ Ham metni gizle' : '▼ Ham metni göster'}
                                </span>
                                {expandedRaw.has(l.id) && (
                                  <pre style={{
                                    marginTop: 8, background: '#0d1117', border: '1px solid #30363d',
                                    borderRadius: 6, padding: '10px 12px', fontSize: '0.75rem',
                                    color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    maxHeight: 260, overflowY: 'auto', fontFamily: 'monospace',
                                  }}>
                                    {l.raw_text}
                                  </pre>
                                )}
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    )
                  )}

                  {/* ── Sekme: AI Profil Analizi ── */}
                  {drawerTab === 'analiz' && (
                    <div>
                      {!analiz && !analizLoading && !analizErr && (
                        <div style={{ textAlign: 'center', paddingTop: 32 }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', marginBottom: 10 }}>
                            🤖 AI ile Profil Analizi
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.6 }}>
                            Bu numaranın tüm ham ilan mesajları Haiku tarafından okunacak.<br />
                            Rota kalıpları, araç tercihleri, çalışma stili ve kişi tipi tespit edilecek.
                          </div>
                          <button
                            onClick={() => runAnaliz(selected.profile.id)}
                            style={{ background: '#22c55e', color: '#0d1117', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}
                          >
                            ▶ Analizi Başlat
                          </button>
                        </div>
                      )}

                      {analizLoading && (
                        <div style={{ textAlign: 'center', paddingTop: 60, color: '#8b949e' }}>
                          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                          <div>Mesajlar okunuyor ve analiz ediliyor…</div>
                        </div>
                      )}

                      {analizErr && (
                        <div style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 16, color: '#f87171', fontSize: '0.82rem', lineHeight: 1.6, wordBreak: 'break-word' }}>
                          <strong>Hata:</strong> {analizErr}
                          <br />
                          <button onClick={() => runAnaliz(selected.profile.id)} style={{ marginTop: 10, display: 'inline-block', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.82rem' }}>
                            Tekrar dene
                          </button>
                        </div>
                      )}

                      {analiz && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* DEBUG */}
                          <pre style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: 10, fontSize: '0.7rem', color: '#94a3b8', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify({ isim: (analiz as any).isim_tahmini, firma: (analiz as any).firma_tahmini, notlar: (analiz as any).notlar_tahmini }, null, 2)}
                          </pre>
                          {/* Tip rozeti + özet */}
                          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 18 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                              <span style={{
                                background: analiz.tip === 'nakliyeci' ? '#0d2818' : analiz.tip === 'komisyoncu' ? '#2d1a00' : analiz.tip === 'musteri' ? '#1e3a5f' : '#1e293b',
                                color: analiz.tip === 'nakliyeci' ? '#22c55e' : analiz.tip === 'komisyoncu' ? '#f59e0b' : analiz.tip === 'musteri' ? '#60a5fa' : '#94a3b8',
                                fontWeight: 800, fontSize: '0.78rem', padding: '4px 12px', borderRadius: 6, textTransform: 'uppercase',
                              }}>
                                {analiz.tip}
                              </span>
                              <span style={{
                                background: analiz.aktivite_yogunlugu === 'yüksek' ? '#2d1a00' : '#1e293b',
                                color: analiz.aktivite_yogunlugu === 'yüksek' ? '#f59e0b' : '#94a3b8',
                                fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6,
                              }}>
                                {analiz.aktivite_yogunlugu} aktivite
                              </span>
                              <span style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6 }}>
                                {analiz.calisma_stili}
                              </span>
                            </div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>{analiz.ozet}</p>
                            <p style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 8, marginBottom: 0, fontStyle: 'italic' }}>{analiz.tip_aciklama}</p>
                          </div>

                          {/* Rotalar */}
                          {analiz.aktif_rotalar.length > 0 && (
                            <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
                              <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📍 Aktif Rotalar</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {analiz.aktif_rotalar.map((r, i) => (
                                  <span key={i} style={{ background: '#0d2818', color: '#4ade80', fontSize: '0.8rem', fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>{r}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Araç & Yük tipleri */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {analiz.arac_tipleri.length > 0 && (
                              <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
                                <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🚛 Araç</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {analiz.arac_tipleri.map((a, i) => (
                                    <span key={i} style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.78rem', padding: '3px 10px', borderRadius: 6 }}>{a}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {analiz.yuk_tipleri.length > 0 && (
                              <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
                                <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📦 Yük</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {analiz.yuk_tipleri.map((y, i) => (
                                    <span key={i} style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.78rem', padding: '3px 10px', borderRadius: 6 }}>{y}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* İlginç notlar */}
                          {analiz.ilginc_notlar.length > 0 && (
                            <div style={{ background: '#2d1a00', border: '1px solid #78350f', borderRadius: 10, padding: 16 }}>
                              <div style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚠️ Dikkat Çeken</div>
                              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {analiz.ilginc_notlar.map((n, i) => (
                                  <li key={i} style={{ color: '#fcd34d', fontSize: '0.83rem', lineHeight: 1.5 }}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Profil alanlarını otomatik doldur */}
                          {(analiz.isim_tahmini || analiz.firma_tahmini || analiz.notlar_tahmini) && (
                            <div style={{ background: '#0d2020', border: '1px solid #134e4a', borderRadius: 10, padding: 16 }}>
                              <div style={{ color: '#2dd4bf', fontSize: '0.75rem', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ✨ AI Profil Önerileri
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                {analiz.isim_tahmini && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>İsim:</span>
                                    <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{analiz.isim_tahmini}</span>
                                  </div>
                                )}
                                {analiz.firma_tahmini && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>Firma:</span>
                                    <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{analiz.firma_tahmini}</span>
                                  </div>
                                )}
                                {analiz.notlar_tahmini && (
                                  <div>
                                    <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>Not:</span>
                                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0', lineHeight: 1.5 }}>{analiz.notlar_tahmini}</p>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setEditDraft(d => ({
                                    ...d,
                                    ...(analiz!.isim_tahmini && !d.name ? { name: analiz!.isim_tahmini } : {}),
                                    ...(analiz!.firma_tahmini && !d.company_name ? { company_name: analiz!.firma_tahmini } : {}),
                                    ...(analiz!.notlar_tahmini ? { notes: analiz!.notlar_tahmini } : {}),
                                  }));
                                  setDrawerTab('profil');
                                }}
                                style={{ background: '#0f766e', color: '#ccfbf1', border: 'none', borderRadius: 7, padding: '8px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                              >
                                Profile Uygula →
                              </button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                              onClick={() => runAnaliz(selected.profile.id)}
                              style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '8px 16px', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              🔄 Yeniden Analiz Et
                            </button>
                            {analizAt && (
                              <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>
                                ✅ Kaydedildi · {new Date(analizAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Sekme: Profil Bilgileri ── */}
                  {drawerTab === 'profil' && (
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
                          rows={4}
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
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        style={{ marginTop: 4, background: '#22c55e', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', opacity: saving ? 0.6 : 1, alignSelf: 'flex-start' }}
                      >
                        {saving ? 'Kaydediliyor…' : 'Kaydet'}
                      </button>
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
