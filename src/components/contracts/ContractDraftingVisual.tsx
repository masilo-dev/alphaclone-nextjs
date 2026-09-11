/* eslint-disable react-hooks/purity */
import React, { useEffect, useState, useMemo } from 'react';
import { Scale, FileText, CheckCircle2, ShieldCheck, PenTool, Database, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContractDraftingVisualProps {
    onComplete?: () => void;
    clientName?: string;
    durationMs?: number;
}

const ContractDraftingVisual: React.FC<ContractDraftingVisualProps> = ({
    onComplete,
    clientName = "Client",
    durationMs = 8000 // Total time the animation should take
}) => {
    const [phase, setPhase] = useState(0);
    const [progress, setProgress] = useState(0);

    const phases = [
        { title: "Analyzing Jurisdiction...", subtitle: "Scanning local and federal regulations for compliance", icon: Search },
        { title: `Scoping Service Matrix for ${clientName}...`, subtitle: "Extracting deliverables, timelines, and financial schedules", icon: Database },
        { title: "Drafting Legal Clauses...", subtitle: "Assembling iron-clad protection terms and IP rights", icon: PenTool },
        { title: "Finalizing Document...", subtitle: "Running cross-referenced validty checks", icon: ShieldCheck }
    ];

    // Smooth progress bar
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) return 100;
                return p + (100 / (durationMs / 30)); // Update approx every 30ms to reach 100% smoothly
            });
        }, 30);

        return () => clearInterval(interval);
    }, [durationMs]);

    // Handle phase switching based on total duration
    useEffect(() => {
        const phaseDuration = durationMs / phases.length;

        const timers = phases.map((_, i) => {
            if (i === 0) return null; // Phase 0 starts immediately
            return setTimeout(() => {
                setPhase(i);
            }, phaseDuration * i);
        });

        const completeTimer = setTimeout(() => {
            if (onComplete) onComplete();
        }, durationMs + 500); // 500ms extra buffer for 100% read

        return () => {
            timers.forEach(t => t && clearTimeout(t));
            clearTimeout(completeTimer);
        };
    }, [durationMs, onComplete, phases.length]);

    const CurrentIcon = phases[phase].icon;

    // Memoize random positions to avoid purity errors during render
    const [docPositions, setDocPositions] = useState<any[]>([]);

    useEffect(() => {
        setDocPositions(Array.from({ length: 8 }).map(() => ({
            x: Math.random() * 300 + 50,
            y: Math.random() * 300 + 50,
            rotateZ: Math.random() * 90 - 45,
            duration: Math.random() * 2 + 2
        })));
    }, []);

    return (
        <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-indigo-500/30">
            {/* Subtle law/indigo background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0,transparent_70%)]" />

            {/* Top Status */}
            <div className="absolute top-8 left-0 w-full px-8 flex justify-center items-center z-10">
                <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-5 py-2 border border-indigo-500/30 rounded-full">
                    <Scale className="w-5 h-5 text-indigo-400" />
                    <span className="text-white font-serif tracking-widest text-sm uppercase">Legal AI Core Active</span>
                </div>
            </div>

            {/* Central 3D / Isometric Animation */}
            <div className="relative w-full max-w-3xl flex-1 flex flex-col items-center justify-center -mt-8">

                {/* The Isometric Scene */}
                <motion.div
                    initial={{ rotateX: 60, rotateZ: -45, scale: 0.9 }}
                    animate={{ rotateZ: [-45, -35, -45] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="relative w-[400px] h-[400px] transform-style-3d mb-12"
                >
                    {/* The "Desk" Base */}
                    <div className="absolute inset-0 bg-slate-800/40 border-2 border-indigo-500/20 rounded-xl shadow-[0_0_60px_rgba(99,102,241,0.2)]">
                        {/* Grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
                    </div>

                    {/* Flying Documents */}
                    {docPositions.map((pos: { x: number; y: number; rotateZ: number; duration: number }, i: number) => (
                        <motion.div
                            key={`doc-${i}`}
                            initial={{
                                z: 0,
                                opacity: 0,
                                x: pos.x,
                                y: pos.y
                            }}
                            animate={{
                                z: [0, 150, 300],
                                opacity: [0, 1, 0],
                                rotateZ: pos.rotateZ
                            }}
                            transition={{
                                duration: pos.duration,
                                repeat: Infinity,
                                delay: i * 0.4,
                                ease: "easeInOut"
                            }}
                            className="absolute w-16 h-20 bg-white shadow-xl flex flex-col gap-1 p-2 transform-style-3d border border-slate-200"
                        >
                            <div className="w-full h-1 bg-indigo-500/20" />
                            <div className="w-3/4 h-1 bg-slate-300" />
                            <div className="w-full h-1 bg-slate-200" />
                            <div className="w-5/6 h-1 bg-slate-200" />
                            <div className="mt-auto self-end w-4 h-4 rounded-full border border-indigo-500/50 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            </div>
                        </motion.div>
                    ))}

                    {/* Central Processing Column / Pen */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform-style-3d text-indigo-400 opacity-80" style={{ transform: 'translateZ(100px) rotateX(-90deg)' }}>
                        <Scale className="w-24 h-24 animate-pulse" />
                    </div>

                    {/* Radar / Scanning Sweep underneath */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 origin-center pointer-events-none"
                    >
                        <div className="w-1/2 h-1/2 bg-gradient-to-tr from-transparent via-indigo-500/20 to-indigo-400/50 blur-xl rounded-tl-full" />
                    </motion.div>

                </motion.div>

                {/* Dynamic Text Phases */}
                <div className="absolute bottom-32 w-full text-center px-4 h-24 flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`phase-${phase}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col items-center"
                        >
                            <CurrentIcon className="w-8 h-8 text-indigo-400 mb-3" />
                            <h3 className="text-xl md:text-2xl font-bold text-white tracking-wide">{phases[phase].title}</h3>
                            <p className="text-slate-400 mt-2 text-sm md:text-base font-medium">{phases[phase].subtitle}</p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-900">
                <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
};

export default ContractDraftingVisual;
