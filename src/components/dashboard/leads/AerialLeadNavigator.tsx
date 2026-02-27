import React, { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plane, Camera, Compass, Play, Pause, ExternalLink } from 'lucide-react';
import { ENV } from '../../../config/env';

interface AerialLeadNavigatorProps {
    leads: {
        id?: string;
        businessName: string;
        location?: string;
        lat?: number;
        lng?: number;
    }[];
    isSearching?: boolean;
    searchTopic?: string;
    searchLocation?: string;
    onClose?: () => void;
}

export const AerialLeadNavigator: React.FC<AerialLeadNavigatorProps> = ({
    leads,
    isSearching,
    searchTopic,
    searchLocation,
    onClose
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const [geocodedLeads, setGeocodedLeads] = useState<any[]>([]);
    const [mapType, setMapType] = useState<string>('satellite');
    const [showScanner, setShowScanner] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const apiKey = ENV.GOOGLE_API_KEY || '';

    useEffect(() => {
        if (!apiKey) return;

        setOptions({
            key: apiKey,
            v: 'weekly'
        });

        const initMap = async () => {
            try {
                const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;

                if (mapRef.current) {
                    const googleMap = new Map(mapRef.current, {
                        center: { lat: 0, lng: 0 },
                        zoom: 2,
                        mapId: '4504f8b37365c3d0', // Use a Vector Map ID for 3D tilt
                        mapTypeId: mapType as google.maps.MapTypeId,
                        disableDefaultUI: true,
                        backgroundColor: '#020617',
                        gestureHandling: 'none' // Controlled by AI
                    });
                    setMap(googleMap);
                    setIsLoaded(true);
                }
            } catch (error) {
                console.error('Error loading Google Maps:', error);
            }
        };

        initMap();
    }, [apiKey]);

    // Update map type when changed
    useEffect(() => {
        if (map) {
            map.setMapTypeId(mapType as google.maps.MapTypeId);
        }
    }, [map, mapType]);

    // Geocode Leads
    useEffect(() => {
        if (!isLoaded || leads.length === 0) return;

        const geocodeLeads = async () => {
            const results = [];
            const geocoder = new google.maps.Geocoder();

            for (const lead of leads) {
                try {
                    const response = await geocoder.geocode({ address: lead.location });
                    if (response.results[0]) {
                        const loc = response.results[0].geometry.location;
                        results.push({
                            ...lead,
                            lat: loc.lat(),
                            lng: loc.lng(),
                            formatted_address: response.results[0].formatted_address
                        });
                    }
                } catch (e) {
                    console.error('Geocoding failed for', lead.location, e);
                }
            }
            setGeocodedLeads(results);
        };

        geocodeLeads();
    }, [isLoaded, leads]);

    // Navigation Loop
    useEffect(() => {
        if (!map || geocodedLeads.length === 0 || isNavigating || isSearching) return;

        const navigate = async () => {
            setIsNavigating(true);

            // If we have leads, fly to the current one
            const lead = geocodedLeads[currentIndex];
            if (!lead || !lead.lat) return;

            const target = { lat: lead.lat, lng: lead.lng };

            // 1. High Altitude Fly-over
            map.setOptions({ tilt: 45, heading: 0 });

            // Pan smoothly
            map.panTo(target);

            // Zoom in loop for WOW effect
            await new Promise(r => setTimeout(r, 1000));

            // Animate Zoom, Tilt, and Heading for "Cinematic" feel
            const duration = 4000;
            const start = performance.now();

            const animateCamera = (time: number) => {
                const elapsed = time - start;
                const progress = Math.min(elapsed / duration, 1);

                // Ease function
                const ease = (t: number) => t * (2 - t);

                const currentZoom = 2 + (17 - 2) * ease(progress);
                const currentTilt = 0 + (65 - 0) * ease(progress);
                const currentHeading = 0 + (360 * ease(progress));

                if (map) {
                    map.setZoom(currentZoom);
                    map.setTilt(currentTilt);
                    map.setHeading(currentHeading);
                }

                if (progress < 1) {
                    window.requestAnimationFrame(animateCamera);
                }
            };

            requestAnimationFrame(animateCamera);

            await new Promise(r => setTimeout(r, duration + 2000));

            // Move to next lead
            setCurrentIndex((prev) => (prev + 1) % geocodedLeads.length);
            setIsNavigating(false);
        };

        navigate();
    }, [map, geocodedLeads, currentIndex]);

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden font-sans">
            <div ref={mapRef} className="absolute inset-0 grayscale-[0.2] brightness-[0.8]" />

            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[4px] border-slate-950/20">
                {/* Discovery / Searching State */}
                {isSearching ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl border border-teal-500/30 shadow-[0_0_50px_rgba(20,184,166,0.2)] text-center max-w-xs sm:max-w-sm"
                        >
                            <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4">
                                <div className="absolute inset-0 border-2 sm:border-4 border-teal-500/20 rounded-full" />
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-2 sm:border-4 border-transparent border-t-teal-500 rounded-full"
                                />
                                <Compass className="absolute inset-0 m-auto w-6 h-6 sm:w-8 sm:h-8 text-teal-400 animate-pulse" />
                            </div>
                            <h2 className="text-sm sm:text-lg font-bold text-white mb-1 uppercase tracking-tighter italic">
                                Initiating Deep Scan
                            </h2>
                            <p className="text-teal-400 font-mono text-sm uppercase tracking-widest mb-6 px-4">
                                Locating {searchTopic || 'Leads'} in {searchLocation || 'Region'}...
                            </p>
                            <div className="space-y-2">
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                        className="h-full w-1/3 bg-gradient-to-r from-transparent via-teal-500 to-transparent"
                                    />
                                </div>
                                <div className="flex justify-between font-mono text-[10px] text-slate-500">
                                    <span>SATELLITE LINK ESTABLISHED</span>
                                    <span>RAW DATA STREAM: ACTIVE</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-2 pointer-events-auto">
                            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-teal-500/30 flex items-center gap-2 max-w-fit">
                                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-white font-mono text-[8px] sm:text-[10px] tracking-widest uppercase">Live Aerial Tracking</span>
                            </div>

                            {/* Map Type Selector */}
                            <div className="bg-slate-900/80 backdrop-blur-xl p-1 rounded-xl border border-white/10 flex gap-1">
                                {['satellite', 'roadmap', 'hybrid', 'terrain'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setMapType(type)}
                                        className={`px-2 py-1 rounded-lg text-[8px] sm:text-[10px] font-mono uppercase transition-all ${mapType === type
                                                ? 'bg-teal-500 text-black font-bold shadow-[0_0_10px_rgba(20,184,166,0.5)]'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence mode="wait">
                                {geocodedLeads[currentIndex] && (
                                    <motion.div
                                        key={geocodedLeads[currentIndex].id || currentIndex}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="bg-slate-900/90 backdrop-blur-xl p-3 sm:p-4 rounded-xl border border-white/10 shadow-lg max-w-[200px] sm:max-w-xs"
                                    >
                                        <div className="flex items-start justify-between mb-2 sm:mb-3">
                                            <div className="min-w-0 pr-2">
                                                <h2 className="text-white font-bold text-xs sm:text-sm leading-tight truncate">
                                                    {geocodedLeads[currentIndex].businessName}
                                                </h2>
                                                <p className="text-teal-400 text-[8px] sm:text-[10px] font-mono mt-0.5 uppercase tracking-wider truncate">
                                                    Target Verified at 98.4% Accuracy
                                                </p>
                                            </div>
                                            <div className="bg-teal-500/20 p-1 sm:p-1.5 rounded-md shrink-0">
                                                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-teal-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="bg-black/30 p-2 sm:p-2.5 rounded-lg border border-white/5">
                                                <div className="text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">Current Coordinates</div>
                                                <div className="text-white font-mono text-xs">
                                                    {geocodedLeads[currentIndex].lat?.toFixed(6)}° N, {geocodedLeads[currentIndex].lng?.toFixed(6)}° E
                                                </div>
                                            </div>
                                            <p className="text-slate-400 text-sm leading-relaxed">
                                                {geocodedLeads[currentIndex].formatted_address}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Bottom Stats */}
                        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 flex justify-between items-end">
                            <div className="flex gap-2">
                                <div className="bg-slate-900/80 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/5 flex flex-col">
                                    <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase">Altitude</span>
                                    <span className="text-white font-mono font-bold text-xs">1,240m</span>
                                </div>
                                <div className="bg-slate-900/80 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/5 flex flex-col hidden sm:flex">
                                    <span className="text-[8px] sm:text-[10px] text-slate-500 uppercase">Speed</span>
                                    <span className="text-white font-mono font-bold text-xs">342 km/h</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4">
                                {geocodedLeads.length > 0 && (
                                    <div className="text-right bg-slate-900/80 backdrop-blur-md px-2 py-1.5 rounded-lg border border-white/5">
                                        <div className="text-[8px] sm:text-[10px] text-slate-500 uppercase tracking-widest">Scanning</div>
                                        <div className="text-teal-400 font-mono text-sm sm:text-base font-bold leading-tight">
                                            {Math.round(((currentIndex + 1) / geocodedLeads.length) * 100 || 0)}%
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Compass/Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border-2 border-white/10 rounded-full flex items-center justify-center opacity-30">
                <div className="w-full h-[1px] bg-white/20" />
                <div className="h-full w-[1px] bg-white/20 absolute" />
                <div className="w-1/2 h-1/2 border border-teal-500/40 rounded-full animate-pulse" />

                {/* Scanner Beam Animation */}
                {isNavigating && (
                    <motion.div
                        animate={{
                            rotate: 360,
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-[20px] border-teal-500/10 rounded-full"
                        style={{ borderTopColor: 'rgba(20, 184, 166, 0.2)' }}
                    />
                )}
            </div>

            {/* worker drone icons moving (decorative) */}
            <AnimatePresence>
                {isNavigating && Array.from({ length: 3 }).map((_, i) => (
                    <motion.div
                        key={`drone-${i}`}
                        initial={{ x: -100, y: -100, opacity: 0 }}
                        animate={{
                            x: [Math.random() * 500, Math.random() * 800],
                            y: [Math.random() * 500, Math.random() * 800],
                            opacity: [0, 1, 0]
                        }}
                        transition={{ duration: 5 + i, repeat: Infinity, ease: "linear" }}
                        className="absolute z-30 pointer-events-none"
                    >
                        <Plane className="text-teal-400 w-4 h-4 rotate-45" />
                        <div className="text-[6px] text-teal-400/50 font-mono">SCOUT-0{i + 1}</div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-40" />
        </div>
    );
};

export default AerialLeadNavigator;
