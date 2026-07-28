'use client';
import { useState, useRef } from 'react';
// Sohbet ayrıştırma/kırpma mantığı sunucuyla ORTAK modülden gelir (lib/whatsapp/chatParser).
import { eskiIcerigiKirp, grupAdiTuret, sohbetTxtSec, mesajBasligiCoz } from '../../lib/whatsapp/chatParser';

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

  // Sohbet ayrıştırma TEK KAYNAKTAN gelir — sunucu (api/whatsapp-parse) da aynı modülü
  // kullanır. Burada kopya regex/tarih mantığı TUTULMAZ; ayrışırlarsa mesaj sessizce kaybolur.

  // ZIP'in içinden SADECE sohbet .txt'inin metnini çıkarır — foto/video hiç sunucuya gitmez.
  // Bu işlem tarayıcıda çalışır, Vercel'in 60sn süresine dahil değil.
  async function zipDenMetinCikar(file: File): Promise<string | null> {
    try {
      const JSZip = (await import('jszip')).default;
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const chatFile = sohbetTxtSec(Object.keys(zip.files).filter(name => !zip.files[name].dir));
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

  // Tek bir dosyayı mesaj sınırından ikiye böler. Bir grup tek dosyaya inmesine
  // rağmen hâlâ zaman aşımına uğruyorsa bölünecek başka bir şey kalmıyordu; artık
  // dosyanın kendisi bölünebiliyor. Kesim MUTLAKA bir mesaj başlangıcında yapılır,
  // yoksa çok satırlı bir ilan ikiye bölünüp iki yarım ilana dönüşür.
  async function dosyayiBol(f: File): Promise<[File, File] | null> {
    let metin: string;
    try { metin = await f.text(); } catch { return null; }
    const satirlar = metin.split('\n');
    if (satirlar.length < 4) return null;

    const orta = Math.floor(satirlar.length / 2);
    let kesim = -1;
    for (let i = orta; i < satirlar.length; i++) {
      if (mesajBasligiCoz(satirlar[i])) { kesim = i; break; }
    }
    if (kesim <= 0 || kesim >= satirlar.length) return null;

    const ad = f.name.replace(/\.txt$/i, '');
    return [
      new File([satirlar.slice(0, kesim).join('\n')], ad + '.1.txt', { type: 'text/plain' }),
      new File([satirlar.slice(kesim).join('\n')], ad + '.2.txt', { type: 'text/plain' }),
    ];
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
    const kuyruk: File[][] = [];
    let acikGrup: File[] = [];
    let acikGrupBytes = 0;
    for (const f of hazirDosyalar) {
      const sayiAsimi = acikGrup.length >= CHUNK_SIZE;
      const boyutAsimi = acikGrup.length > 0 && acikGrupBytes + f.size > MAX_CHUNK_BYTES;
      if (sayiAsimi || boyutAsimi) {
        kuyruk.push(acikGrup);
        acikGrup = [];
        acikGrupBytes = 0;
      }
      acikGrup.push(f);
      acikGrupBytes += f.size;
    }
    if (acikGrup.length > 0) kuyruk.push(acikGrup);

    const toplamSonuc = {
      success: true,
      total_messages: 0,
      unparsed_timestamps: 0,
      saved_to_db: 0,
      skipped: 0,
      spam_blocked: 0,
      reposted: 0,
      insert_failed: 0,
      aliases_count: 0,
      bolunme: 0,
      debug: [] as string[],
      errors: [] as string[],
      error: '',
    };

    // ── İş kuyruğu + otomatik ikiye bölme ────────────────────────────────────
    // Bir grup zaman aşımına uğrarsa (504 / sunucunun `tamamlanmadi` bayrağı) tüm
    // yükleme iptal EDİLMEZ: grup ikiye bölünüp kuyruğun başına konur ve yeniden
    // denenir. Sunucu tarafı hash bazlı tekilleştirme yaptığı için aynı içeriği
    // tekrar göndermek güvenlidir — daha önce yazılanlar `skipped` olarak döner.
    // Böylece parti büyüklüğü sihirli sabitlerle değil, ölçülen davranışla ayarlanır.
    const MAX_BOLUNME = 8; // sonsuz döngü emniyeti
    let tamamlanan = 0;

    while (kuyruk.length > 0) {
      const grup = kuyruk.shift()!;
      setProgress({ current: tamamlanan + 1, total: tamamlanan + kuyruk.length + 1 });

      const formData = new FormData();
      grup.forEach(f => formData.append('files', f));
      formData.append('group_name', grupAdi || 'Bilinmiyor');
      formData.append('saat_filtre', saatFiltre.toString());

      // Grubu ikiye bölüp kuyruğun BAŞINA koyar. Bölünemiyorsa false döner.
      const bolVeKuyruklaAsync = async (): Promise<boolean> => {
        if (toplamSonuc.bolunme >= MAX_BOLUNME) return false;
        if (grup.length > 1) {
          const orta = Math.ceil(grup.length / 2);
          kuyruk.unshift(grup.slice(0, orta), grup.slice(orta));
          toplamSonuc.bolunme++;
          return true;
        }
        const yarilar = await dosyayiBol(grup[0]);
        if (!yarilar) return false;
        kuyruk.unshift([yarilar[0]], [yarilar[1]]);
        toplamSonuc.bolunme++;
        return true;
      };

      try {
        const res = await fetch('/api/whatsapp-parse', { method: 'POST', body: formData });
        const raw = await res.text();
        let data: any;
        try {
          data = JSON.parse(raw);
        } catch {
          // 504/413/500 → platform JSON değil HTML/düz metin döner. Küçült ve
          // tekrar dene. 500 de listeye dahil: yanıt gövdesi Vercel'in ~4,5 MB
          // tavanını aştığında platform FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE ile
          // düz 500 döndürür ve bu da bölünce çözülür. Bölünemiyorsa döngü
          // `bolVeKuyruklaAsync` false dönünce kendiliğinden durur.
          if ((res.status === 504 || res.status === 413 || res.status === 500)
              && await bolVeKuyruklaAsync()) continue;
          toplamSonuc.success = false;
          toplamSonuc.error = res.status === 413
            ? 'Dosyalar çok büyük — sunucu isteği reddetti ve daha fazla bölünemedi.'
            : res.status === 504
            ? 'Sunucu zaman aşımı — parça daha fazla bölünemedi.'
            : `Sunucu hatası (HTTP ${res.status}) — JSON dönmedi. Parça daha fazla bölünemedi.`;
          break;
        }
        if (!res.ok || !data.success) {
          toplamSonuc.success = false;
          toplamSonuc.error = data.error || 'Bilinmeyen hata';
          break;
        }

        toplamSonuc.total_messages += data.total_messages || 0;
        toplamSonuc.unparsed_timestamps += data.unparsed_timestamps || 0;
        toplamSonuc.saved_to_db   += data.saved_to_db   || 0;
        toplamSonuc.skipped       += data.skipped       || 0;
        toplamSonuc.spam_blocked  += data.spam_blocked  || 0;
        toplamSonuc.reposted      += data.reposted      || 0;
        toplamSonuc.insert_failed += data.insert_failed || 0;
        toplamSonuc.aliases_count  = data.aliases_count || toplamSonuc.aliases_count;
        if (data.debug) toplamSonuc.debug.push(...data.debug);
        if (data.errors?.length) toplamSonuc.errors.push(...data.errors);

        // Sunucu süre bütçesini doldurup kısmi kaydetti → kalanı için tekrar sıraya al.
        if (data.tamamlanmadi) {
          if (await bolVeKuyruklaAsync()) continue;
          toplamSonuc.errors.push(`${data.islenmeyen || 0} kayıt süre yetmediği için işlenemedi ve parça daha fazla bölünemedi.`);
        }
        tamamlanan++;
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
                    setGrupAdi(grupAdiTuret(files[0].name));
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
                    const folderName = relPath?.split('/')?.[0] || grupAdiTuret(files[0].name);
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
                      {sonuc.unparsed_timestamps > 0 && (
                        <span style={{ color: '#fbbf24' }}>
                          ⚠️ {sonuc.unparsed_timestamps} mesajın tarihi çözülemedi
                        </span>
                      )}
                      {sonuc.insert_failed > 0 && (
                        <span style={{ color: '#f87171' }}>
                          ⚠️ {sonuc.insert_failed} kayıt yazılamadı
                        </span>
                      )}
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
                {sonuc.errors?.length > 0 && (
                  <div style={{ background: '#2a0d0d', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 14px', marginTop: 4, fontSize: '0.75rem', color: '#fca5a5', lineHeight: 1.5 }}>
                    {sonuc.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                  </div>
                )}
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
