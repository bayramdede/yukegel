'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: '#0d1117', surface: '#161b22', border: '#30363d',
  text: '#e2e8f0', muted: '#8b949e', dim: '#4b5563',
  green: '#22c55e', greenBg: '#14532d', greenDark: '#0d2b1a',
  blue: '#60a5fa', blueBg: '#1e3a5f',
  red: '#ef4444', redBg: '#7f1d1d',
  amber: '#f59e0b', amberBg: '#451a03',
};

const inp: React.CSSProperties = {
  background: C.bg, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '7px 10px', fontSize: '0.85rem',
  outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = {
  color: C.muted, fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  display: 'block', marginBottom: 4,
};

const RULE_TYPES = ['REGEX', 'PRICE_LIMIT', 'RATE_LIMIT'];
const ID_TYPES = ['PHONE', 'TAX_ID', 'IP_ADDRESS', 'DEVICE_ID'];

interface SafetyRule {
  id: string; rule_type: string; pattern: string;
  risk_weight: number; description: string | null; is_active: boolean;
  created_at: string;
}
interface BlacklistEntry {
  id: string; identifier_type: string; identifier_value: string;
  reason: string | null; blocked_at: string;
}
interface Istatistik {
  toplamShadow: number; bugunShadow: number;
  dogrulukOrani: number; toplamKural: number; toplamBlacklist: number;
}

export default function GuvenlikClient() {
  const [kurallar, setKurallar] = useState<SafetyRule[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [istatistik, setIstatistik] = useState<Istatistik | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState('');
  const [hata, setHata] = useState('');

  // Kural ekleme formu
  const [kuralForm, setKuralForm] = useState({ rule_type: 'REGEX', pattern: '', risk_weight: '30', description: '' });
  const [kuralFormAcik, setKuralFormAcik] = useState(false);

  // Düzenleme
  const [duzenleId, setDuzenleId] = useState('');
  const [duzenleData, setDuzenleData] = useState<Partial<SafetyRule>>({});

  // Blacklist ekleme formu
  const [blForm, setBlForm] = useState({ identifier_type: 'PHONE', identifier_value: '', reason: '' });
  const [blFormAcik, setBlFormAcik] = useState(false);

  async function yukle() {
    setYukleniyor(true);
    const res = await fetch('/api/admin/guvenlik');
    if (res.ok) {
      const d = await res.json();
      setKurallar(d.kurallar);
      setBlacklist(d.blacklist);
      setIstatistik(d.istatistik);
    }
    setYukleniyor(false);
  }

  useEffect(() => { yukle(); }, []);

  async function api(method: string, body: object) {
    const res = await fetch('/api/admin/guvenlik', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Hata');
    return d;
  }

  // ── Kural ekle ──
  async function kuralEkle() {
    if (!kuralForm.pattern.trim()) { setHata('Pattern zorunlu'); return; }
    setIslem('kural_ekle'); setHata('');
    try {
      const { data } = await api('POST', { tablo: 'safety_rules', ...kuralForm });
      setKurallar(prev => [data, ...prev]);
      setKuralForm({ rule_type: 'REGEX', pattern: '', risk_weight: '30', description: '' });
      setKuralFormAcik(false);
      setIstatistik(prev => prev ? { ...prev, toplamKural: prev.toplamKural + 1 } : prev);
    } catch (e: any) { setHata(e.message); }
    setIslem('');
  }

  // ── Kural toggle ──
  async function kuralToggle(kural: SafetyRule) {
    setIslem('toggle_' + kural.id);
    try {
      await api('PATCH', { id: kural.id, is_active: !kural.is_active });
      setKurallar(prev => prev.map(k => k.id === kural.id ? { ...k, is_active: !k.is_active } : k));
    } catch (e: any) { setHata((e as Error).message); }
    setIslem('');
  }

  // ── Kural düzenle kaydet ──
  async function duzenleKaydet() {
    setIslem('duzenle_' + duzenleId); setHata('');
    try {
      await api('PATCH', { id: duzenleId, ...duzenleData });
      setKurallar(prev => prev.map(k => k.id === duzenleId ? { ...k, ...duzenleData } : k));
      setDuzenleId(''); setDuzenleData({});
    } catch (e: any) { setHata((e as Error).message); }
    setIslem('');
  }

  // ── Kural sil ──
  async function kuralSil(id: string) {
    if (!confirm('Bu kural silinecek. Emin misin?')) return;
    setIslem('sil_' + id);
    try {
      await api('DELETE', { id, tablo: 'safety_rules' });
      setKurallar(prev => prev.filter(k => k.id !== id));
      setIstatistik(prev => prev ? { ...prev, toplamKural: prev.toplamKural - 1 } : prev);
    } catch (e: any) { setHata((e as Error).message); }
    setIslem('');
  }

  // ── Blacklist ekle ──
  async function blEkle() {
    if (!blForm.identifier_value.trim()) { setHata('Değer zorunlu'); return; }
    setIslem('bl_ekle'); setHata('');
    try {
      const { data } = await api('POST', { tablo: 'blacklist', ...blForm });
      setBlacklist(prev => [data, ...prev]);
      setBlForm({ identifier_type: 'PHONE', identifier_value: '', reason: '' });
      setBlFormAcik(false);
      setIstatistik(prev => prev ? { ...prev, toplamBlacklist: prev.toplamBlacklist + 1 } : prev);
    } catch (e: any) { setHata(e.message); }
    setIslem('');
  }

  // ── Blacklist sil ──
  async function blSil(id: string) {
    if (!confirm('Bu kayıt kara listeden silinecek. Emin misin?')) return;
    setIslem('bl_sil_' + id);
    try {
      await api('DELETE', { id, tablo: 'blacklist' });
      setBlacklist(prev => prev.filter(b => b.id !== id));
      setIstatistik(prev => prev ? { ...prev, toplamBlacklist: prev.toplamBlacklist - 1 } : prev);
    } catch (e: any) { setHata((e as Error).message); }
    setIslem('');
  }

  function riskRenk(w: number) {
    if (w >= 71) return { bg: '#450a0a', color: '#f87171' };
    if (w >= 31) return { bg: C.amberBg, color: C.amber };
    return { bg: C.greenDark, color: C.green };
  }

  if (yukleniyor) return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: C.dim }}>⏳ Yükleniyor...</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {hata && (
        <div style={{ background: '#1a0a0a', border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 16px', color: C.red, fontSize: '0.85rem' }}>
          ⚠️ {hata}
          <button onClick={() => setHata('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Sistem Sağlığı ── */}
      <section>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: '1rem', margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          📊 Sistem Sağlığı
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Toplam Shadow Ban', val: istatistik?.toplamShadow, color: C.red },
            { label: 'Bugün Shadow Ban', val: istatistik?.bugunShadow, color: C.amber },
            { label: 'Mod. Onay Oranı', val: `%${istatistik?.dogrulukOrani}`, color: C.green },
            { label: 'Aktif Kural', val: kurallar.filter(k => k.is_active).length, color: C.blue },
            { label: 'Kara Liste', val: istatistik?.toplamBlacklist, color: C.muted },
          ].map(k => (
            <div key={k.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ color: k.color, fontWeight: 800, fontSize: '1.8rem', lineHeight: 1 }}>{k.val ?? '—'}</div>
              <div style={{ color: C.dim, fontSize: '0.72rem', marginTop: 6 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Güvenlik Kuralları ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🛡️ Güvenlik Kuralları
            <span style={{ background: C.border, color: C.muted, fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
              {kurallar.length}
            </span>
          </h2>
          <button onClick={() => { setKuralFormAcik(f => !f); setHata(''); }}
            style={{ background: kuralFormAcik ? C.border : C.green, color: kuralFormAcik ? C.muted : '#000', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            {kuralFormAcik ? '✕ İptal' : '+ Kural Ekle'}
          </button>
        </div>

        {/* Yeni kural formu */}
        {kuralFormAcik && (
          <div style={{ background: C.bg, border: `1px solid ${C.green}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Tür</label>
                <select value={kuralForm.rule_type} onChange={e => setKuralForm(f => ({ ...f, rule_type: e.target.value }))}
                  style={{ ...inp, cursor: 'pointer' }}>
                  {RULE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Pattern / Değer</label>
                <input value={kuralForm.pattern} onChange={e => setKuralForm(f => ({ ...f, pattern: e.target.value }))}
                  placeholder={kuralForm.rule_type === 'REGEX' ? '(?i)(kaçak|yolcu)' : kuralForm.rule_type === 'PRICE_LIMIT' ? 'max:50000' : 'max:10'}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>Ağırlık</label>
                <input type="number" min={1} max={100} value={kuralForm.risk_weight}
                  onChange={e => setKuralForm(f => ({ ...f, risk_weight: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Açıklama</label>
                <input value={kuralForm.description} onChange={e => setKuralForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Kısa açıklama" style={inp} />
              </div>
            </div>
            {kuralForm.rule_type === 'PRICE_LIMIT' && (
              <div style={{ color: C.dim, fontSize: '0.72rem', marginBottom: 8 }}>
                💡 Format: <code style={{ color: C.amber }}>max:50000</code> veya <code style={{ color: C.amber }}>min:100</code>
              </div>
            )}
            <button onClick={kuralEkle} disabled={islem === 'kural_ekle'}
              style={{ background: C.green, color: '#000', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: islem === 'kural_ekle' ? 0.6 : 1 }}>
              {islem === 'kural_ekle' ? '⏳ Ekleniyor...' : '✓ Kuralı Ekle'}
            </button>
          </div>
        )}

        {/* Kural listesi */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {kurallar.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.dim }}>Kural tanımlanmamış.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Durum', 'Tür', 'Pattern', 'Ağırlık', 'Açıklama', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kurallar.map(kural => {
                  const rr = riskRenk(kural.risk_weight);
                  const duzenleniyor = duzenleId === kural.id;
                  return (
                    <tr key={kural.id} style={{ borderBottom: `1px solid #21262d`, opacity: kural.is_active ? 1 : 0.45 }}>
                      {/* Toggle */}
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => kuralToggle(kural)} disabled={!!islem}
                          style={{ background: kural.is_active ? C.greenDark : '#1f2937', color: kural.is_active ? C.green : C.dim, border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {islem === 'toggle_' + kural.id ? '⏳' : kural.is_active ? '✓ Aktif' : '○ Pasif'}
                        </button>
                      </td>
                      {/* Tür */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: C.blueBg, color: C.blue, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                          {kural.rule_type}
                        </span>
                      </td>
                      {/* Pattern */}
                      <td style={{ padding: '10px 14px', maxWidth: 300 }}>
                        {duzenleniyor ? (
                          <input value={String(duzenleData.pattern ?? kural.pattern)}
                            onChange={e => setDuzenleData(d => ({ ...d, pattern: e.target.value }))}
                            style={{ ...inp, width: 220, fontSize: '0.78rem', fontFamily: 'monospace' }} />
                        ) : (
                          <code style={{ color: C.amber, fontSize: '0.78rem', background: '#1a1200', padding: '2px 6px', borderRadius: 4, wordBreak: 'break-all' }}>
                            {kural.pattern}
                          </code>
                        )}
                      </td>
                      {/* Ağırlık */}
                      <td style={{ padding: '10px 14px' }}>
                        {duzenleniyor ? (
                          <input type="number" min={1} max={100} value={String(duzenleData.risk_weight ?? kural.risk_weight)}
                            onChange={e => setDuzenleData(d => ({ ...d, risk_weight: Number(e.target.value) }))}
                            style={{ ...inp, width: 60 }} />
                        ) : (
                          <span style={{ background: rr.bg, color: rr.color, fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                            {kural.risk_weight}
                          </span>
                        )}
                      </td>
                      {/* Açıklama */}
                      <td style={{ padding: '10px 14px', color: C.muted, fontSize: '0.82rem' }}>
                        {duzenleniyor ? (
                          <input value={String(duzenleData.description ?? kural.description ?? '')}
                            onChange={e => setDuzenleData(d => ({ ...d, description: e.target.value }))}
                            style={{ ...inp, width: 180 }} placeholder="Açıklama" />
                        ) : (
                          kural.description || <span style={{ color: C.dim }}>—</span>
                        )}
                      </td>
                      {/* Aksiyonlar */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {duzenleniyor ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={duzenleKaydet} disabled={!!islem}
                              style={{ background: C.green, color: '#000', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                              {islem === 'duzenle_' + kural.id ? '⏳' : '✓'}
                            </button>
                            <button onClick={() => { setDuzenleId(''); setDuzenleData({}); }}
                              style={{ background: '#1f2937', border: 'none', color: C.muted, borderRadius: 5, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setDuzenleId(kural.id); setDuzenleData({}); }}
                              style={{ background: C.blueBg, border: 'none', color: C.blue, borderRadius: 5, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                              Düzenle
                            </button>
                            <button onClick={() => kuralSil(kural.id)} disabled={!!islem}
                              style={{ background: 'none', border: `1px solid ${C.border}`, color: C.red, borderRadius: 5, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>
                              {islem === 'sil_' + kural.id ? '⏳' : 'Sil'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Kara Liste ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ color: C.text, fontWeight: 700, fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🚫 Kara Liste
            <span style={{ background: C.border, color: C.muted, fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
              {blacklist.length}
            </span>
          </h2>
          <button onClick={() => { setBlFormAcik(f => !f); setHata(''); }}
            style={{ background: blFormAcik ? C.border : '#450a0a', color: blFormAcik ? C.muted : '#f87171', border: blFormAcik ? 'none' : `1px solid ${C.redBg}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            {blFormAcik ? '✕ İptal' : '+ Ekle'}
          </button>
        </div>

        {/* Yeni blacklist formu */}
        {blFormAcik && (
          <div style={{ background: C.bg, border: `1px solid ${C.red}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Tanımlayıcı Tipi</label>
                <select value={blForm.identifier_type} onChange={e => setBlForm(f => ({ ...f, identifier_type: e.target.value }))}
                  style={{ ...inp, cursor: 'pointer' }}>
                  {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Değer</label>
                <input value={blForm.identifier_value} onChange={e => setBlForm(f => ({ ...f, identifier_value: e.target.value }))}
                  placeholder={blForm.identifier_type === 'PHONE' ? '+90 5xx...' : blForm.identifier_type === 'TAX_ID' ? 'Vergi No' : 'IP adresi'}
                  style={inp} />
              </div>
              <div>
                <label style={lbl}>Neden</label>
                <input value={blForm.reason} onChange={e => setBlForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Spam, dolandırıcılık..." style={inp} />
              </div>
            </div>
            <button onClick={blEkle} disabled={islem === 'bl_ekle'}
              style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: islem === 'bl_ekle' ? 0.6 : 1 }}>
              {islem === 'bl_ekle' ? '⏳ Ekleniyor...' : '🚫 Kara Listeye Ekle'}
            </button>
          </div>
        )}

        {/* Blacklist tablosu */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {blacklist.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.dim }}>Kara listede kayıt yok.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Tip', 'Değer', 'Neden', 'Tarih', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.muted, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {blacklist.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: `1px solid #21262d` }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                        {entry.identifier_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <code style={{ color: C.text, fontSize: '0.82rem' }}>{entry.identifier_value}</code>
                    </td>
                    <td style={{ padding: '10px 14px', color: C.muted, fontSize: '0.82rem' }}>
                      {entry.reason || <span style={{ color: C.dim }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: C.dim, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(entry.blocked_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => blSil(entry.id)} disabled={!!islem}
                        style={{ background: 'none', border: `1px solid ${C.border}`, color: C.red, borderRadius: 5, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>
                        {islem === 'bl_sil_' + entry.id ? '⏳' : 'Kaldır'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
