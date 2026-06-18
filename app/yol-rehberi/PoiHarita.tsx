'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import type { PoiItem, BoundingBox } from './YolRehberiClient';
import { KATEGORILER } from './YolRehberiClient';

// Leaflet varsayılan marker ikonunu düzelt (Next.js build sorunu)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Renkli pin oluştur
function createColorPin(color: string, emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:44px;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-start;
    ">
      <div style="
        width:36px;height:36px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);background:${color};
        border:2px solid rgba(255,255,255,0.4);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">
        <span style="transform:rotate(45deg);font-size:16px">${emoji}</span>
      </div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

// Cluster ikonu — sayı balonu
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:#22c55e;
      border:3px solid rgba(255,255,255,0.5);
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      font-weight:700;font-size:${count < 100 ? 14 : 12}px;
      color:#0d1117;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Kategori → pin ikonu
const KAT_IKONLAR: Record<string, L.DivIcon> = {};
for (const k of KATEGORILER) {
  if (k.key !== 'hepsi') {
    KAT_IKONLAR[k.key] = createColorPin(k.pinColor, k.icon);
  }
}
const SOS_IKON = createColorPin('#dc2626', '🆘');
const USER_IKON = createColorPin('#22c55e', '📍');

// ── Harita olaylarını dinle ──────────────────────────────────
function BoundsListener({ onBoundsChange }: { onBoundsChange: (bbox: BoundingBox) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange({
        min_lng: b.getWest(),
        min_lat: b.getSouth(),
        max_lng: b.getEast(),
        max_lat: b.getNorth(),
      });
    },
    zoomend: () => {
      const b = map.getBounds();
      onBoundsChange({
        min_lng: b.getWest(),
        min_lat: b.getSouth(),
        max_lng: b.getEast(),
        max_lat: b.getNorth(),
      });
    },
  });
  return null;
}

// Kullanıcı konumuna git
function KonumaGit({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!done.current) {
      map.setView([lat, lng], 13);
      done.current = true;
    }
  }, [map, lat, lng]);
  return null;
}

// ── Ana harita bileşeni ───────────────────────────────────────
interface Props {
  pois: PoiItem[];
  userLat: number | null;
  userLng: number | null;
  onBoundsChange: (bbox: BoundingBox) => void;
  onPoiClick: (id: string) => void;
  aktifKategori: string;
}

export default function PoiHarita({ pois, userLat, userLng, onBoundsChange, onPoiClick }: Props) {
  // Türkiye merkezi — kullanıcı konumu yoksa
  const baslangicLat = userLat ?? 39.0;
  const baslangicLng = userLng ?? 35.0;
  const baslangicZoom = userLat ? 12 : 6;

  return (
    <MapContainer
      center={[baslangicLat, baslangicLng]}
      zoom={baslangicZoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      {/* OpenStreetMap tile */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <BoundsListener onBoundsChange={onBoundsChange} />

      {/* Kullanıcı konumu — cluster dışında */}
      {userLat && userLng && (
        <>
          <KonumaGit lat={userLat} lng={userLng} />
          <Marker position={[userLat, userLng]} icon={USER_IKON}>
            <Popup>
              <div style={{ fontSize: 13, fontWeight: 600 }}>📍 Konumunuz</div>
            </Popup>
          </Marker>
        </>
      )}

      {/* POI pinleri — cluster içinde */}
      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={60}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick
        chunkedLoading
      >
        {pois.map(poi => {
          const ikon = poi.is_emergency
            ? SOS_IKON
            : (KAT_IKONLAR[poi.category] || KAT_IKONLAR['park_dinlenme']);
          const kat = KATEGORILER.find(k => k.key === poi.category);

          return (
            <Marker
              key={poi.id}
              position={[poi.latitude, poi.longitude]}
              icon={ikon}
              eventHandlers={{ click: () => onPoiClick(poi.id) }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {kat?.icon} {poi.name}
                  </div>
                  {poi.avg_rating > 0 && (
                    <div style={{ fontSize: 12, color: '#d97706', marginBottom: 4 }}>
                      ★ {poi.avg_rating.toFixed(1)} · {poi.review_count} yorum
                    </div>
                  )}
                  {poi.distance_m != null && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      {poi.distance_m < 1000
                        ? `${Math.round(poi.distance_m)} metre uzakta`
                        : `${(poi.distance_m / 1000).toFixed(1)} km uzakta`}
                    </div>
                  )}
                  <button
                    onClick={() => onPoiClick(poi.id)}
                    style={{
                      background: '#22c55e', color: '#0d1117',
                      border: 'none', borderRadius: 6,
                      padding: '5px 12px', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', width: '100%',
                    }}
                  >
                    Detay Gör
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
