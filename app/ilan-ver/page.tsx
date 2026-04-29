'use client';
import { useEffect, useState } from 'react';
import { ilanKaydet, kullanicitelefon } from './actions';
import { createClient } from '../../lib/supabase';
const supabase = createClient();

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
  'Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
];

const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];
const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];

interface Durak { sehir: string; ilce: string; ton: string; palet: string; notlar: string; }
interface Vehicle { id: string; plate: string; vehicle_type: string; body_types: string[]; brand: string | null; model: string | null; capacity_ton: number | null; }
type Yontem = null | 'tekil' | 'toplu' | 'metin';

function bugun(): string { return new Date().toISOString().split('T')[0]; }

function SecimEkrani({ onSecim }: { onSecim: (y: Yontem) => void }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.4rem', marginBottom: 8 }}>İlan Oluştur</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>Nasıl ilan vermek istersiniz?</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { key: 'tekil', ikon: '📦', baslik: 'Tekil İlan', aciklama: 'Adım adım yeni bir ilan oluşturun.', yakin: false },
          { key: 'toplu', ikon: '📄', baslik: 'Toplu Yükleme', aciklama: 'Excel şablonu ile birden fazla ilan yükleyin.', yakin: true },
          { key: 'metin', ikon: '✍️', baslik: 'Metinden İlan', aciklama: 'WhatsApp mesajından yapay zeka ile ilan oluşturun.', yakin: true },
        ].map(item => (
          <button key={item.key} type="button" onClick={() => onSecim(item.key as Yontem)}
            style={{ background: '#161b22', border: '2px solid #30363d', borderRadius: 12, padding: 20, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#22c55e')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#30363d')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: '1.8rem' }}>{item.ikon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{item.baslik}</span>
                  {item.yakin && <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>YAKINDA</span>}
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>{item.aciklama}</div>
              </div>
              <span style={{ color: item.yakin ? '#4b5563' : '#22c55e', fontSize: '1.2rem' }}>→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function YakindaEkrani({ baslik, aciklama, onGeri }: { baslik: string; aciklama: string; onGeri: () => void }) {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</div>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>{baslik}</div>
      <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 32 }}>{aciklama}</div>
      <button type="button" onClick={onGeri}
        style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontSize: '0.9rem' }}>
        ← Geri Dön
      </button>
    </div>
  );
}

