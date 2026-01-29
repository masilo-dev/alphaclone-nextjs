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
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import LoginModal from '@/components/auth/LoginModal';
import { User } from '@/types';
import Link from 'next/link';

export default function WhoWeServePage() {
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    const handleLogin = (user: User) => {
        setIsLoginOpen(false);
        window.location.href = '/dashboard';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onLogin={handleLogin}
            />

            {/* Header */}
            <header className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
                                AlphaClone
                            </span>
                        </Link>
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                Back to Home
                            </Link>
                            <Button onClick={() => setIsLoginOpen(true)} className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold px-6">
                                Sign Up
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                        Who We Serve
                    </h1>
                    <p className="text-xl text-slate-400 mb-8">
                        AlphaClone is built for teams who are tired of juggling multiple tools and want a unified system that just works.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={() => window.open('https://calendly.com/alphaclonesystems/new-meeting', '_blank')}
                            size="lg"
                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8 h-12 w-full sm:w-auto"
                        >
                            Book Free Consultation
                        </Button>
                        <Button
                            size="lg"
                            onClick={() => setIsLoginOpen(true)}
                            className="border-slate-700 bg-slate-900/50 backdrop-blur hover:bg-slate-800 text-white px-8 h-12 w-full sm:w-auto"
                        >
                            Start for Free
                        </Button>
                    </div>
                </div>
            </section>

            {/* Customer Segments */}
            <section className="py-16 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Growing Agencies */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-teal-500/50 transition-all group backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center">
                                    <Target className="w-6 h-6 text-teal-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Growing Agencies</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                    <p className="text-sm text-slate-400">Managing multiple clients across different tools, losing time switching contexts, and struggling with expensive per-seat pricing.</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-teal-400 mb-2">How We Help:</p>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                            <span>Multi-tenant architecture for unlimited clients</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                            <span>Unified dashboard for all client projects</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                            <span>White-label client portals</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* SaaS Startups */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group backdrop-blur-md">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                    <Zap className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white">SaaS Startups</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-300 mb-2">Your Challenge:</p>
                                    <p className="text-sm text-slate-400">Burning cash on 10+ SaaS subscriptions while trying to reach profitability. Need enterprise features without enterprise costs.</p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-blue-400 mb-2">How We Help:</p>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <span>Replace $2,000+/mo in subscriptions</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <span>Built-in CRM, video calls, and AI agents</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <span>Self-hostable for data control</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Consulting Firms */}
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

                        {/* Emerging Market Founders */}
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

                        {/* Privacy-First Teams */}
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

                        {/* Remote Teams */}
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
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Don&apos;t See Yourself Here?
                    </h2>
                    <p className="text-xl text-slate-400 mb-8">
                        We work with all types of businesses. Let's discuss how AlphaClone can help you consolidate your tools and reduce costs.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            onClick={() => window.open('https://calendly.com/alphaclonesystems/new-meeting', '_blank')}
                            size="lg"
                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-8 h-12 w-full sm:w-auto"
                        >
                            Book Free Consultation
                        </Button>
                        <Button
                            size="lg"
                            onClick={() => setIsLoginOpen(true)}
                            className="border-slate-700 bg-slate-900/50 backdrop-blur hover:bg-slate-800 text-white px-8 h-12 w-full sm:w-auto"
                        >
                            Start for Free
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8 px-4">
                <div className="max-w-7xl mx-auto text-center text-slate-500 text-sm">
                    <p>&copy; 2026 AlphaClone Systems. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
