'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail, Calendar, Users, Files } from 'lucide-react';
import { microsoft365Service } from '@/services/microsoft365Service';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import MicrosoftConnectButton from '@/components/dashboard/business/MicrosoftConnectButton';
import toast from 'react-hot-toast';

export default function Microsoft365Integration() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [isBusy, setIsBusy] = useState(false);
    const [connectionEmail, setConnectionEmail] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');

    const loadConnection = async () => {
        setStatus('loading');
        try {
            const connection = await microsoftAuthService.getConnection();
            if (connection) {
                setConnectionEmail(connection.microsoft_email || '');
                setDisplayName(connection.display_name || '');
                setStatus('connected');
            } else {
                setConnectionEmail('');
                setDisplayName('');
                setStatus('idle');
            }
        } catch (error) {
            console.error('Error loading Microsoft connection:', error);
            setStatus('error');
        }
    };

    useEffect(() => {
        void loadConnection();

        const params = new URLSearchParams(window.location.search);
        const oauthStatus = params.get('microsoft');
        if (!oauthStatus) {
            return;
        }

        const reason = params.get('reason');
        if (oauthStatus === 'connected') {
            toast.success('Microsoft 365 connected');
            void loadConnection();
        } else if (oauthStatus === 'error') {
            toast.error(reason || 'Microsoft connection failed');
        }

        params.delete('microsoft');
        params.delete('reason');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
    }, []);

    const handleConnect = () => {
        microsoftAuthService.initiateOAuth();
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Outlook, Teams, Calendar, and To Do from this profile?')) return;

        setIsBusy(true);
        try {
            await microsoftAuthService.disconnect();
            toast.success('Microsoft 365 disconnected');
            setStatus('idle');
            setConnectionEmail('');
            setDisplayName('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to disconnect Microsoft 365');
        } finally {
            setIsBusy(false);
        }
    };

    const handleTest = async () => {
        setIsBusy(true);
        try {
            const { success, error } = await microsoft365Service.testIntegration('current');
            if (!success) throw new Error(error || 'Connection test failed');
            toast.success('Microsoft Graph connection is healthy');
        } catch (err: any) {
            toast.error(err.message || 'Connection test failed');
        } finally {
            setIsBusy(false);
        }
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
                        <Mail className="w-6 h-6 text-blue-400" />
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
                        <p className="text-sm text-slate-400">Connect Outlook, Teams, Calendar, To Do, OneDrive, and contacts with delegated Microsoft OAuth.</p>
                    </div>
                </div>
                <MicrosoftConnectButton
                    connected={status === 'connected'}
                    loading={isBusy}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                />
            </div>

            <div className="p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                        <p className="text-[11px] uppercase tracking-widest font-black text-slate-500 mb-2">Connection</p>
                        <p className="text-sm text-white font-semibold">{displayName || 'No Microsoft account connected'}</p>
                        <p className="text-xs text-slate-400 mt-1">{connectionEmail || 'Connect a work or school account to enable Outlook + Teams.'}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                        <p className="text-[11px] uppercase tracking-widest font-black text-slate-500 mb-2">Status</p>
                        <p className={`text-sm font-semibold ${status === 'connected' ? 'text-emerald-400' : status === 'error' ? 'text-rose-400' : 'text-slate-300'}`}>
                            {status === 'connected' ? 'Delegated Microsoft Graph access active' : status === 'error' ? 'Connection issue detected' : 'Not connected'}
                        </p>
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={status !== 'connected' || isBusy}
                            className="mt-3 text-xs font-bold text-blue-300 hover:text-blue-200 disabled:text-slate-600"
                        >
                            Test Microsoft Graph access
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-2">
                    {[
                        { label: 'Outlook Mail', desc: 'Unified inbox and outbound mail', icon: Mail },
                        { label: 'Calendar + Meetings', desc: 'Events and Teams meeting links', icon: Calendar },
                        { label: 'Teams', desc: 'Presence, team list, and channel messages', icon: Users },
                        { label: 'OneDrive Files', desc: 'Upload documents to Microsoft storage', icon: Files },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                                <Icon className="w-4 h-4 text-blue-400 mb-2" />
                                <p className="text-sm font-semibold text-white">{item.label}</p>
                                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                            </div>
                        );
                    })}
                </div>

                <p className="text-[11px] text-slate-500 border-t border-white/5 pt-4">
                    Uses Microsoft delegated OAuth with PKCE. Token exchange runs server-side; `AZURE_CLIENT_SECRET` never reaches the browser.
                </p>
            </div>
        </motion.div>
    );
}
