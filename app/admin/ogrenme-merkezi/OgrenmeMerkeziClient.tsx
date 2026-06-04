'use client';

import { useState, useEffect, useCallback } from 'react';

interface Alias {
  id: number;
  alias: string;
  normalized: string;
  type: string;
  is_active: boolean;
  priority?: number;
  district?: string | null;
  created_by_ai?: boolean;
  created_at: string;
}

interface NoLaneData {
  raw_posts: Array<{
    id: string;
    raw_text: string | null;
    contact_phone?: string;
    source_group?: string;
    created_at: string;
    processing_status: string;
    slh_scanned_at: string | null;   // null = hic taranmadi
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
  id: number;
  alias: string;
  normalized: string;
  district?: string | null;
  type: string;
  llm_confidence: number;
  source_listing_ids: string[];
  created_at: string;
}

const TIP_RENK: Record<string, string> = {
  city:      '#60a5fa',
  vehicle:   '#22c55e',
  body:      '#fb923c',
  blacklist: '#f87171',
};
function tipRenk(t: string) { return TIP_RENK[t] ?? '#8b949e'; }

const S = {
  btn: (bg: string, color: string, disabled?: boolean): React.CSSProperties => ({
    background: disabled ? '#1c2128' : bg,
    color: disabled ? '#484f58' : color,
    border: `1px solid ${disabled ? '#30363d' : color + '50'}`,
    borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    whiteSpace: 'nowrap' as const,
  }),
  input: (): React.CSSProperties => ({
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
    color: '#e2e8f0', padding: '7px 10px', fontSize: '0.85rem', outline: 'none',
    width: '100%', boxSizing: 'border-box' as const,
  }),
  badge: (color: string): React.CSSProperties => ({
    background: color + '22', color, borderRadius: 4, fontSize: '0.65rem',
    fontWeight: 700, padding: '2px 7px', whiteSpace: 'nowrap' as const,
  }),
  card: (): React.CSSProperties => ({
    background: '#0d1117', border: '1px solid #30363d',
    borderRadius: 8, padding: '12px 14px', marginBottom: 8,
  }),
  tipBtn: (aktif: boolean, color: string): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${aktif ? color + '60' : '#30363d'}`,
    background: aktif ? color + '22' : '#0d1117', color: aktif ? color : '#8b949e',
  }),
  altTipBtn: (aktif: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${aktif ? '#60a5fa50' : '#30363d'}`,
    background: aktif ? '#1e3a5f' : '#0d1117', color: aktif ? '#60a5fa' : '#8b949e',
  }),
};

