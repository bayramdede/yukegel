'use client';
import { useState, useRef } from 'react';
import { createClient } from '../../lib/supabase';

const ILLER = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
  'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
  'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat',
  'Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın',
  'Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

interface PreviewRow {
  rowIndex: number;
  seferNo: string;
  kalkisIli: string; kalkisIlce: string;
  varisIli: string; varisIlce: string;
  durakTipi: string;
  aracTipi: string; ustYapi: string;
  tonaj: string; palet: string; fiyat: string; yukCinsi: string; not: string;
  kalkisIliNorm: string | null; kalkisIliStatus: 'ok' | 'error' | 'empty';
  varisIliNorm: string | null; varisIliStatus: 'ok' | 'error' | 'empty';
  aracTipiNorm: string | null; aracTipiStatus: 'ok' | 'warn' | 'empty';
  ustYapiNorm: string | null; ustYapiStatus: 'ok' | 'warn' | 'empty';
  hasErrors: boolean;
}

type Overrides = Record<number, { kalkisIliNorm?: string; varisIliNorm?: string }>;

const inp: React.CSSProperties = {
  background: '#0d1117', color: '#e2e8f0',
  border: '1px solid #374151', borderRadius: 4,
  padding: '4px 8px', fontSize: '0.82rem', outline: 'none',
};

// ── Şablon sütunları ──
const SABLON_HEADERS = [
  'Sefer No', 'Kalkış İli', 'Kalkış İlçesi', 'Varış İli', 'Varış İlçesi',
  'Durak Tipi', 'Araç Tipi', 'Üst Yapı', 'Tonaj (ton)', 'Palet',
  'Fiyat (TL)', 'Yük Cinsi', 'Not',
];
const SABLON_ORNEK: string[][] = [
  ['', 'istanbul', '', 'ankara', '', '', 'tir', 'tenteli', '18', '24', '5000', 'seramik', 'Kırılgan dikkat'],
  ['1', 'izmir', 'konak', 'konya', '', '', 'kamyon', '', '10', '', '3000', '', ''],
  ['1', 'izmir', 'konak', 'ankara', '', '', '', '', '8', '', '', '', ''],
];

