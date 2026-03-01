'use client';

import React from 'react';
import { Mail, Sparkles, Clock, ShieldCheck, Zap } from 'lucide-react';

const GmailTab: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 min-h-[600px] relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-2xl w-full text-center z-10 animate-in fade-in zoom-in duration-700">
                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full mb-8">
                    <Sparkles className="w-3 h-3 text-teal-400" />
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em]">Platform Evolution</span>
                </div>

                {/* Main Heading */}
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                    Premium <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400">Communication</span><br />
                    Integration Incoming.
                </h2>

                <p className="text-slate-400 text-lg mb-12 leading-relaxed max-w-lg mx-auto font-medium">
                    We are engineering a deep, high-performance Gmail integration that transforms how you manage client relations.
                    <span className="text-slate-500 italic"> Coming soon to your AlphaClone OS.</span>
                </p>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-teal-500/30 transition-all group">
                        <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                            <Zap className="w-5 h-5 text-teal-400" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">AI Drafting</h4>
                        <p className="text-slate-500 text-[10px]">Context-aware automated responses.</p>
                    </div>

                    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/30 transition-all group">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Secure Links</h4>
                        <p className="text-slate-500 text-[10px]">Embedded branding for all meeting syncs.</p>
                    </div>

                    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all group">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                            <Clock className="w-5 h-5 text-slate-400" />
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-wider">Live Sync</h4>
                        <p className="text-slate-500 text-[10px]">Bi-directional thread integration.</p>
                    </div>
                </div>

                {/* Progress Bar Mockup */}
                <div className="relative w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-4 max-w-xs mx-auto">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-500 to-indigo-500 w-[65%] animate-pulse" />
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engineering Phase 04/05</p>
            </div>
        </div>
    );
};

export default GmailTab;
