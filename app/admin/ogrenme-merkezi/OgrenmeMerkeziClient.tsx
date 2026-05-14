'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Tipler ──
interface Alias {
  id: string;
  alias: string;
  canonical: string;
  type: string;
  created_by_ai?: boolean;
  is_approved?: boolean;
  llm_confidence?: number;
  created_at: string;
}

interface NoLaneData {
  raw_posts: Array<{
    id: string;
    message_text: string | null;
    created_at: string;
    processing_status: string;
  }>;
  listings_no_origin: Array<{
    id: string;
    raw_text: string | null;
    source: string;
    origin_city: string | null;
    created_at: string;
    moderation_status: string;
  }>;
  total: number;
}

interface PendingAlias {
  id: string;
  alias: string;
  canonical: string;
  type: string;
  llm_confidence: number;
  source_listing_ids: string[];
  created_at: string;
}

// ── Stil yardimcilari ──
const S = {
  btn: (bg: string, color: string, disabled?: boolean): React.CSSProperties => ({
    background: disabled ? '#1c2128' : bg,
    color: disabled ? '#484f58' : color,
    border: `1px solid ${disabled ? '#30363d' : color + '50'}`,
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }),
  input: (): React.CSSProperties => ({
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    color: '#e2e8f0',
    padding: '7px 10px',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
  }),
  badge: (color: string): React.CSSProperties => ({
    background: color + '22',
    color,
    borderRadius: 4,
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '1px 6px',
  }),
  card: (): React.CSSProperties => ({
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 8,
  }),
};