// ─────────────────────────────────────────
// Sekme 1: Alias Kutuphanesi
// ─────────────────────────────────────────
function AliasSekme() {
  const [aliases, setAliases]       = useState<Alias[]>([]);
  const [loading, setLoading]       = useState(true);
  const [ara, setAra]               = useState('');
  const [tipFiltre, setTipFiltre]   = useState('');

  // Yeni alias state
  const [yeniAlias, setYeniAlias]     = useState('');
  const [yeniNorm, setYeniNorm]       = useState('');
  const [yeniType, setYeniType]       = useState('city');
  const [yeniAltTip, setYeniAltTip]   = useState<'il' | 'ilce'>('il');
  const [yeniDistrict, setYeniDistrict] = useState('');
  const [ekleniyor, setEkleniyor]     = useState(false);

  // Düzenle state
  const [duzenlenen, setDuzenlenen]   = useState<number | null>(null);
  const [duzVal, setDuzVal]           = useState({ alias: '', normalized: '', type: '', district: '' });
  const [duzAltTip, setDuzAltTip]     = useState<'il' | 'ilce'>('il');

  const [mesaj, setMesaj] = useState('');

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/learn-aliases?sekme=aliases&limit=500');
      const json = await res.json();
      setAliases(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const tipler = Array.from(new Set(aliases.map(a => a.type))).sort();

  const ekleDisabled =
    ekleniyor || !yeniAlias || !yeniNorm ||
    (yeniType === 'city' && yeniAltTip === 'ilce' && !yeniDistrict);

  const ekle = async () => {
    if (ekleDisabled) return;
    setEkleniyor(true);
    try {
      const district = yeniType === 'city' && yeniAltTip === 'ilce'
        ? yeniDistrict.trim() : null;
      const res  = await fetch('/api/admin/learn-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', alias: yeniAlias, normalized: yeniNorm, type: yeniType, district }),
      });
      const json = await res.json();
      if (json.success) {
        setMesaj(`Eklendi: "${yeniAlias}" -> "${yeniNorm}"${district ? ` / ${district}` : ''}`);
        setYeniAlias(''); setYeniNorm(''); setYeniDistrict('');
        yukle();
      } else {
        setMesaj(`Hata: ${json.error}`);
      }
    } finally { setEkleniyor(false); }
  };

  const sil = async (id: number, alias: string) => {
    if (!confirm(`"${alias}" silinsin mi?`)) return;
    const res = await fetch('/api/admin/learn-aliases', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if ((await res.json()).success) { setMesaj('Silindi'); yukle(); }
  };

  const duzenlemeBaslat = (a: Alias) => {
    setDuzenlenen(a.id);
    setDuzVal({ alias: a.alias, normalized: a.normalized, type: a.type, district: a.district ?? '' });
    setDuzAltTip(a.type === 'city' && a.district ? 'ilce' : 'il');
  };

  const duzenlemeKaydet = async () => {
    if (!duzenlenen) return;
    const district = duzVal.type === 'city' && duzAltTip === 'ilce'
      ? duzVal.district.trim() || null : null;
    const res = await fetch('/api/admin/learn-aliases', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: duzenlenen, alias: duzVal.alias, normalized: duzVal.normalized, type: duzVal.type, district }),
    });
    if ((await res.json()).success) { setDuzenlenen(null); setMesaj('Guncellendi'); yukle(); }
  };

  const filtreli = aliases.filter(a => {
    const tipOk = !tipFiltre || a.type === tipFiltre;
    const araOk = !ara ||
      a.alias.toLowerCase().includes(ara.toLowerCase()) ||
      a.normalized.toLowerCase().includes(ara.toLowerCase()) ||
      (a.district ?? '').toLowerCase().includes(ara.toLowerCase());
    return tipOk && araOk;
  });

  return (
    <div>
      {/* ── Yeni Alias Ekle ── */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>
          + Yeni Alias Ekle
        </div>

        {/* Tip seçici */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { v: 'city',      l: 'Sehir (Il/Ilce)' },
            { v: 'vehicle',   l: 'Arac Tipi' },
            { v: 'body',      l: 'Kasa Tipi' },
            { v: 'blacklist', l: 'Kara Liste' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setYeniType(v)} style={S.tipBtn(yeniType === v, tipRenk(v))}>
              {l}
            </button>
          ))}
        </div>

        {/* city tipi için İl / İlçe alt seçici */}
        {yeniType === 'city' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => { setYeniAltTip('il'); setYeniDistrict(''); }}
              style={S.altTipBtn(yeniAltTip === 'il')}
            >
              Il &mdash; district: null
            </button>
            <button
              onClick={() => setYeniAltTip('ilce')}
              style={S.altTipBtn(yeniAltTip === 'ilce')}
            >
              Ilce &mdash; district: dolu
            </button>
          </div>
        )}

        {/* Alan girişleri */}
        <div style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: yeniType === 'city' && yeniAltTip === 'ilce'
            ? '1fr 1fr 1fr auto'
            : '1fr 1fr auto',
          alignItems: 'end',
        }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>Alias (ham)</div>
            <input
              style={S.input()}
              placeholder={
                yeniType === 'city'
                  ? yeniAltTip === 'ilce' ? 'Orn: finike' : 'Orn: antalya'
                  : 'Orn: tir'
              }
              value={yeniAlias}
              onChange={e => setYeniAlias(e.target.value)}
            />
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>
              {yeniType === 'city' ? 'Normalized (Il adi)' : 'Normalized (standart)'}
            </div>
            <input
              style={S.input()}
              placeholder={yeniType === 'city' ? 'Orn: Antalya' : 'Orn: TIR'}
              value={yeniNorm}
              onChange={e => setYeniNorm(e.target.value)}
            />
          </div>
          {yeniType === 'city' && yeniAltTip === 'ilce' && (
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>Ilce adi (district)</div>
              <input
                style={S.input()}
                placeholder='Orn: Finike'
                value={yeniDistrict}
                onChange={e => setYeniDistrict(e.target.value)}
              />
            </div>
          )}
          <button onClick={ekle} disabled={ekleDisabled} style={S.btn('#14532d', '#22c55e', ekleDisabled)}>
            {ekleniyor ? '...' : 'Ekle'}
          </button>
        </div>

        {mesaj && (
          <div style={{ marginTop: 8, fontSize: '0.8rem', color: mesaj.startsWith('Hata') ? '#f87171' : '#22c55e' }}>
            {mesaj}
          </div>
        )}
      </div>

      {/* ── Filtreler ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          style={{ ...S.input(), flex: 1, minWidth: 180 }}
          placeholder={`Ara... (${aliases.length} alias)`}
          value={ara}
          onChange={e => setAra(e.target.value)}
        />
        <select style={{ ...S.input(), width: 'auto' }} value={tipFiltre} onChange={e => setTipFiltre(e.target.value)}>
          <option value="">Tum tipler</option>
          {tipler.map(t => (
            <option key={t} value={t}>{t} ({aliases.filter(a => a.type === t).length})</option>
          ))}
        </select>
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : filtreli.length === 0 ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Kayit bulunamadi</div>
      ) : (
        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          {filtreli.map(a => (
            <div key={a.id} style={S.card()}>
              {duzenlenen === a.id ? (
                /* ── Düzenle satırı ── */
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Alias</div>
                      <input style={S.input()} value={duzVal.alias}
                        onChange={e => setDuzVal(p => ({ ...p, alias: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Normalized</div>
                      <input style={S.input()} value={duzVal.normalized}
                        onChange={e => setDuzVal(p => ({ ...p, normalized: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Tip</div>
                      <select style={{ ...S.input(), width: 'auto' }} value={duzVal.type}
                        onChange={e => setDuzVal(p => ({ ...p, type: e.target.value }))}>
                        <option value="city">city</option>
                        <option value="vehicle">vehicle</option>
                        <option value="body">body</option>
                        <option value="blacklist">blacklist</option>
                      </select>
                    </div>
                  </div>
                  {/* city için il/ilçe alt seçici */}
                  {duzVal.type === 'city' && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <button
                        onClick={() => { setDuzAltTip('il'); setDuzVal(p => ({ ...p, district: '' })); }}
                        style={S.altTipBtn(duzAltTip === 'il')}
                      >
                        Il (district: null)
                      </button>
                      <button onClick={() => setDuzAltTip('ilce')} style={S.altTipBtn(duzAltTip === 'ilce')}>
                        Ilce (district dolu)
                      </button>
                      {duzAltTip === 'ilce' && (
                        <input
                          style={{ ...S.input(), flex: 1 }}
                          placeholder='Ilce adi'
                          value={duzVal.district}
                          onChange={e => setDuzVal(p => ({ ...p, district: e.target.value }))}
                        />
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={duzenlemeKaydet} style={S.btn('#14532d', '#22c55e')}>Kaydet</button>
                    <button onClick={() => setDuzenlenen(null)} style={S.btn('#1c2128', '#8b949e')}>Iptal</button>
                  </div>
                </div>
              ) : (
                /* ── Normal satır ── */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                    <code style={{ color: '#e2e8f0', fontSize: '0.85rem', minWidth: 110 }}>{a.alias}</code>
                    <span style={{ color: '#484f58' }}>&rarr;</span>
                    <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>{a.normalized}</span>
                    {/* district varsa ilçe rozeti */}
                    {a.district && (
                      <span style={{ color: '#a78bfa', fontSize: '0.82rem' }}>/ {a.district}</span>
                    )}
                    <span style={S.badge(tipRenk(a.type))}>{a.type}</span>
                    {/* Il / Ilce etiketi (sadece city tipi) */}
                    {a.type === 'city' && (
                      <span style={S.badge(a.district ? '#a78bfa' : '#60a5fa')}>
                        {a.district ? 'ILCE' : 'IL'}
                      </span>
                    )}
                    {a.created_by_ai && <span style={S.badge('#f59e0b')}>AI</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
  const [noLane, setNoLane]         = useState<NoLaneData>({ raw_posts: [], listings_no_origin: [], total: 0 });
  const [loading, setLoading]       = useState(true);
  const [kesfediyor, setKesfediyor] = useState(false);
  const [limit, setLimit]           = useState(10);
  const [sonuc, setSonuc]           = useState<any>(null);
  const [acilanId, setAcilanId]     = useState<string | null>(null);
  const [temizGun, setTemizGun]     = useState(30);
  const [temizleniyor, setTemizleniyor] = useState(false);
  const [temizMesaj, setTemizMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/learn-aliases?sekme=no_lane&limit=200');
      const json = await res.json();
      setNoLane({ raw_posts: json.raw_posts ?? [], listings_no_origin: json.listings_no_origin ?? [], total: json.total ?? 0 });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  const eskileriTemizle = async () => {
    if (!confirm(`${temizGun} günden eski tüm no_lane raw_post kayıtları kalıcı silinecek. Onaylıyor musun?`)) return;
    setTemizleniyor(true); setTemizMesaj(null);
    try {
      const res  = await fetch('/api/admin/learn-aliases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean_no_lane', days: temizGun }),
      });
      const json = await res.json();
      if (json.success) {
        setTemizMesaj(`${json.deleted} kayıt silindi (${temizGun} günden eski).`);
        yukle();
      } else {
        setTemizMesaj(`Hata: ${json.error}`);
      }
    } finally { setTemizleniyor(false); }
  };

  const kesfet = async () => {
    setKesfediyor(true); setSonuc(null);
    try {
      const res = await fetch('/api/admin/learn-aliases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover', limit }),
      });
      setSonuc(await res.json());
    } finally { setKesfediyor(false); }
  };

  const toplamNoLane = noLane.total;

  return (
    <div>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>AI ile Alias Kesfi</div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: 3 }}>
              no_lane raw_post metinlerini Haiku'ya gonderir, bilinmeyen yer adlarini tespit eder.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <select style={{ ...S.input(), width: 'auto' }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
            <button onClick={kesfet} disabled={kesfediyor || toplamNoLane === 0}
              style={S.btn('#713f12', '#fbbf24', kesfediyor || toplamNoLane === 0)}>
              {kesfediyor ? 'Analiz...' : 'AI Kesfi Baslat'}
            </button>
          </div>
        </div>
        {sonuc && (
          <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, marginTop: 12 }}>
            {sonuc.error ? (
              <div style={{ color: '#f87171', fontSize: '0.85rem' }}>Hata: {sonuc.error}</div>
            ) : (
              <>
                <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.88rem', marginBottom: 8 }}>{sonuc.message}</div>
                {sonuc.suggestions?.length > 0 && (
                  <div>
                    <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: 6 }}>
                      Kaydedilen oneriler (Onay Bekleyen sekmesine gec):
                    </div>
                    {sonuc.suggestions.map((s: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: '0.82rem' }}>
                        <code style={{ color: '#e2e8f0' }}>{s.alias}</code>
                        <span style={{ color: '#484f58' }}>&rarr;</span>
                        <span style={{ color: '#22c55e' }}>{s.normalized}</span>
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: temizMesaj ? 6 : 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
          Taranmamis no_lane Kayitlar
          <span style={{ color: loading ? '#8b949e' : '#f59e0b', marginLeft: 8 }}>({loading ? '...' : toplamNoLane})</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={yukle} style={S.btn('#1e3a5f', '#60a5fa')}>Yenile</button>
          <select
            style={{ ...S.input(), width: 'auto', fontSize: '0.78rem' }}
            value={temizGun}
            onChange={e => setTemizGun(Number(e.target.value))}
          >
            <option value={1}>1 gün+</option>
            <option value={4}>4 gün+</option>
            <option value={7}>7 gün+</option>
            <option value={14}>14 gün+</option>
            <option value={30}>30 gün+</option>
            <option value={60}>60 gün+</option>
          </select>
          <button
            onClick={eskileriTemizle}
            disabled={temizleniyor || toplamNoLane === 0}
            style={S.btn('#450a0a', '#f87171', temizleniyor || toplamNoLane === 0)}
          >
            {temizleniyor ? 'Siliniyor...' : 'Eskileri Temizle'}
          </button>
        </div>
      </div>
      {temizMesaj && (
        <div style={{ marginBottom: 10, fontSize: '0.82rem', color: temizMesaj.startsWith('Hata') ? '#f87171' : '#22c55e' }}>
          {temizMesaj}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : toplamNoLane === 0 ? (
        <div style={{ background: '#161b22', border: '1px solid #22c55e30', borderRadius: 8, padding: 24, textAlign: 'center', color: '#22c55e' }}>
          Harika! Rotasi cozulemeyen kayit yok.
        </div>
      ) : (
        <div>
          {noLane.raw_posts.length > 0 && (
            <>
              <div style={{ color: '#6e7681', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                WhatsApp no_lane ({noLane.raw_posts.length})
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                {noLane.raw_posts.map(r => (
                  <div key={r.id} style={S.card()}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={S.badge('#f87171')}>no_lane</span>
                          <span style={S.badge('#f59e0b')}>taranmadi</span>
                          {r.source_group && <span style={{ color: '#484f58', fontSize: '0.75rem' }}>{r.source_group}</span>}
                          <span style={{ color: '#484f58', fontSize: '0.72rem' }}>{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
                        </div>
                        {acilanId === r.id && r.raw_text && (
                          <pre style={{ background: '#161b22', borderRadius: 6, padding: 10, fontSize: '0.75rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto', marginTop: 6 }}>
                            {r.raw_text.substring(0, 800)}
                          </pre>
                        )}
                      </div>
                      <button onClick={() => setAcilanId(acilanId === r.id ? null : r.id)} style={S.btn('#1c2128', '#8b949e')}>
                        {acilanId === r.id ? 'Kapat' : 'Metin'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {noLane.listings_no_origin.length > 0 && (
            <>
              <div style={{ color: '#6e7681', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Form ilanlari — origin_city bos ({noLane.listings_no_origin.length})
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {noLane.listings_no_origin.map(il => (
                  <div key={il.id} style={S.card()}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={S.badge('#60a5fa')}>{il.source}</span>
                          <span style={{ color: '#484f58', fontSize: '0.72rem' }}>{new Date(il.created_at).toLocaleDateString('tr-TR')}</span>
                        </div>
                        {acilanId === il.id && il.raw_text && (
                          <pre style={{ background: '#161b22', borderRadius: 6, padding: 10, fontSize: '0.75rem', color: '#c9d1d9', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 140, overflowY: 'auto', marginTop: 6 }}>
                            {il.raw_text.substring(0, 600)}
                          </pre>
                        )}
                      </div>
                      <button onClick={() => setAcilanId(acilanId === il.id ? null : il.id)} style={S.btn('#1c2128', '#8b949e')}>
                        {acilanId === il.id ? 'Kapat' : 'Metin'}
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
  const [pending, setPending]       = useState<PendingAlias[]>([]);
  const [loading, setLoading]       = useState(true);
  const [islem, setIslem]           = useState<string | null>(null);
  const [reparsing, setReparsing]   = useState(false);
  const [ilerleme, setIlerleme]     = useState({ done: 0, total: 0, ok: 0, still: 0 });
  const [reparseMsg, setReparseMsg] = useState('');

  // Kaynak satırlar: alias id -> gösterilecek satır listesi
  const [kaynaklar, setKaynaklar]   = useState<Record<number, string[]>>({});
  const [kaynakYuk, setKaynakYuk]   = useState<number | null>(null);

  // Düzenleme modu
  const [duzMod, setDuzMod]         = useState<number | null>(null);
  const [duzVal, setDuzVal]         = useState({
    alias: '', normalized: '', district: '', altTip: 'il' as 'il' | 'ilce',
  });

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/learn-aliases?sekme=pending');
      const json = await res.json();
      setPending(json.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  // ── Kaynak satırı aç/kapa ──
  const kaynakGoster = async (p: PendingAlias) => {
    if (kaynaklar[p.id] !== undefined) {
      setKaynaklar(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      return;
    }
    const ids = p.source_listing_ids ?? [];
    if (!ids.length) {
      setKaynaklar(prev => ({ ...prev, [p.id]: ['(kaynak ID kaydedilmemis)'] }));
      return;
    }
    setKaynakYuk(p.id);
    try {
      const res  = await fetch(`/api/admin/learn-aliases?sekme=source&ids=${ids.slice(0, 3).join(',')}`);
      const json = await res.json();
      const satirlar: string[] = [];
      for (const rp of (json.data ?? [])) {
        const lines: string[] = (rp.raw_text ?? '').split('\n');
        lines.forEach((line: string, i: number) => {
          if (line.toLowerCase().includes(p.alias.toLowerCase())) {
            satirlar.push(`Satir ${i + 1}: ${line.trim().substring(0, 140)}`);
          }
        });
      }
      setKaynaklar(prev => ({
        ...prev,
        [p.id]: satirlar.length ? satirlar : ['(alias bu metinlerde bulunamadi)'],
      }));
    } finally { setKaynakYuk(null); }
  };

  // ── Düzenleme başlat ──
  const duzBaslat = (p: PendingAlias) => {
    setDuzMod(p.id);
    setDuzVal({
      alias:      p.alias,
      normalized: p.normalized,
      district:   p.district ?? '',
      altTip:     p.district ? 'ilce' : 'il',
    });
  };

  // ── Onayla / Reddet (düzeltme ile veya doğrudan) ──
  const islemYap = async (id: number, action: 'approve' | 'reject') => {
    setIslem(String(id));
    try {
      const payload: Record<string, any> = { id, action };
      if (action === 'approve' && duzMod === id) {
        payload.alias      = duzVal.alias;
        payload.normalized = duzVal.normalized;
        payload.district   = duzVal.altTip === 'ilce' ? duzVal.district : null;
      }
      await fetch('/api/admin/learn-aliases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (duzMod === id) setDuzMod(null);
      yukle();
    } finally { setIslem(null); }
  };

  const topluOnayla = async () => {
    if (!confirm(`${pending.length} alias onerisi toplu onaylansin mi?`)) return;
    setIslem('bulk');
    for (const p of pending) {
      await fetch('/api/admin/learn-aliases', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, action: 'approve' }),
      });
    }
    setIslem(null); yukle();
  };

  const reparseBaslat = async () => {
    setReparsing(true); setReparseMsg(''); setIlerleme({ done: 0, total: 0, ok: 0, still: 0 });
    const idsJson = await fetch('/api/admin/reprocess-no-lane').then(r => r.json());
    const ids: string[] = idsJson.ids ?? [];
    if (ids.length === 0) { setReparseMsg('Yeniden islenecek no_lane kayit yok.'); setReparsing(false); return; }
    setIlerleme(p => ({ ...p, total: ids.length }));
    let done = 0, ok = 0, still = 0;
    for (let i = 0; i < ids.length; i += 4) {
      const results = await Promise.all(
        ids.slice(i, i + 4).map(id =>
          fetch('/api/admin/reprocess-no-lane', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_post_id: id }),
          }).then(r => r.json()).then(j => (j.lanes ?? 0) > 0 ? 'ok' : 'no').catch(() => 'err')
        )
      );
      for (const r of results) { done++; if (r === 'ok') ok++; else still++; }
      setIlerleme({ done, total: ids.length, ok, still });
    }
    setReparseMsg(`Tamamlandi: ${ok} kayit rotalandi, ${still} hala no_lane.`);
    setReparsing(false);
  };

  const pct = ilerleme.total > 0 ? Math.round((ilerleme.done / ilerleme.total) * 100) : 0;

  return (
    <div>
      {/* ── Yeniden isle paneli ── */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>Ilanlari Yeniden Isle</div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginTop: 3 }}>
              Yeni alias onaylandiktan sonra no_lane kayitlari tekrar parse motoruna gonder.
            </div>
          </div>
          <button onClick={reparseBaslat} disabled={reparsing} style={S.btn('#14532d', '#22c55e', reparsing)}>
            {reparsing ? 'Isleniyor...' : 'Yeniden Isle'}
          </button>
        </div>
        {reparsing && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#8b949e', marginBottom: 4 }}>
              <span>{ilerleme.done}/{ilerleme.total} (%{pct})</span>
              <span>{ilerleme.ok} rotalandi / {ilerleme.still} kaldi</span>
            </div>
            <div style={{ background: '#0d1117', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ background: '#22c55e', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        {reparseMsg && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#22c55e' }}>{reparseMsg}</div>}
      </div>

      {/* ── Başlık ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>
          AI Onerisi Bekleyen
          <span style={{ color: '#f59e0b', marginLeft: 8 }}>({loading ? '...' : pending.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={yukle} style={S.btn('#1e3a5f', '#60a5fa')}>Yenile</button>
          {pending.length > 0 && (
            <button onClick={topluOnayla} disabled={islem === 'bulk'} style={S.btn('#14532d', '#22c55e', islem === 'bulk')}>
              {islem === 'bulk' ? '...' : 'Tumunu Onayla'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#8b949e', textAlign: 'center', padding: 32 }}>Yukleniyor...</div>
      ) : pending.length === 0 ? (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 24, textAlign: 'center', color: '#8b949e', fontSize: '0.9rem' }}>
          Onay bekleyen AI onerisi yok.
        </div>
      ) : (
        <div style={{ maxHeight: 580, overflowY: 'auto' }}>
          {pending.map(p => (
            <div key={p.id} style={{ ...S.card(), border: '1px solid #f59e0b30' }}>

              {duzMod === p.id ? (
                /* ── Düzenleme modu ── */
                <div>
                  <div style={{ color: '#f59e0b', fontSize: '0.73rem', fontWeight: 700, marginBottom: 10 }}>
                    ✏️ Duzenleme modu — kaydet + onayla
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Alias (ham)</div>
                      <input style={{ ...S.input(), width: 130 }} value={duzVal.alias}
                        onChange={e => setDuzVal(v => ({ ...v, alias: e.target.value }))} />
                    </div>
                    <span style={{ color: '#484f58', alignSelf: 'center', paddingBottom: 2 }}>&rarr;</span>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Normalized (Il)</div>
                      <input style={{ ...S.input(), width: 140 }} value={duzVal.normalized}
                        onChange={e => setDuzVal(v => ({ ...v, normalized: e.target.value }))} />
                    </div>
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Tur</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setDuzVal(v => ({ ...v, altTip: 'il', district: '' }))} style={S.altTipBtn(duzVal.altTip === 'il')}>Il</button>
                        <button onClick={() => setDuzVal(v => ({ ...v, altTip: 'ilce' }))} style={S.altTipBtn(duzVal.altTip === 'ilce')}>Ilce</button>
                      </div>
                    </div>
                    {duzVal.altTip === 'ilce' && (
                      <div>
                        <div style={{ color: '#8b949e', fontSize: '0.7rem', marginBottom: 3 }}>Ilce (district)</div>
                        <input style={{ ...S.input(), width: 130 }} placeholder='Ilce adi' value={duzVal.district}
                          onChange={e => setDuzVal(v => ({ ...v, district: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => islemYap(p.id, 'approve')} disabled={islem === String(p.id)}
                      style={S.btn('#14532d', '#22c55e', islem === String(p.id))}>
                      {islem === String(p.id) ? '...' : '✓ Duzelt & Onayla'}
                    </button>
                    <button onClick={() => islemYap(p.id, 'reject')} disabled={islem === String(p.id)}
                      style={S.btn('#450a0a', '#f87171', islem === String(p.id))}>Reddet</button>
                    <button onClick={() => setDuzMod(null)} style={S.btn('#1c2128', '#8b949e')}>Iptal</button>
                  </div>
                </div>
              ) : (
                /* ── Normal görünüm ── */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <code style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.88rem' }}>{p.alias}</code>
                        <span style={{ color: '#484f58' }}>&rarr;</span>
                        <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.88rem' }}>{p.normalized}</span>
                        {p.district && (
                          <span style={{ color: '#a78bfa', fontSize: '0.82rem' }}>/ {p.district}</span>
                        )}
                        {p.type === 'city' && (
                          <span style={S.badge(p.district ? '#a78bfa' : '#60a5fa')}>
                            {p.district ? 'ILCE' : 'IL'}
                          </span>
                        )}
                        <span style={S.badge(tipRenk(p.type))}>{p.type}</span>
                        <span style={S.badge(p.llm_confidence >= 90 ? '#22c55e' : p.llm_confidence >= 70 ? '#f59e0b' : '#f87171')}>
                          %{p.llm_confidence}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => kaynakGoster(p)}
                        disabled={kaynakYuk === p.id}
                        style={S.btn('#1c2128', kaynaklar[p.id] !== undefined ? '#f59e0b' : '#6e7681', kaynakYuk === p.id)}
                      >
                        {kaynakYuk === p.id ? '...' : kaynaklar[p.id] !== undefined ? '▲ Kaynak' : '▼ Kaynak'}
                      </button>
                      <button onClick={() => duzBaslat(p)} style={S.btn('#1e3a5f', '#60a5fa')}>Duzenle</button>
                      <button onClick={() => islemYap(p.id, 'approve')} disabled={islem === String(p.id)}
                        style={S.btn('#14532d', '#22c55e', islem === String(p.id))}>Onayla</button>
                      <button onClick={() => islemYap(p.id, 'reject')} disabled={islem === String(p.id)}
                        style={S.btn('#450a0a', '#f87171', islem === String(p.id))}>Reddet</button>
                    </div>
                  </div>

                  {/* ── Kaynak satırlar ── */}
                  {kaynaklar[p.id] !== undefined && (
                    <div style={{ marginTop: 10, borderTop: '1px solid #21262d', paddingTop: 8 }}>
                      <div style={{ color: '#6e7681', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                        📍 Kaynak Satir
                      </div>
                      {kaynaklar[p.id].map((satir, i) => {
                        // alias'i vurgula
                        const escaped = p.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(${escaped})`, 'gi');
                        const parts = satir.split(regex);
                        return (
                          <div key={i} style={{
                            background: '#161b22', borderRadius: 4, padding: '5px 10px',
                            marginBottom: 4, fontSize: '0.77rem', fontFamily: 'monospace',
                            color: '#c9d1d9', lineHeight: 1.5,
                          }}>
                            {parts.map((part, j) =>
                              part.toLowerCase() === p.alias.toLowerCase()
                                ? <mark key={j} style={{ background: '#f59e0b33', color: '#fbbf24', borderRadius: 2, padding: '0 2px', fontWeight: 700 }}>{part}</mark>
                                : <span key={j}>{part}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
// Ana Component
// ─────────────────────────────────────────
export default function OgrenmeMerkeziClient() {
  const [aktifSekme, setAktifSekme] = useState<'aliases' | 'kesif' | 'onay'>('aliases');
  const sekmeler: Array<{ id: 'aliases' | 'kesif' | 'onay'; label: string }> = [
    { id: 'aliases', label: 'Alias Kutuphanesi' },
    { id: 'kesif',   label: 'AI Kesif Alani'   },
    { id: 'onay',    label: 'Onay Bekleyen'     },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #30363d' }}>
        {sekmeler.map(s => (
          <button key={s.id} onClick={() => setAktifSekme(s.id)} style={{
            background: aktifSekme === s.id ? '#161b22' : 'transparent',
            color: aktifSekme === s.id ? '#e2e8f0' : '#8b949e',
            border: 'none', borderBottom: aktifSekme === s.id ? '2px solid #22c55e' : '2px solid transparent',
            padding: '10px 18px', fontSize: '0.88rem', fontWeight: aktifSekme === s.id ? 700 : 400,
            cursor: 'pointer', borderRadius: '6px 6px 0 0', marginBottom: -1,
          }}>
            {s.label}
          </button>
        ))}
      </div>
      {aktifSekme === 'aliases' && <AliasSekme />}
      {aktifSekme === 'kesif'   && <KesifSekme />}
      {aktifSekme === 'onay'    && <OnaySekme />}
    </div>
  );
}
