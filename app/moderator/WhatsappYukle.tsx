'use client';
import { useState, useRef } from 'react';

export default function WhatsappYukle() {
  const [acik, setAcik] = useState(false);
  const [dosyalar, setDosyalar] = useState<File[]>([]);
  const [grupAdi, setGrupAdi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);
  const [saatFiltre, setSaatFiltre] = useState(48);
  const [klasorModu, setKlasorModu] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const klasorRef = useRef<HTMLInputElement>(null);

  const [debugAcik, setDebugAcik] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const CHUNK_SIZE = 5; // Her istekte kaç dosya

  async function yukle() {
    if (dosyalar.length === 0) return;
    setYukleniyor(true);
    setSonuc(null);

    const chunks: File[][] = [];
    for (let i = 0; i < dosyalar.length; i += CHUNK_SIZE)
      chunks.push(dosyalar.slice(i, i + CHUNK_SIZE));

    const toplamSonuc = {
      success: true,
      total_messages: 0,
      saved_to_db: 0,
      skipped: 0,
      spam_blocked: 0,
      reposted: 0,
      aliases_count: 0,
      debug: [] as string[],
      error: '',
    };

    for (let ci = 0; ci < chunks.length; ci++) {
      setProgress({ current: ci + 1, total: chunks.length });

      const formData = new FormData();
      chunks[ci].forEach(f => formData.append('files', f));
      formData.append('group_name', grupAdi || 'Bilinmiyor');
      formData.append('saat_filtre', saatFiltre.toString());

      try {
        const res = await fetch('/api/whatsapp-parse', { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success) {
          toplamSonuc.success = false;
          toplamSonuc.error = data.error || 'Bilinmeyen hata';
          break;
        }
        toplamSonuc.total_messages += data.total_messages || 0;
        toplamSonuc.saved_to_db   += data.saved_to_db   || 0;
        toplamSonuc.skipped       += data.skipped       || 0;
        toplamSonuc.spam_blocked  += data.spam_blocked  || 0;
        toplamSonuc.reposted      += data.reposted      || 0;
        toplamSonuc.aliases_count  = data.aliases_count || toplamSonuc.aliases_count;
        if (data.debug) toplamSonuc.debug.push(...data.debug);
      } catch (e: any) {
        toplamSonuc.success = false;
        toplamSonuc.error = e.message || 'Ağ hatası';
        break;
      }
    }

    setSonuc(toplamSonuc);
    setProgress(null);
    setYukleniyor(false);
    if (toplamSonuc.success) setDosyalar([]);
  }

  function dosyaAdiTemizle(ad: string) {
    return ad
      .replace('.zip', '').replace('.txt', '')
      .replace('WhatsApp Sohbeti - ', '')
      .replace('WhatsApp Chat - ', '')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[‎‪‬‏​]/g, '')
      .replace(/[^\w\s\-À-ɏ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return (
    <div style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8px 16px' }}>
        <button onClick={() => setAcik(!acik)}
          style={{ background: 'none', border: '1px solid #166534', color: '#22c55e', borderRadius: 6, padding: '5px 14px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
          📱 WhatsApp ZIP Yükle {acik ? '▲' : '▼'}
        </button>

        {acik && (
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>GRUP ADI</div>
              <input value={grupAdi} onChange={e => setGrupAdi(e.target.value)}
                placeholder="Nakliye TR Grubu"
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', outline: 'none', width: 200 }} />
            </div>

            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>SON KAÇ SAAT</div>
              <select value={saatFiltre} onChange={e => setSaatFiltre(Number(e.target.value))}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', outline: 'none' }}>
                <option value={6}>6 saat</option>
                <option value={12}>12 saat</option>
                <option value={24}>24 saat</option>
                <option value={48}>48 saat</option>
                <option value={72}>72 saat</option>
                <option value={168}>7 gün</option>
              </select>
            </div>

            <div>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>DOSYALAR</span>
                <button
                  onClick={() => { setKlasorModu(m => !m); setDosyalar([]); setSonuc(null); }}
                  style={{
                    background: klasorModu ? '#1e3a5f' : '#1f2937',
                    border: `1px solid ${klasorModu ? '#3b82f6' : '#374151'}`,
                    color: klasorModu ? '#60a5fa' : '#6b7280',
                    borderRadius: 4, padding: '1px 7px', fontSize: '0.66rem',
                    fontWeight: 700, cursor: 'pointer', lineHeight: 1.6,
                  }}>
                  {klasorModu ? '📁 klasör' : '📄 dosyalar'}
                </button>
              </div>

              {/* Gizli input: tekil/çoklu dosya */}
              <input
                ref={dosyaRef}
                type="file"
                multiple
                accept=".zip,.txt"
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setDosyalar(files);
                  if (files.length > 0 && !grupAdi)
                    setGrupAdi(dosyaAdiTemizle(files[0].name));
                  e.target.value = '';
                }}
              />

              {/* Gizli input: klasör seçimi */}
              {/* @ts-ignore */}
              <input
                ref={klasorRef}
                type="file"
                {...({ webkitdirectory: '' } as any)}
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                    .filter(f => f.name.endsWith('.zip') || f.name.endsWith('.txt'));
                  setDosyalar(files);
                  if (files.length > 0 && !grupAdi) {
                    // Klasör adını webkitRelativePath'ten çek
                    const relPath = (files[0] as any).webkitRelativePath as string | undefined;
                    const folderName = relPath?.split('/')?.[0] || dosyaAdiTemizle(files[0].name);
                    setGrupAdi(folderName);
                  }
                  e.target.value = '';
                }}
              />

              <button
                onClick={() => (klasorModu ? klasorRef : dosyaRef).current?.click()}
                style={{
                  display: 'block', marginTop: 4,
                  background: dosyalar.length > 0 ? '#0d2b1a' : '#0d1117',
                  border: `1px dashed ${dosyalar.length > 0 ? '#166534' : '#374151'}`,
                  color: dosyalar.length > 0 ? '#22c55e' : '#8b949e',
                  borderRadius: 6, padding: '6px 14px', fontSize: '0.82rem',
                  cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                {dosyalar.length > 0
                  ? `✓ ${dosyalar.length} dosya seçildi`
                  : klasorModu
                  ? '📁 Klasör Seç'
                  : '📄 Dosya Seç'}
              </button>

              {klasorModu && dosyalar.length === 0 && (
                <div style={{ color: '#4b5563', fontSize: '0.68rem', marginTop: 4, maxWidth: 200 }}>
                  Tüm ZIP/TXT'leri aynı klasöre koy, o klasörü seç.
                </div>
              )}
            </div>

            <button onClick={yukle} disabled={yukleniyor || dosyalar.length === 0}
              style={{ background: dosyalar.length > 0 ? '#22c55e' : '#1f2937', color: '#000', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
              {yukleniyor ? 'Yükleniyor...' : `Yükle (${dosyalar.length} dosya)`}
            </button>

            {sonuc && (
              <div style={{ width: '100%', marginTop: 4 }}>
                <div style={{ background: sonuc.success ? '#0d2b1a' : '#2a0d0d', border: `1px solid ${sonuc.success ? '#166534' : '#7f1d1d'}`, borderRadius: 6, padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {sonuc.success ? (
                    <>
                      <span style={{ color: '#22c55e' }}>
                        ✅ {sonuc.total_messages} mesaj tarandı — {sonuc.saved_to_db} kaydedildi
                        {sonuc.skipped > 0 && ` · ${sonuc.skipped} tekrar`}
                        {sonuc.spam_blocked > 0 && ` · ${sonuc.spam_blocked} spam`}
                        {sonuc.reposted > 0 && ` · ${sonuc.reposted} repost`}
                        {sonuc.aliases_count !== undefined && ` · ${sonuc.aliases_count} alias`}
                        {sonuc.total_messages === 0 && ' ⚠️ Mesaj parse edilemedi — format kontrol et'}
                      </span>
                      {sonuc.debug?.length > 0 && (
                        <button onClick={() => setDebugAcik(d => !d)}
                          style={{ background: 'none', border: '1px solid #30363d', color: '#6b7280', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem' }}>
                          {debugAcik ? '▲ debug gizle' : '▼ debug göster'}
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#ef4444' }}>⚠️ {sonuc.error}</span>
                  )}
                </div>
                {debugAcik && sonuc.debug?.length > 0 && (
                  <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, padding: 10, marginTop: 4, maxHeight: 300, overflowY: 'auto' }}>
                    {sonuc.debug.slice(0, 60).map((line: string, i: number) => (
                      <div key={i} style={{
                        fontSize: '0.68rem', fontFamily: 'monospace', marginBottom: 2, lineHeight: 1.4,
                        color: line.startsWith('SKIP') ? '#f87171' : line.startsWith('MSG') && line.includes('isAd=true') ? '#22c55e' : line.startsWith('PHONE') ? '#60a5fa' : '#4b5563',
                      }}>
                        {line}
                      </div>
                    ))}
                    {sonuc.debug.length > 60 && (
                      <div style={{ color: '#4b5563', fontSize: '0.68rem', marginTop: 4 }}>... {sonuc.debug.length - 60} satır daha</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
