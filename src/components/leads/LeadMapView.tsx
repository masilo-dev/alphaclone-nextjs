'use client';

import { useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's broken default icon paths in Next.js (webpack asset pipeline)
const DefaultIcon = L.icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Coloured icons for each source
const SOURCE_ICONS: Record<string, L.Icon> = {
  yelp: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  here: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  osm: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  default: DefaultIcon,
};

// Auto-fit bounds when leads change
function FitBounds({ leads }: { leads: LeadMapPin[] }) {
  const map = useMap();
  useEffect(() => {
    const pinned = leads.filter(l => l.lat && l.lng);
    if (pinned.length === 0) return;
    const bounds = L.latLngBounds(pinned.map(l => [l.lat!, l.lng!]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [leads, map]);
  return null;
}

export interface LeadMapPin {
  business_name: string;
  address?:      string;
  phone?:        string;
  website?:      string;
  rating?:       number;
  category?:     string;
  source?:       string;
  lat?:          number;
  lng?:          number;
}

interface LeadMapViewProps {
  leads:    LeadMapPin[];
  center?:  [number, number];
  zoom?:    number;
}

const SOURCE_LABEL: Record<string, string> = {
  yelp: 'Yelp',
  here: 'HERE Maps',
  osm:  'OpenStreetMap',
};

export default function LeadMapView({ leads, center = [40.7128, -74.006], zoom = 11 }: LeadMapViewProps) {
  const pinnable = leads.filter(l => l.lat != null && l.lng != null);

  return (
    <div className="relative w-full min-h-[240px] h-[min(50svh,520px)] sm:h-[min(55svh,480px)] md:h-[480px] max-h-[640px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      {/* Legend */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[1000] max-w-[calc(100%-1rem)] flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-700 text-[9px] sm:text-[10px] font-semibold">
        <p className="text-slate-400 uppercase tracking-wider mb-0.5">Sources</p>
        <span className="text-orange-400">Yelp</span>
        <span className="text-blue-400">HERE Maps</span>
        <span className="text-emerald-400">OpenStreetMap</span>
      </div>

      {/* Pin count */}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[1000] max-w-[min(calc(100%-5rem),14rem)] bg-slate-900/90 backdrop-blur-md rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 border border-slate-700 text-[10px] sm:text-[11px] font-bold text-white flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden />
        <span className="truncate">
          {pinnable.length} <span className="text-slate-400 font-normal">/ {leads.length} mapped</span>
        </span>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', background: '#0f172a' }}
        className="lead-map"
      >
        {/* Dark OpenStreetMap tile */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds leads={pinnable} />

        {pinnable.map((lead, idx) => (
          <Marker
            key={idx}
            position={[lead.lat!, lead.lng!]}
            icon={SOURCE_ICONS[lead.source || 'default'] || DefaultIcon}
          >
            <Popup maxWidth={280} className="lead-popup">
              <div className="p-1 space-y-1.5" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm leading-tight text-slate-900">{lead.business_name}</p>
                  {lead.source && (
                    <span className="text-[9px] font-black shrink-0 uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {SOURCE_LABEL[lead.source] || lead.source}
                    </span>
                  )}
                </div>

                {/* Category */}
                {lead.category && (
                  <p className="text-[10px] text-slate-500">{lead.category}</p>
                )}

                {/* Rating */}
                {lead.rating && (
                  <p className="text-[11px] font-semibold text-amber-600">
                    Rating {lead.rating.toFixed(1)} / 5
                  </p>
                )}

                {lead.address && (
                  <p className="text-[10px] text-slate-600 leading-snug break-words">
                    <span className="font-semibold text-slate-500">Address: </span>
                    {lead.address}
                  </p>
                )}

                {lead.phone && (
                  <p className="text-[10px] text-slate-700">
                    <span className="font-semibold text-slate-500">Phone: </span>
                    {lead.phone}
                  </p>
                )}

                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[10px] text-blue-600 hover:underline break-all"
                  >
                    {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* CSS tweak — keeps popup content clean */}
      <style>{`
        .lead-map .leaflet-container { background: #0f172a; }
        .lead-popup .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        .lead-popup .leaflet-popup-content { margin: 0; }
      `}</style>
    </div>
  );
}
