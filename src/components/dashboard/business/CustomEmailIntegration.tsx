'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Unplug, Save, Lock, Loader2, Mail, Server } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

export default function CustomEmailIntegration() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const [config, setConfig] = useState({
        fromEmail: '',
        fromName: '',
        smtpHost: '',
        smtpPort: '465',
        smtpUser: '',
        smtpPass: '',
        imapHost: '',
        imapPort: '993',
        imapUser: '',
        imapPass: ''
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
            const res = await fetch(`/api/integrations/email-providers?tenantId=${encodeURIComponent(currentTenant.id)}&provider=custom_smtp`);
            if (!res.ok) {
                // If API doesn't exist, just show idle state
                console.warn('Email providers API not available, showing idle state');
                setStatus('idle');
                return;
            }
            const data = await res.json();

            if (data.connected) {
                setStatus('connected');
                setConfig({
                    fromEmail: data.config?.fromEmail || '',
                    fromName: data.config?.fromName || '',
                    smtpHost: data.config?.smtpHost || '',
                    smtpPort: data.config?.smtpPort || '465',
                    smtpUser: data.config?.smtpUser || '',
                    smtpPass: data.config?.smtpPass ? '••••••••' : '',
                    imapHost: data.config?.imapHost || '',
                    imapPort: data.config?.imapPort || '993',
                    imapUser: data.config?.imapUser || '',
                    imapPass: data.config?.imapPass ? '••••••••' : '',
                });
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking Custom SMTP status:', err);
            setStatus('idle'); // Default to idle instead of error for solo owners
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.id || !currentTenant?.id) return;

        setIsSaving(true);
        try {
            if (!config.smtpHost || !config.fromEmail) {
                throw new Error('Host and From Email are required');
            }

            const payload: any = {
                tenantId: currentTenant.id,
                provider: 'custom_smtp',
                fromEmail: config.fromEmail,
                fromName: config.fromName,
                smtpHost: config.smtpHost,
                smtpPort: config.smtpPort,
                smtpUser: config.smtpUser,
                imapHost: config.imapHost,
                imapPort: config.imapPort,
                imapUser: config.imapUser,
            };

            if (config.smtpPass && config.smtpPass !== '••••••••') {
                payload.smtpPass = config.smtpPass;
            }
            if (config.imapPass && config.imapPass !== '••••••••') {
                payload.imapPass = config.imapPass;
            }

            const res = await fetch('/api/integrations/email-providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to save integration');
            }

            toast.success('SMTP/IMAP connected successfully');
            setStatus('connected');
            if (config.smtpPass && config.smtpPass !== '••••••••') setConfig(c => ({ ...c, smtpPass: '••••••••' }));
            if (config.imapPass && config.imapPass !== '••••••••') setConfig(c => ({ ...c, imapPass: '••••••••' }));
        } catch (err: any) {
            console.error('Error saving SMTP integration:', err);
            toast.error(err.message || 'Failed to save integration');
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
                    provider: 'custom_smtp'
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to disconnect');
            }

            setStatus('idle');
            setConfig({
                fromEmail: '', fromName: '', smtpHost: '', smtpPort: '465',
                smtpUser: '', smtpPass: '', imapHost: '', imapPort: '993', imapUser: '', imapPass: ''
            });
            toast.success('Disconnected Custom Email server');
        } catch (err: any) {
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="ac-workspace-panel rounded-lg p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying SMTP connection...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="ac-workspace-panel rounded-lg overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Server className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Provider</div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Custom SMTP / IMAP</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" /> Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Connect any standard email provider via SMTP for sending and IMAP for receiving.</p>
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
                    <div className="space-y-2 md:col-span-2">
                        <h4 className="text-sm font-bold text-teal-400 mb-2">Sender Profile</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">From Email</label>
                                <input
                                    type="email"
                                    required
                                    value={config.fromEmail}
                                    onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">From Name</label>
                                <input
                                    type="text"
                                    value={config.fromName}
                                    onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-800 pt-4">
                        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-teal-400" /> Outgoing (SMTP)
                        </h4>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">SMTP Host</label>
                            <input
                                type="text"
                                required
                                value={config.smtpHost}
                                onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                                placeholder="smtp.example.com"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Port</label>
                                <input
                                    type="text"
                                    value={config.smtpPort}
                                    onChange={(e) => setConfig({ ...config, smtpPort: e.target.value })}
                                    placeholder="465 or 587"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Username</label>
                            <input
                                type="text"
                                value={config.smtpUser}
                                onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Password</label>
                            <input
                                type="password"
                                value={config.smtpPass}
                                onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 border-t border-slate-800 pt-4">
                        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" /> Incoming (IMAP) <span className="text-xs font-normal text-slate-500 ml-2">(Optional)</span>
                        </h4>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">IMAP Host</label>
                            <input
                                type="text"
                                value={config.imapHost}
                                onChange={(e) => setConfig({ ...config, imapHost: e.target.value })}
                                placeholder="imap.example.com"
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Port</label>
                                <input
                                    type="text"
                                    value={config.imapPort}
                                    onChange={(e) => setConfig({ ...config, imapPort: e.target.value })}
                                    placeholder="993"
                                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Username</label>
                            <input
                                type="text"
                                value={config.imapUser}
                                onChange={(e) => setConfig({ ...config, imapUser: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Password</label>
                            <input
                                type="password"
                                value={config.imapPass}
                                onChange={(e) => setConfig({ ...config, imapPass: e.target.value })}
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                    <Button 
                        type="submit" 
                        disabled={isSaving}
                        className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-8 shadow-lg shadow-teal-600/20"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Server Settings' : 'Connect Mail Server'}
                    </Button>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Credentials are encrypted and stored locally per tenant.
                    </p>
                </div>
            </form>
        </motion.div>
    );
}
