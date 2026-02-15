'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, Shield, Zap, Globe, ArrowRight, Star, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';

const plans = [
    {
        name: 'Starter',
        price: '15',
        desc: 'Ideal for solo entrepreneurs.',
        features: ['5 Multi-tenant Users', 'Core CRM Pipeline', '5GB Secure Storage', 'Standard Project MGMT'],
        cta: 'Start Free Trial',
        color: 'slate'
    },
    {
        name: 'Professional',
        price: '45',
        popular: true,
        desc: 'Full power for growing teams.',
        features: ['25 Multi-tenant Users', 'Infinite CRM Pipelines', 'AI Sales Automation', '25GB Secure Storage', 'Priority Support'],
        cta: 'Start Free Trial',
        color: 'teal'
    },
    {
        name: 'Enterprise',
        price: '80',
        desc: 'Total scale and custom infra.',
        features: ['Unlimited Users', 'Dedicated DB Instance', 'White-labeled Ecosystem', 'API Access', '24/7 Priority Engineer'],
        cta: 'Contact Sales',
        color: 'blue'
    }
];

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-teal-500/30 overflow-hidden">
            {/* Background Orbs */}
            <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-teal-500/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-blue-500/10 blur-[150px] rounded-full" />
            </div>

            <nav className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                        AlphaClone
                    </Link>
                    <div className="flex items-center gap-6">
                        <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Login</Link>
                        <Button onClick={() => window.location.href = '/register'} className="bg-teal-500 text-slate-950 font-bold px-6">Get Started</Button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-24 relative">
                <div className="text-center mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 mb-6"
                    >
                        <Star className="w-4 h-4 text-teal-400 fill-teal-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">Enterprise Operating System</span>
                    </motion.div>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter">
                        Simple Pricing. <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">Infinite Possibilities.</span>
                    </h1>
                    <p className="text-slate-400 text-xl max-w-2xl mx-auto font-medium">
                        One platform. Every module. Choose the scale that fits your business roadmap.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -10 }}
                            className={`p-1 rounded-[2.5rem] bg-gradient-to-b ${plan.popular ? 'from-teal-500/50 via-teal-500/10 to-transparent shadow-2xl shadow-teal-500/10' : 'from-white/10 to-transparent'}`}
                        >
                            <div className="bg-slate-950 rounded-[2.25rem] p-10 h-full flex flex-col relative overflow-hidden">
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
                                        Best Value
                                    </div>
                                )}

                                <div className="mb-8">
                                    <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-teal-400' : 'text-white'}`}>{plan.name}</h3>
                                    <p className="text-slate-500 text-sm font-medium">{plan.desc}</p>
                                </div>

                                <div className="flex items-baseline gap-2 mb-10">
                                    <span className="text-6xl font-black text-white">${plan.price}</span>
                                    <span className="text-slate-600 font-bold uppercase tracking-widest text-xs">/ month</span>
                                </div>

                                <ul className="space-y-5 mb-12 flex-grow">
                                    {plan.features.map(feat => (
                                        <li key={feat} className="flex items-start gap-3">
                                            <div className={`mt-1 rounded-full p-0.5 ${plan.popular ? 'bg-teal-500/20' : 'bg-slate-800'}`}>
                                                <CheckCircle2 className={`w-4 h-4 ${plan.popular ? 'text-teal-400' : 'text-slate-500'}`} />
                                            </div>
                                            <span className="text-sm text-slate-300 font-medium leading-tight">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    onClick={() => plan.name === 'Enterprise' ? window.location.href = '/#contact' : window.location.href = '/register'}
                                    className={`w-full py-7 rounded-2xl font-black text-lg transition-all ${plan.popular
                                        ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-xl shadow-teal-500/20'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800'
                                        }`}
                                >
                                    {plan.cta}
                                </Button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* FAQ / Trust Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-y border-white/5">
                    {[
                        { icon: Shield, label: 'Secure Data' },
                        { icon: Zap, label: 'Instant Deploy' },
                        { icon: Globe, label: 'Global Access' },
                        { icon: MessageSquare, label: '24/7 Support' }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-3 grayscale opacity-30">
                            <item.icon className="w-8 h-8 text-white" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{item.label}</span>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="py-12 bg-slate-950 text-center">
                <p className="text-slate-600 text-xs font-medium uppercase tracking-[0.3em]">&copy; AlphaClone Systems - Build The Future</p>
            </footer>
        </div>
    );
}
