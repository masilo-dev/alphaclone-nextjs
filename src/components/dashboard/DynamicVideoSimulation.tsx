'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, Maximize2, Monitor, Shield, Zap, Cpu, Globe } from 'lucide-react';

interface Scene {
    id: number;
    title: string;
    description: string;
    image: string;
    duration: number; // seconds
    tags: string[];
}

const scenes: Scene[] = [
    {
        id: 1,
        title: "The Problem & The Vision",
        description: "In today's market, fragmentation is a silent productivity killer. AlphaClone unifies your entire operation.",
        image: "/images/video/hero.png",
        duration: 90,
        tags: ["Vision", "Unified OS"]
    },
    {
        id: 2,
        title: "The Unified Interface",
        description: "Built for speed and visual excellence. Every organizational tenant gets an isolated, enterprise-grade environment.",
        image: "/images/video/hero.png", // Reuse hero for global dashboard
        duration: 90,
        tags: ["UX/UI", "Scalability"]
    },
    {
        id: 3,
        title: "AI Studio: Intelligence Engine",
        description: "Generative AI for marketing, content engines, and autonomous sales agents working 24/7.",
        image: "/images/video/ai_studio.png",
        duration: 90,
        tags: ["AI Studio", "Automation"]
    },
    {
        id: 4,
        title: "CRM & Project Command",
        description: "Front-to-back integration. From AI lead scoring to milestone delivery within a single workflow.",
        image: "/images/video/crm_projects.png",
        duration: 120,
        tags: ["CRM", "Projects"]
    },
    {
        id: 5,
        title: "SiteGuard: Security & Trust",
        description: "24/7 perimeter monitoring. End-to-end encryption ensures your enterprise data stays secure.",
        image: "/images/video/security.png",
        duration: 90,
        tags: ["Security", "SiteGuard"]
    },
    {
        id: 6,
        title: "Communication & Finance",
        description: "HD video conferencing and automated financial engines. Contracts and payments, simplified.",
        image: "/images/video/comms_finance.png",
        duration: 120,
        tags: ["Video", "Finance"]
    }
];

const DynamicVideoSimulation = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const currentScene = scenes[currentSceneIndex];

    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) {
                        if (currentSceneIndex < scenes.length - 1) {
                            setCurrentSceneIndex(currentSceneIndex + 1);
                            return 0;
                        } else {
                            setIsPlaying(false);
                            return 100;
                        }
                    }
                    // Calculate increment based on duration
                    return prev + (100 / (currentScene.duration * 10)); // 10 updates per second
                });
            }, 100);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, currentSceneIndex, currentScene.duration]);

    const handleReset = () => {
        setCurrentSceneIndex(0);
        setProgress(0);
        setIsPlaying(false);
    };

    // Cinematic Animation Variants
    const kenBurns: Variants = {
        initial: { scale: 1, x: '0%', y: '0%' },
        animate: {
            scale: 1.15,
            x: ['0%', '-2%', '0%'],
            y: ['0%', '-1%', '0%'],
            transition: {
                scale: { duration: 20, ease: "linear" },
                x: { duration: 25, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
                y: { duration: 20, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden group">
            {/* Visual Content Layer with Ken Burns */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentScene.id}
                    variants={kenBurns}
                    initial="initial"
                    animate={isPlaying ? "animate" : "initial"}
                    className="absolute inset-0"
                >
                    <img
                        src={currentScene.image}
                        alt={currentScene.title}
                        className="w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/40" />
                </motion.div>
            </AnimatePresence>

            {/* Cinematic Atmospherics */}
            {/* Film Grain */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.6)_100%)]" />

            {/* Scene-Specific Animated Overlays */}
            <AnimatePresence>
                {/* AI Studio Animations */}
                {currentScene.id === 3 && isPlaying && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute top-1/4 right-1/4 bg-slate-900/80 border border-teal-500/30 p-4 rounded-lg backdrop-blur-md shadow-2xl"
                        >
                            <div className="flex gap-2 items-center mb-2">
                                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-[10px] text-teal-400 font-mono uppercase">AI Agent Active</span>
                            </div>
                            <div className="text-xs text-slate-300 font-mono">
                                {"Generating marketing assets..."}
                                <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 0.8, repeat: Infinity }}
                                    className="inline-block w-1.5 h-3 bg-teal-400 ml-1 align-middle"
                                />
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* SiteGuard Security Radar */}
                {currentScene.id === 5 && isPlaying && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="w-[500px] h-[500px] rounded-full border border-blue-500/10 border-t-blue-500/50 [background:conic-gradient(from_0deg,transparent_0deg,rgba(59,130,246,0.1)_360deg)]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Shield className="w-16 h-16 text-blue-500/20" />
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* Overlay Info Layer */}
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 z-10">
                <motion.div
                    key={`text-${currentScene.id}`}
                    initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="max-w-3xl"
                >
                    <div className="flex gap-2 mb-4">
                        {currentScene.tags.map((tag, i) => (
                            <span key={i} className="px-3 py-1 bg-teal-500/20 text-teal-400 text-[10px] font-bold rounded-full uppercase tracking-widest border border-teal-500/30">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
                        {currentScene.title}
                    </h2>
                    <p className="text-lg md:text-xl text-slate-200 leading-relaxed font-medium drop-shadow-md">
                        {currentScene.description}
                    </p>
                </motion.div>
            </div>

            {/* Subtitle/Voiceover Scroll */}
            <div className="absolute bottom-32 left-8 md:left-16 right-8 md:right-16 h-8 overflow-hidden pointer-events-none z-10">
                <motion.div
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="text-teal-400/80 text-xs font-mono uppercase tracking-[0.2em] text-center"
                >
                    {isPlaying ? `>>> SEQUENCING NODE 0${currentScene.id} // ${currentScene.title.toUpperCase()} // EXECUTION: ACTIVE` : ">>> SYSTEM READY. STANDBY FOR MISSION BRIEF_"}
                </motion.div>
            </div>

            {/* Player Controls Layer */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-20">
                <div className="flex flex-col gap-6">
                    {/* Progress Bar */}
                    <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                        <motion.div
                            className="absolute top-0 left-0 h-full bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.8)]"
                            style={{ width: `${progress}%` }}
                        />
                        {/* Scene Markers */}
                        <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                            {scenes.map((_, i) => (
                                <div key={i} className="w-0.5 h-full bg-white/20" />
                            ))}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="p-3 bg-white text-slate-950 rounded-full hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                            >
                                {isPlaying ? <Pause className="w-6 h-6 fill-slate-950" /> : <Play className="w-6 h-6 fill-slate-950 ml-1" />}
                            </button>
                            <button
                                onClick={handleReset}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                            <div className="text-white/40 font-mono text-xs hidden md:block">
                                SCENE {currentSceneIndex + 1} / {scenes.length}
                            </div>
                        </div>

                        <div className="flex items-center gap-6 text-white/60">
                            <Volume2 className="w-5 h-5 cursor-pointer hover:text-white" />
                            <Maximize2 className="w-5 h-5 cursor-pointer hover:text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Play Overlay (Initial State) */}
            {!isPlaying && progress === 0 && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 backdrop-blur-md">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsPlaying(true)}
                        className="w-24 h-24 bg-teal-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(20,184,166,0.5)] border border-teal-400"
                    >
                        <Play className="w-10 h-10 text-slate-950 fill-slate-950 ml-1" />
                    </motion.button>
                </div>
            )}
        </div>
    );
};

export default DynamicVideoSimulation;
