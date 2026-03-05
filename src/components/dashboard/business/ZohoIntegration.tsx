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
        <div className="p-5 bg-slate-800/50 rounded-2xl border border-slate-700">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#f5d400]/10 flex items-center justify-center shrink-0">
                        <Mail className="w-6 h-6 text-[#f5d400]" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-white mb-1">Zoho Mail Integration</h4>
                        <p className="text-sm text-slate-400 leading-relaxed mb-4">
                            Connect your professional Zoho Mail account to enable AI autonomous responses and bulk email campaigns.
                        </p>

                        {config ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-teal-400 bg-teal-500/10 w-fit px-3 py-1.5 rounded-lg border border-teal-500/20 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Connected: {config.email}</span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Your professional inbox is now being managed by AlphaClone AI.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-amber-500 bg-amber-500/10 w-fit px-3 py-1.5 rounded-lg border border-amber-500/20 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>Not Connected</span>
                            </div>
                        )}
                    </div>
                </div>

                {config ? (
                    <button
                        onClick={handleDisconnect}
                        className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                        title="Disconnect"
                    >
                        <XCircle className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="px-5 py-2.5 bg-[#f5d400] hover:bg-[#e6c700] text-slate-900 rounded-xl font-bold transition-all shadow-lg shadow-[#f5d400]/10 flex items-center gap-2"
                    >
                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Connect Zoho
                    </button>
                )}
            </div>
        </div>
    );
};

export default ZohoIntegration;
