'use client';
import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../lib/supabase';

const supabase = createClient();

const C = {
  bg: '#0d1117', surface: '#161b22', border: '#30363d',
  text: '#e2e8f0', muted: '#8b949e', dim: '#4b5563',
  green: '#22c55e', greenBg: '#14532d', greenDark: '#0d2b1a',
  blue: '#60a5fa', blueBg: '#1e3a5f',
  red: '#ef4444', redBg: '#7f1d1d',
  amber: '#f59e0b', amberBg: '#451a03',
  purple: '#a78bfa', purpleBg: '#2e1065',
};

const inp: React.CSSProperties = {
  width: '100%', background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '9px 12px', fontSize: '0.9rem', outline: 'none',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  color: C.muted, fontSize: '0.72rem', fontWeight: 700,
  letterSpacing: '0.05em', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
};
const btn = (variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber'): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
  fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' as const,
  border: variant === 'secondary' || variant === 'ghost' ? `1px solid ${C.border}` : 'none',
  background:
    variant === 'primary' ? C.green :
    variant === 'danger' ? '#dc2626' :
    variant === 'amber' ? C.amber :
    variant === 'ghost' ? 'none' : C.surface,
  color:
    variant === 'primary' ? '#000' :
    variant === 'danger' ? '#fff' :
    variant === 'amber' ? '#000' :
    C.muted,
});

const ARAC_TIPLERI = ['TIR', 'Kırkayak', 'Kamyon', 'Kamyonet', 'Panelvan'];
const UTSYAPI = ['Tenteli', 'Açık Kasa', 'Kapalı Kasa', 'Frigorifik', 'Damperli', 'Lowbed', 'Liftli', 'Silo'];

type Tab = 'ilanlarim' | 'araclarim' | 'profilim';

interface Props {
  userId: string;
  userEmail: string | null;
  profil: any;
  ilanlar: any[];
  araclar: any[];
}

