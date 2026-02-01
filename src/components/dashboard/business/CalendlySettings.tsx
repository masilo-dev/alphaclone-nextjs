import React, { useState } from 'react';
import { Calendar, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, XCircle } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

const CalendlySettings: React.FC = () => {
    const { currentTenant, refreshTenants } = useTenant();
    const [connecting, setConnecting] = useState(false);
    const [manualUrl, setManualUrl] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [saving, setSaving] = useState(false);
    const calendlyConfig = (currentTenant?.settings as any)?.calendly;

    const isConnected = calendlyConfig?.enabled && calendlyConfig?.accessToken;

    const handleConnect = () => {
        if (!currentTenant) return;
        setConnecting(true);
        // Redirect to our connect API route
        window.location.href = `/api/auth/calendly/connect?tenantId=${currentTenant.id}`;
    };

    const handleDisconnect = async () => {
        if (!currentTenant || !window.confirm('Are you sure you want to disconnect Calendly? This will disable the booking page.')) return;

        try {
            const updatedSettings = {
                ...(currentTenant.settings as any),
                calendly: {
                    ...calendlyConfig,
                    enabled: false,
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    eventUrl: null
                }
            };

            const { error } = await supabase
                .from('tenants')
                .update({ settings: updatedSettings })
                .eq('id', currentTenant.id);

            if (error) throw error;
            await refreshTenants();
            alert('Calendly disconnected successfully.');
        } catch (err: any) {
            console.error('Disconnect error:', err);
            alert('Failed to disconnect Calendly');
        }
    };

    const handleSaveManual = async () => {
        if (!currentTenant || !manualUrl) return;
        setSaving(true);
        try {
            const updatedSettings = {
                ...(currentTenant.settings as any),
                calendly: {
                    ...(currentTenant.settings as any)?.calendly,
                    enabled: true,
                    eventUrl: manualUrl,
                    isManual: true
                }
            };

            const { error } = await supabase
                .from('tenants')
                .update({ settings: updatedSettings })
                .eq('id', currentTenant.id);

            if (error) throw error;
            await refreshTenants();
            setShowManual(false);
            setManualUrl('');
        } catch (err) {
            console.error('Save manual error:', err);
            alert('Failed to save link');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Calendly Integration</h3>
                <p className="text-slate-400 mb-6">
                    Connect your Calendly account to enable the automated booking system and sync events to your dashboard.
                </p>
            </div>

            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    {isConnected ? 'Calendly Connected' : 'Calendly Not Connected'}
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                {isConnected
                                    ? `Successfully linked to your Calendly account. Your booking page is now active using your Calendly events.`
                                    : 'Connect your account to allow clients to book meetings directly through AlphaClone.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isConnected ? (
                            <>
                                <button
                                    onClick={handleConnect}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reconnect
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col gap-3 items-end">
                                <button
                                    onClick={handleConnect}
                                    disabled={connecting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {connecting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    {connecting ? 'CONNECTING...' : 'CONNECT CALENDLY'}
                                </button>
                                <button
                                    onClick={() => setShowManual(!showManual)}
                                    className="text-xs text-slate-500 hover:text-teal-400 font-medium underline underline-offset-4"
                                >
                                    {showManual ? 'Cancel manual entry' : 'Or connect manually with link'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {showManual && !isConnected && (
                    <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paste your Calendly Link</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualUrl}
                                    onChange={(e) => setManualUrl(e.target.value)}
                                    placeholder="https://calendly.com/your-profile/30min"
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                />
                                <button
                                    onClick={handleSaveManual}
                                    disabled={saving || !manualUrl}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {saving ? 'SAVING...' : 'SAVE LINK'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 italic">
                                Note: Manual links enable the booking page but do not sync dashboard meetings automatically.
                            </p>
                        </div>
                    </div>
                )}

                {isConnected && calendlyConfig.eventUrl && (
                    <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 font-medium">Your Scheduling URL:</span>
                            <a
                                href={calendlyConfig.eventUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-400 hover:underline flex items-center gap-1"
                            >
                                {calendlyConfig.eventUrl}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        Branded Experience
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        AlphaClone automatically skins your Calendly booking page with your brand colors for a seamless client experience.
                    </p>
                </div>
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        Automated Sync
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Bookings are automatically synced to your AlphaClone dashboard and notifications are sent to your team.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CalendlySettings;
