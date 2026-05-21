'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Tip ──────────────────────────────────────────────────────────────────────
interface ArchivedLink {
  id: string;
  url: string;
  domain: string;
  category: string;
  status: string;
  source: string;
  raw_post_id: string | null;
  user_id: string | null;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  raw_posts: { raw_text: string; message_date: string | null } | null;
}

// ── Sabitler ─────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  whatsapp_group : '💬 WhatsApp Grubu',
  telegram       : '✈️ Telegram',
  facebook_group : '👥 Facebook',
  instagram      : '📸 Instagram',
  linkedin       : '💼 LinkedIn',
  other          : '🔗 Diğer',
};

const CATEGORY_COLORS: Record<string, string> = {
  whatsapp_group : '#25D366',
  telegram       : '#2AABEE',
  facebook_group : '#1877F2',
  instagram      : '#E1306C',
  linkedin       : '#0A66C2',
  other          : '#6b7280',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp_parse : 'WhatsApp ZIP',
  user_text      : 'Kullanıcı Metni',
  whatsapp_bot   : 'WhatsApp Bot',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
export default function LinkHavuzuPage() {
  const [links, setLinks]         = useState<ArchivedLink[]>([]);
  const [count, setCount]         = useState(0);
  const [page, setPage]           = useState(1);
  const [status, setStatus]       = useState('pending_review');
  const [category, setCategory]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState<string | null>(null); // id of row being updated
  const [msg, setMsg]             = useState('');

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status, page: String(page) });
    if (category) params.set('category', category);
    const res = await fetch(`/api/admin/link-havuzu?${params}`);
    const json = await res.json();
    setLinks(json.data || []);
    setCount(json.count || 0);
    setLoading(false);
  }, [status, category, page]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected') {
    setBusy(id);
    const res = await fetch('/api/admin/link-havuzu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (res.ok) {
      setLinks(prev => prev.filter(l => l.id !== id));
      setCount(prev => Math.max(0, prev - 1));
      setMsg(newStatus === 'approved' ? '✅ Onaylandı' : '❌ Reddedildi');
      setTimeout(() => setMsg(''), 2500);
    }
    setBusy(null);
  }

  const totalPages = Math.ceil(count / 50);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: "'IBM Plex Sans', sans-serif", padding: '24px' }}>

      {/* Başlık */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin" style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}>← Admin</a>
          <span style={{ color: '#6b7280' }}>/</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🔗 Link Havuzu</h1>
        </div>
        <p style={{ color: '#8b949e', marginTop: 6, fontSize: 14 }}>
          Mesajlardan otomatik çıkarılan URL'ler. Yeni ilan kaynakları için inceleyin.
        </p>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {/* Durum */}
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="pending_review">⏳ İnceleme Bekleyenler</option>
          <option value="approved">✅ Onaylananlar</option>
          <option value="rejected">❌ Reddedilenler</option>
        </select>

        {/* Kategori */}
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">Tüm Kategoriler</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Sayaç */}
        <div style={{ display: 'flex', alignItems: 'center', color: '#8b949e', fontSize: 13, marginLeft: 'auto' }}>
          {count} kayıt
        </div>
      </div>

      {/* Flash mesaj */}
      {msg && (
        <div style={{ background: '#161b22', border: '1px solid #22c55e', color: '#22c55e', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {msg}
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <div style={{ color: '#8b949e', padding: 32, textAlign: 'center' }}>Yükleniyor…</div>
      ) : links.length === 0 ? (
        <div style={{ color: '#8b949e', padding: 32, textAlign: 'center', background: '#161b22', borderRadius: 12 }}>
          Bu filtrede kayıt yok.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {links.map(link => (
            <div key={link.id} style={cardStyle}>
              {/* Üst satır: kategori + kaynak + tarih */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                  background: (CATEGORY_COLORS[link.category] || '#6b7280') + '22',
                  color: CATEGORY_COLORS[link.category] || '#6b7280',
                  border: `1px solid ${(CATEGORY_COLORS[link.category] || '#6b7280')}44`,
                }}>
                  {CATEGORY_LABELS[link.category] || link.category}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', background: '#0d1117', padding: '2px 8px', borderRadius: 99, border: '1px solid #30363d' }}>
                  {SOURCE_LABELS[link.source] || link.source}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
                  {formatDate(link.created_at)}
                </span>
              </div>

              {/* URL */}
              <div style={{ marginBottom: 6 }}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#58a6ff', fontSize: 14, wordBreak: 'break-all', textDecoration: 'none' }}
                  onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {link.url}
                </a>
              </div>

              {/* Domain */}
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 10 }}>
                🌐 {link.domain || '—'}
                {link.raw_post_id && <span style={{ marginLeft: 12 }}>📄 raw_post bağlı</span>}
                {link.user_id && <span style={{ marginLeft: 12 }}>👤 kullanıcı bağlı</span>}
              </div>

              {/* Aksiyon butonları (sadece pending_review'de) */}
              {status === 'pending_review' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => updateStatus(link.id, 'approved')}
                    disabled={busy === link.id}
                    style={btnApprove}
                  >
                    {busy === link.id ? '…' : '✅ Onayla'}
                  </button>
                  <button
                    onClick={() => updateStatus(link.id, 'rejected')}
                    disabled={busy === link.id}
                    style={btnReject}
                  >
                    {busy === link.id ? '…' : '❌ Reddet'}
                  </button>
                </div>
              )}

              {/* Onaylanmış/reddedilmiş durumda reviewed bilgisi */}
              {status !== 'pending_review' && link.reviewed_at && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  İncelendi: {formatDate(link.reviewed_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={paginBtn}
          >
            ← Önceki
          </button>
          <span style={{ color: '#8b949e', display: 'flex', alignItems: 'center', fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={paginBtn}
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline stiller ────────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', color: '#e6edf3',
  padding: '7px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
};
const cardStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '14px 16px',
};
const btnApprove: React.CSSProperties = {
  background: '#22c55e22', border: '1px solid #22c55e55', color: '#22c55e',
  padding: '6px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600,
};
const btnReject: React.CSSProperties = {
  background: '#ef444422', border: '1px solid #ef444455', color: '#ef4444',
  padding: '6px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontWeight: 600,
};
const paginBtn: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', color: '#e6edf3',
  padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
};
