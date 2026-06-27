'use client';

import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, XCircle, Globe, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantService } from '@/services/tenancy/TenantService';

interface ZohoIntegrationProps {
    user: any;
}

const ZOHO_REGIONS = [
    { id: 'US', label: 'United States (com)', icon: '🇺🇸' },
    { id: 'EU', label: 'Europe (eu)', icon: '🇪🇺' },
    { id: 'IN', label: 'India (in)', icon: '🇮🇳' },
    { id: 'AU', label: 'Australia (com.au)', icon: '🇦🇺' },
    { id: 'JP', label: 'Japan (jp)', icon: '🇯🇵' },
    { id: 'CA', label: 'Canada (ca)', icon: '🇨🇦' },
];

const ZohoIntegration: React.FC<ZohoIntegrationProps> = ({ user }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState('US');
    const [configuredRegion, setConfiguredRegion] = useState<string | null>(null);
    const [campaignsReady, setCampaignsReady] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testRecipient, setTestRecipient] = useState('');

    useEffect(() => {
        if (user) {
            checkConnection();
        } else {
            setLoading(false);
        }
    }, [user]);

    const checkConnection = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
            const data = await res.json();
            setIsConnected(!!data.isConnected);
            setCampaignsReady(!!data.campaignsReady);
            if (data.configuredRegion) {
                setConfiguredRegion(data.configuredRegion);
            }
        } catch (err) {
            console.error('Check Zoho connection error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        if (!user) return;
        setConnecting(true);
        
        // Build the connection URL with region and state (userId)
        const connectUrl = `/api/auth/zoho/connect?region=${selectedRegion}&state=${user.id}`;
        window.location.href = connectUrl;
    };

    const handleDisconnect = async () => {
        if (!user || !window.confirm('Are you sure you want to disconnect Zoho? This will remove access to Zoho Mail and CRM features.')) return;

        try {
            const res = await fetch('/api/auth/zoho/disconnect', { method: 'POST', credentials: 'include' });
            if (res.ok) {
                setIsConnected(false);
                setConfiguredRegion(null);
                toast.success('Zoho disconnected successfully.');
            } else {
                throw new Error('Failed to disconnect');
            }
        } catch (err: any) {
            console.error('Disconnect error:', err);
            toast.error('Failed to disconnect Zoho');
        }
    };

    const handleSendTest = async () => {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            toast.error('Select a workspace first');
            return;
        }
        if (!testRecipient.trim()) {
            toast.error('Enter a test recipient email');
            return;
        }
        setIsTesting(true);
        try {
            const res = await fetch('/api/email/providers/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    provider: 'zoho',
                    to: testRecipient.trim(),
                    subject: 'Zoho connection test',
                    message: 'Your Zoho integration is ready for campaigns and outreach.',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Zoho test failed');
            toast.success('Zoho test email sent successfully');
        } catch (err: any) {
            toast.error(err.message || 'Zoho test failed');
        } finally {
            setIsTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-6 h-6 text-teal-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4">Zoho Workspace Integration</h3>
                <p className="text-slate-400 mb-6">
                    Connect your Zoho account to synchronize CRM data and manage Zoho Mail directly within the platform.
                </p>
            </div>

            <div className={`p-6 rounded-3xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'} relative overflow-hidden transition-all duration-500`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex items-start gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isConnected ? 'bg-teal-500/10 text-teal-400 shadow-teal-500/10' : 'bg-slate-800 text-slate-500'}`}>
                            <Database className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-black text-white uppercase tracking-wider">
                                    Zoho Business Services
                                </h4>
                                {isConnected ? (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                                        <span className="text-xs font-black text-green-400 uppercase tracking-tighter">Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 border border-white/5 rounded-full">
                                        <AlertCircle className="w-3 h-3 text-slate-500" />
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">Inactive</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
                                {isConnected
                                    ? "Your Zoho account is active. CRM synchronization and Mail services are fully operational."
                                    : "Integrate your Zoho CRM and Mail for a unified business experience. Select your data region to begin."
                                }
                            </p>
                            {isConnected && configuredRegion && (
                                <div className="mt-2 text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-teal-400" />
                                    <span>Active Datacenter: <strong className="text-teal-400 uppercase">{configuredRegion}</strong></span>
                                    {campaignsReady && (
                                        <span className="ml-2 px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-400 text-[10px] font-black uppercase">Campaigns</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {!isConnected && (
                            <div className="relative group">
                                <label className="absolute -top-2 left-3 px-1 bg-[#0f172a] text-xs font-black text-teal-500 uppercase tracking-widest z-10 transition-colors group-focus-within:text-teal-400">
                                    Select Region
                                </label>
                                <select
                                    value={selectedRegion}
                                    onChange={(e) => setSelectedRegion(e.target.value)}
                                    className="appearance-none bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-500 transition-all min-w-[200px] cursor-pointer"
                                >
                                    {ZOHO_REGIONS.map(region => (
                                        <option key={region.id} value={region.id}>
                                            {region.icon} {region.label}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500 group-hover:text-teal-500 transition-colors">
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="mt-2 text-[11px] text-amber-500 flex items-center gap-1.5 max-w-[200px]">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Must match your Zoho account region</span>
                                </div>
                            </div>
                        )}

                        {isConnected ? (
                            <button
                                onClick={handleDisconnect}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl border border-white/5 transition-all active:scale-95"
                            >
                                <XCircle className="w-4 h-4" />
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                {connecting ? 'Connecting...' : 'Connect Zoho'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl">
                    <h4 className="text-sm font-semibold text-teal-400 mb-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                        CRM Sync
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Sync leads, contacts, and opportunities between AlphaClone and Zoho CRM automatically.
                    </p>
                </div>
                <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl">
                    <h4 className="text-sm font-semibold text-teal-400 mb-2 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                        Zoho Mail
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Access your Zoho Mail inbox, send emails, and track communications without leaving AlphaClone.
                    </p>
                </div>
            </div>
            {isConnected && (
                <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl">
                    <h4 className="text-sm font-semibold text-teal-400 mb-3">Send Test Email</h4>
                    <div className="flex flex-col md:flex-row gap-3">
                        <input
                            type="email"
                            value={testRecipient}
                            onChange={(e) => setTestRecipient(e.target.value)}
                            placeholder="recipient@domain.com"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500"
                        />
                        <button
                            onClick={handleSendTest}
                            disabled={isTesting}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white font-black text-xs uppercase tracking-widest rounded-xl border border-white/5 transition-all"
                        >
                            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Test'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ZohoIntegration;
