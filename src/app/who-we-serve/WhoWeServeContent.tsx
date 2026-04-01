'use client';

import React, { useState } from 'react';
import {
    CheckCircle2,
    Target,
    Zap,
    Award,
    TrendingUp,
    ShieldCheck,
    Video,
    ArrowRight,
    Sparkles,
    Shield,
    Workflow
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/UIComponents';
import LoginModal from '@/components/auth/LoginModal';
import { User } from '@/types';
import PublicNavigation from '@/components/PublicNavigation';
import AnimateIn from '@/components/common/AnimateIn';
import MarketingFooter from '@/components/landing/MarketingFooter';

const HeroBackground = dynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

export default function WhoWeServePage() {
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    const handleLogin = (user: User) => {
        setIsLoginOpen(false);
        window.location.href = '/dashboard';
    };

    return (
        <div className="min-h-screen bg-transparent text-slate-200">
            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onLogin={handleLogin}
            />

            {/* Header */}
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            {/* Hero Section */}
            <div className="pt-20 relative overflow-hidden">
                <section className="relative min-h-[60vh] flex flex-col items-center justify-center pt-24 pb-20 px-4">
                    <div className="absolute inset-0 z-0">
                        <HeroBackground />
                    </div>

                    <div className="relative z-10 max-w-4xl mx-auto text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-8 ai-badge">
                                <Workflow className="w-3.5 h-3.5 text-teal-400" />
                                <span>TARGET ARCHITECTURES</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter leading-[0.95]">
                                Engineered for <br />
                                <span className="hero-metallic-text">High-Performance Teams</span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                                AlphaClone isn't just a tool—it's the operating layer for teams who have outgrown fragmented SaaS and need a unified, high-authority system.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                                <Button
                                    onClick={() => window.open('https://calendly.com/bonnie-alphaclone-systems/30min', '_blank')}
                                    className="bg-transparent text-white border-white/20 hover:border-teal-500 font-bold px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover"
                                >
                                    <span className="relative z-10">Book Strategy Call</span>
                                </Button>
                                <Button
                                    onClick={() => setIsLoginOpen(true)}
                                    className="bg-teal-500 text-slate-950 font-bold px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover"
                                >
                                    <span className="relative z-10">Start Free Trial</span>
                                </Button>
                            </div>
                        </AnimateIn>
                    </div>
                </section>
            </div>

            {/* Customer Segments */}
            <section className="py-16 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimateIn type="stagger" index={0}>
                            <div className="glass-card rounded-3xl p-8 border-white/[0.03] transition-all hover:scale-[1.02] flex flex-col h-full group">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                                        <Target className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">Growth Agencies</h3>
                                </div>
                                <div className="space-y-6 flex-grow">
                                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Replaces</p>
                                        <p className="text-sm font-bold text-white">HubSpot + ClickUp + DocuSign</p>
                                    </div>
                                    <p className="text-slate-400 leading-relaxed text-sm">Managing clients across silos kills your margin. AlphaClone provides a single multi-tenant architecture for unlimited clients and high-velocity delivery.</p>
                                    <div className="space-y-3">
                                        <p className="text-xs font-black text-teal-400 uppercase tracking-widest">Core Impact:</p>
                                        <ul className="text-sm text-slate-300 space-y-2">
                                            <li className="flex items-start gap-3">
                                                <CheckCircle2 className="w-4 h-4 text-teal-400 mt-1 flex-shrink-0" />
                                                <span>Integrated white-label client portals</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle2 className="w-4 h-4 text-teal-400 mt-1 flex-shrink-0" />
                                                <span>Unified project & revenue tracking</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>

                        <AnimateIn type="stagger" index={1}>
                            <div className="glass-card rounded-3xl p-8 border-white/[0.03] transition-all hover:scale-[1.02] flex flex-col h-full group">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-slate-950 transition-all">
                                        <Zap className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white tracking-tight">SaaS Startups</h3>
                                </div>
                                <div className="space-y-6 flex-grow">
                                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Replaces</p>
                                        <p className="text-sm font-bold text-white">Zoom + Slack + Pandadoc</p>
                                    </div>
                                    <p className="text-slate-400 leading-relaxed text-sm">Stop burning cash on 10+ subscriptions. Build on a unified infrastructure with built-in CRM, HD video, and AI-powered outreach.</p>
                                    <div className="space-y-3">
                                        <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Core Impact:</p>
                                        <ul className="text-sm text-slate-300 space-y-2">
                                            <li className="flex items-start gap-3">
                                                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                                                <span>Autonomous AI Growth Agent</span>
                                            </li>
                                            <li className="flex items-start gap-3">
                                                <CheckCircle2 className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" />
                                                <span>Integrated contract & legal suite</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>

                        {/* Consulting Firms */}
                        <AnimateIn type="stagger" index={2}>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all group backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                        <Award className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Consulting Firms</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                        <p className="text-sm text-slate-400">Need professional client management, secure video meetings, and project tracking without the complexity of enterprise software.</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-purple-400 mb-2">How We Help:</p>
                                        <ul className="text-sm text-slate-400 space-y-1">
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                                <span>Professional client portals</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                                <span>Integrated video conferencing</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                                <span>Time tracking & invoicing</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>

                        {/* Emerging Market Founders */}
                        <AnimateIn type="stagger" index={3}>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all group backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-orange-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Emerging Market Founders</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                        <p className="text-sm text-slate-400">Enterprise tools price you out. Need world-class features at prices that make sense for your market.</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-orange-400 mb-2">How We Help:</p>
                                        <ul className="text-sm text-slate-400 space-y-1">
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                                <span>Affordable all-in-one pricing</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                                <span>No hidden fees or per-seat charges</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                                <span>Full feature access from day one</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>

                        {/* Privacy-First Teams */}
                        <AnimateIn type="stagger" index={4}>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-green-500/50 transition-all group backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                                        <ShieldCheck className="w-6 h-6 text-green-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Privacy-First Teams</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                        <p className="text-sm text-slate-400">Can&apos;t trust third-party SaaS with sensitive data. Need full control over where your data lives.</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-green-400 mb-2">How We Help:</p>
                                        <ul className="text-sm text-slate-400 space-y-1">
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span>Self-hostable on your infrastructure</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span>Open-source transparency</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span>Complete data ownership</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>

                        {/* Remote Teams */}
                        <AnimateIn type="stagger" index={5}>
                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-cyan-500/50 transition-all group backdrop-blur-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                                        <Video className="w-6 h-6 text-cyan-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Remote Teams</h3>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                        <p className="text-sm text-slate-400">Scattered across multiple platforms. Need everything in one place to stay aligned.</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-cyan-400 mb-2">How We Help:</p>
                                        <ul className="text-sm text-slate-400 space-y-1">
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                                <span>Built-in video conferencing</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                                <span>Real-time collaboration tools</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                                                <span>Unified communication hub</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </AnimateIn>
                    </div>
                </div>
            </section>

            <section className="py-32 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-teal-500/5 to-transparent -z-10" />
                <AnimateIn type="scaleIn">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter">
                            Ready for <span className="hero-metallic-text">Unified Control?</span>
                        </h2>
                        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            Join 500+ high-performance teams running smarter on AlphaClone. Deploy your 14-day free trial in under 60 seconds.
                        </p>
                         <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <Button
                                onClick={() => window.open('https://calendly.com/bonnie-alphaclone-systems/30min', '_blank')}
                                className="bg-transparent text-white border-white/20 hover:border-teal-500 font-bold px-12 py-5 h-auto text-xl rounded-2xl button-fill-hover"
                            >
                                <span className="relative z-10">Book Strategy Call</span>
                            </Button>
                            <Button
                                onClick={() => setIsLoginOpen(true)}
                                className="bg-teal-500 text-slate-950 font-bold px-12 py-5 h-auto text-xl rounded-2xl button-fill-hover"
                            >
                                <span className="relative z-10">Start Free Trial</span>
                            </Button>
                        </div>
                        <p className="mt-8 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                            No Credit Card • No Lock-in • Universal Access
                        </p>
                    </div>
                </AnimateIn>
            </section>

            <MarketingFooter />
        </div>
    );
}

