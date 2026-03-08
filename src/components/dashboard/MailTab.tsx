'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, CheckCircle2, ShieldCheck, Zap, Globe, Link2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { zohoService } from '../../services/zohoService';
import ZohoMailView from './business/ZohoMailView';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface MailTabProps {
    user: any;
}

const MailTab: React.FC<MailTabProps> = ({ user }) => {
    const searchParams = useSearchParams();
    const [isZohoIntegrated, setIsZohoIntegrated] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    const checkStatus = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const connected = await zohoService.checkIntegration(user.id);
            setIsZohoIntegrated(connected);
            if (connected && searchParams.get('zoho') === 'connected') {
                toast.success('Zoho Mail Connected Successfully!', {
                    icon: '🚀',
                    duration: 5000,
                });
            }
        } catch (err) {
            console.error('Failed to check Zoho integration:', err);
            setIsZohoIntegrated(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [user?.id, searchParams.get('zoho')]);

    const handleConnectZoho = () => {
        setIsConnecting(true);
        // Redirect to Zoho OAuth flow with current path as returnTo
        const currentPath = window.location.pathname;
        window.location.href = `/api/auth/zoho/connect?userId=${user.id}&returnTo=${encodeURIComponent(currentPath)}`;
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-20 gap-6 bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-2xl"
                    >
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-teal-500/20 border-t-[#f5d400] rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-8 h-8 text-[#f5d400] animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-white font-black uppercase tracking-[0.3em] text-xs mb-2">Synchronizing Quantum Channels</p>
                            <p className="text-slate-500 text-[10px] uppercase font-mono tracking-widest animate-pulse">Establishing secure link to Zoho-Node-Alpha...</p>
                        </div>
                    </motion.div>
                ) : isZohoIntegrated ? (
                    <motion.div
                        key="integrated"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <ZohoMailView userId={user.id} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="connect"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 border border-white/10 rounded-[4rem] p-12 sm:p-20 text-center relative overflow-hidden shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)]"
                    >
                        {/* Visual Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[#f5d400]/40 to-transparent" />
                        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#f5d400]/10 rounded-full blur-[100px]" />
                        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px]" />

                        <motion.div
                            whileHover={{ rotate: 12, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className="w-32 h-32 bg-gradient-to-br from-[#f5d400] to-[#e6c700] rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-yellow-500/20 cursor-pointer"
                        >
                            <Mail className="w-16 h-16 text-slate-950" />
                        </motion.div>

                        <h2 className="text-5xl sm:text-7xl font-black text-white mb-6 tracking-tight uppercase leading-none">
                            Zoho Mail <br />
                            <span className="text-[#f5d400] text-3xl sm:text-5xl">Neural Hub</span>
                        </h2>
                        <p className="text-slate-400 max-w-2xl mx-auto mb-12 text-lg leading-relaxed font-medium">
                            Unleash high-frequency AI email automation. Quantum-safe thread synchronization and context-aware neural drafting for the ultra-productive enterprise.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                            {[
                                { icon: Zap, title: "Instant Sync", desc: "Real-time thread retrieval and multi-device coordination." },
                                { icon: ShieldCheck, title: "Quantum Secure", desc: "OAuth2 authentication with dedicated token isolation." },
                                { icon: Globe, title: "Unified Context", desc: "AI understands complex business relationships across Zoho threads." }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="bg-white/2 backdrop-blur-xl border border-white/5 rounded-3xl p-8 text-left hover:border-[#f5d400]/30 transition-all group"
                                >
                                    <feature.icon className="w-8 h-8 text-[#f5d400] mb-4 group-hover:scale-110 transition-transform" />
                                    <h4 className="text-white font-black text-sm mb-2 uppercase tracking-widest">{feature.title}</h4>
                                    <p className="text-slate-500 text-xs leading-relaxed">{feature.desc}</p>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Button
                                onClick={handleConnectZoho}
                                disabled={isConnecting}
                                className="h-20 px-16 rounded-[2rem] bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 font-black text-xl transition-all shadow-2xl shadow-yellow-500/20 flex items-center justify-center gap-4 mx-auto uppercase tracking-tighter"
                            >
                                {isConnecting ? <Loader2 className="w-8 h-8 animate-spin" /> : <Link2 className="w-8 h-8 stroke-[3px]" />}
                                Establish Link Now
                            </Button>
                        </motion.div>

                        <div className="mt-12 flex items-center justify-center gap-6 text-slate-500 text-[10px] uppercase font-black tracking-[0.3em] opacity-40">
                            <span className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                                Zoho Protocol v2.4
                            </span>
                            <div className="w-1 h-1 bg-slate-800 rounded-full" />
                            <span className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-[#f5d400] rounded-full animate-pulse" />
                                AI Engine Active
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MailTab;
