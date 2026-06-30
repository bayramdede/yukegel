'use client';

import { useState, useCallback, useEffect } from 'react';

// ── Tipler ─────────────────────────────────────────────────────────────────
type Classification = 'SPOT' | 'CONTRACT_POTENTIAL';

interface RouteAnalytics {
  total_loads: number;
  recent_loads: number;
  unique_active_days: number;
  classification: Classification;
}

interface Lead {
  phone: string;
  is_registered: boolean;
  display_name: string | null;
  company_name: string | null;
  etiket: string | null;
  shadow_profile_id: string | null;
  route_analytics: RouteAnalytics;
  has_contract_keywords: boolean;
  tags: string[];
  recent_raw_texts: string[];
  last_listing_at: string | null;
}

interface RouteStats {
  total_listings_last_30_days: number;
  unique_publishers: number;
}

interface HistoryListing {
  id: string;
  created_at: string;
  origin_city: string | null;
  raw_text: string | null;
  listing_type: string;
  moderation_status: string;
  status: string;
  vehicle_type: string[] | null;
  listing_stops: { city: string; stop_order: number }[];
}

// ── WhatsApp link ──────────────────────────────────────────────────────────
function waLink(phone: string, fromCity: string, toCity: string) {
  const num = phone.replace('+', '').replace(/\D/g, '');
  const rota = [fromCity, toCity].filter(Boolean).join(' - ');
  const text = encodeURIComponent(
    `Merhaba, ${rota} hattında aracımız müsait. İlanınıza dair görüşmek ister misiniz?`
  );
  return `https://wa.me/${num}?text=${text}`;
}

function inviteLink(phone: string) {
  const num = phone.replace('+', '').replace(/\D/g, '');
  const text = encodeURIComponent(
    `Merhaba! Yükegel platformuna ücretsiz üye olarak ilanlarınızı daha fazla nakliyeciye ulaştırabilirsiniz: https://yukegel.app/giris`
  );
  return `https://wa.me/${num}?text=${text}`;
}

