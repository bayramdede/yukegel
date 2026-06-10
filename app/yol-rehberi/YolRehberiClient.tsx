'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import PoiDetay from './PoiDetay';
import PoiEkleModal from './PoiEkleModal';

// React-Leaflet SSR'da çalışmaz — dynamic import ile client-only
const PoiHarita = dynamic(() => import('./PoiHarita'), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0d1117', color: '#8b949e', fontSize: 14,
    }}>
      Harita yükleniyor...
    </div>
  ),
});

// ── Tipler ───────────────────────────────────────────────────
export interface PoiItem {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  tags: string[];
  badges: Record<string, boolean>;
  avg_rating: number;
  review_count: number;
  is_emergency: boolean;
  distance_m: number | null;
  ranking_score: number;
}

export interface BoundingBox {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
}

// ── Kategori tanımları ────────────────────────────────────────
export const KATEGORILER = [
  { key: 'hepsi',           label: 'Hepsi',           icon: '🗺️',  pinColor: '#8b949e' },
  { key: 'park_dinlenme',   label: 'Park & Dinlenme', icon: '🅿️',  pinColor: '#3b82f6' },
  { key: 'yemek',           label: 'Yemek',           icon: '🍲',  pinColor: '#f97316' },
  { key: 'konaklama',       label: 'Konaklama',       icon: '🛏️',  pinColor: '#8b5cf6' },
  { key: 'tamirci',         label: 'Tamirci & Usta',  icon: '🛠️',  pinColor: '#ef4444' },
  { key: 'tesis_akaryakit', label: 'Tesis & Yakıt',   icon: '⛽',  pinColor: '#eab308' },
  { key: 'kantar_resmi',    label: 'Kantar & Resmi',  icon: '⚖️',  pinColor: '#6b7280' },
];

// Kategori bazlı hızlı etiketler (Tier 2 alt filtreler)
const ALT_ETIKETLER: Record<string, string[]> = {
  park_dinlenme:   ['Tır Park Yeri Var', '7/24 Açık', 'Güvenlik Kameralı', 'Duş İmkanı', 'WC'],
  yemek:           ['Sulu Yemek', 'Kamyoncu Dostu', 'Uygun Fiyat', '7/24 Açık', 'Paket Servis'],
  konaklama:       ['Tır Park Yeri Var', 'Duş İmkanı', 'Dorseyi Ayırmaya Gerek Yok', '7/24 Resepsiyon'],
  tamirci:         ['Nöbetçi', '7/24 Açık', 'Çekici', 'Lastik', 'Elektrik', 'Usta Dürüst'],
  tesis_akaryakit: ['Tır Girişine Uygun', 'Akaryakıt', 'Otopark', 'Duş', 'Kafe'],
  kantar_resmi:    ['Vezneli Kantar', 'Resmi Tartı', 'CMR', 'Geçiş Belgesi'],
};

