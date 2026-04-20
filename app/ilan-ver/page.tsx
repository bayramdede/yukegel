'use client';
import { useState } from 'react';
import { ilanKaydet } from './actions';


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

const ARAC_TIPLERI = ['TIR','Kırkayak','Kamyon','Kamyonet','Panelvan'];
const UTSYAPI = ['Tenteli','Açık Kasa','Kapalı Kasa','Frigorifik','Damperli','Lowbed','Liftli','Silo'];

interface Durak {
  sehir: string;
  ilce: string;
  arac_tipi: string;      // tek seçim — string
  utsyapi: string[];      // çoklu seçim — array
  arac_adet: number;
  yuk_cinsi: string;
  ton: string;
  palet: string;
  notlar: string;
}

export default function IlanVer() {
  const [tip, setTip] = useState<'yuk'|'arac'>('yuk');
  const [kalkis, setKalkis] = useState('');
  const [kalkis_ilce, setKalkisIlce] = useState('');
  const [tel, setTel] = useState('');
  const [fiyat, setFiyat] = useState('');
  const [fiyat_pazarlik, setFiyatPazarlik] = useState(false);
  const [tarih, setTarih] = useState('');
  const [tarih_esnek, setTarihEsnek] = useState(false);
  const [genel_not, setGenelNot] = useState('');
  const [duraklar, setDuraklar] = useState<Durak[]>([{
    sehir:'', ilce:'', arac_tipi:'', utsyapi:[], arac_adet:1,
    yuk_cinsi:'', ton:'', palet:'', notlar:''
  }]);
  const [gonderildi, setGonderildi] = useState(false);

  const durakEkle = () => {
    setDuraklar([...duraklar, {
      sehir:'', ilce:'', arac_tipi:'', utsyapi:[], arac_adet:1,
      yuk_cinsi:'', ton:'', palet:'', notlar:''
    }]);
  };

  const durakGuncelle = (i: number, alan: keyof Durak, deger: any) => {
    const yeni = [...duraklar];
    yeni[i] = {...yeni[i], [alan]: deger};
    setDuraklar(yeni);
  };

  const durakSil = (i: number) => {
    setDuraklar(duraklar.filter((_,idx) => idx !== i));
  };

const [yukleniyor, setYukleniyor] = useState(false);
const [hata, setHata] = useState('');

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setYukleniyor(true);
  setHata('');
  try {
    await ilanKaydet({
      tip, kalkis, kalkis_ilce, tel, fiyat,
      fiyat_pazarlik, tarih, tarih_esnek,
      genel_not, duraklar
    });
    setGonderildi(true);
  } catch (err: any) {
    setHata(err.message || 'Bir hata oluştu.');
  } finally {
    setYukleniyor(false);
  }
};

  const s = { // styles kısaltma
    input: {
      background:'#0d1117', color:'#e2e8f0', border:'1px solid #30363d',
      borderRadius:6, padding:'8px 12px', fontSize:'0.9rem', width:'100%',
      outline:'none'
    } as React.CSSProperties,
    label: {
      color:'#8b949e', fontSize:'0.78rem', fontWeight:600,
      letterSpacing:'0.05em', textTransform:'uppercase' as const,
      marginBottom:6, display:'block'
    },
    section: {
      background:'#161b22', border:'1px solid #30363d',
      borderRadius:8, padding:'20px', marginBottom:16
    } as React.CSSProperties,
  };

  if (gonderildi) return (
    <div style={{background:'#0d1117', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{textAlign:'center', color:'#e2e8f0'}}>
        <div style={{fontSize:'3rem', marginBottom:16}}>✅</div>
        <div style={{fontSize:'1.25rem', fontWeight:700, marginBottom:8}}>İlanınız alındı!</div>
        <div style={{color:'#8b949e', marginBottom:24}}>Kısa süre içinde yayına girecek.</div>
        <a href="/" style={{color:'#22c55e', fontWeight:600}}>← Ana sayfaya dön</a>
      </div>
    </div>
  );

  return (
    <div style={{background:'#0d1117', minHeight:'100vh'}}>

      {/* NAVBAR */}
      <nav style={{background:'#161b22', borderBottom:'1px solid #30363d', position:'sticky', top:0, zIndex:50}}>
        <div style={{maxWidth:800, margin:'0 auto', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <a href="/" style={{textDecoration:'none', display:'flex', alignItems:'center', gap:8}}>
            <img src="/logo.svg" alt="Yükegel" style={{width:28, height:28}}/>
            <span style={{fontWeight:800, fontSize:'1.1rem'}}>
              <span style={{color:'#22c55e'}}>YÜKE</span>
              <span style={{color:'#e2e8f0'}}>GEL</span>
            </span>
          </a>
          <span style={{color:'#8b949e', fontSize:'0.85rem'}}>İlan Ver</span>
        </div>
      </nav>

      <form onSubmit={handleSubmit} style={{maxWidth:800, margin:'0 auto', padding:'24px 16px'}}>

        <h1 style={{color:'#e2e8f0', fontWeight:800, fontSize:'1.4rem', marginBottom:24}}>
          Yeni İlan Oluştur
        </h1>

        {/* İLAN TİPİ */}
        <div style={s.section}>
          <label style={s.label}>İlan Türü</label>
          <div style={{display:'flex', gap:8}}>
            {(['yuk','arac'] as const).map(t => (
              <button key={t} type="button" onClick={()=>setTip(t)}
                style={{
                  flex:1, padding:'12px', borderRadius:6, border:'2px solid',
                  borderColor: tip===t ? '#22c55e' : '#30363d',
                  background: tip===t ? '#14532d' : '#0d1117',
                  color: tip===t ? '#22c55e' : '#8b949e',
                  fontWeight:700, fontSize:'0.95rem', cursor:'pointer'
                }}>
                {t==='yuk' ? '🔴 Yük İlanı' : '🟢 Araç İlanı'}
              </button>
            ))}
          </div>
          <div style={{color:'#4b5563', fontSize:'0.78rem', marginTop:8}}>
            {tip==='yuk'
              ? 'Taşıtmak istediğiniz yük için araç arıyorsunuz.'
              : 'Boş aracınız için yük arıyorsunuz.'}
          </div>
        </div>

        {/* KALKIŞ */}
        <div style={s.section}>
          <label style={s.label}>📍 Kalkış Noktası</label>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div>
              <label style={{...s.label, marginBottom:4}}>İl *</label>
              <select value={kalkis} onChange={e=>setKalkis(e.target.value)} required style={s.input}>
                <option value=''>Seçin</option>
                {ILLER.map(il=><option key={il}>{il}</option>)}
              </select>
            </div>
            <div>
              <label style={{...s.label, marginBottom:4}}>İlçe</label>
              <input value={kalkis_ilce} onChange={e=>setKalkisIlce(e.target.value)}
                placeholder="İlçe (opsiyonel)" style={s.input}/>
            </div>
          </div>
        </div>

        {/* VARIŞ NOKTALARI */}
        <div style={s.section}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
            <label style={{...s.label, marginBottom:0}}>🏁 Varış Noktası(ları)</label>
            <button type="button" onClick={durakEkle}
              style={{background:'#1a3a1a', color:'#22c55e', border:'1px solid #166534',
                borderRadius:6, padding:'4px 12px', fontSize:'0.8rem', fontWeight:700, cursor:'pointer'}}>
              + Durak Ekle
            </button>
          </div>

          {duraklar.map((durak, i) => (
            <div key={i} style={{border:'1px solid #30363d', borderRadius:6, padding:16, marginBottom:12, background:'#0d1117'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                <span style={{color:'#22c55e', fontWeight:700, fontSize:'0.85rem'}}>
                  Varış {duraklar.length > 1 ? i+1 : ''}
                </span>
                {duraklar.length > 1 && (
                  <button type="button" onClick={()=>durakSil(i)}
                    style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'0.85rem'}}>
                    ✕ Kaldır
                  </button>
                )}
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                <div>
                  <label style={{...s.label, marginBottom:4}}>İl *</label>
                  <select value={durak.sehir} onChange={e=>durakGuncelle(i,'sehir',e.target.value)} required style={s.input}>
                    <option value=''>Seçin</option>
                    {ILLER.map(il=><option key={il}>{il}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{...s.label, marginBottom:4}}>İlçe</label>
                  <input value={durak.ilce} onChange={e=>durakGuncelle(i,'ilce',e.target.value)}
                    placeholder="İlçe (opsiyonel)" style={s.input}/>
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <label style={{...s.label, marginBottom:8}}>Araç Tipi</label>
                <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
{/* ARAÇ TİPİ - tek seçim */}
<div style={{marginBottom:12}}>
  <label style={{...s.label, marginBottom:8}}>Araç Tipi</label>
  <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
    {ARAC_TIPLERI.map(t => (
      <button key={t} type="button"
        onClick={()=>durakGuncelle(i,'arac_tipi', durak.arac_tipi===t ? '' : t)}
        style={{
          padding:'5px 12px', borderRadius:4, border:'1px solid',
          borderColor: durak.arac_tipi===t ? '#22c55e' : '#30363d',
          background: durak.arac_tipi===t ? '#14532d' : '#0d1117',
          color: durak.arac_tipi===t ? '#22c55e' : '#8b949e',
          fontSize:'0.82rem', cursor:'pointer', fontWeight: durak.arac_tipi===t ? 700 : 400
        }}>
        {t}
      </button>
    ))}
  </div>
</div>

{/* ÜST YAPI - çoklu seçim */}
<div style={{marginBottom:12}}>
  <label style={{...s.label, marginBottom:8}}>Üst Yapı <span style={{color:'#4b5563', fontWeight:400}}>(çoklu seçim)</span></label>
  <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
    {UTSYAPI.map(u => {
      const secili = durak.utsyapi.includes(u);
      return (
        <button key={u} type="button"
          onClick={()=>{
            const yeni = secili
              ? durak.utsyapi.filter(x=>x!==u)
              : [...durak.utsyapi, u];
            durakGuncelle(i,'utsyapi',yeni);
          }}
          style={{
            padding:'5px 12px', borderRadius:4, border:'1px solid',
            borderColor: secili ? '#60a5fa' : '#30363d',
            background: secili ? '#1e3a5f' : '#0d1117',
            color: secili ? '#60a5fa' : '#8b949e',
            fontSize:'0.82rem', cursor:'pointer', fontWeight: secili ? 700 : 400
          }}>
          {u}
        </button>
      );
    })}
  </div>
</div>
                </div>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
                <div>
                  <label style={{...s.label, marginBottom:4}}>Araç Adedi</label>
                  <input type="number" min={1} value={durak.arac_adet}
                    onChange={e=>durakGuncelle(i,'arac_adet',parseInt(e.target.value))}
                    style={s.input}/>
                </div>
                <div>
                  <label style={{...s.label, marginBottom:4}}>Ton</label>
                  <input type="number" step="0.1" value={durak.ton}
                    onChange={e=>durakGuncelle(i,'ton',e.target.value)}
                    placeholder="Opsiyonel" style={s.input}/>
                </div>
                <div>
                  <label style={{...s.label, marginBottom:4}}>Palet</label>
                  <input type="number" value={durak.palet}
                    onChange={e=>durakGuncelle(i,'palet',e.target.value)}
                    placeholder="Opsiyonel" style={s.input}/>
                </div>
              </div>

              {tip === 'yuk' && (
                <div style={{marginTop:12}}>
                  <label style={{...s.label, marginBottom:4}}>Yük Cinsi</label>
                  <input value={durak.yuk_cinsi} onChange={e=>durakGuncelle(i,'yuk_cinsi',e.target.value)}
                    placeholder="Seramik, tekstil, elektronik..." style={s.input}/>
                </div>
              )}

              <div style={{marginTop:12}}>
                <label style={{...s.label, marginBottom:4}}>Bu Durak için Not</label>
                <input value={durak.notlar} onChange={e=>durakGuncelle(i,'notlar',e.target.value)}
                  placeholder="Opsiyonel" style={s.input}/>
              </div>
            </div>
          ))}
        </div>

        {/* TARİH + FİYAT + TEL */}
        <div style={s.section}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
            <div>
              <label style={s.label}>📅 Yükleme Tarihi</label>
              <input type="date" value={tarih} onChange={e=>setTarih(e.target.value)} style={s.input}/>
              <label style={{display:'flex', alignItems:'center', gap:6, marginTop:8, cursor:'pointer'}}>
                <input type="checkbox" checked={tarih_esnek} onChange={e=>setTarihEsnek(e.target.checked)}/>
                <span style={{color:'#8b949e', fontSize:'0.82rem'}}>Tarih esnek</span>
              </label>
            </div>
            <div>
              <label style={s.label}>💰 Ücret Teklifi (TL)</label>
              <input type="number" value={fiyat} onChange={e=>setFiyat(e.target.value)}
                placeholder="Opsiyonel" style={s.input}/>
              <label style={{display:'flex', alignItems:'center', gap:6, marginTop:8, cursor:'pointer'}}>
                <input type="checkbox" checked={fiyat_pazarlik} onChange={e=>setFiyatPazarlik(e.target.checked)}/>
                <span style={{color:'#8b949e', fontSize:'0.82rem'}}>Pazarlık payı var</span>
              </label>
            </div>
          </div>

          <div>
            <label style={s.label}>📞 İletişim Telefonu *</label>
            <input value={tel} onChange={e=>setTel(e.target.value)}
              placeholder="05xx xxx xx xx" required style={s.input}/>
            <div style={{color:'#4b5563', fontSize:'0.75rem', marginTop:6}}>
              Telefon numaranız ilanlarda görünecektir.
            </div>
          </div>
        </div>

        {/* GENEL NOT */}
        <div style={s.section}>
          <label style={s.label}>📝 Genel Not</label>
          <textarea value={genel_not} onChange={e=>setGenelNot(e.target.value)}
            placeholder="Ek bilgi, özel şartlar..." rows={3}
            style={{...s.input, resize:'vertical'}}/>
        </div>

{/* GÖNDER */}
<button type="submit" disabled={yukleniyor}
  style={{
    width:'100%', padding:'14px', borderRadius:8, border:'none',
    background: yukleniyor ? '#166534' : '#22c55e',
    color:'#000', fontWeight:800, fontSize:'1rem', cursor:'pointer'
  }}>
  {yukleniyor ? 'Gönderiliyor...' : 'İlanı Yayınla →'}
</button>

{hata && (
  <div style={{color:'#ef4444', marginTop:12, textAlign:'center', fontSize:'0.85rem'}}>
    ⚠️ {hata}
  </div>
)}

      </form>
    </div>
  );
}