'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Unplug,
    Save,
    Lock,
    Send,
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
<<<<<<< HEAD
import { useTenant } from '@/contexts/TenantContext';
=======
import { supabase } from '@/lib/supabase';
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
import toast from 'react-hot-toast';

export default function BrevoIntegration() {
    const { user } = useAuth();
<<<<<<< HEAD
    const { currentTenant } = useTenant();
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
        if (user?.id && currentTenant?.id) {
            void checkIntegrationStatus();
        }
    }, [user?.id, currentTenant?.id]);

    const checkIntegrationStatus = async () => {
        if (!user?.id || !currentTenant?.id) return;

        setStatus('loading');
        try {
            const res = await fetch(`/api/integrations/email-providers?tenantId=${encodeURIComponent(currentTenant.id)}&provider=brevo`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load Brevo status');

            if (data.connected) {
                const storedApiKey = data.config?.apiKey || data.config?.api_key || '';
                const storedFromEmail = data.config?.fromEmail || data.config?.from_email || '';
                const storedFromName = data.config?.fromName || data.config?.from_name || 'AlphaClone Systems';
                setSavedApiKey(storedApiKey);
                setStatus('connected');
                setConfig({
                    apiKey: '••••••••••••••••', // Masked for UI
                    fromEmail: storedFromEmail,
                    fromName: storedFromName,
=======
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    
    const [config, setConfig] = useState({
        apiKey: '',
        fromEmail: ''
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
                .eq('type', 'brevo')
                .maybeSingle();

            if (error) throw error;

            if (data?.enabled) {
                setStatus('connected');
                setConfig({
                    apiKey: '••••••••••••••••', // Masked for UI
                    fromEmail: data.config.fromEmail || ''
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                });
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking Brevo status:', err);
            setStatus('error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
<<<<<<< HEAD
        if (!user?.id || !currentTenant?.id) return;

        setIsSaving(true);
        try {
            if (!config.fromEmail) {
                throw new Error('All fields are required');
            }
            const payloadApiKey = config.apiKey === '••••••••••••••••' ? savedApiKey : config.apiKey.trim();
            if (!payloadApiKey) throw new Error('API key is required');
            const res = await fetch('/api/integrations/email-providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    provider: 'brevo',
                    apiKey: payloadApiKey,
                    fromEmail: config.fromEmail,
                    fromName: config.fromName,
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save Brevo integration');
            }

            toast.success('Brevo account connected successfully');
            setSavedApiKey(payloadApiKey);
=======
        if (!user?.id) return;

        setIsSaving(true);
        try {
            if (!config.apiKey || !config.fromEmail) {
                throw new Error('All fields are required');
            }

            const { error } = await supabase
                .from('integrations')
                .upsert({
                    user_id: user.id,
                    type: 'brevo',
                    name: 'Brevo',
                    enabled: true,
                    config: {
                        apiKey: config.apiKey === '••••••••••••••••' ? undefined : config.apiKey,
                        fromEmail: config.fromEmail
                    }
                }, { onConflict: 'user_id,type' });

            if (error) throw error;

            toast.success('Brevo account connected successfully');
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
            setStatus('connected');
        } catch (err: any) {
            console.error('Error saving Brevo integration:', err);
            toast.error(err.message || 'Failed to save Brevo integration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDisconnect = async () => {
<<<<<<< HEAD
        if (!user?.id || !currentTenant?.id) return;

        setIsDisconnecting(true);
        try {
            const res = await fetch('/api/integrations/email-providers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    provider: 'brevo'
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to disconnect');
            }

            setStatus('idle');
            setConfig({ apiKey: '', fromEmail: '', fromName: 'AlphaClone Systems' });
=======
        if (!user?.id) return;

        setIsDisconnecting(true);
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', user.id)
                .eq('type', 'brevo');

            if (error) throw error;

            setStatus('idle');
            setConfig({ apiKey: '', fromEmail: '' });
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
            toast.success('Brevo disconnected');
        } catch (err: any) {
            console.error('Error disconnecting Brevo:', err);
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

<<<<<<< HEAD
    const handleSendTest = async () => {
        if (!currentTenant?.id) {
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
                    tenantId: currentTenant.id,
                    provider: 'brevo',
                    to: testRecipient.trim(),
                    subject: 'Brevo connection test',
                    message: 'Your Brevo integration is ready for campaigns and outreach.',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Brevo test failed');
            }
            toast.success('Brevo test email sent successfully');
        } catch (err: any) {
            toast.error(err.message || 'Brevo test failed');
        } finally {
            setIsTesting(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="ac-workspace-panel rounded-lg p-8 text-center">
=======
    if (status === 'loading') {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying Brevo connection...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
<<<<<<< HEAD
            className="ac-workspace-panel rounded-lg overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <Send className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Provider</div>
=======
            className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <Send className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Brevo Email</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Connect your Brevo (Sendinblue) account to power your marketing campaigns.</p>
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
                                placeholder="xkeysib-xxxxxxxxxxxxxxxxxxx"
<<<<<<< HEAD
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-cyan-500/40"
=======
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-cyan-500/40"
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
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
<<<<<<< HEAD
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Sender Name</label>
                        <input
                            type="text"
                            value={config.fromName}
                            onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                            placeholder="Your Company Name"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
=======
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Settings' : 'Connect Brevo'}
                    </Button>
<<<<<<< HEAD
                    <p className="text-xs text-slate-500 flex items-center gap-1">
=======
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                        <Lock className="w-3 h-3" />
                        Encrypted storage ensures your API keys are private.
                    </p>
                </div>
<<<<<<< HEAD
                {status === 'connected' && (
                    <div className="pt-2 border-t border-white/5">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Send Test Email</p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="email"
                                value={testRecipient}
                                onChange={(e) => setTestRecipient(e.target.value)}
                                placeholder="recipient@domain.com"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
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
=======
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
            </form>
        </motion.div>
    );
}
<<<<<<< HEAD

=======
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
