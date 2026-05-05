'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Zap, Server } from 'lucide-react';
import { GmailIntegrationView } from './GmailIntegrationView';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = ({ user }) => {
    const searchParams = useSearchParams();
    const [isGmailIntegrated, setIsGmailIntegrated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    const checkStatus = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            // Check Gmail
            let connectedGmail = false;
            try {
                const { data: integrations } = await supabase
                    .from('integrations')
                    .select('type')
                    .eq('user_id', user.id);
                connectedGmail = integrations?.some((i: any) => i.type === 'gmail') || false;
            } catch (gErr) {
                console.error('Failed to check Gmail integration:', gErr);
            }
            setIsGmailIntegrated(connectedGmail);

            if (connectedGmail && searchParams?.get('gmail') === 'connected') {
                toast.success('Gmail connected successfully.', {
                    duration: 5000,
                });
            }
        } catch (err) {
            console.error('Failed to check integrations:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [user?.id, searchParams?.get('gmail')]);

    const handleConnectGmail = () => {
        setIsConnecting(true);
        const returnTo = encodeURIComponent('/dashboard/mail');
        window.location.href = `/api/auth/google/gmail/connect?userId=${user.id}&returnTo=${returnTo}`;
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-12 gap-4 bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] border border-white/5 shadow-2xl"
                    >
                        <div className="relative">
                            <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-teal-400 animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-1">Synchronizing</p>
                            <p className="text-slate-500 text-[9px] uppercase font-mono tracking-widest animate-pulse">Establishing secure link...</p>
                        </div>
                    </motion.div>
                ) : isGmailIntegrated ? (
                    <motion.div
                        key="integrated-gmail"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-[calc(100vh-120px)]"
                    >
                        <GmailIntegrationView userId={user.id} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="connect"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 text-center relative overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
                    >
                        {/* Visual Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />

                        <motion.div
                            whileHover={{ rotate: 12, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className="w-20 h-20 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-500/20 cursor-pointer"
                        >
                            <Mail className="w-10 h-10 text-white" />
                        </motion.div>

                        <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Unified Communication Hub</h2>
                        <p className="text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed text-sm">
                            Connect your Gmail account to seamlessly manage your communications and clients directly from your dashboard.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                            <Button
                                onClick={handleConnectGmail}
                                disabled={isConnecting}
                                className="group bg-white hover:bg-slate-100 text-slate-950 font-bold px-12 py-5 rounded-2xl shadow-2xl transition-all border-0 h-auto flex items-center gap-4 text-sm"
                            >
                                <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                                    <path fill="#C5221F" d="M16.909 21.002v-9.273L24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-5.455z" />
                                    <path fill="#F2A60C" d="M24 5.457c0-2.023-2.309-3.178-3.927-1.964L16.909 6.82l-4.91 3.682-6.544-4.91L3.927 3.493C2.309 2.279 0 3.434 0 5.457v5.455L12 16.64l12-9.006V5.457z" />
                                    <path fill="#188038" d="M0 5.457v13.909c0 .904.732 1.636 1.636 1.636h5.455v-9.273L0 5.457z" />
                                </svg>
                                {isConnecting ? 'INTEGRATING...' : 'CONNECT GMAIL PROTOCOL'}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MailTab;
