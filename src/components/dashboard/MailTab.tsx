'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Zap, Server, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { GmailIntegrationView } from './GmailIntegrationView';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { UnifiedEmailService, UnifiedMessage } from '../../services/email/UnifiedEmailService';
import { AIIntelligencePanel } from './AIIntelligencePanel';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isGmailIntegrated, setIsGmailIntegrated] = useState<boolean | null>(null);
    const [isCustomSmtpIntegrated, setIsCustomSmtpIntegrated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [messages, setMessages] = useState<UnifiedMessage[]>([]);
    const [providers, setProviders] = useState<any>({ gmail: false, custom_smtp: false, zoho: false });

    const checkStatus = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const connectedProviders = await UnifiedEmailService.getConnectedProviders(user.id);
            setProviders(connectedProviders);
            setIsGmailIntegrated(connectedProviders.gmail);
            setIsCustomSmtpIntegrated(connectedProviders.custom_smtp);

            if (connectedProviders.gmail) {
                const msgs = await UnifiedEmailService.listMessages(user.id);
                setMessages(msgs);
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

    const handleGoToSettings = () => {
        router.push('/dashboard/business/settings');
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
                            <p className="text-white font-black uppercase tracking-[0.2em] text-xs mb-1">Synchronizing</p>
                            <p className="text-slate-500 text-xs uppercase font-mono tracking-widest animate-pulse">Establishing secure link...</p>
                        </div>
                    </motion.div>
                ) : isGmailIntegrated ? (
                    <motion.div
                        key="integrated-gmail"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-6"
                    >
                        <AIIntelligencePanel moduleKey="emailInbox" title="Email Intelligence" />
                        
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Inbox Activity</h2>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline"
                                    onClick={() => checkStatus()}
                                    className="h-10 px-4"
                                >
                                    Refresh
                                </Button>
                                <Button 
                                    onClick={async () => {
                                        toast.loading('AI: Triaging inbox...', { id: 'nexus-mail' });
                                        const res = await UnifiedEmailService.triageInbox(currentTenant?.id || '');
                                        if (res.success) {
                                            toast.success(res.result?.message || 'Inbox triaged', { id: 'nexus-mail' });
                                        } else {
                                            toast.error(res.error || 'Triage failed', { id: 'nexus-mail' });
                                        }
                                    }}
                                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold h-10 px-4"
                                >
                                    <Zap className="w-4 h-4 mr-2" />
                                    AI Triage
                                </Button>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-[2rem] overflow-hidden">
                            <GmailIntegrationView userId={user.id} />
                        </div>
                    </motion.div>
                ) : isCustomSmtpIntegrated ? (
                    <motion.div
                        key="integrated-smtp"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-8"
                    >
                        {/* Connected Status banner */}
                        <div className="rounded-[2rem] bg-gradient-to-br from-emerald-950/40 to-teal-950/20 border border-emerald-500/20 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex gap-4 items-start">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                    <Server className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Custom SMTP/IMAP Server Active</h2>
                                    <p className="text-slate-400 text-sm">Your custom outbound mail server and inbound receiver are online.</p>
                                </div>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={handleGoToSettings}
                                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                            >
                                Edit Settings
                            </Button>
                        </div>

                        {/* What's next Guide */}
                        <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-8 space-y-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-teal-400" /> What's Next? Setup Outreach & Nurturing
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Now that your SMTP server is connected, you can start automating high-conversion lead workflows, run massive AI outreach campaigns, or trigger auto-replies.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-850 hover:border-teal-500/20 transition-all">
                                    <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-teal-400" /> 1. Send cold campaigns
                                    </h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Configure targeted sales templates and deploy fully autonomous lead pipelines.
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-850 hover:border-teal-500/20 transition-all">
                                    <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-teal-400" /> 2. AI Lead Qualification
                                    </h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Activate context-aware auto-responders that reply automatically based on inbound signals.
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-850 hover:border-teal-500/20 transition-all">
                                    <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-teal-400" /> 3. Monitor Unified Inbox
                                    </h4>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        All outgoing outreach and customer replies are tracked automatically under the unified inbox.
                                    </p>
                                </div>
                            </div>
                        </div>
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
                            Connect your team's email service to manage all client outbound communication and chronological triage directly.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left relative z-10">
                            {/* Option 1: Gmail Connect */}
                            <div className="p-6 bg-slate-800/40 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                                            <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                                            <path fill="#C5221F" d="M16.909 21.002v-9.273L24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-5.455z" />
                                            <path fill="#F2A60C" d="M24 5.457c0-2.023-2.309-3.178-3.927-1.964L16.909 6.82l-4.91 3.682-6.544-4.91L3.927 3.493C2.309 2.279 0 3.434 0 5.457v5.455L12 16.64l12-9.006V5.457z" />
                                            <path fill="#188038" d="M0 5.457v13.909c0 .904.732 1.636 1.636 1.636h5.455v-9.273L0 5.457z" />
                                        </svg>
                                        <h4 className="font-bold text-white text-sm">Gmail Protocol (OAuth)</h4>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                                        Secure OAuth connection to authenticate standard workspace Google / Gmail accounts.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleConnectGmail}
                                    disabled={isConnecting}
                                    className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold"
                                >
                                    Connect Gmail
                                </Button>
                            </div>

                            {/* Option 2: Custom SMTP */}
                            <div className="p-6 bg-slate-800/40 rounded-3xl border border-white/5 flex flex-col justify-between hover:border-white/10 transition-all">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <Server className="w-5 h-5 text-teal-400" />
                                        <h4 className="font-bold text-white text-sm">Custom SMTP / IMAP</h4>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed mb-6">
                                        Authenticate using standard SMTP/IMAP credentials for any private or custom email domains.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleGoToSettings}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700"
                                >
                                    Setup SMTP Server
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MailTab;
