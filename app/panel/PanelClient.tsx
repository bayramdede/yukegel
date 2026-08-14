'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../lib/supabase';
import { ilAdi } from '../../lib/lokasyon';
import AnlasmalarSekmesi from './AnlasmalarSekmesi';
// 🚨 `C`/`inp`/`lbl`/`btn` BURADA TANIMLANMIYOR — `panelStil.ts`'ten geliyor.
// SAKIN buraya geri taşıma: `AnlasmalarSekmesi.tsx` da bunları kullanıyor;
// bu dosyadan tanımlayıp export edersen ve o da bunu import ederse dairesel
// import + "Cannot access 'C' before initialization" çökmesi GERİ GELİR
// (bkz. `panelStil.ts` başındaki not — canlıda tarayıcıda doğrulanmış hata).
import { C, inp, lbl, btn } from './panelStil';

const supabase = createClient();

const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];

type Tab = 'ilanlarim' | 'araclarim' | 'anlasmalarim' | 'profilim';

interface Props {
  userId: string;
  userEmail: string | null;
  profil: any;
  ilanlar: any[];
  araclar: any[];
  anlasmalar: any[];
  yorumlarim: any[];
}

export default function PanelClient({ userId, userEmail, profil, ilanlar, araclar, anlasmalar, yorumlarim }: Props) {
  const [sekme, setSekme] = useState<Tab>('ilanlarim');
  const isNakliyeci = profil?.user_type === 'arac_sahibi';

  // 31 Tem 2026 — `?sekme=profilim` ile derin bağlantı.
  //
  // NEDEN: `/ilan-ver` telefonu olmayan kullanıcıyı `/profil-tamamla`'ya yolluyordu,
  // ama orası `user_type` doluysa formu HİÇ göstermeden `/panel`'e geri atıyor
  // (profil-tamamla/page.tsx:120). Yani telefon eklemenin tek gerçek yeri olan bu
  // sekmeye giden bağlantı kapalı bir döngüydü. Sekme sadece local state olduğu için
  // dışarıdan hedeflenemiyordu; artık URL'den seçilebiliyor.
  //
  // `useSearchParams` yerine `window.location` bilinçli — bkz. ilan-ver/page.tsx:122:
  // bu ağaç Suspense sınırı içinde değil, eklemek tümünü CSR bailout'a sokardı.
  useEffect(() => {
    const gelen = new URLSearchParams(window.location.search).get('sekme');
    // Beyaz liste: URL'den gelen ham değer state'e yazılmaz.
    if (gelen === 'ilanlarim' || gelen === 'araclarim' || gelen === 'anlasmalarim' || gelen === 'profilim') setSekme(gelen);
  }, []);

  const aktifIlan = ilanlar.filter(i =>
    !i.completed_at && i.status === 'active' &&
    ['approved', 'auto_published'].includes(i.moderation_status)
  ).length;

  const aktifAnlasma = anlasmalar.filter(d => !['completed', 'cancelled'].includes(d.status)).length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* 14 Ağu 2026 — mobil uyum: header/tab bar dar ekranda sıkışıyordu.
          `panel-tabs` mobilde yatay kaydırmaya geçiyor (wrap yerine — 4 sekme
          alt alta kırılırsa görünüm dağılır), padding'ler daralıyor. */}
      <style>{`
        @media (max-width: 640px) {
          .panel-nav-inner { padding: 0 14px !important; }
          .panel-container { padding: 14px !important; }
          .panel-tabs { width: 100% !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .panel-tabs::-webkit-scrollbar { display: none; }
          .panel-tab-btn { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
      {/* ── Header ── */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="panel-nav-inner" style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: C.green }}>YÜKE</span><span style={{ color: C.text }}>GEL</span>
            </span>
          </a>
          {/* SPRINT_01 C1 — çıkış artık POST. Link olarak bırakılırsa prefetch veya
              dış sitedeki <img src="/cikis"> kullanıcıyı istemsiz çıkış yaptırıyordu. */}
          <form method="post" action="/cikis" style={{ margin: 0 }}>
            <button type="submit" style={{ background: 'none', border: 'none', padding: 0, color: C.dim, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Çıkış
            </button>
          </form>
        </div>
      </nav>

      <div className="panel-container" style={{ maxWidth: 1024, margin: '0 auto', padding: '24px' }}>
        {/* ── Karşılama + Nakliyeci CTA ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: C.text, fontWeight: 800, fontSize: '1.4rem', margin: 0, marginBottom: 4 }}>
              Merhaba, {profil?.display_name || userEmail || 'Kullanıcı'} 👋
            </h1>
            <div style={{ color: C.muted, fontSize: '0.85rem' }}>
              {aktifIlan} aktif ilan · {araclar.length} araç
            </div>
          </div>
          {isNakliyeci && araclar.length > 0 && (
            <a
              href={araclar.length === 1
                ? `/ilan-ver?tip=arac&arac_id=${araclar[0].id}`
                : `/ilan-ver?tip=arac`}
              style={{ ...btn('amber'), textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}>
              🚛 Aracım Boşta
            </a>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div className="panel-tabs" style={{ display: 'flex', gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {([
            { id: 'ilanlarim', label: '📋 İlanlarım', count: ilanlar.length },
            { id: 'araclarim', label: '🚛 Araçlarım', count: araclar.length },
            { id: 'anlasmalarim', label: '🤝 Anlaşmalarım', count: aktifAnlasma },
            { id: 'profilim', label: '👤 Profilim' },
          ] as { id: Tab; label: string; count?: number }[]).map(t => (
            <button key={t.id} className="panel-tab-btn" onClick={() => setSekme(t.id)}
              style={{ padding: '7px 20px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: sekme === t.id ? 700 : 500, fontSize: '0.85rem', background: sekme === t.id ? C.green : 'none', color: sekme === t.id ? '#000' : C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.label}
              {t.count !== undefined && (
                <span style={{ background: sekme === t.id ? C.greenBg : C.border, color: sekme === t.id ? C.green : C.dim, fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {sekme === 'ilanlarim' && <IlanlarSekmesi ilanlar={ilanlar} userId={userId} anlasmalar={anlasmalar} />}
        {sekme === 'araclarim' && <AraclarSekmesi araclar={araclar} userId={userId} />}
        {sekme === 'anlasmalarim' && <AnlasmalarSekmesi anlasmalar={anlasmalar} yorumlarim={yorumlarim} userId={userId} />}
        {sekme === 'profilim' && <ProfilSekmesi profil={profil} userEmail={userEmail} userId={userId} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// İLANLAR SEKMESİ
// ═══════════════════════════════════════════════════════════════════
type StatusFiltre = 'hepsi' | 'active' | 'in_progress' | 'passive' | 'completed' | 'pending' | 'rejected' | 'correction_needed';

function IlanlarSekmesi({ ilanlar: ilk, userId, anlasmalar }: { ilanlar: any[]; userId: string; anlasmalar: any[] }) {
  const [ilanlar, setIlanlar] = useState(ilk);
  const [yukleniyor, setYukleniyor] = useState<string | null>(null);
  const [silOnay, setSilOnay] = useState<string | null>(null);
  // 14 Ağu 2026 — varsayılan "Aktif (Plaka Aranmadı)"; kullanıcı panele girince
  // önce iş bekleyen ilanlarını görsün, "Tümü" ile karışık liste değil.
  const [statusFiltre, setStatusFiltre] = useState<StatusFiltre>('active');
  const [kopyalandi, setKopyalandi] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

  // Aktif seferi olan ilanlar (matched / in_transit) — "Sefer Ekle" butonunu gizlemek için.
  const mesgulIlanlar = useMemo(() =>
    new Set(anlasmalar.filter(d => ['matched', 'in_transit'].includes(d.status)).map((d: any) => d.listing_id)),
  [anlasmalar]);

  // Harici sefer ekleme formu
  const [seferEkleId, setSeferEkleId] = useState<string | null>(null);
  const [seferNakliyeAd, setSeferNakliyeAd] = useState('');
  const [seferNakliyeTel, setSeferNakliyeTel] = useState('');
  const [seferPlaka, setSeferPlaka] = useState('');
  const [seferSofor, setSeferSofor] = useState('');
  const [seferFiyat, setSeferFiyat] = useState('');
  const [seferNot, setSeferNot] = useState('');
  const [seferYukleniyor, setSeferYukleniyor] = useState(false);
  const [seferSonuc, setSeferSonuc] = useState<{ ok: boolean; mesaj: string } | null>(null);
  const [kayitliAraclar, setKayitliAraclar] = useState<{ plate: string; driver_name: string | null }[]>([]);

  function seferAc(ilanId: string) {
    setSeferEkleId(ilanId);
    setSeferNakliyeAd(''); setSeferNakliyeTel(''); setSeferPlaka(''); setSeferSofor('');
    setSeferFiyat(''); setSeferNot(''); setSeferSonuc(null);
    // Kayıtlı araçları çek
    supabase.from('carrier_vehicles').select('plate, driver_name').order('last_used_at', { ascending: false }).limit(10)
      .then((r: any) => setKayitliAraclar(r.data || []));
  }

  async function seferKaydet(ilanId: string, ilanFiyat: number | null) {
    const fiyatSayi = Number(seferFiyat.replace(/\./g, '').replace(',', '.'));
    const fiyatGonderilecek = Number.isFinite(fiyatSayi) && fiyatSayi > 0 ? fiyatSayi : ilanFiyat;
    if (!seferNakliyeAd.trim() && !seferPlaka.trim()) {
      setSeferSonuc({ ok: false, mesaj: 'Nakliyeci adı veya plaka girin.' });
      return;
    }
    setSeferYukleniyor(true); setSeferSonuc(null);
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_id: ilanId,
        agreed_price: fiyatGonderilecek,
        note: seferNot.trim() || undefined,
        external_carrier_name: seferNakliyeAd.trim() || undefined,
        external_carrier_phone: seferNakliyeTel.trim() || undefined,
        vehicle_plate: seferPlaka.trim() || undefined,
        driver_name: seferSofor.trim() || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setSeferSonuc({ ok: true, mesaj: 'Sefer oluşturuldu! Anlaşmalarım sekmesinden takip edebilirsiniz.' });
      ilanGuncelle(ilanId, { status: 'passive' });
    } else {
      setSeferSonuc({ ok: false, mesaj: d.error || 'Sefer oluşturulamadı.' });
    }
    setSeferYukleniyor(false);
  }

  // Düzeltme/düzenleme formu state'leri
  // 8 Ağu 2026 — bu form eskiden YALNIZ `correction_needed` ilanlar için açılıyordu.
  // Artık kullanıcı kendi ilanını (yayındakiler dâhil) düzenleyebiliyor; fiyat ve
  // tarih alanları da eklendi.
  const [duzeltId, setDuzeltId] = useState('');
  const [duzeltNotes, setDuzeltNotes] = useState('');
  const [duzeltVehicle, setDuzeltVehicle] = useState<string[]>([]);
  const [duzeltBody, setDuzeltBody] = useState<string[]>([]);
  const [duzeltFiyat, setDuzeltFiyat] = useState('');
  const [duzeltPazarlik, setDuzeltPazarlik] = useState(false);
  const [duzeltTarih, setDuzeltTarih] = useState('');
  const [duzeltTarihEsnek, setDuzeltTarihEsnek] = useState(false);
  const [duzeltYukleniyor, setDuzeltYukleniyor] = useState(false);
  const [duzeltSonuc, setDuzeltSonuc] = useState<{ ok: boolean; mesaj: string; firedRules?: any[] } | null>(null);

  /** Formu bir ilanın MEVCUT değerleriyle doldurup açar. */
  function duzeltAc(ilan: any) {
    setDuzeltId(ilan.id);
    setDuzeltNotes(ilan.notes || '');
    setDuzeltVehicle(ilan.vehicle_type || []);
    setDuzeltBody(ilan.body_type || []);
    setDuzeltFiyat(ilan.price_offer == null ? '' : String(ilan.price_offer));
    setDuzeltPazarlik(ilan.price_negotiable === true);
    setDuzeltTarih(ilan.available_date || '');
    setDuzeltTarihEsnek(ilan.date_flexible === true);
    setDuzeltSonuc(null);
  }

  // Arama/filtre state'leri
  const [aramaKalkis, setAramaKalkis] = useState('');
  const [aramaVaris, setAramaVaris] = useState('');
  const [aramaAracTipi, setAramaAracTipi] = useState('');
  const [aramaTarihten, setAramaTarihten] = useState('');
  const [aramaTarihe, setAramaTarihe] = useState('');
  const [filtrePanelAcik, setFiltrePanelAcik] = useState(false);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/u/${userId}`);
  }, [userId]);

  function linkKopyala() {
    navigator.clipboard.writeText(publicUrl);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2000);
  }

  function ilanGuncelle(id: string, patch: any) {
    setIlanlar(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  async function pasifYap(id: string) {
    setYukleniyor(id + '_pasif');
    await supabase.from('listings').update({ status: 'passive' }).eq('id', id);
    ilanGuncelle(id, { status: 'passive' });
    setYukleniyor(null);
  }

  async function aktifYap(id: string) {
    setYukleniyor(id + '_aktif');
    await supabase.from('listings').update({ status: 'active' }).eq('id', id);
    ilanGuncelle(id, { status: 'active' });
    setYukleniyor(null);
  }

  async function sil(id: string) {
    setYukleniyor(id + '_sil');
    const res = await fetch('/api/ilan/sil', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setIlanlar(prev => prev.filter(i => i.id !== id));
    } else {
      const d = await res.json();
      alert('Silinemedi: ' + (d.error || 'Bilinmeyen hata'));
    }
    setSilOnay(null);
    setYukleniyor(null);
  }

  async function tamamlandiToggle(ilan: any) {
    const val = ilan.completed_at ? null : new Date().toISOString();
    await supabase.from('listings').update({ completed_at: val }).eq('id', ilan.id);
    ilanGuncelle(ilan.id, { completed_at: val });
  }

  // Durum hesapla
  function durumHesapla(i: any): string {
    if (i.completed_at) return 'completed';
    if (i.moderation_status === 'pending') return 'pending';
    if (i.moderation_status === 'rejected') return 'rejected';
    if (i.moderation_status === 'correction_needed') return 'correction_needed';
    return i.status;
  }

  // 14 Ağu 2026 — "Pasif" tek durum altında iki farklı şeyi karıştırıyordu:
  // kullanıcının bilinçli kapattığı ilan ile plaka atanıp (`seferKaydet`/`onayla`
  // sonrası `status='passive'`) süreci devam eden ilan aynı görünüyordu.
  // `mesgulIlanlar` (matched/in_transit anlaşması olan ilan id'leri) zaten
  // "Sefer Ekle" butonunu gizlemek için hesaplanıyordu — aynı set burada da
  // ayrım için kullanılıyor. Yalnız GÖRÜNÜM/filtre katmanı; `listings.status`
  // DB'de hâlâ 'passive' — durumHesapla() değişmiyor.
  function durumGenislet(durum: string, ilanId: string, mesgul: Set<string>): string {
    return durum === 'passive' && mesgul.has(ilanId) ? 'in_progress' : durum;
  }

  const sayilar: Record<StatusFiltre, number> = useMemo(() => ({
    hepsi: ilanlar.length,
    active: ilanlar.filter(i => durumGenislet(durumHesapla(i), i.id, mesgulIlanlar) === 'active').length,
    in_progress: ilanlar.filter(i => durumGenislet(durumHesapla(i), i.id, mesgulIlanlar) === 'in_progress').length,
    passive: ilanlar.filter(i => durumGenislet(durumHesapla(i), i.id, mesgulIlanlar) === 'passive').length,
    completed: ilanlar.filter(i => durumHesapla(i) === 'completed').length,
    pending: ilanlar.filter(i => durumHesapla(i) === 'pending').length,
    rejected: ilanlar.filter(i => durumHesapla(i) === 'rejected').length,
    correction_needed: ilanlar.filter(i => durumHesapla(i) === 'correction_needed').length,
  }), [ilanlar, mesgulIlanlar]);

  const filtreli = useMemo(() => {
    return ilanlar.filter(i => {
      const durum = durumGenislet(durumHesapla(i), i.id, mesgulIlanlar);
      if (statusFiltre !== 'hepsi' && durum !== statusFiltre) return false;

      const stops = (i.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);

      // Dalga 5: arama kutusu SERBEST METİN (dropdown değil), o yüzden filtre
      // id ile değil, id'den türeyen İL ADIYLA eşleşiyor — kullanıcı "ista"
      // yazıp "İstanbul"u bulabilsin diye `includes` davranışı korunuyor.
      // Doğrudan `il_id === ...` karşılaştırması bu kısmi eşleşmeyi öldürürdü.
      if (aramaKalkis && !ilAdi(i.origin_province_id)?.toLowerCase().includes(aramaKalkis.toLowerCase())) return false;
      if (aramaVaris && !stops.some((s: any) => ilAdi(s.province_id)?.toLowerCase().includes(aramaVaris.toLowerCase()))) return false;
      if (aramaAracTipi && !(i.vehicle_type || []).includes(aramaAracTipi)) return false;
      if (aramaTarihten && i.available_date && i.available_date < aramaTarihten) return false;
      if (aramaTarihe && i.available_date && i.available_date > aramaTarihe) return false;

      return true;
    });
  }, [ilanlar, statusFiltre, aramaKalkis, aramaVaris, aramaAracTipi, aramaTarihten, aramaTarihe, mesgulIlanlar]);

  const aktifFiltreSayisi = [aramaKalkis, aramaVaris, aramaAracTipi, aramaTarihten, aramaTarihe].filter(Boolean).length;

  function filtreTemizle() {
    setAramaKalkis(''); setAramaVaris(''); setAramaAracTipi('');
    setAramaTarihten(''); setAramaTarihe('');
  }

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '12px', borderBottom: `1px solid #21262d`, verticalAlign: 'middle', fontSize: '0.85rem' };

  const statusSirasi: StatusFiltre[] = ['hepsi', 'correction_needed', 'active', 'in_progress', 'pending', 'passive', 'completed', 'rejected'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 14 Ağu 2026 — mobil uyum: klasik <table> dar ekranda okunmuyordu.
          `ilan-tablo` altında `thead` gizlenip her `<td>` `data-label` ile
          kart satırına dönüşüyor (klasik "responsive table" deseni — yapı
          DEĞİŞMİYOR, yalnız CSS; masaüstünde hiçbir fark yok). */}
      <style>{`
        @media (max-width: 680px) {
          .ilan-tablo thead { display: none; }
          .ilan-tablo, .ilan-tablo tbody, .ilan-tablo tr { display: block; width: 100%; }
          .ilan-tablo tr { border: 1px solid ${C.border}; border-radius: 10px; margin-bottom: 12px; }
          .ilan-tablo td { display: block; border-bottom: none !important; padding: 8px 12px; }
          .ilan-tablo td[data-label] { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
          .ilan-tablo td[data-label]::before { content: attr(data-label); color: ${C.muted}; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0; padding-top: 2px; }
          .ilan-tablo td[data-label="İşlemler"] { flex-direction: column; align-items: stretch; }
          .ilan-tablo td[data-label="İşlemler"]::before { display: none; }
        }
      `}</style>

      {/* ── Paylaşım Bandı ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.greenBg}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>📤 İlan listeni paylaş</div>
          <div style={{ color: C.dim, fontSize: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' as const }}>{publicUrl || `yukegel.com/u/${userId}`}</div>
        </div>
        <button onClick={linkKopyala}
          style={{ background: kopyalandi ? C.greenBg : C.green, color: '#000', fontWeight: 700, fontSize: '0.82rem', padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
          {kopyalandi ? '✓ Kopyalandı!' : '🔗 Linki Kopyala'}
        </button>
      </div>

      {/* ── Üst Bar: Status Filtresi + Butonlar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {/* Status butonları */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {statusSirasi.filter(s => s === 'hepsi' || sayilar[s] > 0).map(s => (
            <button key={s} onClick={() => setStatusFiltre(s)}
              style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${statusFiltre === s ? durumRenk(s).color : C.border}`, background: statusFiltre === s ? durumRenk(s).bg : 'none', color: statusFiltre === s ? durumRenk(s).color : C.muted, fontSize: '0.78rem', fontWeight: statusFiltre === s ? 700 : 400, cursor: 'pointer' }}>
              {durumLabel(s)} <span style={{ opacity: 0.65 }}>{sayilar[s]}</span>
            </button>
          ))}
        </div>
        {/* Sağ butonlar */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFiltrePanelAcik(p => !p)}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${aktifFiltreSayisi > 0 ? C.amber : C.border}`, background: aktifFiltreSayisi > 0 ? C.amberBg : 'none', color: aktifFiltreSayisi > 0 ? C.amber : C.muted, fontSize: '0.82rem', cursor: 'pointer', fontWeight: aktifFiltreSayisi > 0 ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔍 Filtrele {aktifFiltreSayisi > 0 && <span style={{ background: C.amber, color: '#000', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{aktifFiltreSayisi}</span>}
          </button>
          <a href="/ilan-ver" style={{ ...btn('primary'), textDecoration: 'none', padding: '6px 14px', fontSize: '0.82rem' }}>
            + İlan Ver
          </a>
        </div>
      </div>

      {/* ── Filtre Paneli ── */}
      {filtrePanelAcik && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <label style={lbl}>Çıkış Şehri</label>
              <input value={aramaKalkis} onChange={e => setAramaKalkis(e.target.value)} placeholder="İstanbul..." style={inp} />
            </div>
            <div>
              <label style={lbl}>Varış Şehri</label>
              <input value={aramaVaris} onChange={e => setAramaVaris(e.target.value)} placeholder="Ankara..." style={inp} />
            </div>
            <div>
              <label style={lbl}>Araç Tipi</label>
              <select value={aramaAracTipi} onChange={e => setAramaAracTipi(e.target.value)}
                style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Tümü</option>
                {ARAC_TIPLERI.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tarih (başlangıç)</label>
              <input type="date" value={aramaTarihten} onChange={e => setAramaTarihten(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tarih (bitiş)</label>
              <input type="date" value={aramaTarihe} onChange={e => setAramaTarihe(e.target.value)} style={inp} />
            </div>
          </div>
          {aktifFiltreSayisi > 0 && (
            <button onClick={filtreTemizle}
              style={{ alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: '0.78rem', cursor: 'pointer' }}>
              × Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {/* ── Tablo ── */}
      {filtreli.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 40, textAlign: 'center', color: C.dim }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
          <div style={{ marginBottom: 12 }}>İlan bulunamadı.</div>
          <a href="/ilan-ver" style={{ ...btn('primary'), textDecoration: 'none', display: 'inline-block' }}>+ İlk İlanını Ver</a>
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ilan-tablo" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Başlık</th>
                  <th style={th}>Fiyat</th>
                  <th style={th}>Konum</th>
                  <th style={th}>Araç Tipi</th>
                  <th style={th}>Tarih</th>
                  <th style={th}>Durum</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>İşlemler</th>
                  {/* 14 Ağu 2026 — kolon eklendi (Araç Tipi = kasa tipi); aşağıdaki
                      `colSpan={6}` form satırları `colSpan={7}`e çıkarıldı, atlanmasın. */}
                </tr>
              </thead>
              <tbody>
                {filtreli.map(ilan => {
                  const stops = [...(ilan.listing_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
                  const sonDurak = stops[stops.length - 1];
                  const kalkisAd = ilAdi(ilan.origin_province_id) ?? '';
                  const baslik = `${kalkisAd}${sonDurak ? ` → ${ilAdi(sonDurak.province_id) ?? ''}` : ''}`;
                  const isYuk = ilan.listing_type === 'yuk';
                  const durum = durumGenislet(durumHesapla(ilan), ilan.id, mesgulIlanlar);
                  const tamamlandi = durum === 'completed';
                  const isAktif = durum === 'active';
                  const isPending = durum === 'pending';
                  const isRejected = durum === 'rejected';
                  const isEditable = !isPending && !isRejected;
                  // ⚠️ SUNUCUNUN İZİN LİSTESİNİN AYNASI (`api/ilan/duzelt`
                  //    ::DUZENLENEBILIR_MODERASYON). Burada göstermek yetki
                  //    VERMEZ — sunucu her istekte sahiplik + durum kontrolü
                  //    yapıyor; bu yalnız kullanıcıya boşa buton göstermemek için.
                  //    İkisi ayrışırsa buton çıkar ama kaydetme 400 döner.
                  const duzenlenebilir = !tamamlandi && !isRejected && durum !== 'archived';

                  return (
                    <React.Fragment key={ilan.id}>
                    <tr style={{ opacity: ['passive', 'rejected', 'correction_needed'].includes(durum) ? 0.75 : 1, background: durum === 'correction_needed' ? '#12100a' : undefined }}>
                      <td style={td} data-label="Başlık">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ background: isYuk ? C.redBg : C.greenBg, color: isYuk ? '#fca5a5' : '#86efac', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>
                            {isYuk ? 'YÜK' : 'ARAÇ'}
                          </span>
                          <span style={{ color: C.text, fontWeight: 600 }}>{baslik}</span>
                        </div>
                        <div style={{ color: C.dim, fontSize: '0.72rem', marginTop: 3 }}>
                          #{ilan.id.slice(0, 8)} · {new Date(ilan.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </div>
                      </td>
                      <td style={td} data-label="Fiyat">
                        {ilan.price_offer
                          ? <span style={{ color: C.green, fontWeight: 700 }}>₺{Number(ilan.price_offer).toLocaleString('tr-TR')}</span>
                          : <span style={{ color: C.dim }}>—</span>}
                      </td>
                      <td style={td} data-label="Konum">
                        {/* 14 Ağu 2026 — yalnız çıkış görünüyordu; artık varış (son
                            durak) da yazıyor. Çıkış tek satır (`listings.origin_*`),
                            varış `listing_stops`'un SON durağı — bkz. dosya başındaki
                            "Çıkış tek, varış çok" notu. */}
                        <div style={{ color: C.text }}>
                          {kalkisAd}{ilan.origin_district ? ` (${ilan.origin_district})` : ''}
                          {sonDurak && <> {'→'} {ilAdi(sonDurak.province_id) ?? ''}{sonDurak.district ? ` (${sonDurak.district})` : ''}</>}
                        </div>
                      </td>
                      <td style={td} data-label="Araç Tipi">
                        {/* 14 Ağu 2026 — asıl `vehicle_type` (TIR/Kamyon/...), yanında
                            parantez içinde `body_type` (üst yapı/kasa tipi: Tenteli/
                            Açık Kasa/...) — ikisi ayrı alan, `düzelt` formundaki
                            "Araç Tipi" + "Üst Yapı" etiketleriyle birebir aynı. */}
                        {(ilan.vehicle_type && ilan.vehicle_type.length > 0)
                          ? <span style={{ color: C.text, fontSize: '0.82rem' }}>
                              {ilan.vehicle_type.join(', ')}
                              {ilan.body_type && ilan.body_type.length > 0 && (
                                <span style={{ color: C.muted }}> ({ilan.body_type.join(', ')})</span>
                              )}
                            </span>
                          : <span style={{ color: C.dim }}>—</span>}
                      </td>
                      <td style={td} data-label="Tarih">
                        {ilan.available_date
                          ? <span style={{ color: C.muted, fontSize: '0.82rem' }}>{new Date(ilan.available_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                          : <span style={{ color: C.dim }}>—</span>}
                      </td>
                      <td style={td} data-label="Durum">
                        <DurumBadge durum={durum} />
                        {isRejected && <div style={{ color: C.dim, fontSize: '0.7rem', marginTop: 3 }}>Mod. reddetti</div>}
                        {isPending && <div style={{ color: C.dim, fontSize: '0.7rem', marginTop: 3 }}>İnceleniyor</div>}
                        {durum === 'in_progress' && <div style={{ color: C.dim, fontSize: '0.7rem', marginTop: 3 }}>Plaka atandı, sefer sürüyor</div>}
                        {durum === 'correction_needed' && (() => {
                          const logs = ilan.internal_audit_logs;
                          const sebep   = logs?.correction_reason;
                          const mesaj   = logs?.correction_message;
                          return (
                            <div style={{ marginTop: 4 }}>
                              {sebep && <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 600 }}>📌 {sebep}</div>}
                              {mesaj && <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: 2 }}>{mesaj}</div>}
                              {!sebep && !mesaj && <div style={{ color: '#fbbf24', fontSize: '0.7rem' }}>Moderator düzeltme istedi</div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ ...td, textAlign: 'right' as const }} data-label="İşlemler">
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <a href={`/ilan/${ilan.id}`}
                            style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.78rem', textDecoration: 'none', fontWeight: 500 }}>
                            Detay
                          </a>
                          {/* Düzenle — 8 Ağu 2026: artık yalnız `correction_needed`
                              değil, kullanıcının düzenlemesine izin verilen her
                              durumda. `correction_needed` olanda vurgulu (amber)
                              görünüyor çünkü orada AKSİYON BEKLENİYOR. */}
                          {duzenlenebilir && (
                            <button onClick={() => duzeltAc(ilan)}
                              style={durum === 'correction_needed'
                                ? { padding: '5px 10px', borderRadius: 5, border: '1px solid #854d0e', background: '#2a1d00', color: '#fbbf24', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }
                                : { padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                              {durum === 'correction_needed' ? '✏️ İlanı Düzelt' : '✏️ Düzenle'}
                            </button>
                          )}
                          {isEditable && !tamamlandi && (
                            isAktif ? (
                              <button onClick={() => pasifYap(ilan.id)} disabled={!!yukleniyor}
                                style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: '0.78rem', cursor: 'pointer' }}>
                                {yukleniyor === ilan.id + '_pasif' ? '...' : 'Pasif Yap'}
                              </button>
                            ) : (
                              <button onClick={() => aktifYap(ilan.id)} disabled={!!yukleniyor}
                                style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.greenBg}`, background: C.greenDark, color: C.green, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                                {yukleniyor === ilan.id + '_aktif' ? '...' : 'Aktif Yap'}
                              </button>
                            )
                          )}
                          {isEditable && (
                            <button onClick={() => tamamlandiToggle(ilan)} disabled={!!yukleniyor}
                              style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${tamamlandi ? C.border : C.greenBg}`, background: tamamlandi ? 'none' : C.greenDark, color: tamamlandi ? C.dim : C.green, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                              {tamamlandi ? '↩ Geri Al' : '✅ Tamamla'}
                            </button>
                          )}
                          {/* Sefer Ekle — yalnız aktif yük ilanlarında, henüz aktif deal yoksa */}
                          {isAktif && isYuk && !mesgulIlanlar.has(ilan.id) && (
                            seferEkleId === ilan.id
                              ? <button onClick={() => setSeferEkleId(null)}
                                  style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.blue}`, background: C.blueBg, color: C.blue, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                                  ✕ Kapat
                                </button>
                              : <button onClick={() => seferAc(ilan.id)}
                                  style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.greenBg}`, background: C.greenDark, color: C.green, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>
                                  🔑 Plaka Ata
                                </button>
                          )}
                          {silOnay === ilan.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => sil(ilan.id)} disabled={!!yukleniyor}
                                style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}>
                                {yukleniyor === ilan.id + '_sil' ? '...' : 'Evet, Sil'}
                              </button>
                              <button onClick={() => setSilOnay(null)}
                                style={{ padding: '5px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: '0.78rem', cursor: 'pointer' }}>
                                Vazgeç
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setSilOnay(ilan.id)}
                              style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'none', color: C.red, fontSize: '0.78rem', cursor: 'pointer' }}>
                              Sil
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Düzenleme formu — bu ilan seçiliyse.
                        `correction_needed` ise amber (aksiyon bekleniyor),
                        normal düzenlemede nötr çerçeve. */}
                    {/* ── Sefer Ekle formu — harici nakliyeci ile sefer oluştur ── */}
                    {seferEkleId === ilan.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 12px 16px', background: '#0a0d11' }}>
                          <div style={{ border: `1px solid ${C.greenBg}`, borderRadius: 8, padding: 16, background: C.greenDark }}>
                            <div style={{ color: C.green, fontWeight: 700, fontSize: '0.85rem', marginBottom: 12 }}>
                              🔑 Plaka Ata — {kalkisAd}
                            </div>
                            {/* Plaka — EN ÜSTTE. Kayıtlı araçla eşleşirse diğer alanlar otomatik dolar. */}
                            <div style={{ marginBottom: 10 }}>
                              <label style={lbl}>Plaka</label>
                              <input
                                value={seferPlaka}
                                onChange={e => {
                                  const v = e.target.value.toUpperCase().replace(/\s/g, '');
                                  setSeferPlaka(v);
                                  const eslesme = kayitliAraclar.find((a: any) => a.plate === v);
                                  if (eslesme) {
                                    setSeferSofor(eslesme.driver_name || '');
                                  }
                                }}
                                placeholder="34ABC123"
                                style={{ ...inp, textTransform: 'uppercase' as const, fontWeight: 700, letterSpacing: '0.08em', fontSize: '1rem' }}
                              />
                              {/* Kayıtlı araçlar — plaka listesi */}
                              {kayitliAraclar.length > 0 && (
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 6 }}>
                                  {kayitliAraclar.map((a: any, i: number) => (
                                    <button key={i} type="button"
                                      onClick={() => { setSeferPlaka(a.plate); setSeferSofor(a.driver_name || ''); }}
                                      style={{ background: seferPlaka === a.plate ? C.blueBg : C.surface, border: `1px solid ${seferPlaka === a.plate ? C.blue : C.border}`, color: seferPlaka === a.plate ? C.blue : C.muted, borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' }}>
                                      {a.plate}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                              <div>
                                <label style={lbl}>Şoför Adı <span style={{ color: C.dim, fontWeight: 400 }}>(opsiyonel)</span></label>
                                <input value={seferSofor} onChange={e => setSeferSofor(e.target.value)} placeholder="Şoför Ahmet" style={inp} />
                              </div>
                              <div>
                                <label style={lbl}>Nakliyeci / Firma <span style={{ color: C.dim, fontWeight: 400 }}>(opsiyonel)</span></label>
                                <input value={seferNakliyeAd} onChange={e => setSeferNakliyeAd(e.target.value)} placeholder="Ali Veli Nakliyat" style={inp} />
                              </div>
                              <div>
                                <label style={lbl}>Nakliyeci Telefonu <span style={{ color: C.dim, fontWeight: 400 }}>(opsiyonel)</span></label>
                                <input value={seferNakliyeTel} onChange={e => setSeferNakliyeTel(e.target.value)} placeholder="0532 000 00 00" style={inp} />
                              </div>
                              <div>
                                <label style={lbl}>Anlaşma Fiyatı <span style={{ color: C.dim, fontWeight: 400 }}>(₺)</span></label>
                                <input value={seferFiyat} onChange={e => setSeferFiyat(e.target.value)} placeholder={ilan.price_offer ? String(ilan.price_offer) : 'opsiyonel'} style={inp} />
                              </div>
                              <div style={{ gridColumn: '1 / -1' }}>
                                <label style={lbl}>Not <span style={{ color: C.dim, fontWeight: 400 }}>(opsiyonel)</span></label>
                                <input value={seferNot} onChange={e => setSeferNot(e.target.value)} placeholder="Kırmızı TIR, öğle kalkış" style={inp} />
                              </div>
                            </div>
                            {seferSonuc && (
                              <div style={{ padding: '8px 12px', borderRadius: 6, background: seferSonuc.ok ? C.greenDark : '#2d0a0a', border: `1px solid ${seferSonuc.ok ? C.greenBg : '#7f1d1d'}`, color: seferSonuc.ok ? C.green : '#f87171', fontSize: '0.82rem', marginBottom: 10 }}>
                                {seferSonuc.mesaj}
                                {seferSonuc.ok && <> <a href="/panel?sekme=anlasmalarim" style={{ color: C.green, fontWeight: 700 }}>Anlaşmalarım →</a></>}
                              </div>
                            )}
                            {!seferSonuc?.ok && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => seferKaydet(ilan.id, ilan.price_offer)} disabled={seferYukleniyor}
                                  style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                                  {seferYukleniyor ? 'Kaydediliyor...' : '🔑 Plaka Ata'}
                                </button>
                                <button onClick={() => setSeferEkleId(null)}
                                  style={{ padding: '8px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: '0.82rem', cursor: 'pointer' }}>
                                  Vazgeç
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {duzeltId === ilan.id && (() => {
                      const duzeltmeModu = durum === 'correction_needed';
                      const cerceve = duzeltmeModu ? '#854d0e' : C.border;
                      const zemin   = duzeltmeModu ? '#12100a' : C.surface;
                      const baslikRenk = duzeltmeModu ? '#fbbf24' : C.text;
                      return (
                      <tr>
                        <td colSpan={7} style={{ padding: '0 12px 16px', background: '#0a0d11' }}>
                          <div style={{ border: `1px solid ${cerceve}`, borderRadius: 8, padding: 16, background: zemin }}>
                            <div style={{ color: baslikRenk, fontWeight: 700, fontSize: '0.85rem', marginBottom: 12 }}>
                              ✏️ {duzeltmeModu ? 'İlanı Düzelt' : 'İlanı Düzenle'} — {kalkisAd} → {ilAdi((ilan.listing_stops||[])[0]?.province_id) ?? ''}
                            </div>
                            {/* Modératör mesajı */}
                            {(() => {
                              const logs = ilan.internal_audit_logs;
                              const reason  = logs?.correction_reason;
                              const message = logs?.correction_message;
                              return (reason || message) ? (
                                <div style={{ background: '#2a1d00', border: '1px solid #854d0e', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
                                  <div style={{ color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700, marginBottom: 4 }}>MOD. NOTU</div>
                                  {reason  && <div style={{ color: '#e2e8f0', fontSize: '0.82rem', marginBottom: message ? 4 : 0 }}>📌 {reason}</div>}
                                  {message && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{message}</div>}
                                </div>
                              ) : null;
                            })()}
                            {/* İhlal edilen kurallar */}
                            {(() => {
                              const logs = ilan.internal_audit_logs;
                              const fired: any[] = logs?.fired_rules || [];
                              return fired.length > 0 ? (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ color: C.muted, fontSize: '0.72rem', marginBottom: 6 }}>Tespit edilen sorunlar:</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {fired.map((r: any, i: number) => (
                                      <span key={i} style={{ background: '#1a0808', color: '#f87171', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #450a0a' }}>
                                        ⚠️ {r.description || 'Kural ihlali'}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                            {/* Fiyat + Tarih — 8 Ağu 2026'da eklendi. En sık
                                düzeltme ihtiyacı bu iki alan. */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                              <div>
                                <label style={lbl}>{isYuk ? 'Ücret Teklifi (TL)' : 'Hedef Navlun (TL)'}</label>
                                <input type="number" min={0} value={duzeltFiyat}
                                  onChange={e => setDuzeltFiyat(e.target.value)}
                                  placeholder="Opsiyonel" style={inp} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                                  <input type="checkbox" checked={duzeltPazarlik} onChange={e => setDuzeltPazarlik(e.target.checked)} />
                                  <span style={{ color: C.muted, fontSize: '0.78rem' }}>Pazarlık payı var</span>
                                </label>
                              </div>
                              <div>
                                <label style={lbl}>{isYuk ? 'Yükleme Tarihi' : 'Müsaitlik Tarihi'}</label>
                                {/* `min` YOK: mevcut tarih geçmişte olabilir ve
                                    kullanıcı yalnız notunu düzeltiyor olabilir.
                                    Sunucu "geçmiş tarih" kuralını YALNIZ tarih
                                    DEĞİŞTİYSE uyguluyor. */}
                                <input type="date" value={duzeltTarih}
                                  onChange={e => setDuzeltTarih(e.target.value)} style={inp} />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, cursor: 'pointer' }}>
                                  <input type="checkbox" checked={duzeltTarihEsnek} onChange={e => setDuzeltTarihEsnek(e.target.checked)} />
                                  <span style={{ color: C.muted, fontSize: '0.78rem' }}>Tarih esnek</span>
                                </label>
                              </div>
                            </div>
                            {/* Not alanı */}
                            <div style={{ marginBottom: 10 }}>
                              <label style={lbl}>Not / Açıklama</label>
                              <textarea value={duzeltNotes} onChange={e => setDuzeltNotes(e.target.value)}
                                rows={3} placeholder={duzeltmeModu ? 'Sorunlu ifadeleri kaldırın...' : 'Özel şartlar, dikkat edilmesi gerekenler...'}
                                style={{ ...inp, resize: 'vertical' as const }} />
                            </div>
                            {/* Araç tipi */}
                            <div style={{ marginBottom: 10 }}>
                              <label style={lbl}>Araç Tipi</label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {ARAC_TIPLERI.map(t => (
                                  <button key={t} type="button"
                                    onClick={() => setDuzeltVehicle(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                                    style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${duzeltVehicle.includes(t) ? C.green : C.border}`, background: duzeltVehicle.includes(t) ? C.greenDark : C.bg, color: duzeltVehicle.includes(t) ? C.green : C.muted, fontSize: '0.8rem', cursor: 'pointer' }}>
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Üst yapı */}
                            <div style={{ marginBottom: 14 }}>
                              <label style={lbl}>Üst Yapı</label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {UTSYAPI.map(u => (
                                  <button key={u} type="button"
                                    onClick={() => setDuzeltBody(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u])}
                                    style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${duzeltBody.includes(u) ? C.blue : C.border}`, background: duzeltBody.includes(u) ? C.blueBg : C.bg, color: duzeltBody.includes(u) ? C.blue : C.muted, fontSize: '0.8rem', cursor: 'pointer' }}>
                                    {u}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Sonuc mesajı */}
                            {duzeltSonuc && (
                              <div style={{ background: duzeltSonuc.ok ? C.greenDark : '#2a1d00', border: `1px solid ${duzeltSonuc.ok ? C.greenBg : '#854d0e'}`, borderRadius: 6, padding: '8px 14px', marginBottom: 12, color: duzeltSonuc.ok ? C.green : '#fbbf24', fontSize: '0.82rem', fontWeight: 600 }}>
                                {duzeltSonuc.ok ? '✅' : '⚠️'} {duzeltSonuc.mesaj}
                                {!duzeltSonuc.ok && duzeltSonuc.firedRules && duzeltSonuc.firedRules.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    {duzeltSonuc.firedRules.map((r: any, i: number) => (
                                      <span key={i} style={{ background: '#1a0808', color: '#f87171', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4 }}>
                                        {r.description}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button disabled={duzeltYukleniyor} onClick={async () => {
                                setDuzeltYukleniyor(true); setDuzeltSonuc(null);
                                try {
                                  const res = await fetch('/api/ilan/duzelt', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: ilan.id,
                                      notes: duzeltNotes,
                                      vehicle_type: duzeltVehicle,
                                      body_type: duzeltBody,
                                      price_offer: duzeltFiyat === '' ? null : duzeltFiyat,
                                      price_negotiable: duzeltPazarlik,
                                      // Boş tarih GÖNDERİLMEZ (undefined) — sunucu
                                      // "gönderilmeyen alan mevcut değerini korur"
                                      // sözleşmesiyle çalışıyor; boş string yollamak
                                      // "geçerli tarih seçin" hatası verirdi.
                                      ...(duzeltTarih ? { available_date: duzeltTarih } : {}),
                                      date_flexible: duzeltTarihEsnek,
                                    }),
                                  });
                                  const d = await res.json();
                                  if (res.ok) {
                                    const yayinda = d.moderation_status === 'approved';
                                    setDuzeltSonuc({ ok: yayinda, mesaj: d.mesaj, firedRules: d.fired_rules });
                                    // Sunucunun GERÇEKTEN yazdığı değerlerle tazele —
                                    // beyaz listeden düşen bir tip ekranda kalmasın.
                                    ilanGuncelle(ilan.id, {
                                      moderation_status: d.moderation_status,
                                      status: d.status,
                                      is_shadow_banned: d.is_shadow_banned,
                                      ...(d.alanlar ?? {}),
                                    });
                                    if (yayinda) { setTimeout(() => setDuzeltId(''), 1500); }
                                  } else {
                                    setDuzeltSonuc({ ok: false, mesaj: d.error || 'Hata oluştu' });
                                  }
                                } catch (e: any) {
                                  setDuzeltSonuc({ ok: false, mesaj: e.message });
                                }
                                setDuzeltYukleniyor(false);
                              }}
                                style={{ background: C.green, color: '#000', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: duzeltYukleniyor ? 0.6 : 1 }}>
                                {duzeltYukleniyor ? '⏳ Kaydediliyor...' : (duzeltmeModu ? '✓ Kaydedip Gönder' : '✓ Kaydet')}
                              </button>
                              <button onClick={() => { setDuzeltId(''); setDuzeltSonuc(null); }}
                                style={{ background: 'none', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '7px 14px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                İptal
                              </button>
                            </div>
                            {/* Konum/durak düzenleme BİLEREK YOK: rota değişimi
                                durakların silinip yeniden yazılmasını gerektiriyor
                                (moderatör tarafındaki `moderator_ilan_duzenle`
                                RPC'sinin işi). Kullanıcıya açılacaksa ayrı bir
                                kullanıcı RPC'si gerekir — bu turun kapsamı dışı. */}
                            <div style={{ color: C.dim, fontSize: '0.72rem', marginTop: 10 }}>
                              Güzergâh, il/ilçe ve durak bilgisi buradan değiştirilemez — değişmesi
                              gerekiyorsa ilanı silip yeniden oluşturun.
                            </div>
                          </div>
                        </td>
                      </tr>
                      );
                    })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function durumLabel(s: string): string {
  const map: Record<string, string> = {
    hepsi: 'Tümü', active: 'Aktif (Plaka Aranmadı)', in_progress: 'Devam Ediyor', passive: 'Pasif', completed: 'Tamamlanan',
    pending: 'Onay Bekleyen', rejected: 'Reddedilen', correction_needed: '⚠️ Düzeltme Gerekiyor',
  };
  return map[s] || s;
}

function durumRenk(s: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    active:             { bg: '#0d2b1a', color: C.green },
    in_progress:        { bg: C.blueBg, color: C.blue },
    passive:            { bg: '#1f2937', color: C.muted },
    completed:          { bg: C.greenBg, color: '#86efac' },
    pending:            { bg: '#2d1a00', color: C.amber },
    rejected:           { bg: '#2d0a0a', color: C.red },
    correction_needed:  { bg: '#2d1a00', color: '#fbbf24' },
    hepsi:              { bg: C.surface, color: C.muted },
  };
  return map[s] || { bg: C.surface, color: C.muted };
}

function DurumBadge({ durum }: { durum: string }) {
  const r = durumRenk(durum);
  const l = durumLabel(durum);
  return <span style={{ background: r.bg, color: r.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4 }}>{l}</span>;
}

// ═══════════════════════════════════════════════════════════════════
// ARAÇLAR SEKMESİ
// ═══════════════════════════════════════════════════════════════════
interface AracFormState { plate: string; vehicle_type: string; body_types: string[]; brand: string; model: string; year: string; capacity_ton: string; }
const bosForm: AracFormState = { plate: '', vehicle_type: '', body_types: [], brand: '', model: '', year: '', capacity_ton: '' };

function AraclarSekmesi({ araclar: ilk, userId }: { araclar: any[]; userId: string }) {
  const [araclar, setAraclar] = useState(ilk);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState<string | null>(null);
  const [form, setForm] = useState<AracFormState>(bosForm);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [silOnay, setSilOnay] = useState<string | null>(null);
  const [hata, setHata] = useState('');

  function formKapat() { setFormAcik(false); setDuzenleId(null); setForm(bosForm); setHata(''); }

  function duzenleAc(a: any) {
    setDuzenleId(a.id);
    setForm({ plate: a.plate, vehicle_type: a.vehicle_type, body_types: a.body_types || [], brand: a.brand || '', model: a.model || '', year: a.year?.toString() || '', capacity_ton: a.capacity_ton?.toString() || '' });
  }

  async function kaydet() {
    if (!form.plate || !form.vehicle_type) { setHata('Plaka ve araç tipi zorunludur.'); return; }
    setKaydediliyor(true); setHata('');
    const payload = { plate: form.plate.toUpperCase().replace(/\s/g, ''), vehicle_type: form.vehicle_type, body_types: form.body_types, brand: form.brand || null, model: form.model || null, year: form.year ? parseInt(form.year) : null, capacity_ton: form.capacity_ton ? parseFloat(form.capacity_ton) : null, is_active: true };
    try {
      if (duzenleId) {
        const { error } = await supabase.from('vehicles').update(payload).eq('id', duzenleId).eq('user_id', userId);
        if (error) throw error;
        setAraclar(prev => prev.map(a => a.id === duzenleId ? { ...a, ...payload } : a));
      } else {
        const { data, error } = await supabase.from('vehicles').insert({ ...payload, user_id: userId }).select().single();
        if (error) throw error;
        setAraclar(prev => [data, ...prev]);
      }
      formKapat();
    } catch (err: any) { setHata(err.message || 'Bir hata oluştu.'); }
    setKaydediliyor(false);
  }

  async function sil(id: string) {
    setKaydediliyor(true);
    const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('user_id', userId);
    if (!error) setAraclar(prev => prev.filter(a => a.id !== id));
    setSilOnay(null); setKaydediliyor(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: C.text, fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>Araçlarım</h2>
        {!formAcik && !duzenleId && (
          <button onClick={() => setFormAcik(true)} style={btn('primary')}>+ Araç Ekle</button>
        )}
      </div>

      {(formAcik || duzenleId) && (
        <div style={{ background: C.bg, border: `1px solid ${C.green}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: C.text, fontWeight: 700 }}>{duzenleId ? 'Aracı Düzenle' : 'Yeni Araç Ekle'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Plaka *</label>
              <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="34 ABC 123" style={inp} />
            </div>
            <div>
              <label style={lbl}>Araç Tipi *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ARAC_TIPLERI.map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, vehicle_type: f.vehicle_type === t ? '' : t }))}
                    style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${form.vehicle_type === t ? C.green : C.border}`, background: form.vehicle_type === t ? C.greenDark : C.bg, color: form.vehicle_type === t ? C.green : C.muted, fontSize: '0.82rem', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label style={lbl}>Üst Yapı</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {UTSYAPI.map(u => (
                <button key={u} type="button"
                  onClick={() => setForm(f => ({ ...f, body_types: f.body_types.includes(u) ? f.body_types.filter(x => x !== u) : [...f.body_types, u] }))}
                  style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${form.body_types.includes(u) ? C.blue : C.border}`, background: form.body_types.includes(u) ? C.blueBg : C.bg, color: form.body_types.includes(u) ? C.blue : C.muted, fontSize: '0.8rem', cursor: 'pointer' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { key: 'brand', label: 'Marka', ph: 'Mercedes' },
              { key: 'model', label: 'Model', ph: 'Actros' },
              { key: 'year', label: 'Yıl', ph: '2020', type: 'number' },
              { key: 'capacity_ton', label: 'Kapasite (ton)', ph: '20', type: 'number' },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input type={f.type || 'text'} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>
          {hata && <div style={{ color: C.red, fontSize: '0.82rem' }}>⚠️ {hata}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={kaydet} disabled={kaydediliyor} style={btn('primary')}>{kaydediliyor ? 'Kaydediliyor...' : duzenleId ? 'Güncelle' : 'Kaydet'}</button>
            <button onClick={formKapat} style={btn('ghost')}>İptal</button>
          </div>
        </div>
      )}

      {araclar.length === 0 && !formAcik ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚛</div>
          <div style={{ color: C.muted, fontWeight: 600, marginBottom: 16 }}>Henüz araç eklenmemiş</div>
          <button onClick={() => setFormAcik(true)} style={btn('primary')}>+ İlk Aracını Ekle</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {araclar.map(arac => (
            <div key={arac.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '1.2rem' }}>🚚</span>
                    <span style={{ color: C.text, fontWeight: 700 }}>{arac.vehicle_type}</span>
                  </div>
                  <div style={{ color: C.blue, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{arac.plate}</div>
                </div>
                <span style={{ background: arac.is_active ? C.greenDark : '#1f2937', color: arac.is_active ? C.green : C.dim, fontSize: '0.65rem', fontWeight: 700, padding: '3px 7px', borderRadius: 4 }}>
                  {arac.is_active ? 'Aktif' : 'Pasif'}
                </span>
              </div>
              {arac.body_types?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {arac.body_types.map((u: string) => (
                    <span key={u} style={{ background: '#1f2937', color: C.muted, fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4 }}>{u}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {arac.brand && <span style={{ color: C.dim, fontSize: '0.8rem' }}>{arac.brand}{arac.model ? ` ${arac.model}` : ''}</span>}
                {arac.year && <span style={{ color: C.dim, fontSize: '0.8rem' }}>{arac.year}</span>}
                {arac.capacity_ton && <span style={{ color: C.muted, fontSize: '0.8rem' }}>⚖ {arac.capacity_ton} ton</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                <button onClick={() => duzenleAc(arac)} style={{ ...btn('secondary'), flex: 1, textAlign: 'center' as const }}>Düzenle</button>
                {silOnay === arac.id ? (
                  <>
                    <button onClick={() => sil(arac.id)} disabled={kaydediliyor} style={{ ...btn('danger'), padding: '7px 12px' }}>Evet, Sil</button>
                    <button onClick={() => setSilOnay(null)} style={btn('ghost')}>Vazgeç</button>
                  </>
                ) : (
                  <button onClick={() => setSilOnay(arac.id)}
                    style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.red, fontSize: '0.82rem', cursor: 'pointer' }}>
                    Sil
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROFİL SEKMESİ
// ═══════════════════════════════════════════════════════════════════
type TelFaz = 'idle' | 'yeniTel' | 'otp';

function ProfilSekmesi({ profil, userEmail, userId }: { profil: any; userEmail: string | null; userId: string }) {
  const [displayName, setDisplayName] = useState(profil?.display_name || '');
  const [companyName, setCompanyName] = useState(profil?.company_name || '');
  const [bio, setBio] = useState(profil?.bio || '');
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [basariMesaji, setBasariMesaji] = useState('');
  const [hata, setHata] = useState('');

  const [telFaz, setTelFaz] = useState<TelFaz>('idle');
  const [yeniTel, setYeniTel] = useState('');
  const [otp, setOtp] = useState('');
  const [telYukleniyor, setTelYukleniyor] = useState(false);
  const [telHata, setTelHata] = useState('');

  async function profilKaydet() {
    if (!displayName.trim()) { setHata('Ad Soyad zorunludur.'); return; }
    setKaydediliyor(true); setHata(''); setBasariMesaji('');
    const { error } = await supabase.from('users').update({
      display_name: displayName.trim(),
      company_name: companyName.trim() || null,
      bio: bio.trim() || null,
    }).eq('id', userId);
    if (error) setHata('Kayıt başarısız: ' + error.message);
    else setBasariMesaji('Profil güncellendi.');
    setKaydediliyor(false);
  }

  // 🚨 11 Ağu 2026 — bu iki fonksiyon artık `/api/auth/telefon-degistir`e
  // gidiyor, istemciden DOĞRUDAN `supabase.auth.*` / `supabase.from('users')`
  // ÇAĞIRMIYOR. `phone_verified` istemciden yazılabildiği için (kendine rozet
  // sorunu, bkz. `docs/YAPILACAKLAR.md` madde 3) yazma sunucuya taşındı;
  // `authenticated` rolünün o kolonu UPDATE etme yetkisi de DB'de geri alındı
  // (`docs/20260811_phone_verified_revoke.sql`) — SAKIN buraya doğrudan
  // `supabase.from('users').update({ phone_verified: ... })` GERİ EKLEME,
  // PostgREST 42501 döner ve kullanıcı sessizce takılır kalır.
  async function otpGonder() {
    const temiz = yeniTel.replace(/\D/g, '');
    if (temiz.length !== 11 || !temiz.startsWith('0')) { setTelHata('Geçerli bir telefon numarası girin.'); return; }
    setTelYukleniyor(true); setTelHata('');
    const res = await fetch('/api/auth/telefon-degistir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adim: 'gonder', telefon: temiz }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setTelHata(d.error || 'SMS gönderilemedi.');
    else setTelFaz('otp');
    setTelYukleniyor(false);
  }

  async function otpDogrula() {
    setTelYukleniyor(true); setTelHata('');
    const temiz = yeniTel.replace(/\D/g, '');
    const res = await fetch('/api/auth/telefon-degistir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adim: 'dogrula', telefon: temiz, otp }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setTelHata(d.error || 'Kod hatalı veya süresi dolmuş.'); setTelYukleniyor(false); return; }
    setTelFaz('idle'); setYeniTel(''); setOtp(''); setBasariMesaji('Telefon numarası güncellendi.');
    setTelYukleniyor(false);
  }

  const userTypeLabels: Record<string, string> = {
    yuk_sahibi: 'Yük Sahibi', arac_sahibi: 'Araç Sahibi', sirket: 'Şirket', broker: 'Komisyoncu',
  };

  return (
    <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Kişisel Bilgiler */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: '1rem', paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          👤 Kişisel Bilgiler
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Ad Soyad *</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ad Soyad" style={inp} />
          </div>
          <div>
            <label style={lbl}>Kullanıcı Tipi</label>
            <div style={{ ...inp, color: C.dim, background: '#0a0f17', cursor: 'default' }}>
              {userTypeLabels[profil?.user_type] || profil?.user_type || '—'}
            </div>
          </div>
        </div>

        <div>
          <label style={lbl}>Şirket / Firma Adı</label>
          <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Firma adı (opsiyonel)" style={inp} />
        </div>

        <div>
          <label style={lbl}>Hakkımda / Bio</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Kendinizi tanıtın..." rows={3}
            style={{ ...inp, resize: 'vertical' as const }} />
        </div>

        {hata && <div style={{ color: C.red, fontSize: '0.82rem' }}>⚠️ {hata}</div>}
        {basariMesaji && <div style={{ color: C.green, fontSize: '0.82rem' }}>✓ {basariMesaji}</div>}

        <button onClick={profilKaydet} disabled={kaydediliyor} style={{ ...btn('primary'), alignSelf: 'flex-start' }}>
          {kaydediliyor ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      {/* İletişim Bilgileri */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: '1rem', paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          📞 İletişim Bilgileri
        </div>

        <div>
          <label style={lbl}>E-posta</label>
          <input value={userEmail || ''} disabled style={{ ...inp, color: C.dim, cursor: 'not-allowed', background: '#0a0f17' }} />
          <div style={{ color: C.dim, fontSize: '0.72rem', marginTop: 4 }}>E-posta değiştirilemez.</div>
        </div>

        <div>
          <label style={lbl}>Telefon Numarası</label>
          {telFaz === 'idle' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={profil?.phone || ''} disabled style={{ ...inp, color: C.dim, cursor: 'not-allowed', background: '#0a0f17', flex: 1 }} />
              {profil?.phone_verified && <span style={{ color: C.green, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>✓ Doğrulandı</span>}
              <button onClick={() => setTelFaz('yeniTel')} style={{ ...btn('secondary'), fontSize: '0.78rem', padding: '8px 12px' }}>
                Değiştir
              </button>
            </div>
          )}
          {telFaz === 'yeniTel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={yeniTel} onChange={e => setYeniTel(e.target.value.replace(/\D/g, '').substring(0, 11))} placeholder="05xx xxx xx xx" style={inp} autoFocus />
              {telHata && <div style={{ color: C.red, fontSize: '0.78rem' }}>⚠️ {telHata}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={otpGonder} disabled={telYukleniyor} style={btn('primary')}>{telYukleniyor ? 'Gönderiliyor...' : 'SMS Kodu Gönder'}</button>
                <button onClick={() => { setTelFaz('idle'); setYeniTel(''); setTelHata(''); }} style={btn('ghost')}>İptal</button>
              </div>
            </div>
          )}
          {telFaz === 'otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: C.muted, fontSize: '0.82rem' }}>📱 {yeniTel} numarasına kod gönderdik.</div>
              <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))} placeholder="Doğrulama kodu"
                style={{ ...inp, fontSize: '1.3rem', letterSpacing: '0.3em', textAlign: 'center' as const, fontWeight: 700 }} autoFocus />
              {telHata && <div style={{ color: C.red, fontSize: '0.78rem' }}>⚠️ {telHata}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={otpDogrula} disabled={telYukleniyor || otp.length < 4} style={btn('primary')}>{telYukleniyor ? 'Doğrulanıyor...' : 'Onayla'}</button>
                <button onClick={() => setTelFaz('yeniTel')} style={btn('ghost')}>← Geri</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Kimlik Bilgileri */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: '1rem', paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          🪪 Kimlik Bilgileri
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: profil?.tckn && profil?.vkn ? '1fr 1fr' : '1fr', gap: 12 }}>
          {profil?.tckn && (
            <div>
              <label style={lbl}>TC Kimlik No</label>
              <div style={{ ...inp, color: C.dim, background: '#0a0f17', cursor: 'default', letterSpacing: '0.1em' }}>
                {'•'.repeat(7)}{profil.tckn.slice(-4)}
              </div>
            </div>
          )}
          {profil?.vkn && (
            <div>
              <label style={lbl}>Vergi Kimlik No</label>
              <div style={{ ...inp, color: C.dim, background: '#0a0f17', cursor: 'default', letterSpacing: '0.1em' }}>
                {'•'.repeat(6)}{profil.vkn.slice(-4)}
              </div>
            </div>
          )}
        </div>
        {!profil?.tckn && !profil?.vkn && (
          <div style={{ color: C.dim, fontSize: '0.82rem' }}>Kimlik bilgisi eklenmemiş.</div>
        )}
        <div style={{ color: C.dim, fontSize: '0.72rem' }}>
          Kimlik bilgilerini değiştirmek için destek ile iletişime geçin.
        </div>
      </div>
    </div>
  );
}
