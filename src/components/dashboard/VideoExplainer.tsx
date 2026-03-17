'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Globe } from 'lucide-react';
import DynamicVideoSimulation from './DynamicVideoSimulation';

const VideoExplainer = () => {
    return (
        <section className="py-24 bg-slate-950 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Introduction to AlphaClone Systems</h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                        Experience the world&apos;s most advanced Multi-Tenant Business OS through our interactive 10-minute platform tour.
                        Unifying CRM, Projects, AI, and Security into one premium experience.
                    </p>
                </div>

                <div className="relative max-w-5xl mx-auto">
                    {/* Video Simulation Frame */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl shadow-blue-500/10"
                    >
                        <DynamicVideoSimulation />
                    </motion.div>

                    {/* Decorative Elements */}
                    <div className="absolute -top-6 -right-6 w-32 h-32 bg-teal-500/10 blur-3xl rounded-full" />
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
                </div>

                {/* Key Features / Highlights */}
                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <Zap className="w-6 h-6 text-teal-400" />,
                            title: "AI Studio",
                            desc: "Autonomous agents and generative content engines integrated into every workflow."
                        },
                        {
                            icon: <Shield className="w-6 h-6 text-blue-400" />,
                            title: "SiteGuard",
                            desc: "Enterprise-grade perimeter monitoring and isolated tenant data security."
                        },
                        {
                            icon: <Globe className="w-6 h-6 text-violet-400" />,
                            title: "Unified OS",
                            desc: "One platform for your entire organization, globally accessible and infinitely scalable."
                        }
                    ].map((item, i) => (
                        <div key={i} className="p-8 bg-slate-900/40 border border-slate-800/50 rounded-2xl backdrop-blur-sm hover:border-slate-700 transition-colors group">
                            <div className="mb-4">{item.icon}</div>
                            <h4 className="text-lg font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">{item.title}</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default VideoExplainer;
