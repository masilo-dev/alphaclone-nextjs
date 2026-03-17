'use client';

import React from 'react';
import { motion } from 'framer-motion';

const LOCATIONS = [
    { name: 'Poland', top: '25%', left: '52%', delay: 0 },
    { name: 'Zimbabwe', top: '70%', left: '55%', delay: 0.5 },
    { name: 'USA', top: '35%', left: '20%', delay: 1 },
    { name: 'UK', top: '22%', left: '46%', delay: 1.5 },
    { name: 'India', top: '45%', left: '68%', delay: 2 },
    { name: 'Singapore', top: '55%', left: '78%', delay: 2.5 }
];

const InteractiveMap = () => {
    return (
        <div className="relative w-full aspect-[16/9] max-w-5xl mx-auto bg-slate-900/20 rounded-3xl border border-slate-800/50 overflow-hidden backdrop-blur-xl group">
            {/* Simple CSS World Map Placeholder */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <svg viewBox="0 0 1000 500" className="w-full h-full fill-slate-700">
                    <path d="M150,100 Q200,50 300,100 T500,100 T700,150 T900,100 V400 Q800,450 600,400 T300,450 T100,400 Z" opacity="0.1" />
                    {/* Simplified continents as blobs for high-end abstract feel */}
                    <circle cx="250" cy="180" r="100" fill="currentColor" /> {/* NA */}
                    <circle cx="280" cy="350" r="80" fill="currentColor" /> {/* SA */}
                    <circle cx="500" cy="150" r="90" fill="currentColor" /> {/* EUR/ASIA */}
                    <circle cx="550" cy="320" r="70" fill="currentColor" /> {/* AFR */}
                    <circle cx="800" cy="380" r="60" fill="currentColor" /> {/* AUS */}
                </svg>
            </div>

            {/* Glowing Points */}
            {LOCATIONS.map((loc, i) => (
                <div
                    key={loc.name}
                    className="absolute z-10"
                    style={{ top: loc.top, left: loc.left }}
                >
                    <div className="relative">
                        {/* Pulse */}
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: [1, 2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 3, repeat: Infinity, delay: loc.delay }}
                            className="absolute -inset-4 bg-teal-500/20 rounded-full blur-md"
                        />
                        {/* Point */}
                        <div className="w-2.5 h-2.5 bg-teal-400 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.8)] border border-white/20" />

                        {/* Label (Visible on Hover of Group) */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileHover={{ opacity: 1, y: 0 }}
                            className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950/80 border border-slate-800 rounded text-[10px] text-teal-400 font-bold backdrop-blur-md pointer-events-none"
                        >
                            {loc.name}
                        </motion.div>
                    </div>
                </div>
            ))}

            {/* Map Stats */}
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Global Infrastructure</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                        20+ <span className="text-slate-500 text-sm font-normal">Countries Served</span>
                    </div>
                </div>
                <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800`} />
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-teal-500/20 flex items-center justify-center text-[10px] font-bold text-teal-400">
                        +50
                    </div>
                </div>
            </div>

            {/* Subtle Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        </div>
    );
};

export default InteractiveMap;
