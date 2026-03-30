'use client';

<<<<<<< HEAD
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
=======
import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle2, AlertCircle, Loader2, XCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '../../../contexts/TenantContext';

const TwilioIntegration: React.FC = () => {
    const { currentTenant } = useTenant();

    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connected, setConnected]     = useState(false);
    const [connectedAt, setConnectedAt] = useState<string | null>(null);
    const [savedPhone, setSavedPhone]   = useState('');
    const [savedSid, setSavedSid]       = useState('');

    const [accountSid,   setAccountSid]   = useState('');
    const [authToken,    setAuthToken]    = useState('');
    const [phoneNumber,  setPhoneNumber]  = useState('');
    const [showToken,    setShowToken]    = useState(false);

    useEffect(() => {
        if (currentTenant?.id) fetchStatus();
    }, [currentTenant?.id]);

    const fetchStatus = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const res  = await fetch(`/api/twilio/credentials?tenantId=${currentTenant.id}`);
            const data = await res.json();
            if (data.connected) {
                setConnected(true);
                setSavedSid(data.accountSid || '');
                setSavedPhone(data.phoneNumber || '');
                setConnectedAt(data.connectedAt || null);
            } else {
                setConnected(false);
            }
        } catch {
            setConnected(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentTenant?.id) return;
        if (!accountSid.trim() || !authToken.trim() || !phoneNumber.trim()) {
            toast.error('All three fields are required.');
            return;
        }
        setSaving(true);
        try {
            const res  = await fetch('/api/twilio/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId:    currentTenant.id,
                    accountSid:  accountSid.trim(),
                    authToken:   authToken.trim(),
                    phoneNumber: phoneNumber.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            toast.success('Twilio connected successfully.');
            setAccountSid('');
            setAuthToken('');
            setPhoneNumber('');
            await fetchStatus();
        } catch (err: any) {
            toast.error(err.message || 'Could not connect Twilio.');
        } finally {
            setSaving(false);
>>>>>>> e17f5cc (feat: task scheduler global panel, Twilio integration, social post type, AI email to Zoho, typography audit)
        }
    };

    const handleDisconnect = async () => {
<<<<<<< HEAD
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
=======
        if (!currentTenant?.id) return;
        if (!window.confirm('Disconnect Twilio? SMS sending will stop until you reconnect.')) return;
        setDisconnecting(true);
        try {
            const res = await fetch(`/api/twilio/credentials?tenantId=${currentTenant.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to disconnect');
            setConnected(false);
            setSavedSid('');
            setSavedPhone('');
            setConnectedAt(null);
            toast.success('Twilio disconnected.');
        } catch {
            toast.error('Failed to disconnect Twilio.');
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-6 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking Twilio status…
>>>>>>> e17f5cc (feat: task scheduler global panel, Twilio integration, social post type, AI email to Zoho, typography audit)
            </div>
        );
    }

    return (
<<<<<<< HEAD
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
=======
        <div className={`p-5 rounded-2xl border transition-all ${connected ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-900/50 border-slate-800'}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Left — info */}
                <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${connected ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Phone className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-white text-sm">Twilio — SMS & Voice</span>
                            {connected ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full text-[10px] text-green-400">
                                    <CheckCircle2 className="w-3 h-3" /> Connected
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 border border-white/5 rounded-full text-[10px] text-slate-500">
                                    <AlertCircle className="w-3 h-3" /> Not connected
                                </span>
                            )}
                        </div>
                        {connected ? (
                            <div className="text-xs text-slate-400 space-y-0.5 mt-1">
                                <p>SID: <span className="text-slate-300 font-mono">{savedSid}</span></p>
                                <p>From: <span className="text-slate-300 font-mono">{savedPhone}</span></p>
                                {connectedAt && <p className="text-slate-500">Connected {new Date(connectedAt).toLocaleDateString()}</p>}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 mt-1">
                                Enter your own Twilio credentials. Find them at{' '}
                                <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-teal-400 underline inline-flex items-center gap-0.5">
                                    console.twilio.com <ExternalLink className="w-3 h-3" />
                                </a>
                            </p>
                        )}
                    </div>
                </div>

                {/* Right — disconnect button when connected */}
                {connected && (
                    <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-xl border border-red-500/20 transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Disconnect
                    </button>
                )}
            </div>

            {/* Form — only shown when not connected */}
            {!connected && (
                <div className="mt-5 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-1 block">Account SID</label>
                        <input
                            type="text"
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={accountSid}
                            onChange={e => setAccountSid(e.target.value)}
                            className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-1 block">Auth Token</label>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                placeholder="Your Twilio auth token"
                                value={authToken}
                                onChange={e => setAuthToken(e.target.value)}
                                className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2.5 pr-10 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-1 block">From Phone Number</label>
                        <input
                            type="tel"
                            placeholder="+1234567890"
                            value={phoneNumber}
                            onChange={e => setPhoneNumber(e.target.value)}
                            className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                        />
                        <p className="text-[11px] text-slate-600 mt-1">Must be a Twilio number in E.164 format, e.g. +12125551234</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || !accountSid || !authToken || !phoneNumber}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                        {saving ? 'Verifying & saving…' : 'Connect Twilio'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default TwilioIntegration;
>>>>>>> e17f5cc (feat: task scheduler global panel, Twilio integration, social post type, AI email to Zoho, typography audit)
