'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, ShieldCheck, Zap, Globe, Link2, Loader2 } from 'lucide-react';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { MicrosoftMailView } from './MicrosoftMailView';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = ({ user }) => {
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkStatus = async () => {
        if (!user?.id) return;
        try {
            const connected = await microsoftAuthService.isConnected();
            setIsConnected(connected);
        } catch (err) {
            console.error('Failed to check Microsoft connection status:', err);
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [user?.id]);

    const handleConnect = () => {
        try {
            microsoftAuthService.initiateOAuth();
        } catch (error: any) {
            toast.error(error.message || 'Unable to start Microsoft 365 connection');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4 h-[50vh]">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse uppercase tracking-[0.2em] text-xs">Syncing Outlook Inbox...</p>
            </div>
        );
    }

    if (isConnected) {
        return <MicrosoftMailView userId={user.id} />;
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl"
            >
                {/* Visual Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />

                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/20 rotate-3">
                    <Mail className="w-12 h-12 text-white -rotate-3" />
                </div>

                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Microsoft 365 Outlook Mail</h2>
                <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
                    Connect your Microsoft Outlook or work/school account to read threads, draft replies with AI, and manage conversations directly from your dashboard.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <Zap className="w-6 h-6 text-blue-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">Instant Sync</h4>
                        <p className="text-slate-500 text-xs">Real-time inbox retrieval and multi-device coordination.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <ShieldCheck className="w-6 h-6 text-blue-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">Secure OAuth</h4>
                        <p className="text-slate-500 text-xs">Microsoft secure connection. Your credentials remain safe and private.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <Globe className="w-6 h-6 text-blue-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">AI Powered</h4>
                        <p className="text-slate-500 text-xs">Summarize conversation threads and generate professional drafts instantly.</p>
                    </div>
                </div>

                <Button
                    onClick={handleConnect}
                    variant="secondary"
                    className="h-16 px-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl"
                >
                    <Link2 className="w-6 h-6 mr-2" /> Connect Microsoft 365
                </Button>

                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-8 opacity-50">
                    Full compatibility with Personal and Enterprise Accounts
                </p>
            </motion.div>
        </div>
    );
};

export default MailTab;
