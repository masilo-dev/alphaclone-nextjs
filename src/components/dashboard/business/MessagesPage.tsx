'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { User } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Lazy-load the heavy email views
const GmailIntegrationView = React.lazy(() =>
    import('../GmailIntegrationView').then(m => ({ default: m.GmailIntegrationView }))
);
const ZohoEmailIntegration = React.lazy(() => import('./ZohoIntegration'));

interface MessagesPageProps {
    user: User;
}

type MailProvider = 'gmail' | 'zoho';

const MessagesPage: React.FC<MessagesPageProps> = ({ user }) => {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [zohoConnected, setZohoConnected] = useState(false);
    const [activeProvider, setActiveProvider] = useState<MailProvider | null>(null);

    useEffect(() => {
        const check = async () => {
            if (!user?.id) return;
            try {
                const { data } = await supabase
                    .from('integrations')
                    .select('type, enabled')
                    .eq('user_id', user.id)
                    .in('type', ['gmail', 'zoho']);

                const rows = data || [];
                const gmail = rows.some((r: any) => r.type === 'gmail' && r.enabled);
                const zoho = rows.some((r: any) => r.type === 'zoho' && r.enabled);
                setGmailConnected(gmail);
                setZohoConnected(zoho);

                // Auto-select whichever is connected, prefer gmail
                if (gmail) setActiveProvider('gmail');
                else if (zoho) setActiveProvider('zoho');
            } catch (err) {
                console.error('MessagesPage: integration check failed', err);
            } finally {
                setChecking(false);
            }
        };
        check();
    }, [user?.id]);

    if (checking) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                <p className="text-slate-400 text-sm animate-pulse">Loading mail hub...</p>
            </div>
        );
    }

    const hasAny = gmailConnected || zohoConnected;

    // No providers connected — show setup prompt
    if (!hasAny) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 max-w-xl shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" />
                    <div className="w-20 h-20 bg-teal-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-teal-500/20">
                        <Mail className="w-10 h-10 text-teal-400" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-3">Connect Your Mail</h2>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        Connect Gmail or Zoho Mail to manage your inbox, send replies, and let AI handle routine correspondence — all from here.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {/* Gmail option */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 text-left">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                                <span className="text-xl">📧</span>
                            </div>
                            <h4 className="text-white font-bold mb-1">Gmail</h4>
                            <p className="text-slate-400 text-xs leading-relaxed mb-4">
                                Connect your Google Workspace or Gmail account for full inbox access.
                            </p>
                            <div className="flex items-center gap-1.5 text-amber-500 text-xs">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Not connected
                            </div>
                        </div>

                        {/* Zoho option */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 text-left">
                            <div className="w-10 h-10 rounded-xl bg-[#f5d400]/10 flex items-center justify-center mb-3">
                                <span className="text-xl">✉️</span>
                            </div>
                            <h4 className="text-white font-bold mb-1">Zoho Mail</h4>
                            <p className="text-slate-400 text-xs leading-relaxed mb-4">
                                Connect your professional Zoho Mail account for business comms.
                            </p>
                            <div className="flex items-center gap-1.5 text-amber-500 text-xs">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Not connected
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard/business/settings?tab=integrations')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-teal-900/20"
                    >
                        Go to Integrations <ArrowRight className="w-4 h-4" />
                    </button>
                </motion.div>
            </div>
        );
    }

    // Provider tab toggle (only show tabs if both are connected)
    const showTabs = gmailConnected && zohoConnected;

    return (
        <div className="flex flex-col h-full">
            {/* Provider switcher */}
            {showTabs && (
                <div className="flex items-center gap-2 mb-4 p-1 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit">
                    <button
                        onClick={() => setActiveProvider('gmail')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeProvider === 'gmail'
                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <span>📧</span> Gmail
                        {gmailConnected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 opacity-80" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveProvider('zoho')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeProvider === 'zoho'
                            ? 'bg-[#f5d400] text-slate-900 shadow-lg shadow-yellow-900/20'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <span>✉️</span> Zoho Mail
                        {zohoConnected && (
                            <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
                        )}
                    </button>
                </div>
            )}

            {/* Provider content */}
            <div className="flex-1 min-h-0 relative">
                <AnimatePresence mode="wait">
                    {activeProvider === 'gmail' && (
                        <motion.div
                            key="gmail"
                            initial={{ opacity: 0, x: -10, scale: 0.99 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.99 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="h-full absolute inset-0"
                        >
                            <Suspense fallback={
                                <div className="flex flex-col items-center justify-center h-full gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                                    <p className="text-xs text-slate-500">Loading Gmail...</p>
                                </div>
                            }>
                                <GmailIntegrationView userId={user.id} />
                            </Suspense>
                        </motion.div>
                    )}
                    {activeProvider === 'zoho' && (
                        <motion.div
                            key="zoho"
                            initial={{ opacity: 0, x: 10, scale: 0.99 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.99 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="h-full absolute inset-0"
                        >
                            <Suspense fallback={
                                <div className="flex flex-col items-center justify-center h-full gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#f5d400]" />
                                    <p className="text-xs text-slate-500">Loading Zoho...</p>
                                </div>
                            }>
                                <ZohoEmailIntegration />
                            </Suspense>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MessagesPage;