// ── Yardımcılar ────────────────────────────────────────────────────────────
function tarih(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function classificationBadge(c: Classification) {
  if (c === 'CONTRACT_POTENTIAL') {
    return (
      <span style={{
        background: '#2d1a00', color: '#f59e0b',
        fontSize: '0.68rem', fontWeight: 800,
        padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
      }}>
        📈 Kontratlı Potansiyel
      </span>
    );
  }
  return (
    <span style={{
      background: '#1e293b', color: '#64748b',
      fontSize: '0.68rem', fontWeight: 600,
      padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
    }}>
      ⚡ Spot
    </span>
  );
}

function etiketBadge(e: string | null) {
  if (!e) return null;
  const map: Record<string, { bg: string; color: string; label: string }> = {
    vip:       { bg: '#2d1a00', color: '#f59e0b', label: '⭐ VIP' },
    guvenilir: { bg: '#0d2818', color: '#22c55e', label: '✅ Güvenilir' },
    normal:    { bg: '#1e293b', color: '#94a3b8', label: '○ Normal' },
    suphelı:   { bg: '#2d1a0a', color: '#fb923c', label: '⚠️ Şüpheli' },
    spam:      { bg: '#2d0a0a', color: '#f87171', label: '🚫 Spam' },
  };
  const m = map[e];
  if (!m) return null;
  return (
    <span style={{ background: m.bg, color: m.color, fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
      {m.label}
    </span>
  );
}

// ── Şehir listesi ──────────────────────────────────────────────────────────
const SEHIRLER = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara',
  'Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman',
  'Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ',
  'Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane',
  'Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş',
  'Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale',
  'Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa',
  'Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye',
  'Rize','Sakarya','Samsun','Şanlıurfa','Siirt','Sinop','Şırnak','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat',
  'Zonguldak',
];

// ── Ana Bileşen ────────────────────────────────────────────────────────────
interface Props {
  initialFromCity?: string;
  initialToCity?:   string;
  initialMode?:     'all' | 'contract';
}

export default function RadarClient({
  initialFromCity = '',
  initialToCity   = '',
  initialMode     = 'all',
}: Props) {
  // Filtre state — URL param'larından pre-populate
  const [fromCity, setFromCity] = useState(initialFromCity);
  const [toCity, setToCity]     = useState(initialToCity);
  const [days, setDays]         = useState(30);
  const [mode, setMode]         = useState<'all' | 'contract'>(initialMode);

  // Veri state
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [stats, setStats]           = useState<RouteStats | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searched, setSearched]     = useState(false);

  // Genişletilmiş satır (raw_text preview)
  const [expandedRows, setExpanded] = useState<Set<string>>(new Set());

  // History drawer
  const [historyPhone, setHistoryPhone]       = useState<string | null>(null);
  const [historyData, setHistoryData]         = useState<HistoryListing[]>([]);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState<Set<string>>(new Set());

  // Gölge profil düzenleme drawer
  const [editLead, setEditLead]   = useState<Lead | null>(null);
  const [editForm, setEditForm]   = useState({ name: '', company_name: '', notes: '', status: 'active', etiket: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Arama ──────────────────────────────────────────────────────────────
  const search = useCallback(async (overrideMode?: 'all' | 'contract') => {
    if (!fromCity.trim() && !toCity.trim()) {
      setError('En az kalkış veya varış ili seçmelisiniz.');
      return;
    }
    setLoading(true);
    setError('');
    setLeads([]);
    setStats(null);

    const activeMode = overrideMode ?? mode;
    const params = new URLSearchParams({
      from_city: fromCity,
      to_city: toCity,
      days: String(days),
      mode: activeMode,
    });

    try {
      const res  = await fetch(`/api/admin/radar?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sunucu hatası');
      setLeads(json.leads ?? []);
      setStats(json.route_stats ?? null);
      setSearched(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fromCity, toCity, days, mode]);

  // URL param'larından gelindiyse otomatik ara
  useEffect(() => {
    if (initialFromCity || initialToCity) {
      search();
    }
  }, []); // eslint-disable-line

  // Mode toggle — anlık olarak tekrar arama yapar
  function toggleMode(newMode: 'all' | 'contract') {
    setMode(newMode);
    if (searched) search(newMode);
  }

  // Raw text satırı genişlet/daralt
  function toggleRow(phone: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(phone) ? next.delete(phone) : next.add(phone);
      return next;
    });
  }

  // Geçmiş drawer aç
  async function openHistory(phone: string) {
    setHistoryPhone(phone);
    setHistoryData([]);
    setHistoryExpanded(new Set());
    setHistoryLoading(true);
    try {
      const res  = await fetch(`/api/admin/radar?phone=${encodeURIComponent(phone)}`);
      const json = await res.json();
      setHistoryData(json.listings ?? []);
    } catch {
      // sessiz hata
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistoryRow(id: string) {
    setHistoryExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Gölge profil düzenleme drawer aç
  function openEdit(lead: Lead) {
    setEditLead(lead);
    setEditForm({
      name:         lead.display_name    ?? '',
      company_name: lead.company_name    ?? '',
      notes:        '',
      status:       'active',
      etiket:       lead.etiket          ?? '',
    });
    setEditMsg(null);
  }

  // Gölge profil kaydet
  async function saveEdit() {
    if (!editLead?.shadow_profile_id) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      const res = await fetch('/api/admin/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:           editLead.shadow_profile_id,
          name:         editForm.name         || null,
          company_name: editForm.company_name || null,
          notes:        editForm.notes        || null,
          status:       editForm.status,
          etiket:       editForm.etiket       || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sunucu hatası');
      // Local state güncelle
      setLeads(prev => prev.map(l =>
        l.phone === editLead.phone
          ? { ...l, display_name: editForm.name || null, company_name: editForm.company_name || null, etiket: editForm.etiket || null }
          : l
      ));
      setEditMsg({ type: 'ok', text: 'Kaydedildi ✓' });
    } catch (e: any) {
      setEditMsg({ type: 'err', text: e.message });
    } finally {
      setEditSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Mode Toggle ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 10, padding: 4, marginBottom: 20,
        width: 'fit-content',
      }}>
        {([
          { id: 'all',      icon: '⚡', label: 'Anlık Boş Araç Doldur' },
          { id: 'contract', icon: '📈', label: 'Kontratlı İş / Proje Bul' },
        ] as const).map(m => (
          <button
            key={m.id}
            onClick={() => toggleMode(m.id)}
            style={{
              background: mode === m.id ? '#22c55e' : 'transparent',
              color: mode === m.id ? '#0d1117' : '#8b949e',
              border: 'none', borderRadius: 7,
              padding: '9px 22px', cursor: 'pointer',
              fontSize: '0.88rem', fontWeight: mode === m.id ? 800 : 500,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ── Filtre Çubuğu ────────────────────────────────────────────────── */}
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 12, padding: '20px 24px',
        display: 'flex', flexWrap: 'wrap', gap: 14,
        alignItems: 'flex-end', marginBottom: 24,
      }}>
        {/* Kalkış */}
        <div>
          <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📍 Kalkış İli
          </div>
          <select
            value={fromCity}
            onChange={e => setFromCity(e.target.value)}
            style={selectStyle}
          >
            <option value="">Seçiniz…</option>
            {SEHIRLER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ color: '#4b5563', fontSize: '1.2rem', paddingBottom: 4 }}>→</div>

        {/* Varış */}
        <div>
          <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏁 Varış İli
          </div>
          <select
            value={toCity}
            onChange={e => setToCity(e.target.value)}
            style={selectStyle}
          >
            <option value="">Seçiniz…</option>
            {SEHIRLER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Tarih aralığı */}
        <div>
          <div style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 Dönem
          </div>
          <select
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
            style={selectStyle}
          >
            <option value={7}>Son 7 gün</option>
            <option value={14}>Son 14 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={60}>Son 60 gün</option>
            <option value={90}>Son 90 gün</option>
          </select>
        </div>

        {/* Arama butonu */}
        <button
          onClick={() => search()}
          disabled={loading || (!fromCity && !toCity)}
          style={{
            background: loading ? '#1a3a2a' : '#22c55e',
            color: '#0d1117', border: 'none', borderRadius: 9,
            padding: '10px 28px', fontWeight: 800, fontSize: '0.92rem',
            cursor: loading || (!fromCity && !toCity) ? 'not-allowed' : 'pointer',
            opacity: !fromCity && !toCity ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '⏳ Taranıyor…' : '🔍 Radar Tara'}
        </button>

        {/* Hata */}
        {error && (
          <div style={{ color: '#f87171', fontSize: '0.82rem', alignSelf: 'center' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* ── İstatistik Bandı ─────────────────────────────────────────────── */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          {[
            { label: `İlan (son ${days} gün)`, val: stats.total_listings_last_30_days, color: '#22c55e' },
            { label: 'Tekil Yayıncı', val: stats.unique_publishers, color: '#60a5fa' },
            { label: 'Tespit Edilen Lead', val: leads.length, color: '#a78bfa' },
            {
              label: 'Kontratlı Potansiyel',
              val: leads.filter(l => l.route_analytics.classification === 'CONTRACT_POTENTIAL').length,
              color: '#f59e0b',
            },
          ].map(s => (
            <div key={s.label} style={{
              background: '#161b22', border: '1px solid #21262d',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: '1.6rem' }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lead Tablosu ─────────────────────────────────────────────────── */}
      {searched && !loading && (
        leads.length === 0 ? (
          <div style={{
            background: '#161b22', border: '1px solid #21262d',
            borderRadius: 12, padding: '48px 24px',
            textAlign: 'center', color: '#4b5563',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
            <div>Bu rotada kayıt bulunamadı.</div>
            {mode === 'contract' && (
              <div style={{ fontSize: '0.8rem', marginTop: 8, color: '#374151' }}>
                Kontratlı modunda sadece yüksek frekanslı / düzenlilik kelimesi içerenler gösteriliyor.
              </div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #21262d' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#161b22', borderBottom: '2px solid #30363d' }}>
                  {[
                    'Telefon', 'Profil', 'Durum', 'Rota Hacmi',
                    'Aktif Gün', 'Son İlan', 'Sınıf', 'Ham Mesaj', 'Aksiyonlar',
                  ].map(h => (
                    <th key={h} style={{
                      padding: '11px 14px', textAlign: 'left',
                      color: '#8b949e', fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => {
                  const isExpanded = expandedRows.has(lead.phone);
                  const isContract = lead.route_analytics.classification === 'CONTRACT_POTENTIAL';
                  return (
                    <>
                      <tr
                        key={lead.phone}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid #21262d',
                          background: isContract
                            ? (i % 2 === 0 ? '#130f00' : '#160f00')
                            : (i % 2 === 0 ? '#0d1117' : '#0f1520'),
                        }}
                      >
                        {/* Telefon */}
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: '#e2e8f0', whiteSpace: 'nowrap' }}>
                          {lead.phone}
                        </td>

                        {/* Profil */}
                        <td style={{ padding: '11px 14px', maxWidth: 180 }}>
                          {lead.display_name && (
                            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.82rem' }}>{lead.display_name}</div>
                          )}
                          {lead.company_name && (
                            <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>{lead.company_name}</div>
                          )}
                          {!lead.display_name && !lead.company_name && (
                            <span style={{ color: '#374151', fontSize: '0.78rem' }}>— Bilinmiyor</span>
                          )}
                          {lead.etiket && <div style={{ marginTop: 3 }}>{etiketBadge(lead.etiket)}</div>}
                        </td>

                        {/* Kayıt durumu */}
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {lead.is_registered ? (
                            <span style={{ background: '#0d2818', color: '#22c55e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                              ✅ Kayıtlı
                            </span>
                          ) : (
                            <span style={{ background: '#1e293b', color: '#64748b', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                              👤 Gölge
                            </span>
                          )}
                        </td>

                        {/* Hacim */}
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            background: lead.route_analytics.total_loads >= 10 ? '#2d1a00' : '#1a2020',
                            color: lead.route_analytics.total_loads >= 10 ? '#f59e0b' : '#22c55e',
                            fontWeight: 800, padding: '2px 10px', borderRadius: 6, fontSize: '0.9rem',
                          }}>
                            {lead.route_analytics.total_loads}
                          </span>
                          <span style={{ color: '#4b5563', fontSize: '0.72rem', marginLeft: 6 }}>
                            1y / son {days}g: {lead.route_analytics.recent_loads}
                          </span>
                        </td>

                        {/* Aktif gün */}
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            color: lead.route_analytics.unique_active_days >= 8 ? '#f59e0b' : '#8b949e',
                            fontWeight: lead.route_analytics.unique_active_days >= 8 ? 800 : 400,
                          }}>
                            {lead.route_analytics.unique_active_days} gün
                          </span>
                        </td>

                        {/* Son ilan */}
                        <td style={{ padding: '11px 14px', color: '#8b949e', whiteSpace: 'nowrap' }}>
                          {tarih(lead.last_listing_at)}
                        </td>

                        {/* Sınıf + tags */}
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {classificationBadge(lead.route_analytics.classification)}
                            {lead.tags.map((tag, ti) => (
                              <span key={ti} style={{
                                background: '#1a1200', color: '#a78bfa',
                                fontSize: '0.62rem', fontWeight: 600,
                                padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Ham mesaj önizleme */}
                        <td style={{ padding: '11px 14px', maxWidth: 220 }}>
                          {lead.recent_raw_texts.length > 0 ? (
                            <button
                              onClick={() => toggleRow(lead.phone)}
                              style={{
                                background: 'transparent', border: 'none',
                                color: '#4b9eff', fontSize: '0.75rem',
                                cursor: 'pointer', textAlign: 'left', padding: 0,
                              }}
                            >
                              {isExpanded ? '▲ Gizle' : `▼ ${lead.recent_raw_texts.length} mesaj`}
                            </button>
                          ) : (
                            <span style={{ color: '#374151', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>

                        {/* Aksiyonlar */}
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* WA Mesaj */}
                            <a
                              href={waLink(lead.phone, fromCity, toCity)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="WhatsApp'tan mesaj gönder"
                              style={actionBtnStyle('#0d2818', '#22c55e')}
                            >
                              💬 WA
                            </a>

                            {/* Davet (sadece gölge profil) */}
                            {!lead.is_registered && (
                              <a
                                href={inviteLink(lead.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Platforma davet et"
                                style={actionBtnStyle('#1e293b', '#60a5fa')}
                              >
                                🔗 Davet
                              </a>
                            )}

                            {/* Geçmiş */}
                            <button
                              onClick={() => openHistory(lead.phone)}
                              title="Tüm ilan geçmişini incele"
                              style={actionBtnStyle('#1a0d2a', '#a78bfa', true)}
                            >
                              🕵️ Geçmiş
                            </button>

                            {/* Gölge profil düzenle */}
                            {lead.shadow_profile_id && (
                              <button
                                onClick={() => openEdit(lead)}
                                title="Gölge profili düzenle"
                                style={actionBtnStyle('#0d1a2a', '#38bdf8', true)}
                              >
                                ✏️ Profil
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Ham mesaj satırı */}
                      {isExpanded && lead.recent_raw_texts.length > 0 && (
                        <tr
                          key={`${lead.phone}-raw`}
                          style={{ background: '#090d12', borderBottom: '1px solid #21262d' }}
                        >
                          <td colSpan={9} style={{ padding: '10px 14px 14px 52px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {lead.recent_raw_texts.map((txt, ti) => (
                                <pre key={ti} style={{
                                  margin: 0, background: '#0d1117',
                                  border: '1px solid #1a2535', borderRadius: 7,
                                  padding: '10px 14px', fontSize: '0.75rem',
                                  color: '#94a3b8', whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word', fontFamily: 'monospace',
                                  maxHeight: 140, overflowY: 'auto',
                                }}>
                                  {txt}
                                </pre>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Gölge Profil Düzenleme Drawer ──────────────────────────────────── */}
      {editLead && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          onClick={e => { if (e.target === e.currentTarget) setEditLead(null); }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 440,
            background: '#0d1117', borderLeft: '1px solid #30363d',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Başlık */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #21262d',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.95rem' }}>
                  ✏️ Gölge Profil Düzenle
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.78rem', fontFamily: 'monospace', marginTop: 3 }}>
                  {editLead.phone}
                </div>
              </div>
              <button
                onClick={() => setEditLead(null)}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* İsim */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>İsim / Ad Soyad</span>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ahmet Yılmaz"
                  style={inputStyle}
                />
              </label>

              {/* Şirket */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Şirket Adı</span>
                <input
                  value={editForm.company_name}
                  onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Yılmaz Nakliyat Ltd."
                  style={inputStyle}
                />
              </label>

              {/* Durum */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Durum</span>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="active">✅ Aktif</option>
                  <option value="blocked">🚫 Engelli</option>
                  <option value="converted">🎉 Dönüştürüldü</option>
                </select>
              </label>

              {/* Etiket */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Etiket</span>
                <select
                  value={editForm.etiket}
                  onChange={e => setEditForm(f => ({ ...f, etiket: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Etiket yok</option>
                  <option value="vip">⭐ VIP</option>
                  <option value="guvenilir">✅ Güvenilir</option>
                  <option value="normal">○ Normal</option>
                  <option value="suphelı">⚠️ Şüpheli</option>
                  <option value="spam">🚫 Spam</option>
                </select>
              </label>

              {/* Notlar */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: '#8b949e', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notlar</span>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="İç notlar…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                style={{
                  background: editSaving ? '#1a3a2a' : '#22c55e',
                  color: '#0d1117', border: 'none', borderRadius: 8,
                  padding: '9px 24px', fontWeight: 800, fontSize: '0.88rem',
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {editSaving ? '⏳ Kaydediliyor…' : '💾 Kaydet'}
              </button>
              <button
                onClick={() => setEditLead(null)}
                style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 8, padding: '9px 18px', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                İptal
              </button>
              {editMsg && (
                <span style={{ fontSize: '0.82rem', color: editMsg.type === 'ok' ? '#22c55e' : '#f87171', marginLeft: 4 }}>
                  {editMsg.text}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── History Drawer ───────────────────────────────────────────────── */}
      {historyPhone && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300 }}
          onClick={e => { if (e.target === e.currentTarget) setHistoryPhone(null); }}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 560,
            background: '#0d1117', borderLeft: '1px solid #30363d',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Başlık */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #21262d',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1rem', fontFamily: 'monospace' }}>
                  {historyPhone}
                </div>
                <div style={{ color: '#8b949e', fontSize: '0.78rem', marginTop: 2 }}>
                  Tüm İlan Geçmişi
                </div>
              </div>
              <button
                onClick={() => setHistoryPhone(null)}
                style={{ background: 'transparent', border: 'none', color: '#8b949e', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Aksiyonlar şerit */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #21262d', display: 'flex', gap: 10 }}>
              <a
                href={waLink(historyPhone, fromCity, toCity)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...actionBtnStyle('#0d2818', '#22c55e'), textDecoration: 'none', padding: '8px 16px', fontSize: '0.82rem' }}
              >
                💬 WhatsApp Mesaj Gönder
              </a>
              <a
                href={inviteLink(historyPhone)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...actionBtnStyle('#1e293b', '#60a5fa'), textDecoration: 'none', padding: '8px 16px', fontSize: '0.82rem' }}
              >
                🔗 Platforma Davet Et
              </a>
            </div>

            {/* İlan listesi */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {historyLoading ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: '#8b949e' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>⏳</div>
                  <div>Yükleniyor…</div>
                </div>
              ) : historyData.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: '#4b5563' }}>
                  Kayıt bulunamadı.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ color: '#8b949e', fontSize: '0.78rem', marginBottom: 4 }}>
                    {historyData.length} ilan — kronolojik sırayla
                  </div>
                  {historyData.map(l => {
                    const stops = [...(l.listing_stops || [])].sort((a, b) => a.stop_order - b.stop_order);
                    const rota = stops.length > 0
                      ? `${l.origin_city ?? '?'} → ${stops.map(s => s.city).join(' → ')}`
                      : (l.origin_city ?? '—');
                    return (
                      <div key={l.id} style={{
                        background: '#161b22', border: '1px solid #21262d',
                        borderRadius: 9, padding: '12px 14px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.83rem' }}>
                              {l.listing_type === 'yuk' ? '📦 Yük' : '🚛 Araç'} — {rota}
                            </span>
                            <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                              <span style={{
                                background: '#0d2818', color: '#22c55e',
                                fontSize: '0.62rem', fontWeight: 700,
                                padding: '1px 6px', borderRadius: 4,
                              }}>
                                {l.moderation_status}
                              </span>
                              {l.vehicle_type?.map(v => (
                                <span key={v} style={{
                                  background: '#1e293b', color: '#94a3b8',
                                  fontSize: '0.62rem', fontWeight: 600,
                                  padding: '1px 6px', borderRadius: 4,
                                }}>
                                  {v}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span style={{ color: '#4b5563', fontSize: '0.72rem', whiteSpace: 'nowrap', marginLeft: 10 }}>
                            {tarih(l.created_at)}
                          </span>
                        </div>
                        {l.raw_text && (
                          <div>
                            <button
                              onClick={() => toggleHistoryRow(l.id)}
                              style={{
                                background: 'transparent', border: 'none',
                                color: '#4b9eff', fontSize: '0.72rem',
                                cursor: 'pointer', padding: 0,
                              }}
                            >
                              {historyExpanded.has(l.id) ? '▲ Ham metni gizle' : '▼ Ham metni göster'}
                            </button>
                            {historyExpanded.has(l.id) && (
                              <pre style={{
                                marginTop: 8, background: '#0d1117',
                                border: '1px solid #30363d', borderRadius: 6,
                                padding: '10px 12px', fontSize: '0.73rem',
                                color: '#94a3b8', whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word', fontFamily: 'monospace',
                                maxHeight: 200, overflowY: 'auto',
                              }}>
                                {l.raw_text}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Stil sabitleri ─────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  background: '#0d1117',
  border: '1px solid #30363d',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: '0.88rem',
  outline: 'none',
  minWidth: 160,
};

const inputStyle: React.CSSProperties = {
  background: '#161b22',
  border: '1px solid #30363d',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: '0.88rem',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function actionBtnStyle(bg: string, color: string, isButton = false): React.CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${color}33`,
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    ...(isButton ? {} : {}),
  };
}
