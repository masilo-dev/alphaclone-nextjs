'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Terminal, 
    Shield, 
    Activity, 
    Zap, 
    Cpu, 
    Lock, 
    Target, 
    Send,
    ChevronRight,
    Command,
    X,
    Maximize2,
    Database
} from 'lucide-react';

interface MissionExecution {
    id: string;
    description: string;
    status: 'running' | 'completed' | 'failed';
    logs: string[];
    timestamp: string;
}

export default function AlphaExecutive() {
    const [missions, setMissions] = useState<MissionExecution[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [typingText, setTypingText] = useState('');
    const logsEndRef = useRef<HTMLDivElement>(null);

    const fullText = "SYSTEM_ALPHA_v2.0 // DIRECT_ACCESS_ENABLED // PROTOCOL_LEVEL_10";

    useEffect(() => {
        let i = 0;
        const timer = setInterval(() => {
            setTypingText(fullText.slice(0, i));
            i++;
            if (i > fullText.length) clearInterval(timer);
        }, 50);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/alpha');
            const data = await res.json();
            if (Array.isArray(data)) setMissions(data);
        } catch (e) {
            console.error(e);
        }
    };

    const runMission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isExecuting) return;

        setIsExecuting(true);
        try {
            await fetch('/api/alpha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: prompt })
            });
            setPrompt('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-[#000508] text-[#00FFD1] font-mono overflow-hidden z-[10000]">
            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />
            
            {/* Header / Security Bar */}
            <header className="h-14 border-b border-[#00FFD1]/20 flex items-center justify-between px-6 bg-[#000A10]">
                <div className="flex items-center gap-4">
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="p-1 border border-[#00FFD1] rounded-sm"
                    >
                        <Lock className="w-3 h-3" />
                    </motion.div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-[#00FFD1]/50 leading-none mb-1">SECURE_SHELL</span>
                        <span className="text-xs font-bold tracking-widest uppercase">{typingText}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-8 text-[10px] tracking-tighter opacity-70">
                        <div className="flex items-center gap-2">
                            <Activity className="w-3 h-3 text-yellow-400" />
                            <span>NODE_STATUS: STABLE</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Database className="w-3 h-3 text-blue-400" />
                            <span>LATENCY: 14MS</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 bg-[#00FFD1]/10 border border-[#00FFD1]/30" />
                        <div className="w-3 h-3 bg-red-500/50 border border-red-500" />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-56px)]">
                {/* Left: Execution Control */}
                <div className="md:col-span-4 border-r border-[#00FFD1]/10 p-6 flex flex-col gap-6 bg-[#00080D]">
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 text-white italic">
                            <Command className="w-4 h-4 text-[#00FFD1]" />
                            IMMEDIATE_EXECUTION_PRIORITY
                        </h2>
                        <form onSubmit={runMission} className="relative group">
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="ENTER MISSION PROTOCOL..."
                                className="w-full bg-[#00121A] border border-[#00FFD1]/20 p-4 text-xs focus:outline-none focus:border-[#00FFD1] min-h-[150px] resize-none transition-all placeholder:opacity-30 uppercase"
                            />
                            <button 
                                type="submit"
                                disabled={isExecuting || !prompt.trim()}
                                className="absolute bottom-4 right-4 p-2 bg-[#00FFD1] text-black hover:bg-[#00D1FF] transition-all disabled:opacity-30"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar">
                        <h3 className="text-[10px] font-bold text-[#00FFD1]/50 tracking-[0.3em]">CAPABILITY_MATRIX</h3>
                        {[
                            { icon: Target, label: 'LEAD_PROSPECTOR', status: 'ACTIVE' },
                            { icon: Send, label: 'OUTREACH_EXECUTIVE', status: 'READY' },
                            { icon: Zap, label: 'FAST_SCHEDULER', status: 'IDLE' },
                            { icon: Shield, label: 'SEMANTIC_SECURE', status: 'ENABLED' }
                        ].map((cap, i) => (
                            <div key={i} className="group p-3 border border-[#00FFD1]/10 bg-[#00121A] hover:border-[#00FFD1]/40 flex items-center justify-between transition-all">
                                <div className="flex items-center gap-3">
                                    <cap.icon className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                    <span className="text-[10px] font-bold group-hover:text-white">{cap.label}</span>
                                </div>
                                <span className={`text-[8px] px-1.5 py-0.5 border ${cap.status === 'ACTIVE' ? 'border-[#00FFD1] bg-[#00FFD1]/10' : 'border-white/10 opacity-30 italic'}`}>
                                    {cap.status}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-[#00FFD1]/5 border border-[#00FFD1]/20">
                        <p className="text-[9px] leading-relaxed opacity-60 uppercase italic">
                            Warning: Alpha Engine operates with High-High Privilege. Every execution is logged semantically to the core registry.
                        </p>
                    </div>
                </div>

                {/* Right: Real-time Mission Stream */}
                <div className="md:col-span-8 p-6 flex flex-col bg-[#000508]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold tracking-widest flex items-center gap-2">
                            <Activity className="w-3 h-3 animate-pulse" />
                            MISSION_CORE_STREAM
                        </h2>
                        <span className="text-[9px] opacity-40 italic">STREAMING_REALTIME_LOGS</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                        <AnimatePresence>
                            {missions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                                    <Cpu className="w-12 h-12 mb-4 animate-pulse" />
                                    <p className="text-xs tracking-tighter uppercase font-bold text-center">Awaiting System Deployment...</p>
                                </div>
                            ) : (
                                [...missions].reverse().map((mission) => (
                                    <motion.div 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={mission.id} 
                                        className="border border-[#00FFD1]/10 bg-[#000F15] p-5 relative group hover:border-[#00FFD1]/30 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-4 border-b border-[#00FFD1]/10 pb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${mission.status === 'completed' ? 'bg-[#00FFD1]' : 'bg-[#00D1FF] animate-pulse'}`} />
                                                <span className="text-[11px] font-bold text-white uppercase">{mission.description}</span>
                                            </div>
                                            <span className="text-[9px] font-mono opacity-40">[{mission.id.slice(0, 8)}]</span>
                                        </div>

                                        <div className="space-y-2 max-h-[300px] overflow-y-auto font-mono text-[10px]">
                                            {mission.logs.map((log, li) => (
                                                <div key={li} className="flex gap-4 group/log">
                                                    <span className="opacity-20 select-none">{li.toString().padStart(3, '0')}</span>
                                                    <span className={`flex-1 ${log.includes('ERROR') ? 'text-red-400 bg-red-400/10 px-1' : log.includes('EXECUTING') ? 'text-white font-bold underline decoration-[#00FFD1]/40' : 'text-[#00FFD1]/80 hover:text-white transition-colors'}`}>
                                                        {log}
                                                    </span>
                                                </div>
                                            ))}
                                            <div ref={logsEndRef} />
                                        </div>

                                        {mission.status === 'completed' && (
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Lock className="w-3 h-3 text-[#00FFD1]" />
                                            </div>
                                        )}
                                    </motion.div>
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Global Overlay Static */}
            <div className="fixed bottom-0 left-0 right-0 h-1 bg-[#00FFD1]/20">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    className="h-full bg-[#00FFD1]"
                />
            </div>
        </div>
    );
}
