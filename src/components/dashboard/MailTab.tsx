'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2, ShieldCheck, Zap, Globe, Link2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { zohoService } from '../../services/zohoService';
import ZohoMailView from './business/ZohoMailView';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = ({ user }) => {
    const [isZohoIntegrated, setIsZohoIntegrated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    const checkStatus = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const connected = await zohoService.checkIntegration(user.id);
            setIsZohoIntegrated(connected);
        } catch (err) {
            console.error('Failed to check Zoho integration:', err);
            setIsZohoIntegrated(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [user?.id]);

    const handleConnectZoho = () => {
        setIsConnecting(true);
        // Redirect to Zoho OAuth flow
        window.location.href = `/api/auth/zoho/connect?userId=${user.id}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 gap-4">
                <div className="w-12 h-12 border-4 border-[#f5d400]/20 border-t-[#f5d400] rounded-full animate-spin"></div>
                <p className="text-slate-400 font-medium animate-pulse uppercase tracking-[0.2em] text-xs font-mono">Synchronizing Quantum Channels...</p>
            </div>
        );
    }

    if (isZohoIntegrated) {
        return <ZohoMailView userId={user.id} />;
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl"
            >
                {/* Visual Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#f5d400]/50 to-transparent" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#f5d400]/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl" />

                <div className="w-24 h-24 bg-gradient-to-br from-[#f5d400] to-[#e6c700] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#f5d400]/20 rotate-3 transition-transform hover:rotate-0 duration-500">
                    <Mail className="w-12 h-12 text-slate-950 -rotate-3" />
                </div>

                <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">Zoho Mail Command</h2>
                <p className="text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
                    Unleash high-frequency AI email automation via Zoho. Quantum-safe thread synchronization and context-aware neural drafting for the ultra-productive enterprise.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left hover:border-[#f5d400]/30 transition-colors group">
                        <Zap className="w-6 h-6 text-[#f5d400] mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Instant Sync</h4>
                        <p className="text-slate-500 text-xs">Real-time thread retrieval and multi-device coordination.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left hover:border-[#f5d400]/30 transition-colors group">
                        <ShieldCheck className="w-6 h-6 text-[#f5d400] mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Enterprise-Grade</h4>
                        <p className="text-slate-500 text-xs">OAuth2 authentication with dedicated token isolation.</p>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 text-left hover:border-[#f5d400]/30 transition-colors group">
                        <Globe className="w-6 h-6 text-[#f5d400] mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Unified Context</h4>
                        <p className="text-slate-500 text-xs">AI understands complex business relationships across Zoho threads.</p>
                    </div>
                </div>

                <Button
                    onClick={handleConnectZoho}
                    disabled={isConnecting}
                    className="h-16 px-10 rounded-2xl bg-[#f5d400] hover:bg-[#e6c700] text-slate-950 font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl shadow-yellow-500/10 flex items-center justify-center gap-3 mx-auto"
                >
                    {isConnecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Link2 className="w-6 h-6" />}
                    CONNECT ZOHO NOW
                </Button>

                <div className="mt-8 flex items-center justify-center gap-4 text-slate-500 text-[10px] uppercase font-mono tracking-widest opacity-60">
                    <span>Active Integration: Zoho Mail</span>
                    <div className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span>AI Engine: Enabled</span>
                </div>
            </motion.div>
        </div>
    );
};

export default MailTab;
