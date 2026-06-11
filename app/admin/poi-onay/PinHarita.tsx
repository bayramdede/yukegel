'use client';
import { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet varsayılan marker ikonunu düzelt (Next.js build sorunu)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Yeşil sürüklenebilir pin
const greenPin = L.divIcon({
  className: '',
  html: `<div style="width:34px;height:42px;display:flex;flex-direction:column;align-items:center;cursor:grab">
    <div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:#22c55e;border:2.5px solid rgba(255,255,255,0.7);
      box-shadow:0 3px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">
      <span style="transform:rotate(45deg);font-size:15px;line-height:1">📍</span>
    </div>
    <div style="width:2px;height:8px;background:#22c55e;margin-top:-2px;opacity:0.7"></div>
  </div>`,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
});

// Dışarıdan lat/lng değişince haritayı kaydır (sürükleme sırasında değil)
function MapController({ lat, lng, isDragging }: { lat: number; lng: number; isDragging: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!isDragging) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [lat, lng, isDragging, map]);
  return null;
}

interface PinHaritaProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}

export default function PinHarita({ lat, lng, onChange }: PinHaritaProps) {
  const markerRef = useRef<L.Marker>(null);
  const [isDragging, setIsDragging] = useState(false);

  const eventHandlers = {
    dragstart() { setIsDragging(true); },
    dragend() {
      setIsDragging(false);
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onChange(
          parseFloat(pos.lat.toFixed(6)),
          parseFloat(pos.lng.toFixed(6)),
        );
      }
    },
  };

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d' }}>
      {/* Talimat overlay */}
      <div style={{
        position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(13,17,23,0.82)', color: '#8b949e',
        fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
        borderRadius: 20, zIndex: 1000, whiteSpace: 'nowrap', pointerEvents: 'none',
        border: '1px solid rgba(48,54,61,0.8)',
      }}>
        📌 Pin'i tam konuma sürükleyin
      </div>

      <MapContainer
        center={[lat, lng]}
        zoom={16}
        style={{ height: 300, width: '100%' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <MapController lat={lat} lng={lng} isDragging={isDragging} />
        <Marker
          ref={markerRef}
          position={[lat, lng]}
          draggable
          eventHandlers={eventHandlers}
          icon={greenPin}
        />
      </MapContainer>
    </div>
  );
}
