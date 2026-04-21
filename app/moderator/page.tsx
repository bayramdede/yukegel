'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import WhatsappYukle from './WhatsappYukle';


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

const DURUM_RENK: Record<string, { bg: string; color: string }> = {
  pending:        { bg: '#451a03', color: '#fb923c' },
  approved:       { bg: '#14532d', color: '#22c55e' },
  auto_published: { bg: '#1e3a5f', color: '#60a5fa' },
  rejected:       { bg: '#450a0a', color: '#f87171' },
  passive:        { bg: '#1f2937', color: '#9ca3af' },
};

const inp = {
  background:'#0d1117', color:'#e2e8f0', border:'1px solid #374151',
  borderRadius:4, padding:'4px 8px', fontSize:'0.85rem', width:'100%',
  outline:'none'
} as React.CSSProperties;

export default function Moderator() {
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [filtre, setFiltre] = useState<'pending'|'approved'|'rejected'|'passive'|'hepsi'>('pending');
  const [islem, setIslem] = useState<string>('');
  const [duzenleId, setDuzenleId] = useState<string>('');
  const [duzenleData, setDuzenleData] = useState<any>({});
  const [sonraBak, setSonraBak] = useState<Set<string>>(new Set());
  const [sonraBakGoster, setSonraBakGoster] = useState(false);
  const ilanRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();

  useEffect(() => { getIlanlar(); }, [filtre]);

  async function getIlanlar() {
    setYukleniyor(true);
    let query = supabase
      .from('listings')
      .select(`
        id, listing_type, origin_city, origin_district,
        contact_phone, price_offer, source, created_at,
        moderation_status, status, notes, trust_level,
        raw_text, raw_post_id,
        listing_stops (
          id, stop_order, city, district,
          vehicle_count, cargo_type, weight_ton, pallet_count
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filtre !== 'hepsi') query = query.eq('moderation_status', filtre);
    const { data } = await query;
    setIlanlar(data || []);
    setYukleniyor(false);
  }

function siradakineGec(mevcutId: string) {
  const gorunenler = ilanlar.filter(i => sonraBakGoster ? true : !sonraBak.has(i.id));
  const idx = gorunenler.findIndex(i => i.id === mevcutId);
  const sonraki = gorunenler[idx + 1];
  if (sonraki) {
    // Önce scroll, sonra düzenleme modunu aç
    setTimeout(() => {
      ilanRefs.current[sonraki.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      duzenleAc(sonraki);
    }, 350);
  }
}

  async function aksiyon(id: string, yeniModerasyon: string, yeniStatus: string) {
    setIslem(id);
    await supabase.from('listings').update({
      moderation_status: yeniModerasyon,
      status: yeniStatus,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    setIslem('');
    siradakineGec(id);
    // Kısa gecikme sonra listeyi yenile
    setTimeout(() => getIlanlar(), 300);
  }

  function sonraBakEkleVeGec(id: string) {
    const yeni = new Set(sonraBak);
    yeni.add(id);
    setSonraBak(yeni);
    siradakineGec(id);
  }

  function duzenleAc(ilan: any) {
    setDuzenleId(ilan.id);
    setDuzenleData({
      listing_type: ilan.listing_type,
      origin_city: ilan.origin_city,
      origin_district: ilan.origin_district || '',
      contact_phone: ilan.contact_phone,
      price_offer: ilan.price_offer || '',
      notes: ilan.notes || '',
      stops: (ilan.listing_stops || [])
        .sort((a: any, b: any) => a.stop_order - b.stop_order)
        .map((s: any) => ({
          id: s.id, city: s.city, district: s.district || '',
          weight_ton: s.weight_ton || '', pallet_count: s.pallet_count || '',
          vehicle_count: s.vehicle_count || 1, cargo_type: s.cargo_type || '',
        }))
    });
  }

  async function duzenleKaydet(id: string, mod: 'onayla' | 'sadece_kaydet') {
    setIslem(id);

    const updateData: any = {
      listing_type: duzenleData.listing_type,
      origin_city: duzenleData.origin_city,
      origin_district: duzenleData.origin_district,
      contact_phone: duzenleData.contact_phone,
      price_offer: duzenleData.price_offer || null,
      notes: duzenleData.notes,
    };

    if (mod === 'onayla') {
      updateData.moderation_status = 'approved';
      updateData.status = 'active';
      updateData.reviewed_at = new Date().toISOString();
    }

    await supabase.from('listings').update(updateData).eq('id', id);

    for (const stop of duzenleData.stops) {
      await supabase.from('listing_stops').update({
        city: stop.city, district: stop.district,
        weight_ton: stop.weight_ton || null,
        pallet_count: stop.pallet_count || null,
        vehicle_count: stop.vehicle_count,
        cargo_type: stop.cargo_type,
      }).eq('id', stop.id);
    }

    setDuzenleId('');
    setIslem('');

    if (mod === 'sadece_kaydet') {
      // Oturumda gizle ve sıradakine geç
      const yeni = new Set(sonraBak);
      yeni.add(id);
      setSonraBak(yeni);
      siradakineGec(id);
    } else {
      siradakineGec(id);
    }

    setTimeout(() => getIlanlar(), 300);
  }

  function stopGuncelle(idx: number, alan: string, deger: any) {
    const yeni = [...duzenleData.stops];
    yeni[idx] = { ...yeni[idx], [alan]: deger };
    setDuzenleData({ ...duzenleData, stops: yeni });
  }

  async function cikisYap() {
    await supabase.auth.signOut();
    router.push('/giris');
  }

  const gosterilenIlanlar = ilanlar.filter(i =>
    sonraBakGoster ? true : !sonraBak.has(i.id)
  );
  const sonraBakSayisi = ilanlar.filter(i => sonraBak.has(i.id)).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
            <span style={{ fontWeight: 800, fontSize: '1rem' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
            <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>/ Moderatör</span>
          </div>
          <button onClick={cikisYap}
            style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>
            Çıkış
          </button>
        </div>
      </nav>
      {/* WHATSAPP ZIP YÜKLE */}
      <WhatsappYukle />

      {/* FİLTRELER */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 52, zIndex: 40 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['pending','approved','rejected','passive','hepsi'] as const).map(f => (
            <button key={f} onClick={() => { setFiltre(f); setSonraBak(new Set()); }}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid',
                borderColor: filtre === f ? '#22c55e' : '#30363d',
                background: filtre === f ? '#14532d' : '#0d1117',
                color: filtre === f ? '#22c55e' : '#8b949e',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
              }}>
              {f === 'pending' ? '⏳ Bekleyenler' : f === 'approved' ? '✅ Onaylananlar' :
               f === 'rejected' ? '❌ Reddedilenler' : f === 'passive' ? '💤 Pasifler' : '📋 Hepsi'}
            </button>
          ))}

          {sonraBakSayisi > 0 && (
            <button onClick={() => setSonraBakGoster(!sonraBakGoster)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid #451a03',
                background: sonraBakGoster ? '#451a03' : '#0d1117',
                color: '#fb923c', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
              }}>
              ⏸ Sonraya Bırakılanlar ({sonraBakSayisi})
            </button>
          )}

          <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {yukleniyor ? 'Yükleniyor...' : `${gosterilenIlanlar.length} ilan`}
          </span>
        </div>
      </div>

      {/* İLAN LİSTESİ */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px' }}>
        {yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>⏳ Yükleniyor...</div>
        ) : gosterilenIlanlar.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <div>Bu filtrede ilan yok</div>
            {sonraBakSayisi > 0 && (
              <button onClick={() => setSonraBakGoster(true)}
                style={{ marginTop: 16, background: 'none', border: '1px solid #451a03', color: '#fb923c', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem' }}>
                ⏸ Sonraya bırakılanları göster ({sonraBakSayisi})
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {gosterilenIlanlar.map(ilan => {
              const durum = DURUM_RENK[ilan.moderation_status] || DURUM_RENK.passive;
              const isYuk = ilan.listing_type === 'yuk';
              const durumIslem = islem === ilan.id;
              const duzenleniyor = duzenleId === ilan.id;
              const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
              const hasSosyal = (ilan.source === 'whatsapp' || ilan.source === 'facebook') && ilan.raw_text;

              return (
                <div key={ilan.id}
                  ref={el => { ilanRefs.current[ilan.id] = el; }}
                  style={{ background: '#161b22', border: `1px solid ${duzenleniyor ? '#22c55e' : '#30363d'}`, borderRadius: 8, padding: '14px 16px', scrollMarginTop: 110 }}>

                  {/* Üst: Etiketler */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
                    </span>
                    <span style={{ background: durum.bg, color: durum.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      {ilan.moderation_status}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>
                      {ilan.source} · {new Date(ilan.created_at).toLocaleDateString('tr-TR')} {new Date(ilan.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: '0.68rem', marginLeft: 'auto', fontFamily: 'monospace' }}>
                      #{ilan.id.substring(0, 8)}
                    </span>
                  </div>

                  {/* Orta: İki sütun */}
                  <div style={{ display: 'grid', gridTemplateColumns: hasSosyal ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 12 }}>

                    {/* Sol: Ham mesaj */}
                    {hasSosyal && (
                      <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937' }}>
                        <div style={{ color: '#8b949e', fontSize: '0.68rem', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>
                          {ilan.source === 'whatsapp' ? '📱 WHATSAPP HAM MESAJ' : '👥 FACEBOOK HAM MESAJ'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                          {ilan.raw_text}
                        </div>
                      </div>
                    )}

                    {/* Sağ: Parse edilmiş / Düzenleme */}
                    <div>
                      {duzenleniyor ? (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                            <div>
                              <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>İlan Tipi</div>
                              <select value={duzenleData.listing_type} onChange={e => setDuzenleData({ ...duzenleData, listing_type: e.target.value })} style={inp}>
                                <option value="yuk">Yük</option>
                                <option value="arac">Araç</option>
                              </select>
                            </div>
                            <div>
                              <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Telefon</div>
                              <input value={duzenleData.contact_phone} onChange={e => setDuzenleData({ ...duzenleData, contact_phone: e.target.value })} style={inp} />
                            </div>
                            <div>
                              <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İli</div>
                              <select value={duzenleData.origin_city} onChange={e => setDuzenleData({ ...duzenleData, origin_city: e.target.value })} style={inp}>
                                {ILLER.map(il => <option key={il}>{il}</option>)}
                              </select>
                            </div>
                            <div>
                              <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İlçesi</div>
                              <input value={duzenleData.origin_district} onChange={e => setDuzenleData({ ...duzenleData, origin_district: e.target.value })} style={inp} placeholder="İlçe" />
                            </div>
                            <div>
                              <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Fiyat (TL)</div>
                              <input type="number" value={duzenleData.price_offer} onChange={e => setDuzenleData({ ...duzenleData, price_offer: e.target.value })} style={inp} placeholder="Opsiyonel" />
                            </div>
                          </div>

                          {duzenleData.stops?.map((stop: any, idx: number) => (
                            <div key={idx} style={{ background: '#0a0f1a', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 700, marginBottom: 6 }}>Varış {idx + 1}</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                                <div>
                                  <div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İl</div>
                                  <select value={stop.city} onChange={e => stopGuncelle(idx, 'city', e.target.value)} style={inp}>
                                    {ILLER.map(il => <option key={il}>{il}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İlçe</div>
                                  <input value={stop.district} onChange={e => stopGuncelle(idx, 'district', e.target.value)} style={inp} placeholder="-" />
                                </div>
                                <div>
                                  <div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Ton</div>
                                  <input type="number" value={stop.weight_ton} onChange={e => stopGuncelle(idx, 'weight_ton', e.target.value)} style={inp} placeholder="-" />
                                </div>
                                <div>
                                  <div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Palet</div>
                                  <input type="number" value={stop.pallet_count} onChange={e => stopGuncelle(idx, 'pallet_count', e.target.value)} style={inp} placeholder="-" />
                                </div>
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Yük Cinsi</div>
                                <input value={stop.cargo_type} onChange={e => stopGuncelle(idx, 'cargo_type', e.target.value)} style={inp} placeholder="Seramik, tekstil..." />
                              </div>
                            </div>
                          ))}

                          <div>
                            <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Not</div>
                            <textarea value={duzenleData.notes} onChange={e => setDuzenleData({ ...duzenleData, notes: e.target.value })}
                              rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Genel not" />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                              <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, minWidth: 14 }}>K</span>
                              <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{ilan.origin_city}</span>
                              {ilan.origin_district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {ilan.origin_district}</span>}
                            </div>
                            {stops.map((s: any, i: number) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 700, minWidth: 14 }}>V</span>
                                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>{s.city}</span>
                                {s.district && <span style={{ color: '#8b949e', fontSize: '0.85rem' }}>/ {s.district}</span>}
                                {s.weight_ton && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: 4 }}>⚖ {s.weight_ton}t</span>}
                                {s.pallet_count && <span style={{ color: '#94a3b8', fontSize: '0.78rem', marginLeft: 4 }}>📦 {s.pallet_count}p</span>}
                                {s.vehicle_count > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem', marginLeft: 4 }}>{s.vehicle_count} araç</span>}
                                {s.cargo_type && <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 4 }}>· {s.cargo_type}</span>}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600 }}>📞 {ilan.contact_phone}</span>
                            {ilan.price_offer && <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>₺{ilan.price_offer}</span>}
                            {ilan.notes && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>📝 {ilan.notes.substring(0, 100)}{ilan.notes.length > 100 ? '...' : ''}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alt: Butonlar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1f2937', paddingTop: 12 }}>
                    {duzenleniyor ? (
                      <>
                        <button onClick={() => duzenleKaydet(ilan.id, 'onayla')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                          ✅ Kaydet ve Onayla
                        </button>
                        <button onClick={() => duzenleKaydet(ilan.id, 'sadece_kaydet')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                          💾 Sadece Kaydet
                        </button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>
                          ⏸ Sonra
                        </button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>
                          ❌ Reddet
                        </button>
                        <button onClick={() => setDuzenleId('')}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>
                          ✕ İptal
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => aksiyon(ilan.id, 'approved', 'active')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>
                          ✅ Onayla
                        </button>
                        <button onClick={() => duzenleAc(ilan)}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem' }}>
                          ✏️ Düzenle
                        </button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>
                          ⏸ Sonra
                        </button>
                        <button onClick={() => aksiyon(ilan.id, 'passive', 'passive')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>
                          💤 Pasif
                        </button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem}
                          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>
                          ❌ Reddet
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}