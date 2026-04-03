import React, { useState, useEffect } from 'react';
import { Zap, AlertTriangle, TrendingUp, ChevronRight, Loader2, Sparkles, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { aiCore } from '@/services/core/AICore';
import { tenantService } from '@/services/tenancy/TenantService';
import { Button } from '../ui/UIComponents';
import { cn } from '@/lib/utils';

interface Insight {
    type: 'action' | 'warning' | 'opportunity';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    actionLabel: string;
    actionType: string;
    metadata?: any;
}

interface AIPredictiveWidgetProps {
    onActionComplete?: (message: string) => void;
}

export const AIPredictiveWidget: React.FC<AIPredictiveWidgetProps> = ({ onActionComplete }) => {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [executingId, setExecutingId] = useState<string | null>(null);

    useEffect(() => {
        loadInsights();
    }, []);

    const loadInsights = async () => {
        setLoading(true);
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (tenantId) {
                const data = await aiCore.getProactiveInsights(tenantId);
                setInsights(data);
            }
        } catch (error) {
            console.error('Failed to load insights:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExecute = async (insight: Insight) => {
        setExecutingId(insight.actionType);
        try {
            // Logic for specific actions
            if (insight.actionType === 'DRAFT_CONTRACT') {
                const { contractService } = await import('@/services/contractService');
                await contractService.autoDraftForProject(insight.metadata?.projectId);
            }
            
            // Simulation of success for now
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Dispatch global celebration event
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('action-celebration', {
                    detail: {
                        message: `Great job! ${insight.actionLabel} completed.`,
                        points: insight.priority === 'high' ? 15 : 5
                    }
                });
                window.dispatchEvent(event);
            }
            
            // Trigger celebration
            if (onActionComplete) {
                onActionComplete(`Great job! ${insight.actionLabel} completed.`);
            }

            // Remove from list after execution
            setInsights(prev => prev.filter(i => i.actionType !== insight.actionType));
        } catch (error) {
            console.error('Execution failed:', error);
        } finally {
            setExecutingId(null);
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-900/50 backdrop-blur border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin mb-2" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analyzing Business Data...</span>
            </div>
        );
    }

    if (insights.length === 0) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20">
                            <Zap className="w-5 h-5 text-teal-400" />
                        </div>
                        <motion.div 
                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-teal-400/20 blur-xl rounded-full -z-10"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-3">
                            Outcome Engine
                            <span className="px-2 py-0.5 bg-teal-500/10 text-[9px] text-teal-400 rounded-full border border-teal-500/20 font-black tracking-widest">PROACTIVE v3.5</span>
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Next Best Action Sequence</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-9 px-4 text-[10px] uppercase font-black tracking-widest text-slate-500 hover:text-white hover:bg-white/5 border border-white/5 transition-all" onClick={loadInsights}>
                    Re-Sync Data
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {insights.map((insight, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                            "group relative overflow-hidden bg-slate-900/40 backdrop-blur-md border rounded-2xl p-6 transition-all duration-500",
                            "hover:border-teal-500/40 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)]",
                            insight.type === 'warning' ? "border-amber-500/20 shadow-amber-500/5" : 
                            insight.type === 'opportunity' ? "border-violet-500/20 shadow-violet-500/5" : 
                            "border-white/5"
                        )}
                    >
                        {/* Status Hub */}
                        <div className="flex items-center justify-between mb-5">
                            <div className={cn(
                                "flex items-center gap-3 py-1.5 px-3 rounded-lg border",
                                insight.type === 'warning' ? "bg-amber-400/10 border-amber-400/20 text-amber-400" :
                                insight.type === 'opportunity' ? "bg-violet-400/10 border-violet-400/20 text-violet-400" :
                                "bg-teal-400/10 border-teal-400/20 text-teal-400"
                            )}>
                                {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : 
                                 insight.type === 'opportunity' ? <TrendingUp className="w-4 h-4" /> : 
                                 <Sparkles className="w-4 h-4" />}
                                <span className="text-[10px] font-black uppercase tracking-wider">{insight.type}</span>
                            </div>
                            <div className="flex -space-x-1">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        i <= (insight.priority === 'high' ? 3 : insight.priority === 'medium' ? 2 : 1) 
                                            ? "bg-teal-500" : "bg-slate-800"
                                    )} />
                                ))}
                            </div>
                        </div>

                        {/* Analysis Content */}
                        <div className="space-y-4 mb-8">
                            <div>
                                <h4 className="text-xl font-black text-white leading-tight group-hover:text-teal-400 transition-colors uppercase italic tracking-tighter">
                                    {insight.title}
                                </h4>
                                <p className="text-xs text-slate-400 leading-relaxed font-bold mt-2">
                                    {insight.description}
                                </p>
                            </div>

                            {/* Momentum Progress Indicator */}
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Grounding Score</span>
                                    <span className="text-[9px] font-black text-teal-500 uppercase tracking-widest">Critical Path</span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: "95%" }}
                                        className="h-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.6)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Interface */}
                        <Button 
                            className={cn(
                                "w-full justify-between h-12 text-[12px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden",
                                insight.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20" :
                                insight.type === 'opportunity' ? "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20" :
                                "bg-teal-600 hover:bg-teal-500 text-black shadow-lg shadow-teal-500/25"
                            )}
                            onClick={() => handleExecute(insight)}
                            disabled={executingId === insight.actionType}
                        >
                            {executingId === insight.actionType ? (
                                <div className="flex items-center justify-center w-full">
                                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                                    <span>Syncing Workflow...</span>
                                </div>
                            ) : (
                                <>
                                    <span className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 fill-current" />
                                        DO THIS NOW: {insight.actionLabel}
                                    </span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                            
                            {/* Urgent Pulsing Overlay for high priority */}
                            {insight.priority === 'high' && !executingId && (
                                <motion.div 
                                    animate={{ opacity: [0, 0.2, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-white"
                                />
                            )}
                        </Button>

                        {/* Top-right corner accent */}
                        <div className="absolute top-0 right-0 p-1">
                            <div className="w-8 h-8 flex items-center justify-center border-b border-l border-white/5 rounded-bl-xl bg-slate-900/50">
                                <ArrowUpRight className="w-3 h-3 text-slate-700" />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AIPredictiveWidget;
