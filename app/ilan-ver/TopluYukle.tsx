'use client';
import { useState, useRef } from 'react';
// 🚨 `ILAN_VER_ANALIZ` B1 — istemci↔route sözleşmesi TEK dosyadan. Bu import
// olmadan iki taraf yine sessizce ayrışabilir; `satisfies` mühürleri aşağıda.
import {
  SABLON_HEADERS, MAX_SATIR, MAX_ILAN,
  type HamSatir, type OnizlemeSatiri, type TopluYukleIstek, type TopluYukleYanit,
  type KayitSonucu,
} from '../../lib/toplu-yukle-sozlesme';
// 8 Ağu 2026 — plaka sıralı `ilan-sabitler::ILLER` yerine Türkçe alfabetik liste.
import { IL_ADLARI_ALFABETIK as ILLER } from '../../lib/lokasyon';
// Araç/kasa listeleri SUNUCUNUN beyaz listesiyle aynı kaynaktan: `/api/excel-import`
// bu değerleri `aracCoz()`/`utsCoz()` ile çözüyor, ayrı bir kopya tutmak ayrışırdı.
import { ARAC_TIPLERI, UTSYAPI } from '../../lib/ilan-sabitler';
import IlceGirisi from '../_components/IlceGirisi';

type PreviewRow = OnizlemeSatiri;

