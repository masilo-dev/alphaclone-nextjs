import React, { useState, useEffect } from 'react';
import { Zap, AlertTriangle, TrendingUp, ChevronRight, Loader2, Sparkles } from 'lucide-react';
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
            setInsights([]);
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
            <div className="ac-workspace-panel rounded-lg p-6 h-[200px] flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="w-6 h-6 text-teal-500 animate-spin mb-2" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analyzing business data...</span>
            </div>
        );
    }

    if (insights.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
                        <Zap className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            Outcome Engine
                        </h3>
                        <p className="text-sm text-white font-semibold mt-0.5">Suggested next actions for this workspace</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-9 px-4 text-xs uppercase font-black tracking-widest text-slate-500 hover:text-white hover:bg-white/5 border border-white/5 transition-all" onClick={loadInsights}>
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                            "ac-workspace-panel group relative overflow-hidden rounded-lg p-5 transition-all duration-300",
                            "hover:border-white/10",
                            insight.type === 'warning' ? "border-amber-500/20" : 
                            insight.type === 'opportunity' ? "border-violet-500/20" : 
                            "border-teal-500/20"
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn(
                                "flex items-center gap-2 py-1 px-2.5 rounded-lg border",
                                insight.type === 'warning' ? "bg-amber-400/10 border-amber-400/20 text-amber-400" :
                                insight.type === 'opportunity' ? "bg-violet-400/10 border-violet-400/20 text-violet-400" :
                                "bg-teal-400/10 border-teal-400/20 text-teal-400"
                            )}>
                                {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : 
                                 insight.type === 'opportunity' ? <TrendingUp className="w-4 h-4" /> : 
                                 <Sparkles className="w-4 h-4" />}
                                <span className="text-xs font-black uppercase tracking-wider">{insight.type}</span>
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

                        <div className="space-y-4 mb-6">
                            <div>
                                <h4 className="text-lg font-bold text-white leading-tight group-hover:text-teal-300 transition-colors">
                                    {insight.title}
                                </h4>
                                <p className="text-sm text-slate-400 leading-relaxed mt-2">
                                    {insight.description}
                                </p>
                            </div>

                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Confidence</span>
                                    <span className="text-[11px] font-black text-teal-400 uppercase tracking-widest">
                                        {insight.priority} priority
                                    </span>
                                </div>
                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: insight.priority === 'high' ? '92%' : insight.priority === 'medium' ? '72%' : '48%' }}
                                        className="h-full bg-teal-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button 
                            className={cn(
                                "w-full justify-between h-11 text-[12px] font-black uppercase tracking-[0.16em] transition-all relative overflow-hidden",
                                insight.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 text-black" :
                                insight.type === 'opportunity' ? "bg-violet-600 hover:bg-violet-700 text-white" :
                                "bg-teal-600 hover:bg-teal-500 text-black"
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
                                        {insight.actionLabel}
                                    </span>
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}

                            {insight.priority === 'high' && !executingId && (
                                <motion.div 
                                    animate={{ opacity: [0, 0.2, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-white"
                                />
                            )}
                        </Button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AIPredictiveWidget;

