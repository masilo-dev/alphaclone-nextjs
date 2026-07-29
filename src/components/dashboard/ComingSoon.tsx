'use client';
/* eslint-disable react-hooks/purity */

import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mail, Clock, ArrowLeft, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ComingSoonProps {
    title: string;
    subtitle: string;
    videoUrl?: string; // Optional custom video or animation URL
    icon?: React.ComponentType<any>;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, subtitle, videoUrl, icon: Icon = Mail }) => {
    const router = useRouter();
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    // Memoize particles to avoid purity errors during render
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        const newParticles = [...Array(20)].map(() => ({
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            left: Math.random() * 100,
            top: Math.random() * 100,
            duration: Math.random() * 5 + 5
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="relative w-full h-[calc(100vh-100px)] overflow-hidden rounded-[2.5rem] bg-slate-950 border border-white/5 flex items-center justify-center">
            {/* Immersive Neural Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-slate-950 to-slate-950" />

                {/* Simulated Neural Network Animation */}
                <div className="absolute inset-0 opacity-20">
                    {particles.map((p, i) => (
                        <motion.div
                            key={i}
                            className="absolute bg-teal-500/40 rounded-full blur-sm"
                            style={{
                                width: p.width + 'px',
                                height: p.height + 'px',
                                left: p.left + '%',
                                top: p.top + '%',
                            }}
                            animate={{
                                y: [0, -100, 0],
                                opacity: [0.1, 0.5, 0.1],
                            }}
                            transition={{
                                duration: p.duration,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="relative z-10 text-center max-w-2xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    {/* Pulsing Icon Container */}
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 bg-teal-500/20 rounded-3xl blur-xl animate-pulse" />
                        <div className="relative bg-slate-900 border border-white/10 rounded-3xl h-full w-full flex items-center justify-center shadow-2xl">
                            <motion.div
                                animate={{
                                    scale: [1, 1.1, 1],
                                    rotateY: [0, 180, 360]
                                }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <Icon className="w-10 h-10 text-teal-400" />
                            </motion.div>
                        </div>
                        <div className="absolute -top-2 -right-2 bg-purple-600 rounded-lg p-1.5 shadow-lg border border-white/20">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">
                        {title}
                    </h1>

                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full mb-8">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                            Development In Progress{dots}
                        </span>
                    </div>

                    <p className="text-lg md:text-xl text-slate-400 mb-12 leading-relaxed">
                        {subtitle}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Go Back
                        </button>
                        <div className="flex items-center gap-2 px-6 py-3 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
                            <Shield className="w-4 h-4" />
                            <span className="text-sm font-bold tracking-tight">Phase 1 Integration Ready</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Neural Laser Scan Effect */}
            <motion.div
                className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/30 to-transparent blur-sm"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
        </div>
    );
};

export default ComingSoon;

