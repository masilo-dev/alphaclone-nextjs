'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Zap, ChevronRight, Activity, Cpu } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';

export default function GlobalAlpha() {
    const { user, loading } = useAuth();
    const { currentTenant } = useTenant();
    const pathname = usePathname();
    
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // RULE: Alpha is restricted to authenticated dashboard contexts. 
    // Invisible on landing page (/) and if no user is present.
    if (loading || !user || pathname === '/' || pathname === '/login' || pathname === '/register') {
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isDeploying || !currentTenant?.id) return;

        setIsDeploying(true);
        try {
            const res = await fetch('/api/alpha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: prompt, tenantId: currentTenant.id })
            });

            if (res.ok) {
                setStatus('success');
                setPrompt('');
                setTimeout(() => {
                    setStatus('idle');
                    setIsOpen(false);
                }, 1500);
            } else {
                setStatus('error');
            }
        } catch (err) {
            setStatus('error');
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <>
            {/* Semantic Clip Toggle */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(0,255,209,0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-[#000F15] border border-[#00FFD1]/40 rounded-sm flex items-center justify-center group"
            >
                <div className="absolute inset-0 bg-[#00FFD1]/5 animate-pulse" />
                <Cpu className={`w-6 h-6 text-[#00FFD1] ${isOpen ? 'rotate-90' : ''} transition-transform duration-500`} />
                <div className="absolute top-0 right-0 p-1">
                    <div className="w-1.5 h-1.5 bg-[#00FFD1] animate-ping" />
                </div>
            </motion.button>

            {/* Semantic Assistant Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        className="fixed bottom-24 right-6 z-[9999] w-[380px] bg-[#000F15] border border-[#00FFD1]/30 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden font-mono"
                    >
                        {/* Scanline Overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[length:100%_2px] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)]" />

                        <div className="p-3 border-b border-[#00FFD1]/10 flex items-center justify-between bg-[#001720]">
                            <div className="flex items-center gap-3">
                                <Activity className="w-3 h-3 text-[#00FFD1] animate-pulse" />
                                <span className="text-xs font-bold tracking-[0.4em] text-[#00FFD1] uppercase">Alpha_Executive</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="hover:text-red-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="space-y-1">
                                <div className="text-[11px] text-white font-bold tracking-tight mb-1">
                                    GREETINGS, {(user.name || user.email || 'OPERATOR').toUpperCase()}
                                </div>
                                <div className="text-xs text-[#00FFD1]/60 flex items-center gap-2">
                                    <Terminal className="w-2.5 h-2.5" />
                                    <span>AUTHORIZED_ID: {user.id.slice(0, 8)}</span>
                                </div>
                            </div>

                            <div className="border border-[#00FFD1]/20 bg-[#00FFD1]/5 p-3 text-xs leading-relaxed text-[#00FFD1]/80">
                                Missions are stored in your active workspace. Open Alpha Mission Control to review progress, approvals, results, and prior runs.
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="relative">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="DESCRIBE THE TASK YOU WANT ALPHA TO HELP WITH..."
                                        className="w-full bg-[#000508] border border-[#00FFD1]/20 p-4 text-xs text-[#00FFD1] placeholder:text-[#00FFD1]/20 focus:outline-none focus:border-[#00FFD1]/60 min-h-[120px] resize-none uppercase"
                                    />
                                    {status === 'success' && (
                                        <div className="absolute inset-0 bg-[#00FFD1] text-black flex flex-col items-center justify-center font-bold">
                                            <Zap className="w-8 h-8 mb-2 animate-bounce" />
                                            <span className="text-xs tracking-widest">MISSION_QUEUED</span>
                                        </div>
                                    )}
                                </div>

                                {status === 'error' && (
                                    <p className="text-xs text-red-300" role="alert">
                                        Mission dispatch failed. Confirm a workspace is selected and try again.
                                    </p>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={isDeploying || !prompt.trim() || !currentTenant?.id}
                                        className="flex-1 py-3 bg-[#00FFD1] text-black text-xs font-bold tracking-[0.2em] transition-all hover:bg-[#00D1FF] disabled:opacity-30 disabled:grayscale"
                                    >
                                        {isDeploying ? 'DISPATCHING...' : 'START MISSION'}
                                    </button>
                                    <Link 
                                        href="/alpha" 
                                        onClick={() => setIsOpen(false)}
                                        className="px-4 bg-[#001720] border border-[#00FFD1]/20 flex items-center justify-center transition-all hover:border-[#00FFD1] group"
                                    >
                                        <ChevronRight className="w-4 h-4 text-[#00FFD1] group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-2 bg-[#000508] border-t border-[#00FFD1]/10 flex items-center justify-between text-xs text-[#00FFD1]/40">
                            <div className="flex gap-4">
                                <span>SECURE: YES</span>
                                <span>SESSION: ACTIVE</span>
                            </div>
                            <span className="italic uppercase">Operator_{user.role}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
