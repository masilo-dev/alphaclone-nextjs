'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Unplug,
    Save,
    Lock,
    Send,
    Loader2,
    Mail,
    ExternalLink,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

export default function GmailIntegration() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testRecipient, setTestRecipient] = useState('');
    const [savedApiKey, setSavedApiKey] = useState('');
    
    const [config, setConfig] = useState({
        appPassword: '',
        fromEmail: '',
        fromName: '',
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
            const res = await fetch(`/api/integrations/email-providers?tenantId=${encodeURIComponent(currentTenant.id)}&provider=gmail`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load Gmail status');

            if (data.connected) {
                const storedApiKey = data.config?.appPassword || data.config?.app_password || data.config?.apiKey || '';
                const storedFromEmail = data.config?.fromEmail || data.config?.from_email || '';
                const storedFromName = data.config?.fromName || data.config?.from_name || '';
                setSavedApiKey(storedApiKey);
                setStatus('connected');
                setConfig({
                    appPassword: '••••••••••••••••', // Masked for UI
                    fromEmail: storedFromEmail,
                    fromName: storedFromName,
                });
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking Gmail status:', err);
            setStatus('error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !currentTenant?.id) return;

        setIsSaving(true);
        try {
            if (!config.fromEmail || !config.fromName) {
                throw new Error('All fields are required');
            }
            const payloadApiKey = config.appPassword === '••••••••••••••••' ? savedApiKey : config.appPassword.replace(/\s/g, '');
            if (!payloadApiKey || payloadApiKey.length < 16) {
                throw new Error('Valid 16-character Google App Password is required');
            }

            const res = await fetch('/api/integrations/email-providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    provider: 'gmail',
                    appPassword: payloadApiKey,
                    fromEmail: config.fromEmail,
                    fromName: config.fromName,
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save Gmail integration');
            }

            toast.success('Gmail SMTP/IMAP connected successfully');
            setSavedApiKey(payloadApiKey);
            setStatus('connected');
        } catch (err: any) {
            console.error('Error saving Gmail integration:', err);
            toast.error(err.message || 'Failed to save Gmail integration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!user?.id || !currentTenant?.id) return;

        setIsDisconnecting(true);
        try {
            const res = await fetch('/api/integrations/email-providers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    provider: 'gmail'
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to disconnect');
            }

            setStatus('idle');
            setConfig({ appPassword: '', fromEmail: '', fromName: '' });
            toast.success('Gmail disconnected');
        } catch (err: any) {
            console.error('Error disconnecting Gmail:', err);
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

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
            if (!currentTenant?.id) throw new Error('No active workspace selected');

            const res = await fetch('/api/email/providers/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    provider: 'gmail',
                    to: testRecipient.trim(),
                    subject: 'Gmail SMTP connection test',
                    message: 'Your Gmail integration is ready for autonomous messaging and outreach.',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Gmail test failed');
            }
            toast.success('Gmail test email sent successfully');
        } catch (err: any) {
            toast.error(err.message || 'Gmail test failed');
        } finally {
            setIsTesting(false);
        }
    };

    if (status === 'loading') {
        return (
<<<<<<< HEAD
            <div className="ac-workspace-panel rounded-lg p-8 text-center">
=======
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
>>>>>>> origin/main
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying Gmail connection...</p>
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
                    <div className="w-12 h-12 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Provider</div>
=======
            className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Mail className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
>>>>>>> origin/main
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Gmail Integration</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Connect via SMTP/IMAP using a Google App Password.</p>
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
                {status !== 'connected' && (
<<<<<<< HEAD
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-3">
=======
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
>>>>>>> origin/main
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="text-xs text-amber-200/80 space-y-1">
                            <p className="font-bold text-amber-400 uppercase tracking-wider">Setup Required</p>
                            <p>You must enable 2-Step Verification and generate a 16-character <strong>App Password</strong> in your Google Account settings to use this integration.</p>
                            <a 
                                href="https://myaccount.google.com/apppasswords" 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-amber-400 hover:underline font-bold mt-1"
                            >
                                Generate App Password <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Gmail Address</label>
                        <input
                            type="email"
                            value={config.fromEmail}
                            onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                            placeholder="your-email@gmail.com"
<<<<<<< HEAD
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
=======
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
>>>>>>> origin/main
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Google App Password</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={config.appPassword}
                                onChange={(e) => setConfig({ ...config, appPassword: e.target.value })}
                                placeholder="xxxx xxxx xxxx xxxx"
<<<<<<< HEAD
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-teal-500/40"
=======
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-teal-500/40"
>>>>>>> origin/main
                            />
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Sender Display Name</label>
                        <input
                            type="text"
                            value={config.fromName}
                            onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                            placeholder="Your Name or Company"
<<<<<<< HEAD
                            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
=======
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
>>>>>>> origin/main
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-8 shadow-lg shadow-teal-600/20"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Integration' : 'Connect Gmail'}
                    </Button>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Credentials are encrypted and stored locally per tenant.
                    </p>
                </div>

                {status === 'connected' && (
                    <div className="pt-2 border-t border-white/5">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Test Connectivity</p>
                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="email"
                                value={testRecipient}
                                onChange={(e) => setTestRecipient(e.target.value)}
                                placeholder="recipient@domain.com"
<<<<<<< HEAD
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
=======
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
>>>>>>> origin/main
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
