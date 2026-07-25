'use client';

import React, { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:999px;
    background:#14b8a6;border:2px solid #ecfeff;
    box-shadow:0 0 0 6px rgba(20,184,166,0.25),0 8px 20px rgba(0,0,0,0.45);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [map, lat, lng, zoom]);
  return null;
}

type Props = {
  lat: number;
  lng: number;
  label: string;
  mode?: 'satellite' | 'streets';
  zoom?: number;
};

/**
 * Free embedded aerial/street mini-map (Esri World Imagery + OSM).
 * No API key, no paid Maps SDK.
 */
export default function LeadFinderAerialMiniMap({
  lat,
  lng,
  label,
  mode = 'satellite',
  zoom = 18,
}: Props) {
  const satellite = {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  };
  const streets = {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  };
  const tile = mode === 'streets' ? streets : satellite;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={false}
      dragging
      style={{ width: '100%', height: '100%', background: '#020617' }}
    >
      <TileLayer url={tile.url} attribution={tile.attribution} />
      {mode === 'satellite' && (
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO"
          opacity={0.85}
        />
      )}
      <Marker position={[lat, lng]} icon={PinIcon}>
        <Popup>{label}</Popup>
      </Marker>
      <Recenter lat={lat} lng={lng} zoom={zoom} />
    </MapContainer>
  );
}
