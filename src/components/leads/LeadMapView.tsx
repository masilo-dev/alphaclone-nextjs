'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
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
  google: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  wikidata: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  browser: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  }),
  default: DefaultIcon,
};

// Auto-fit bounds when leads change
function FitBounds({ leads, fitKey }: { leads: LeadMapPin[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    const pinned = leads.filter(l => l.lat && l.lng);
    if (pinned.length === 0) return;
    const bounds = L.latLngBounds(pinned.map(l => [l.lat!, l.lng!]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [fitKey, leads, map]);
  return null;
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  });
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  return null;
}

function MapZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="w-8 h-8 rounded-md border border-slate-700 bg-slate-900/90 text-white text-base font-bold hover:bg-slate-800"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="w-8 h-8 rounded-md border border-slate-700 bg-slate-900/90 text-white text-base font-bold hover:bg-slate-800"
        aria-label="Zoom out"
      >
        -
      </button>
    </div>
  );
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
  previewCenter?: [number, number] | null;
  previewRadiusKm?: number;
}

const SOURCE_LABEL: Record<string, string> = {
  yelp: 'Yelp',
  here: 'HERE Maps',
  osm:  'OpenStreetMap',
  google: 'Free places',
  wikidata: 'Wikidata',
  browser: 'Web scrape',
  firecrawl: 'Web crawl',
};

