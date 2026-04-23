'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Mail,
    CheckCircle2,
    AlertCircle,
    Unplug,
    Save,
    Lock,
    Send,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { tenantService } from '@/services/tenancy/TenantService';
import toast from 'react-hot-toast';

export default function SendGridIntegration() {
    const { user } = useAuth();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testRecipient, setTestRecipient] = useState('');
    const [savedApiKey, setSavedApiKey] = useState('');
    
    const [config, setConfig] = useState({
        apiKey: '',
        fromEmail: '',
        fromName: 'AlphaClone Systems',
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
            const tenantId = tenantService.getCurrentTenantId();
            const query = supabase
                .from('integrations')
                .select('config, enabled')
                .eq('user_id', user.id)
                .eq('type', 'sendgrid');
            const scopedQuery = tenantId ? query.eq('tenant_id', tenantId) : query;
            const { data, error } = await scopedQuery.maybeSingle();

            if (error) throw error;

            if (data?.enabled) {
                const storedApiKey = data.config?.api_key || data.config?.apiKey || '';
                const storedFromEmail = data.config?.from_email || data.config?.fromEmail || '';
                const storedFromName = data.config?.from_name || data.config?.fromName || 'AlphaClone Systems';
                setSavedApiKey(storedApiKey);
                setStatus('connected');
                setConfig({
                    apiKey: '••••••••••••••••', // Masked for UI
                    fromEmail: storedFromEmail,
                    fromName: storedFromName,
                });
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking SendGrid status:', err);
            setStatus('error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id) return;

        setIsSaving(true);
        try {
            if (!config.fromEmail) {
                throw new Error('All fields are required');
            }
            const tenantId = tenantService.getCurrentTenantId();
            const resolvedApiKey = config.apiKey === '••••••••••••••••' ? savedApiKey : config.apiKey.trim();
            if (!resolvedApiKey) throw new Error('API key is required');

            const { error } = await supabase
                .from('integrations')
                .upsert({
                    user_id: user.id,
                    tenant_id: tenantId || null,
                    type: 'sendgrid',
                    name: 'SendGrid',
                    enabled: true,
                    config: {
                        api_key: resolvedApiKey,
                        from_email: config.fromEmail,
                        from_name: config.fromName || 'AlphaClone Systems',
                    }
                }, { onConflict: 'user_id,type' });

            if (error) throw error;
            setSavedApiKey(resolvedApiKey);

            toast.success('SendGrid account connected successfully');
            setStatus('connected');
        } catch (err: any) {
            console.error('Error saving SendGrid integration:', err);
            toast.error(err.message || 'Failed to save SendGrid integration');
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
                .eq('type', 'sendgrid');

            if (error) throw error;

            setStatus('idle');
            setConfig({ apiKey: '', fromEmail: '', fromName: 'AlphaClone Systems' });
            toast.success('SendGrid disconnected');
        } catch (err: any) {
            console.error('Error disconnecting SendGrid:', err);
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
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
                    provider: 'sendgrid',
                    to: testRecipient.trim(),
                    subject: 'SendGrid connection test',
                    message: 'Your SendGrid integration is ready for campaigns and outreach.',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'SendGrid test failed');
            }
            toast.success('SendGrid test email sent successfully');
        } catch (err: any) {
            toast.error(err.message || 'SendGrid test failed');
        } finally {
            setIsTesting(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying SendGrid connection...</p>
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
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Send className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">SendGrid Email</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Connect your SendGrid account to send emails from your own domain.</p>
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
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">API Key</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={config.apiKey}
                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                placeholder="SG.xxxxxxxxxxxxxxxx"
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-indigo-500/40"
                            />
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Verified Sender Email</label>
                        <input
                            type="email"
                            value={config.fromEmail}
                            onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                            placeholder="hello@yourdomain.com"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Sender Name</label>
                        <input
                            type="text"
                            value={config.fromName}
                            onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                            placeholder="Your Company Name"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/40"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Settings' : 'Connect SendGrid'}
                    </Button>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Encrypted storage ensures your API keys are private.
                    </p>
                </div>
                {status === 'connected' && (
                    <div className="pt-2 border-t border-white/5">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Send Test Email</p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="email"
                                value={testRecipient}
                                onChange={(e) => setTestRecipient(e.target.value)}
                                placeholder="recipient@domain.com"
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/40"
                            />
                            <Button
                                type="button"
                                onClick={handleSendTest}
                                disabled={isTesting}
                                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6"
                            >
                                {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                Send Test
                            </Button>
                        </div>
                    </div>
                )}
            </form>
        </motion.div>
    );
}