// ─────────────────────────────────────────
// Sekme 1: Alias Kutuphanesi
// ─────────────────────────────────────────
function AliasSekme() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [ara, setAra] = useState('');
  const [yeniAlias, setYeniAlias] = useState('');
  const [yeniCanonical, setYeniCanonical] = useState('');
  const [yeniType, setYeniType] = useState<'city' | 'district'>('city');
  const [ekleniyor, setEkleniyor] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [duzVal, setDuzVal] = useState({ alias: '', canonical: '', type: '' });
  const [mesaj, setMesaj] = useState('');

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/learn-aliases?sekme=aliases&limit=500');
      const json = await res.json();
      setAliases(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const ekle = async () => {
    if (!yeniAlias.trim() || !yeniCanonical.trim()) return;
    setEkleniyor(true);
    try {
      const res = await fetch('/api/admin/learn-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', alias: yeniAlias, canonical: yeniCanonical, type: yeniType }),
      });
      const json = await res.json();
      if (json.success) {
        setMesaj(`Eklendi: "${yeniAlias}" -> "${yeniCanonical}"`);
        setYeniAlias(''); setYeniCanonical('');
        yukle();
      } else {
        setMesaj(`Hata: ${json.error}`);
      }
    } finally {
      setEkleniyor(false);
    }
  };

  const sil = async (id: string, alias: string) => {
    if (!confirm(`"${alias}" alias'ini silmek istediginize emin misiniz?`)) return;
    const res = await fetch('/api/admin/learn-aliases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if ((await res.json()).success) { setMesaj('Silindi'); yukle(); }
  };

  const duzenlemeBaslat = (a: Alias) => {
    setDuzenlenen(a.id);
    setDuzVal({ alias: a.alias, canonical: a.canonical, type: a.type });
  };

  const duzenlemeKaydet = async () => {
    if (!duzenlenen) return;
    const res = await fetch('/api/admin/learn-aliases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: duzenlenen, ...duzVal }),
    });
    if ((await res.json()).success) { setDuzenlenen(null); setMesaj('Guncellendi'); yukle(); }
  };

  const filtreli = aliases.filter(a =>
    !ara ||
    a.alias.toLowerCase().includes(ara.toLowerCase()) ||
    a.canonical.toLowerCase().includes(ara.toLowerCase())
  );

  return (
    <div>
      {/* Yeni Alias Ekle */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>
          + Yeni Alias Ekle
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>Alias (kisaltma / varyant)</div>
            <input style={S.input()} placeholder="Orn: G.Antep" value={yeniAlias} onChange={e => setYeniAlias(e.target.value)} />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>Canonical (standart ad)</div>
            <input style={S.input()} placeholder="Orn: Gaziantep" value={yeniCanonical} onChange={e => setYeniCanonical(e.target.value)} />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 4 }}>Tur</div>
            <select style={{ ...S.input(), width: 'auto' }} value={yeniType} onChange={e => setYeniType(e.target.value as any)}>
              <option value="city">Il</option>
              <option value="district">Ilce</option>
            </select>
          </div>
          <button
            onClick={ekle}
            disabled={ekleniyor || !yeniAlias || !yeniCanonical}
            style={S.btn('#14532d', '#22c55e', ekleniyor || !yeniAlias || !yeniCanonical)}
          >
            {ekleniyor ? '...' : 'Ekle'}
          </button>
        </div>
        {mesaj && (
          <div style={{ marginTop: 10, fontSize: '0.82rem', color: mesaj.startsWith('Hata') ? '#f87171' : '#22c55e' }}>
            {mesaj}
          </div>
        )}
      </div>

      {/* Arama */}
      <input
        style={{ ...S.input(), marginBottom: 12 }}
        placeholder={`Ara... (${aliases.length} alias)`}
        value={ara}
        onChange={e => setAra(e.target.value)}
      />

      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : filtreli.length === 0 ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Kayit bulunamadi</div>
      ) : (
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {filtreli.map(a => (
            <div key={a.id} style={S.card()}>
              {duzenlenen === a.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 8, alignItems: 'center' }}>
                  <input style={S.input()} value={duzVal.alias} onChange={e => setDuzVal(p => ({ ...p, alias: e.target.value }))} />
                  <input style={S.input()} value={duzVal.canonical} onChange={e => setDuzVal(p => ({ ...p, canonical: e.target.value }))} />
                  <select style={{ ...S.input(), width: 'auto' }} value={duzVal.type} onChange={e => setDuzVal(p => ({ ...p, type: e.target.value }))}>
                    <option value="city">Il</option>
                    <option value="district">Ilce</option>
                  </select>
                  <button onClick={duzenlemeKaydet} style={S.btn('#14532d', '#22c55e')}>OK</button>
                  <button onClick={() => setDuzenlenen(null)} style={S.btn('#1c2128', '#8b949e')}>X</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.88rem', minWidth: 120 }}>{a.alias}</span>
                    <span style={{ color: '#8b949e' }}>-&gt;</span>
                    <span style={{ color: '#22c55e', fontSize: '0.88rem' }}>{a.canonical}</span>
                    <span style={S.badge(a.type === 'city' ? '#60a5fa' : '#a78bfa')}>
                      {a.type === 'city' ? 'IL' : 'ILCE'}
                    </span>
                    {a.created_by_ai && <span style={S.badge('#f59e0b')}>AI</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => duzenlemeBaslat(a)} style={S.btn('#1e3a5f', '#60a5fa')}>Duzenle</button>
                    <button onClick={() => sil(a.id, a.alias)} style={S.btn('#450a0a', '#f87171')}>Sil</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Sekme 2: AI Kesif Alani
// ─────────────────────────────────────────
function KesifSekme() {
  const [noLane, setNoLane] = useState<NoLaneData>({ raw_posts: [], listings_no_origin: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [kesfediyor, setKesfediyor] = useState(false);
  const [limit, setLimit] = useState(50);
  const [sonuc, setSonuc] = useState<any>(null);
  const [acilanId, setAcilanId] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/learn-aliases?sekme=no_lane&limit=200');
      const json = await res.json();
      setNoLane({
        raw_posts: json.raw_posts ?? [],
        listings_no_origin: json.listings_no_origin ?? [],
        total: json.total ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const kesfet = async () => {
    setKesfediyor(true);
    setSonuc(null);
    try {
      const res = await fetch('/api/admin/learn-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover', limit }),
      });
      setSonuc(await res.json());
    } finally {
      setKesfediyor(false);
    }
  };

  const toplamNoLane = noLane.total;

  return (
    <div>
      {/* Kesif Kutusu */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>AI ile Alias Kesfi</div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: 3 }}>
              no_lane raw_post metinlerini Haiku'ya gonderir, bilinmeyen yer adlarini tespit eder.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 3 }}>Max kayit sayisi</div>
              <select style={{ ...S.input(), width: 'auto' }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <button
              onClick={kesfet}
              disabled={kesfediyor || toplamNoLane === 0}
              style={{ ...S.btn('#713f12', '#fbbf24', kesfediyor || toplamNoLane === 0), marginTop: 16 }}
            >
              {kesfediyor ? 'Kesfediyor...' : 'AI Kesfini Baslat'}
            </button>
          </div>
        </div>

        {sonuc && (
          <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, marginTop: 8 }}>
            {sonuc.error ? (
              <div style={{ color: '#f87171', fontSize: '0.85rem' }}>Hata: {sonuc.error}</div>
            ) : (
              <>
                <div style={{ color: '#22c55e', fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>{sonuc.message}</div>
                {sonuc.suggestions?.length > 0 && (
                  <div>
                    <div style={{ color: '#8b949e', fontSize: '0.78rem', marginBottom: 6 }}>
                      Tespit edilen alias onerileri (Onay Bekleyen sekmesinde gorunur):
                    </div>
                    {sonuc.suggestions.map((s: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: '0.82rem' }}>
                        <span style={{ color: '#e2e8f0' }}>"{s.alias}"</span>
                        <span style={{ color: '#8b949e' }}>-&gt;</span>
                        <span style={{ color: '#22c55e' }}>"{s.canonical}"</span>
                        <span style={S.badge('#f59e0b')}>{s.type}</span>
                        <span style={S.badge('#60a5fa')}>%{s.llm_confidence}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Liste baslik */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
          Rotasi Cozulemeyen Kayitlar
          <span style={{ color: loading ? '#8b949e' : '#f59e0b', marginLeft: 8 }}>
            ({loading ? '...' : toplamNoLane} adet)
          </span>
        </div>
        <button onClick={yukle} style={S.btn('#1e3a5f', '#60a5fa')}>Yenile</button>
      </div>

      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : toplamNoLane === 0 ? (
        <div style={{ background: '#161b22', border: '1px solid #22c55e30', borderRadius: 8, padding: 24, textAlign: 'center', color: '#22c55e' }}>
          Harika! Rotasi cozulemeyen kayit yok.
        </div>
      ) : (
        <div>
          {/* WhatsApp no_lane raw_posts */}
          {noLane.raw_posts.length > 0 && (
            <>
              <div style={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                WhatsApp — no_lane ({noLane.raw_posts.length})
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                {noLane.raw_posts.map(r => (
                  <div key={r.id} style={S.card()}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={S.badge('#22c55e')}>whatsapp</span>
                          <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>
                            {new Date(r.created_at).toLocaleDateString('tr-TR')}
                          </span>
                          <span style={S.badge('#f87171')}>no_lane</span>
                        </div>
                        {acilanId === r.id && r.message_text && (
                          <pre style={{ background: '#161b22', borderRadius: 6, padding: 10, fontSize: '0.75rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto', marginTop: 6, margin: 0 }}>
                            {r.message_text.substring(0, 800)}
                          </pre>
                        )}
                      </div>
                      <button
                        onClick={() => setAcilanId(acilanId === r.id ? null : r.id)}
                        style={S.btn('#1c2128', '#8b949e')}
                      >
                        {acilanId === r.id ? 'Gizle' : 'Metni Gor'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Form ilanlari — origin_city bos */}
          {noLane.listings_no_origin.length > 0 && (
            <>
              <div style={{ color: '#8b949e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Form Ilanlari — Kalkis Sehri Bos ({noLane.listings_no_origin.length})
              </div>
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {noLane.listings_no_origin.map(il => (
                  <div key={il.id} style={S.card()}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                          <span style={S.badge('#60a5fa')}>{il.source}</span>
                          <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>
                            {new Date(il.created_at).toLocaleDateString('tr-TR')}
                          </span>
                          <span style={S.badge('#f87171')}>origin_city bos</span>
                        </div>
                        {acilanId === il.id && il.raw_text && (
                          <pre style={{ background: '#161b22', borderRadius: 6, padding: 10, fontSize: '0.75rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflowY: 'auto', marginTop: 6, margin: 0 }}>
                            {il.raw_text.substring(0, 600)}
                          </pre>
                        )}
                      </div>
                      <button
                        onClick={() => setAcilanId(acilanId === il.id ? null : il.id)}
                        style={S.btn('#1c2128', '#8b949e')}
                      >
                        {acilanId === il.id ? 'Gizle' : 'Metni Gor'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Sekme 3: Onay Bekleyen + Re-parse
// ─────────────────────────────────────────
function OnaySekme() {
  const [pending, setPending] = useState<PendingAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [reparseIlerleme, setReparseIlerleme] = useState({ done: 0, total: 0, ok: 0, still: 0 });
  const [reparseMsg, setReparseMsg] = useState('');

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/learn-aliases?sekme=pending');
      const json = await res.json();
      setPending(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const islemYap = async (id: string, action: 'approve' | 'reject') => {
    setIslem(id);
    try {
      await fetch('/api/admin/learn-aliases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      yukle();
    } finally {
      setIslem(null);
    }
  };

  const topluOnayla = async () => {
    if (!confirm(`${pending.length} alias onerisi toplu onaylansin mi?`)) return;
    setIslem('bulk');
    for (const p of pending) {
      await fetch('/api/admin/learn-aliases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, action: 'approve' }),
      });
    }
    setIslem(null);
    yukle();
  };

  const reparseBaslat = async () => {
    setReparsing(true);
    setReparseMsg('');
    setReparseIlerleme({ done: 0, total: 0, ok: 0, still: 0 });

    const idsRes = await fetch('/api/admin/reprocess-no-lane');
    const idsJson = await idsRes.json();
    const ids: string[] = idsJson.ids ?? [];

    if (ids.length === 0) {
      setReparseMsg('Yeniden islenecek no_lane kayit yok.');
      setReparsing(false);
      return;
    }

    setReparseIlerleme(p => ({ ...p, total: ids.length }));

    let done = 0, ok = 0, still = 0;
    const BATCH = 4;

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(id =>
          fetch('/api/admin/reprocess-no-lane', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_post_id: id }),
          })
            .then(r => r.json())
            .then(j => ((j.lanes ?? 0) > 0 ? 'ok' : 'no_lane'))
            .catch(() => 'error')
        )
      );
      for (const r of results) { done++; if (r === 'ok') ok++; else still++; }
      setReparseIlerleme({ done, total: ids.length, ok, still });
    }

    setReparseMsg(`Tamamlandi: ${ok} kayit rotaya alindi, ${still} hala no_lane`);
    setReparsing(false);
  };

  const pct = reparseIlerleme.total > 0 ? Math.round((reparseIlerleme.done / reparseIlerleme.total) * 100) : 0;

  return (
    <div>
      {/* Re-Parse Kutusu */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>Ilanlari Yeniden Isle</div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: 3 }}>
              Yeni alias'lari onayladiktan sonra no_lane kayitlari tekrar parse motoruna gonder.
            </div>
          </div>
          <button
            onClick={reparseBaslat}
            disabled={reparsing}
            style={S.btn('#14532d', '#22c55e', reparsing)}
          >
            {reparsing ? 'Isleniyor...' : 'Yeniden Isle'}
          </button>
        </div>

        {reparsing && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#8b949e', marginBottom: 4 }}>
              <span>{reparseIlerleme.done}/{reparseIlerleme.total} (%{pct})</span>
              <span>{reparseIlerleme.ok} rotalandi / {reparseIlerleme.still} kaldi</span>
            </div>
            <div style={{ background: '#0d1117', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ background: '#22c55e', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        {reparseMsg && (
          <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#22c55e' }}>{reparseMsg}</div>
        )}
      </div>

      {/* Pending Alias'lar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
          AI Onerisi Bekleyen Alias'lar
          <span style={{ color: '#f59e0b', marginLeft: 8 }}>({loading ? '...' : pending.length} adet)</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={yukle} style={S.btn('#1e3a5f', '#60a5fa')}>Yenile</button>
          {pending.length > 0 && (
            <button
              onClick={topluOnayla}
              disabled={islem === 'bulk'}
              style={S.btn('#14532d', '#22c55e', islem === 'bulk')}
            >
              {islem === 'bulk' ? '...' : 'Tumunu Onayla'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : pending.length === 0 ? (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 24, textAlign: 'center', color: '#8b949e', fontSize: '0.9rem' }}>
          Onay bekleyen AI onerisi yok. Kesif sekmesinden yeni tarama baslatabilirsiniz.
        </div>
      ) : (
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {pending.map(p => (
            <div key={p.id} style={{ ...S.card(), border: '1px solid #f59e0b30' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 600 }}>"{p.alias}"</span>
                    <span style={{ color: '#8b949e' }}>-&gt;</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>"{p.canonical}"</span>
                    <span style={S.badge(p.type === 'city' ? '#60a5fa' : '#a78bfa')}>
                      {p.type === 'city' ? 'IL' : 'ILCE'}
                    </span>
                    <span style={S.badge(
                      p.llm_confidence >= 90 ? '#22c55e' :
                      p.llm_confidence >= 70 ? '#f59e0b' : '#f87171'
                    )}>
                      Guven: %{p.llm_confidence}
                    </span>
                    {p.source_listing_ids?.length > 0 && (
                      <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>
                        {p.source_listing_ids.length} kayittan
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#484f58', fontSize: '0.72rem', marginTop: 4 }}>
                    {new Date(p.created_at).toLocaleString('tr-TR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => islemYap(p.id, 'approve')}
                    disabled={islem === p.id}
                    style={S.btn('#14532d', '#22c55e', islem === p.id)}
                  >
                    Onayla
                  </button>
                  <button
                    onClick={() => islemYap(p.id, 'reject')}
                    disabled={islem === p.id}
                    style={S.btn('#450a0a', '#f87171', islem === p.id)}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Ana Component
// ─────────────────────────────────────────
export default function OgrenmeMerkeziClient() {
  const [aktifSekme, setAktifSekme] = useState<'aliases' | 'kesif' | 'onay'>('aliases');

  const sekmeler = [
    { id: 'aliases' as const, label: 'Alias Kutuphanesi' },
    { id: 'kesif' as const, label: 'AI Kesif Alani' },
    { id: 'onay' as const, label: 'Onay Bekleyen' },
  ];

  return (
    <div>
      {/* Sekme Nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #30363d' }}>
        {sekmeler.map(s => (
          <button
            key={s.id}
            onClick={() => setAktifSekme(s.id)}
            style={{
              background: aktifSekme === s.id ? '#161b22' : 'transparent',
              color: aktifSekme === s.id ? '#e2e8f0' : '#8b949e',
              border: 'none',
              borderBottom: aktifSekme === s.id ? '2px solid #22c55e' : '2px solid transparent',
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: aktifSekme === s.id ? 700 : 400,
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              marginBottom: -1,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {aktifSekme === 'aliases' && <AliasSekme />}
      {aktifSekme === 'kesif' && <KesifSekme />}
      {aktifSekme === 'onay' && <OnaySekme />}
    </div>
  );
}
