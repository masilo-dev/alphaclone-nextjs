'use client';

import React, { useState, useEffect } from 'react';
import {
    Mail,
    Sparkles,
    ArrowRight,
    ShieldCheck,
    Zap,
    Lock,
    Globe2,
    Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

const GmailTab: React.FC = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const originalTitle = document.title;
        document.title = "Gmail - Coming Soon";

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20,
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.title = originalTitle;
        };
    }, []);

    const features = [
        { icon: <Cpu className="w-5 h-5" />, title: "Neural Processing", desc: "Context-aware AI understanding every thread." },
        { icon: <Lock className="w-5 h-5" />, title: "Quantum Security", desc: "End-to-end encrypted AI analysis layers." },
        { icon: <Globe2 className="w-5 h-5" />, title: "Global Sync", desc: "Real-time unified communication across domains." }
    ];

    return (
        <div className="relative w-full h-[calc(100vh-100px)] overflow-hidden rounded-[2.5rem] bg-slate-950 border border-white/5 flex items-center justify-center group">
            {/* Dynamic Background Glassmorphism */}
            <div className="absolute inset-0 z-0 transition-transform duration-1000 ease-out" style={{ transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)` }}>
                <div className="absolute inset-0 bg-slate-950">
                    <img
                        src="/images/gmail-coming-soon.png"
                        alt="Neural Background"
                        className="w-full h-full object-cover opacity-40 mix-blend-overlay scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
                </div>

                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

                {/* Neural Mesh Pattern */}
                <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
                    <defs>
                        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            {/* Immersive Center Content */}
            <div className="relative z-10 max-w-4xl w-full px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                >
                    {/* Floating Icon Hexagon */}
                    <div className="relative w-32 h-32 mx-auto mb-10 group-hover:scale-110 transition-transform duration-700">
                        <div className="absolute inset-0 bg-gradient-to-tr from-teal-500 to-purple-500 rounded-[2rem] rotate-45 blur-2xl opacity-40 animate-pulse" />
                        <div className="absolute inset-0 bg-slate-900 border border-white/10 rounded-[2rem] rotate-45 flex items-center justify-center shadow-2xl">
                            <div className="-rotate-45">
                                <motion.div
                                    animate={{ rotateY: [0, 180, 360], scale: [1, 1.1, 1] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                                >
                                    <Mail className="w-12 h-12 text-teal-400 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)]" />
                                </motion.div>
                            </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center border border-white/20 shadow-xl animate-bounce">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-4 selection:bg-teal-500">
                        COMING <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-purple-400">SOON</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-400 font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
                        We are engineering the future of AI-driven communication. <br className="hidden md:block" />
                        AlphaClone <span className="text-white font-bold select-none px-2 py-0.5 bg-white/5 rounded-md border border-white/10">Gmail Commander</span> is nearing deployment.
                    </p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
                        <Button
                            onClick={() => toast.success('Added to VIP Waitlist!')}
                            className="h-16 px-10 bg-white text-black hover:bg-teal-500 hover:text-white rounded-2xl text-lg font-black transition-all duration-500 scale-100 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95"
                        >
                            JOIN EXPLORER ACCESS
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                            </span>
                            <span className="text-sm font-black text-slate-300 uppercase tracking-widest">Alpha Phase: 88% Stable</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl">
                        {features.map((f, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.2 + i * 0.1, duration: 0.8 }}
                                className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300 group/item"
                            >
                                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-white/10 group-hover/item:border-teal-500/50 transition-colors">
                                    <div className="text-teal-400">{f.icon}</div>
                                </div>
                                <h3 className="text-white font-bold mb-2 uppercase tracking-wide text-xs">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Bottom Tech Decal */}
            <div className="absolute bottom-10 left-12 right-12 flex items-center justify-between opacity-30 select-none">
                <div className="flex items-center gap-4">
                    <div className="h-[1px] w-24 bg-gradient-to-r from-teal-500 to-transparent" />
                    <span className="text-[10px] font-mono tracking-[0.4em] text-teal-500">SYSTEM.INIT::GMAIL.AI_CORE</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono tracking-[0.4em] text-purple-500">DEPLOYMENT_WINDOW::Q2_2026</span>
                    <div className="h-[1px] w-24 bg-gradient-to-l from-purple-500 to-transparent" />
                </div>
            </div>

            {/* Scanning Laser Effect */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/40 to-transparent blur-sm animate-[scan_8s_ease-in-out_infinite]" />
            <style jsx>{`
                @keyframes scan {
                    0% { transform: translateY(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(100vh); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default GmailTab;
