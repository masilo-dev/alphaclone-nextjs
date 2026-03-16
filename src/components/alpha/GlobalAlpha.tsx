'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, X, Terminal, Send, Activity, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function GlobalAlpha() {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isDeploying) return;

        setIsDeploying(true);
        try {
            const res = await fetch('/api/alpha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: prompt })
            });

            if (res.ok) {
                setStatus('success');
                setPrompt('');
                setTimeout(() => {
                    setStatus('idle');
                    setIsOpen(false);
                }, 2000);
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
            {/* Floating Toggle Button */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-[9999] p-4 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full shadow-[0_0_20px_rgba(20,184,166,0.4)] border border-white/20 group"
            >
                <Cpu className={`w-6 h-6 text-white ${isOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal-300 rounded-full animate-ping" />
            </motion.button>

            {/* Alpha Quick Terminal */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        className="fixed bottom-24 right-6 z-[9999] w-[350px] md:w-[400px] glass-panel rounded-2xl border border-teal-500/30 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                    >
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-teal-500/10">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-400 animate-pulse" />
                                <span className="text-xs font-bold tracking-[0.2em] text-teal-400 uppercase">Alpha Engine</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-md transition-all">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                                <Terminal className="w-3 h-3" />
                                <span>READY FOR MISSION PROTOCOL</span>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="relative">
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Command Alpha System..."
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 min-h-[120px] resize-none font-mono"
                                    />
                                    {status === 'success' && (
                                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl animate-fade-in">
                                            <div className="text-center">
                                                <div className="text-teal-400 font-bold tracking-widest text-xs mb-2">MISSION DEPLOYED</div>
                                                <div className="text-[10px] text-slate-400 uppercase">Alpha is processing.</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="submit"
                                        disabled={isDeploying || !prompt.trim()}
                                        className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs font-bold tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isDeploying ? 'PREPARING...' : 'INITIALIZE'}
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                    <Link 
                                        href="/alpha" 
                                        onClick={() => setIsOpen(false)}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-all group"
                                    >
                                        <motion.div whileHover={{ scale: 1.1 }}>
                                            <Activity className="w-4 h-4 text-slate-300 group-hover:text-teal-400" />
                                        </motion.div>
                                    </Link>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-3 bg-white/5 border-t border-white/5 flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-slate-500 font-mono">CPU: 12%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                <span className="text-[10px] text-slate-500 font-mono">MEM: 1.2GB</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
