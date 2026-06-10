'use client';
import { useState, useEffect, useRef } from 'react';

const C = {
  bg: '#0d1117', surface: '#161b22', border: '#30363d',
  text: '#e2e8f0', muted: '#8b949e', dim: '#4b5563',
  green: '#22c55e', greenBg: '#14532d', greenDark: '#0d2b1a',
  red: '#ef4444', redBg: '#7f1d1d',
  amber: '#f59e0b', amberBg: '#451a03',
  blue: '#60a5fa', blueBg: '#1e3a5f',
};

const inp: React.CSSProperties = {
  background: C.bg, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '6px 10px', fontSize: '0.82rem',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const lbl: React.CSSProperties = {
  color: C.muted, fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  display: 'block', marginBottom: 4,
};

const KATEGORI_LIST = [
  { value: 'park_dinlenme',   label: '🅿️ Park & Dinlenme' },
  { value: 'yemek',           label: '🍲 Yemek' },
  { value: 'konaklama',       label: '🛏️ Konaklama' },
  { value: 'tamirci',         label: '🛠️ Tamirci & Usta' },
  { value: 'tesis_akaryakit', label: '⛽ Tesis & Akaryakıt' },
  { value: 'kantar_resmi',    label: '⚖️ Kantar & Resmi' },
];

const KATEGORI: Record<string, string> = Object.fromEntries(
  KATEGORI_LIST.map(k => [k.value, k.label])
);

// Excel'den gelen kategori değerlerini normalize et
const KAT_NORM: Record<string, string> = {
  park_dinlenme: 'park_dinlenme', 'park & dinlenme': 'park_dinlenme', 'park ve dinlenme': 'park_dinlenme',
  yemek: 'yemek',
  konaklama: 'konaklama',
  tamirci: 'tamirci', 'tamirci & usta': 'tamirci', 'tamirci ve usta': 'tamirci',
  tesis_akaryakit: 'tesis_akaryakit', 'tesis & akaryakıt': 'tesis_akaryakit',
  'tesis & akaryakit': 'tesis_akaryakit', 'tesis ve akaryakıt': 'tesis_akaryakit',
  kantar_resmi: 'kantar_resmi', 'kantar & resmi': 'kantar_resmi', 'kantar ve resmi': 'kantar_resmi',
};

function normalizeKategori(val: string): string | null {
  const clean = val.toLowerCase().replace(/[🅿️🍲🛏️🛠️⛽⚖️]/gu, '').trim();
  return KAT_NORM[clean] ?? null;
}

async function sablonIndir() {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const veri = [
    ['Ad', 'Kategori', 'Şehir', 'İlçe', 'Adres', 'Adres Tarifi', 'Enlem', 'Boylam', 'Acil'],
    ['Örnek Tır Parkı', 'park_dinlenme', 'İstanbul', 'Sultangazi', 'E-5 Karayolu No:1', 'E-5 üzerinde kırmızı çatılı tesis', 41.015137, 28.97953, 'HAYIR'],
    ['Şoför Sofrası', 'yemek', 'Ankara', 'Sincan', '', '', 39.9334, 32.8597, 'HAYIR'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(veri), 'POI Listesi');

  const rehber = [
    ['Kategori Kodu', 'Görünen Ad'],
    ['park_dinlenme',   '🅿️ Park & Dinlenme'],
    ['yemek',           '🍲 Yemek'],
    ['konaklama',       '🛏️ Konaklama'],
    ['tamirci',         '🛠️ Tamirci & Usta'],
    ['tesis_akaryakit', '⛽ Tesis & Akaryakıt'],
    ['kantar_resmi',    '⚖️ Kantar & Resmi'],
    [],
    ['Acil Sütunu', '"EVET" veya "HAYIR"'],
    ['Koordinat', 'Ondalık derece formatı (ör: 41.015137)'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rehber), 'Rehber');

  XLSX.writeFile(wb, 'yukegel_poi_sablonu.xlsx');
}

async function parseExcel(file: File): Promise<{
  valid: PoiInput[];
  errors: { satir: number; ad: string; hatalar: string[] }[];
}> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const valid: PoiInput[] = [];
  const errors: { satir: number; ad: string; hatalar: string[] }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.every(c => c === undefined || c === null || c === '')) continue;

    const [ad, kat, sehir, ilce, adres, adresTarifi, enlem, boylam, acil] = row;
    const adStr = String(ad ?? '').trim();
    const hatalar: string[] = [];

    if (!adStr) hatalar.push('Ad zorunlu');

    const katNorm = normalizeKategori(String(kat ?? ''));
    if (!katNorm) hatalar.push(`Geçersiz kategori: "${kat}"`);

    const lat = parseFloat(String(enlem ?? ''));
    const lng = parseFloat(String(boylam ?? ''));
    if (isNaN(lat) || lat < -90  || lat > 90)  hatalar.push('Geçersiz enlem');
    if (isNaN(lng) || lng < -180 || lng > 180) hatalar.push('Geçersiz boylam');

    if (hatalar.length > 0) {
      errors.push({ satir: i + 1, ad: adStr, hatalar });
    } else {
      valid.push({
        name:         adStr,
        category:     katNorm!,
        city:         String(sehir ?? '').trim() || null,
        district:     String(ilce  ?? '').trim() || null,
        address:      String(adres ?? '').trim() || null,
        address_note: String(adresTarifi ?? '').trim() || null,
        latitude:  lat,
        longitude: lng,
        is_emergency: String(acil ?? '').toUpperCase() === 'EVET',
      });
    }
  }

  return { valid, errors };
}

