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
  const [hazirlaniyor, setHazirlaniyor] = useState(false);

  const CHUNK_SIZE = 5; // Her istekte kaç dosya (üst sınır)
  const MAX_CHUNK_BYTES = 15 * 1024 * 1024; // ~15MB üstü tek istekte Vercel timeout riski yüksek
  const BUYUK_DOSYA_ESIK = 20 * 1024 * 1024; // Bu boyutun üstü muhtemelen "medyalı" export — tarayıcıda ayıklama biraz sürer

  const buyukDosyalar = dosyalar.filter(f => f.size > BUYUK_DOSYA_ESIK);

  // Sohbet metnindeki mesaj başlangıcı regex'leri — sunucudaki parseChatTxt (whatsapp-parse/route.ts) ile birebir aynı.
  const TS_ANDROID = /^\[(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)\]\s(.+?):\s(.*)$/;
  const TS_IOS = /^(\d{1,2}\.\d{1,2}\.\d{4}[,\s]\d{1,2}:\d{1,2})\s?-\s(.+?):\s(.*)$/;

  function zamanDamgasiCoz(raw: string): Date | null {
    const tsClean = raw.replace(',', '').replace(/\s+/g, ' ').trim();
    const parts = tsClean.split(' ');
    if (parts.length < 2) return null;
    const [datePart, timePart] = parts;
    const ds = datePart.split('.');
    if (ds.length < 3) return null;
    const [day, month, year] = ds;
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const d = new Date(`${isoDate}T${timePart}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Metni SONDAN başa doğru tarar, cutoff'tan (+ güvenlik payı) eski ilk mesajı bulunca durur —
  // öncesindeki (muhtemelen çok daha büyük) eski geçmişi hiç okumaya/işlemeye gerek kalmaz.
  // Sunucu zaten `saat_filtre` cutoff'undan eskisini atıyordu; bu adım aynı filtreyi göndermeden ÖNCE tarayıcıda uygular.
  function eskiIcerigiKirp(text: string, saatFiltreSaat: number): string {
    const GUVENLIK_PAYI_SAAT = 6; // saat dilimi/gecikme farklarına karşı tampon — sınırdaki mesajı yanlışlıkla atmamak için
    const cutoff = new Date(Date.now() - (saatFiltreSaat + GUVENLIK_PAYI_SAAT) * 60 * 60 * 1000);
    const lines = text.split('\n');
    let kesimIndex = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].replace(/[‎‪‬‏​]/g, '').trim();
      if (!trimmed) continue;
      const match = TS_ANDROID.exec(trimmed) || TS_IOS.exec(trimmed);
      if (!match) continue; // devam satırı (mesaj başlangıcı değil) — atla, aramaya devam
      const d = zamanDamgasiCoz(match[1]);
      if (!d) continue;
      if (d < cutoff) { kesimIndex = i + 1; break; } // bu mesajdan öncesi eski — burada dur
    }
    return kesimIndex === 0 ? text : lines.slice(kesimIndex).join('\n');
  }

  // ZIP'in içinden SADECE sohbet .txt'inin metnini çıkarır — foto/video hiç sunucuya gitmez.
  // Bu işlem tarayıcıda çalışır, Vercel'in 60sn süresine dahil değil.
  async function zipDenMetinCikar(file: File): Promise<string | null> {
    try {
      const JSZip = (await import('jszip')).default;
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const allTxts = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.toLowerCase().endsWith('.txt'));
      const chatFile = allTxts.find(n => n.toLowerCase().includes('_chat')) ||
                       allTxts.find(n => n.toLowerCase().includes('chat')) ||
                       allTxts.find(n => n.toLowerCase().includes('sohbet')) ||
                       (allTxts.length === 1 ? allTxts[0] : null);
      if (!chatFile) return null; // sohbet txt'i bulunamadı — orijinali gönder, sunucu eskisi gibi atlar
      return await zip.files[chatFile].async('string');
    } catch {
      return null; // ayıklama başarısız oldu (bozuk zip vb.) — orijinali gönder, eski davranış
    }
  }

  // Dosyayı sunucuya göndermeden önce hazırlar: ZIP ise sohbet metnini çıkarır, ardından HER İKİ
  // durumda da (zip'ten çıkan veya düz .txt) cutoff'tan eski geçmişi tarayıcıda kırpar —
  // sunucuya sadece işe yarayacak son kısım gider, yıllık gruplarda da payload küçük kalır.
  async function dosyaHazirla(file: File, saatFiltreSaat: number): Promise<File> {
    const adKucuk = file.name.toLowerCase();
    let text: string | null = null;
    if (adKucuk.endsWith('.zip')) {
      text = await zipDenMetinCikar(file);
      if (text === null) return file; // ayıklanamadı — orijinal zip'i olduğu gibi gönder, sunucu eski davranışa düşer
    } else if (adKucuk.endsWith('.txt')) {
      try { text = await file.text(); } catch { return file; }
    } else {
      return file; // bilinmeyen format — dokunma
    }
    const kirpilmis = eskiIcerigiKirp(text, saatFiltreSaat);
    return new File([kirpilmis], file.name.replace(/\.zip$/i, '.txt'), { type: 'text/plain' });
  }

  async function yukle() {
    if (dosyalar.length === 0) return;
    setYukleniyor(true);
    setSonuc(null);

    // 0. ZIP'leri tarayıcıda aç (medya sunucuya hiç gitmez) ve her iki durumda da (zip/txt)
    // cutoff'tan eski geçmişi tarayıcıda kırp — sunucuya sadece işe yarayan son kısım gider.
    setHazirlaniyor(true);
    const hazirDosyalar: File[] = [];
    for (const f of dosyalar) {
      hazirDosyalar.push(await dosyaHazirla(f, saatFiltre));
    }
    setHazirlaniyor(false);

    // Boyuta duyarlı gruplama: hem dosya sayısı hem toplam byte sınırı aşılınca yeni grup açılır
    // (tek başına devasa bir dosya varsa yine de kendi grubunda tek başına gider — bölünemez)
    const chunks: File[][] = [];
    let acikGrup: File[] = [];
    let acikGrupBytes = 0;
    for (const f of hazirDosyalar) {
      const sayiAsimi = acikGrup.length >= CHUNK_SIZE;
      const boyutAsimi = acikGrup.length > 0 && acikGrupBytes + f.size > MAX_CHUNK_BYTES;
      if (sayiAsimi || boyutAsimi) {
        chunks.push(acikGrup);
        acikGrup = [];
        acikGrupBytes = 0;
      }
      acikGrup.push(f);
      acikGrupBytes += f.size;
    }
    if (acikGrup.length > 0) chunks.push(acikGrup);

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
        const raw = await res.text();
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          toplamSonuc.success = false;
          toplamSonuc.error = res.status === 413
            ? `Dosyalar çok büyük (grup ${ci + 1}/${chunks.length}) — sunucu isteği reddetti. Daha az dosya seçip tekrar dene.`
            : res.status === 504
            ? `Sunucu zaman aşımı (grup ${ci + 1}/${chunks.length}) — dosyalar çok uzun sürdü.`
            : `Sunucu hatası (HTTP ${res.status}, grup ${ci + 1}/${chunks.length}) — JSON dönmedi.`;
          break;
        }
        if (!res.ok || !data.success) {
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

            {buyukDosyalar.length > 0 && (
              <div style={{ width: '100%', background: '#2a1a0d', border: '1px solid #92400e', borderRadius: 6, padding: '8px 14px', fontSize: '0.78rem', color: '#fbbf24', lineHeight: 1.5 }}>
                ⚠️ {buyukDosyalar.length} dosya büyük ({buyukDosyalar.map(f => `${f.name} — ${(f.size / 1024 / 1024).toFixed(1)}MB`).join(', ')}) — muhtemelen fotoğraf/video ile ("medyalı") export edilmiş.
                Yükle'ye basınca tarayıcı önce içindeki sohbet metnini ayıklayıp sadece onu gönderecek (medya sunucuya gitmez); bu ayıklama adımı dosya boyutuna göre biraz sürebilir, sabırlı ol.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={yukle} disabled={yukleniyor || dosyalar.length === 0}
                style={{ background: dosyalar.length > 0 ? '#22c55e' : '#1f2937', color: '#000', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: '0.85rem', fontWeight: 700, cursor: yukleniyor ? 'not-allowed' : 'pointer', opacity: yukleniyor ? 0.8 : 1 }}>
                {hazirlaniyor
                  ? '📦 Medya ayıklanıyor...'
                  : yukleniyor && progress
                  ? `⏳ Grup ${progress.current}/${progress.total}...`
                  : yukleniyor
                  ? 'Yükleniyor...'
                  : `Yükle (${dosyalar.length} dosya)`}
              </button>
              {yukleniyor && progress && progress.total > 1 && (
                <div style={{ background: '#1f2937', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{
                    background: '#22c55e',
                    height: '100%',
                    width: `${(progress.current / progress.total) * 100}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </div>

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
