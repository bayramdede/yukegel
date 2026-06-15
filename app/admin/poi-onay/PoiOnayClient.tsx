'use client';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const PinHarita = dynamic(() => import('./PinHarita'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: 300, background: '#0d1117', borderRadius: 8,
      border: '1px solid #30363d', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#4b5563', fontSize: '0.82rem',
    }}>
      Harita yükleniyor...
    </div>
  ),
});

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
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
};

const lbl: React.CSSProperties = {
  color: C.muted, fontSize: '0.7rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  display: 'block', marginBottom: 4,
};

const KATEGORI_LIST = [
  // Yeni TIR/Kamyon kategorileri
  { value: 'motorcu',       label: '🔧 Motorcu' },
  { value: 'elektrikci',    label: '⚡ Elektrikçi' },
  { value: 'kaportaci',     label: '🔨 Kaportacı' },
  { value: 'lastikci',      label: '🔄 Lastikçi' },
  { value: 'dorse_branda',  label: '🚛 Dorse / Branda' },
  { value: 'frigo_ustasi',  label: '❄️ Frigo Ustası' },
  { value: 'tir_parki',     label: '🅿️ Tır Parkı' },
  { value: 'lokanta',       label: '🍲 Kamyoncu Lokantası' },
  { value: 'konaklama',     label: '🛏️ Konaklama' },
  { value: 'kantar',        label: '⚖️ Kantar' },
  { value: 'yikama',        label: '🚿 Yıkama / Yağlama' },
  // Eski kategoriler (geriye uyumluluk)
  { value: 'park_dinlenme',   label: '🅿️ Park & Dinlenme (eski)' },
  { value: 'yemek',           label: '🍲 Yemek (eski)' },
  { value: 'tamirci',         label: '🛠️ Tamirci & Usta (eski)' },
  { value: 'tesis_akaryakit', label: '⛽ Tesis & Akaryakıt (eski)' },
  { value: 'kantar_resmi',    label: '⚖️ Kantar & Resmi (eski)' },
];

const KATEGORI: Record<string, string> = Object.fromEntries(
  KATEGORI_LIST.map(k => [k.value, k.label])
);

const ETIKET_ONERILERI = [
  '7/24 Açık', 'Tır Park Yeri Var', 'Güvenlik Kameralı', 'Duş İmkanı',
  'WC', 'Kamyoncu Dostu', 'Sulu Yemek', 'Nöbetçi', 'Çekici',
  'Uygun Fiyat', 'Dorseyi Ayırmaya Gerek Yok',
];

const SORT_OPTIONS = [
  { value: 'created_at',  label: 'Tarih' },
  { value: 'name',        label: 'Ad' },
  { value: 'avg_rating',  label: 'Puan' },
  { value: 'review_count', label: 'Yorum Sayısı' },
  { value: 'city',        label: 'Şehir' },
];

// TÜRKİYE İLLERİ (81 il)
const ILLER = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
  'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
  'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak',
  'Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan',
  'Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

// Excel kategori normalize
const KAT_NORM: Record<string, string> = {
  park_dinlenme: 'park_dinlenme', 'park & dinlenme': 'park_dinlenme', 'park ve dinlenme': 'park_dinlenme',
  yemek: 'yemek',
  konaklama: 'konaklama',
  tamirci: 'tamirci', 'tamirci & usta': 'tamirci', 'tamirci ve usta': 'tamirci',
  tesis_akaryakit: 'tesis_akaryakit', 'tesis & akaryakıt': 'tesis_akaryakit',
  'tesis & akaryakit': 'tesis_akaryakit', 'tesis ve akaryakıt': 'tesis_akaryakit',
  kantar_resmi: 'kantar_resmi', 'kantar & resmi': 'kantar_resmi', 'kantar ve resmi': 'kantar_resmi',
  motorcu: 'motorcu',
  elektrikci: 'elektrikci',
  kaportaci: 'kaportaci',
  lastikci: 'lastikci',
  dorse_branda: 'dorse_branda', 'dorse / branda': 'dorse_branda',
  frigo_ustasi: 'frigo_ustasi', 'frigo ustası': 'frigo_ustasi',
  tir_parki: 'tir_parki', 'tır parkı': 'tir_parki',
  lokanta: 'lokanta',
  kantar: 'kantar',
  yikama: 'yikama',
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
    [], ['Acil Sütunu', '"EVET" veya "HAYIR"'],
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
        name: adStr, category: katNorm!,
        city: String(sehir ?? '').trim() || null, district: String(ilce ?? '').trim() || null,
        address: String(adres ?? '').trim() || null, address_note: String(adresTarifi ?? '').trim() || null,
        phone: null, website: null, description: null, tags: [],
        latitude: lat, longitude: lng,
        is_emergency: String(acil ?? '').toUpperCase() === 'EVET',
      });
    }
  }
  return { valid, errors };
}

