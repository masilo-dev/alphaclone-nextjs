'use client';

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    Settings,
    Search,
    Bell,
    CheckCircle2,
    TrendingUp,
    Zap
} from 'lucide-react';

const InteractiveHeroPreview = () => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Mouse tracking for parallax
    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const moveX = (clientX - window.innerWidth / 2) / 25;
        const moveY = (clientY - window.innerHeight / 2) / 25;
        setMousePos({ x: moveX, y: moveY });
    };

    const springConfig = { damping: 25, stiffness: 700 };
    const x = useSpring(useMotionValue(0), springConfig);
    const y = useSpring(useMotionValue(0), springConfig);

    useEffect(() => {
        x.set(mousePos.x);
        y.set(mousePos.y);
    }, [mousePos, x, y]);

    // Simulated AI Terminal Text
    const [terminalLine, setTerminalLine] = useState('');
    const fullText = "AI Agent: Researching leads for Q3... found 127 targets. Drafting personalized outreach... 42 emails ready to sync.";

    useEffect(() => {
        let currentIdx = 0;
        const interval = setInterval(() => {
            setTerminalLine(fullText.substring(0, currentIdx));
            currentIdx++;
            if (currentIdx > fullText.length) {
                setTimeout(() => { currentIdx = 0; }, 2000);
            }
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            onMouseMove={handleMouseMove}
            className="relative w-full max-w-4xl mx-auto h-[500px] perspective-1000 hidden md:block"
        >
            {/* Main Dashboard Frame */}
            <motion.div
                style={{ rotateX: useTransform(y, [-20, 20], [5, -5]), rotateY: useTransform(x, [-20, 20], [-5, 5]), x, y }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl flex"
            >
                {/* Sidebar */}
                <div className="w-16 lg:w-48 border-r border-slate-800/50 p-4 hidden lg:flex flex-col gap-6 bg-slate-950/20">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
                            <Zap className="w-5 h-5 text-slate-950" />
                        </div>
                        <span className="font-bold text-white hidden lg:block">AlphaClone</span>
                    </div>
                    <div className="space-y-1">
                        {[
                            { icon: LayoutDashboard, label: 'Overview' },
                            { icon: Users, label: 'CRM' },
                            { icon: MessageSquare, label: 'Messages' },
                            { icon: Settings, label: 'Settings' }
                        ].map((item) => (
                            <div
                                key={item.label}
                                className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${activeTab === item.label ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
                                onClick={() => setActiveTab(item.label)}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-sm font-medium hidden lg:block">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <div className="h-16 border-b border-slate-800/50 flex items-center justify-between px-6 bg-slate-950/20">
                        <div className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-1.5 border border-slate-800">
                            <Search className="w-4 h-4 text-slate-500" />
                            <span className="text-xs text-slate-500 hidden sm:block">Search projects...</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Bell className="w-5 h-5 text-slate-400" />
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30" />
                        </div>
                    </div>

                    {/* Dashboard Content */}
                    <div className="flex-1 p-6 space-y-6 overflow-hidden">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Project Pipeline</h3>
                            <div className="flex gap-2">
                                <div className="h-8 w-16 bg-teal-500/20 border border-teal-500/30 rounded-lg" />
                                <div className="h-8 w-8 bg-slate-800 rounded-lg" />
                            </div>
                        </div>

                        {/* Cards Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50">
                                <div className="text-xs text-slate-400 mb-1">Active Projects</div>
                                <div className="text-2xl font-bold text-teal-400 flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    12
                                </div>
                            </div>
                            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50">
                                <div className="text-xs text-slate-400 mb-1">Q3 Forecast</div>
                                <div className="text-2xl font-bold text-blue-400">$64.2k</div>
                            </div>
                        </div>

                        {/* Activity Feed */}
                        <div className="space-y-3">
                            {[
                                { title: 'Marketing Landing Page', status: 'In Progress', color: 'teal' },
                                { title: 'AI Assistant Integration', status: 'Review', color: 'blue' }
                            ].map((proj, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="flex items-center justify-between p-3 bg-slate-950/30 rounded-xl border border-slate-800/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full bg-${proj.color}-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]`} />
                                        <span className="text-sm font-medium text-slate-300">{proj.title}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${proj.color}-500/10 text-${proj.color}-400 border border-${proj.color}-500/20 uppercase tracking-wider`}>
                                        {proj.status}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Floating Terminal (AI Agent) */}
            <motion.div
                style={{ x: useTransform(x, (val) => val * 1.5), y: useTransform(y, (val) => val * 1.5 - 20) }}
                className="absolute -bottom-10 -right-6 lg:-right-12 w-80 lg:w-96 bg-slate-950/90 backdrop-blur-2xl border border-teal-500/30 rounded-2xl p-4 shadow-2xl z-20 overflow-hidden"
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Growth Agent Active</span>
                    </div>
                    <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                    </div>
                </div>
                <div className="font-mono text-[11px] leading-relaxed">
                    <span className="text-slate-500 mr-2">root@alphaclone:~$</span>
                    <span className="text-slate-200">{terminalLine}</span>
                    <span className="w-1.5 h-4 bg-teal-500 inline-block ml-1 animate-pulse align-middle" />
                </div>
            </motion.div>

            {/* Accent Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-teal-500/10 blur-[100px] -z-10 rounded-full" />
        </div>
    );
};

export default InteractiveHeroPreview;
