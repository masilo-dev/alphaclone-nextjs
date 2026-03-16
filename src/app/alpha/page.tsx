'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Cpu, 
    Shield, 
    Activity, 
    Send, 
    Zap, 
    Search, 
    CheckCircle2, 
    AlertCircle, 
    Terminal as TerminalIcon,
    Database,
    Globe,
    TrendingUp,
    Mail,
    Users
} from 'lucide-react';

interface MissionLog {
    id: string;
    description: string;
    status: 'running' | 'completed' | 'failed';
    logs: string[];
    startTime?: string;
}

export default function AlphaHub() {
    const [missions, setMissions] = useState<MissionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [newMission, setNewMission] = useState('');
    const [activeTab, setActiveTab] = useState<'missions' | 'system' | 'stats'>('missions');
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMissions();
        const interval = setInterval(fetchMissions, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [missions]);

    const fetchMissions = async () => {
        try {
            const res = await fetch('/api/alpha');
            const data = await res.json();
            if (Array.isArray(data)) {
                setMissions(data);
            }
        } catch (err) {
            console.error('Failed to fetch missions:', err);
        }
    };

    const startMission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMission.trim()) return;

        setLoading(true);
        try {
            await fetch('/api/alpha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: newMission })
            });
            setNewMission('');
            fetchMissions();
        } catch (err) {
            console.error('Failed to start mission:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020D1A] text-white p-6 md:p-10 font-sans">
            {/* Header */}
            <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-teal-500/20 rounded-lg border border-teal-500/30">
                            <Cpu className="text-teal-400 w-6 h-6 animate-pulse" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold hero-metallic-text tracking-tight">
                            ALPHA SYSTEM ENGINE
                        </h1>
                    </div>
                    <p className="text-slate-400 max-w-2xl">
                        Autonomous platform oversight and mission control. Monitoring DevOps, Marketing, Outreach, and Financial systems in real-time.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="glass-card px-4 py-2 rounded-full border border-teal-500/20 flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                        <span className="text-xs font-mono text-teal-400 uppercase tracking-widest">System Online</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: System Status Matrix */}
                <div className="lg:col-span-4 space-y-6">
                    <section className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield className="w-24 h-24 text-teal-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-teal-400" />
                            System Node Matrix
                        </h3>
                        
                        <div className="space-y-4">
                            {[
                                { name: 'Core API Gateway', status: 'Operational', color: 'text-teal-400', icon: Globe },
                                { name: 'DevOps Monitor', status: 'Scanning', color: 'text-blue-400', icon: Zap },
                                { name: 'Marketing Engine', status: 'Optimizing', color: 'text-purple-400', icon: TrendingUp },
                                { name: 'Outreach Protocol', status: 'Ready', color: 'text-teal-400', icon: Mail },
                                { name: 'Financial Registry', status: 'Synced', color: 'text-emerald-400', icon: Database },
                                { name: 'Lead Gen Neural', status: 'Idle', color: 'text-slate-400', icon: Search }
                            ].map((node, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-3">
                                        <node.icon className={`w-4 h-4 ${node.color}`} />
                                        <span className="text-sm text-slate-300 font-medium">{node.name}</span>
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-widest font-bold ${node.color}`}>
                                        {node.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="glass-card p-6 rounded-2xl">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <TerminalIcon className="w-5 h-5 text-teal-400" />
                            Autonomous Controls
                        </h3>
                        <form onSubmit={startMission} className="space-y-4">
                            <div className="relative">
                                <textarea 
                                    value={newMission}
                                    onChange={(e) => setNewMission(e.target.value)}
                                    placeholder="Assign mission to Alpha (e.g., 'Audit system for UI gaps' or 'Generate 5 leads for tech industry')"
                                    className="w-full bg-black/40 border border-teal-500/20 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 min-h-[100px] resize-none"
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={loading || !newMission}
                                className="w-full py-4 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 rounded-xl font-bold text-sm tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                            >
                                {loading ? 'DEPLOYING...' : 'DEPLOY MISSION'}
                                <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    </section>

                    <section className="glass-card p-6 rounded-2xl">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-teal-400" />
                            Engine Architecture
                        </h3>
                        <div className="space-y-4 text-xs leading-relaxed text-slate-400 font-mono">
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                <b className="text-teal-400 block mb-1">NEURAL MISSION LOOP</b>
                                Alpha uses a recursive ReAct loop to reason through multi-step commands, selecting the optimal tool for each phase.
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                <b className="text-blue-400 block mb-1">CROSS-PLATFORM AUDIT</b>
                                The Platform Audit protocol scans all system nodes (/crm, /finance, /devops) to maintain high-integrity architecture.
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                                <b className="text-purple-400 block mb-1">AUTONOMOUS OUTREACH</b>
                                Multi-account lead generation and Resend notifications are handled as unique system background processes.
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Mission Console */}
                <div className="lg:col-span-8 flex flex-col h-[700px]">
                    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-t-2xl w-fit border-t border-x border-white/10 ml-4">
                        <button 
                            onClick={() => setActiveTab('missions')}
                            className={`px-6 py-2 rounded-lg text-xs font-bold tracking-widest transition-all ${activeTab === 'missions' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            MISSIONS
                        </button>
                    </div>

                    <div className="flex-1 glass-card rounded-2xl rounded-tl-none border border-white/10 p-4 relative overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                            {missions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <TerminalIcon className="w-16 h-16 mb-4" />
                                    <p className="text-sm font-mono tracking-widest uppercase">No active missions in memory.</p>
                                </div>
                            ) : (
                                missions.map((mission) => (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={mission.id} 
                                        className="p-4 rounded-xl bg-white/5 border border-white/5"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-md ${mission.status === 'completed' ? 'bg-teal-500/20 text-teal-400' : mission.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {mission.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : mission.status === 'failed' ? <AlertCircle className="w-4 h-4" /> : <Activity className="w-4 h-4 animate-spin" />}
                                                </div>
                                                <h4 className="font-mono text-sm tracking-tight text-white font-semibold">
                                                    ID: {mission.id.toUpperCase()} - {mission.description}
                                                </h4>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-500">
                                                {mission.startTime ? new Date(mission.startTime).toLocaleTimeString() : ''}
                                            </span>
                                        </div>

                                        <div className="bg-black/50 rounded-lg p-4 font-mono text-xs space-y-2 border border-white/5 max-h-[250px] overflow-y-auto custom-scrollbar">
                                            {mission.logs.map((log, li) => (
                                                <div key={li} className="flex gap-3">
                                                    <span className="text-slate-600 select-none">[{li.toString().padStart(2, '0')}]</span>
                                                    <span className={log.includes('Error') ? 'text-red-400' : log.includes('Executing') ? 'text-blue-400' : 'text-slate-300'}>
                                                        {log}
                                                    </span>
                                                </div>
                                            ))}
                                            <div ref={logsEndRef} />
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
