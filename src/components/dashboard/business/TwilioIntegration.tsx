'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Phone, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    XCircle, 
    Eye, 
    EyeOff, 
    ExternalLink,
    Save,
    Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '../../../contexts/TenantContext';
import { Button } from '@/components/ui/UIComponents';

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
        if (currentTenant?.id) {
            fetchStatus();
        }
    }, [currentTenant?.id]);

    const fetchStatus = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const res  = await fetch(`/api/twilio/credentials?tenantId=${currentTenant.id}`);
            const data = await res.json();
            if (data.connected) {
                setConnected(true);
                setSavedSid(data.accountSidMasked || '');
                setSavedPhone(data.phoneNumberMasked || '');
                setConnectedAt(data.connectedAt || null);
            } else {
                setConnected(false);
                setSavedSid('');
                setSavedPhone('');
                setConnectedAt(null);
            }
        } catch (error) {
            console.error('Error fetching Twilio status:', error);
            setConnected(false);
            setSavedSid('');
            setSavedPhone('');
            setConnectedAt(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
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
        }
    };

    const handleDisconnect = async () => {
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
        } catch (error) {
            console.error('Error disconnecting Twilio:', error);
            toast.error('Failed to disconnect Twilio.');
        } finally {
            setDisconnecting(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mb-3" />
                <p className="text-sm text-slate-400">Verifying Twilio connection...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border transition-all ${
                connected 
                    ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)]' 
                    : 'bg-slate-900/60 border-white/5'
            }`}
        >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                        connected 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-500 border-white/5'
                    }`}>
                        <Phone className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-bold text-white tracking-tight">Twilio SMS & Voice</h2>
                            {connected ? (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] uppercase font-black tracking-widest text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" /> Connected
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-800 border border-white/5 rounded-full text-[10px] uppercase font-black tracking-widest text-slate-500">
                                    <AlertCircle className="w-3 h-3" /> Not connected
                                </span>
                            )}
                        </div>
                        {connected ? (
                            <div className="text-xs text-slate-400 space-y-1 mt-1">
                                <p className="flex items-center gap-1.5">
                                    <span className="text-slate-500 uppercase font-bold tracking-tighter">SID:</span> 
                                    <span className="font-mono text-slate-300">{savedSid}</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <span className="text-slate-500 uppercase font-bold tracking-tighter">Number:</span> 
                                    <span className="font-mono text-slate-300">{savedPhone}</span>
                                </p>
                                {connectedAt && (
                                    <p className="text-slate-500 mt-2 italic">
                                        Established {new Date(connectedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400 max-w-md mt-1">
                                Connect your own Twilio account to send automated SMS and voice messages. Find your secrets at{' '}
                                <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300 underline inline-flex items-center gap-0.5 transition-colors">
                                    console.twilio.com <ExternalLink className="w-3 h-3" />
                                </a>
                            </p>
                        )}
                    </div>
                </div>

                {connected && (
                    <Button
                        variant="outline"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 border-rose-500/20 backdrop-blur-sm"
                    >
                        {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                        Disconnect Account
                    </Button>
                )}
            </div>

            {!connected && (
                <form onSubmit={handleSave} className="space-y-4 pt-4 border-t border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Account SID</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    value={accountSid}
                                    onChange={e => setAccountSid(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-teal-500/30 transition-all focus:ring-1 focus:ring-teal-500/10"
                                />
                                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Auth Token</label>
                            <div className="relative">
                                <input
                                    type={showToken ? 'text' : 'password'}
                                    placeholder="Your secret auth token"
                                    value={authToken}
                                    onChange={e => setAuthToken(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-teal-500/30 transition-all focus:ring-1 focus:ring-teal-500/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowToken(v => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-400 transition-colors"
                                >
                                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">From Phone Number</label>
                            <input
                                type="tel"
                                placeholder="+1234567890"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-700 focus:outline-none focus:border-teal-500/30 transition-all focus:ring-1 focus:ring-teal-500/10"
                            />
                            <p className="text-[11px] text-slate-500 mt-1.5 ml-1">Must be an active Twilio number in E.164 format (e.g. +12125551234)</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 gap-4">
                        <Button
                            type="submit"
                            disabled={saving || !accountSid || !authToken || !phoneNumber}
                            className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-8 shadow-[0_0_25px_-5px_rgba(20,184,166,0.3)] disabled:opacity-30"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {saving ? 'Verifying Connection...' : 'Connect Twilio'}
                        </Button>
                        <p className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Lock className="w-3 h-3" />
                            Credentials are encrypted at rest and never shared.
                        </p>
                    </div>
                </form>
            )}
        </motion.div>
    );
};

export default TwilioIntegration;
