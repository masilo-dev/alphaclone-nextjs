'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, 
    AlertTriangle, 
    CheckCircle2, 
    ArrowRight, 
    Loader2, 
    Target, 
    Radar, 
    Sparkles,
    Play,
    Settings
} from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';
import { toast } from 'react-hot-toast';

interface IntelligenceAction {
    id: string;
    label: string;
    description: string;
    icon: any;
    actionKey: string;
    color: string;
}

interface AIIntelligencePanelProps {
    moduleKey: string;
    title?: string;
    compact?: boolean;
}

export const AIIntelligencePanel: React.FC<AIIntelligencePanelProps> = ({ 
    moduleKey, 
    title = "AI Intelligence",
    compact = false 
}) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [executingAction, setExecutingAction] = useState<string | null>(null);

    const loadIntelligence = async () => {
        setLoading(true);
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return;
            const response = await fetch(
                `/api/intelligence/system?tenantId=${encodeURIComponent(tenantId)}&module=${encodeURIComponent(moduleKey)}`
            );
            const payload = await response.json();
            if (response.ok) {
                setData(payload.data);
            }
        } catch (err) {
            console.error('Failed to load AI intelligence:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadIntelligence();
    }, [moduleKey]);

    const handleExecuteAction = async (actionText: string) => {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;

        setExecutingAction(actionText);
        const toastId = toast.loading(`AI: Executing "${actionText}"...`, { id: 'ai-action' });

        try {
            // Map the recommendation text to a system action
            let systemKey = 'market_pulse';
            if (actionText.toLowerCase().includes('enrich')) systemKey = 'lead_enrichment';
            if (actionText.toLowerCase().includes('campaign')) systemKey = 'sales_campaign';
            if (actionText.toLowerCase().includes('triage')) systemKey = 'email_triage';
            if (actionText.toLowerCase().includes('reminder') || actionText.toLowerCase().includes('recovery')) systemKey = 'invoice_chasing';
            if (actionText.toLowerCase().includes('backlog') || actionText.toLowerCase().includes('task')) systemKey = 'project_architect';
            if (actionText.toLowerCase().includes('onboarding')) systemKey = 'onboarding_flow';
            if (actionText.toLowerCase().includes('proposal') || actionText.toLowerCase().includes('contract')) systemKey = 'contract_drafter';

            const res = await fetch('/api/social/command-center', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tenantId, 
                    mode: 'nexus_system_action', 
                    systemKey 
                })
            });
            const result = await res.json();

            if (res.ok) {
                toast.success(result.result?.message || 'Action executed successfully', { id: 'ai-action' });
                // Reload to see updated stats/recommendations
                loadIntelligence();
            } else {
                toast.error(result.error || 'Failed to execute action', { id: 'ai-action' });
            }
        } catch (err) {
            toast.error('Execution failed', { id: 'ai-action' });
        } finally {
            setExecutingAction(null);
        }
    };

    const scoreColor = useMemo(() => {
        const score = data?.module?.score || 0;
        if (score >= 80) return 'text-teal-400';
        if (score >= 60) return 'text-amber-400';
        return 'text-rose-400';
    }, [data?.module?.score]);

    if (loading && !data) {
        return (
            <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Scanning Module Logic...</p>
            </div>
        );
    }

    if (!data?.module) return null;

    if (compact) {
        return (
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h4>
                    </div>
                    <span className={`text-lg font-black ${scoreColor}`}>{Math.round(data.module.score)}%</span>
                </div>
                <div className="space-y-2">
                    {data.topActions.slice(0, 1).map((action: string, i: number) => (
                        <button
                            key={i}
                            onClick={() => handleExecuteAction(action)}
                            disabled={!!executingAction}
                            className="w-full group flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-all text-left"
                        >
                            <span className="text-xs text-teal-200 font-medium line-clamp-1">{action}</span>
                            <Play className="w-3 h-3 text-teal-400 group-hover:translate-x-1 transition-transform" />
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-24 h-24 text-teal-400" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-teal-400" />
                        {title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">Real-time Intelligence Stream</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase font-black">Performance</p>
                        <p className={`text-2xl font-black tracking-tighter ${scoreColor}`}>
                            {Math.round(data.module.score)}%
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl border border-white/10 bg-slate-950 flex items-center justify-center">
                        <Radar className={`w-6 h-6 ${scoreColor} animate-pulse`} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actions Section */}
                <div className="space-y-4">
                    <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Play className="w-3 h-3" />
                        Recommended Actions
                    </h4>
                    <div className="space-y-3">
                        {data.topActions.length === 0 ? (
                            <div className="p-4 rounded-2xl border border-dashed border-white/5 text-xs text-slate-500 text-center">
                                System state optimized. No immediate actions required.
                            </div>
                        ) : (
                            data.topActions.slice(0, 3).map((action: string, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => handleExecuteAction(action)}
                                    disabled={!!executingAction}
                                    className="w-full group relative p-4 rounded-2xl bg-slate-950 border border-white/5 hover:border-teal-500/40 hover:bg-slate-900 transition-all text-left flex items-start gap-4"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                                        {executingAction === action ? (
                                            <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                                        ) : (
                                            <Zap className="w-4 h-4 text-teal-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-200 line-clamp-1">{action}</p>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase">Autonomous Execution Ready</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Risks Section */}
                <div className="space-y-4">
                    <h4 className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        Systemic Risks
                    </h4>
                    <div className="space-y-3">
                        {data.systemicRisks.length === 0 ? (
                            <div className="p-4 rounded-2xl border border-dashed border-white/5 text-xs text-slate-500 text-center">
                                No critical vulnerabilities detected in this vector.
                            </div>
                        ) : (
                            data.systemicRisks.slice(0, 3).map((risk: string, i: number) => (
                                <div
                                    key={i}
                                    className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-left flex items-start gap-4"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm text-rose-200 leading-snug">{risk}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nexus Intelligence: Operational</span>
                </div>
                <button 
                    onClick={loadIntelligence}
                    className="text-[10px] text-teal-400 hover:text-teal-300 font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
                >
                    <Settings className="w-3 h-3" />
                    Recalibrate Scan
                </button>
            </div>
        </div>
    );
};