export default function PanelClient({ userId, userEmail, profil, ilanlar, araclar }: Props) {
  const [sekme, setSekme] = useState<Tab>('ilanlarim');
  const isNakliyeci = profil?.user_type === 'arac_sahibi';

  const aktifIlan = ilanlar.filter(i =>
    !i.completed_at && i.status === 'active' &&
    ['approved', 'auto_published'].includes(i.moderation_status)
  ).length;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.svg" alt="Yükegel" style={{ width: 28, height: 28 }} />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
              <span style={{ color: C.green }}>YÜKE</span><span style={{ color: C.text }}>GEL</span>
            </span>
          </a>
          <a href="/cikis" style={{ color: C.dim, fontSize: '0.85rem', textDecoration: 'none' }}>Çıkış</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1024, margin: '0 auto', padding: '24px' }}>
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
        <div style={{ display: 'flex', gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {([
            { id: 'ilanlarim', label: '📋 İlanlarım', count: ilanlar.length },
            { id: 'araclarim', label: '🚛 Araçlarım', count: araclar.length },
            { id: 'profilim', label: '👤 Profilim' },
          ] as { id: Tab; label: string; count?: number }[]).map(t => (
            <button key={t.id} onClick={() => setSekme(t.id)}
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

        {sekme === 'ilanlarim' && <IlanlarSekmesi ilanlar={ilanlar} userId={userId} />}
        {sekme === 'araclarim' && <AraclarSekmesi araclar={araclar} userId={userId} />}
        {sekme === 'profilim' && <ProfilSekmesi profil={profil} userEmail={userEmail} userId={userId} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// İLANLAR SEKMESİ
// ═══════════════════════════════════════════════════════════════════
type StatusFiltre = 'hepsi' | 'active' | 'passive' | 'completed' | 'pending' | 'rejected';

function IlanlarSekmesi({ ilanlar: ilk, userId }: { ilanlar: any[]; userId: string }) {
  const [ilanlar, setIlanlar] = useState(ilk);
  const [yukleniyor, setYukleniyor] = useState<string | null>(null);
  const [silOnay, setSilOnay] = useState<string | null>(null);
  const [statusFiltre, setStatusFiltre] = useState<StatusFiltre>('hepsi');
  const [kopyalandi, setKopyalandi] = useState(false);
  const [publicUrl, setPublicUrl] = useState('');

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
    await supabase.from('listing_stops').delete().eq('listing_id', id);
    await supabase.from('listings').delete().eq('id', id);
    setIlanlar(prev => prev.filter(i => i.id !== id));
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
    return i.status; // active | passive | expired
  }

  const sayilar: Record<StatusFiltre, number> = useMemo(() => ({
    hepsi: ilanlar.length,
    active: ilanlar.filter(i => durumHesapla(i) === 'active').length,
    passive: ilanlar.filter(i => durumHesapla(i) === 'passive').length,
    completed: ilanlar.filter(i => durumHesapla(i) === 'completed').length,
    pending: ilanlar.filter(i => durumHesapla(i) === 'pending').length,
    rejected: ilanlar.filter(i => durumHesapla(i) === 'rejected').length,
  }), [ilanlar]);

  const filtreli = useMemo(() => {
    return ilanlar.filter(i => {
      const durum = durumHesapla(i);
      if (statusFiltre !== 'hepsi' && durum !== statusFiltre) return false;

      const stops = (i.listing_stops || []).sort((a: any, b: any) => a.stop_order - b.stop_order);

      if (aramaKalkis && !i.origin_city?.toLowerCase().includes(aramaKalkis.toLowerCase())) return false;
      if (aramaVaris && !stops.some((s: any) => s.city?.toLowerCase().includes(aramaVaris.toLowerCase()))) return false;
      if (aramaAracTipi && !(i.vehicle_type || []).includes(aramaAracTipi)) return false;
      if (aramaTarihten && i.available_date && i.available_date < aramaTarihten) return false;
      if (aramaTarihe && i.available_date && i.available_date > aramaTarihe) return false;

      return true;
    });
  }, [ilanlar, statusFiltre, aramaKalkis, aramaVaris, aramaAracTipi, aramaTarihten, aramaTarihe]);

  const aktifFiltreSayisi = [aramaKalkis, aramaVaris, aramaAracTipi, aramaTarihten, aramaTarihe].filter(Boolean).length;

  function filtreTemizle() {
    setAramaKalkis(''); setAramaVaris(''); setAramaAracTipi('');
    setAramaTarihten(''); setAramaTarihe('');
  }

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: C.muted, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '12px', borderBottom: `1px solid #21262d`, verticalAlign: 'middle', fontSize: '0.85rem' };

  const statusSirasi: StatusFiltre[] = ['hepsi', 'active', 'pending', 'passive', 'completed', 'rejected'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Paylaşım Bandı ── */}
      <div style={{ background: C.surface, border: `1px solid ${C.greenBg}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: C.green, fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>📤 İlan listeni paylaş</div>
          <div style={{ color: C.dim, fontSize: '0.75rem', fontFamily: 'monospace' }}>{publicUrl || `yukegel.com/u/${userId}`}</div>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Başlık</th>
                  <th style={th}>Fiyat</th>
                  <th style={th}>Konum</th>
                  <th style={th}>Tarih</th>
                  <th style={th}>Durum</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtreli.map(ilan => {
                  const stops = [...(ilan.listing_stops || [])].sort((a: any, b: any) => a.stop_order - b.stop_order);
                  const sonDurak = stops[stops.length - 1];
                  const baslik = `${ilan.origin_city}${sonDurak ? ` → ${sonDurak.city}` : ''}`;
                  const isYuk = ilan.listing_type === 'yuk';
                  const durum = durumHesapla(ilan);
                  const tamamlandi = durum === 'completed';
                  const isAktif = durum === 'active';
                  const isPending = durum === 'pending';
                  const isRejected = durum === 'rejected';
                  const isEditable = !isPending && !isRejected;

                  return (
                    <tr key={ilan.id} style={{ opacity: ['passive', 'rejected'].includes(durum) ? 0.6 : 1 }}>
                      <td style={td}>
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
                      <td style={td}>
                        {ilan.price_offer
                          ? <span style={{ color: C.green, fontWeight: 700 }}>₺{Number(ilan.price_offer).toLocaleString('tr-TR')}</span>
                          : <span style={{ color: C.dim }}>—</span>}
                      </td>
                      <td style={td}>
                        <div style={{ color: C.text }}>{ilan.origin_city}</div>
                        {ilan.origin_district && <div style={{ color: C.muted, fontSize: '0.78rem' }}>{ilan.origin_district}</div>}
                      </td>
                      <td style={td}>
                        {ilan.available_date
                          ? <span style={{ color: C.muted, fontSize: '0.82rem' }}>{new Date(ilan.available_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                          : <span style={{ color: C.dim }}>—</span>}
                      </td>
                      <td style={td}>
                        <DurumBadge durum={durum} />
                        {isRejected && <div style={{ color: C.dim, fontSize: '0.7rem', marginTop: 3 }}>Mod. reddetti</div>}
                        {isPending && <div style={{ color: C.dim, fontSize: '0.7rem', marginTop: 3 }}>İnceleniyor</div>}
                      </td>
                      <td style={{ ...td, textAlign: 'right' as const }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <a href={`/ilan/${ilan.id}`}
                            style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.muted, fontSize: '0.78rem', textDecoration: 'none', fontWeight: 500 }}>
                            Detay
                          </a>
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
  const map: Record<string, string> = { hepsi: 'Tümü', active: 'Aktif', passive: 'Pasif', completed: 'Tamamlanan', pending: 'Onay Bekleyen', rejected: 'Reddedilen' };
  return map[s] || s;
}

function durumRenk(s: string): { bg: string; color: string } {
  const map: Record<string, { bg: string; color: string }> = {
    active:    { bg: '#0d2b1a', color: C.green },
    passive:   { bg: '#1f2937', color: C.muted },
    completed: { bg: C.greenBg, color: '#86efac' },
    pending:   { bg: '#2d1a00', color: C.amber },
    rejected:  { bg: '#2d0a0a', color: C.red },
    hepsi:     { bg: C.surface, color: C.muted },
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

  async function otpGonder() {
    const temiz = yeniTel.replace(/\D/g, '');
    if (temiz.length !== 11 || !temiz.startsWith('0')) { setTelHata('Geçerli bir telefon numarası girin.'); return; }
    setTelYukleniyor(true); setTelHata('');
    const { error } = await supabase.auth.updateUser({ phone: '+9' + temiz });
    if (error) setTelHata('SMS gönderilemedi: ' + error.message);
    else setTelFaz('otp');
    setTelYukleniyor(false);
  }

  async function otpDogrula() {
    setTelYukleniyor(true); setTelHata('');
    const temiz = yeniTel.replace(/\D/g, '');
    const { error } = await supabase.auth.verifyOtp({ phone: '+9' + temiz, token: otp, type: 'phone_change' });
    if (error) { setTelHata('Kod hatalı veya süresi dolmuş.'); setTelYukleniyor(false); return; }
    await supabase.from('users').update({ phone: yeniTel, phone_verified: true }).eq('id', userId);
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