export default function IlanVer() {
  const [yontem, setYontem] = useState<Yontem>(null);
  const [tip, setTip] = useState<'yuk' | 'arac'>('yuk');
  const [arac_tipi, setAracTipi] = useState('');
  const [utsyapi, setUtsyapi] = useState<string[]>([]);
  const [arac_adet, setAracAdet] = useState(1);
  const [yuk_cinsi, setYukCinsi] = useState('');
  const [araclar, setAraclar] = useState<Vehicle[]>([]);
  const [secilenArac, setSecilenArac] = useState<Vehicle | null>(null);
  const [aracYukleniyor, setAracYukleniyor] = useState(false);
  const [kalkis, setKalkis] = useState('');
  const [kalkis_ilce, setKalkisIlce] = useState('');
  const [tarih, setTarih] = useState(bugun());
  const [tarih_esnek, setTarihEsnek] = useState(false);
  const [genel_not, setGenelNot] = useState('');
  const [fiyat, setFiyat] = useState('');
  const [fiyat_pazarlik, setFiyatPazarlik] = useState(false);
  const [tel, setTel] = useState('');
  const [duraklar, setDuraklar] = useState<Durak[]>([{ sehir: '', ilce: '', ton: '', palet: '', notlar: '' }]);
  const [gonderildi, setGonderildi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/giris?redirect=/ilan-ver'; return; }
      const telefon = await kullanicitelefon();
      if (telefon) setTel(telefon);
    }
    init();
  }, []);

  useEffect(() => {
    if (tip !== 'arac') return;
    async function araclariCek() {
      setAracYukleniyor(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('vehicles')
        .select('id, plate, vehicle_type, body_types, brand, model, capacity_ton')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      const liste = (data || []) as Vehicle[];
      setAraclar(liste);
      if (liste.length === 1) {
        setSecilenArac(liste[0]);
        setAracTipi(liste[0].vehicle_type);
        setUtsyapi(liste[0].body_types || []);
      } else {
        setSecilenArac(null);
      }
      setAracYukleniyor(false);
    }
    araclariCek();
  }, [tip]);

  const durakEkle = () => setDuraklar([...duraklar, { sehir: '', ilce: '', ton: '', palet: '', notlar: '' }]);
  const durakSil = (i: number) => setDuraklar(duraklar.filter((_, idx) => idx !== i));
  const durakGuncelle = (i: number, alan: keyof Durak, deger: string) => {
    const yeni = [...duraklar]; yeni[i] = { ...yeni[i], [alan]: deger }; setDuraklar(yeni);
  };
  const toggleUtsyapi = (u: string) => setUtsyapi(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);

  const kaliteBariyer = (): string | null => {
    if (tip === 'arac' && !secilenArac) return 'Lütfen bir araç seçin.';
    if (!kalkis) return 'Kalkış ili zorunludur.';
    if (duraklar.some(d => !d.sehir)) return 'Tüm varış illeri doldurulmalıdır.';
    if (!tarih) return 'Tarih zorunludur.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bariyer = kaliteBariyer();
    if (bariyer) { setHata(bariyer); return; }
    setYukleniyor(true); setHata('');
    try {
      await ilanKaydet({ tip, kalkis, kalkis_ilce, tel, fiyat, fiyat_pazarlik, tarih, tarih_esnek, genel_not, arac_tipi, utsyapi, arac_adet, yuk_cinsi, duraklar });
      setGonderildi(true);
    } catch (err: any) {
      setHata(err.message || 'Bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const s = {
    input: { background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '9px 12px', fontSize: '0.9rem', width: '100%', outline: 'none' } as React.CSSProperties,
    label: { color: '#8b949e', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' },
    card: { background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '20px', marginBottom: 12 } as React.CSSProperties,
    zorunlu: { color: '#ef4444', marginLeft: 2 },
  };

  const Navbar = ({ geri }: { geri?: () => void }) => (
    <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
          </span>
        </a>
        {geri
          ? <button type="button" onClick={geri} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '0.85rem', cursor: 'pointer' }}>← Geri</button>
          : <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>İlan Ver</span>}
      </div>
    </nav>
  );

  if (gonderildi) return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <div style={{ color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>İlanınız yayınlandı!</div>
        <div style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: 24 }}>
          {tip === 'yuk' ? 'Nakliyeciler artık ilanınızı görebilir.' : 'Yük sahipleri artık ilanınızı görebilir.'}
        </div>
        {fiyat && (
          <div style={{ background: '#14532d', border: '1px solid #166534', borderRadius: 8, padding: '10px 20px', marginBottom: 24, display: 'inline-block' }}>
            <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem' }}>✓ Fiyat Belli rozeti kazandınız!</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <a href="/" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>← Ana Sayfa</a>
          <a href="/panel" style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>İlanlarım →</a>
        </div>
      </div>
    </div>
  );

  if (!yontem) return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <Navbar />
      <SecimEkrani onSecim={setYontem} />
    </div>
  );

  if (yontem === 'toplu') return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <Navbar geri={() => setYontem(null)} />
      <YakindaEkrani baslik="Toplu İlan Yükleme" aciklama="Excel şablonu ile toplu ilan yükleme çok yakında geliyor." onGeri={() => setYontem(null)} />
    </div>
  );

  if (yontem === 'metin') return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <Navbar geri={() => setYontem(null)} />
      <YakindaEkrani baslik="Metinden İlan" aciklama="WhatsApp mesajından yapay zeka ile ilan oluşturma çok yakında geliyor." onGeri={() => setYontem(null)} />
    </div>
  );

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh' }}>
      <Navbar geri={() => setYontem(null)} />

      <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.3rem', margin: 0 }}>Yeni İlan</h1>
          {fiyat && <span style={{ background: '#14532d', color: '#22c55e', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6 }}>✓ Fiyat Belli</span>}
        </div>

        {/* İLAN TİPİ */}
        <div style={s.card}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['yuk', 'arac'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTip(t)}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: '2px solid', borderColor: tip === t ? '#22c55e' : '#30363d', background: tip === t ? '#14532d' : '#0d1117', color: tip === t ? '#22c55e' : '#8b949e', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                {t === 'yuk' ? '🔴 Yük İlanı' : '🟢 Araç İlanı'}
              </button>
            ))}
          </div>
          <div style={{ color: '#4b5563', fontSize: '0.78rem', marginTop: 8 }}>
            {tip === 'yuk' ? 'Taşıtmak istediğiniz yük için araç arıyorsunuz.' : 'Boş aracınız için yük arıyorsunuz.'}
          </div>
        </div>

        {/* ARAÇ SEÇİMİ */}
        {tip === 'arac' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em' }}>ARAÇ SEÇİMİ</div>
              <a href="/araclarim" target="_blank" rel="noreferrer"
                style={{ color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', background: '#1a2535', border: '1px solid #1e3a5f', borderRadius: 5, padding: '3px 10px' }}>
                + Araç Ekle
              </a>
            </div>

            {aracYukleniyor ? (
              <div style={{ color: '#4b5563', fontSize: '0.85rem' }}>⏳ Araçlar yükleniyor...</div>
            ) : araclar.length === 0 ? (
              <div style={{ background: '#1a2535', border: '1px solid #1e3a5f', borderRadius: 8, padding: '16px 20px' }}>
                <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>Kayıtlı araç bulunamadı</div>
                <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>Yukarıdaki "Araç Ekle" butonundan araç ekleyip geri dönebilirsiniz.</div>
              </div>
            ) : araclar.length === 1 ? (
              <div style={{ background: '#0d1117', border: '2px solid #22c55e', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (secilenArac?.body_types?.length ?? 0) > 0 ? 8 : 0 }}>
                  <span style={{ background: '#1a2535', color: '#60a5fa', fontWeight: 800, fontSize: '1rem', padding: '4px 12px', borderRadius: 6 }}>
                    {secilenArac?.plate}
                  </span>
                  <span style={{ background: '#14532d', color: '#86efac', fontWeight: 700, fontSize: '0.78rem', padding: '3px 10px', borderRadius: 5 }}>
                    🚛 {secilenArac?.vehicle_type}
                  </span>
                  <span style={{ color: '#22c55e', fontSize: '0.75rem', marginLeft: 'auto' }}>✓ Seçildi</span>
                </div>
                {(secilenArac?.body_types?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {(secilenArac?.body_types ?? []).map(u => (
                      <span key={u} style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{u}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {araclar.map(arac => {
                  const secili = secilenArac?.id === arac.id;
                  return (
                    <button key={arac.id} type="button"
                      onClick={() => { setSecilenArac(arac); setAracTipi(arac.vehicle_type); setUtsyapi(arac.body_types || []); }}
                      style={{ background: '#0d1117', border: `2px solid ${secili ? '#22c55e' : '#30363d'}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: (arac.body_types?.length ?? 0) > 0 ? 8 : 0 }}>
                        <span style={{ background: '#1a2535', color: '#60a5fa', fontWeight: 800, fontSize: '1rem', padding: '4px 12px', borderRadius: 6 }}>{arac.plate}</span>
                        <span style={{ background: '#14532d', color: '#86efac', fontWeight: 700, fontSize: '0.78rem', padding: '3px 10px', borderRadius: 5 }}>🚛 {arac.vehicle_type}</span>
                        {arac.brand && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{arac.brand} {arac.model}</span>}
                        {secili && <span style={{ color: '#22c55e', fontSize: '0.75rem', marginLeft: 'auto' }}>✓ Seçildi</span>}
                      </div>
                      {(arac.body_types?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {(arac.body_types ?? []).map(u => (
                            <span key={u} style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{u}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* KALKIŞ & BİLGİLER */}
        {(tip === 'yuk' || secilenArac) && (
          <div style={s.card}>
            <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16 }}>
              {tip === 'yuk' ? 'KALKIŞ & ARAÇ BİLGİLERİ' : 'KONUM & TARİH'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={s.label}>{tip === 'arac' ? 'Aracın Bulunduğu İl' : 'Kalkış İli'} <span style={s.zorunlu}>*</span></label>
                <select value={kalkis} onChange={e => setKalkis(e.target.value)} required style={s.input}>
                  <option value=''>Seçin</option>
                  {ILLER.map(il => <option key={il}>{il}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>İlçe</label>
                <input value={kalkis_ilce} onChange={e => setKalkisIlce(e.target.value)} placeholder="İlçe (opsiyonel)" style={s.input} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: tip === 'yuk' ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={s.label}>{tip === 'arac' ? 'Müsaitlik Tarihi' : 'Yükleme Tarihi'} <span style={s.zorunlu}>*</span></label>
                <input type="date" value={tarih} onChange={e => setTarih(e.target.value)} required style={s.input} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tarih_esnek} onChange={e => setTarihEsnek(e.target.checked)} />
                  <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>Tarih esnek</span>
                </label>
              </div>
              {tip === 'yuk' && (
                <div>
                  <label style={s.label}>Araç Adedi</label>
                  <input type="number" min={1} value={arac_adet} onChange={e => setAracAdet(parseInt(e.target.value) || 1)} style={s.input} />
                </div>
              )}
            </div>
            {tip === 'yuk' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Araç Tipi</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ARAC_TIPLERI.map(t => (
                      <button key={t} type="button" onClick={() => setAracTipi(arac_tipi === t ? '' : t)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', borderColor: arac_tipi === t ? '#22c55e' : '#30363d', background: arac_tipi === t ? '#14532d' : '#0d1117', color: arac_tipi === t ? '#22c55e' : '#8b949e', fontSize: '0.85rem', cursor: 'pointer', fontWeight: arac_tipi === t ? 700 : 400 }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Üst Yapı <span style={{ color: '#4b5563', fontWeight: 400, fontSize: '0.72rem' }}>(çoklu seçim)</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {UTSYAPI.map(u => (
                      <button key={u} type="button" onClick={() => toggleUtsyapi(u)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', borderColor: utsyapi.includes(u) ? '#60a5fa' : '#30363d', background: utsyapi.includes(u) ? '#1e3a5f' : '#0d1117', color: utsyapi.includes(u) ? '#60a5fa' : '#8b949e', fontSize: '0.85rem', cursor: 'pointer', fontWeight: utsyapi.includes(u) ? 700 : 400 }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Yük Cinsi</label>
                  <input value={yuk_cinsi} onChange={e => setYukCinsi(e.target.value)} placeholder="Seramik, tekstil, elektronik..." style={s.input} />
                </div>
              </>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Not</label>
              <textarea value={genel_not} onChange={e => setGenelNot(e.target.value)}
                placeholder={tip === 'arac' ? 'Çalışma bölgesi, şartlar...' : 'Özel şartlar, dikkat edilmesi gerekenler...'}
                rows={2} style={{ ...s.input, resize: 'vertical' }} />
            </div>
            <div>
              <label style={s.label}>
                {tip === 'arac' ? 'Hedef Navlun (TL)' : 'Ücret Teklifi (TL)'}
                {fiyat && <span style={{ marginLeft: 8, background: '#14532d', color: '#22c55e', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>✓ Fiyat Belli</span>}
              </label>
              <input type="number" value={fiyat} onChange={e => setFiyat(e.target.value)} placeholder="Girilirse 'Fiyat Belli' rozeti alırsınız" style={s.input} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={fiyat_pazarlik} onChange={e => setFiyatPazarlik(e.target.checked)} />
                <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>Pazarlık payı var</span>
              </label>
            </div>
          </div>
        )}

        {/* VARIŞ */}
        {(tip === 'yuk' || secilenArac) && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                {tip === 'arac' ? 'GİDEBİLECEĞİ İLLER' : 'VARIŞ NOKTALARI'} <span style={s.zorunlu}>*</span>
              </div>
              <button type="button" onClick={durakEkle}
                style={{ background: '#1a3a1a', color: '#22c55e', border: '1px solid #166534', borderRadius: 6, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                + {tip === 'arac' ? 'İl Ekle' : 'Durak Ekle'}
              </button>
            </div>
            {duraklar.map((durak, i) => (
              <div key={i} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: duraklar.length > 1 ? 10 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ color: '#f97316', fontWeight: 700, fontSize: '0.82rem' }}>
                    {duraklar.length > 1 ? `${tip === 'arac' ? 'İl' : 'Varış'} ${i + 1}` : (tip === 'arac' ? 'Gideceği İl' : 'Varış')}
                  </span>
                  {duraklar.length > 1 && (
                    <button type="button" onClick={() => durakSil(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem' }}>✕ Kaldır</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: tip === 'yuk' ? 10 : 0 }}>
                  <div>
                    <label style={s.label}>İl <span style={s.zorunlu}>*</span></label>
                    <select value={durak.sehir} onChange={e => durakGuncelle(i, 'sehir', e.target.value)} required style={s.input}>
                      <option value=''>Seçin</option>
                      {ILLER.map(il => <option key={il}>{il}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>İlçe</label>
                    <input value={durak.ilce} onChange={e => durakGuncelle(i, 'ilce', e.target.value)} placeholder="Opsiyonel" style={s.input} />
                  </div>
                </div>
                {tip === 'yuk' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
                    <div>
                      <label style={s.label}>Ton</label>
                      <input type="number" step="0.1" value={durak.ton} onChange={e => durakGuncelle(i, 'ton', e.target.value)} placeholder="Opsiyonel" style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Palet</label>
                      <input type="number" value={durak.palet} onChange={e => durakGuncelle(i, 'palet', e.target.value)} placeholder="Opsiyonel" style={s.input} />
                    </div>
                    <div>
                      <label style={s.label}>Durak Notu</label>
                      <input value={durak.notlar} onChange={e => durakGuncelle(i, 'notlar', e.target.value)} placeholder="Opsiyonel" style={s.input} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* İLETİŞİM */}
        {(tip === 'yuk' || secilenArac) && (
          <div style={s.card}>
            <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>İLETİŞİM</div>
            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>📞 {tel || 'Yükleniyor...'}</span>
              <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>Profilinizdeki numara kullanılacak</span>
            </div>
          </div>
        )}

        {hata && (
          <div style={{ background: '#1a0a0a', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#ef4444', fontSize: '0.85rem' }}>
            ⚠️ {hata}
          </div>
        )}

        {(tip === 'yuk' || secilenArac) && (
          <button type="submit" disabled={yukleniyor}
            style={{ width: '100%', padding: '14px', borderRadius: 8, border: 'none', background: yukleniyor ? '#166534' : '#22c55e', color: '#000', fontWeight: 800, fontSize: '1rem', cursor: 'pointer' }}>
            {yukleniyor ? 'Yayınlanıyor...' : 'İlanı Yayınla →'}
          </button>
        )}
      </form>
    </div>
  );
}
