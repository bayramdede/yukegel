'use client';
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase';
import { aracEkle, aracSil, aracGuncelle } from './actions';

const supabase = createClient();

const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];

interface Vehicle {
  id: string;
  plate: string;
  vehicle_type: string;
  body_types: string[];
  brand: string | null;
  model: string | null;
  year: number | null;
  capacity_ton: number | null;
  is_active: boolean;
}

interface FormState {
  plate: string;
  vehicle_type: string;
  body_types: string[];
  brand: string;
  model: string;
  year: string;
  capacity_ton: string;
}

const bos: FormState = { plate: '', vehicle_type: '', body_types: [], brand: '', model: '', year: '', capacity_ton: '' };

const inp = { background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '9px 12px', fontSize: '0.9rem', width: '100%', outline: 'none' } as React.CSSProperties;
const lbl = { color: '#8b949e', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' };

// ─── Form bileşeni DIŞARIDA tanımlı — yeniden mount olmaz ───────
interface FormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  duzenleId: string | null;
  kaydediliyor: boolean;
  hata: string;
  onKaydet: () => void;
  onIptal: () => void;
}

function AracForm({ form, setForm, duzenleId, kaydediliyor, hata, onKaydet, onIptal }: FormProps) {
  const toggleBodyType = (u: string) =>
    setForm(f => ({ ...f, body_types: f.body_types.includes(u) ? f.body_types.filter(x => x !== u) : [...f.body_types, u] }));

  return (
    <div style={{ background: '#0d1117', border: '1px solid #22c55e', borderRadius: 10, padding: 20, marginBottom: 16 }}>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', marginBottom: 16 }}>
        {duzenleId ? 'Aracı Düzenle' : 'Yeni Araç Ekle'}
      </div>

      {/* Plaka + Araç Tipi */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Plaka *</label>
          <input
            value={form.plate}
            onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
            placeholder="34 ABC 123"
            style={inp}
          />
        </div>
        <div>
          <label style={lbl}>Araç Tipi *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
            {ARAC_TIPLERI.map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, vehicle_type: f.vehicle_type === t ? '' : t }))}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.82rem', cursor: 'pointer', fontWeight: form.vehicle_type === t ? 700 : 400, borderColor: form.vehicle_type === t ? '#22c55e' : '#30363d', background: form.vehicle_type === t ? '#14532d' : '#0d1117', color: form.vehicle_type === t ? '#22c55e' : '#8b949e' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Üst Yapı */}
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Üst Yapı <span style={{ color: '#4b5563', fontWeight: 400 }}>(çoklu seçim)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {UTSYAPI.map(u => (
            <button key={u} type="button" onClick={() => toggleBodyType(u)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', fontSize: '0.82rem', cursor: 'pointer', fontWeight: form.body_types.includes(u) ? 700 : 400, borderColor: form.body_types.includes(u) ? '#60a5fa' : '#30363d', background: form.body_types.includes(u) ? '#1e3a5f' : '#0d1117', color: form.body_types.includes(u) ? '#60a5fa' : '#8b949e' }}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Marka + Model + Yıl + Kapasite */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Marka</label>
          <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Mercedes" style={inp} />
        </div>
        <div>
          <label style={lbl}>Model</label>
          <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Actros" style={inp} />
        </div>
        <div>
          <label style={lbl}>Yıl</label>
          <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2020" style={inp} />
        </div>
        <div>
          <label style={lbl}>Kapasite (ton)</label>
          <input type="number" step="0.1" value={form.capacity_ton} onChange={e => setForm(f => ({ ...f, capacity_ton: e.target.value }))} placeholder="20" style={inp} />
        </div>
      </div>

      {hata && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>⚠️ {hata}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onKaydet} disabled={kaydediliyor}
          style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.9rem', padding: '9px 24px', borderRadius: 7, border: 'none', cursor: 'pointer' }}>
          {kaydediliyor ? 'Kaydediliyor...' : duzenleId ? 'Güncelle' : 'Kaydet'}
        </button>
        <button type="button" onClick={onIptal}
          style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', fontSize: '0.9rem', padding: '9px 20px', borderRadius: 7, cursor: 'pointer' }}>
          İptal
        </button>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────
export default function Araclarim() {
  const [araclar, setAraclar] = useState<Vehicle[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(bos);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState('');
  const [silOnay, setSilOnay] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/giris'; return; }
      await araclariYukle(user.id);
    }
    init();
  }, []);

  async function araclariYukle(userId?: string) {
    setYukleniyor(true);
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    setAraclar(data || []);
    setYukleniyor(false);
  }

  function duzenleAc(arac: Vehicle) {
    setDuzenleId(arac.id);
    setForm({ plate: arac.plate, vehicle_type: arac.vehicle_type, body_types: arac.body_types || [], brand: arac.brand || '', model: arac.model || '', year: arac.year?.toString() || '', capacity_ton: arac.capacity_ton?.toString() || '' });
    setFormAcik(false);
  }

  function formKapat() {
    setFormAcik(false);
    setDuzenleId(null);
    setForm(bos);
    setHata('');
  }

  async function handleKaydet() {
    if (!form.plate || !form.vehicle_type) { setHata('Plaka ve araç tipi zorunludur.'); return; }
    setKaydediliyor(true);
    setHata('');
    try {
      if (duzenleId) await aracGuncelle(duzenleId, form);
      else await aracEkle(form);
      formKapat();
      await araclariYukle();
    } catch (err: any) {
      setHata(err.message || 'Bir hata oluştu.');
    } finally {
      setKaydediliyor(false);
    }
  }

  async function handleSil(id: string) {
    setKaydediliyor(true);
    try {
      await aracSil(id);
      setSilOnay(null);
      await araclariYukle();
    } catch (err: any) {
      setHata(err.message);
    } finally {
      setKaydediliyor(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          <a href="/panel" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>← Panel</a>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', margin: 0 }}>Araçlarım</h1>
          {!formAcik && !duzenleId && (
            <button type="button" onClick={() => { setFormAcik(true); setDuzenleId(null); setForm(bos); }}
              style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer' }}>
              + Araç Ekle
            </button>
          )}
        </div>

        {(formAcik || duzenleId) && (
          <AracForm
            form={form}
            setForm={setForm}
            duzenleId={duzenleId}
            kaydediliyor={kaydediliyor}
            hata={hata}
            onKaydet={handleKaydet}
            onIptal={formKapat}
          />
        )}

        {yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>⏳ Yükleniyor...</div>
        ) : araclar.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚛</div>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#8b949e' }}>Henüz araç eklenmemiş</div>
            <div style={{ fontSize: '0.85rem' }}>Araç ilanı verebilmek için araç eklemeniz gerekiyor.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {araclar.map(arac => (
              <div key={arac.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ background: '#1a2535', color: '#60a5fa', fontWeight: 800, fontSize: '1rem', padding: '4px 12px', borderRadius: 6, letterSpacing: '0.05em' }}>
                        {arac.plate}
                      </span>
                      <span style={{ background: '#14532d', color: '#86efac', fontWeight: 700, fontSize: '0.78rem', padding: '3px 10px', borderRadius: 5 }}>
                        🚛 {arac.vehicle_type}
                      </span>
                    </div>
                    {arac.body_types?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                        {arac.body_types.map(u => (
                          <span key={u} style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{u}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {arac.brand && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{arac.brand}{arac.model ? ` ${arac.model}` : ''}</span>}
                      {arac.year && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{arac.year}</span>}
                      {arac.capacity_ton && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>⚖ {arac.capacity_ton} ton</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => duzenleAc(arac)}
                      style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      Düzenle
                    </button>
                    {silOnay === arac.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => handleSil(arac.id)}
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          Sil
                        </button>
                        <button type="button" onClick={() => setSilOnay(null)}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #30363d', background: 'none', color: '#8b949e', fontSize: '0.75rem', cursor: 'pointer' }}>
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSilOnay(arac.id)}
                        style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #374151', background: 'none', color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