export default function TopluYukle({ onGeri }: { onGeri: () => void }) {
  const [adim, setAdim] = useState<'upload' | 'preview' | 'basarili'>('upload');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ created: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Şablon indir ──
  async function sablonIndir() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([SABLON_HEADERS, ...SABLON_ORNEK]);
    ws['!cols'] = [10, 14, 14, 12, 12, 12, 12, 12, 10, 8, 10, 12, 22].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'İlanlar');
    XLSX.writeFile(wb, 'yukegel-ilan-sablonu.xlsx');
  }

  // ── Dosya yükle & parse ──
  async function dosyaYukle(file: File) {
    setYukleniyor(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

      if (data.length < 2) throw new Error('Excel çok az satır içeriyor');

      const rows = data
        .slice(1)
        .filter((row: any[]) => row.some((c: any) => String(c ?? '').trim()))
        .map((row: any[]) => ({
          seferNo:   String(row[0]  ?? '').trim(),
          kalkisIli: String(row[1]  ?? '').trim(),
          kalkisIlce:String(row[2]  ?? '').trim(),
          varisIli:  String(row[3]  ?? '').trim(),
          varisIlce: String(row[4]  ?? '').trim(),
          durakTipi: String(row[5]  ?? '').trim(),
          aracTipi:  String(row[6]  ?? '').trim(),
          ustYapi:   String(row[7]  ?? '').trim(),
          tonaj:     String(row[8]  ?? '').trim(),
          palet:     String(row[9]  ?? '').trim(),
          fiyat:     String(row[10] ?? '').trim(),
          yukCinsi:  String(row[11] ?? '').trim(),
          not:       String(row[12] ?? '').trim(),
        }));

      if (!rows.length) throw new Error('Dolu satır bulunamadı');

      const res = await fetch('/api/excel-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', rows }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setPreviewRows(json.preview);
      setOverrides({});
      setAdim('preview');
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
    setYukleniyor(false);
  }

  // ── Override uygula (preview'da anlık düzeltme) ──
  function setOverride(rowIndex: number, field: 'kalkisIliNorm' | 'varisIliNorm', val: string) {
    setOverrides(prev => ({
      ...prev,
      [rowIndex]: { ...prev[rowIndex], [field]: val || undefined },
    }));
  }

  // ── Effective rows (preview + override birleşimi) ──
  type EffRow = PreviewRow & {
    kalkisEff: string | null; kalkisEffStatus: string;
    varisEff: string | null;  varisEffStatus: string;
  };

  const effectiveRows: EffRow[] = previewRows.map(row => {
    const ov = overrides[row.rowIndex];
    const kEff = ov?.kalkisIliNorm ?? row.kalkisIliNorm;
    const vEff = ov?.varisIliNorm  ?? row.varisIliNorm;
    return {
      ...row,
      kalkisEff:       kEff,
      kalkisEffStatus: ov?.kalkisIliNorm ? 'ok' : row.kalkisIliStatus,
      varisEff:        vEff,
      varisEffStatus:  ov?.varisIliNorm  ? 'ok' : row.varisIliStatus,
    };
  });

  const hataSayisi = effectiveRows.filter(
    r => r.kalkisEffStatus === 'error' || r.varisEffStatus === 'error'
  ).length;

  // Grupla: Sefer No yoksa her satır ayrı ilan
  const groups = new Map<string, EffRow[]>();
  effectiveRows.forEach(row => {
    const key = row.seferNo?.trim() || `__${row.rowIndex}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });
  const ilanSayisi = groups.size;

  // ── Onayla ve yayınla ──
  async function onayla() {
    setYukleniyor(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.'); setYukleniyor(false); return; }

    const finalRows = previewRows.map(row => ({
      ...row,
      kalkisIliNorm: overrides[row.rowIndex]?.kalkisIliNorm ?? row.kalkisIliNorm,
      varisIliNorm:  overrides[row.rowIndex]?.varisIliNorm  ?? row.varisIliNorm,
    }));

    const res = await fetch('/api/excel-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'commit', rows: finalRows, userId: user.id }),
    });
    const data = await res.json();
    setSonuc({ created: data.created, errors: data.errors || [] });
    setAdim('basarili');
    setYukleniyor(false);
  }

  // ── Küçük yardımcı: şehir hücre gösterimi ──
  const CityCell = ({
    raw, norm, status, rowIndex, field,
  }: {
    raw: string; norm: string | null; status: string;
    rowIndex: number; field: 'kalkisIliNorm' | 'varisIliNorm';
  }) => {
    if (status === 'ok') return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{norm}</span>
        {raw && trNormClient(raw) !== trNormClient(norm || '') && (
          <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>({raw})</span>
        )}
        <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>✓</span>
      </span>
    );
    if (status === 'error') return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: '#f87171', fontSize: '0.78rem' }}>⚠ "{raw}"</span>
        <select
          defaultValue=""
          onChange={e => setOverride(rowIndex, field, e.target.value)}
          style={{ ...inp, border: '1px solid #f87171', minWidth: 130 }}
        >
          <option value="">Manuel seç...</option>
          {ILLER.map(il => <option key={il}>{il}</option>)}
        </select>
      </span>
    );
    if (status === 'empty') return <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>;
    return <span style={{ color: '#fbbf24' }}>{raw}</span>;
  };

  // Client-side trNorm for display comparison only
  function trNormClient(s: string) {
    return (s || '').replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase()
      .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i')
      .replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u');
  }

  // ── Render: Başarı ──
  if (adim === 'basarili') return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', marginBottom: 8 }}>
        {sonuc?.created} ilan oluşturuldu!
      </div>
      <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>
        İlanlarınız moderatör onayına gönderildi. Onaylandıktan sonra yayınlanacak.
      </div>
      {(sonuc?.errors?.length ?? 0) > 0 && (
        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left' }}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
            ⚠ {sonuc!.errors.length} satır işlenemedi:
          </div>
          {sonuc!.errors.map((e, i) => (
            <div key={i} style={{ color: '#fca5a5', fontSize: '0.78rem', marginBottom: 4 }}>• {e}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <a href="/panel" style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
          İlanlarım →
        </a>
        <button onClick={() => { setAdim('upload'); setPreviewRows([]); setSonuc(null); }}
          style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem' }}>
          Yeni Yükleme
        </button>
      </div>
    </div>
  );

  // ── Render: Preview ──
  if (adim === 'preview') return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 80px' }}>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.3rem' }}>{ilanSayisi}</div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>İlan</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: '1.3rem' }}>{effectiveRows.length}</div>
            <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>Satır</div>
          </div>
          {hataSayisi > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#f87171', fontWeight: 800, fontSize: '1.3rem' }}>{hataSayisi}</div>
              <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>Hata</div>
            </div>
          )}
          {hataSayisi === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.3rem' }}>✓</div>
              <div style={{ color: '#6b7280', fontSize: '0.68rem' }}>Hazır</div>
            </div>
          )}
        </div>
        {hataSayisi > 0 && (
          <div style={{ color: '#f87171', fontSize: '0.82rem', background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 14px' }}>
            ⚠ {hataSayisi} satırda tanımlanamayan şehir var. Lütfen açılır listeden seçin.
          </div>
        )}
      </div>

      {/* Grup kartları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {Array.from(groups.entries()).map(([key, rows], gi) => {
          const isMulti = !key.startsWith('__');
          const first = rows[0];
          const groupHasError = rows.some(r => r.kalkisEffStatus === 'error' || r.varisEffStatus === 'error');
          const borderColor = groupHasError ? '#7f1d1d' : '#166534';
          const hasFiyat = first.fiyat?.trim();

          return (
            <div key={key} style={{
              background: '#161b22',
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              padding: '14px 16px',
            }}>
              {/* Grup başlık */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {isMulti && (
                  <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    🔗 Sefer No: {key}
                  </span>
                )}
                {!isMulti && (
                  <span style={{ background: '#1f2937', color: '#9ca3af', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    📦 Tekil İlan #{gi + 1}
                  </span>
                )}
                {/* Araç tipi chip */}
                {(first.aracTipiNorm || first.aracTipi) && (
                  <span style={{ background: '#1a2535', color: first.aracTipiStatus === 'ok' ? '#60a5fa' : '#fbbf24', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
                    🚛 {first.aracTipiNorm || first.aracTipi}
                    {first.aracTipiStatus === 'warn' && ' ⚠'}
                  </span>
                )}
                {/* Üst yapı chip */}
                {(first.ustYapiNorm || first.ustYapi) && (
                  <span style={{ background: '#1f2937', color: first.ustYapiStatus === 'ok' ? '#94a3b8' : '#fbbf24', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
                    {first.ustYapiNorm || first.ustYapi}
                    {first.ustYapiStatus === 'warn' && ' ⚠'}
                  </span>
                )}
                {/* Fiyat chip */}
                {hasFiyat && (
                  <span style={{ background: '#14532d', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                    ✓ ₺{first.fiyat}
                  </span>
                )}
                {/* Not */}
                {first.not && (
                  <span style={{ color: '#4b5563', fontSize: '0.7rem', marginLeft: 'auto' }}>
                    📝 {first.not.slice(0, 50)}{first.not.length > 50 ? '...' : ''}
                  </span>
                )}
              </div>

              {/* Kalkış */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 14, marginTop: 2 }}>K</span>
                <CityCell
                  raw={first.kalkisIli}
                  norm={first.kalkisEff}
                  status={first.kalkisEffStatus}
                  rowIndex={first.rowIndex}
                  field="kalkisIliNorm"
                />
                {first.kalkisIlce && (
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>/ {first.kalkisIlce}</span>
                )}
              </div>

              {/* Durağlar (varış noktaları) */}
              {rows.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: ri < rows.length - 1 ? 8 : 0 }}>
                  <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 14, marginTop: 2 }}>V</span>
                  <CityCell
                    raw={row.varisIli}
                    norm={row.varisEff}
                    status={row.varisEffStatus}
                    rowIndex={row.rowIndex}
                    field="varisIliNorm"
                  />
                  {row.varisIlce && (
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>/ {row.varisIlce}</span>
                  )}
                  {row.tonaj && (
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>⚖ {row.tonaj}t</span>
                  )}
                  {row.palet && (
                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>📦 {row.palet}p</span>
                  )}
                  {row.yukCinsi && (
                    <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>· {row.yukCinsi}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Alt sabit buton barı */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#161b22', borderTop: '1px solid #30363d',
        padding: '12px 16px',
        display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center',
        zIndex: 50,
      }}>
        <button onClick={() => setAdim('upload')} style={{
          background: 'none', border: '1px solid #374151', color: '#8b949e',
          borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: '0.88rem',
        }}>
          ← Yeniden Yükle
        </button>
        <button
          onClick={onayla}
          disabled={hataSayisi > 0 || yukleniyor}
          style={{
            background: hataSayisi > 0 ? '#1f2937' : '#22c55e',
            color: hataSayisi > 0 ? '#4b5563' : '#000',
            border: 'none', borderRadius: 8,
            padding: '10px 28px', cursor: hataSayisi > 0 ? 'not-allowed' : 'pointer',
            fontWeight: 800, fontSize: '0.95rem',
            opacity: yukleniyor ? 0.6 : 1,
          }}
        >
          {yukleniyor
            ? '⏳ Yayınlanıyor...'
            : hataSayisi > 0
            ? `⚠ ${hataSayisi} hata düzeltilmeli`
            : `✅ Onayla ve Yayınla (${ilanSayisi} ilan)`}
        </button>
      </div>
    </div>
  );

  // ── Render: Upload ──
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.2rem', marginBottom: 6 }}>
          📄 Toplu İlan Yükleme
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
          Excel şablonunu doldurun, sisteme yükleyin — şehirler otomatik tanınır.
        </div>
      </div>

      {/* Adım 1 */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 20, marginBottom: 12 }}>
        <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
          ADIM 1 — ŞABLONU İNDİR
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 14, lineHeight: 1.6 }}>
          Şablonu indirin, doldurun. Şehir adlarını serbest yazabilirsiniz: "ist", "ankara", "ant." gibi kısaltmalar otomatik tanınır.
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: '0.75rem', color: '#4b5563', lineHeight: 1.7, fontFamily: 'monospace' }}>
          <div style={{ color: '#6b7280', marginBottom: 4 }}>Sütunlar:</div>
          {SABLON_HEADERS.join('  |  ')}
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ color: '#6b7280', fontSize: '0.7rem', fontWeight: 700, marginBottom: 8 }}>📋 ÇOKLU DURAK ÖRNEĞİ (Sefer No ile)</div>
          <div style={{ fontSize: '0.72rem', color: '#4b5563', fontFamily: 'monospace', lineHeight: 1.8 }}>
            <span style={{ color: '#60a5fa' }}>Sefer No 1</span> | izmir → konya | kamyon | 10t<br/>
            <span style={{ color: '#60a5fa' }}>Sefer No 1</span> | izmir → ankara | | 8t<br/>
            <span style={{ color: '#94a3b8' }}>← Aynı Sefer No = tek ilan, 2 varış durağı</span>
          </div>
        </div>
        <button onClick={sablonIndir} style={{
          background: '#1e3a5f', border: '1px solid #1e4a7f', color: '#60a5fa',
          borderRadius: 8, padding: '10px 20px', cursor: 'pointer',
          fontWeight: 700, fontSize: '0.88rem',
        }}>
          ⬇ Şablonu İndir (.xlsx)
        </button>
      </div>

      {/* Adım 2 */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 20 }}>
        <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
          ADIM 2 — DOLDURDUĞUNUZ DOSYAYI YÜKLEYİN
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) dosyaYukle(f); e.target.value = ''; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={yukleniyor}
          style={{
            width: '100%', background: yukleniyor ? '#1f2937' : '#14532d',
            border: `2px dashed ${yukleniyor ? '#374151' : '#166534'}`,
            color: yukleniyor ? '#6b7280' : '#22c55e',
            borderRadius: 10, padding: '28px 20px', cursor: yukleniyor ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '1rem', textAlign: 'center',
          }}
        >
          {yukleniyor ? '⏳ Analiz ediliyor...' : '📂 Dosya Seç / Sürükle Bırak'}
        </button>
        <div style={{ color: '#4b5563', fontSize: '0.72rem', marginTop: 10, textAlign: 'center' }}>
          .xlsx, .xls veya .csv — Şablon dışı dosya da çalışır (sütun sırası aynı olmalı)
        </div>
      </div>

      <button onClick={onGeri} style={{
        display: 'block', margin: '24px auto 0',
        background: 'none', border: 'none', color: '#4b5563',
        cursor: 'pointer', fontSize: '0.85rem',
      }}>
        ← Geri Dön
      </button>
    </div>
  );
}
