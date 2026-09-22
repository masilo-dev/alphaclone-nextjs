'use client';

import { motion } from 'framer-motion';
import { Play, ArrowRight, ShieldCheck, Activity, ClipboardList } from 'lucide-react';
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
        <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-500/20 relative overflow-x-hidden">
            <main className="relative z-10 py-8 pb-24 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold tracking-widest uppercase mb-6">
                                <Play className="w-3 h-3 fill-current" /> Recorded product demo
                            </span>
                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight font-marketing-heading mb-6 text-slate-950">
                                Watch instructions become <br /> accountable execution
                            </h1>
                            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                                See how AlphaClone connects business context, human approval, and connected tools so work moves from instruction to a recorded result.
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
                        <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                            {/* Loom Player Wrapper */}
                            <div className="aspect-video w-full">
                                <iframe 
                                    src="https://www.loom.com/embed/3a7000c925c145b7882089688b0ceb5d?hide_owner=true&hide_share=true&hide_title=true&hide_embed_params=true" 
                                    allowFullScreen={true}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    className="absolute inset-0"
                                    title="AlphaClone recorded product demonstration"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                        {[
                            {
                                icon: <ClipboardList className="w-6 h-6 text-blue-700" />,
                                title: "Instruction with context",
                                desc: "The request is connected to the right workspace, records, permissions, and business tools."
                            },
                            {
                                icon: <ShieldCheck className="w-6 h-6 text-blue-700" />,
                                title: "Human approval",
                                desc: "Important external actions remain reviewable before the system executes them."
                            },
                            {
                                icon: <Activity className="w-6 h-6 text-blue-700" />,
                                title: "Recorded execution",
                                desc: "The workspace shows what ran, what happened, and what needs attention next."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm hover:border-blue-300 transition-colors"
                            >
                                <div className="p-3 bg-blue-50 rounded-md w-fit mb-6 border border-blue-100">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-semibold text-slate-950 mb-3">{feature.title}</h3>
                                <p className="text-slate-600 leading-relaxed text-sm">
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
                        className="mt-24 text-center p-12 rounded-xl border border-slate-200 bg-slate-50"
                    >
                        <h2 className="text-3xl md:text-4xl font-semibold text-slate-950 mb-6">Ready to use your own workflow?</h2>
                        <p className="text-slate-600 mb-10 max-w-xl mx-auto">
                            Start a trial or book a live walkthrough built around the work your business needs to execute.
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
                                <Button size="lg" variant="outline" className="border-slate-300 hover:bg-white text-slate-900 px-12 h-14 w-full">
                                    Book a live walkthrough
                                </Button>
                            </a>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
