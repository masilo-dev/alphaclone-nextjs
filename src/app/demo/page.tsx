'use client';

import { motion } from 'framer-motion';
import { Play, ArrowRight, ShieldCheck, Activity, Globe } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import Link from 'next/link';
import { DEMO_HREF, isExternalHref, withPreservedQuery } from '@/lib/marketing/cta';
import { useEffect, useState } from 'react';

export default function DemoPage() {
    const [bookingHref, setBookingHref] = useState<string>(DEMO_HREF);
    useEffect(() => {
      try {
        setBookingHref(withPreservedQuery(DEMO_HREF, window.location.search));
      } catch {
        setBookingHref(DEMO_HREF);
      }
    }, []);
    const external = isExternalHref(bookingHref);

    return (
        <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30 relative overflow-x-hidden">
            <main className="relative z-10 py-8 pb-24 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold tracking-widest uppercase mb-6">
                                <Play className="w-3 h-3 fill-current" /> Interactive Demo
                            </span>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight font-marketing-heading mb-6 text-white">
                                Experience Modern <br /> Business Operations
                            </h1>
                            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                                Watch how AlphaClone unifies your entire stack into a single, integrated high-performance OS. No more SaaS bloat. Just pure operational excellence.
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
                        <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
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
                                icon: <ShieldCheck className="w-6 h-6 text-slate-300" />,
                                title: "Unified Intelligence",
                                desc: "Stop jumping between tabs. AlphaClone connects your data across every module."
                            },
                            {
                                icon: <Activity className="w-6 h-6 text-slate-300" />,
                                title: "Instant Performance",
                                desc: "Built with the latest tech stack for fast responsiveness and zero unnecessary lag."
                            },
                            {
                                icon: <Globe className="w-6 h-6 text-slate-300" />,
                                title: "Global Scale",
                                desc: "Designed for teams that operate globally with multi-tenant and secure architecture."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 hover:bg-slate-900/70 transition-colors"
                            >
                                <div className="p-3 bg-slate-800 rounded-md w-fit mb-6 border border-slate-700">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
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
                        className="mt-24 text-center p-12 rounded-xl border border-slate-800 bg-slate-900/50"
                    >
                        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">Ready to see it in action?</h2>
                        <p className="text-slate-400 mb-10 max-w-xl mx-auto">
                            See how teams connect leads, delivery, and billing in one workspace — representative workflows from consultants and agencies.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Link href="/auth/login?register=true&type=business&plan=starter" className="w-full sm:w-auto">
                                <Button size="lg" className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-12 h-14 w-full shadow-md">
                                    Get Started Now <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </Link>
                            <a
                                href={bookingHref}
                                target={external ? '_blank' : undefined}
                                rel={external ? 'noopener noreferrer' : undefined}
                                className="w-full sm:w-auto"
                            >
                                <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-white px-12 h-14 w-full">
                                    Book a Demo
                                </Button>
                            </a>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
