'use client';
import { useState } from 'react';

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

const ARAC_TIPLERI = ['Tümü','TIR / Kırkayak','Kamyon','Kamyonet','Panelvan','Lowbed','Damperli','Frigorifik'];

const MOCK_ILANLAR = [
  { id:1, tip:'yuk', kalkis:'İstanbul', kalkis_ilce:'Tuzla', duraklar:[{sehir:'Ankara',ilce:'Yenimahalle',arac_tipi:'Tenteli TIR',ton:17,palet:20}], kaynak:'form', sure:'2 saat önce', tel:'05301234567', yuk:'Elektronik', fiyat:'22.000', odeme:'Peşin' },
  { id:2, tip:'arac', kalkis:'Ankara', kalkis_ilce:'Merkez', duraklar:[{sehir:'İzmir',ilce:'',arac_tipi:'13.60 Tenteli',ton:null,palet:null}], kaynak:'whatsapp', sure:'4 saat önce', tel:'05421234567', yuk:null, fiyat:null, odeme:null },
  { id:3, tip:'yuk', kalkis:'Bursa', kalkis_ilce:'Mustafakemalpaşa', duraklar:[{sehir:'Balıkesir',ilce:'',arac_tipi:'Açık-Tenteli',ton:null,palet:null,arac_adet:4},{sehir:'Bursa',ilce:'',arac_tipi:'Açık-Tenteli',ton:null,palet:null,arac_adet:1}], kaynak:'whatsapp', sure:'5 saat önce', tel:'05331234567', yuk:'Su', fiyat:null, odeme:'Haftalık' },
  { id:4, tip:'yuk', kalkis:'Kocaeli', kalkis_ilce:'Gebze', duraklar:[{sehir:'Mersin',ilce:'Akdeniz',arac_tipi:'Kapalı TIR',ton:5.35,palet:5}], kaynak:'facebook', sure:'6 saat önce', tel:'05551234567', yuk:'Tekstil', fiyat:'18.500', odeme:'Haftalık' },
  { id:5, tip:'arac', kalkis:'İzmir', kalkis_ilce:'Buca', duraklar:[{sehir:'İstanbul',ilce:'Pendik',arac_tipi:'13.60 Tenteli',ton:null,palet:null}], kaynak:'form', sure:'8 saat önce', tel:'05441234567', yuk:null, fiyat:'15.000', odeme:'Peşin' },
  { id:6, tip:'yuk', kalkis:'Gaziantep', kalkis_ilce:'Merkez', duraklar:[{sehir:'İstanbul',ilce:'Küçükçekmece',arac_tipi:'Kapalı TIR',ton:20,palet:26}], kaynak:'form', sure:'10 saat önce', tel:'05321234567', yuk:'Seramik', fiyat:'28.000', odeme:'Peşin' },
];

const KAYNAK_ETIKET: Record<string,{label:string,bg:string,text:string}> = {
  form:      { label:'Yükegel', bg:'bg-emerald-900/60', text:'text-emerald-400' },
  whatsapp:  { label:'📱 WhatsApp', bg:'bg-green-900/60', text:'text-green-400' },
  facebook:  { label:'👥 Facebook', bg:'bg-blue-900/60', text:'text-blue-400' },
};

