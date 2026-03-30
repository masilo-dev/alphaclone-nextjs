'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Unplug,
    Save,
    Lock,
    Settings,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function TwilioIntegration() {
    const { user } = useAuth();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    
    const [config, setConfig] = useState({
        accountSid: '',
        authToken: '',
        fromNumber: ''
    });

    useEffect(() => {
        if (user?.id) {
            void checkIntegrationStatus();
        }
    }, [user?.id]);

    const checkIntegrationStatus = async () => {
        if (!user?.id) return;

        setStatus('loading');
        try {
            const { data, error } = await supabase
                .from('integrations')
                .select('config, enabled')
                .eq('user_id', user.id)
                .eq('type', 'twilio')
                .maybeSingle();

            if (error) throw error;

            if (data?.enabled) {
                setStatus('connected');
                setConfig({
                    accountSid: data.config.accountSid || '',
                    authToken: '••••••••••••••••', // Masked for UI
                    fromNumber: data.config.fromNumber || ''
                });
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking Twilio status:', err);
            setStatus('error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        setIsSaving(true);
        try {
            // Validate basic inputs
            if (!config.accountSid || !config.authToken || !config.fromNumber) {
                throw new Error('All fields are required');
            }

            const { error } = await supabase
                .from('integrations')
                .upsert({
                    user_id: user.id,
                    type: 'twilio',
                    name: 'Twilio',
                    enabled: true,
                    config: {
                        accountSid: config.accountSid,
                        authToken: config.authToken === '••••••••••••••••' ? undefined : config.authToken, // Don't overwrite if masked
                        fromNumber: config.fromNumber
                    }
                }, { onConflict: 'user_id,type' });

            if (error) throw error;

            toast.success('Twilio account connected successfully');
            setStatus('connected');
        } catch (err: any) {
            console.error('Error saving Twilio integration:', err);
            toast.error(err.message || 'Failed to save Twilio integration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!user?.id) return;

        setIsDisconnecting(true);
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', user.id)
                .eq('type', 'twilio');

            if (error) throw error;

            setStatus('idle');
            setConfig({ accountSid: '', authToken: '', fromNumber: '' });
            toast.success('Twilio disconnected');
        } catch (err: any) {
            console.error('Error disconnecting Twilio:', err);
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying Twilio connection...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Twilio SMS</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Connect your own Twilio account to send tailored SMS campaigns.</p>
                    </div>
                </div>
                {status === 'connected' && (
                    <Button
                        variant="outline"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="border-slate-700 text-rose-300 hover:bg-rose-500/10"
                    >
                        <Unplug className="w-4 h-4 mr-2" />
                        Disconnect
                    </Button>
                )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Account SID</label>
                        <input
                            type="text"
                            value={config.accountSid}
                            onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Auth Token</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={config.authToken}
                                onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                                placeholder="Required secrets"
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">From Number</label>
                        <input
                            type="text"
                            value={config.fromNumber}
                            onChange={(e) => setConfig({ ...config, fromNumber: e.target.value })}
                            placeholder="+1234567890"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8 shadow-[0_0_20px_-5px_rgba(20,184,166,0.3)]"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Credentials' : 'Connect Account'}
                    </Button>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Your credentials are encrypted and never exposed.
                    </p>
                </div>
            </form>
        </motion.div>
    );
}
