'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase';

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

const KAYNAK_ETIKET: Record<string, { label: string; bg: string; color: string }> = {
  form:     { label: 'Yükegel',      bg: '#0d2b1a', color: '#22c55e' },
  whatsapp: { label: '📱 WhatsApp',  bg: '#0d2b0d', color: '#4ade80' },
  facebook: { label: '👥 Facebook',  bg: '#1e3a5f', color: '#60a5fa' },
};

function yeniUye(createdAt: string | null): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

function Chip({ label, bg = '#1f2937', color = '#94a3b8' }: { label: string; bg?: string; color?: string }) {
  return (
    <span style={{ background: bg, color, fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
      {label}
    </span>
  );
}

export default function Home() {
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [tip, setTip] = useState<'tumu' | 'yuk' | 'arac'>('tumu');
  const [kalkis, setKalkis] = useState('');
  const [varis, setVaris] = useState('');
  const [kullanici, setKullanici] = useState<any>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profil } = await supabase
          .from('users')
          .select('display_name, username, email')
          .eq('id', user.id)
          .single();
        setKullanici(profil || { email: user.email });
      }

      setYukleniyor(true);
      const { data } = await supabase
        .from('listings')
        .select(`
          id, listing_type, origin_city, origin_district,
          contact_phone, price_offer, source, created_at,
          trust_level, user_id,
          vehicle_type, body_type,
          available_date, date_flexible,
          listing_stops (
            stop_order, city, district,
            vehicle_count, cargo_type, weight_ton, pallet_count
          )
        `)
        .in('moderation_status', ['approved', 'auto_published'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data || data.length === 0) {
        setIlanlar([]);
        setYukleniyor(false);
        return;
      }

      const userIds = [...new Set((data as any[]).map((i: any) => i.user_id).filter(Boolean))];
      const kullaniciMap: Record<string, { phone_verified: boolean; created_at: string }> = {};

      if (userIds.length > 0) {
        const { data: kullanicilar } = await supabase
          .from('users')
          .select('id, phone_verified, created_at')
          .in('id', userIds);
        for (const k of (kullanicilar || []) as any[]) {
          kullaniciMap[k.id] = { phone_verified: k.phone_verified, created_at: k.created_at };
        }
      }

      const donusturulmus = (data as any[]).map((ilan: any) => {
        const kullaniciBilgi = ilan.user_id ? kullaniciMap[ilan.user_id] : null;
        const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
        const aracTipiList: string[] = ilan.vehicle_type?.length
          ? ilan.vehicle_type
          : [...new Set(stops.map((s: any) => s.cargo_type).filter(Boolean))] as string[];

        return {
          id: ilan.id,
          tip: ilan.listing_type,
          kalkis: ilan.origin_city,
          kalkis_ilce: ilan.origin_district || '',
          duraklar: stops.map((s: any) => ({
            sehir: s.city, ilce: s.district || '',
            ton: s.weight_ton, palet: s.pallet_count, arac_adet: s.vehicle_count,
          })),
          kaynak: ilan.source || 'form',
          sure: new Date(ilan.created_at).toLocaleDateString('tr-TR'),
          tel: ilan.contact_phone,
          fiyat: ilan.price_offer ? ilan.price_offer.toString() : null,
          tarih: ilan.available_date,
          tarihEsnek: ilan.date_flexible,
          aracTipleri: aracTipiList,
          ustyapilari: (ilan.body_type || []) as string[],
          dogrulanmamis: !ilan.user_id || ilan.trust_level === 'social',
          telefonDogrulandi: kullaniciBilgi?.phone_verified === true,
          yeniUye: kullaniciBilgi ? yeniUye(kullaniciBilgi.created_at) : false,
        };
      });

      setIlanlar(donusturulmus);
      setYukleniyor(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profil } = await supabase
          .from('users')
          .select('display_name, username, email')
          .eq('id', session.user.id)
          .single();
        setKullanici(profil || { email: session.user.email || session.user.user_metadata?.email || 'Kullanıcı' });
      } else {
        setKullanici(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const filtered = ilanlar.filter((i: any) => {
    if (tip !== 'tumu' && i.tip !== tip) return false;
    if (kalkis && !i.kalkis.includes(kalkis)) return false;
    if (varis && !i.duraklar.some((d: any) => d.sehir.includes(varis))) return false;
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
              <span style={{ color: '#22c55e' }}>YÜKE</span>
              <span style={{ color: '#e2e8f0' }}>GEL</span>
            </span>
            <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>BETA</span>
          </div>
          {kullanici ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/panel" style={{ color: '#e2e8f0', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                👤 {kullanici.display_name || kullanici.username || kullanici.email?.split('@')[0]}
              </a>
              <a href="/ilan-ver" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>
                + İlan Ver
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/giris" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>Giriş Yap</a>
              <a href="/giris" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>
                + İlan Ver
              </a>
            </div>
          )}
        </div>
      </nav>

      {!kullanici && (
        <div style={{ borderBottom: '1px solid #1a3a2a' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.4rem', marginBottom: 6, letterSpacing: '-0.02em' }}>
                Teker boşa dönmesin.
              </div>
              <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                Yükler nakliyecilerle Yükegel'de buluşuyor.
              </div>
            </div>
            <a href="/giris" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.9rem', padding: '10px 24px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              + İlan Ver
            </a>
          </div>
        </div>
      )}

      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 56, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#0d1117', borderRadius: 6, padding: 2, border: '1px solid #30363d', display: 'flex' }}>
            {(['tumu', 'yuk', 'arac'] as const).map(t => (
              <button key={t} onClick={() => setTip(t)}
                style={{ padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: tip === t ? '#22c55e' : 'transparent', color: tip === t ? '#000' : '#8b949e' }}>
                {t === 'tumu' ? 'Tümü' : t === 'yuk' ? '🔴 Yük' : '🟢 Araç'}
              </button>
            ))}
          </div>
          <select value={kalkis} onChange={e => setKalkis(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>📍 Kalkış İli</option>
            {ILLER.map(il => <option key={il}>{il}</option>)}
          </select>
          <select value={varis} onChange={e => setVaris(e.target.value)}
            style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: 6, padding: '5px 10px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <option value=''>🏁 Varış İli</option>
            {ILLER.map(il => <option key={il}>{il}</option>)}
          </select>
          {(kalkis || varis || tip !== 'tumu') && (
            <button onClick={() => { setTip('tumu'); setKalkis(''); setVaris(''); }}
              style={{ color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              ✕ Temizle
            </button>
          )}
          <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {yukleniyor ? 'Yükleniyor...' : `${filtered.length} ilan`}
          </span>
        </div>
      </div>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '16px' }}>
        {yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
            <div>İlanlar yükleniyor...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {!kullanici && filtered.length > 0 ? (
              <>
                <IlanKart ilan={filtered[0]} kullanici={kullanici} />
                <div style={{ background: '#161b22', border: '1px solid #1e3a5f', borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>
                    🔐 <strong style={{ color: '#e2e8f0' }}>Telefon numaralarını görmek</strong> için üye olun. Ücretsiz.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a href="/giris" style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>Giriş Yap</a>
                    <a href="/giris" style={{ background: '#22c55e', color: '#000', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>Üye Ol →</a>
                  </div>
                </div>
                {filtered.slice(1).map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)}
              </>
            ) : (
              filtered.map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)
            )}

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>Filtrelerle eşleşen ilan bulunamadı</div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>Filtreleri değiştirmeyi deneyin</div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #30363d', marginTop: 40, padding: '20px 0', textAlign: 'center', color: '#4b5563', fontSize: '0.78rem' }}>
        © 2026 Yükegel · Türkiye'nin nakliye ilan platformu
      </footer>
    </div>
  );
}

function IlanKart({ ilan, kullanici }: { ilan: any; kullanici: any }) {
  const kaynak = KAYNAK_ETIKET[ilan.kaynak] || KAYNAK_ETIKET.form;
  const isYuk = ilan.tip === 'yuk';
  return (
    <a href={`/ilan/${ilan.id}`}
      style={{ display: 'block', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px', cursor: 'pointer', textDecoration: 'none' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#22c55e')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#30363d')}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
              {isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}
            </span>
            <span style={{ background: kaynak.bg, color: kaynak.color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
              {kaynak.label}
            </span>
            {ilan.dogrulanmamis && (
              <span title="Bu ilan Yükegel üyesi olmayan birinden geliyor."
                style={{ background: '#292019', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, cursor: 'help' }}>
                ⚠️ Doğrulanmamış İlan
              </span>
            )}
            {ilan.telefonDogrulandi && (
              <span style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                ✅ Telefon Doğrulandı
              </span>
            )}
            {ilan.yeniUye && !ilan.dogrulanmamis && (
              <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                🆕 Yeni Üye
              </span>
            )}
            {ilan.fiyat && (
              <span style={{ background: '#1c1a0d', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                ⭐ Detaylı İlan
              </span>
            )}
          </div>

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
              {d.arac_adet > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem', marginLeft: 4 }}>{d.arac_adet} araç</span>}
            </div>
          ))}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {ilan.aracTipleri.map((t: string) => <Chip key={'a-' + t} label={'🚛 ' + t} bg='#1a2535' color='#60a5fa' />)}
            {ilan.ustyapilari.map((u: string) => <Chip key={'u-' + u} label={u} bg='#1f2937' color='#94a3b8' />)}
            {ilan.duraklar[0]?.ton && <Chip label={'⚖ ' + ilan.duraklar[0].ton + ' ton'} bg='#1a2a1a' color='#86efac' />}
            {ilan.duraklar[0]?.palet && <Chip label={'📦 ' + ilan.duraklar[0].palet + ' palet'} bg='#1a2a1a' color='#86efac' />}
            {ilan.tarih && <Chip label={'📅 ' + new Date(ilan.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (ilan.tarihEsnek ? ' ±' : '')} bg='#1f2937' color='#94a3b8' />}
            <span style={{ color: '#4b5563', fontSize: '0.72rem', marginLeft: 'auto', alignSelf: 'center' }}>{ilan.sure}</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {ilan.fiyat && (
            <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', marginBottom: 8 }}>
              ₺{Number(ilan.fiyat).toLocaleString('tr-TR')}
            </div>
          )}
          {kullanici ? (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${ilan.tel}`; }}
              style={{ display: 'block', background: '#1a3a1a', color: '#4ade80', border: '1px solid #166534', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
              📞 Ara
            </button>
          ) : (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = '/giris'; }}
              style={{ display: 'block', background: '#1a2a3a', color: '#60a5fa', border: '1px solid #1e3a5f', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔐 Ara
            </button>
          )}
        </div>
      </div>
    </a>
  );
}