// ─── Interfaces ───────────────────────────────────────────

interface PoiInput {
  name: string; category: string;
  city: string | null; district: string | null;
  address: string | null; address_note: string | null;
  latitude: number; longitude: number;
  is_emergency: boolean;
}

interface Poi extends PoiInput {
  id: string; status: string; added_by: string | null;
  created_at: string;
  ekleyen: { display_name: string | null; email: string | null } | null;
}

interface DuzenleFormProps {
  poi: Poi;
  onKaydet: (id: string, fields: Partial<Poi>) => Promise<void>;
  onIptal: () => void;
  kayitYukleniyor: boolean;
}

interface YeniEkleFormProps {
  onKaydet: (fields: PoiInput) => Promise<void>;
  onIptal: () => void;
  kayitYukleniyor: boolean;
}

// ─── Ortak form grid ──────────────────────────────────────

function FormGrid({ form, set, showButtons, onKaydet, onIptal, kayitYukleniyor, btnLabel }: {
  form: Record<string, string | boolean>;
  set: (f: string, v: string | boolean) => void;
  showButtons: boolean;
  onKaydet: () => void;
  onIptal: () => void;
  kayitYukleniyor: boolean;
  btnLabel: string;
}) {
  const isValid = String(form.name ?? '').trim() && form.category &&
    !isNaN(parseFloat(String(form.latitude))) && !isNaN(parseFloat(String(form.longitude)));
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>Konum Adı *</label><input style={inp} value={String(form.name)} onChange={e => set('name', e.target.value)} placeholder="Güven Tır Parkı" /></div>
        <div>
          <label style={lbl}>Kategori *</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={String(form.category)} onChange={e => set('category', e.target.value)}>
            <option value="">— Seçin —</option>
            {KATEGORI_LIST.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Şehir</label><input style={inp} value={String(form.city)} onChange={e => set('city', e.target.value)} placeholder="İstanbul" /></div>
        <div><label style={lbl}>İlçe</label><input style={inp} value={String(form.district)} onChange={e => set('district', e.target.value)} placeholder="Kadıköy" /></div>
        <div><label style={lbl}>Enlem *</label><input style={inp} type="number" step="0.000001" value={String(form.latitude)} onChange={e => set('latitude', e.target.value)} placeholder="41.015137" /></div>
        <div><label style={lbl}>Boylam *</label><input style={inp} type="number" step="0.000001" value={String(form.longitude)} onChange={e => set('longitude', e.target.value)} placeholder="28.979530" /></div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(form.is_emergency)} onChange={e => set('is_emergency', e.target.checked)} style={{ accentColor: C.red, width: 16, height: 16 }} />
            <span style={{ color: C.muted, fontSize: '0.82rem', fontWeight: 600 }}>🆘 Acil/SOS</span>
          </label>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div><label style={lbl}>Adres</label><input style={inp} value={String(form.address)} onChange={e => set('address', e.target.value)} placeholder="E-5 No:12" /></div>
        <div><label style={lbl}>Adres Tarifi</label><input style={inp} value={String(form.address_note)} onChange={e => set('address_note', e.target.value)} placeholder="Kavşaktan sağa dön..." /></div>
      </div>
      {showButtons && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onKaydet} disabled={kayitYukleniyor || !isValid}
            style={{ background: C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '6px 18px', fontSize: '0.82rem', fontWeight: 700, cursor: kayitYukleniyor || !isValid ? 'not-allowed' : 'pointer', opacity: kayitYukleniyor || !isValid ? 0.5 : 1 }}>
            {kayitYukleniyor ? '...' : btnLabel}
          </button>
          <button onClick={onIptal} disabled={kayitYukleniyor}
            style={{ background: 'none', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            İptal
          </button>
        </div>
      )}
    </>
  );
}

