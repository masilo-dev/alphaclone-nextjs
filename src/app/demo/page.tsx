'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, ArrowRight, ShieldCheck, Zap, Globe, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import Link from 'next/link';

export default function DemoPage() {
    return (
        <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30 relative overflow-x-hidden">
            {/* Background Glows */}
            <div className="marketing-glow-hero" />
            <div className="absolute top-[40%] -right-20 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            
            <main className="relative z-10 py-8 pb-24 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold tracking-widest uppercase mb-6">
                                <Play className="w-3 h-3 fill-current" /> Interactive Demo
                            </span>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-tight font-marketing-heading hero-metallic-text mb-6">
                                Experience the Future <br /> of Business Operations
                            </h1>
                            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                Watch how AlphaClone unifies your entire stack into a single, AI-powered high-performance OS. No more SaaS bloat. Just pure operational excellence.
                            </p>
                        </motion.div>
                    </div>

                    {/* Loom Video Embed Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative group mx-auto max-w-[900px]"
                    >
                        {/* Decorative glow behind video */}
                        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/20 to-blue-500/20 rounded-[2rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                        
                        <div className="relative bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                            {/* Loom Player Wrapper */}
                            <div className="aspect-video w-full">
                                <iframe 
                                    src="https://www.loom.com/embed/3a7000c925c145b7882089688b0ceb5d?hide_owner=true&hide_share=true&hide_title=true&hide_embed_params=true" 
                                    allowFullScreen={true}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    className="absolute inset-0"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                        {[
                            {
                                icon: <ShieldCheck className="w-6 h-6 text-teal-400" />,
                                title: "Unified Intelligence",
                                desc: "Stop jumping between tabs. AlphaClone connects your data across every module."
                            },
                            {
                                icon: <Zap className="w-6 h-6 text-blue-400" />,
                                title: "Instant Performance",
                                desc: "Built with the latest tech stack for lightning-fast responsiveness and zero lag."
                            },
                            {
                                icon: <Globe className="w-6 h-6 text-purple-400" />,
                                title: "Global Scale",
                                desc: "Design for teams that operate globally with multi-tenant and secure architecture."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-slate-900/30 border border-white/5 rounded-2xl p-8 hover:bg-slate-900/50 transition-colors"
                            >
                                <div className="p-3 bg-white/5 rounded-xl w-fit mb-6">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                                <p className="text-slate-400 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Final Call to Action */}
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-24 text-center glass-card p-12 rounded-[2.5rem] border border-teal-500/20"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to see it in action?</h2>
                        <p className="text-slate-400 mb-10 max-w-xl mx-auto">
                            See how teams connect leads, delivery, and billing in one workspace — representative workflows from consultants and agencies.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link href="/auth/login?register=true&type=business&plan=starter" className="w-full sm:w-auto">
                                <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-12 h-14 w-full shadow-xl shadow-teal-500/20">
                                    Get Started Now <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <Link href="/book-demo" className="w-full sm:w-auto">
                                <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-white px-12 h-14 w-full">
                                    Book a Demo
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer Background Light */}
            <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-teal-500/5 to-transparent pointer-events-none" />
        </div>
    );
}
