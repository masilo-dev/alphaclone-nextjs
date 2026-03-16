'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, CheckCircle2, ShieldCheck, Zap, Globe, Link2, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { zohoService } from '../../services/zohoService';
import ZohoIntegration from './business/ZohoIntegration';
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
                            <div className="w-12 h-12 border-4 border-teal-500/20 border-t-[#f5d400] rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-[#f5d400] animate-pulse" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-white font-black uppercase tracking-[0.2em] text-[10px] mb-1">Synchronizing</p>
                            <p className="text-slate-500 text-[9px] uppercase font-mono tracking-widest animate-pulse">Establishing secure link...</p>
                        </div>
                    </motion.div>
                ) : isZohoIntegrated ? (
                    <motion.div
                        key="integrated"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <ZohoIntegration user={user} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="connect"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 text-center relative overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
                    >
                        {/* Visual Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#f5d400]/30 to-transparent" />
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#f5d400]/10 rounded-full blur-[80px]" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px]" />

                        <motion.div
                            whileHover={{ rotate: 12, scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                            className="w-20 h-20 bg-gradient-to-br from-[#f5d400] to-[#e6c700] rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-500/10 cursor-pointer"
                        >
                            <Mail className="w-10 h-10 text-slate-950" />
                        </motion.div>

                        <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight uppercase leading-none">
                            Zoho Mail <br />
                            <span className="text-[#f5d400] text-xl sm:text-3xl">Neural Hub</span>
                        </h2>
                        <p className="text-slate-400 max-w-xl mx-auto mb-8 text-base leading-relaxed font-medium">
                            Unleash high-frequency AI email automation with quantum-safe thread synchronization.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                            {[
                                { icon: Zap, title: "Instant Sync", desc: "Real-time thread retrieval." },
                                { icon: ShieldCheck, title: "Secure", desc: "Dedicated token isolation." },
                                { icon: Globe, title: "AI Context", desc: "Native business mapping." }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (i * 0.1) }}
                                    className="bg-white/2 backdrop-blur-xl border border-white/5 rounded-2xl p-6 text-left hover:border-[#f5d400]/30 transition-all group"
                                >
                                    <feature.icon className="w-6 h-6 text-[#f5d400] mb-3 group-hover:scale-110 transition-transform" />
                                    <h4 className="text-white font-black text-[10px] mb-1 uppercase tracking-widest">{feature.title}</h4>
                                    <p className="text-slate-500 text-[9px] leading-relaxed">{feature.desc}</p>
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
                                className="h-14 px-10 rounded-[1.2rem] bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 font-black text-base transition-all shadow-xl shadow-yellow-500/10 flex items-center justify-center gap-3 mx-auto uppercase tracking-tighter"
                            >
                                {isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Link2 className="w-5 h-5 stroke-[2.5px]" />}
                                Establish Link
                            </Button>
                        </motion.div>

                        <div className="mt-8 flex items-center justify-center gap-4 text-slate-500 text-[8px] uppercase font-black tracking-[0.2em] opacity-30">
                            <span className="flex items-center gap-1.5">
                                <div className="w-1 h-1 bg-teal-500 rounded-full animate-pulse" />
                                v2.4
                            </span>
                            <div className="w-0.5 h-0.5 bg-slate-800 rounded-full" />
                            <span className="flex items-center gap-1.5">
                                <div className="w-1 h-1 bg-[#f5d400] rounded-full animate-pulse" />
                                AI Active
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MailTab;