// ─── DuzenleForm ─────────────────────────────────────────

function DuzenleForm({ poi, onKaydet, onIptal, kayitYukleniyor }: DuzenleFormProps) {
  const [form, setForm] = useState<Record<string, string | boolean>>({
    name: poi.name, category: poi.category,
    city: poi.city ?? '', district: poi.district ?? '',
    address: poi.address ?? '', address_note: poi.address_note ?? '',
    latitude: String(poi.latitude), longitude: String(poi.longitude),
    is_emergency: poi.is_emergency,
  });
  function set(f: string, v: string | boolean) { setForm(prev => ({ ...prev, [f]: v })); }
  function kaydet() {
    onKaydet(poi.id, {
      name: String(form.name).trim(), category: String(form.category),
      city: String(form.city).trim() || null, district: String(form.district).trim() || null,
      address: String(form.address).trim() || null, address_note: String(form.address_note).trim() || null,
      latitude: parseFloat(String(form.latitude)), longitude: parseFloat(String(form.longitude)),
      is_emergency: Boolean(form.is_emergency),
    });
  }
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 14 }}>
      <FormGrid form={form} set={set} showButtons onKaydet={kaydet} onIptal={onIptal} kayitYukleniyor={kayitYukleniyor} btnLabel="💾 Kaydet" />
    </div>
  );
}

// ─── YeniEkleForm ─────────────────────────────────────────

