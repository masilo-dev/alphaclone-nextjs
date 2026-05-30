'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Unplug,
    Save,
    Lock,
    Loader2,
    AlertCircle,
    Globe,
    Settings,
    Play
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { microsoft365Service } from '@/services/microsoft365Service';
import toast from 'react-hot-toast';

export default function Microsoft365Integration() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [savedSecret, setSavedSecret] = useState('');

    const [config, setConfig] = useState({
        clientId: '',
        clientSecret: '',
        tenantDomain: '',
        enabled: true,
        services: {
            outlook: true,
            calendar: true,
            onedrive: false,
            sharepoint: false,
            teams: true
        }
    });

    useEffect(() => {
        if (user?.id && currentTenant?.id) {
            void loadM365Config();
        } else {
            setStatus('idle');
        }
    }, [user?.id, currentTenant?.id]);

    const loadM365Config = async () => {
        if (!currentTenant?.id) return;
        setStatus('loading');
        try {
            const { config: fetchedConfig, error } = await microsoft365Service.getMicrosoft365Config(currentTenant.id);
            if (error) throw new Error(error);

            if (fetchedConfig) {
                setSavedSecret(fetchedConfig.clientSecret || '');
                setConfig({
                    clientId: fetchedConfig.clientId || '',
                    clientSecret: fetchedConfig.clientSecret ? '••••••••••••••••' : '',
                    tenantDomain: fetchedConfig.tenantDomain || '',
                    enabled: fetchedConfig.enabled,
                    services: {
                        outlook: !!fetchedConfig.services?.outlook,
                        calendar: !!fetchedConfig.services?.calendar,
                        onedrive: !!fetchedConfig.services?.onedrive,
                        sharepoint: !!fetchedConfig.services?.sharepoint,
                        teams: !!fetchedConfig.services?.teams,
                    }
                });
                setStatus('connected');
            } else {
                setStatus('idle');
            }
        } catch (err: any) {
            console.error('Error loading Microsoft 365 config:', err);
            setStatus('error');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;

        setIsSaving(true);
        try {
            if (!config.clientId || !config.tenantDomain) {
                throw new Error('Client ID and Tenant Domain are required.');
            }

            const secretToSave = config.clientSecret === '••••••••••••••••' ? savedSecret : config.clientSecret;
            if (!secretToSave) {
                throw new Error('Client Secret is required.');
            }

            const { config: savedConfig, error } = await microsoft365Service.saveMicrosoft365Config(currentTenant.id, {
                clientId: config.clientId,
                clientSecret: secretToSave,
                tenantDomain: config.tenantDomain,
                enabled: config.enabled,
                services: config.services,
                metadata: {}
            });

            if (error || !savedConfig) throw new Error(error || 'Failed to save config');

            toast.success('Microsoft 365 configuration saved successfully');
            setSavedSecret(secretToSave);
            setConfig(prev => ({
                ...prev,
                clientSecret: '••••••••••••••••'
            }));
            setStatus('connected');
        } catch (err: any) {
            console.error('Error saving Microsoft 365 config:', err);
            toast.error(err.message || 'Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!currentTenant?.id) return;
        if (!confirm('Are you sure you want to disconnect Microsoft 365 / MS Teams?')) return;

        setIsDisconnecting(true);
        try {
            const { success, error } = await microsoft365Service.disconnectIntegration(currentTenant.id);
            if (error || !success) throw new Error(error || 'Failed to disconnect');

            toast.success('Microsoft 365 integration disconnected');
            setConfig({
                clientId: '',
                clientSecret: '',
                tenantDomain: '',
                enabled: true,
                services: {
                    outlook: true,
                    calendar: true,
                    onedrive: false,
                    sharepoint: false,
                    teams: true
                }
            });
            setSavedSecret('');
            setStatus('idle');
        } catch (err: any) {
            console.error('Error disconnecting Microsoft 365:', err);
            toast.error(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleTest = async () => {
        if (!currentTenant?.id) return;
        setIsTesting(true);
        try {
            const { success, error } = await microsoft365Service.testIntegration(currentTenant.id);
            if (error || !success) throw new Error(error || 'Integration test failed');
            toast.success('Microsoft 365 integration connection test passed!');
        } catch (err: any) {
            console.error('Error testing Microsoft 365 integration:', err);
            toast.error(err.message || 'Connection test failed');
        } finally {
            setIsTesting(false);
        }
    };

    const toggleService = (serviceKey: keyof typeof config.services) => {
        setConfig(prev => ({
            ...prev,
            services: {
                ...prev.services,
                [serviceKey]: !prev.services[serviceKey]
            }
        }));
    };

    if (status === 'loading') {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Verifying Microsoft 365 status...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden text-slate-200"
        >
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Settings className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">Microsoft 365 / Teams Suite</h2>
                            {status === 'connected' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-400">Synchronize Teams presence, Outlook mail, and Microsoft Calendars.</p>
                    </div>
                </div>
                {status === 'connected' && (
                    <Button
                        variant="outline"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="border-slate-700 text-rose-300 hover:bg-rose-500/10 text-xs py-2"
                    >
                        <Unplug className="w-4 h-4 mr-2" />
                        Disconnect
                    </Button>
                )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Azure AD Client ID</label>
                        <input
                            type="text"
                            value={config.clientId}
                            onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                            placeholder="00000000-0000-0000-0000-000000000000"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Azure AD Client Secret</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={config.clientSecret}
                                onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                                placeholder="Client Secret Key"
                                className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 pl-10 text-sm text-white outline-none focus:border-teal-500/40"
                            />
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Tenant Domain / ID</label>
                        <input
                            type="text"
                            value={config.tenantDomain}
                            onChange={(e) => setConfig({ ...config, tenantDomain: e.target.value })}
                            placeholder="yourdomain.onmicrosoft.com or Tenant UUID"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-teal-500/40"
                        />
                    </div>
                </div>

                {/* Services Checkboxes */}
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Enabled Services</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { id: 'teams', label: 'Microsoft Teams Presence', desc: 'Sync communication states with CRM' },
                            { id: 'outlook', label: 'Outlook Email Routing', desc: 'Send campaigns using Outlook accounts' },
                            { id: 'calendar', label: 'Microsoft Calendar Sync', desc: 'Synchronize meetings and event schedules' },
                            { id: 'onedrive', label: 'OneDrive File Integration', desc: 'Store proposals and shared documents' },
                            { id: 'sharepoint', label: 'SharePoint Document Libraries', desc: 'Manage project asset libraries' },
                        ].map(srv => {
                            const isChecked = config.services[srv.id as keyof typeof config.services];
                            return (
                                <div
                                    key={srv.id}
                                    onClick={() => toggleService(srv.id as keyof typeof config.services)}
                                    className={`p-4 rounded-xl border cursor-pointer select-none transition-all duration-300 ${isChecked ? 'bg-blue-500/5 border-blue-500/20 text-blue-200' : 'bg-slate-900/40 border-slate-800 text-slate-400'}`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-700'}`}>
                                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <span className="text-xs font-bold">{srv.label}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 pl-6 leading-normal">{srv.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-white/5">
                    <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 shadow-lg shadow-blue-600/20"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {status === 'connected' ? 'Update Integration' : 'Connect Microsoft 365'}
                    </Button>

                    {status === 'connected' && (
                        <Button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting}
                            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6"
                        >
                            {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Test Connection
                        </Button>
                    )}

                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5 ml-auto">
                        <Lock className="w-3.5 h-3.5" />
                        Encrypted credentials. Uses Microsoft Graph client credential flow.
                    </p>
                </div>
            </form>
        </motion.div>
    );
}
