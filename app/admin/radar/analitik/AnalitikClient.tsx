'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Tipler ─────────────────────────────────────────────────────────────────
interface CityRow {
  city: string;
  listing_count: number;
  unique_senders: number;
  last_at: string | null;
}

interface CounterpartRow {
  city: string;
  count: number;
  senders: number;
}

interface VehicleRow {
  type: string;
  count: number;
}

interface DailyRow {
  day: string;
  count: number;
}

interface CityDetail {
  city: string;
  direction: string;
  total: number;
  unique_senders: number;
  counterparts: CounterpartRow[];
  vehicle_types: VehicleRow[];
  daily: DailyRow[];
}

type Direction = 'departure' | 'arrival';

// ── Yardımcı: CSS bar ──────────────────────────────────────────────────────
function Bar({
  value, max, color = '#22c55e', height = 6,
}: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ background: '#1a2030', borderRadius: height, overflow: 'hidden', height }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color,
        borderRadius: height, transition: 'width 0.4s ease',
        minWidth: pct > 0 ? 4 : 0,
      }} />
    </div>
  );
}

// ── Sparkline (SVG inline) ─────────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 28 }: { data: DailyRow[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = i * step;
    const y = height - Math.round((d.count / max) * (height - 4)) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', width: '100%', maxWidth: width }}>
      <polyline
        points={pts}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

// ── Renk havuzu (araç tipleri için) ───────────────────────────────────────
const VT_COLORS = ['#22c55e','#60a5fa','#f59e0b','#a78bfa','#f87171','#34d399','#fb923c','#e879f9','#38bdf8','#84cc16','#facc15','#94a3b8'];

