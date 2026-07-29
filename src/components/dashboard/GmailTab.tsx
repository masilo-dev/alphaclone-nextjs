import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { Mail, ShieldCheck, Zap, Globe, Link2 } from 'lucide-react';
import { gmailService } from '../../services/gmailService';
import { GmailIntegrationView } from './GmailIntegrationView';

interface GmailTabProps {
    user: any;
}

const GmailTab: React.FC<GmailTabProps> = ({ user }) => {
    const [isIntegrated, setIsIntegrated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            if (!user?.id) return;
            try {
                const connected = await gmailService.checkIntegration(user.id);
                setIsIntegrated(connected);
            } catch (err) {
                console.error('Failed to check Gmail integration:', err);
                setIsIntegrated(false);
            } finally {
                setIsLoading(false);
            }
        };
        checkStatus();
    }, [user?.id]);

    const handleConnect = () => {
        // Redirect to Google OAuth flow
        window.location.href = `/api/auth/google/gmail/connect?userId=${user.id}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium animate-pulse uppercase tracking-[0.2em] text-xs">Syncing Gmail...</p>
            </div>
        );
    }

    if (isIntegrated) {
        return <GmailIntegrationView userId={user.id} />;
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl"
            >
                {/* Visual Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />

                <div className="w-24 h-24 bg-gradient-to-br from-teal-500 to-teal-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-teal-500/20 rotate-3">
                    <Mail className="w-12 h-12 text-slate-950 -rotate-3" />
                </div>

                <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Gmail Integration</h2>
                <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
                    Connect Gmail to sync threads, draft replies, and manage conversations from your workspace.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <Zap className="w-6 h-6 text-teal-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">Instant Sync</h4>
                        <p className="text-slate-500 text-xs">Real-time thread retrieval and multi-device coordination.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <ShieldCheck className="w-6 h-6 text-teal-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">Secure</h4>
                        <p className="text-slate-500 text-xs">OAuth2 authentication with protected account access.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left">
                        <Globe className="w-6 h-6 text-teal-400 mb-3" />
                        <h4 className="text-white font-bold text-sm mb-1">Shared Context</h4>
                        <p className="text-slate-500 text-xs">Use email alongside the rest of your business data.</p>
                    </div>
                </div>

                <Button
                    onClick={handleConnect}
                    className="h-16 px-10 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-lg transition-transform hover:scale-105 active:scale-95 shadow-xl"
                >
                    <Link2 className="w-6 h-6 mr-2" /> Connect Gmail
                </Button>

                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold mt-8 opacity-50">
                    Trusted by 2,000+ high-performance organizations
                </p>
            </motion.div>
        </div>
    );
};

export default GmailTab;

