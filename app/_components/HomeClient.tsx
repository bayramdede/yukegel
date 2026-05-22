'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

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
  form:     { label: 'Yükegel',     bg: '#0d2b1a', color: '#22c55e' },
  whatsapp: { label: '📱 WhatsApp', bg: '#0d2b0d', color: '#4ade80' },
  facebook: { label: '👥 Facebook', bg: '#1e3a5f', color: '#60a5fa' },
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

function HeroKayitsiz() {
  return (
    <div style={{ borderBottom: '1px solid #1a3a2a', background: 'linear-gradient(180deg, #0d1f0f 0%, #0d1117 100%)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 16px 40px' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0d2b1a', border: '1px solid #166534', borderRadius: 20, padding: '4px 12px', marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 700 }}>Türkiye'nin Nakliye Platformu</span>
          </div>
          <h1 style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', lineHeight: 1.2, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
            Teker boşa<br /><span style={{ color: '#22c55e' }}>dönmesin.</span>
          </h1>
          <p style={{ color: '#8b949e', fontSize: '1rem', margin: '0 0 28px', lineHeight: 1.6 }}>
            Yükünüzü taşıtın veya boş kapasitenizi değerlendirin.<br />
            Binlerce nakliyeci ve yük sahibi Yükegel'de.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <a href="/ilan-ver" style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.95rem', padding: '12px 24px', borderRadius: 8, textDecoration: 'none' }}>
              📦 Yük Taşıtmak İstiyorum
            </a>
            <a href="/giris" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', border: '1px solid #30363d' }}>
              🚛 Yük Taşımak İstiyorum
            </a>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[{ ikon: '⚡', text: 'Anında İlan' }, { ikon: '🔒', text: 'Güvenli Platform' }, { ikon: '🆓', text: 'Ücretsiz' }, { ikon: '📱', text: 'WhatsApp Entegrasyonu' }].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.9rem' }}>{item.ikon}</span>
                <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 600 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMusteri({ ad }: { ad: string }) {
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 2 }}>Hoş geldiniz,</div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.15rem' }}>{ad} 👋</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/ilan-ver" style={{ background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none' }}>+ Yeni İlan Oluştur</a>
            <a href="/panel" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>📋 İlanlarım</a>
            <a href="/panel?tab=profil" style={{ background: '#161b22', color: '#8b949e', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>👤 Profil</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroNakliyeci({ ad }: { ad: string }) {
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 2 }}>Hoş geldiniz,</div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.15rem' }}>{ad} 👋</div>
            <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 3 }}>Bölgenizdeki yeni işleri keşfedin.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/ilan-ver?tip=arac" style={{ background: '#1e3a5f', color: '#60a5fa', fontWeight: 800, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #1e3a5f' }}>🚛 Aracım Boşta</a>
            <a href="/panel" style={{ background: '#161b22', color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem', padding: '9px 18px', borderRadius: 7, textDecoration: 'none', border: '1px solid #30363d' }}>📋 Panelim</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function UyeBanner() {
  return (
    <div style={{ background: '#161b22', border: '1px solid #1e3a5f', borderRadius: 8, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ color: '#8b949e', fontSize: '0.82rem' }}>
        🔐 <strong style={{ color: '#e2e8f0' }}>Telefon numaralarını görmek</strong> ve ilan sahiplerine ulaşmak için üye olun. Ücretsiz.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <a href="/giris" style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>Giriş Yap</a>
        <a href="/giris" style={{ background: '#22c55e', color: '#000', borderRadius: 6, padding: '7px 14px', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>Üye Ol →</a>
      </div>
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
            <span style={{ background: kaynak.bg, color: kaynak.color, fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>{kaynak.label}</span>
            {ilan.dogrulanmamis && <span style={{ background: '#292019', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>⚠️ Doğrulanmamış</span>}
            {ilan.telefonDogrulandi && <span style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✅ Tel Doğrulandı</span>}
            {ilan.yeniUye && !ilan.dogrulanmamis && <span style={{ background: '#1e1b4b', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🆕 Yeni Üye</span>}
            {ilan.fiyat && <span style={{ background: '#0d2b1a', color: '#22c55e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>✓ Fiyat Belli</span>}
          </div>
          {/* Rota: Kalkış → Durak1 → Durak2 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.95rem' }}>
              {ilan.kalkis}{ilan.kalkis_ilce ? ` / ${ilan.kalkis_ilce}` : ''}
            </span>
            {ilan.duraklar.map((d: any, i: number) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: '#4b5563', fontWeight: 700, fontSize: '0.9rem' }}>→</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>
                  {d.sehir}{d.ilce ? ` / ${d.ilce}` : ''}
                </span>
                {d.arac_adet > 1 && <span style={{ color: '#60a5fa', fontSize: '0.78rem' }}>({d.arac_adet} araç)</span>}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {ilan.aracTipleri.map((t: string) => <Chip key={'a-' + t} label={'🚛 ' + t} bg='#1a2535' color='#60a5fa' />)}
            {ilan.ustyapilari.map((u: string) => <Chip key={'u-' + u} label={u} />)}
            {ilan.duraklar[0]?.ton && <Chip label={'⚖ ' + ilan.duraklar[0].ton + ' ton'} bg='#1a2a1a' color='#86efac' />}
            {ilan.duraklar[0]?.palet && <Chip label={'📦 ' + ilan.duraklar[0].palet + ' palet'} bg='#1a2a1a' color='#86efac' />}
            {ilan.tarih && <Chip label={'📅 ' + new Date(ilan.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + (ilan.tarihEsnek ? ' ±' : '')} />}
            <span style={{ color: '#4b5563', fontSize: '0.72rem', marginLeft: 'auto', alignSelf: 'center' }}>{ilan.sure}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {ilan.fiyat && <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.05rem', marginBottom: 8 }}>₺{Number(ilan.fiyat).toLocaleString('tr-TR')}</div>}
          {kullanici ? (
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${ilan.tel}`; }}
              style={{ display: 'block', background: '#1a3a1a', color: '#4ade80', border: '1px solid #166634', borderRadius: 6, padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
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

function IlanSkeleton() {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div className="sk" style={{ width: 60, height: 20, background: '#0d1117', borderRadius: 4 }} />
        <div className="sk" style={{ width: 76, height: 20, background: '#0d1117', borderRadius: 4 }} />
      </div>
      <div className="sk" style={{ width: '42%', height: 22, background: '#0d1117', borderRadius: 4, marginBottom: 8 }} />
      <div className="sk" style={{ width: '34%', height: 22, background: '#0d1117', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="sk" style={{ width: 90, height: 18, background: '#0d1117', borderRadius: 4 }} />
        <div className="sk" style={{ width: 68, height: 18, background: '#0d1117', borderRadius: 4 }} />
      </div>
    </div>
  );
}

function HataEkrani({ tip, onRetry }: { tip: 'timeout' | 'error'; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{tip === 'timeout' ? '⏱️' : '⚠️'}</div>
      <div style={{ fontWeight: 600, color: '#8b949e', marginBottom: 4 }}>
        {tip === 'timeout' ? 'Bağlantı zaman aşımına uğradı' : 'İlanlar yüklenirken bir hata oluştu'}
      </div>
      <div style={{ fontSize: '0.85rem', marginBottom: 20 }}>
        {tip === 'timeout' ? 'İnternet bağlantınızı kontrol edin ve tekrar deneyin.' : 'Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.'}
      </div>
      <button
        onClick={onRetry}
        style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 7, padding: '10px 24px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
        🔄 Tekrar Dene
      </button>
    </div>
  );
}

export default function HomeClient({ initialIlanlar = [] }: { initialIlanlar?: any[] }) {
  const [ilanlar, setIlanlar] = useState<any[]>(initialIlanlar);
  const [yukleniyor, setYukleniyor] = useState(initialIlanlar.length === 0);
  const [hata, setHata] = useState<'timeout' | 'error' | null>(null);
  const [tip, setTip] = useState<'yuk' | 'arac'>('yuk');
  const [kalkis, setKalkis] = useState('');
  const [varis, setVaris] = useState('');
  const [aracTipi, setAracTipi] = useState('');
  const [kasaTipi, setKasaTipi] = useState('');
  const [kullanici, setKullanici] = useState<{ display_name: string | null; email: string | null; user_type: string | null } | null>(null);
  const [authHazir, setAuthHazir] = useState(false);
  const [yenilemeKey, setYenilemeKey] = useState(0);

  async function profilCek(userId: string) {
    const { data: profil } = await supabase
      .from('users')
      .select('display_name, email, user_type')
      .eq('id', userId)
      .maybeSingle();
    return profil;
  }

  // Auth — bir kez çalışır
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) await supabase.auth.signOut({ scope: 'local' });
        if (cancelled) return;
        if (!error && session?.user) {
          const profil = await profilCek(session.user.id);
          if (cancelled) return;
          setKullanici(profil || { display_name: null, email: session.user.email ?? null, user_type: null });
        }
      } catch {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
      } finally {
        if (!cancelled) setAuthHazir(true);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      if (session?.user) {
        const profil = await profilCek(session.user.id);
        if (cancelled) return;
        setKullanici(profil || { display_name: null, email: session.user.email ?? null, user_type: null });
      } else {
        setKullanici(null);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // İlanlar — SSR verisi varsa ilk yükte atla; yenilemeKey ile retry desteği
  useEffect(() => {
    if (yenilemeKey === 0 && initialIlanlar.length > 0) return;

    let cancelled = false;
    setYukleniyor(true);
    setHata(null);

    (async () => {
      try {
        const sorgu = supabase
          .from('listings')
          .select(`
            id, listing_type, origin_city, origin_district,
            contact_phone, price_offer, source, created_at,
            trust_level, user_id, vehicle_type, body_type,
            available_date, date_flexible
          `)
          .in('moderation_status', ['approved', 'auto_published'])
          .eq('is_shadow_banned', false)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(30);

        const timeout = new Promise<{ data: null; error: Error }>(resolve =>
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 8000)
        );
        const { data, error: sorguHata } = await Promise.race([sorgu, timeout]);

        if (cancelled) return;

        if (sorguHata) {
          setHata(sorguHata.message === 'timeout' ? 'timeout' : 'error');
          setYukleniyor(false);
          return;
        }

        if (!data || data.length === 0) {
          setIlanlar([]);
          setYukleniyor(false);
          return;
        }

        const ilanIds = (data as any[]).map((i: any) => i.id);
        const { data: stopsData } = await supabase
          .from('listing_stops')
          .select('listing_id, stop_order, city, district, vehicle_count, cargo_type, weight_ton, pallet_count')
          .in('listing_id', ilanIds)
          .order('stop_order', { ascending: true });

        if (cancelled) return;

        const stopsMap: Record<string, any[]> = {};
        for (const s of (stopsData || []) as any[]) {
          if (!stopsMap[s.listing_id]) stopsMap[s.listing_id] = [];
          stopsMap[s.listing_id].push(s);
        }

        const baseList = (data as any[]).map((ilan: any) => {
          const stops = stopsMap[ilan.id] || [];
          const aracTipiList: string[] = ilan.vehicle_type?.length
            ? ilan.vehicle_type
            : ([...new Set(stops.map((s: any) => s.cargo_type).filter(Boolean))] as string[]);
          return {
            id: ilan.id, tip: ilan.listing_type,
            kalkis: ilan.origin_city, kalkis_ilce: ilan.origin_district || '',
            duraklar: stops.map((s: any) => ({ sehir: s.city, ilce: s.district || '', ton: s.weight_ton, palet: s.pallet_count, arac_adet: s.vehicle_count })),
            kaynak: ilan.source || 'form',
            sure: new Date(ilan.created_at).toLocaleDateString('tr-TR'),
            tel: ilan.contact_phone, fiyat: ilan.price_offer?.toString() ?? null,
            tarih: ilan.available_date, tarihEsnek: ilan.date_flexible,
            aracTipleri: aracTipiList, ustyapilari: (ilan.body_type || []) as string[],
            dogrulanmamis: !ilan.user_id || ilan.trust_level === 'social',
            telefonDogrulandi: false,
            yeniUye: false,
            user_id: ilan.user_id,
          };
        });
        setIlanlar(baseList);
        setYukleniyor(false);

        // Rozet zenginleştirme
        const userIds = [...new Set(baseList.map(i => i.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: ks } = await supabase.from('users').select('id, phone_verified, created_at').in('id', userIds);
          if (cancelled) return;
          const kullaniciMap: Record<string, { phone_verified: boolean; created_at: string }> = {};
          for (const k of (ks || []) as any[]) kullaniciMap[k.id] = k;
          setIlanlar(prev => prev.map(ilan => {
            const kb = ilan.user_id ? kullaniciMap[ilan.user_id] : null;
            return { ...ilan, telefonDogrulandi: kb?.phone_verified === true, yeniUye: kb ? yeniUye(kb.created_at) : false };
          }));
        }
      } catch (err) {
        console.error('Listings fetch hatası:', err);
        if (!cancelled) { setHata('error'); setYukleniyor(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [yenilemeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterAktif = !!(kalkis || varis || aracTipi || kasaTipi);

  const filtered = ilanlar.filter((i: any) => {
    if (i.tip !== tip) return false;
    if (kalkis && !i.kalkis?.includes(kalkis)) return false;
    if (varis && !i.duraklar.some((d: any) => d.sehir?.includes(varis))) return false;
    if (aracTipi && !i.aracTipleri.some((a: string) => a === aracTipi)) return false;
    if (kasaTipi && !i.ustyapilari.some((u: string) => u === kasaTipi)) return false;
    return true;
  });

  // Dinamik filtre seçenekleri — mevcut ilanlardan türetilir
  const aracTipiOptions = [...new Set(ilanlar.flatMap((i: any) => i.aracTipleri as string[]))].sort();
  const kasaTipiOptions = [...new Set(ilanlar.flatMap((i: any) => i.ustyapilari as string[]))].sort();

  const ad = kullanici?.display_name || kullanici?.email?.split('@')[0] || 'Kullanıcı';
  const isNakliyeci = kullanici?.user_type === 'arac_sahibi';
  const isMusteri = kullanici && !isNakliyeci;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes skshimmer{0%,100%{opacity:.5}50%{opacity:.85}}.sk{animation:skshimmer 1.5s ease-in-out infinite}`}</style>

      {/* NAVBAR — misafir linkler hemen göster, auth resolve olunca kişiselleşir */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em' }}>
                <span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span>
              </span>
              <span style={{ background: '#1e3a5f', color: '#60a5fa', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>BETA</span>
            </a>
            <div style={{ display: 'flex', gap: 4 }}>
              <a href="/nasil-calisir" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none', padding: '4px 8px', borderRadius: 5 }}>Nasıl Çalışır?</a>
              <a href="/hakkimizda" style={{ color: '#8b949e', fontSize: '0.82rem', textDecoration: 'none', padding: '4px 8px', borderRadius: 5 }}>Hakkımızda</a>
            </div>
          </div>
          {kullanici ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/panel" style={{ color: '#e2e8f0', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>👤 {ad}</a>
              <a href="/ilan-ver" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>+ İlan Ver</a>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="/giris" style={{ color: '#8b949e', fontSize: '0.85rem', textDecoration: 'none' }}>Giriş Yap</a>
              <a href="/giris" style={{ background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', padding: '6px 16px', borderRadius: 6, textDecoration: 'none' }}>Üye Ol</a>
            </div>
          )}
        </div>
      </nav>

      {/* HERO — misafir hero hemen görünür, auth resolve olunca kişiselleşir */}
      {!kullanici && <HeroKayitsiz />}
      {authHazir && isMusteri && <HeroMusteri ad={ad} />}
      {authHazir && isNakliyeci && <HeroNakliyeci ad={ad} />}

      {/* FİLTRE BARI */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 56, zIndex: 40 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#0d1117', borderRadius: 6, padding: 2, border: '1px solid #30363d', display: 'flex' }}>
            {(['arac', 'yuk'] as const).map(t => (
              <button key={t} onClick={() => setTip(t)}
                style={{ padding: '5px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: tip === t ? '#22c55e' : 'transparent', color: tip === t ? '#000' : '#8b949e' }}>
                {t === 'yuk' ? '🔴 Yük' : '🟢 Araç'}
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
          {filterAktif && (
            <button onClick={() => { setKalkis(''); setVaris(''); }}
              style={{ color: '#22c55e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              ✕ Temizle
            </button>
          )}
          <span style={{ color: '#8b949e', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {yukleniyor ? 'Yükleniyor...' : hata ? '–' : `${filtered.length} ${tip === 'yuk' ? 'yük' : 'araç'} ilanı`}
          </span>
        </div>
      </div>

      {/* İLAN LİSTESİ */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '16px' }}>
        {yukleniyor ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <IlanSkeleton key={i} />)}
          </div>
        ) : hata ? (
          <HataEkrani tip={hata} onRetry={() => setYenilemeKey(k => k + 1)} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {!kullanici && filtered.length > 0 ? (
              <>
                <IlanKart ilan={filtered[0]} kullanici={kullanici} />
                <UyeBanner />
                {filtered.slice(1).map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)}
              </>
            ) : (
              filtered.map((ilan: any) => <IlanKart key={ilan.id} ilan={ilan} kullanici={kullanici} />)
            )}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: '#4b5563' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                <div style={{ fontWeight: 600 }}>
                  {filterAktif ? 'Filtrelerle eşleşen ilan bulunamadı' : `Henüz aktif ${tip === 'yuk' ? 'yük' : 'araç'} ilanı bulunmuyor`}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                  {filterAktif ? 'Filtreleri değiştirmeyi deneyin' : 'İlk ilanı sen ekle!'}
                </div>
                {filterAktif && (
                  <button onClick={() => { setKalkis(''); setVaris(''); }}
                    style={{ marginTop: 16, color: '#22c55e', background: 'none', border: '1px solid #22c55e', borderRadius: 6, padding: '7px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    Filtreleri Temizle
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
