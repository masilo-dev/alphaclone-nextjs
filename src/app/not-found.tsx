'use client';

import React from 'react';
import Link from 'next/link';
import { Home, ArrowLeft, Search, ShieldAlert, WifiOff } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ultra-Premium Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-[0.03]" />
            </div>

            <div className="relative z-10 text-center max-w-2xl mx-auto space-y-12 animate-in fade-in zoom-in duration-700">
                {/* 404 Visual Header */}
                <div className="relative inline-block">
                    <div className="text-[12rem] font-black leading-none tracking-tighter text-white/5 select-none transition-all group-hover:text-white/10">
                        404
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-6 rounded-3xl shadow-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="text-left">
                                <div className="text-xl font-bold text-white tracking-wide">SIGNAL TERMINATED</div>
                                <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">Location: Unknown Sector</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                        LOST IN <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">CYBERSPACE</span>
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed max-w-md mx-auto">
                        The requested vector does not exist in the AlphaClone network. Please verify your connection protocols.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                    <button
                        onClick={() => window.history.back()}
                        className="group flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-2xl transition-all border border-slate-800 hover:border-slate-700 font-bold tracking-widest text-xs uppercase"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        PREVIOUS SECTOR
                    </button>

                    <Link
                        href="/"
                        className="group flex items-center justify-center gap-3 px-10 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl transition-all shadow-[0_0_30px_rgba(45,212,191,0.2)] hover:shadow-[0_0_40px_rgba(45,212,191,0.4)] font-black tracking-widest text-xs uppercase"
                    >
                        <Home className="w-4 h-4" />
                        RETURN TO BASE
                    </Link>
                </div>

                {/* Decorative Footer */}
                <div className="flex items-center justify-center gap-6 text-[10px] text-slate-500 font-mono pt-12 opacity-50">
                    <div className="flex items-center gap-2 italic">
                        <WifiOff className="w-3 h-3" />
                        NO UP-LINK FOUND
                    </div>
                </div>
            </div>
        </div>
    );
}