// ─── Interfaces ───────────────────────────────────────────

interface PoiInput {
  name: string; description: string | null; category: string;
  city: string | null; district: string | null;
  address: string | null; address_note: string | null;
  phone: string | null; website: string | null;
  tags: string[];
  latitude: number; longitude: number;
  is_emergency: boolean;
}

interface Poi extends PoiInput {
  id: string; status: string; added_by: string | null;
  created_at: string;
  avg_rating: number | null;
  review_count: number;
  ekleyen: { display_name: string | null; email: string | null } | null;
}

// Form state — tüm alanlar string | boolean | string[]
type FormState = Record<string, string | boolean | string[]>;

interface FormGridProps {
  form: FormState;
  set: (f: string, v: string | boolean | string[]) => void;
  showButtons: boolean;
  onKaydet: () => void;
  onIptal: () => void;
  kayitYukleniyor: boolean;
  btnLabel: string;
  onCoordinatesSet?: (lat: string, lng: string) => void;
}

// ─── GPS hook ────────────────────────────────────────────

function useGps(
  setLatLng: (lat: string, lng: string) => void,
  onSuccess?: (lat: string, lng: string) => void,
) {
  const [durum, setDurum] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [hata, setHata] = useState('');
  function al() {
    if (!navigator.geolocation) { setDurum('error'); setHata('Tarayıcı konum desteklemiyor.'); return; }
    setDurum('loading'); setHata('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setLatLng(lat, lng);
        setDurum('success');
        onSuccess?.(lat, lng);
      },
      err => {
        setDurum('error');
        setHata(err.code === err.PERMISSION_DENIED ? 'Konum izni reddedildi.' : 'Konum alınamadı, tekrar dene.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  return { durum, hata, al };
}

// ─── Yıldız gösterge ─────────────────────────────────────

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating && count === 0) return <span style={{ color: C.dim, fontSize: '0.75rem' }}>— henüz yorum yok</span>;
  const stars = rating ? Math.round(rating * 2) / 2 : 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: C.amber, fontSize: '0.78rem', letterSpacing: 1 }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ opacity: i <= stars ? 1 : 0.25 }}>★</span>)}
      </span>
      {rating !== null && <span style={{ color: C.amber, fontSize: '0.78rem', fontWeight: 700 }}>{rating.toFixed(1)}</span>}
      <span style={{ color: C.dim, fontSize: '0.75rem' }}>({count})</span>
    </span>
  );
}

// ─── Ortak tam form ───────────────────────────────────────

