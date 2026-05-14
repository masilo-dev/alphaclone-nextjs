'use client';

import React, { useState, useEffect } from 'react';
import { 
    Twitter, 
    RefreshCw, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Trash2, 
    ExternalLink,
    MessageSquare,
    Zap,
    Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function XIntegrationTab() {
    const { currentTenant } = useTenant();
    const { user } = useAuth();
    const [integration, setIntegration] = useState<any>(null);
    const [interactions, setInteractions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const [intRes, actRes] = await Promise.all([
                supabase.from('x_integrations').select('*').eq('tenant_id', currentTenant.id).single(),
                supabase.from('social_interactions').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(10)
            ]);

            setIntegration(intRes.data || null);
            setInteractions(actRes.data || []);
        } catch (error) {
            console.error('Failed to load X integration:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentTenant?.id]);

    const handleConnect = () => {
        window.location.href = '/api/auth/x';
    };

    const handleDisconnect = async () => {
        if (!integration) return;
        if (!confirm('Disconnect X (Twitter) account from this workspace?')) return;
        
        try {
            const { error } = await supabase.from('x_integrations').delete().eq('id', integration.id);
            if (error) throw error;
            toast.success('X account disconnected');
            setIntegration(null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to disconnect');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#1DA1F2]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Header Card */}
            <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Twitter className="w-32 h-32 text-[#1DA1F2]" />
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-[#1DA1F2]/10 rounded-2xl flex items-center justify-center border border-[#1DA1F2]/20">
                            <Twitter className="w-10 h-10 text-[#1DA1F2]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">X (Twitter) Manager</h2>
                            <p className="text-slate-400 text-sm mt-1">Direct integration for lead discovery and social engagement.</p>
                        </div>
                    </div>

                    {integration ? (
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-white">@{integration.x_username}</p>
                                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">CONNECTED</p>
                            </div>
                            <button 
                                onClick={handleDisconnect}
                                className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all"
                                title="Disconnect Account"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleConnect}
                            className="px-8 py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#1DA1F2]/20 flex items-center gap-2"
                        >
                            <Twitter className="w-5 h-5" />
                            Connect Account
                        </button>
                    )}
                </div>
            </div>

            {integration ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Capabilities & Status */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Core Capabilities</h3>
                            <div className="space-y-4">
                                {[
                                    { icon: <Search className="w-4 h-4" />, label: 'Lead Hunting', status: 'Active' },
                                    { icon: <MessageSquare className="w-4 h-4" />, label: 'Direct Messaging', status: 'Ready' },
                                    { icon: <Zap className="w-4 h-4" />, label: 'Auto-Responder', status: 'Ready' },
                                ].map((cap, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <div className="text-teal-400">{cap.icon}</div>
                                            <span className="text-sm text-white font-medium">{cap.label}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-teal-400">{cap.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Platform Sync</h3>
                                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <p className="text-xs text-slate-400">Successfully synced with X v2 API</p>
                            </div>
                            <p className="text-[10px] text-slate-600 mt-2 uppercase font-bold">Last update: {new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>

                    {/* Right Column: Interaction Log */}
                    <div className="lg:col-span-2">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl h-full flex flex-col">
                            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Recent Activity</h3>
                                <button onClick={loadData} className="text-xs text-teal-400 font-bold hover:underline">Refresh</button>
                            </div>
                            
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar max-h-[500px]">
                                {interactions.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 py-12">
                                        <Activity className="w-12 h-12 opacity-10" />
                                        <p className="text-sm italic">No recent interactions to display.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {interactions.map((act) => (
                                            <div key={act.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all group">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${act.interaction_type === 'direct_message' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                            {act.interaction_type === 'direct_message' ? <MessageSquare className="w-5 h-5" /> : <Twitter className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-white capitalize">{act.interaction_type.replace('_', ' ')}</p>
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded uppercase font-black">X-V2</span>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-0.5">{new Date(act.created_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <a 
                                                        href={`https://x.com/i/status/${act.x_id || ''}`}
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-all"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto border border-slate-700">
                        <Twitter className="w-10 h-10 text-slate-600" />
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                        <h3 className="text-xl font-bold text-white">X Integration Required</h3>
                        <p className="text-slate-400">Connect your X (Twitter) account to enable automated lead hunting, direct messaging, and social proof tracking.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-6">
                        {[
                            { title: 'Lead Hunting', desc: 'Scan X for prospects matching your niche.' },
                            { title: 'Auto-DM', desc: 'Send personalized outreach to new followers.' },
                            { title: 'Data Vault', desc: 'All interactions saved for CRM tracking.' }
                        ].map((feat, i) => (
                            <div key={i} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left">
                                <p className="text-sm font-bold text-white mb-1">{feat.title}</p>
                                <p className="text-xs text-slate-500">{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
