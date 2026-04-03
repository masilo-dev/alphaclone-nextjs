import React, { useState, useEffect } from 'react';
import { Zap, AlertTriangle, TrendingUp, ChevronRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
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

export const AIPredictiveWidget: React.FC = () => {
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
            await new Promise(resolve => setTimeout(resolve, 1500));
            
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
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-teal-500/10 rounded-lg">
                        <Zap className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                            Mission Control
                            <span className="px-1.5 py-0.5 bg-teal-500/20 text-[10px] text-teal-400 rounded-full border border-teal-500/30">900% AUTO</span>
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Proactive Business Intelligence</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-[10px] uppercase font-bold text-slate-400 hover:text-white" onClick={loadInsights}>
                    Refresh Engine
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.map((insight, idx) => (
                    <div 
                        key={idx} 
                        className={cn(
                            "group relative overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-teal-500/10",
                            insight.type === 'warning' ? "border-amber-500/20 hover:border-amber-500/40" : 
                            insight.type === 'opportunity' ? "border-violet-500/20 hover:border-violet-500/40" : 
                            "border-white/5 hover:border-teal-500/30"
                        )}
                    >
                        {/* Status Icon */}
                        <div className="flex items-start justify-between mb-4">
                            <div className={cn(
                                "p-2 rounded-xl border",
                                insight.type === 'warning' ? "bg-amber-400/10 border-amber-400/20 text-amber-400" :
                                insight.type === 'opportunity' ? "bg-violet-400/10 border-violet-400/20 text-violet-400" :
                                "bg-teal-400/10 border-teal-400/20 text-teal-400"
                            )}>
                                {insight.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
                                 insight.type === 'opportunity' ? <TrendingUp className="w-5 h-5" /> : 
                                 <Sparkles className="w-5 h-5" />}
                            </div>
                            <div className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border",
                                insight.priority === 'high' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-slate-800 border-white/5 text-slate-400"
                            )}>
                                {insight.priority} Priority
                            </div>
                        </div>

                        {/* Content */}
                        <div className="mb-6">
                            <h4 className="text-sm font-black text-white mb-1 group-hover:text-teal-400 transition-colors uppercase italic tracking-tight">
                                {insight.title}
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                {insight.description}
                            </p>
                        </div>

                        {/* Action */}
                        <Button 
                            className={cn(
                                "w-full justify-between h-9 text-[10px] font-black uppercase tracking-widest transition-all",
                                insight.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20" :
                                insight.type === 'opportunity' ? "bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20" :
                                "bg-slate-800 hover:bg-teal-500 text-white hover:text-black border border-white/5"
                            )}
                            onClick={() => handleExecute(insight)}
                            disabled={executingId === insight.actionType}
                        >
                            {executingId === insight.actionType ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                    Automating...
                                </>
                            ) : (
                                <>
                                    {insight.actionLabel}
                                    <ChevronRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>

                        {/* Decorative Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AIPredictiveWidget;
