'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

    return (
        <div className="relative w-full h-full bg-slate-950 overflow-hidden group">
            {/* Visual content Layer */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentScene.id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
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

            {/* Overlay Info Layer */}
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16">
                <motion.div
                    key={`text-${currentScene.id}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="max-w-3xl"
                >
                    <div className="flex gap-2 mb-4">
                        {currentScene.tags.map((tag, i) => (
                            <span key={i} className="px-3 py-1 bg-teal-500/20 text-teal-400 text-[10px] font-bold rounded-full uppercase tracking-widest border border-teal-500/30">
                                {tag}
                            </span>
                        ))}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                        {currentScene.title}
                    </h2>
                    <p className="text-lg md:text-xl text-slate-300 leading-relaxed font-medium">
                        {currentScene.description}
                    </p>
                </motion.div>
            </div>

            {/* Subtitle/Voiceover Scroll */}
            <div className="absolute bottom-32 left-8 md:left-16 right-8 md:right-16 h-8 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-teal-400/60 text-xs font-mono uppercase tracking-[0.2em] text-center"
                >
                    {isPlaying ? ">>> ANALYZING SYSTEM CORE_ WALKTHROUGH IN PROGRESS..." : ">>> SYSTEM READY. STANDBY FOR MISSION BRIEF_"}
                </motion.div>
            </div>

            {/* Player Controls Layer */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 to-transparent">
                <div className="flex flex-col gap-6">
                    {/* Progress Bar */}
                    <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="absolute top-0 left-0 h-full bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.6)]"
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
                                className="p-3 bg-white text-slate-950 rounded-full hover:scale-110 transition-transform"
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
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsPlaying(true)}
                        className="w-24 h-24 bg-teal-500 rounded-full flex items-center justify-center shadow-2xl shadow-teal-500/40"
                    >
                        <Play className="w-10 h-10 text-slate-950 fill-slate-950 ml-1" />
                    </motion.button>
                </div>
            )}
        </div>
    );
};

export default DynamicVideoSimulation;
