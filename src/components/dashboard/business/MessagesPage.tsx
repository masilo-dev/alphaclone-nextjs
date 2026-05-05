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

interface MessagesPageProps {
    user: User;
}

type MailProvider = 'gmail';

const MessagesPage: React.FC<MessagesPageProps> = ({ user }) => {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [gmailConnected, setGmailConnected] = useState(false);
    const [activeProvider, setActiveProvider] = useState<MailProvider | null>(null);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        const check = async () => {
            if (!user?.id) return;
            try {
                const { data } = await supabase
                    .from('integrations')
                    .select('type, enabled')
                    .eq('user_id', user.id)
                    .eq('type', 'gmail');

                const rows = data || [];
                const gmail = rows.some((r: any) => r.type === 'gmail' && r.enabled);
                setGmailConnected(gmail);

                if (gmail) setActiveProvider('gmail');
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

    // No providers connected — show setup prompt
    if (!gmailConnected) {
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
                        Connect your Gmail to manage your inbox, send replies, and let AI handle routine correspondence from one workspace.
                    </p>

                    <div className="max-w-sm mx-auto mb-8">
                        {/* Gmail option */}
                        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 text-left">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                                <Mail className="w-5 h-5 text-red-400" />
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
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            onClick={() => {
                                setConnecting(true);
                                const returnTo = encodeURIComponent('/dashboard/business/messages');
                                window.location.href = `/api/auth/google/gmail/connect?userId=${user.id}&returnTo=${returnTo}`;
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-teal-900/20 disabled:opacity-70"
                            disabled={connecting}
                        >
                            {connecting ? 'Connecting Gmail...' : 'Connect Gmail Here'} <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => router.push('/dashboard/business/settings?tab=integrations')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-bold transition-all border border-slate-700"
                        >
                            Open Integrations
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
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
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MessagesPage;