// ── Ana Bileşen ────────────────────────────────────────────────────────────
export default function AnalitikClient() {
  const [days, setDays]             = useState(30);
  const [direction, setDirection]   = useState<Direction>('departure');
  const [cities, setCities]         = useState<CityRow[]>([]);
  const [citiesLoading, setCL]      = useState(false);
  const [citiesError, setCitiesErr] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const [selected, setSelected]     = useState<string | null>(null);
  const [detail, setDetail]         = useState<CityDetail | null>(null);
  const [detailLoading, setDL]      = useState(false);
  const [detailError, setDetailErr] = useState('');

  const [subSelected, setSubSelected] = useState<string | null>(null);

  // Rota bazlı (şehir çifti) araç tipi + aktivite verisi
  const [routeDetail, setRouteDetail]   = useState<Pick<CityDetail, 'total' | 'unique_senders' | 'vehicle_types' | 'daily'> | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // ── Şehir listesini yükle ──────────────────────────────────────────────
  const loadCities = useCallback(async (d: number) => {
    setCL(true);
    setCitiesErr('');
    setSelected(null);
    setDetail(null);
    setSubSelected(null);
    try {
      const res  = await fetch(`/api/admin/radar/analitik?view=overview&days=${d}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'API hatası');
      setCities(json.cities ?? []);
    } catch (e: any) {
      setCitiesErr(e.message);
      setCities([]);
    }
    setCL(false);
  }, []);

  useEffect(() => { loadCities(days); }, []); // eslint-disable-line

  // ── Şehir detayını yükle ──────────────────────────────────────────────
  const loadDetail = useCallback(async (city: string, dir: Direction, d: number) => {
    setDL(true);
    setDetail(null);
    setDetailErr('');
    setSubSelected(null);
    try {
      const res  = await fetch(
        `/api/admin/radar/analitik?view=city&city=${encodeURIComponent(city)}&direction=${dir}&days=${d}`
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'API hatası');
      setDetail(json);
    } catch (e: any) {
      setDetailErr(e.message);
    }
    setDL(false);
  }, []);

  // ── Rota detayını yükle (subSelected seçilince) ───────────────────────
  const loadRouteDetail = useCallback(async (city: string, dir: Direction, counterpart: string, d: number) => {
    setRouteLoading(true);
    setRouteDetail(null);
    try {
      const res  = await fetch(
        `/api/admin/radar/analitik?view=city&city=${encodeURIComponent(city)}&direction=${dir}&days=${d}&counterpart=${encodeURIComponent(counterpart)}`
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'API hatası');
      setRouteDetail({
        total:          json.total,
        unique_senders: json.unique_senders,
        vehicle_types:  json.vehicle_types ?? [],
        daily:          json.daily ?? [],
      });
    } catch {
      setRouteDetail(null);
    }
    setRouteLoading(false);
  }, []);

  function selectCity(city: string) {
    setSelected(city);
    setSubSelected(null);
    setRouteDetail(null);
    loadDetail(city, direction, days);
  }

  function changeDirection(dir: Direction) {
    setDirection(dir);
    setSubSelected(null);
    setRouteDetail(null);
    if (selected) loadDetail(selected, dir, days);
  }

  function changeDays(d: number) {
    setDays(d);
    loadCities(d);
    setSubSelected(null);
    setRouteDetail(null);
    if (selected) loadDetail(selected, direction, d);
  }

  function selectSubCity(city: string) {
    const next = subSelected === city ? null : city;
    setSubSelected(next);
    if (next && selected) {
      loadRouteDetail(selected, direction, next, days);
    } else {
      setRouteDetail(null);
    }
  }

  // Filtreli şehir listesi
  const filteredCities = cities.filter(c =>
    !citySearch || c.city.toLowerCase().includes(citySearch.toLowerCase())
  );
  // Bar oranı tüm veri üzerinden (filtre bar boyutunu bozmasın)
  const maxCount = cities[0]?.listing_count ?? 1;

  // Karşı şehirde maks değer
  const maxCounterpart = detail?.counterparts?.[0]?.count ?? 1;

  // Araç/aktivite: rota seçiliyse routeDetail, yoksa detail
  const activeVT    = (routeDetail ?? detail)?.vehicle_types ?? [];
  const activeDaily = (routeDetail ?? detail)?.daily ?? [];
  const activeTotal = (routeDetail ?? detail)?.total ?? detail?.total ?? 0;
  const maxVT       = activeVT[0]?.count ?? 1;

  // Radar sayfasına link (lead arama)
  function radarLink(from: string | null, to: string | null) {
    const params = new URLSearchParams();
    if (from) params.set('from_city', from);
    if (to)   params.set('to_city', to);
    return `/admin/radar?${params}`;
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .analitik-main-grid { display: grid; grid-template-columns: 280px 1fr; gap: 14px; align-items: start; }
        .analitik-detail-grid { display: grid; grid-template-columns: 1fr 340px; gap: 14px; }
        .analitik-city-scroll { max-height: calc(100vh - 280px); overflow-y: auto; }
        @media (max-width: 768px) {
          .analitik-main-grid { grid-template-columns: 1fr !important; }
          .analitik-detail-grid { grid-template-columns: 1fr !important; }
          .analitik-city-scroll { max-height: 280px !important; }
        }
      `}</style>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Yön toggle */}
        <div style={{ display: 'flex', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 3, gap: 2 }}>
          {([
            { id: 'departure', label: '📤 Çıkış' },
            { id: 'arrival',   label: '📥 Varış'  },
          ] as const).map(d => (
            <button key={d.id} onClick={() => changeDirection(d.id)} style={{
              background: direction === d.id ? '#22c55e' : 'transparent',
              color: direction === d.id ? '#0d1117' : '#8b949e',
              border: 'none', borderRadius: 6, padding: '7px 16px',
              fontSize: '0.82rem', fontWeight: direction === d.id ? 800 : 500, cursor: 'pointer',
            }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Dönem */}
        <div style={{ display: 'flex', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 3, gap: 2 }}>
          {[7, 14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => changeDays(d)} style={{
              background: days === d ? '#1e3a5f' : 'transparent',
              color: days === d ? '#60a5fa' : '#8b949e',
              border: 'none', borderRadius: 6, padding: '7px 12px',
              fontSize: '0.8rem', fontWeight: days === d ? 700 : 400, cursor: 'pointer',
            }}>
              {d}g
            </button>
          ))}
        </div>

        {/* Özet badge */}
        {cities.length > 0 && (
          <span style={{ color: '#4b5563', fontSize: '0.78rem', marginLeft: 6 }}>
            {cities.length} şehir · {cities.reduce((a, c) => a + c.listing_count, 0).toLocaleString('tr-TR')} ilan
          </span>
        )}
      </div>

      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
        <button onClick={() => { setSelected(null); setDetail(null); setSubSelected(null); }}
          style={{ background: 'none', border: 'none', color: selected ? '#22c55e' : '#e2e8f0', cursor: selected ? 'pointer' : 'default', fontWeight: selected ? 500 : 700, padding: 0, fontSize: '0.82rem' }}>
          🗺️ Tüm Türkiye
        </button>
        {selected && (
          <>
            <span style={{ color: '#30363d' }}>›</span>
            <button onClick={() => { setSubSelected(null); }}
              style={{ background: 'none', border: 'none', color: subSelected ? '#22c55e' : '#e2e8f0', cursor: subSelected ? 'pointer' : 'default', fontWeight: subSelected ? 500 : 700, padding: 0, fontSize: '0.82rem' }}>
              {direction === 'departure' ? '📤' : '📥'} {selected}
            </button>
          </>
        )}
        {subSelected && (
          <>
            <span style={{ color: '#30363d' }}>›</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>
              {direction === 'departure' ? `→ ${subSelected}` : `← ${subSelected}`}
            </span>
            <a
              href={direction === 'departure' ? radarLink(selected, subSelected) : radarLink(subSelected, selected)}
              target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 8, background: '#22c55e', color: '#0d1117', fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 5, textDecoration: 'none' }}
            >
              🔍 Leadleri Gör →
            </a>
          </>
        )}
      </div>

      {/* ── Ana İçerik: Sol + Sağ ─────────────────────────────────────── */}
      <div className="analitik-main-grid">

        {/* ── Sol Panel: Şehir Listesi ─────────────────────────────── */}
        <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #21262d' }}>
            <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              {direction === 'departure' ? '📤 Kalkış Şehirleri' : '📥 Varış Şehirleri'}
            </div>
            <input
              placeholder="Şehir ara…"
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #30363d',
                color: '#e2e8f0', borderRadius: 7, padding: '7px 10px',
                fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div className="analitik-city-scroll">
            {citiesLoading ? (
              <div style={{ padding: '32px 14px', textAlign: 'center', color: '#4b5563', fontSize: '0.82rem' }}>Yükleniyor…</div>
            ) : citiesError ? (
              <div style={{ padding: '16px 14px' }}>
                <div style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '12px 14px', color: '#f87171', fontSize: '0.78rem', lineHeight: 1.6 }}>
                  <strong>⚠️ API Hatası:</strong><br />{citiesError}
                </div>
                <div style={{ marginTop: 10, color: '#4b5563', fontSize: '0.74rem', lineHeight: 1.6 }}>
                  SQL fonksiyonları Supabase'de henüz çalıştırılmamış olabilir.<br />
                  <code style={{ color: '#8b949e' }}>docs/20260604_radar_analitik_rpc.sql</code> dosyasını Supabase SQL Editor'da çalıştırın.
                </div>
                <button
                  onClick={() => loadCities(days)}
                  style={{ marginTop: 10, background: '#161b22', border: '1px solid #30363d', color: '#8b949e', borderRadius: 6, padding: '6px 12px', fontSize: '0.76rem', cursor: 'pointer' }}
                >
                  🔄 Tekrar Dene
                </button>
              </div>
            ) : filteredCities.length === 0 ? (
              <div style={{ padding: '32px 14px', textAlign: 'center', color: '#4b5563', fontSize: '0.82rem' }}>
                {citySearch ? 'Şehir bulunamadı' : 'Bu dönemde ilan yok'}
              </div>
            ) : filteredCities.map((c, i) => {
              const isActive = selected === c.city;
              return (
                <button
                  key={c.city}
                  onClick={() => selectCity(c.city)}
                  style={{
                    width: '100%', background: isActive ? '#0d2818' : 'transparent',
                    border: 'none', borderBottom: '1px solid #21262d',
                    padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                    borderLeft: isActive ? '3px solid #22c55e' : '3px solid transparent',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ color: isActive ? '#22c55e' : '#e2e8f0', fontWeight: isActive ? 700 : 500, fontSize: '0.84rem' }}>
                      {i + 1 <= 3 ? ['🥇','🥈','🥉'][i] + ' ' : ''}{c.city}
                    </span>
                    <span style={{
                      color: isActive ? '#22c55e' : '#8b949e',
                      fontWeight: 800, fontSize: '0.84rem',
                    }}>
                      {c.listing_count}
                    </span>
                  </div>
                  <Bar value={c.listing_count} max={maxCount} color={isActive ? '#22c55e' : '#2d4a3e'} height={4} />
                  <div style={{ color: '#4b5563', fontSize: '0.68rem', marginTop: 3 }}>
                    {c.unique_senders} kişi
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sağ Panel ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Boş durum */}
          {!selected && !citiesLoading && (
            <div style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
              padding: '60px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 14 }}>📊</div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
                Bir şehir seçin
              </div>
              <div style={{ color: '#4b5563', fontSize: '0.85rem', lineHeight: 1.7 }}>
                Sol listeden şehre tıklayın.<br />
                {direction === 'departure'
                  ? 'O şehirden nereye, ne kadar ilan var göreceksiniz.'
                  : 'O şehre nereden ne kadar ilan var göreceksiniz.'}
              </div>
              {cities.length > 0 && (
                <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {cities.slice(0, 5).map(c => (
                    <button key={c.city} onClick={() => selectCity(c.city)} style={{
                      background: '#0d1117', border: '1px solid #30363d', color: '#22c55e',
                      borderRadius: 8, padding: '8px 16px', fontSize: '0.82rem', cursor: 'pointer',
                      fontWeight: 600,
                    }}>
                      {c.city} <span style={{ color: '#4b5563' }}>{c.listing_count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detay hata */}
          {detailError && !detailLoading && (
            <div style={{ background: '#2d0a0a', border: '1px solid #7f1d1d', borderRadius: 12, padding: '20px 24px', color: '#f87171', fontSize: '0.82rem', lineHeight: 1.7 }}>
              <strong>⚠️ Hata:</strong> {detailError}
            </div>
          )}

          {/* Yükleniyor */}
          {detailLoading && (
            <div style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
              padding: '60px 24px', textAlign: 'center', color: '#8b949e',
            }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>⏳</div>
              <div>{selected} analiz ediliyor…</div>
            </div>
          )}

          {/* Detay */}
          {detail && !detailLoading && (
            <>
              {/* ── Stat Kartları ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {[
                  {
                    label: subSelected
                      ? (direction === 'departure' ? `${detail.city} → ${subSelected}` : `${subSelected} → ${detail.city}`)
                      : (direction === 'departure' ? `${detail.city} çıkışlı ilan` : `${detail.city} varışlı ilan`),
                    val: (routeDetail ?? detail).total.toLocaleString('tr-TR'),
                    color: '#22c55e', sub: subSelected ? 'rota ilanı' : `son ${days} gün`,
                  },
                  {
                    label: 'Tekil Gönderici',
                    val: (routeDetail ?? detail).unique_senders.toLocaleString('tr-TR'),
                    color: '#60a5fa', sub: 'farklı numara',
                  },
                  { label: 'Varış Noktası', val: detail.counterparts.length, color: '#a78bfa', sub: 'farklı şehir' },
                  { label: 'Araç Tipi', val: activeVT.length, color: '#f59e0b', sub: 'çeşit' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '14px 16px',
                  }}>
                    <div style={{ color: '#4b5563', fontSize: '0.7rem', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ color: s.color, fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.1 }}>{val(s.val)}</div>
                    <div style={{ color: '#374151', fontSize: '0.68rem', marginTop: 3 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="analitik-detail-grid">

                {/* ── Karşı Şehirler (bar chart) ── */}
                <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {direction === 'departure'
                        ? `📍 ${detail.city}'dan nereye?`
                        : `📍 ${detail.city}'a nereden?`}
                    </div>
                    {selected && (
                      <a
                        href={direction === 'departure' ? radarLink(selected, null) : radarLink(null, selected)}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#4b9eff', fontSize: '0.72rem', textDecoration: 'none' }}
                      >
                        Tüm leadler →
                      </a>
                    )}
                  </div>

                  {detail.counterparts.length === 0 ? (
                    <div style={{ padding: '32px 18px', color: '#4b5563', fontSize: '0.82rem', textAlign: 'center' }}>
                      Kayıt yok
                    </div>
                  ) : (
                    <div style={{ padding: '8px 0' }}>
                      {detail.counterparts.map((cp, i) => {
                        const isSubSel = subSelected === cp.city;
                        return (
                          <button
                            key={cp.city}
                            onClick={() => selectSubCity(cp.city)}
                            style={{
                              width: '100%', background: isSubSel ? '#0d1a2a' : 'transparent',
                              border: 'none', padding: '9px 18px', cursor: 'pointer', textAlign: 'left',
                              borderLeft: isSubSel ? '3px solid #60a5fa' : '3px solid transparent',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                              <span style={{ color: '#4b5563', fontSize: '0.7rem', width: 18, textAlign: 'right', flexShrink: 0 }}>
                                {i + 1}.
                              </span>
                              <span style={{ color: isSubSel ? '#60a5fa' : '#e2e8f0', fontWeight: isSubSel ? 700 : 500, fontSize: '0.85rem', flex: 1 }}>
                                {cp.city}
                              </span>
                              <span style={{ color: isSubSel ? '#60a5fa' : '#22c55e', fontWeight: 800, fontSize: '0.88rem', flexShrink: 0 }}>
                                {cp.count}
                              </span>
                              <span style={{ color: '#374151', fontSize: '0.7rem', flexShrink: 0, width: 52 }}>
                                {cp.senders} kişi
                              </span>
                            </div>
                            <div style={{ paddingLeft: 28 }}>
                              <Bar value={cp.count} max={maxCounterpart} color={isSubSel ? '#60a5fa' : '#22c55e'} height={5} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Sağ Kolon: Araç + Sparkline ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Araç Tipi */}
                  <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        🚛 Araç Tipi Dağılımı
                      </div>
                      {subSelected && (
                        <span style={{ color: '#60a5fa', fontSize: '0.66rem', fontWeight: 600 }}>
                          {routeLoading ? '⏳' : '📍 rota'}
                        </span>
                      )}
                    </div>
                    {routeLoading ? (
                      <div style={{ padding: '20px 18px', color: '#4b5563', fontSize: '0.8rem' }}>Yükleniyor…</div>
                    ) : activeVT.length === 0 ? (
                      <div style={{ padding: '20px 18px', color: '#4b5563', fontSize: '0.8rem' }}>Araç tipi bilgisi yok</div>
                    ) : (
                      <div style={{ padding: '10px 0 6px' }}>
                        {activeVT.map((vt, i) => {
                          const color = VT_COLORS[i % VT_COLORS.length];
                          const pct = Math.round((vt.count / (activeTotal || 1)) * 100);
                          return (
                            <div key={vt.type} style={{ padding: '6px 18px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{vt.type}</span>
                                <span style={{ color: color, fontWeight: 700, fontSize: '0.8rem' }}>
                                  {vt.count} <span style={{ color: '#374151', fontWeight: 400 }}>({pct}%)</span>
                                </span>
                              </div>
                              <Bar value={vt.count} max={maxVT} color={color} height={5} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Aktivite Grafiği */}
                  {(routeLoading || activeDaily.length > 1) && (
                    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ color: '#8b949e', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          📈 Günlük Aktivite
                        </div>
                        {subSelected && (
                          <span style={{ color: '#60a5fa', fontSize: '0.66rem', fontWeight: 600 }}>
                            {routeLoading ? '⏳' : '📍 rota'}
                          </span>
                        )}
                      </div>
                      {routeLoading ? (
                        <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>Yükleniyor…</div>
                      ) : (
                        <>
                          <Sparkline data={activeDaily} width={280} height={48} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            <span style={{ color: '#374151', fontSize: '0.66rem' }}>{activeDaily[0]?.day}</span>
                            <span style={{ color: '#374151', fontSize: '0.66rem' }}>{activeDaily[activeDaily.length - 1]?.day}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <div>
                              <div style={{ color: '#4b5563', fontSize: '0.66rem' }}>En Yoğun Gün</div>
                              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.82rem' }}>
                                {activeDaily.reduce((a, b) => b.count > a.count ? b : a, activeDaily[0])?.day} — {Math.max(...activeDaily.map(d => d.count))} ilan
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#4b5563', fontSize: '0.66rem' }}>Günlük Ort.</div>
                              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.82rem' }}>
                                {(activeTotal / Math.max(activeDaily.length, 1)).toFixed(1)} ilan
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Hızlı Aksiyon */}
                  {selected && (
                    <div style={{ background: '#0d1a12', border: '1px solid #1a3a2a', borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ color: '#22c55e', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                        ⚡ Hızlı Aksiyon
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <a
                          href={direction === 'departure' ? radarLink(selected, subSelected) : radarLink(subSelected, selected)}
                          target="_blank" rel="noopener noreferrer"
                          style={{
                            background: '#22c55e', color: '#0d1117',
                            fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none',
                            padding: '10px 14px', borderRadius: 8, textAlign: 'center',
                            display: 'block',
                          }}
                        >
                          🔍 {subSelected
                            ? (direction === 'departure'
                              ? `${selected} → ${subSelected} Leadleri`
                              : `${subSelected} → ${selected} Leadleri`)
                            : `${selected} Tüm Leadleri`}
                        </a>
                        {subSelected && (
                          <a
                            href={direction === 'departure' ? radarLink(selected, subSelected) + '&mode=contract' : radarLink(subSelected, selected) + '&mode=contract'}
                            target="_blank" rel="noopener noreferrer"
                            style={{
                              background: '#2d1a00', color: '#f59e0b',
                              fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none',
                              padding: '8px 14px', borderRadius: 8, textAlign: 'center',
                              display: 'block', border: '1px solid #78350f',
                            }}
                          >
                            📈 Sadece Kontratlı Potansiyeller
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// küçük yardımcı
function val(v: string | number) {
  return v;
}