function YeniEkleForm({ onKaydet, onIptal, kayitYukleniyor }: YeniEkleFormProps) {
  const [form, setForm] = useState<Record<string, string | boolean>>({
    name: '', category: '', city: '', district: '',
    address: '', address_note: '', latitude: '', longitude: '', is_emergency: false,
  });
  function set(f: string, v: string | boolean) { setForm(prev => ({ ...prev, [f]: v })); }
  function kaydet() {
    onKaydet({
      name: String(form.name).trim(), category: String(form.category),
      city: String(form.city).trim() || null, district: String(form.district).trim() || null,
      address: String(form.address).trim() || null, address_note: String(form.address_note).trim() || null,
      latitude: parseFloat(String(form.latitude)), longitude: parseFloat(String(form.longitude)),
      is_emergency: Boolean(form.is_emergency),
    });
  }
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem', marginBottom: 14 }}>➕ Yeni Konum (Direkt Onaylı)</div>
      <FormGrid form={form} set={set} showButtons onKaydet={kaydet} onIptal={onIptal} kayitYukleniyor={kayitYukleniyor} btnLabel="✅ Ekle" />
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────

export default function PoiOnayClient() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<Record<string, 'onay' | 'ret'>>({});
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [gosterilen, setGosterilen] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Tekil ekleme
  const [ekleAcik, setEkleAcik] = useState(false);

  // Excel
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [excelGecerli, setExcelGecerli] = useState<PoiInput[]>([]);
  const [excelHatalar, setExcelHatalar] = useState<{ satir: number; ad: string; hatalar: string[] }[]>([]);
  const [excelDosyaAdi, setExcelDosyaAdi] = useState('');
  const [topluYukleniyor, setTopluYukleniyor] = useState(false);
  const [topluSonuc, setTopluSonuc] = useState('');

  async function yukle(status: 'pending' | 'approved' | 'rejected') {
    setYukleniyor(true); setHata(''); setDuzenleId(null);
    try {
      const res = await fetch(`/api/admin/poi?status=${status}`);
      const d = await res.json();
      if (d.success) setPois(d.data);
      else setHata(d.error || 'Veriler alınamadı.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setYukleniyor(false); }
  }

  useEffect(() => { yukle(gosterilen); }, [gosterilen]);

  async function durumGuncelle(id: string, status: 'approved' | 'rejected') {
    setIslem(prev => ({ ...prev, [id]: status === 'approved' ? 'onay' : 'ret' }));
    try {
      const res = await fetch(`/api/poi/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const d = await res.json();
      if (d.success) { setPois(prev => prev.filter(p => p.id !== id)); if (duzenleId === id) setDuzenleId(null); }
      else setHata(d.error || 'İşlem başarısız.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setIslem(prev => { const s = { ...prev }; delete s[id]; return s; }); }
  }

  async function icerikGuncelle(id: string, fields: Partial<Poi>) {
    setKayitYukleniyor(true); setHata('');
    try {
      const res = await fetch(`/api/poi/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      const d = await res.json();
      if (d.success) { setPois(prev => prev.map(p => p.id === id ? { ...p, ...d.data } : p)); setDuzenleId(null); }
      else setHata(d.error || 'Güncelleme başarısız.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setKayitYukleniyor(false); }
  }

  async function yeniPoiEkle(fields: PoiInput) {
    setKayitYukleniyor(true); setHata('');
    try {
      const res = await fetch('/api/admin/poi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      const d = await res.json();
      if (d.success) {
        setEkleAcik(false);
        if (gosterilen === 'approved') yukle('approved');
      } else {
        setHata(d.error || 'Ekleme başarısız.');
      }
    } catch { setHata('Bağlantı hatası.'); }
    finally { setKayitYukleniyor(false); }
  }

  async function handleDosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelDosyaAdi(file.name);
    setTopluSonuc('');
    setHata('');
    try {
      const { valid, errors } = await parseExcel(file);
      setExcelGecerli(valid);
      setExcelHatalar(errors);
    } catch {
      setHata('Excel dosyası okunamadı.');
      setExcelGecerli([]); setExcelHatalar([]);
    }
    e.target.value = '';
  }

  async function topluYukle() {
    if (excelGecerli.length === 0) return;
    setTopluYukleniyor(true); setTopluSonuc(''); setHata('');
    try {
      const res = await fetch('/api/admin/poi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(excelGecerli) });
      const d = await res.json();
      if (d.success) {
        setTopluSonuc(`✅ ${d.inserted} konum eklendi.`);
        setExcelGecerli([]); setExcelHatalar([]); setExcelDosyaAdi('');
        if (gosterilen === 'approved') yukle('approved');
      } else {
        setHata(d.error || 'Toplu yükleme başarısız.');
      }
    } catch { setHata('Bağlantı hatası.'); }
    finally { setTopluYukleniyor(false); }
  }

  function excelTemizle() {
    setExcelGecerli([]); setExcelHatalar([]); setExcelDosyaAdi(''); setTopluSonuc('');
  }

  const tabs = [
    { key: 'pending'  as const, label: '⏳ Bekleyenler' },
    { key: 'approved' as const, label: '✅ Onaylananlar' },
    { key: 'rejected' as const, label: '❌ Reddedilenler' },
  ];

  const onizlemeVar = excelGecerli.length > 0 || excelHatalar.length > 0;

  return (
    <div>

      {/* ── Aksiyon çubuğu ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => { setEkleAcik(v => !v); excelTemizle(); }}
          style={{ background: ekleAcik ? C.greenBg : C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '7px 16px', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>
          {ekleAcik ? '✕ İptal' : '➕ Yeni Konum Ekle'}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={sablonIndir}
          style={{ background: 'none', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 14px', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
          📥 Excel Şablonu İndir
        </button>
        <button onClick={() => { setEkleAcik(false); dosyaRef.current?.click(); }}
          style={{ background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBg}`, borderRadius: 6, padding: '7px 14px', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>
          📤 Excel'den Yükle
        </button>
        <input ref={dosyaRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleDosyaSec} />
      </div>

      {/* ── Tekil ekleme formu ── */}
      {ekleAcik && (
        <YeniEkleForm
          onKaydet={yeniPoiEkle}
          onIptal={() => setEkleAcik(false)}
          kayitYukleniyor={kayitYukleniyor}
        />
      )}

      {/* ── Excel önizleme ── */}
      {onizlemeVar && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ color: C.muted, fontSize: '0.82rem' }}>📄 {excelDosyaAdi}</span>
            {excelGecerli.length > 0 && (
              <span style={{ background: C.greenDark, color: C.green, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                {excelGecerli.length} geçerli satır
              </span>
            )}
            {excelHatalar.length > 0 && (
              <span style={{ background: C.redBg, color: C.red, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                {excelHatalar.length} hatalı satır
              </span>
            )}
            <button onClick={excelTemizle} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '0.82rem' }}>✕ Temizle</button>
          </div>

          {excelGecerli.length > 0 && (
            <>
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      {['Ad', 'Kategori', 'Şehir', 'İlçe', 'Enlem', 'Boylam', 'Acil'].map(h => (
                        <th key={h} style={{ color: C.muted, fontWeight: 700, padding: '4px 8px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelGecerli.slice(0, 8).map((r, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '4px 8px', color: C.text }}>{r.name}</td>
                        <td style={{ padding: '4px 8px', color: C.muted }}>{KATEGORI[r.category] ?? r.category}</td>
                        <td style={{ padding: '4px 8px', color: C.muted }}>{r.city ?? '—'}</td>
                        <td style={{ padding: '4px 8px', color: C.muted }}>{r.district ?? '—'}</td>
                        <td style={{ padding: '4px 8px', color: C.dim }}>{r.latitude}</td>
                        <td style={{ padding: '4px 8px', color: C.dim }}>{r.longitude}</td>
                        <td style={{ padding: '4px 8px', color: r.is_emergency ? C.red : C.dim }}>{r.is_emergency ? 'Evet' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelGecerli.length > 8 && (
                  <div style={{ color: C.dim, fontSize: '0.75rem', padding: '4px 8px' }}>… ve {excelGecerli.length - 8} satır daha</div>
                )}
              </div>
              <button onClick={topluYukle} disabled={topluYukleniyor}
                style={{ background: C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700, cursor: topluYukleniyor ? 'wait' : 'pointer', opacity: topluYukleniyor ? 0.6 : 1 }}>
                {topluYukleniyor ? 'Yükleniyor...' : `✅ Yükle (${excelGecerli.length} konum)`}
              </button>
            </>
          )}

          {excelHatalar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: C.red, fontSize: '0.78rem', fontWeight: 700, marginBottom: 6 }}>Hatalı satırlar:</div>
              {excelHatalar.map((h, i) => (
                <div key={i} style={{ color: C.muted, fontSize: '0.76rem', marginBottom: 3 }}>
                  <span style={{ color: C.red }}>Satır {h.satir}</span>
                  {h.ad && <span style={{ color: C.dim }}> — {h.ad}</span>}
                  <span style={{ color: C.dim }}>: {h.hatalar.join(', ')}</span>
                </div>
              ))}
            </div>
          )}

          {topluSonuc && (
            <div style={{ color: C.green, fontSize: '0.85rem', fontWeight: 700, marginTop: 10 }}>{topluSonuc}</div>
          )}
        </div>
      )}

      {/* ── Hata banner ── */}
      {hata && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
          ⚠️ {hata}
        </div>
      )}

      {/* ── Sekme çubuğu ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setGosterilen(t.key)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, color: gosterilen === t.key ? C.green : C.muted, borderBottom: gosterilen === t.key ? `2px solid ${C.green}` : '2px solid transparent', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
        <button onClick={() => yukle(gosterilen)}
          style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>
          🔄 Yenile
        </button>
      </div>

      {/* ── Liste ── */}
      {yukleniyor ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim }}>Yükleniyor...</div>
      ) : pois.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 600, color: C.muted }}>{gosterilen === 'pending' ? 'Bekleyen POI yok.' : 'Kayıt bulunamadı.'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pois.map(poi => (
            <div key={poi.id} style={{ background: C.surface, border: `1px solid ${duzenleId === poi.id ? C.blue : C.border}`, borderRadius: 8, padding: '14px 16px', transition: 'border-color 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: '0.95rem' }}>{poi.name}</span>
                    {poi.is_emergency && <span style={{ background: C.redBg, color: C.red, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>🆘 ACİL</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ color: C.muted, fontSize: '0.8rem' }}>{KATEGORI[poi.category] ?? poi.category}</span>
                    {poi.city && <span style={{ color: C.dim, fontSize: '0.8rem' }}>📍 {poi.city}</span>}
                    <span style={{ color: C.dim, fontSize: '0.78rem' }}>{poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}</span>
                  </div>
                  <div style={{ color: C.dim, fontSize: '0.75rem' }}>
                    Ekleyen: <span style={{ color: C.muted }}>{poi.ekleyen?.display_name || poi.ekleyen?.email || (poi.added_by ? 'Kayıtlı kullanıcı' : 'Anonim')}</span>
                    {' · '}
                    {new Date(poi.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <a href={`https://maps.google.com/?q=${poi.latitude},${poi.longitude}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.muted, fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  🗺️ Haritada gör
                </a>
                <button onClick={() => setDuzenleId(duzenleId === poi.id ? null : poi.id)}
                  style={{ background: duzenleId === poi.id ? C.blueBg : 'transparent', color: C.blue, border: `1px solid ${C.blueBg}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {duzenleId === poi.id ? '✕ Kapat' : '✏️ Düzenle'}
                </button>
                {gosterilen === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => durumGuncelle(poi.id, 'approved')} disabled={!!islem[poi.id]}
                      style={{ background: islem[poi.id] === 'onay' ? C.greenBg : C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: islem[poi.id] ? 'wait' : 'pointer', opacity: islem[poi.id] && islem[poi.id] !== 'onay' ? 0.4 : 1 }}>
                      {islem[poi.id] === 'onay' ? '...' : '✅ Onayla'}
                    </button>
                    <button onClick={() => durumGuncelle(poi.id, 'rejected')} disabled={!!islem[poi.id]}
                      style={{ background: islem[poi.id] === 'ret' ? C.redBg : 'transparent', color: C.red, border: `1px solid ${C.redBg}`, borderRadius: 6, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: islem[poi.id] ? 'wait' : 'pointer', opacity: islem[poi.id] && islem[poi.id] !== 'ret' ? 0.4 : 1 }}>
                      {islem[poi.id] === 'ret' ? '...' : '❌ Reddet'}
                    </button>
                  </div>
                )}
              </div>
              {duzenleId === poi.id && (
                <DuzenleForm poi={poi} onKaydet={icerikGuncelle} onIptal={() => setDuzenleId(null)} kayitYukleniyor={kayitYukleniyor} />
              )}
            </div>
          ))}
        </div>
      )}

      {!yukleniyor && pois.length > 0 && (
        <div style={{ color: C.dim, fontSize: '0.78rem', marginTop: 16, textAlign: 'right' }}>{pois.length} kayıt</div>
      )}
    </div>
  );
}