// ── Ana bileşen ───────────────────────────────────────────────
export default function YolRehberiClient() {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aktifKategori, setAktifKategori] = useState('hepsi');
  const [aktifEtiketler, setAktifEtiketler] = useState<string[]>([]);
  const [sosAktif, setSosAktif] = useState(false);
  const [secilenPoi, setSecilenPoi] = useState<string | null>(null);
  const [ekleModalAcik, setEkleModalAcik] = useState(false);
  const [listeAcik, setListeAcik] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const bboxRef = useRef<BoundingBox | null>(null);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Kullanıcı konumunu al
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        () => {} // konum izni reddedilirse sessizce geç
      );
    }
  }, []);

  // POI'leri getir (debounced)
  const fetchPois = useCallback((bbox: BoundingBox) => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(async () => {
      setYukleniyor(true);
      try {
        const params = new URLSearchParams({
          min_lng: bbox.min_lng.toString(),
          min_lat: bbox.min_lat.toString(),
          max_lng: bbox.max_lng.toString(),
          max_lat: bbox.max_lat.toString(),
        });
        if (aktifKategori !== 'hepsi') params.set('category', aktifKategori);
        if (aktifEtiketler.length) params.set('tags', aktifEtiketler.join(','));
        if (sosAktif) params.set('emergency', 'true');
        if (userLat) params.set('lat', userLat.toString());
        if (userLng) params.set('lng', userLng.toString());

        const res = await fetch(`/api/poi?${params.toString()}`);
        const json = await res.json();
        if (json.success) setPois(json.data);
      } catch (err) {
        console.error('POI fetch hatası:', err);
      } finally {
        setYukleniyor(false);
      }
    }, 400);
  }, [aktifKategori, aktifEtiketler, sosAktif, userLat, userLng]);

  // Harita sınırları değişince yeniden çek
  const handleBoundsChange = useCallback((bbox: BoundingBox) => {
    bboxRef.current = bbox;
    fetchPois(bbox);
  }, [fetchPois]);

  // Filtre değişince mevcut bbox ile yeniden çek
  useEffect(() => {
    if (bboxRef.current) fetchPois(bboxRef.current);
  }, [aktifKategori, aktifEtiketler, sosAktif, fetchPois]);

  // Kategori seçimi — etiketleri sıfırla
  const handleKategori = (key: string) => {
    setAktifKategori(key);
    setAktifEtiketler([]);
    setSosAktif(false);
  };

  // Alt etiket toggle
  const toggleEtiket = (etiket: string) => {
    setAktifEtiketler(prev =>
      prev.includes(etiket) ? prev.filter(e => e !== etiket) : [...prev, etiket]
    );
  };

  const altEtiketler = aktifKategori !== 'hepsi' ? (ALT_ETIKETLER[aktifKategori] || []) : [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#0d1117', color: '#e6edf3', fontFamily: "'IBM Plex Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #21262d',
        background: '#161b22', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/" style={{ color: '#22c55e', fontWeight: 700, fontSize: 18, textDecoration: 'none' }}>
            Yükegel
          </a>
          <span style={{ color: '#8b949e', fontSize: 13 }}>/ Yol Rehberi</span>
        </div>
        <button
          onClick={() => setEkleModalAcik(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#22c55e', color: '#0d1117', border: 'none',
            borderRadius: 8, padding: '8px 14px', fontWeight: 600,
            fontSize: 13, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Yer Ekle
        </button>
      </header>

      {/* ── Kategori Chips (Tier 1) ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        overflowX: 'auto', flexShrink: 0,
        background: '#161b22', borderBottom: '1px solid #21262d',
        scrollbarWidth: 'none',
      }}>
        {KATEGORILER.map(k => (
          <button
            key={k.key}
            onClick={() => handleKategori(k.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20, border: 'none',
              background: aktifKategori === k.key ? k.pinColor : '#21262d',
              color: aktifKategori === k.key ? '#fff' : '#8b949e',
              fontWeight: aktifKategori === k.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            <span>{k.icon}</span>
            <span>{k.label}</span>
          </button>
        ))}
      </div>

      {/* ── Alt Etiketler (Tier 2) ── */}
      {altEtiketler.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 16px',
          overflowX: 'auto', flexShrink: 0,
          background: '#0d1117', borderBottom: '1px solid #21262d',
          scrollbarWidth: 'none',
        }}>
          {altEtiketler.map(etiket => (
            <button
              key={etiket}
              onClick={() => toggleEtiket(etiket)}
              style={{
                padding: '5px 12px', borderRadius: 16,
                border: `1px solid ${aktifEtiketler.includes(etiket) ? '#22c55e' : '#30363d'}`,
                background: aktifEtiketler.includes(etiket) ? '#14532d' : 'transparent',
                color: aktifEtiketler.includes(etiket) ? '#22c55e' : '#8b949e',
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              {etiket}
            </button>
          ))}
        </div>
      )}

      {/* ── Harita + SOS ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PoiHarita
          pois={pois}
          userLat={userLat}
          userLng={userLng}
          onBoundsChange={handleBoundsChange}
          onPoiClick={id => { setSecilenPoi(id); setListeAcik(false); }}
          aktifKategori={aktifKategori}
        />

        {/* Yükleniyor göstergesi */}
        {yukleniyor && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: '#161b22', color: '#8b949e', padding: '6px 14px',
            borderRadius: 20, fontSize: 12, border: '1px solid #30363d', zIndex: 900,
          }}>
            Güncelleniyor...
          </div>
        )}

        {/* SOS Butonu */}
        <button
          onClick={() => {
            setSosAktif(!sosAktif);
            setAktifKategori('hepsi');
            setAktifEtiketler([]);
          }}
          style={{
            position: 'absolute', bottom: listeAcik ? 260 : 90, right: 16,
            width: 56, height: 56, borderRadius: '50%',
            background: sosAktif ? '#dc2626' : '#7f1d1d',
            border: `2px solid ${sosAktif ? '#fca5a5' : '#ef4444'}`,
            color: '#fff', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', zIndex: 900,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 1,
            boxShadow: sosAktif ? '0 0 0 4px rgba(239,68,68,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 18 }}>🆘</span>
          <span>SOS</span>
        </button>

        {/* Liste aç butonu */}
        <button
          onClick={() => setListeAcik(!listeAcik)}
          style={{
            position: 'absolute', bottom: listeAcik ? 260 : 90, left: 16,
            background: '#161b22', border: '1px solid #30363d',
            borderRadius: 8, padding: '8px 14px',
            color: '#e6edf3', fontSize: 13, cursor: 'pointer', zIndex: 900,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>{listeAcik ? '▼' : '▲'}</span>
          <span>Liste {pois.length > 0 ? `(${pois.length})` : ''}</span>
        </button>
      </div>

      {/* ── Bottom Sheet — Yakınındaki En İyi Noktalar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: listeAcik ? 260 : 0,
        background: '#161b22',
        borderTop: listeAcik ? '1px solid #30363d' : 'none',
        transition: 'height 0.25s ease',
        overflow: 'hidden',
        zIndex: 800,
      }}>
        <div style={{ padding: '12px 16px 4px', fontWeight: 600, fontSize: 13, color: '#8b949e' }}>
          Yakınındaki En İyi Noktalar
        </div>
        <div style={{ overflowY: 'auto', height: 210, padding: '0 12px 12px' }}>
          {pois.length === 0 ? (
            <div style={{ color: '#8b949e', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              Bu bölgede kayıtlı konum bulunamadı.
            </div>
          ) : (
            pois.map(poi => (
              <PoiListeKart
                key={poi.id}
                poi={poi}
                onClick={() => { setSecilenPoi(poi.id); setListeAcik(false); }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── POI Detay Modal ── */}
      {secilenPoi && (
        <PoiDetay
          poiId={secilenPoi}
          userLat={userLat}
          userLng={userLng}
          onKapat={() => setSecilenPoi(null)}
        />
      )}

      {/* ── Yeni POI Ekle Modal ── */}
      {ekleModalAcik && (
        <PoiEkleModal
          userLat={userLat}
          userLng={userLng}
          onKapat={() => setEkleModalAcik(false)}
          onBasarili={() => {
            setEkleModalAcik(false);
            if (bboxRef.current) fetchPois(bboxRef.current);
          }}
        />
      )}
    </div>
  );
}

// ── POI Liste Kartı (Bottom Sheet) ───────────────────────────
function PoiListeKart({ poi, onClick }: { poi: PoiItem; onClick: () => void }) {
  const kat = KATEGORILER.find(k => k.key === poi.category);

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', background: '#0d1117',
        border: '1px solid #21262d', borderRadius: 10,
        padding: '10px 12px', marginBottom: 8,
        cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#30363d')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#21262d')}
    >
      {/* Kategori ikonu */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: kat?.pinColor || '#8b949e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {kat?.icon || '📍'}
      </div>

      {/* İçerik */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#e6edf3', marginBottom: 2 }}>
          {poi.name}
          {poi.is_emergency && (
            <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444', fontWeight: 400 }}>
              🔴 Nöbetçi
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {poi.avg_rating > 0 && (
            <span style={{ fontSize: 12, color: '#eab308' }}>
              ★ {poi.avg_rating.toFixed(1)} ({poi.review_count})
            </span>
          )}
          {poi.distance_m != null && (
            <span style={{ fontSize: 12, color: '#8b949e' }}>
              {poi.distance_m < 1000
                ? `${Math.round(poi.distance_m)} m`
                : `${(poi.distance_m / 1000).toFixed(1)} km`}
            </span>
          )}
          {poi.tags.slice(0, 2).map(tag => (
            <span key={tag} style={{
              fontSize: 11, color: '#22c55e',
              background: '#14532d', padding: '2px 6px', borderRadius: 4,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <span style={{ color: '#8b949e', fontSize: 16, flexShrink: 0 }}>›</span>
    </button>
  );
}