export default function Home() {
  const [tip, setTip] = useState<'tumu'|'yuk'|'arac'>('tumu');
  const [kalkis, setKalkis] = useState('');
  const [varis, setVaris] = useState('');
  const [aracTipi, setAracTipi] = useState('Tümü');

  const filtered = MOCK_ILANLAR.filter(i => {
    if (tip !== 'tumu' && i.tip !== tip) return false;
    if (kalkis && !i.kalkis.includes(kalkis)) return false;
    if (varis && !i.duraklar.some(d => d.sehir.includes(varis))) return false;
    if (aracTipi !== 'Tümü' && !i.duraklar.some(d => d.arac_tipi.includes(aracTipi.split(' ')[0]))) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{background:'#0d1117',fontFamily:"'IBM Plex Sans', system-ui, sans-serif"}}>
      
      {/* NAVBAR */}
      <nav style={{background:'#161b22',borderBottom:'1px solid #30363d'}} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Yükegel" style={{width:28,height:28}}/>
              <span style={{color:'#22c55e',fontWeight:800,fontSize:'1.25rem',letterSpacing:'-0.03em'}}>
                YÜKE<span style={{color:'#e2e8f0'}}>GEL</span>
              </span>
            </div>
            <span style={{background:'#1e3a5f',color:'#60a5fa',fontSize:'0.65rem',fontWeight:700,padding:'2px 6px',borderRadius:4,letterSpacing:'0.05em'}}>BETA</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{color:'#8b949e',fontSize:'0.85rem'}}>Ücretsiz</span>
            <button style={{background:'#f97316',color:'#000',fontWeight:700,fontSize:'0.85rem',padding:'6px 16px',borderRadius:6,border:'none',cursor:'pointer'}}>
              + İlan Ver
            </button>
          </div>
        </div>
      </nav>

      {/* FİLTRELER */}
      <div style={{background:'#161b22',borderBottom:'1px solid #30363d'}} className="sticky top-14 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-2 items-center">
            
            {/* Tip toggle */}
            <div style={{background:'#0d1117',borderRadius:6,padding:2,border:'1px solid #30363d'}} className="flex">
              {(['tumu','yuk','arac'] as const).map(t => (
                <button key={t} onClick={()=>setTip(t)}
                  style={{
                    padding:'5px 12px',borderRadius:4,border:'none',cursor:'pointer',
                    fontSize:'0.8rem',fontWeight:600,transition:'all 0.15s',
                    background: tip===t ? '#f97316' : 'transparent',
                    color: tip===t ? '#000' : '#8b949e'
                  }}>
                  {t==='tumu'?'Tümü':t==='yuk'?'🔴 Yük':'🟢 Araç'}
                </button>
              ))}
            </div>

            {/* Kalkış */}
            <select value={kalkis} onChange={e=>setKalkis(e.target.value)}
              style={{background:'#0d1117',color:'#e2e8f0',border:'1px solid #30363d',borderRadius:6,padding:'5px 10px',fontSize:'0.82rem',cursor:'pointer'}}>
              <option value=''>📍 Kalkış İli</option>
              {ILLER.map(il=><option key={il}>{il}</option>)}
            </select>

            {/* Varış */}
            <select value={varis} onChange={e=>setVaris(e.target.value)}
              style={{background:'#0d1117',color:'#e2e8f0',border:'1px solid #30363d',borderRadius:6,padding:'5px 10px',fontSize:'0.82rem',cursor:'pointer'}}>
              <option value=''>🏁 Varış İli</option>
              {ILLER.map(il=><option key={il}>{il}</option>)}
            </select>

            {/* Araç tipi */}
            <select value={aracTipi} onChange={e=>setAracTipi(e.target.value)}
              style={{background:'#0d1117',color:'#e2e8f0',border:'1px solid #30363d',borderRadius:6,padding:'5px 10px',fontSize:'0.82rem',cursor:'pointer'}}>
              {ARAC_TIPLERI.map(t=><option key={t}>{t}</option>)}
            </select>

            {(kalkis||varis||aracTipi!=='Tümü'||tip!=='tumu') && (
              <button onClick={()=>{setTip('tumu');setKalkis('');setVaris('');setAracTipi('Tümü')}}
                style={{color:'#f97316',background:'none',border:'none',cursor:'pointer',fontSize:'0.82rem',fontWeight:600}}>
                ✕ Temizle
              </button>
            )}

            <span style={{color:'#8b949e',fontSize:'0.78rem',marginLeft:'auto'}}>
              {filtered.length} ilan
            </span>
          </div>
        </div>
      </div>

      {/* İLAN LİSTESİ */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid gap-3">
          {filtered.map(ilan => {
            const kaynak = KAYNAK_ETIKET[ilan.kaynak];
            const isYuk = ilan.tip === 'yuk';
            return (
              <div key={ilan.id}
                style={{background:'#161b22',border:'1px solid #30363d',borderRadius:8,padding:'14px 16px',cursor:'pointer',transition:'border-color 0.15s'}}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='#f97316')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='#30363d')}
              >
                <div className="flex items-start justify-between gap-4">
                  
                  {/* Sol: Rota bilgisi */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span style={{
                        background: isYuk ? '#7f1d1d' : '#14532d',
                        color: isYuk ? '#fca5a5' : '#86efac',
                        fontSize:'0.7rem',fontWeight:700,padding:'2px 8px',borderRadius:4
                      }}>
                        {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
                      </span>
                      <span style={{background:kaynak.bg,color:kaynak.text,fontSize:'0.7rem',fontWeight:600,padding:'2px 8px',borderRadius:4}}>
                        {kaynak.label}
                      </span>
                      {ilan.yuk && (
                        <span style={{color:'#8b949e',fontSize:'0.78rem'}}>• {ilan.yuk}</span>
                      )}
                    </div>

                    {/* Rota */}
                    <div className="flex items-start gap-2">
                      <div style={{flex:1}}>
                        {/* Kalkış */}
                        <div className="flex items-center gap-1 mb-1">
                          <span style={{color:'#f97316',fontSize:'0.7rem',fontWeight:700,minWidth:16}}>K</span>
                          <span style={{color:'#e2e8f0',fontWeight:700,fontSize:'0.95rem'}}>
                            {ilan.kalkis}
                          </span>
                          {ilan.kalkis_ilce && (
                            <span style={{color:'#8b949e',fontSize:'0.82rem'}}>/ {ilan.kalkis_ilce}</span>
                          )}
                        </div>
                        
                        {/* Varış noktaları */}
                        {ilan.duraklar.map((d,i) => (
                          <div key={i} className="flex items-center gap-1 mb-1">
                            <span style={{color:'#22c55e',fontSize:'0.7rem',fontWeight:700,minWidth:16}}>V</span>
                            <span style={{color:'#e2e8f0',fontWeight:700,fontSize:'0.95rem'}}>{d.sehir}</span>
                            {d.ilce && <span style={{color:'#8b949e',fontSize:'0.82rem'}}>/ {d.ilce}</span>}
                            {(d as any).arac_adet && <span style={{color:'#60a5fa',fontSize:'0.78rem',marginLeft:4}}>{(d as any).arac_adet} araç</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detaylar */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {ilan.duraklar[0].arac_tipi && (
                        <span style={{color:'#94a3b8',fontSize:'0.8rem'}}>
                          🚛 {ilan.duraklar[0].arac_tipi}
                        </span>
                      )}
                      {ilan.duraklar[0].ton && (
                        <span style={{color:'#94a3b8',fontSize:'0.8rem'}}>
                          ⚖ {ilan.duraklar[0].ton} ton
                        </span>
                      )}
                      {ilan.duraklar[0].palet && (
                        <span style={{color:'#94a3b8',fontSize:'0.8rem'}}>
                          📦 {ilan.duraklar[0].palet} palet
                        </span>
                      )}
                      {ilan.odeme && (
                        <span style={{color:'#94a3b8',fontSize:'0.8rem'}}>
                          💳 {ilan.odeme}
                        </span>
                      )}
                      <span style={{color:'#4b5563',fontSize:'0.75rem',marginLeft:'auto'}}>
                        {ilan.sure}
                      </span>
                    </div>
                  </div>

                  {/* Sağ: Fiyat + Telefon */}
                  <div style={{textAlign:'right',flexShrink:0}}>
                    {ilan.fiyat && (
                      <div style={{color:'#f97316',fontWeight:800,fontSize:'1.05rem',marginBottom:8}}>
                        ₺{ilan.fiyat}
                      </div>
                    )}
                    <a href={`tel:${ilan.tel}`}
                      style={{display:'block',background:'#1a3a1a',color:'#4ade80',border:'1px solid #166534',borderRadius:6,padding:'6px 12px',fontSize:'0.8rem',fontWeight:700,textDecoration:'none',textAlign:'center'}}>
                      📞 Ara
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{textAlign:'center',padding:'80px 0',color:'#4b5563'}}>
            <div style={{fontSize:'2rem',marginBottom:8}}>🔍</div>
            <div style={{fontWeight:600}}>Filtrelerle eşleşen ilan bulunamadı</div>
            <div style={{fontSize:'0.85rem',marginTop:4}}>Filtreleri değiştirmeyi deneyin</div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{borderTop:'1px solid #30363d',marginTop:40,padding:'20px 0',textAlign:'center',color:'#4b5563',fontSize:'0.78rem'}}>
        © 2026 Yükegel · Türkiye'nin nakliye ilan platformu
      </footer>
    </div>
  );
}