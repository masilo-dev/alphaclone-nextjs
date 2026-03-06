import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';

interface ZohoConfig {
    email: string;
    accountId: string;
}

const ZohoIntegration: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [config, setConfig] = useState<ZohoConfig | null>(null);

    useEffect(() => {
        loadZohoConfig();
    }, []);

    const loadZohoConfig = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('integrations')
                .select('config, enabled')
                .eq('user_id', user.id)
                .eq('type', 'zoho')
                .maybeSingle();

            if (data && data.enabled && data.config) {
                setConfig({
                    email: data.config.email,
                    accountId: data.config.accountId
                });
            } else {
                setConfig(null);
            }
        } catch (error) {
            console.error('Error loading Zoho config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Redirect to our backend connect route
            window.location.href = `/api/auth/zoho/connect?userId=${user.id}`;
        } catch (error: any) {
            toast.error(error.message || 'Failed to initiate Zoho connection');
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect Zoho Mail?')) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', user.id)
                .eq('type', 'zoho');

            if (error) throw error;

            setConfig(null);
            toast.success('Zoho Mail disconnected');
        } catch (error: any) {
            toast.error(error.message || 'Failed to disconnect Zoho');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-slate-400 p-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking Zoho status...</span>
            </div>
        );
    }

    return (
        <div className={`p-6 rounded-2xl border ${config ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'} relative overflow-hidden`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config ? 'bg-[#f5d400]/10 text-[#f5d400]' : 'bg-slate-800 text-slate-500'}`}>
                        <Mail className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-white">
                                Zoho Mail
                            </h4>
                            {config ? (
                                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-slate-500" />
                            )}
                        </div>
                        <p className="text-sm text-slate-400 max-w-md mb-2">
                            {config
                                ? "Your Zoho Mail account is connected. You can now manage your business emails and communications directly from the dashboard."
                                : "Link your professional Zoho Mail account to read, send, and manage business emails directly within the AlphaClone Business OS."
                            }
                        </p>
                        {config && (
                            <div className="flex items-center gap-2 text-teal-400 bg-teal-500/10 w-fit px-3 py-1.5 rounded-lg border border-teal-500/20 text-xs">
                                <span>Connected: {typeof config.email === 'object' ? JSON.stringify(config.email) : String(config.email)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    {config ? (
                        <button
                            onClick={handleDisconnect}
                            className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-sm uppercase tracking-widest rounded-xl border border-red-500/20 transition-all"
                        >
                            <XCircle className="w-4 h-4" />
                            Disconnect
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#f5d400] hover:bg-[#e6c700] text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#f5d400]/20 disabled:opacity-50"
                        >
                            {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            {connecting ? 'CONNECTING...' : 'CONNECT ZOHO'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ZohoIntegration;
