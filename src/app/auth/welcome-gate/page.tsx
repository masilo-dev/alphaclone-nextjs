'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import Image from 'next/image';
import { LOGO_URL } from '@/constants';
import { Button } from '@/components/ui/UIComponents';

export default function WelcomeGatePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token');
    
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setError('Missing security token. Access denied.');
            return;
        }

        const verify = async () => {
            const supabase = createSupabaseBrowserClient();
            
            // Artificial progress for premium feel
            const interval = setInterval(() => {
                setProgress(prev => (prev < 90 ? prev + 15 : prev));
            }, 300);

            try {
                // Call the verification (we'll implement the API route next)
                const response = await fetch(`/api/auth/verify-token?token=${token}`);
                const result = await response.json();

                clearInterval(interval);
                setProgress(100);

                if (!response.ok || result.error) {
                    setStatus('error');
                    setError(result.error || 'Verification failed');
                } else {
                    // Verification success
                    setStatus('success');
                    // We don't sign in here, the link just verified their existence/access
                    // If we want to auto-login, the API should have returned a session or we use the userId
                    // But usually, the user is already signed up, they just need to enter the dash.
                    setTimeout(() => {
                        router.push('/dashboard/business');
                    }, 2000);
                }
            } catch (err) {
                clearInterval(interval);
                setStatus('error');
                setError('A secure connection could not be established.');
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full z-10"
            >
                <div className="text-center mb-12">
                    <Image src={LOGO_URL} alt="AlphaClone" width={64} height={64} className="mx-auto mb-6" priority />
                    <h1 className="text-2xl font-black text-white tracking-tight">SECURITY HANDSHAKE</h1>
                    <p className="text-slate-500 text-sm mt-2 uppercase tracking-widest font-semibold">AlphaClone Infrastructure Gate</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {status === 'verifying' && (
                            <motion.div 
                                key="verifying"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center"
                            >
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full animate-pulse" />
                                    <div className="relative w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner">
                                        <Lock className="w-10 h-10 text-teal-400" />
                                    </div>
                                </div>
                                
                                <h2 className="text-xl font-bold text-white mb-2 text-center">Verifying Credentials</h2>
                                <p className="text-slate-400 text-sm text-center mb-8">Establishing an encrypted session with the Command Center...</p>

                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                                    <motion.div 
                                        className="h-full bg-teal-500"
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                                <div className="flex justify-between w-full text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                                    <span>Syncing Pulse</span>
                                    <span>{progress}%</span>
                                </div>
                            </motion.div>
                        )}

                        {status === 'success' && (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center py-4"
                            >
                                <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mb-6 border border-teal-500/20">
                                    <CheckCircle className="w-10 h-10 text-teal-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Access Granted</h2>
                                <p className="text-slate-400 text-center text-sm mb-6">Security protocols passed. Provisioning your dashboard environment...</p>
                                <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                            </motion.div>
                        )}

                        {status === 'error' && (
                            <motion.div 
                                key="error"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-500/20 text-rose-500">
                                    <AlertCircle className="w-10 h-10" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                                <p className="text-rose-400 text-center text-sm mb-8">{error || 'The security token has expired or is invalid.'}</p>
                                
                                <Button 
                                    onClick={() => router.push('/auth/login')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl flex items-center justify-center gap-2"
                                >
                                    Return to Login <ArrowRight className="w-4 h-4" />
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-600 text-[10px] uppercase tracking-[0.3em] font-bold">Encrypted End-to-End &bull; Session Managed</p>
                </div>
            </motion.div>
        </div>
    );
}
