'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../../lib/supabase';
import { useParams } from 'next/navigation';

const supabase = createClient();

const ILLER = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'];
const ARAC_TIPLERI = ['Minivan', 'Panelvan', 'Kamyonet', 'Kamyon', 'Kırkayak', 'TIR'];
const UST_YAPI = ['Açık Kasa', 'Kapalı Kasa', 'Tenteli', 'Damperli', 'Frigolu', 'Liftli', 'Sal Kasa', 'Lowbed'];

function Chip({ label, bg = '#1f2937', color = '#94a3b8' }: { label: string; bg?: string; color?: string }) {
  return <span style={{ background: bg, color, fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{label}</span>;
}

export default function PublicIlanListesi() {
  const params = useParams();
  const userId = params.username as string;

  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [sahip, setSahip] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bulunamadi, setBulunamadi] = useState(false);

  // Filtreler
  const [kalkis, setKalkis] = useState('');
  const [varis, setVaris] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [ustYapi, setUstYapi] = useState('');
  const [arama, setArama] = useState('');

  useEffect(() => {
    async function getIlanlar() {
      // Kullanıcıyı bul
      const { data: kullanici } = await supabase
        .from('users')
        .select('id, display_name, user_type')
        .eq('id', userId)
        .single();

      if (!kullanici) { setBulunamadi(true); setYukleniyor(false); return; }
      setSahip(kullanici);

      // 24 saatten yeni ve tamamlanmamış aktif ilanları getir
      const yirmidortSaatOnce = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('listings')
        .select(`
          id, listing_type, origin_city, origin_district,
          contact_phone, price_offer, source, created_at,
          vehicle_type, body_type, notes, carrier_note,
          available_date, date_flexible, completed_at,
          listing_stops (
            stop_order, city, district,
            vehicle_count, cargo_type, weight_ton, pallet_count
          )
        `)
        .eq('user_id', userId)
        .in('moderation_status', ['approved', 'auto_published'])
        .eq('status', 'active')
        .is('completed_at', null)  // tamamlanmayanlar
        .gte('created_at', yirmidortSaatOnce)  // son 24 saat
        .order('created_at', { ascending: false });

      const donusturulmus = (data || []).map(ilan => ({
        id: ilan.id,
        tip: ilan.listing_type,
        kalkis: ilan.origin_city,
        kalkis_ilce: ilan.origin_district || '',
        duraklar: (ilan.listing_stops || [])
          .sort((a: any, b: any) => a.stop_order - b.stop_order)
          .map((s: any) => ({ sehir: s.city, ilce: s.district || '', ton: s.weight_ton, palet: s.pallet_count, arac_adet: s.vehicle_count })),
        sure: new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        tel: ilan.contact_phone,
        fiyat: ilan.price_offer,
        aracTipleri: ilan.vehicle_type || [],
        ustyapilari: ilan.body_type || [],
        notes: ilan.notes || '',
        carrierNote: ilan.carrier_note || '',
        tarih: ilan.available_date,
        tarihEsnek: ilan.date_flexible,
      }));

      setIlanlar(donusturulmus);
      setYukleniyor(false);
    }

    if (userId) getIlanlar();
  }, [userId]);

  const filtered = ilanlar.filter(i => {
    if (kalkis && i.kalkis !== kalkis) return false;
    if (varis && !i.duraklar.some((d: any) => d.sehir === varis)) return false;
    if (aracTipi && !i.aracTipleri.includes(aracTipi)) return false;
    if (ustYapi && !i.ustyapilari.includes(ustYapi)) return false;
    if (arama) {
      const norm = arama.toLowerCase();
      const hay = `${i.kalkis} ${i.duraklar.map((d: any) => d.sehir).join(' ')} ${i.notes} ${i.aracTipleri.join(' ')}`.toLowerCase();
      if (!hay.includes(norm)) return false;
    }
    return true;
  });

  const inp = { background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' };

  if (bulunamadi) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ textAlign: 'center', color: '#4b5563' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
        <div>Kullanıcı bulunamadı.</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
          </a>
          {sahip && (
            <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{sahip.display_name}</span> ilanları
            </div>
          )}
        </div>
      </nav>

      {/* FİLTRELER */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 52, zIndex: 40 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Arama */}
          <input value={arama} onChange={e => setArama(e.target.value)} placeholder="🔍 Kelime ara..."
            style={{ ...inp, flex: 1, minWidth: 140 }} />
          {/* Kalkış */}
          <select value={kalkis} onChange={e => setKalkis(e.target.value)} style={inp}>
            <option value=''>📍 Kalkış</option>
            {ILLER.map(il => <option key={il}>{il}</option>)}
          </select>
          {/* Varış */}
          <select value={varis} onChange={e => setVaris(e.target.value)} style={inp}>
            <option value=''>🏁 Varış</option>
            {ILLER.map(il => <option key={il}>{il}</option>)}
          </select>
          {/* Araç Tipi */}
          <select value={aracTipi} onChange={e => setAracTipi(e.target.value)} style={inp}>
            <option value=''>🚛 Araç</option>
            {ARAC_TIPLERI.map(t => <option key={t}>{t}</option>)}
          </select>
          {/* Üst Yapı */}
          <select value={ustYapi} onChange={e => setUstYapi(e.target.value)} style={inp}>
            <option value=''>🏗 Üst Yapı</option>
            {UST_YAPI.map(u => <option key={u}>{u}</option>)}
          </select>
          {(kalkis || varis || aracTipi || ustYapi || arama) && (
            <button onClick={() => { setKalkis(''); setVaris(''); setAracTipi(''); setUstYapi(''); setArama(''); }}
              style={{ background: 'none', border: 'none', color: '#22c55e', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              ✕ Temizle
            </button>
          )}
          <span style={{ color: '#4b5563', fontSize: '0.75rem', marginLeft: 'auto' }}>{filtered.length} ilan</span>
        </div>
      </div>

      {/* LISTE */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '16px' }}>
        {yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>⏳ Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Aktif ilan bulunamadı</div>
            <div style={{ fontSize: '0.82rem' }}>Filtre değiştirmeyi deneyin veya daha sonra tekrar bakın.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(ilan => {
              const isYuk = ilan.tip === 'yuk';
              return (
                <div key={ilan.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      {/* Tip etiketi */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                          {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
                        </span>
                        {ilan.tarih && (
                          <span style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4 }}>
                            📅 {new Date(ilan.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}{ilan.tarihEsnek ? ' ±' : ''}
                          </span>
                        )}
                      </div>

                      {/* Rota */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>K</span>
                        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{ilan.kalkis}</span>
                        {ilan.kalkis_ilce && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {ilan.kalkis_ilce}</span>}
                      </div>
                      {ilan.duraklar.map((d: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 16 }}>V</span>
                          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{d.sehir}</span>
                          {d.ilce && <span style={{ color: '#8b949e', fontSize: '0.82rem' }}>/ {d.ilce}</span>}
                          {d.ton && <span style={{ color: '#86efac', fontSize: '0.75rem', marginLeft: 4 }}>⚖ {d.ton}t</span>}
                          {d.palet && <span style={{ color: '#86efac', fontSize: '0.75rem', marginLeft: 4 }}>📦 {d.palet}p</span>}
                        </div>
                      ))}

                      {/* Araç + üst yapı */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {ilan.aracTipleri.map((t: string) => <Chip key={t} label={'🚛 ' + t} bg='#1a2535' color='#60a5fa' />)}
                        {ilan.ustyapilari.map((u: string) => <Chip key={u} label={u} bg='#1f2937' color='#94a3b8' />)}
                        {ilan.fiyat && <Chip label={'₺' + Number(ilan.fiyat).toLocaleString('tr-TR')} bg='#1a2a0d' color='#22c55e' />}
                      </div>

                      {/* Not */}
                      {ilan.notes && (
                        <div style={{ color: '#8b949e', fontSize: '0.78rem', marginTop: 8 }}>📝 {ilan.notes}</div>
                      )}

                      <div style={{ color: '#4b5563', fontSize: '0.7rem', marginTop: 8 }}>{ilan.sure}</div>
                    </div>

                    {/* Ara butonu */}
                    <a href={`tel:${ilan.tel}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#14532d', color: '#22c55e', border: '1px solid #166534', borderRadius: 7, padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      📞 Ara
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #30363d', marginTop: 40, padding: '16px', textAlign: 'center', color: '#4b5563', fontSize: '0.75rem' }}>
        <a href="/" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 600 }}>Yükegel</a> · Türkiye'nin nakliye ilan platformu
      </footer>
    </div>
  );
}