function FormGrid({ form, set, showButtons, onKaydet, onIptal, kayitYukleniyor, btnLabel, onCoordinatesSet }: FormGridProps) {
  const tags = Array.isArray(form.tags) ? form.tags as string[] : [];
  const gps = useGps(
    (lat, lng) => { set('latitude', lat); set('longitude', lng); },
    onCoordinatesSet,
  );

  function toggleTag(t: string) {
    set('tags', tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]);
  }

  const isValid = String(form.name ?? '').trim() && form.category &&
    !isNaN(parseFloat(String(form.latitude))) && !isNaN(parseFloat(String(form.longitude)));

  return (
    <>
      {/* Temel bilgiler */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>Konum Adı *</label>
          <input style={inp} value={String(form.name)} onChange={e => set('name', e.target.value)} placeholder="Güven Tır Parkı" />
        </div>
        <div>
          <label style={lbl}>Şehir</label>
          <input style={inp} value={String(form.city)} onChange={e => set('city', e.target.value)} placeholder="İstanbul" />
        </div>
        <div>
          <label style={lbl}>İlçe</label>
          <input style={inp} value={String(form.district)} onChange={e => set('district', e.target.value)} placeholder="Kadıköy" />
        </div>
        <div>
          <label style={lbl}>Telefon</label>
          <input style={inp} value={String(form.phone)} onChange={e => set('phone', e.target.value)} placeholder="0555 123 4567" type="tel" />
        </div>
        <div>
          <label style={lbl}>Website</label>
          <input style={inp} value={String(form.website)} onChange={e => set('website', e.target.value)} placeholder="https://..." type="url" />
        </div>
      </div>

      {/* Kategori — chip butonlar */}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Kategori *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KATEGORI_LIST.map(k => {
            const aktif = form.category === k.value;
            return (
              <button key={k.value} type="button" onClick={() => set('category', k.value)}
                style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer',
                  border: `1px solid ${aktif ? C.green : C.border}`,
                  background: aktif ? C.greenDark : 'transparent',
                  color: aktif ? C.green : C.muted, fontWeight: aktif ? 700 : 400 }}>
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Koordinat + GPS */}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Konum *</label>

        {/* Birleşik yapıştırma alanı */}
        <div style={{ marginBottom: 8 }}>
          <input
            style={{ ...inp, borderColor: C.blue + '80' }}
            placeholder="Google Maps'ten kopyala: 40.97933, 29.16325"
            onChange={e => {
              const val = e.target.value.trim();
              // "lat, lng" veya "lat lng" formatını dene
              const m = val.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
              if (m) { set('latitude', m[1]); set('longitude', m[2]); e.target.style.borderColor = C.green; }
              else if (val) { e.target.style.borderColor = C.red; }
              else { e.target.style.borderColor = C.blue + '80'; }
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px' }}>
            <input style={inp} type="number" step="0.000001" value={String(form.latitude)} onChange={e => set('latitude', e.target.value)} placeholder="Enlem (41.015137)" />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <input style={inp} type="number" step="0.000001" value={String(form.longitude)} onChange={e => set('longitude', e.target.value)} placeholder="Boylam (28.979530)" />
          </div>
          <button type="button" onClick={gps.durum === 'loading' ? undefined : gps.al}
            style={{ flexShrink: 0, background: gps.durum === 'success' ? C.greenDark : C.surface,
              color: gps.durum === 'success' ? C.green : gps.durum === 'error' ? C.red : C.muted,
              border: `1px solid ${gps.durum === 'success' ? C.green : gps.durum === 'error' ? C.red : C.border}`,
              borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600,
              cursor: gps.durum === 'loading' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
            {gps.durum === 'loading' ? '⏳ Alınıyor...' : gps.durum === 'success' ? '✅ Alındı' : '📍 GPS\'ten Al'}
          </button>
        </div>
        {gps.durum === 'error' && <div style={{ color: C.red, fontSize: '0.74rem', marginTop: 4 }}>{gps.hata}</div>}
      </div>

      {/* Adres + Adres Tarifi */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={lbl}>Adres</label>
          <input style={inp} value={String(form.address)} onChange={e => set('address', e.target.value)} placeholder="E-5 No:12" />
        </div>
        <div><label style={lbl}>Adres Tarifi</label>
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 56 }} value={String(form.address_note)} onChange={e => set('address_note', e.target.value)} placeholder="Kavşaktan sağa dön..." />
        </div>
      </div>

      {/* Açıklama */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Açıklama</label>
        <textarea style={{ ...inp, resize: 'vertical', minHeight: 56 }} value={String(form.description)} onChange={e => set('description', e.target.value)} placeholder="Kısa bir açıklama..." />
      </div>

      {/* Etiketler */}
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Özellikler / Etiketler</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ETIKET_ONERILERI.map(t => {
            const aktif = tags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                style={{ padding: '4px 10px', borderRadius: 16, fontSize: '0.76rem', cursor: 'pointer',
                  border: `1px solid ${aktif ? C.green : C.border}`,
                  background: aktif ? C.greenDark : 'transparent',
                  color: aktif ? C.green : C.muted }}>
                {t}
              </button>
            );
          })}
        </div>
        {tags.length > 0 && (
          <div style={{ marginTop: 6, fontSize: '0.74rem', color: C.dim }}>
            Seçili: {tags.join(', ')}
          </div>
        )}
      </div>

      {/* Acil */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(form.is_emergency)} onChange={e => set('is_emergency', e.target.checked)}
            style={{ accentColor: C.red, width: 16, height: 16 }} />
          <span style={{ color: C.muted, fontSize: '0.82rem', fontWeight: 600 }}>🆘 Nöbetçi / 7/24 Acil Destek</span>
        </label>
      </div>

      {showButtons && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onKaydet} disabled={kayitYukleniyor || !isValid}
            style={{ background: C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '7px 20px', fontSize: '0.82rem', fontWeight: 700, cursor: kayitYukleniyor || !isValid ? 'not-allowed' : 'pointer', opacity: kayitYukleniyor || !isValid ? 0.5 : 1 }}>
            {kayitYukleniyor ? '...' : btnLabel}
          </button>
          <button onClick={onIptal} disabled={kayitYukleniyor}
            style={{ background: 'none', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            İptal
          </button>
        </div>
      )}
    </>
  );
}

// ─── DuzenleForm ─────────────────────────────────────────

function DuzenleForm({ poi, onKaydet, onIptal, kayitYukleniyor }: {
  poi: Poi;
  onKaydet: (id: string, fields: Partial<Poi>) => Promise<void>;
  onIptal: () => void;
  kayitYukleniyor: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    name: poi.name, description: poi.description ?? '',
    category: poi.category,
    city: poi.city ?? '', district: poi.district ?? '',
    address: poi.address ?? '', address_note: poi.address_note ?? '',
    phone: poi.phone ?? '', website: poi.website ?? '',
    tags: Array.isArray(poi.tags) ? [...poi.tags] : [],
    latitude: String(poi.latitude), longitude: String(poi.longitude),
    is_emergency: poi.is_emergency,
  });
  function set(f: string, v: string | boolean | string[]) { setForm(prev => ({ ...prev, [f]: v })); }
  function kaydet() {
    const tags = Array.isArray(form.tags) ? form.tags as string[] : [];
    onKaydet(poi.id, {
      name: String(form.name).trim(),
      description: String(form.description).trim() || null,
      category: String(form.category),
      city: String(form.city).trim() || null,
      district: String(form.district).trim() || null,
      address: String(form.address).trim() || null,
      address_note: String(form.address_note).trim() || null,
      phone: String(form.phone).trim() || null,
      website: String(form.website).trim() || null,
      tags,
      latitude: parseFloat(String(form.latitude)),
      longitude: parseFloat(String(form.longitude)),
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

// URL'den koordinat ve yer adı parse et
function parseGoogleMapsUrl(url: string): { lat: string; lng: string; name: string } | null {
  let lat: string | null = null;
  let lng: string | null = null;

  // 1. !3dLAT!4dLNG — data encoding içindeki kesin POI koordinatı (en hassas, öncelikli)
  //    Örn: data=!4m6!3m5!1s0x...!8m2!3d37.065435!4d36.987245!16s...
  const dataM = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataM) { lat = dataM[1]; lng = dataM[2]; }

  // 2. /@lat,lng — harita merkezi (fallback; iOS linklerinde bazen eksik olabilir)
  if (!lat) {
    const atM = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atM) { lat = atM[1]; lng = atM[2]; }
  }

  // 3. ?q=lat,lng veya &q=lat,lng
  if (!lat) {
    const qM = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qM) { lat = qM[1]; lng = qM[2]; }
  }

  // 4. ?ll=lat,lng veya &ll=lat,lng
  if (!lat) {
    const llM = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (llM) { lat = llM[1]; lng = llM[2]; }
  }

  // 5. center=lat,lng (nadir ama mevcut)
  if (!lat) {
    const cM = url.match(/[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (cM) { lat = cM[1]; lng = cM[2]; }
  }

  if (!lat || !lng) return null;

  // /place/Ad/ veya /search/Ad/ → URL decode + "+" → boşluk
  const placeM = url.match(/\/(?:place|search)\/([^/@?#]+)\//);
  const rawName = placeM ? placeM[1] : '';
  const name = rawName ? decodeURIComponent(rawName.replace(/\+/g, ' ')) : '';

  return { lat, lng, name };
}

function YeniEkleForm({ onKaydet, onIptal, kayitYukleniyor }: {
  onKaydet: (fields: PoiInput) => Promise<void>;
  onIptal: () => void;
  kayitYukleniyor: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    name: '', description: '', category: '', city: '', district: '',
    address: '', address_note: '', phone: '', website: '',
    tags: [], latitude: '', longitude: '', is_emergency: false,
  });
  const [mapsLink, setMapsLink] = useState('');
  const [mapsDurum, setMapsDurum] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [mapsHata, setMapsHata] = useState('');
  const [enrichDurum, setEnrichDurum] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  function set(f: string, v: string | boolean | string[]) { setForm(prev => ({ ...prev, [f]: v })); }

  async function enrichirPoi(lat: string, lng: string, slug?: string) {
    setEnrichDurum('loading');
    try {
      const res = await fetch('/api/admin/enrich-poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng), slug }),
      });
      const d = await res.json();
      if (!d.success) { setEnrichDurum('error'); return; }
      const r = d.data;
      setForm(prev => ({
        ...prev,
        ...(r.name         && { name:         r.name }),
        ...(r.city         && { city:         r.city }),
        ...(r.district     && { district:     r.district }),
        ...(r.address      && { address:      r.address }),
        ...(r.address_note && { address_note: r.address_note }),
        ...(r.category     && { category:     r.category }),
        ...(r.description  && { description:  r.description }),
      }));
      setEnrichDurum('done');
    } catch {
      setEnrichDurum('error');
    }
  }

  async function konumuCek() {
    const url = mapsLink.trim();
    if (!url) return;
    setMapsDurum('loading');
    setMapsHata('');
    try {
      let hedefUrl = url;

      // Kısa link mi? → server'a resolve ettir
      const kısaLink = url.includes('goo.gl/') || url.includes('maps.app.goo.gl');
      if (kısaLink) {
        const res = await fetch('/api/admin/resolve-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const d = await res.json();
        if (!d.success) {
          setMapsDurum('error');
          setMapsHata(d.error || 'Link çözülemedi.');
          return;
        }
        hedefUrl = d.url;
        console.debug('[maps] resolved URL:', hedefUrl);

        // resolve-url koordinatı doğrudan döndürdüyse (Nominatim veya URL'den)
        if (d.lat != null && d.lng != null) {
          const lat = String(d.lat);
          const lng = String(d.lng);
          const yaklasik = Boolean(d.geocodedFromSearch);
          console.debug('[maps] coords from resolve-url:', lat, lng, yaklasik ? '(Nominatim yaklaşık)' : '(URL kesin)');
          set('latitude', lat);
          set('longitude', lng);
          setMapsDurum('success');
          // Yaklaşık koordinat ise kullanıcıya uyar
          setMapsHata(yaklasik ? '⚠️ Koordinat adres üzerinden yaklaşık olarak bulundu — enlem/boylamı haritadan doğrulayın.' : '');
          setMapsLink('');
          enrichirPoi(lat, lng, d.name || undefined);
          return;
        }
      }

      // Fallback: URL'den regex ile koordinat çıkarmayı dene
      const parsed = parseGoogleMapsUrl(hedefUrl);
      console.debug('[maps] parse result:', parsed, 'from:', hedefUrl.slice(0, 120));
      if (!parsed) {
        setMapsDurum('error');
        setMapsHata('Koordinat bulunamadı. Farklı bir link deneyin veya koordinatları manuel girin.');
        return;
      }

      set('latitude', parsed.lat);
      set('longitude', parsed.lng);
      setMapsDurum('success');
      setMapsLink('');

      // Koordinatlar hazır — LLM ile alanları zenginleştir
      enrichirPoi(parsed.lat, parsed.lng, parsed.name || undefined);
    } catch {
      setMapsDurum('error');
      setMapsHata('Bağlantı hatası. Tekrar deneyin.');
    }
  }

  function kaydet() {
    const tags = Array.isArray(form.tags) ? form.tags as string[] : [];
    onKaydet({
      name: String(form.name).trim(),
      description: String(form.description).trim() || null,
      category: String(form.category),
      city: String(form.city).trim() || null,
      district: String(form.district).trim() || null,
      address: String(form.address).trim() || null,
      address_note: String(form.address_note).trim() || null,
      phone: String(form.phone).trim() || null,
      website: String(form.website).trim() || null,
      tags,
      latitude: parseFloat(String(form.latitude)),
      longitude: parseFloat(String(form.longitude)),
      is_emergency: Boolean(form.is_emergency),
    });
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem' }}>➕ Yeni Konum (Direkt Onaylı)</span>
        {enrichDurum === 'loading' && (
          <span style={{ color: C.amber, fontSize: '0.74rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, border: `2px solid ${C.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Yapay zeka dolduruyor...
          </span>
        )}
        {enrichDurum === 'done' && (
          <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
            ✨ YZ tarafından önerildi
          </span>
        )}
        {(enrichDurum === 'done' || enrichDurum === 'error') && (
          <button
            type="button"
            onClick={() => {
              const lat = String(form.latitude);
              const lng = String(form.longitude);
              if (lat && lng) enrichirPoi(lat, lng);
            }}
            style={{ background: 'none', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>
            🔄 Yeniden Sorgula
          </button>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Google Maps linki */}
      <div style={{ background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <label style={lbl}>Google Maps'ten Çek</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inp, flex: 1 }}
            value={mapsLink}
            onChange={e => { setMapsLink(e.target.value); if (mapsDurum !== 'idle') setMapsDurum('idle'); }}
            placeholder="https://maps.app.goo.gl/... veya google.com/maps/place/..."
            onKeyDown={e => e.key === 'Enter' && mapsLink.trim() && konumuCek()}
          />
          <button
            type="button"
            onClick={mapsDurum === 'loading' ? undefined : konumuCek}
            disabled={!mapsLink.trim() || mapsDurum === 'loading'}
            style={{
              flexShrink: 0, borderRadius: 6, padding: '6px 14px',
              fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap',
              border: `1px solid ${mapsDurum === 'success' ? C.green : mapsDurum === 'error' ? C.red : C.blueBg}`,
              background: mapsDurum === 'success' ? C.greenDark : mapsDurum === 'error' ? C.redBg : C.blueBg,
              color: mapsDurum === 'success' ? C.green : mapsDurum === 'error' ? C.red : C.blue,
              cursor: !mapsLink.trim() || mapsDurum === 'loading' ? 'not-allowed' : 'pointer',
              opacity: !mapsLink.trim() ? 0.5 : 1,
            }}
          >
            {mapsDurum === 'loading' ? '⏳ Çekiliyor...' : '📍 Konumu Çek'}
          </button>
        </div>
        {mapsDurum === 'success' && !mapsHata && (
          <div style={{ color: C.green, fontSize: '0.74rem', marginTop: 6 }}>
            ✅ Koordinatlar dolduruldu — enlem/boylam alanlarını kontrol edin.
          </div>
        )}
        {mapsDurum === 'success' && mapsHata && (
          <div style={{ color: C.amber, fontSize: '0.74rem', marginTop: 6 }}>{mapsHata}</div>
        )}
        {mapsDurum === 'error' && (
          <div style={{ color: C.red, fontSize: '0.74rem', marginTop: 6 }}>⚠️ {mapsHata}</div>
        )}
      </div>

      <FormGrid
        form={form} set={set} showButtons
        onKaydet={kaydet} onIptal={onIptal}
        kayitYukleniyor={kayitYukleniyor}
        btnLabel="✅ Ekle"
        onCoordinatesSet={(lat, lng) => enrichirPoi(lat, lng)}
      />

      {/* Sürüklenebilir pin haritası — koordinatlar geçerliyse göster */}
      {(() => {
        const lat = parseFloat(String(form.latitude));
        const lng = parseFloat(String(form.longitude));
        const gecerli = !isNaN(lat) && !isNaN(lng)
          && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        if (!gecerli) return null;
        return (
          <div style={{ marginTop: 12 }}>
            <label style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Konumu Haritada Doğrula
            </label>
            <PinHarita
              lat={lat}
              lng={lng}
              onChange={(newLat, newLng) => {
                set('latitude', String(newLat));
                set('longitude', String(newLng));
              }}
            />
            <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 4 }}>
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────

export default function PoiOnayClient() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<Record<string, 'onay' | 'ret'>>({});
  const [silinecekId, setSilinecekId] = useState<string | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [kayitYukleniyor, setKayitYukleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [gosterilen, setGosterilen] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Filtre & sıralama
  const [search, setSearch]       = useState('');
  const [katFilter, setKatFilter] = useState('');
  const [sortBy, setSortBy]       = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Tekil ekleme
  const [ekleAcik, setEkleAcik] = useState(false);

  // Excel
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [excelGecerli, setExcelGecerli] = useState<PoiInput[]>([]);
  const [excelHatalar, setExcelHatalar] = useState<{ satir: number; ad: string; hatalar: string[] }[]>([]);
  const [excelDosyaAdi, setExcelDosyaAdi] = useState('');
  const [topluYukleniyor, setTopluYukleniyor] = useState(false);
  const [topluSonuc, setTopluSonuc] = useState('');

  async function yukle(
    status: 'pending' | 'approved' | 'rejected',
    opts?: { search?: string; category?: string; sort?: string; order?: string }
  ) {
    setYukleniyor(true); setHata(''); setDuzenleId(null);
    try {
      const params = new URLSearchParams({ status });
      const s  = opts?.search   ?? search;
      const c  = opts?.category ?? katFilter;
      const sb = opts?.sort     ?? sortBy;
      const so = opts?.order    ?? sortOrder;
      if (s)  params.set('search', s);
      if (c)  params.set('category', c);
      if (sb) params.set('sort', sb);
      if (so) params.set('order', so);
      const res = await fetch(`/api/admin/poi?${params.toString()}`);
      const d = await res.json();
      if (d.success) setPois(d.data);
      else setHata(d.error || 'Veriler alınamadı.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setYukleniyor(false); }
  }

  useEffect(() => { yukle(gosterilen); }, [gosterilen]);

  function uygula() { yukle(gosterilen); }
  function sifirla() {
    setSearch(''); setKatFilter(''); setSortBy('created_at'); setSortOrder('desc');
    yukle(gosterilen, { search: '', category: '', sort: 'created_at', order: 'desc' });
  }

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

  async function poiSil(id: string) {
    setSiliniyor(true); setHata('');
    try {
      const res = await fetch(`/api/poi/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { setPois(prev => prev.filter(p => p.id !== id)); if (duzenleId === id) setDuzenleId(null); }
      else setHata(d.error || 'Silme başarısız.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setSiliniyor(false); setSilinecekId(null); }
  }

  async function yeniPoiEkle(fields: PoiInput) {
    setKayitYukleniyor(true); setHata('');
    try {
      const res = await fetch('/api/admin/poi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
      const d = await res.json();
      if (d.success) { setEkleAcik(false); if (gosterilen === 'approved') yukle('approved'); }
      else setHata(d.error || 'Ekleme başarısız.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setKayitYukleniyor(false); }
  }

  async function handleDosyaSec(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelDosyaAdi(file.name); setTopluSonuc(''); setHata('');
    try {
      const { valid, errors } = await parseExcel(file);
      setExcelGecerli(valid); setExcelHatalar(errors);
    } catch { setHata('Excel dosyası okunamadı.'); setExcelGecerli([]); setExcelHatalar([]); }
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
      } else setHata(d.error || 'Toplu yükleme başarısız.');
    } catch { setHata('Bağlantı hatası.'); }
    finally { setTopluYukleniyor(false); }
  }

  function excelTemizle() { setExcelGecerli([]); setExcelHatalar([]); setExcelDosyaAdi(''); setTopluSonuc(''); }

  const tabs = [
    { key: 'pending'  as const, label: '⏳ Bekleyenler' },
    { key: 'approved' as const, label: '✅ Onaylananlar' },
    { key: 'rejected' as const, label: '❌ Reddedilenler' },
  ];

  const onizlemeVar = excelGecerli.length > 0 || excelHatalar.length > 0;
  const filtreAktif = search || katFilter || sortBy !== 'created_at' || sortOrder !== 'desc';

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
        <YeniEkleForm onKaydet={yeniPoiEkle} onIptal={() => setEkleAcik(false)} kayitYukleniyor={kayitYukleniyor} />
      )}

      {/* ── Excel önizleme ── */}
      {onizlemeVar && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ color: C.muted, fontSize: '0.82rem' }}>📄 {excelDosyaAdi}</span>
            {excelGecerli.length > 0 && <span style={{ background: C.greenDark, color: C.green, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{excelGecerli.length} geçerli satır</span>}
            {excelHatalar.length > 0 && <span style={{ background: C.redBg, color: C.red, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{excelHatalar.length} hatalı satır</span>}
            <button onClick={excelTemizle} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '0.82rem' }}>✕ Temizle</button>
          </div>
          {excelGecerli.length > 0 && (
            <>
              <div style={{ overflowX: 'auto', marginBottom: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead><tr>{['Ad', 'Kategori', 'Şehir', 'İlçe', 'Enlem', 'Boylam', 'Acil'].map(h => (
                    <th key={h} style={{ color: C.muted, fontWeight: 700, padding: '4px 8px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{excelGecerli.slice(0, 8).map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '4px 8px', color: C.text }}>{r.name}</td>
                      <td style={{ padding: '4px 8px', color: C.muted }}>{KATEGORI[r.category] ?? r.category}</td>
                      <td style={{ padding: '4px 8px', color: C.muted }}>{r.city ?? '—'}</td>
                      <td style={{ padding: '4px 8px', color: C.muted }}>{r.district ?? '—'}</td>
                      <td style={{ padding: '4px 8px', color: C.dim }}>{r.latitude}</td>
                      <td style={{ padding: '4px 8px', color: C.dim }}>{r.longitude}</td>
                      <td style={{ padding: '4px 8px', color: r.is_emergency ? C.red : C.dim }}>{r.is_emergency ? 'Evet' : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {excelGecerli.length > 8 && <div style={{ color: C.dim, fontSize: '0.75rem', padding: '4px 8px' }}>… ve {excelGecerli.length - 8} satır daha</div>}
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
          {topluSonuc && <div style={{ color: C.green, fontSize: '0.85rem', fontWeight: 700, marginTop: 10 }}>{topluSonuc}</div>}
        </div>
      )}

      {/* ── Hata banner ── */}
      {hata && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, color: C.red, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
          ⚠️ {hata}
        </div>
      )}

      {/* ── Sekme çubuğu ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: `1px solid ${C.border}` }}>
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

      {/* ── Filtre & Sıralama çubuğu ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 180px', minWidth: 140 }}>
          <label style={lbl}>Ad Ara</label>
          <input style={inp} placeholder="Konum adı..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && uygula()} />
        </div>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <label style={lbl}>Kategori</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={katFilter} onChange={e => setKatFilter(e.target.value)}>
            <option value="">Tümü</option>
            {KATEGORI_LIST.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 120 }}>
          <label style={lbl}>Sırala</label>
          <select style={{ ...inp, cursor: 'pointer' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <label style={lbl}>Yön</label>
          <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
            style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {sortOrder === 'desc' ? '↓ Azalan' : '↑ Artan'}
          </button>
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <button onClick={uygula}
            style={{ background: C.greenDark, color: C.green, border: `1px solid ${C.greenBg}`, borderRadius: 6, padding: '6px 16px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            Uygula
          </button>
          {filtreAktif && (
            <button onClick={sifirla}
              style={{ background: 'none', color: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              Sıfırla
            </button>
          )}
        </div>
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
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ color: C.muted, fontSize: '0.8rem' }}>{KATEGORI[poi.category] ?? poi.category}</span>
                    {poi.city && <span style={{ color: C.dim, fontSize: '0.8rem' }}>📍 {poi.city}{poi.district ? ` / ${poi.district}` : ''}</span>}
                    {poi.phone && <span style={{ color: C.dim, fontSize: '0.78rem' }}>📞 {poi.phone}</span>}
                    <span style={{ color: C.dim, fontSize: '0.78rem' }}>{poi.latitude.toFixed(5)}, {poi.longitude.toFixed(5)}</span>
                    <StarRating rating={poi.avg_rating} count={poi.review_count ?? 0} />
                  </div>
                  {poi.description && <div style={{ color: C.muted, fontSize: '0.78rem', marginBottom: 3, fontStyle: 'italic' }}>{poi.description}</div>}
                  {Array.isArray(poi.tags) && poi.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 3 }}>
                      {poi.tags.map(t => <span key={t} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.7rem', padding: '1px 7px', borderRadius: 10 }}>{t}</span>)}
                    </div>
                  )}
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
                <button onClick={() => { setDuzenleId(duzenleId === poi.id ? null : poi.id); setSilinecekId(null); }}
                  style={{ background: duzenleId === poi.id ? C.blueBg : 'transparent', color: C.blue, border: `1px solid ${C.blueBg}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {duzenleId === poi.id ? '✕ Kapat' : '✏️ Düzenle'}
                </button>
                {silinecekId === poi.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ color: C.red, fontSize: '0.78rem', fontWeight: 600 }}>Emin misin?</span>
                    <button onClick={() => poiSil(poi.id)} disabled={siliniyor}
                      style={{ background: C.redBg, color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: siliniyor ? 'wait' : 'pointer', opacity: siliniyor ? 0.6 : 1 }}>
                      {siliniyor ? '...' : '🗑️ Evet, Sil'}
                    </button>
                    <button onClick={() => setSilinecekId(null)} disabled={siliniyor}
                      style={{ background: 'none', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                      İptal
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setSilinecekId(poi.id); setDuzenleId(null); }}
                    style={{ background: 'transparent', color: C.red, border: `1px solid ${C.redBg}`, borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    🗑️ Sil
                  </button>
                )}
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