/** Türkiye +03:00 — `PROJE_HARITASI §9` (A2). Sunucu `bugunISO()` ile aynı olmak zorunda. */
function bugun(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * 8 Ağu 2026 — ESKİDEN yalnız iki alan vardı (`kalkisIliNorm`/`varisIliNorm`) ve
 * yalnız il ÇÖZÜLEMEDİĞİNDE açılan bir select'ten set ediliyordu. Yani Excel'de
 * yanlış yazılmış bir tonaj/fiyat/ilçe fark edilse bile kullanıcının tek çaresi
 * dosyayı düzeltip yeniden yüklemekti. Artık önizlemedeki her kart düzenlenebilir.
 *
 * ⚠️ `seferNo` BİLEREK DÜZENLENEMEZ: gruplama ona göre yapılıyor, düzenleme
 * sırasında değişmesi kartların yeniden gruplanıp ekranda yer değiştirmesine
 * (kullanıcının düzenlediği kartın gözünün önünde kaybolmasına) yol açardı.
 */
type SatirYama = Partial<Pick<PreviewRow,
  | 'kalkisIliNorm' | 'kalkisIlce'
  | 'varisIliNorm' | 'varisIlce'
  | 'aracTipi' | 'aracTipiNorm' | 'ustYapi' | 'ustYapiNorm'
  | 'tonaj' | 'palet' | 'fiyat' | 'yukCinsi' | 'not'
>>;
type Overrides = Record<number, SatirYama>;

/**
 * Grup (kart) düzeyinde alanlar — `/api/excel-import` bunları grubun İLK
 * satırından okuyor (`ilk.fiyat`, `ilk.aracTipi`, `ilk.not` …). Düzenlemeyi
 * grubun TÜM satırlarına yazıyoruz: ekranda görünen (`first`) ile sunucunun
 * okuduğu (`ilk`) aynı satır olsa da, `not` alanı ayrıca HER durağın
 * `notlar`ına gidiyor — tek bir "Not" kutusu gösterip yalnız ilk satıra
 * yazmak duraklar arasında sessiz bir tutarsızlık bırakırdı.
 */
const GRUP_ALANLARI = ['kalkisIliNorm', 'kalkisIlce', 'aracTipi', 'aracTipiNorm',
  'ustYapi', 'ustYapiNorm', 'fiyat', 'not'] as const;

const dLbl: React.CSSProperties = {
  color: '#8b949e', fontSize: '0.68rem', fontWeight: 600, marginBottom: 3,
};

const inp: React.CSSProperties = {
  background: '#0d1117', color: '#e2e8f0',
  border: '1px solid #374151', borderRadius: 4,
  padding: '4px 8px', fontSize: '0.82rem', outline: 'none',
};

// ── Şablon sütunları — sözleşme dosyasından. Route da AYNI listeyi görüyor;
// şablon başlığı ile route'un beklediği ad ayrışamaz (B1'in ikinci kırığıydı).
const SABLON_ORNEK: string[][] = [
  ['', 'istanbul', '', 'ankara', '', '', 'tir', 'tenteli', '18', '24', '5000', 'seramik', 'Kırılgan dikkat'],
  ['1', 'izmir', 'konak', 'konya', '', '', 'kamyon', '', '10', '', '3000', '', ''],
  ['1', 'izmir', 'konak', 'ankara', '', '', '', '', '8', '', '', '', ''],
];

export default function TopluYukle({ onGeri }: { onGeri: () => void }) {
  const [adim, setAdim] = useState<'upload' | 'preview' | 'basarili'>('upload');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [overrides, setOverrides] = useState<Overrides>({});
  /** Açık olan düzenleme kartının grup anahtarı ('' = hiçbiri). */
  const [duzenleKey, setDuzenleKey] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [tarih, setTarih] = useState(bugun());
  const [sonuc, setSonuc] = useState<{ olusturulan: number; sonuclar: KayitSonucu[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Şablon indir ──
  async function sablonIndir() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[...SABLON_HEADERS], ...SABLON_ORNEK]);
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

      const rows: HamSatir[] = data
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
      if (rows.length > MAX_SATIR) {
        throw new Error(`Tek seferde en fazla ${MAX_SATIR} satır yüklenebilir. Dosyanızda ${rows.length} dolu satır var.`);
      }

      const istek = { action: 'preview', rows } satisfies TopluYukleIstek;
      const res = await fetch('/api/excel-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(istek),
      });
      const json: TopluYukleYanit = await res.json();
      if (!json.ok) throw new Error(json.hata);
      if (json.action !== 'preview') throw new Error('Beklenmeyen sunucu yanıtı.');

      setPreviewRows(json.preview);
      setOverrides({});
      setDuzenleKey('');
      setAdim('preview');
    } catch (err: any) {
      alert('❌ ' + err.message);
    }
    setYukleniyor(false);
  }

  // ── Override uygula (preview'da anlık düzeltme) ──
  function setOverride(rowIndex: number, field: keyof SatirYama, val: string) {
    setOverrides(prev => ({
      ...prev,
      [rowIndex]: { ...prev[rowIndex], [field]: val === '' ? undefined : val },
    }));
  }

  /** Grup düzeyindeki alanı grubun TÜM satırlarına yazar (gerekçe: GRUP_ALANLARI). */
  function setGrupOverride(rowIndexler: number[], yama: SatirYama) {
    setOverrides(prev => {
      const sonraki = { ...prev };
      for (const ri of rowIndexler) sonraki[ri] = { ...sonraki[ri], ...yama };
      return sonraki;
    });
  }

  /** Araç/kasa tipi seçilince ham VE norm alanı birlikte yazılır — sunucu ham
   *  alanı okuyor (`ilk.aracTipi` → `aracCoz()`), ekran norm'u gösteriyor. */
  function setTip(rowIndexler: number[], hangi: 'arac' | 'uts', val: string) {
    setGrupOverride(rowIndexler, hangi === 'arac'
      ? { aracTipi: val || undefined, aracTipiNorm: val || undefined }
      : { ustYapi: val || undefined, ustYapiNorm: val || undefined });
  }

  // ── Effective rows (preview + override birleşimi) ──
  type EffRow = PreviewRow & {
    kalkisEff: string | null; kalkisEffStatus: string;
    varisEff: string | null;  varisEffStatus: string;
    duzenlendi: boolean;
  };

  const effectiveRows: EffRow[] = previewRows.map(row => {
    const ov = overrides[row.rowIndex] ?? {};
    // Yama TÜM alanlara uygulanıyor; `undefined` olanlar orijinali korur.
    const temel = { ...row };
    for (const [k, v] of Object.entries(ov)) {
      if (v !== undefined) (temel as any)[k] = v;
    }
    const kEff = ov.kalkisIliNorm ?? row.kalkisIliNorm;
    const vEff = ov.varisIliNorm  ?? row.varisIliNorm;
    return {
      ...temel,
      kalkisEff:       kEff,
      kalkisEffStatus: ov.kalkisIliNorm ? 'ok' : row.kalkisIliStatus,
      varisEff:        vEff,
      varisEffStatus:  ov.varisIliNorm  ? 'ok' : row.varisIliStatus,
      // Araç/kasa tipi elle seçildiyse "warn" rozetini düşür.
      aracTipiStatus: ov.aracTipiNorm ? 'ok' : row.aracTipiStatus,
      ustYapiStatus:  ov.ustYapiNorm  ? 'ok' : row.ustYapiStatus,
      duzenlendi: Object.values(ov).some(v => v !== undefined),
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

  // `MAX_SATIR` dosya okunurken bakılıyor ama `MAX_ILAN` bakılmıyordu: 60 gruplu bir
  // dosyada buton "✅ Onayla ve Yayınla (60 ilan)" diyor, kullanıcı basıyor, sunucu
  // 400 dönüyor ve HİÇBİR ilan oluşmuyor. Sınırı burada, basmadan önce göster.
  const ilanAsimi = ilanSayisi > MAX_ILAN;

  // ── Onayla ve yayınla ──
  async function onayla() {
    setYukleniyor(true);
    try {
      // ⚠️ `userId` GÖNDERİLMİYOR — kimlik oturumdan okunuyor (B1).
      // ⚠️ 8 Ağu 2026 — eskiden BURADA yalnız iki alan birleştiriliyordu
      //    (`kalkisIliNorm`/`varisIliNorm`). Düzenleme tüm alanlara açılırken bu
      //    satır güncellenmese kullanıcı ekranda düzelttiği tonajın/fiyatın
      //    KAYDEDİLMEDİĞİNİ ancak ilan oluştuktan sonra fark ederdi. Artık
      //    ekranda gösterilen `effectiveRows` neyse o gönderiliyor — "gördüğün
      //    şey kaydedilen şeydir".
      const finalRows = effectiveRows.map(({ kalkisEff, varisEff, kalkisEffStatus,
                                             varisEffStatus, duzenlendi, ...row }) => ({
        ...row,
        kalkisIliNorm: kalkisEff,
        varisIliNorm:  varisEff,
      }));

      const istek = { action: 'commit', rows: finalRows, tarih } satisfies TopluYukleIstek;
      const res = await fetch('/api/excel-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(istek),
      });
      const data: TopluYukleYanit = await res.json();
      if (!data.ok) throw new Error(data.hata);
      if (data.action !== 'commit') throw new Error('Beklenmeyen sunucu yanıtı.');

      setSonuc({ olusturulan: data.olusturulan, sonuclar: data.sonuclar });
      setAdim('basarili');
    } catch (err: any) {
      alert('❌ ' + (err?.message || 'İlanlar kaydedilemedi.'));
    }
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
        <span style={{ color: '#f87171', fontSize: '0.78rem' }}>
          {raw.trim() ? `⚠ "${raw}"` : '⚠ boş'}
        </span>
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
  // `ILAN_VER_ANALIZ` V4 — ekran ARTIK VARSAYMIYOR. Eskiden koşulsuz "moderatör
  // onayına gönderildi" diyordu; oysa ilanların çoğu doğrudan yayına giriyordu.
  if (adim === 'basarili') {
    const basarililar = sonuc?.sonuclar.filter(s => s.ok) ?? [];
    const hatalilar = sonuc?.sonuclar.filter(s => !s.ok) ?? [];
    const yayinda = basarililar.filter(s => s.durum === 'yayinda').length;
    const incelemede = basarililar.filter(s => s.durum === 'incelemede').length;
    const reddedilen = basarililar.filter(s => s.durum === 'reddedildi').length;

    return (
    <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>{basarililar.length > 0 ? '✅' : '⚠️'}</div>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', marginBottom: 8 }}>
        {sonuc?.olusturulan ?? 0} ilan oluşturuldu
      </div>
      <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24, lineHeight: 1.7 }}>
        {yayinda > 0 && <div>✅ {yayinda} ilan yayında.</div>}
        {incelemede > 0 && <div>🕓 {incelemede} ilan moderatör incelemesinde — onaylanınca yayına alınacak.</div>}
        {reddedilen > 0 && <div>⚠️ {reddedilen} ilan otomatik kontrolden geçemedi.</div>}
      </div>
      {hatalilar.length > 0 && (
        <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: 16, marginBottom: 24, textAlign: 'left' }}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
            ⚠ {hatalilar.length} ilan oluşturulamadı:
          </div>
          {hatalilar.map((e, i) => (
            <div key={i} style={{ color: '#fca5a5', fontSize: '0.78rem', marginBottom: 4 }}>
              • {e.seferNo ? `Sefer ${e.seferNo}: ` : ''}{e.hata}
            </div>
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
  }

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
        {ilanAsimi && (
          <div style={{ color: '#f87171', fontSize: '0.82rem', background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 14px' }}>
            ⚠ Tek seferde en fazla {MAX_ILAN} ilan oluşturulabilir; bu dosyada {ilanSayisi} ilan var.
            Dosyayı bölüp parça parça yükleyin.
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
          const acik = duzenleKey === key;
          const riler = rows.map(r => r.rowIndex);
          const grupDuzenlendi = rows.some(r => r.duzenlendi);

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
                  <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                    📝 {first.not.slice(0, 40)}{first.not.length > 40 ? '...' : ''}
                  </span>
                )}
                {grupDuzenlendi && (
                  <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                    ✎ düzenlendi
                  </span>
                )}
                <button type="button" onClick={() => setDuzenleKey(acik ? '' : key)}
                  style={{
                    marginLeft: 'auto', background: acik ? '#1e3a5f' : 'none',
                    border: `1px solid ${acik ? '#60a5fa' : '#374151'}`,
                    color: acik ? '#60a5fa' : '#8b949e', borderRadius: 6,
                    padding: '3px 10px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                  {acik ? '✕ Kapat' : '✏️ Düzenle'}
                </button>
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

              {/* ── Düzenleme paneli ──────────────────────────────────────────
                  Kart düzeyinde alanlar üstte (grubun TÜM satırlarına yazılır),
                  durak düzeyinde alanlar altta (yalnız o satıra). Tarih burada
                  YOK — tek yükleme tarihi alt barda, tüm dosya için ortak. */}
              {acik && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #21262d' }}>
                  <div style={{ color: '#60a5fa', fontSize: '0.7rem', fontWeight: 700, marginBottom: 8 }}>
                    İLAN BİLGİLERİ
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={dLbl}>Kalkış İli</div>
                      <select value={first.kalkisEff ?? ''} style={inp} aria-label="Kalkış İli"
                        onChange={e => setGrupOverride(riler, { kalkisIliNorm: e.target.value || undefined })}>
                        <option value=''>Seçin</option>
                        {ILLER.map(il => <option key={il}>{il}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={dLbl}>Kalkış İlçesi</div>
                      <IlceGirisi il={first.kalkisEff} value={first.kalkisIlce ?? ''} ariaLabel="Kalkış İlçesi"
                        onChange={v => setGrupOverride(riler, { kalkisIlce: v })} style={inp} />
                    </div>
                    <div>
                      <div style={dLbl}>Araç Tipi</div>
                      <select value={first.aracTipiNorm ?? ''} style={inp} aria-label="Araç Tipi"
                        onChange={e => setTip(riler, 'arac', e.target.value)}>
                        <option value=''>—</option>
                        {ARAC_TIPLERI.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={dLbl}>Üst Yapı</div>
                      <select value={first.ustYapiNorm ?? ''} style={inp} aria-label="Üst Yapı"
                        onChange={e => setTip(riler, 'uts', e.target.value)}>
                        <option value=''>—</option>
                        {UTSYAPI.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={dLbl}>Fiyat (TL)</div>
                      <input type="number" min={0} value={first.fiyat ?? ''} placeholder="Opsiyonel" style={inp} aria-label="Fiyat"
                        onChange={e => setGrupOverride(riler, { fiyat: e.target.value })} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={dLbl}>Not</div>
                    <input value={first.not ?? ''} placeholder="Özel şartlar..." style={inp} aria-label="Not"
                      onChange={e => setGrupOverride(riler, { not: e.target.value })} />
                  </div>

                  <div style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, marginBottom: 8 }}>
                    VARIŞ NOKTALARI ({rows.length})
                  </div>
                  {rows.map(row => (
                    <div key={row.rowIndex} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                        <div>
                          <div style={dLbl}>Varış İli</div>
                          <select value={row.varisEff ?? ''} style={inp} aria-label="Varış İli"
                            onChange={e => setOverride(row.rowIndex, 'varisIliNorm', e.target.value)}>
                            <option value=''>Seçin</option>
                            {ILLER.map(il => <option key={il}>{il}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={dLbl}>Varış İlçesi</div>
                          <IlceGirisi il={row.varisEff} value={row.varisIlce ?? ''} ariaLabel="Varış İlçesi"
                            onChange={v => setOverride(row.rowIndex, 'varisIlce', v)} style={inp} />
                        </div>
                        <div>
                          <div style={dLbl}>Tonaj</div>
                          <input type="number" step="0.1" min={0} value={row.tonaj ?? ''} placeholder="—" style={inp} aria-label="Tonaj"
                            onChange={e => setOverride(row.rowIndex, 'tonaj', e.target.value)} />
                        </div>
                        <div>
                          <div style={dLbl}>Palet</div>
                          <input type="number" min={0} value={row.palet ?? ''} placeholder="—" style={inp} aria-label="Palet"
                            onChange={e => setOverride(row.rowIndex, 'palet', e.target.value)} />
                        </div>
                        <div>
                          <div style={dLbl}>Yük Cinsi</div>
                          <input value={row.yukCinsi ?? ''} placeholder="—" style={inp} aria-label="Yük Cinsi"
                            onChange={e => setOverride(row.rowIndex, 'yukCinsi', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" onClick={() => setDuzenleKey('')}
                      style={{ background: '#14532d', border: '1px solid #166534', color: '#22c55e', borderRadius: 6, padding: '5px 14px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                      ✓ Tamam
                    </button>
                    {grupDuzenlendi && (
                      <button type="button"
                        onClick={() => setOverrides(prev => {
                          const s = { ...prev };
                          for (const ri of riler) delete s[ri];
                          return s;
                        })}
                        style={{ background: 'none', border: '1px solid #374151', color: '#8b949e', borderRadius: 6, padding: '5px 12px', fontSize: '0.78rem', cursor: 'pointer' }}>
                        ↩ Excel'deki hâline dön
                      </button>
                    )}
                    <span style={{ color: '#4b5563', fontSize: '0.7rem' }}>
                      Değişiklikler yalnız bu yüklemeye ait — Excel dosyanız değişmez.
                    </span>
                  </div>
                </div>
              )}
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
        {/* Şablonda tarih sütunu yok; sunucu geçmiş tarihi reddediyor (V1). */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e', fontSize: '0.82rem' }}>
          Yükleme tarihi
          <input
            type="date"
            min={bugun()}
            value={tarih}
            onChange={e => setTarih(e.target.value)}
            style={{ ...inp, padding: '8px 10px' }}
          />
        </label>
        <button
          onClick={onayla}
          disabled={hataSayisi > 0 || ilanAsimi || yukleniyor}
          style={{
            background: hataSayisi > 0 || ilanAsimi ? '#1f2937' : '#22c55e',
            color: hataSayisi > 0 || ilanAsimi ? '#4b5563' : '#000',
            border: 'none', borderRadius: 8,
            padding: '10px 28px', cursor: hataSayisi > 0 || ilanAsimi ? 'not-allowed' : 'pointer',
            fontWeight: 800, fontSize: '0.95rem',
            opacity: yukleniyor ? 0.6 : 1,
          }}
        >
          {yukleniyor
            ? '⏳ Yayınlanıyor...'
            : hataSayisi > 0
            ? `⚠ ${hataSayisi} hata düzeltilmeli`
            : ilanAsimi
            ? `⚠ En fazla ${MAX_ILAN} ilan`
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
