'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Activity, 
    Shield, 
    Zap, 
    Cpu, 
    Layers, 
    AlertTriangle, 
    TrendingUp,
    Play,
    Pause,
    XOctagon
} from 'lucide-react';

interface AgentState {
    id: string;
    task: string;
    progress: number;
    role: string;
}

export default function MissionControl() {
    // Simulated active agents for the premium UI demo
    const activeAgents: AgentState[] = [
        { id: "researcher-1", role: "Researcher", task: "Extracting Fintech CTO leads...", progress: 67 },
        { id: "executor-3", role: "Executor", task: "Dispatching LinkedIn outreach sequences", progress: 23 },
        { id: "qa-2", role: "QA", task: "Verifying outreach tone & compliance", progress: 89 }
    ];

    return (
        <div className="flex flex-col gap-6 p-6 bg-[#000F15] border border-[#00FFD1]/20 font-mono text-[#00FFD1]">
            {/* Header: System Vitals */}
            <div className="flex items-center justify-between border-b border-[#00FFD1]/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-sm border border-[#00FFD1]/30 flex items-center justify-center bg-[#001720]">
                        <Activity className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-[0.3em] uppercase">Swarm_Intelligence_Active</h2>
                        <div className="flex gap-4 text-xs text-[#00FFD1]/60">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> FORTRESS: ABSOLUTE</span>
                            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> AGENTS: 5/10</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 border border-[#00FFD1]/20 hover:bg-[#00FFD1]/10 transition-colors flex items-center gap-2 text-xs font-bold">
                        <Pause className="w-3 h-3" /> PAUSE_SWARM
                    </button>
                    <button className="px-4 py-2 bg-red-500/10 border border-red-500/40 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-2 text-xs font-bold">
                        <XOctagon className="w-3 h-3" /> EMERGENCY_STOP
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Agent View */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-bold tracking-widest text-[#00FFD1]/40 uppercase mb-4">Live_Agent_Deployments</h3>
                    <div className="space-y-3">
                        {activeAgents.map((agent) => (
                            <motion.div 
                                key={agent.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="p-4 bg-[#001720] border border-[#00FFD1]/10 flex flex-col gap-3 group hover:border-[#00FFD1]/40 transition-colors"
                            >
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="w-3 h-3" />
                                        <span className="font-bold">{agent.id.toUpperCase()}</span>
                                        <span className="px-2 py-0.5 bg-[#00FFD1]/10 rounded-full text-xs">{agent.role}</span>
                                    </div>
                                    <span className="text-[#00FFD1] font-bold">{agent.progress}%</span>
                                </div>
                                <div className="text-xs text-white opacity-80 italic">"{agent.task}"</div>
                                <div className="w-full h-1 bg-black overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${agent.progress}%` }}
                                        className="h-full bg-[#00FFD1] shadow-[0_0_10px_#00FFD1]"
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Swarm Intelligence Log */}
                    <div className="mt-8">
                        <h3 className="text-xs font-bold tracking-widest text-[#00FFD1]/40 uppercase mb-4">Next_Decisions_&_Reasoning</h3>
                        <div className="p-4 bg-black border border-[#00FFD1]/5 text-xs space-y-2 opacity-60">
                            <div className="flex gap-3">
                                <span className="text-[#00FFD1]/40">[17:34:12]</span>
                                <span>REASONING: LinkedIn rate limit at 70%. Shifting strategy to Email sequence for high-priority leads.</span>
                            </div>
                            <div className="flex gap-3">
                                <span className="text-[#00FFD1]/40">[17:34:45]</span>
                                <span>DECISION: Found 23 new leads. Prioritizing Top 5 based on Fintech industry success patterns.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Insights & Control */}
                <div className="space-y-6">
                    {/* Insights Card */}
                    <div className="p-6 bg-[#001720] border border-[#00FFD1]/20 space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FFD1]/5 blur-[60px] pointer-events-none" />
                        <h3 className="text-xs font-bold tracking-widest flex items-center gap-2">
                            <Zap className="w-4 h-4" /> EVOLUTION_INSIGHTS
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-[#00FFD1]/5 pb-2">
                                <span className="text-xs text-[#00FFD1]/60 uppercase">System_Intelligence_Gain</span>
                                <span className="text-lg font-bold text-white">+12%</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-[#00FFD1]/5 pb-2">
                                <span className="text-xs text-[#00FFD1]/60 uppercase">Predicted_Mission_Cap</span>
                                <span className="text-lg font-bold text-white">47/day</span>
                            </div>
                        </div>
                        <div className="p-3 bg-black border border-[#00FFD1]/5 flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-white animate-bounce" />
                            <span className="text-xs text-[#00FFD1] leading-relaxed italic">
                                RECOMMENDATION: AI detects high resonance in video outreach for your sector. Deploying experiment?
                            </span>
                        </div>
                    </div>

                    {/* Autonomy Level */}
                    <div className="p-6 bg-[#001D28] border border-[#00FFD1]/20 space-y-4">
                        <h3 className="text-xs font-bold tracking-widest uppercase">Autonomy_Level</h3>
                        <div className="flex flex-col gap-2">
                            {['SUPERVISION', 'MEDIUM', 'HIGH'].map((level) => (
                                <button 
                                    key={level}
                                    className={`py-2 text-xs font-bold border transition-all ${
                                        level === 'HIGH' 
                                        ? 'bg-[#00FFD1] text-black border-[#00FFD1]' 
                                        : 'border-[#00FFD1]/20 text-[#00FFD1]/60 hover:border-[#00FFD1]/60'
                                    }`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-[#00FFD1]/40 italic">
                            FULL_PERMISSION: Alpha allocates resources and shifts strategies with zero manual friction.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

