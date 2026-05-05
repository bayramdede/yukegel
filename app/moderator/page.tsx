'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import WhatsappYukle from './WhatsappYukle';

const supabase = createClient();

const ARAC_TIPLERI = ['Minivan', 'Panelvan', 'Kamyonet', 'Kamyon', 'Kırkayak', 'TIR'];
const UST_YAPI = ['Açık Kasa', 'Kapalı Kasa', 'Tenteli', 'Damperli', 'Frigolu', 'Liftli', 'Sal Kasa', 'Lowbed'];
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
  'Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce',
];

const DURUM_RENK: Record<string, { bg: string; color: string }> = {
  pending:        { bg: '#451a03', color: '#fb923c' },
  approved:       { bg: '#14532d', color: '#22c55e' },
  auto_published: { bg: '#1e3a5f', color: '#60a5fa' },
  rejected:       { bg: '#450a0a', color: '#f87171' },
  passive:        { bg: '#1f2937', color: '#9ca3af' },
};

function temizNotes(rawText: string): string {
  const ilkSatir = rawText.split('\n').find(l => l.trim().length > 5) || '';
  return ilkSatir
    .replace(/➡️?|→|--?>|==>/g, ' -> ')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[*•~📌⭕]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function skorRenk(ilan: any): { border: string; badge: string; label: string; puan: number } {
  const stops = ilan.listing_stops || [];
  let skor = 0;
  if (ilan.contact_phone) skor += 30;
  if (ilan.origin_city) skor += 15;
  if (stops.length > 0) skor += 15;
  if (ilan.vehicle_type?.length > 0) skor += 20;
  if (ilan.body_type?.length > 0) skor += 10;
  if (stops[0]?.weight_ton) skor += 5;
  if (ilan.notes) skor += 5;
  if (skor >= 75) return { border: '#166534', badge: '🟢', label: 'Hazır', puan: skor };
  if (skor >= 45) return { border: '#854d0e', badge: '🟡', label: 'Kontrol Et', puan: skor };
  return { border: '#7f1d1d', badge: '🔴', label: 'Düzenleme Gerek', puan: skor };
}

function omnisearchTip(metin: string): 'phone' | 'email' | null {
  const t = metin.trim();
  if (!t || t.length < 6) return null;
  if (/^[0+]/.test(t) && t.replace(/\D/g, '').length >= 7) return 'phone';
  if (t.includes('@') && t.length > 5) return 'email';
  return null;
}

const inp = {
  background: '#0d1117', color: '#e2e8f0', border: '1px solid #374151',
  borderRadius: 4, padding: '4px 8px', fontSize: '0.85rem', width: '100%', outline: 'none',
} as React.CSSProperties;

// ── Kullanıcı Kart (Omnisearch sonucu)
function KullaniciKart({ kullanici, onAskiya }: { kullanici: any; onAskiya: (id: string, ad: string) => void }) {
  const ad = kullanici.display_name || kullanici.email || kullanici.phone || 'Adsız';
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
      padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>👤</div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.9rem' }}>{ad}</span>
          <span style={{
            background: kullanici.role === 'admin' ? '#451a7f' : kullanici.role === 'moderator' ? '#1e3a5f' : '#1f2937',
            color: kullanici.role === 'admin' ? '#c084fc' : kullanici.role === 'moderator' ? '#60a5fa' : '#9ca3af',
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          }}>{kullanici.role}</span>
          {!kullanici.is_active && (
            <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>🚫 ASKIDA</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {kullanici.phone && <span style={{ color: '#60a5fa', fontSize: '0.78rem' }}>📞 {kullanici.phone}</span>}
          {kullanici.email && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>✉️ {kullanici.email}</span>}
          <span style={{ color: '#4b5563', fontSize: '0.72rem', fontFamily: 'monospace' }}>#{kullanici.id.substring(0, 8)}</span>
        </div>
      </div>
      {kullanici.is_active !== false && (
        <button
          onClick={() => onAskiya(kullanici.id, ad)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #7f1d1d', background: '#2a0a0a', color: '#f87171', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🚫 Askıya Al
        </button>
      )}
    </div>
  );
}

export default function Moderator() {
  // ── Mevcut state
  const [ilanlar, setIlanlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [filtre, setFiltre] = useState<'pending' | 'approved' | 'rejected' | 'passive' | 'hepsi' | 'no_lane' | 'arsiv'>('pending');
  const [noLaneListesi, setNoLaneListesi] = useState<any[]>([]);
  const [islem, setIslem] = useState<string>('');
  const [duzenleId, setDuzenleId] = useState<string>('');
  const [duzenleData, setDuzenleData] = useState<any>({});
  const [sonraBak, setSonraBak] = useState<Set<string>>(new Set());
  const [sonraBakGoster, setSonraBakGoster] = useState(false);
  const [llmYukleniyor, setLlmYukleniyor] = useState(false);
  const [istatistik, setIstatistik] = useState<any>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [filtreTelefon, setFiltreTelefon] = useState('');
  const [filtreKalkis, setFiltreKalkis] = useState('');
  const [filtreVaris, setFiltreVaris] = useState('');
  const [filtreAracTipi, setFiltreAracTipi] = useState('');
  const [filtreSkor, setFiltreSkor] = useState<'hepsi' | 'yesil' | 'sari' | 'kirmizi'>('hepsi');
  const [filtreTonajMin, setFiltreTonajMin] = useState('');
  const [filtreTonajMax, setFiltreTonajMax] = useState('');
  const [filtreTarihBaslangic, setFiltreTarihBaslangic] = useState('');
  const [filtreTarihBitis, setFiltreTarihBitis] = useState('');

  // ── YENİ: Toplu seçim
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [bulkYukleniyor, setBulkYukleniyor] = useState(false);

  // ── YENİ: Omnisearch kullanıcı
  const [kullaniciBulguList, setKullaniciBulguList] = useState<any[]>([]);
  const [kullaniciAramaYukleniyor, setKullaniciAramaYukleniyor] = useState(false);

  const ilanRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();
  const [yetkiKontrol, setYetkiKontrol] = useState(true);

  // ── Auth
  useEffect(() => {
    async function kontrol() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/giris?redirect=/moderator'); return; }
      const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).single();
      const role = (profil as any)?.role;
      if (role !== 'moderator' && role !== 'admin') { router.push('/'); return; }
      setYetkiKontrol(false);
    }
    kontrol();
  }, [router]);

  useEffect(() => { if (!yetkiKontrol) { getIlanlar(); getIstatistik(); } }, [filtre, yetkiKontrol, filtreTarihBaslangic, filtreTarihBitis]);

  // ── YENİ: Omnisearch — telefon veya email girilince kullanıcı ara
  useEffect(() => {
    const tip = omnisearchTip(aramaMetni);
    if (!tip) { setKullaniciBulguList([]); return; }
    setKullaniciAramaYukleniyor(true);
    const timer = setTimeout(async () => {
      let query = supabase.from('users').select('id, display_name, phone, email, role, is_active, user_type, created_at');
      if (tip === 'phone') {
        const digits = aramaMetni.trim().replace(/\D/g, '').slice(-10);
        query = (query as any).ilike('phone', `%${digits}`);
      } else {
        query = (query as any).ilike('email', `%${aramaMetni.trim()}%`);
      }
      const { data } = await (query as any).limit(5);
      setKullaniciBulguList(data || []);
      setKullaniciAramaYukleniyor(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [aramaMetni]);

  // ── Filtre/tab değişince seçimi temizle
  useEffect(() => { setSelectedIds(new Set()); setLastClickedIdx(null); }, [filtre]);

  async function getIstatistik() {
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const [{ count: pending }, { count: bugunGelen }, { count: bugunOnaylanan }, { count: cozumsuz }] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', bugun.toISOString()),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('moderation_status', 'approved').gte('reviewed_at', bugun.toISOString()),
      supabase.from('raw_posts').select('*', { count: 'exact', head: true }).eq('processing_status', 'no_lane'),
    ]);
    setIstatistik({ pending, bugunGelen, bugunOnaylanan, cozumsuz });
  }

  async function getIlanlar() {
    setYukleniyor(true);
    if (filtre === 'no_lane') {
      const { data } = await supabase.from('raw_posts')
        .select('id, raw_text, sender_name, source, source_group, message_timestamp, quality_score')
        .eq('processing_status', 'no_lane').order('created_at', { ascending: false }).limit(100);
      setNoLaneListesi(data || []); setIlanlar([]); setYukleniyor(false); return;
    }
    let query = supabase.from('listings').select(`
      id, listing_type, origin_city, origin_district, contact_phone, price_offer,
      source, created_at, moderation_status, status, notes, trust_level,
      raw_text, raw_post_id, vehicle_type, body_type,
      listing_stops ( id, stop_order, city, district, vehicle_count, cargo_type, weight_ton, pallet_count, notes )
    `).order('created_at', { ascending: false }).limit(200);

    // Tab filtresi
    if (filtre === 'arsiv') {
      query = query.eq('moderation_status', 'archived');
    } else if (filtre === 'hepsi') {
      query = (query as any).neq('moderation_status', 'archived');
    } else {
      query = query.eq('moderation_status', filtre);
    }

    // Server-side tarih filtresi
    if (filtreTarihBaslangic) query = query.gte('created_at', filtreTarihBaslangic);
    if (filtreTarihBitis)    query = (query as any).lte('created_at', filtreTarihBitis + 'T23:59:59');

    const { data } = await query;
    setIlanlar(data || []); setYukleniyor(false);
  }

  // ── Client-side filtre
  const filtrelenmis = ilanlar.filter(ilan => {
    const stops = ilan.listing_stops || [];
    if (!sonraBakGoster && sonraBak.has(ilan.id)) return false;
    if (aramaMetni) {
      const norm = aramaMetni.toLowerCase();
      const haystack = `${ilan.raw_text || ''} ${ilan.notes || ''} ${ilan.origin_city || ''} ${stops.map((s: any) => s.city).join(' ')}`.toLowerCase();
      if (!haystack.includes(norm)) return false;
    }
    if (filtreTelefon) { const tel = filtreTelefon.replace(/\D/g, ''); if (!(ilan.contact_phone || '').replace(/\D/g, '').includes(tel)) return false; }
    if (filtreKalkis && ilan.origin_city !== filtreKalkis) return false;
    if (filtreVaris && !stops.some((s: any) => s.city === filtreVaris)) return false;
    if (filtreAracTipi && !(ilan.vehicle_type || []).includes(filtreAracTipi)) return false;
    if (filtreTonajMin) {
      const maks = Math.max(0, ...stops.map((s: any) => parseFloat(s.weight_ton) || 0));
      if (maks < parseFloat(filtreTonajMin)) return false;
    }
    if (filtreTonajMax) {
      const maks = Math.max(0, ...stops.map((s: any) => parseFloat(s.weight_ton) || 0));
      if (maks > parseFloat(filtreTonajMax)) return false;
    }
    if (filtreSkor !== 'hepsi') {
      const r = skorRenk(ilan);
      if (filtreSkor === 'yesil' && r.badge !== '🟢') return false;
      if (filtreSkor === 'sari' && r.badge !== '🟡') return false;
      if (filtreSkor === 'kirmizi' && r.badge !== '🔴') return false;
    }
    return true;
  });

  const sonraBakSayisi = ilanlar.filter(i => sonraBak.has(i.id)).length;
  const yesil  = filtrelenmis.filter(i => skorRenk(i).badge === '🟢').length;
  const sari   = filtrelenmis.filter(i => skorRenk(i).badge === '🟡').length;
  const kirmizi = filtrelenmis.filter(i => skorRenk(i).badge === '🔴').length;

  // ── YENİ: Checkbox (Shift+Click desteği)
  function handleCheckbox(id: string, idx: number, e: React.MouseEvent) {
    e.stopPropagation();
    const yeni = new Set(selectedIds);
    if (e.shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end   = Math.max(lastClickedIdx, idx);
      for (let i = start; i <= end; i++) {
        if (filtrelenmis[i]) yeni.add(filtrelenmis[i].id);
      }
    } else {
      if (yeni.has(id)) yeni.delete(id);
      else yeni.add(id);
    }
    setSelectedIds(yeni);
    setLastClickedIdx(idx);
  }

  function masterToggle() {
    if (selectedIds.size === filtrelenmis.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtrelenmis.map(i => i.id)));
  }

  // ── Tüm toplu işlemler service role API üzerinden
  async function topluApi(ids: string[], action: 'approve' | 'reject' | 'passive' | 'archive' | 'unarchive') {
    const res = await fetch('/api/moderator/toplu-islem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Bilinmeyen hata');
    return json;
  }

  // ── Toplu işlem (floating bar)
  async function topluIslem(action: 'approve' | 'archive' | 'delete') {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const label = { approve: 'onaylanacak', archive: 'arşivlenecek', delete: 'reddedilecek' }[action];
    if (!confirm(`${ids.length} ilan ${label}. Devam et?`)) return;
    setBulkYukleniyor(true);
    try {
      const apiAction = action === 'delete' ? 'reject' : action;
      await topluApi(ids, apiAction);
      setSelectedIds(new Set());
    } catch (e: any) {
      alert('Hata: ' + e.message);
    }
    setBulkYukleniyor(false);
    getIlanlar(); getIstatistik();
  }

  // ── ⚡ Skor bazlı toplu onay
  async function topluOnaylaYesil() {
    const ids = filtrelenmis.filter(i => skorRenk(i).badge === '🟢').map(i => i.id);
    if (!ids.length) return;
    try {
      await topluApi(ids, 'approve');
      getIlanlar(); getIstatistik();
    } catch (e: any) {
      alert('Toplu onay hatası: ' + e.message);
    }
  }

  // ── Skor bazlı toplu red
  async function topluReddet(badge: '🟡' | '🔴') {
    const ids = filtrelenmis.filter(i => skorRenk(i).badge === badge).map(i => i.id);
    if (!ids.length) return;
    try {
      await topluApi(ids, 'reject');
      getIlanlar(); getIstatistik();
    } catch (e: any) {
      alert('Toplu red hatası: ' + e.message);
    }
  }

  // ── Tekil arşivle / arşivden çıkar
  async function arsivIslem(id: string, geriAl = false) {
    setIslem(id);
    try {
      await topluApi([id], geriAl ? 'unarchive' : 'archive');
    } catch (e: any) {
      alert('Arşiv hatası: ' + e.message);
    }
    setIslem('');
    setTimeout(() => { getIlanlar(); getIstatistik(); }, 200);
  }

  // ── YENİ: Global askıya al
  async function kullaniciAskiyaAl(userId: string, displayName: string) {
    if (!confirm(`"${displayName}" hesabı askıya alınacak ve tüm ilanları kapatılacak. Devam et?`)) return;
    const res = await fetch('/api/moderator/kullanici-askiya', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setKullaniciBulguList(prev => prev.map(u => u.id === userId ? { ...u, is_active: false } : u));
      getIlanlar(); getIstatistik();
    } else {
      alert('Hata oluştu');
    }
  }

  function siradakineGec(mevcutId: string, duzenlemeModu = false) {
    const idx = filtrelenmis.findIndex(i => i.id === mevcutId);
    const sonraki = filtrelenmis[idx + 1];
    if (sonraki) {
      setTimeout(() => {
        ilanRefs.current[sonraki.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (duzenlemeModu) duzenleAc(sonraki);
      }, 350);
    }
  }

  async function aksiyon(id: string, yeniModerasyon: string, yeniStatus: string) {
    setIslem(id);
    await supabase.from('listings').update({ moderation_status: yeniModerasyon, status: yeniStatus, reviewed_at: new Date().toISOString() }).eq('id', id);
    setIslem('');
    siradakineGec(id, false);
    setTimeout(() => { getIlanlar(); getIstatistik(); }, 300);
  }

  function sonraBakEkleVeGec(id: string) {
    const duzenlemeModundaydı = duzenleId === id;
    const yeni = new Set(sonraBak); yeni.add(id); setSonraBak(yeni);
    siradakineGec(id, duzenlemeModundaydı);
  }

  function duzenleAc(ilan: any) {
    setDuzenleId(ilan.id);
    setDuzenleData({
      listing_type: ilan.listing_type,
      origin_city: ilan.origin_city,
      origin_district: ilan.origin_district || '',
      contact_phone: ilan.contact_phone || '',
      price_offer: ilan.price_offer || '',
      notes: ilan.notes || '',
      vehicle_type: ilan.vehicle_type || [],
      body_type: ilan.body_type || [],
      stops: (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order).map((s: any) => ({
        id: s.id, city: s.city, district: s.district || '',
        weight_ton: s.weight_ton || '', pallet_count: s.pallet_count || '',
        vehicle_count: s.vehicle_count || 1, cargo_type: s.cargo_type || '', notes: s.notes || '',
      }))
    });
  }

  async function duzenleKaydet(id: string, mod: 'onayla' | 'sadece_kaydet') {
    setIslem(id);
    const updateData: any = {
      listing_type: duzenleData.listing_type, origin_city: duzenleData.origin_city,
      origin_district: duzenleData.origin_district, contact_phone: duzenleData.contact_phone,
      price_offer: duzenleData.price_offer || null, notes: duzenleData.notes,
      vehicle_type: duzenleData.vehicle_type, body_type: duzenleData.body_type,
    };
    if (mod === 'onayla') { updateData.moderation_status = 'approved'; updateData.status = 'active'; updateData.reviewed_at = new Date().toISOString(); }
    await supabase.from('listings').update(updateData).eq('id', id);
    for (let i = 0; i < duzenleData.stops.length; i++) {
      const stop = duzenleData.stops[i];
      if (stop.id) {
        await supabase.from('listing_stops').update({ city: stop.city, district: stop.district, weight_ton: stop.weight_ton || null, pallet_count: stop.pallet_count || null, vehicle_count: stop.vehicle_count, cargo_type: stop.cargo_type, notes: stop.notes || null }).eq('id', stop.id);
      } else {
        await supabase.from('listing_stops').insert({ listing_id: id, stop_order: i + 1, city: stop.city, district: stop.district || null, weight_ton: stop.weight_ton || null, pallet_count: stop.pallet_count || null, vehicle_count: stop.vehicle_count || 1, cargo_type: stop.cargo_type || null, notes: stop.notes || null });
      }
    }
    if (mod === 'onayla') await aliasOgren(duzenleData);
    setDuzenleId(''); setIslem('');
    siradakineGec(id, true);
    setTimeout(() => { getIlanlar(); getIstatistik(); }, 300);
  }

  function stopEkle() { setDuzenleData({ ...duzenleData, stops: [...(duzenleData.stops || []), { id: null, city: 'İstanbul', district: '', weight_ton: '', pallet_count: '', vehicle_count: 1, cargo_type: '', notes: '' }] }); }
  function stopSil(idx: number) { setDuzenleData({ ...duzenleData, stops: duzenleData.stops.filter((_: any, i: number) => i !== idx) }); }
  function stopGuncelle(idx: number, alan: string, deger: any) { const yeni = [...duzenleData.stops]; yeni[idx] = { ...yeni[idx], [alan]: deger }; setDuzenleData({ ...duzenleData, stops: yeni }); }

  async function aliasOgren(data: any) {
    const norm = (s: string) => s.toLowerCase().replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/İ/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u');
    if (data.origin_district && data.origin_city) await supabase.from('aliases').upsert({ alias: norm(data.origin_district), normalized: data.origin_city, district: data.origin_district, type: 'city', is_active: true, priority: 90 }, { onConflict: 'alias' });
    for (const stop of (data.stops || [])) { if (stop.district && stop.city) await supabase.from('aliases').upsert({ alias: norm(stop.district), normalized: stop.city, district: stop.district, type: 'city', is_active: true, priority: 90 }, { onConflict: 'alias' }); }
    for (const vt of (data.vehicle_type || [])) { if (vt) await supabase.from('aliases').upsert({ alias: norm(vt), normalized: vt, type: 'vehicle', is_active: true, priority: 80 }, { onConflict: 'alias' }); }
    for (const bt of (data.body_type || [])) { if (bt) await supabase.from('aliases').upsert({ alias: norm(bt), normalized: bt, type: 'body', is_active: true, priority: 70 }, { onConflict: 'alias' }); }
  }

  async function llmSor(ilan: any) {
    setLlmYukleniyor(true);
    try {
      const res = await fetch('/api/llm-parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_text: ilan.raw_text, notes: ilan.notes }) });
      const data = await res.json();
      if (data.success) {
        setDuzenleData((prev: any) => ({ ...prev, listing_type: data.result.listing_type || prev.listing_type, origin_city: data.result.origin_city || prev.origin_city, origin_district: data.result.origin_district || '', contact_phone: data.result.contact_phone || prev.contact_phone || '', vehicle_type: data.result.vehicle_type || prev.vehicle_type, body_type: data.result.body_type || prev.body_type, stops: data.result.stops?.map((s: any) => ({ id: null, city: s.city || 'İstanbul', district: s.district || '', weight_ton: s.weight_ton || '', pallet_count: s.pallet_count || '', vehicle_count: 1, cargo_type: s.cargo_type || '', notes: '' })) || prev.stops }));
      } else { alert('❌ Hata: ' + data.error); }
    } catch (e: any) { alert('❌ Hata: ' + e.message); }
    setLlmYukleniyor(false);
  }

  async function cikisYap() { await supabase.auth.signOut(); router.push('/giris'); }

  function filtreTemizle() {
    setAramaMetni(''); setFiltreTelefon(''); setFiltreKalkis(''); setFiltreVaris('');
    setFiltreAracTipi(''); setFiltreSkor('hepsi'); setFiltreTonajMin(''); setFiltreTonajMax('');
    setFiltreTarihBaslangic(''); setFiltreTarihBitis('');
  }
  const aktifFiltre = aramaMetni || filtreTelefon || filtreKalkis || filtreVaris || filtreAracTipi || filtreSkor !== 'hepsi' || filtreTonajMin || filtreTonajMax || filtreTarihBaslangic || filtreTarihBitis;

  if (yetkiKontrol) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>⏳</div>
  );

  // ── Edit form (paylaşımlı)
  function EditForm({ rawForLlm }: { rawForLlm?: string }) {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>İlan Tipi</div><select value={duzenleData.listing_type} onChange={e => setDuzenleData({ ...duzenleData, listing_type: e.target.value })} style={inp}><option value="yuk">Yük</option><option value="arac">Araç</option></select></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Telefon</div><input value={duzenleData.contact_phone} onChange={e => setDuzenleData({ ...duzenleData, contact_phone: e.target.value })} style={inp} /></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İli</div><select value={duzenleData.origin_city} onChange={e => setDuzenleData({ ...duzenleData, origin_city: e.target.value })} style={inp}>{ILLER.map(il => <option key={il}>{il}</option>)}</select></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Kalkış İlçesi</div><input value={duzenleData.origin_district} onChange={e => setDuzenleData({ ...duzenleData, origin_district: e.target.value })} style={inp} placeholder="İlçe" /></div>
          <div><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Fiyat (TL)</div><input type="number" value={duzenleData.price_offer} onChange={e => setDuzenleData({ ...duzenleData, price_offer: e.target.value })} style={inp} placeholder="Opsiyonel" /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 4 }}>Araç Tipi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ARAC_TIPLERI.map(tip => { const s = (duzenleData.vehicle_type || [])[0] === tip; return <button key={tip} onClick={() => setDuzenleData({ ...duzenleData, vehicle_type: s ? [] : [tip] })} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid', borderColor: s ? '#22c55e' : '#374151', background: s ? '#14532d' : '#0d1117', color: s ? '#22c55e' : '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>{tip}</button>; })}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 4 }}>Üstyapı</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {UST_YAPI.map(tip => { const s = (duzenleData.body_type || []).includes(tip); return <button key={tip} onClick={() => { const m = duzenleData.body_type || []; setDuzenleData({ ...duzenleData, body_type: s ? m.filter((t: string) => t !== tip) : [...m, tip] }); }} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid', borderColor: s ? '#60a5fa' : '#374151', background: s ? '#1e3a5f' : '#0d1117', color: s ? '#60a5fa' : '#9ca3af', fontSize: '0.78rem', cursor: 'pointer' }}>{tip}</button>; })}
          </div>
        </div>
        {duzenleData.stops?.map((stop: any, idx: number) => (
          <div key={idx} style={{ background: '#0a0f1a', borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ color: '#f97316', fontSize: '0.68rem', fontWeight: 700 }}>Varış {idx + 1}</div>
              <button onClick={() => stopSil(idx)} style={{ background: '#450a0a', border: 'none', color: '#f87171', borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', cursor: 'pointer' }}>✕ Sil</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İl</div><select value={stop.city} onChange={e => stopGuncelle(idx, 'city', e.target.value)} style={inp}>{ILLER.map(il => <option key={il}>{il}</option>)}</select></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>İlçe</div><input value={stop.district} onChange={e => stopGuncelle(idx, 'district', e.target.value)} style={inp} placeholder="-" /></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Ton</div><input type="number" value={stop.weight_ton} onChange={e => stopGuncelle(idx, 'weight_ton', e.target.value)} style={inp} placeholder="-" /></div>
              <div><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Palet</div><input type="number" value={stop.pallet_count} onChange={e => stopGuncelle(idx, 'pallet_count', e.target.value)} style={inp} placeholder="-" /></div>
            </div>
            <div style={{ marginTop: 6 }}><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Yük Cinsi</div><input value={stop.cargo_type} onChange={e => stopGuncelle(idx, 'cargo_type', e.target.value)} style={inp} placeholder="Seramik, tekstil..." /></div>
            <div style={{ marginTop: 6 }}><div style={{ color: '#8b949e', fontSize: '0.65rem', marginBottom: 2 }}>Satır Notu</div><input value={stop.notes} onChange={e => stopGuncelle(idx, 'notes', e.target.value)} style={inp} placeholder="Varışa özel not..." /></div>
          </div>
        ))}
        <div style={{ marginBottom: 10 }}><div style={{ color: '#8b949e', fontSize: '0.68rem', marginBottom: 2 }}>Not</div><textarea value={duzenleData.notes} onChange={e => setDuzenleData({ ...duzenleData, notes: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Genel not" /></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={stopEkle} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #374151', background: '#0d1117', color: '#22c55e', fontSize: '0.78rem', cursor: 'pointer' }}>+ Varış Ekle</button>
          <button onClick={() => llmSor({ raw_text: rawForLlm || duzenleData.raw_text, notes: duzenleData.notes })} disabled={llmYukleniyor} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #374151', background: '#0d1117', color: '#a78bfa', fontSize: '0.78rem', cursor: 'pointer', opacity: llmYukleniyor ? 0.5 : 1 }}>{llmYukleniyor ? '⏳...' : '🤖 LLM\'e Sor'}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 24, height: 24 }} />
            <span style={{ fontWeight: 800, fontSize: '1rem' }}><span style={{ color: '#22c55e' }}>YÜKE</span><span style={{ color: '#e2e8f0' }}>GEL</span></span>
            <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>/ Moderatör</span>
          </div>
          <button onClick={cikisYap} style={{ background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer' }}>Çıkış</button>
        </div>
      </nav>

      {/* İSTATİSTİK BAR */}
      {istatistik && (
        <div style={{ background: '#0d1117', borderBottom: '1px solid #1f2937' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Bekleyen', val: istatistik.pending, color: '#fb923c' },
                { label: 'Bugün Gelen', val: istatistik.bugunGelen, color: '#60a5fa' },
                { label: 'Bugün Onaylanan', val: istatistik.bugunOnaylanan, color: '#22c55e' },
                { label: 'Çözümsüz', val: istatistik.cozumsuz, color: '#f87171' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: k.color, fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{k.val ?? '—'}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.68rem', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            {filtre === 'pending' && (
              <div style={{ display: 'flex', gap: 10, marginLeft: 8, borderLeft: '1px solid #1f2937', paddingLeft: 16, flexWrap: 'wrap' }}>
                {[
                  { key: 'yesil', emoji: '🟢', count: yesil,   label: 'Hazır',      bg: '#0d2b1a', border: '#166534', color: '#22c55e' },
                  { key: 'sari',  emoji: '🟡', count: sari,    label: 'Kontrol Et', bg: '#2a1d00', border: '#854d0e', color: '#fbbf24' },
                  { key: 'kirmizi', emoji: '🔴', count: kirmizi, label: 'Düzenleme', bg: '#2a0d0d', border: '#7f1d1d', color: '#f87171' },
                ].map(r => (
                  <button key={r.key} onClick={() => setFiltreSkor(filtreSkor === r.key ? 'hepsi' : r.key as any)}
                    style={{ background: filtreSkor === r.key ? r.bg : 'none', border: '1px solid', borderColor: filtreSkor === r.key ? r.border : '#1f2937', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', color: r.color, fontSize: '0.8rem', fontWeight: 600 }}>
                    {r.emoji} {r.count} {r.label}
                  </button>
                ))}
                {filtreSkor === 'yesil' && yesil > 0 && (
                  <button onClick={topluOnaylaYesil} style={{ background: '#14532d', border: '1px solid #166534', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#22c55e', fontSize: '0.8rem', fontWeight: 700 }}>⚡ Tümünü Onayla ({yesil})</button>
                )}
                {filtreSkor === 'sari' && sari > 0 && (
                  <button onClick={() => { if (confirm(`${sari} ilan reddedilecek. Emin misin?`)) topluReddet('🟡'); }}
                    style={{ background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>❌ Tümünü Reddet ({sari})</button>
                )}
                {filtreSkor === 'kirmizi' && kirmizi > 0 && (
                  <button onClick={() => { if (confirm(`${kirmizi} ilan reddedilecek. Emin misin?`)) topluReddet('🔴'); }}
                    style={{ background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 6, padding: '4px 14px', cursor: 'pointer', color: '#f87171', fontSize: '0.8rem', fontWeight: 700 }}>❌ Tümünü Reddet ({kirmizi})</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <WhatsappYukle />

      {/* FİLTRE ÇUBUĞU */}
      <div style={{ background: '#161b22', borderBottom: '1px solid #30363d', position: 'sticky', top: 52, zIndex: 40 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '8px 16px' }}>
          {/* Tab satırı */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            {/* YENİ: Master checkbox */}
            {filtre !== 'no_lane' && filtrelenmis.length > 0 && (
              <div
                onClick={masterToggle}
                title="Tümünü seç / seçimi kaldır"
                style={{
                  width: 18, height: 18, border: '2px solid', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                  borderColor: selectedIds.size > 0 ? '#3b82f6' : '#374151',
                  background: selectedIds.size > 0 && selectedIds.size === filtrelenmis.length ? '#3b82f6' : selectedIds.size > 0 ? '#1e3a5f' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {selectedIds.size > 0 && (
                  <span style={{ color: selectedIds.size === filtrelenmis.length ? '#fff' : '#60a5fa', fontSize: '0.65rem', fontWeight: 900 }}>
                    {selectedIds.size === filtrelenmis.length ? '✓' : '–'}
                  </span>
                )}
              </div>
            )}
            {(['pending', 'approved', 'rejected', 'passive', 'hepsi', 'no_lane', 'arsiv'] as const).map(f => (
              <button key={f} onClick={() => { setFiltre(f); setSonraBak(new Set()); filtreTemizle(); }}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid', borderColor: filtre === f ? (f === 'arsiv' ? '#854d0e' : '#22c55e') : '#30363d', background: filtre === f ? (f === 'arsiv' ? '#2a1d00' : '#14532d') : '#0d1117', color: filtre === f ? (f === 'arsiv' ? '#fbbf24' : '#22c55e') : '#8b949e', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                {f === 'pending' ? '⏳ Bekleyenler' : f === 'approved' ? '✅ Onaylananlar' : f === 'rejected' ? '❌ Reddedilenler' : f === 'passive' ? '💤 Pasifler' : f === 'no_lane' ? '🔍 Çözümsüz' : f === 'arsiv' ? '🗄️ Arşiv' : '📋 Hepsi'}
              </button>
            ))}
            {sonraBakSayisi > 0 && (
              <button onClick={() => setSonraBakGoster(!sonraBakGoster)}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #451a03', background: sonraBakGoster ? '#451a03' : '#0d1117', color: '#fb923c', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                ⏸ Sonraya ({sonraBakSayisi})
              </button>
            )}
            <span style={{ color: '#8b949e', fontSize: '0.75rem', marginLeft: 'auto' }}>
              {selectedIds.size > 0 && <span style={{ color: '#3b82f6', fontWeight: 700 }}>{selectedIds.size} seçili · </span>}
              {filtrelenmis.length} / {ilanlar.length} ilan
            </span>
          </div>
          {/* Filtre satırı */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '0.85rem' }}>
                {kullaniciAramaYukleniyor ? '⏳' : omnisearchTip(aramaMetni) ? '👤' : '🔍'}
              </span>
              <input
                value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
                placeholder="Ara: tel/email → kullanıcı; şehir, metin..."
                style={{ ...inp, paddingLeft: 28, borderRadius: 6, borderColor: omnisearchTip(aramaMetni) ? '#3b82f6' : '#374151' }}
              />
            </div>
            <input value={filtreTelefon} onChange={e => setFiltreTelefon(e.target.value)} placeholder="📞 Tel" style={{ ...inp, width: 110, borderRadius: 6 }} />
            <select value={filtreKalkis} onChange={e => setFiltreKalkis(e.target.value)} style={{ ...inp, width: 120, borderRadius: 6 }}>
              <option value=''>📍 Kalkış</option>{ILLER.map(il => <option key={il}>{il}</option>)}
            </select>
            <select value={filtreVaris} onChange={e => setFiltreVaris(e.target.value)} style={{ ...inp, width: 120, borderRadius: 6 }}>
              <option value=''>🏁 Varış</option>{ILLER.map(il => <option key={il}>{il}</option>)}
            </select>
            <select value={filtreAracTipi} onChange={e => setFiltreAracTipi(e.target.value)} style={{ ...inp, width: 110, borderRadius: 6 }}>
              <option value=''>🚛 Araç</option>{ARAC_TIPLERI.map(t => <option key={t}>{t}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input value={filtreTonajMin} onChange={e => setFiltreTonajMin(e.target.value)} placeholder="⚖Min" style={{ ...inp, width: 68, borderRadius: 6 }} type="number" min="0" />
              <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>–</span>
              <input value={filtreTonajMax} onChange={e => setFiltreTonajMax(e.target.value)} placeholder="Max t" style={{ ...inp, width: 68, borderRadius: 6 }} type="number" min="0" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="date" value={filtreTarihBaslangic} onChange={e => setFiltreTarihBaslangic(e.target.value)}
                title="Başlangıç tarihi"
                style={{ ...inp, width: 130, borderRadius: 6, colorScheme: 'dark' }}
              />
              <span style={{ color: '#4b5563', fontSize: '0.75rem' }}>–</span>
              <input
                type="date" value={filtreTarihBitis} onChange={e => setFiltreTarihBitis(e.target.value)}
                title="Bitiş tarihi"
                style={{ ...inp, width: 130, borderRadius: 6, colorScheme: 'dark' }}
              />
            </div>
            {aktifFiltre && (
              <button onClick={filtreTemizle} style={{ background: 'none', border: '1px solid #374151', color: '#6b7280', borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>✕ Temizle</button>
            )}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px', paddingBottom: selectedIds.size > 0 ? 100 : 16 }}>

        {/* YENİ: Omnisearch kullanıcı sonuçları */}
        {kullaniciBulguList.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#3b82f6', fontSize: '0.72rem', fontWeight: 700, marginBottom: 8, letterSpacing: '0.06em' }}>
              👤 KULLANICI SONUÇLARI ({kullaniciBulguList.length})
            </div>
            {kullaniciBulguList.map(k => (
              <KullaniciKart key={k.id} kullanici={k} onAskiya={kullaniciAskiyaAl} />
            ))}
            <div style={{ height: 1, background: '#1f2937', marginBottom: 16 }} />
          </div>
        )}

        {filtre === 'no_lane' ? (
          /* ── Çözümsüz tab */
          <div style={{ display: 'grid', gap: 10 }}>
            {noLaneListesi.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}><div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div><div>Çözümsüz mesaj yok</div></div>
            ) : noLaneListesi.map(raw => (
              <div key={raw.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ background: '#1f2937', color: '#9ca3af', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>🔍 Çözümsüz</span>
                  <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{raw.source_group} · {raw.sender_name}</span>
                  <span style={{ color: '#4b5563', fontSize: '0.68rem', marginLeft: 'auto', fontFamily: 'monospace' }}>#{raw.id.substring(0, 8)}</span>
                </div>
                <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937', marginBottom: 10 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', wordBreak: 'break-word' }}>{raw.raw_text}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    setDuzenleData({ listing_type: 'yuk', origin_city: 'İstanbul', origin_district: '', contact_phone: '', price_offer: '', notes: temizNotes(raw.raw_text), vehicle_type: [], body_type: [], raw_post_id: raw.id, raw_text: raw.raw_text, stops: [{ id: null, city: 'İstanbul', district: '', weight_ton: '', pallet_count: '', vehicle_count: 1, cargo_type: '', notes: '' }] });
                    setDuzenleId('no_lane_' + raw.id);
                  }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #1e3a5f', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>✏️ Manuel Gir</button>
                  <button onClick={async () => { await supabase.from('raw_posts').update({ processing_status: 'rejected' }).eq('id', raw.id); setNoLaneListesi(prev => prev.filter(r => r.id !== raw.id)); }}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>❌ Reddet</button>
                </div>
                {duzenleId === 'no_lane_' + raw.id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #1f2937', paddingTop: 12 }}>
                    <EditForm rawForLlm={raw.raw_text} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={async () => {
                        const { data: listing } = await supabase.from('listings').insert({ listing_type: duzenleData.listing_type, origin_city: duzenleData.origin_city, origin_district: duzenleData.origin_district || null, contact_phone: duzenleData.contact_phone || null, source: raw.source || 'whatsapp', moderation_status: 'approved', status: 'active', trust_level: 'social', raw_post_id: raw.id, raw_text: raw.raw_text, notes: duzenleData.notes, vehicle_type: duzenleData.vehicle_type, body_type: duzenleData.body_type, reviewed_at: new Date().toISOString() }).select().single();
                        if (listing) {
                          for (let i = 0; i < duzenleData.stops.length; i++) {
                            const s = duzenleData.stops[i];
                            await supabase.from('listing_stops').insert({ listing_id: listing.id, stop_order: i + 1, city: s.city, district: s.district || null, weight_ton: s.weight_ton || null, pallet_count: s.pallet_count || null, vehicle_count: s.vehicle_count || 1, cargo_type: s.cargo_type || null });
                          }
                          await supabase.from('raw_posts').update({ processing_status: 'processed' }).eq('id', raw.id);
                          await aliasOgren(duzenleData);
                          setDuzenleId('');
                          setNoLaneListesi(prev => prev.filter(r => r.id !== raw.id));
                          getIstatistik();
                        }
                      }} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>✅ Kaydet ve Onayla</button>
                      <button onClick={() => setDuzenleId('')} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>✕ İptal</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : yukleniyor ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>⏳ Yükleniyor...</div>
        ) : filtrelenmis.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
            <div>Filtrelerle eşleşen ilan bulunamadı</div>
            {sonraBakSayisi > 0 && <button onClick={() => setSonraBakGoster(true)} style={{ marginTop: 16, background: 'none', border: '1px solid #451a03', color: '#fb923c', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: '0.85rem' }}>⏸ Sonraya bırakılanları göster ({sonraBakSayisi})</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtrelenmis.map((ilan, idx) => {
              const durum = DURUM_RENK[ilan.moderation_status] || DURUM_RENK.passive;
              const isYuk = ilan.listing_type === 'yuk';
              const durumIslem = islem === ilan.id;
              const duzenleniyor = duzenleId === ilan.id;
              const stops = (ilan.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);
              const hasSosyal = (ilan.source === 'whatsapp' || ilan.source === 'facebook') && ilan.raw_text;
              const skor = skorRenk(ilan);
              const secili = selectedIds.has(ilan.id);

              return (
                <div key={ilan.id} ref={el => { ilanRefs.current[ilan.id] = el; }}
                  style={{ background: '#161b22', border: `1px solid ${duzenleniyor ? '#22c55e' : secili ? '#3b82f6' : skor.border}`, borderRadius: 8, padding: '14px 16px', scrollMarginTop: 130 }}>

                  {/* Başlık */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* YENİ: Checkbox */}
                    <div
                      onClick={(e) => handleCheckbox(ilan.id, idx, e)}
                      title="Seç (Shift+Click: aralık seç)"
                      style={{
                        width: 18, height: 18, border: '2px solid', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                        borderColor: secili ? '#3b82f6' : '#374151',
                        background: secili ? '#3b82f6' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {secili && <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
                    </div>

                    <span style={{ fontSize: '1rem' }} title={`${skor.label} (${skor.puan})`}>{skor.badge}</span>
                    <span style={{ background: '#1f2937', color: '#9ca3af', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>{skor.label}</span>
                    <span style={{ background: isYuk ? '#7f1d1d' : '#14532d', color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{isYuk ? '🔴 YÜK' : '🟢 ARAÇ'}</span>
                    <span style={{ background: durum.bg, color: durum.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{ilan.moderation_status}</span>
                    <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>{ilan.source} · {new Date(ilan.created_at).toLocaleDateString('tr-TR')} {new Date(ilan.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {/* kullanıcı rozeti: listings.user_id FK tanımlı değil, şimdilik gizli */}
                    <span style={{ color: '#4b5563', fontSize: '0.68rem', marginLeft: 'auto', fontFamily: 'monospace' }}>#{ilan.id.substring(0, 8)}</span>
                  </div>

                  {/* İçerik */}
                  <div style={{ display: 'grid', gridTemplateColumns: hasSosyal ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 12 }}>
                    {hasSosyal && (
                      <div style={{ background: '#0d1117', borderRadius: 6, padding: 12, border: '1px solid #1f2937', overflow: 'hidden' }}>
                        <div style={{ color: '#8b949e', fontSize: '0.68rem', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{ilan.source === 'whatsapp' ? '📱 WHATSAPP' : '👥 FACEBOOK'}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-word' }}>{ilan.raw_text}</div>
                      </div>
                    )}
                    <div>
                      {duzenleniyor ? (
                        <EditForm />
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
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600 }}>📞 {ilan.contact_phone || '—'}</span>
                            {(ilan.vehicle_type || []).map((v: string) => <span key={v} style={{ background: '#1a2535', color: '#60a5fa', fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4 }}>🚛 {v}</span>)}
                            {(ilan.body_type || []).map((b: string) => <span key={b} style={{ background: '#1f2937', color: '#94a3b8', fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4 }}>{b}</span>)}
                            {ilan.price_offer && <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>₺{ilan.price_offer}</span>}
                            {ilan.notes && <span style={{ color: '#8b949e', fontSize: '0.78rem' }}>📝 {ilan.notes.substring(0, 80)}{ilan.notes.length > 80 ? '...' : ''}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #1f2937', paddingTop: 12 }}>
                    {duzenleniyor ? (
                      <>
                        <button onClick={() => duzenleKaydet(ilan.id, 'onayla')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>✅ Kaydet ve Onayla</button>
                        <button onClick={() => duzenleKaydet(ilan.id, 'sadece_kaydet')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>💾 Sadece Kaydet</button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>⏸ Sonra</button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                        <button onClick={() => setDuzenleId('')} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>✕ İptal</button>
                      </>
                    ) : filtre === 'arsiv' ? (
                      <>
                        <button onClick={() => arsivIslem(ilan.id, true)} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>↩ Bekleyenlere Al</button>
                        <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                      </>
                    ) : (
                      <>
                        {ilan.moderation_status !== 'approved' && (
                          <button onClick={() => aksiyon(ilan.id, 'approved', 'active')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>✅ Onayla</button>
                        )}
                        <button onClick={() => duzenleAc(ilan)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #1e3a5f', cursor: 'pointer', background: '#1e3a5f', color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem' }}>✏️ Düzenle</button>
                        <button onClick={() => sonraBakEkleVeGec(ilan.id)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#0d1117', color: '#fb923c', fontWeight: 700, fontSize: '0.85rem' }}>⏸ Sonra</button>
                        <button onClick={() => arsivIslem(ilan.id)} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #854d0e', cursor: 'pointer', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', opacity: durumIslem ? 0.5 : 1 }}>🗄️ Arşivle</button>
                        {ilan.moderation_status !== 'passive' && ilan.status !== 'passive' && (
                          <button onClick={() => aksiyon(ilan.id, 'passive', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #374151', cursor: 'pointer', background: '#1f2937', color: '#9ca3af', fontWeight: 700, fontSize: '0.85rem' }}>💤 Pasif</button>
                        )}
                        {ilan.moderation_status !== 'rejected' && (
                          <button onClick={() => aksiyon(ilan.id, 'rejected', 'passive')} disabled={durumIslem} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem' }}>❌ Reddet</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Yüzen Toplu İşlem Barı */}
      {selectedIds.size > 0 && (() => {
        const seciliIlanlar = filtrelenmis.filter(i => selectedIds.has(i.id));
        const tumunuOnayli  = seciliIlanlar.every(i => i.moderation_status === 'approved');
        const tumunuReddi   = seciliIlanlar.every(i => i.moderation_status === 'rejected');
        const arsivTabinda  = filtre === 'arsiv';
        return (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#161b22', border: '1px solid #3b82f6', borderRadius: 14,
            padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)', zIndex: 100, whiteSpace: 'nowrap',
          }}>
            <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem', marginRight: 4 }}>
              ☑ {selectedIds.size} seçili
            </span>
            {!arsivTabinda && !tumunuOnayli && (
              <button onClick={() => topluIslem('approve')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#14532d', color: '#22c55e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ✅ Toplu Onayla
              </button>
            )}
            {arsivTabinda && (
              <button onClick={async () => {
                if (!confirm(`${selectedIds.size} ilan bekleyenlere alınacak. Devam et?`)) return;
                setBulkYukleniyor(true);
                try { await topluApi(Array.from(selectedIds), 'unarchive'); setSelectedIds(new Set()); }
                catch (e: any) { alert('Hata: ' + e.message); }
                setBulkYukleniyor(false); getIlanlar(); getIstatistik();
              }} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #374151', background: '#1f2937', color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ↩ Bekleyenlere Al
              </button>
            )}
            {!arsivTabinda && (
              <button onClick={() => topluIslem('archive')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #854d0e', background: '#2a1d00', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                🗄️ Arşivle
              </button>
            )}
            {!tumunuReddi && (
              <button onClick={() => topluIslem('delete')} disabled={bulkYukleniyor}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#450a0a', color: '#f87171', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: bulkYukleniyor ? 0.5 : 1 }}>
                ❌ Reddet
              </button>
            )}
            <button onClick={() => { setSelectedIds(new Set()); setLastClickedIdx(null); }}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #374151', background: 'none', color: '#6b7280', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
              ✕
            </button>
            {bulkYukleniyor && <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>⏳ İşleniyor...</span>}
          </div>
        );
      })()}
    </div>
  );
}
