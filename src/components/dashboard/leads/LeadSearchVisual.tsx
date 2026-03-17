import React, { useEffect, useState, useMemo } from 'react';
import { MapPin, Search, Activity, Target, Zap, Building2, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface LeadSearchVisualProps {
    industry: string;
    location: string;
}

const LeadSearchVisual: React.FC<LeadSearchVisualProps> = ({ industry, location }) => {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("Deploying AI Sales Agents...");

    // Memoize grid and targets to avoid purity errors during render
    const gridItems = useMemo(() => Array.from({ length: 36 }).map(() => ({
        hasBuilding: Math.random() > 0.6,
        buildingHeight: Math.random() * 60 + 20,
        delay: Math.random() * 2
    })), []);

    const targetPositions = useMemo(() => Array.from({ length: 5 }).map(() => ({
        left: Math.random() * 80 + 10,
        top: Math.random() * 80 + 10
    })), []);

    // Simulate progress and phase changes
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) return 100;
                return p + (Math.random() * 2 + 1);
            });
        }, 300);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (progress < 15) setStatusText(`Deploying AI Agents to ${location}...`);
        else if (progress < 35) setStatusText(`Scanning ${industry} sectors...`);
        else if (progress < 60) setStatusText("Extracting target profiles & contact info...");
        else if (progress < 85) setStatusText("Verifying lead authenticity with AI Truth Service...");
        else if (progress < 100) setStatusText("Qualifying leads & drafting outreach...");
        else setStatusText("Search complete! Finalizing results...");
    }, [progress, location, industry]);

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-teal-500/30">
            {/* Dark overlay gradients */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.1)_0,transparent_70%)]" />

            {/* Top Status Bar */}
            <div className="absolute top-8 left-0 w-full px-8 flex justify-between items-center z-10">
                <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 border border-slate-700/50 rounded-full">
                    <Zap className="w-5 h-5 text-teal-400 animate-pulse" />
                    <span className="text-white font-mono text-sm">ACTIVE SEARCH</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 border border-slate-700/50 rounded-full font-mono text-sm text-slate-300">
                    Target: <span className="text-teal-400 font-bold">{industry}</span> in <span className="text-blue-400 font-bold">{location}</span>
                </div>
            </div>

            {/* 3D Isometric View Container */}
            <div className="relative w-full max-w-4xl aspect-video flex items-center justify-center perspective-[1200px] mt-12">

                {/* 3D Map Transform */}
                <motion.div
                    initial={{ rotateX: 60, rotateZ: -45, scale: 0.8 }}
                    animate={{ rotateZ: [-45, -35, -45] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="relative w-[600px] h-[600px] transform-style-3d"
                >
                    {/* The Grid / City Base */}
                    <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 gap-2 opacity-30 shadow-[0_0_50px_rgba(20,184,166,0.3)]">
                        {gridItems.map((item, i) => (
                            <div key={i} className="bg-teal-500/20 border border-teal-500/40 rounded-sm relative">
                                {/* Random 3D Buildings floating up */}
                                {item.hasBuilding && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: item.buildingHeight }}
                                        transition={{ duration: 2, delay: item.delay }}
                                        className="absolute bottom-0 left-0 w-full bg-slate-800/80 border border-teal-500/50 transform-style-3d translate-z-[1px]"
                                        style={{ transformOrigin: 'bottom' }}
                                    >
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-50">
                                            <Building2 className="w-4 h-4 text-teal-300" />
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Radar Sweep Effect */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 origin-center pointer-events-none"
                    >
                        <div className="w-1/2 h-1/2 bg-gradient-to-tr from-transparent via-teal-500/20 to-teal-400/60 blur-md rounded-tl-full border-t border-l border-teal-400 opacity-70" />
                    </motion.div>

                    {/* The Worker / Agent Running Around (Aerial View) */}
                    <motion.div
                        animate={{
                            x: [100, 400, 300, 100, 500, 200, 100],
                            y: [100, 150, 400, 500, 300, 100, 100],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute w-8 h-8 -ml-4 -mt-4 transform-style-3d z-50 flex items-center justify-center"
                        style={{ translateZ: '20px' }}
                    >
                        {/* Agent Bubble */}
                        <div className="relative group">
                            <motion.div
                                animate={{ y: [-2, 2, -2] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.8)] border-2 border-white relative z-10"
                            >
                                <User className="w-6 h-6 text-white" />
                            </motion.div>

                            {/* Search Ping emanating from worker */}
                            <motion.div
                                animate={{ scale: [1, 3], opacity: [0.8, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="absolute inset-0 bg-teal-400 rounded-full z-0"
                            />

                            {/* Running dust trail */}
                            <motion.div
                                animate={{ opacity: [0.8, 0], scale: [0.5, 1.5], y: [0, 10] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/20 blur-sm rounded-full"
                            />
                        </div>
                    </motion.div>

                    {/* Target markers that pop up randomly */}
                    {targetPositions.map((pos, i) => (
                        <motion.div
                            key={`target-${i}`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: [0, 1, 1, 0],
                                opacity: [0, 1, 1, 0]
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                delay: i * 1.5,
                                times: [0, 0.1, 0.9, 1]
                            }}
                            className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full border border-blue-500/50 flex items-center justify-center"
                            style={{
                                left: `${pos.left}%`,
                                top: `${pos.top}%`,
                                translateZ: '5px'
                            }}
                        >
                            <Target className="w-6 h-6 text-blue-400 opacity-80" />
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                        </motion.div>
                    ))}

                </motion.div>
            </div>

            {/* Bottom Progress Bar & Status */}
            <div className="absolute bottom-12 w-full max-w-2xl px-8 z-10">
                <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <Search className="w-5 h-5 text-teal-400" />
                                {statusText}
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">Cross-referencing multiple databases in real-time...</p>
                        </div>
                        <div className="text-teal-400 font-mono text-2xl font-bold">
                            {Math.floor(progress)}%
                        </div>
                    </div>

                    {/* Progress Track */}
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-teal-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div className="bg-slate-800/50 rounded-lg py-2 border border-slate-700/50">
                            <div className="text-xs text-slate-400 mb-1">Signals Analyzed</div>
                            <div className="text-white font-mono font-bold">{Math.floor(progress * 1342).toLocaleString()}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg py-2 border border-slate-700/50">
                            <div className="text-xs text-slate-400 mb-1">Company Matches</div>
                            <div className="text-white font-mono font-bold animate-pulse">{Math.floor(progress * 1.5)}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg py-2 border border-slate-700/50">
                            <div className="text-xs text-slate-400 mb-1">Data Quality</div>
                            <div className="text-emerald-400 font-mono font-bold">99.8%</div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default LeadSearchVisual;
