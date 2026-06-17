'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import PoiDetay from './PoiDetay';
import PoiEkleModal from './PoiEkleModal';
import { POI_TUM_KATEGORILER, POI_ALT_ETIKETLER } from '../../lib/poi-constants';

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

// poi-constants.ts'den türetiliyor — burada değişiklik yapma
export const KATEGORILER = [
  { key: 'hepsi', label: 'Hepsi', icon: '🗺️', pinColor: '#8b949e' },
  ...POI_TUM_KATEGORILER.map(k => ({ key: k.value, label: k.label, icon: k.icon, pinColor: k.pinColor })),
];

const ALT_ETIKETLER: Record<string, string[]> = POI_ALT_ETIKETLER;

// Türkiye bounding box (ilk açılış için)
const TR_BBOX: BoundingBox = {
  min_lng: 25.0, min_lat: 35.0,
  max_lng: 45.0, max_lat: 42.5,
};

type Gorunum = 'liste' | 'harita';

export default function YolRehberiClient() {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [poiTotal, setPoiTotal] = useState<number | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aktifKategori, setAktifKategori] = useState('hepsi');
  const [aktifEtiketler, setAktifEtiketler] = useState<string[]>([]);
  const [sosAktif, setSosAktif] = useState(false);
  const [secilenPoi, setSecilenPoi] = useState<string | null>(null);
  const [ekleModalAcik, setEkleModalAcik] = useState(false);
  const [gorunum, setGorunum] = useState<Gorunum>('liste');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [konumIzni, setKonumIzni] = useState<'bekleniyor' | 'tamam' | 'reddedildi'>('bekleniyor');
  const bboxRef = useRef<BoundingBox | null>(null);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Kullanıcı konumunu al
  useEffect(() => {
    if (!navigator.geolocation) {
      setKonumIzni('reddedildi');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setKonumIzni('tamam');
      },
      () => setKonumIzni('reddedildi')
    );
  }, []);

  // Konum gelince veya filtre değişince POI'leri çek
  const fetchPois = useCallback(async (bbox: BoundingBox) => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(async () => {
      setYukleniyor(true);
      try {
        const params = new URLSearchParams({
          min_lng: bbox.min_lng.toString(),
          min_lat: bbox.min_lat.toString(),
          max_lng: bbox.max_lng.toString(),
          max_lat: bbox.max_lat.toString(),
          limit: '30',
        });
        if (aktifKategori !== 'hepsi') params.set('category', aktifKategori);
        if (aktifEtiketler.length) params.set('tags', aktifEtiketler.join(','));
        if (sosAktif) params.set('emergency', 'true');
        if (userLat) params.set('lat', userLat.toString());
        if (userLng) params.set('lng', userLng.toString());

        const res = await fetch(`/api/poi?${params.toString()}`);
        const json = await res.json();
        if (json.success) { setPois(json.data); setPoiTotal(json.total ?? json.data.length); }
      } catch (err) {
        console.error('POI fetch hatası:', err);
      } finally {
        setYukleniyor(false);
      }
    }, 300);
  }, [aktifKategori, aktifEtiketler, sosAktif, userLat, userLng]);

  // Liste modunda her zaman TR_BBOX kullan — sıralama algoritması
  // zaten mesafe+puana göre en iyi 30'u öne getirir.
  // Harita modunda bbox haritanın görünüm alanından gelir (handleBoundsChange).
  useEffect(() => {
    const bbox = gorunum === 'harita' && userLat && userLng
      ? {
          min_lng: userLng - 0.5, min_lat: userLat - 0.3,
          max_lng: userLng + 0.5, max_lat: userLat + 0.3,
        }
      : TR_BBOX;
    bboxRef.current = bbox;
    fetchPois(bbox);
  }, [fetchPois, userLat, userLng, gorunum]);

  const handleBoundsChange = useCallback((bbox: BoundingBox) => {
    bboxRef.current = bbox;
    fetchPois(bbox);
  }, [fetchPois]);

  const handleKategori = (key: string) => {
    setAktifKategori(key);
    setAktifEtiketler([]);
    setSosAktif(false);
  };

  const toggleEtiket = (etiket: string) => {
    setAktifEtiketler(prev =>
      prev.includes(etiket) ? prev.filter(e => e !== etiket) : [...prev, etiket]
    );
  };

  const handleSos = () => {
    setSosAktif(!sosAktif);
    setAktifKategori('hepsi');
    setAktifEtiketler([]);
  };

  const altEtiketler = aktifKategori !== 'hepsi' ? (ALT_ETIKETLER[aktifKategori] || []) : [];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: '#0d1117', color: '#e6edf3',
      fontFamily: "'IBM Plex Sans', sans-serif", overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: '#161b22',
        borderBottom: '1px solid #21262d', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/" style={{ color: '#22c55e', fontWeight: 700, fontSize: 17, textDecoration: 'none' }}>
            Yükegel
          </a>
          <span style={{ color: '#30363d' }}>|</span>
          <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 15 }}>Yol Rehberi</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* SOS */}
          <button
            onClick={handleSos}
            style={{
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: sosAktif ? '#dc2626' : '#7f1d1d',
              color: '#fff', fontWeight: 700, fontSize: 12,
              cursor: 'pointer',
              boxShadow: sosAktif ? '0 0 0 3px rgba(239,68,68,0.35)' : 'none',
            }}
          >
            🆘 SOS
          </button>

          {/* Görünüm toggle */}
          <div style={{
            display: 'flex', background: '#21262d',
            borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d',
          }}>
            <button
              onClick={() => setGorunum('liste')}
              style={{
                padding: '7px 12px', border: 'none', fontSize: 13,
                background: gorunum === 'liste' ? '#22c55e' : 'transparent',
                color: gorunum === 'liste' ? '#0d1117' : '#8b949e',
                fontWeight: gorunum === 'liste' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              ☰ Liste
            </button>
            <button
              onClick={() => setGorunum('harita')}
              style={{
                padding: '7px 12px', border: 'none', fontSize: 13,
                background: gorunum === 'harita' ? '#22c55e' : 'transparent',
                color: gorunum === 'harita' ? '#0d1117' : '#8b949e',
                fontWeight: gorunum === 'harita' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              🗺️ Harita
            </button>
          </div>

          {/* Yeni yer ekle */}
          <button
            onClick={() => setEkleModalAcik(true)}
            style={{
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: '#21262d', color: '#e6edf3',
              fontSize: 18, cursor: 'pointer', lineHeight: 1,
            }}
            title="Yeni Yer Ekle"
          >
            +
          </button>
        </div>
      </header>

      {/* ── Kategori Chips ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        overflowX: 'auto', flexShrink: 0,
        background: '#161b22', borderBottom: '1px solid #21262d',
        scrollbarWidth: 'none',
      }}>
        {KATEGORILER.map(k => (
          <button
            key={k.key}
            onClick={() => handleKategori(k.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 20, border: 'none',
              background: aktifKategori === k.key ? k.pinColor : '#21262d',
              color: aktifKategori === k.key ? '#fff' : '#8b949e',
              fontWeight: aktifKategori === k.key ? 600 : 400,
              fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              flexShrink: 0, transition: 'all 0.12s',
            }}
          >
            <span>{k.icon}</span><span>{k.label}</span>
          </button>
        ))}
      </div>

      {/* ── Alt Etiketler ── */}
      {altEtiketler.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 14px',
          overflowX: 'auto', flexShrink: 0,
          background: '#0d1117', borderBottom: '1px solid #21262d',
          scrollbarWidth: 'none',
        }}>
          {altEtiketler.map(etiket => (
            <button
              key={etiket}
              onClick={() => toggleEtiket(etiket)}
              style={{
                padding: '4px 11px', borderRadius: 16,
                border: `1px solid ${aktifEtiketler.includes(etiket) ? '#22c55e' : '#30363d'}`,
                background: aktifEtiketler.includes(etiket) ? '#14532d' : 'transparent',
                color: aktifEtiketler.includes(etiket) ? '#22c55e' : '#8b949e',
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {etiket}
            </button>
          ))}
        </div>
      )}

      {/* ── İçerik Alanı ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>

        {/* LİSTE GÖRÜNÜMÜ */}
        {gorunum === 'liste' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 24px' }}>

            {/* Konum durumu */}
            {konumIzni === 'bekleniyor' && (
              <div style={{ fontSize: 13, color: '#8b949e', textAlign: 'center', padding: '12px 0 4px' }}>
                📍 Konum alınıyor...
              </div>
            )}
            {konumIzni === 'reddedildi' && (
              <div style={{
                fontSize: 12, color: '#8b949e', background: '#161b22',
                borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                border: '1px solid #21262d',
              }}>
                ⚠️ Konum izni verilmedi — mesafe hesaplanamıyor. Tüm Türkiye gösteriliyor.
              </div>
            )}

            {/* Başlık + sayaç */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8b949e' }}>
                {sosAktif ? '🆘 Acil Noktalar' : 'Yakınındaki En İyi Noktalar'}
              </span>
              {yukleniyor
                ? <span style={{ fontSize: 12, color: '#8b949e' }}>Güncelleniyor...</span>
                : <span style={{ fontSize: 12, color: '#30363d' }}>{poiTotal ?? pois.length} sonuç</span>
              }
            </div>

            {/* Boş durum */}
            {!yukleniyor && pois.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '48px 20px',
                color: '#8b949e', fontSize: 14,
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📍</div>
                <div>Bu bölgede kayıtlı konum bulunamadı.</div>
                <button
                  onClick={() => setEkleModalAcik(true)}
                  style={{
                    marginTop: 16, padding: '9px 18px', borderRadius: 8,
                    background: '#22c55e', color: '#0d1117',
                    border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  + İlk yeri sen ekle
                </button>
              </div>
            )}

            {/* POI listesi */}
            {pois.map((poi, index) => (
              <PoiListeKart
                key={poi.id}
                poi={poi}
                rank={index + 1}
                onClick={() => setSecilenPoi(poi.id)}
              />
            ))}
          </div>
        )}

        {/* HARİTA GÖRÜNÜMÜ */}
        {gorunum === 'harita' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <PoiHarita
              pois={pois}
              userLat={userLat}
              userLng={userLng}
              onBoundsChange={handleBoundsChange}
              onPoiClick={id => setSecilenPoi(id)}
              aktifKategori={aktifKategori}
            />
            {yukleniyor && (
              <div style={{
                position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                background: '#161b22', color: '#8b949e',
                padding: '5px 14px', borderRadius: 20,
                fontSize: 12, border: '1px solid #30363d', zIndex: 900,
              }}>
                Güncelleniyor...
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── POI Detay ── */}
      {secilenPoi && (
        <PoiDetay
          poiId={secilenPoi}
          userLat={userLat}
          userLng={userLng}
          onKapat={() => setSecilenPoi(null)}
        />
      )}

      {/* ── Yeni POI Ekle ── */}
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

// ── POI Liste Kartı ───────────────────────────────────────────
function PoiListeKart({ poi, rank, onClick }: { poi: PoiItem; rank: number; onClick: () => void }) {
  const kat = KATEGORILER.find(k => k.key === poi.category);

  const mesafeStr = poi.distance_m == null
    ? null
    : poi.distance_m < 1000
      ? `${Math.round(poi.distance_m)} m`
      : `${(poi.distance_m / 1000).toFixed(1)} km`;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', background: '#161b22',
        border: '1px solid #21262d', borderRadius: 12,
        padding: '12px 14px', marginBottom: 10,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      {/* Kategori + sıralama */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: kat?.pinColor || '#8b949e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          {kat?.icon || '📍'}
        </div>
        {rank <= 3 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: rank === 1 ? '#eab308' : rank === 2 ? '#9ca3af' : '#d97706',
            color: '#0d1117', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {rank}
          </div>
        )}
      </div>

      {/* Bilgiler */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 15, color: '#e6edf3',
          marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {poi.name}
          {poi.is_emergency && (
            <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444' }}>🔴</span>
          )}
        </div>

        {/* Mesafe + puan — en önemli bilgiler büyük */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {mesafeStr && (
            <span style={{
              fontSize: 15, fontWeight: 700,
              color: poi.distance_m! < 2000 ? '#22c55e' : '#e6edf3',
            }}>
              {mesafeStr}
            </span>
          )}
          {poi.avg_rating > 0 && (
            <span style={{ fontSize: 13, color: '#eab308', display: 'flex', alignItems: 'center', gap: 3 }}>
              ★ <strong>{poi.avg_rating.toFixed(1)}</strong>
              <span style={{ color: '#8b949e', fontWeight: 400 }}>({poi.review_count})</span>
            </span>
          )}
        </div>

        {/* Etiketler */}
        {poi.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {poi.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{
                fontSize: 11, color: '#22c55e',
                background: '#14532d', padding: '2px 6px', borderRadius: 4,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <span style={{ color: '#30363d', fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}