export default function LeadMapView({
  leads,
  center = [40.7128, -74.006],
  zoom = 11,
  previewCenter = null,
  previewRadiusKm = 25,
}: LeadMapViewProps) {
  const mapLeads = useMemo(() => {
    const normalizeText = (value?: string) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizeHost = (value?: string) => {
      const raw = (value || '').trim();
      if (!raw) return '';
      try {
        const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
        const host = new URL(normalized).hostname.toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
      } catch {
        return normalizeText(raw);
      }
    };
    const normalizePhone = (value?: string) => (value || '').replace(/\D/g, '');
    const quantize = (value: number) => Math.round(value * 100000) / 100000;

    const deduped: LeadMapPin[] = [];
    const seen = new Set<string>();

    for (const lead of leads) {
      if (lead.lat == null || lead.lng == null) continue;

      const latKey = quantize(lead.lat);
      const lngKey = quantize(lead.lng);
      const nameKey = normalizeText(lead.business_name);
      const hostKey = normalizeHost(lead.website);
      const phoneKey = normalizePhone(lead.phone);

      const identity = hostKey || phoneKey || nameKey || 'unknown';
      const dedupeKey = `${identity}:${latKey}:${lngKey}`;
      if (seen.has(dedupeKey)) continue;

      seen.add(dedupeKey);
      deduped.push(lead);
    }

    return deduped;
  }, [leads]);
  const pinnable = mapLeads;
  const [mapStyle, setMapStyle] = useState<'detailed' | 'satellite' | 'hybrid' | 'dark'>('detailed');
  const [zoomLevel, setZoomLevel] = useState<number>(zoom);
  const [showRoute, setShowRoute] = useState<boolean>(true);
  const [showHeat, setShowHeat] = useState<boolean>(false);
  const [focusedLeadKey, setFocusedLeadKey] = useState<string | null>(null);

  const fitKey = useMemo(
    () =>
      pinnable
        .map((l) => `${l.business_name}:${l.lat ?? ''}:${l.lng ?? ''}`)
        .sort()
        .join('|'),
    [pinnable]
  );

  const tileConfig = useMemo(() => {
    if (mapStyle === 'satellite' || mapStyle === 'hybrid') {
      return {
        baseUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        labelUrl:
          mapStyle === 'hybrid'
            ? 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
            : null,
        baseAttribution:
          'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        labelAttribution:
          mapStyle === 'hybrid'
            ? '&copy; <a href="https://carto.com/">CARTO</a>'
            : '',
      };
    }
    if (mapStyle === 'dark') {
      return {
        baseUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        labelUrl: null,
        baseAttribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
        labelAttribution: '',
      };
    }
    return {
      baseUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      labelUrl: null,
      baseAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      labelAttribution: '',
    };
  }, [mapStyle]);

  const routePoints = useMemo(() => {
    if (!showRoute || pinnable.length < 2) return [];
    const remaining = [...pinnable];
    const ordered: LeadMapPin[] = [remaining.shift()!];
    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i];
        const dLat = (candidate.lat || 0) - (last.lat || 0);
        const dLng = (candidate.lng || 0) - (last.lng || 0);
        const dist = dLat * dLat + dLng * dLng;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      ordered.push(remaining.splice(bestIdx, 1)[0]);
    }
    return ordered.map((item) => [item.lat!, item.lng!] as [number, number]);
  }, [pinnable, showRoute]);

  const clusteredMarkers = useMemo(() => {
    const shouldCluster = zoomLevel < 12 && pinnable.length > 30;
    if (!shouldCluster) return null;
    const cellSize = Math.max(0.02, (12 - zoomLevel) * 0.02);
    const buckets = new Map<string, { lat: number; lng: number; count: number; leads: LeadMapPin[] }>();
    for (const lead of pinnable) {
      const latBucket = Math.round((lead.lat || 0) / cellSize);
      const lngBucket = Math.round((lead.lng || 0) / cellSize);
      const key = `${latBucket}:${lngBucket}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, { lat: lead.lat || 0, lng: lead.lng || 0, count: 1, leads: [lead] });
      } else {
        existing.count += 1;
        existing.lat = (existing.lat * (existing.count - 1) + (lead.lat || 0)) / existing.count;
        existing.lng = (existing.lng * (existing.count - 1) + (lead.lng || 0)) / existing.count;
        existing.leads.push(lead);
      }
    }
    return Array.from(buckets.values());
  }, [pinnable, zoomLevel]);

  const pinKey = (lead: LeadMapPin) => `${lead.business_name}:${lead.lat ?? ''}:${lead.lng ?? ''}`;

  const focusedLead = useMemo(() => {
    if (!focusedLeadKey) return null;
    return pinnable.find((lead) => pinKey(lead) === focusedLeadKey) || null;
  }, [focusedLeadKey, pinnable]);

  const focusedVisiblePins = useMemo(() => {
    if (!focusedLead) return pinnable;
    return pinnable.filter((lead) => {
      const dLat = (lead.lat || 0) - (focusedLead.lat || 0);
      const dLng = (lead.lng || 0) - (focusedLead.lng || 0);
      const km = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      return km <= 5.2;
    });
  }, [focusedLead, pinnable]);

  const heatPoints = useMemo(() => {
    if (!showHeat) return [];
    return pinnable.map((lead) => {
      const nearby = pinnable.reduce((acc, other) => {
        const dLat = (lead.lat || 0) - (other.lat || 0);
        const dLng = (lead.lng || 0) - (other.lng || 0);
        const km = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
        return km <= 1.2 ? acc + 1 : acc;
      }, 0);
      return {
        lat: lead.lat || 0,
        lng: lead.lng || 0,
        nearby,
        radius: Math.min(1200, 180 + nearby * 65),
        opacity: Math.min(0.45, 0.08 + nearby * 0.025),
      };
    });
  }, [pinnable, showHeat]);

  function getBuildingViewUrl(lat: number, lng: number): string {
    const latText = lat.toFixed(6);
    const lngText = lng.toFixed(6);
    return `https://www.google.com/maps/@${latText},${lngText},110a,35y,45h,45t/data=!3m1!1e3`;
  }

  return (
    <div className="relative w-full min-h-[240px] h-[min(50svh,520px)] sm:h-[min(55svh,480px)] md:h-[480px] max-h-[640px] rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      {/* Legend + map style */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[1000] max-w-[calc(100%-1rem)] flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 border border-slate-700 text-xs sm:text-xs font-semibold">
        <div className="flex items-center gap-1 mb-1">
          <button
            type="button"
            onClick={() => setMapStyle('detailed')}
            className={`px-1.5 py-0.5 rounded border ${mapStyle === 'detailed' ? 'border-teal-500/60 text-teal-300' : 'border-slate-700 text-slate-400'}`}
          >
            Detail
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('dark')}
            className={`px-1.5 py-0.5 rounded border ${mapStyle === 'dark' ? 'border-teal-500/60 text-teal-300' : 'border-slate-700 text-slate-400'}`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('satellite')}
            className={`px-1.5 py-0.5 rounded border ${mapStyle === 'satellite' ? 'border-teal-500/60 text-teal-300' : 'border-slate-700 text-slate-400'}`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapStyle('hybrid')}
            className={`px-1.5 py-0.5 rounded border ${mapStyle === 'hybrid' ? 'border-teal-500/60 text-teal-300' : 'border-slate-700 text-slate-400'}`}
          >
            Hybrid
          </button>
          <button
            type="button"
            onClick={() => setShowRoute((prev) => !prev)}
            className={`px-1.5 py-0.5 rounded border ${showRoute ? 'border-cyan-500/60 text-cyan-300' : 'border-slate-700 text-slate-400'}`}
          >
            Route
          </button>
          <button
            type="button"
            onClick={() => setShowHeat((prev) => !prev)}
            className={`px-1.5 py-0.5 rounded border ${showHeat ? 'border-rose-500/60 text-rose-300' : 'border-slate-700 text-slate-400'}`}
          >
            Heat
          </button>
          {focusedLead && (
            <button
              type="button"
              onClick={() => setFocusedLeadKey(null)}
              className="px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-300"
            >
              Clear focus
            </button>
          )}
        </div>
        <p className="text-slate-400 uppercase tracking-wider mb-0.5">Sources</p>
        <span className="text-blue-400">HERE Maps</span>
        <span className="text-emerald-400">OpenStreetMap</span>
        <span className="text-pink-400">Firecrawl AI</span>
      </div>

      {/* Pin count */}
      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-[1000] max-w-[min(calc(100%-5rem),14rem)] bg-slate-900/90 backdrop-blur-md rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 border border-slate-700 text-xs sm:text-[11px] font-bold text-white flex items-center gap-1.5">
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
          attribution={tileConfig.baseAttribution}
          url={tileConfig.baseUrl}
        />
        {tileConfig.labelUrl && (
          <TileLayer
            attribution={tileConfig.labelAttribution}
            url={tileConfig.labelUrl}
            pane="overlayPane"
          />
        )}

        <FitBounds leads={focusedLead ? focusedVisiblePins : pinnable} fitKey={focusedLead ? `${fitKey}:focus:${focusedLeadKey}` : fitKey} />
        <ZoomTracker onZoomChange={setZoomLevel} />
        <MapZoomControls />
        {previewCenter && (
          <>
            <Marker position={previewCenter} icon={DefaultIcon}>
              <Popup>Search center preview</Popup>
            </Marker>
            <Circle center={previewCenter} radius={Math.max(previewRadiusKm, 1) * 1000} pathOptions={{ color: '#14b8a6', fillOpacity: 0.08 }} />
          </>
        )}
        {routePoints.length > 1 && (
          <Polyline positions={routePoints} pathOptions={{ color: '#38bdf8', weight: 3, opacity: 0.7, dashArray: '6 6' }} />
        )}
        {focusedLead && (
          <>
            <Circle center={[focusedLead.lat!, focusedLead.lng!]} radius={1000} pathOptions={{ color: '#22d3ee', fillOpacity: 0.04 }} />
            <Circle center={[focusedLead.lat!, focusedLead.lng!]} radius={3000} pathOptions={{ color: '#f59e0b', fillOpacity: 0.03 }} />
            <Circle center={[focusedLead.lat!, focusedLead.lng!]} radius={5000} pathOptions={{ color: '#ef4444', fillOpacity: 0.02 }} />
          </>
        )}
        {heatPoints.map((point, idx) => (
          <Circle
            key={`heat-${idx}`}
            center={[point.lat, point.lng]}
            radius={point.radius}
            pathOptions={{
              color: '#f43f5e',
              fillColor: '#fb7185',
              fillOpacity: point.opacity,
              opacity: 0,
            }}
          />
        ))}
        {(clusteredMarkers || (focusedLead ? focusedVisiblePins : pinnable)).map((lead: any, idx) => (
          <Marker
            key={idx}
            position={[lead.lat!, lead.lng!]}
            icon={clusteredMarkers ? L.divIcon({
              html: `<div style="background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:999px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${lead.count}</div>`,
              className: '',
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            }) : (SOURCE_ICONS[lead.source || 'default'] || DefaultIcon)}
          >
            <Popup maxWidth={280} className="lead-popup">
              <div className="p-1 space-y-1.5" style={{ fontFamily: 'system-ui, sans-serif' }}>
                {clusteredMarkers ? (
                  <>
                    <p className="font-bold text-sm text-slate-900">{lead.count} leads in this area</p>
                    <p className="text-xs text-slate-600">
                      Zoom in to split cluster and inspect each business.
                    </p>
                  </>
                ) : (
                  <>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm leading-tight text-slate-900">{lead.business_name}</p>
                  {lead.source && (
                    <span className="text-xs font-black shrink-0 uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {SOURCE_LABEL[lead.source] || lead.source}
                    </span>
                  )}
                </div>

                {/* Category */}
                {lead.category && (
                  <p className="text-xs text-slate-500">{lead.category}</p>
                )}

                {/* Rating */}
                {lead.rating && (
                  <p className="text-[11px] font-semibold text-amber-600">
                    Rating {lead.rating.toFixed(1)} / 5
                  </p>
                )}

                {lead.address && (
                  <p className="text-xs text-slate-600 leading-snug break-words">
                    <span className="font-semibold text-slate-500">Address: </span>
                    {lead.address}
                  </p>
                )}

                {lead.phone && (
                  <p className="text-xs text-slate-700">
                    <span className="font-semibold text-slate-500">Phone: </span>
                    {lead.phone}
                  </p>
                )}

                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-blue-600 hover:underline break-all"
                  >
                    {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                  </a>
                )}
                {lead.lat != null && lead.lng != null && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`https://www.mapillary.com/app/?lat=${lead.lat}&lng=${lead.lng}&z=17`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Street (Mapillary)
                    </a>
                    <a
                      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lead.lat},${lead.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
                    >
                      Pano
                    </a>
                    <a
                      href={getBuildingViewUrl(lead.lat, lead.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
                    >
                      3D building
                    </a>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setFocusedLeadKey(pinKey(lead))}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                >
                  Focus area (1km / 3km / 5km)
                </button>
                  </>
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

