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
    Workflow,
    type LucideIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/UIComponents';
import LoginModal from '@/components/auth/LoginModal';
import { User } from '@/types';
import PublicNavigation from '@/components/PublicNavigation';
import AnimateIn from '@/components/common/AnimateIn';
import MarketingFooter from '@/components/landing/MarketingFooter';
import MarketingMobileCtaBar from '@/components/marketing/MarketingMobileCtaBar';
import { WHO_WE_SERVE_HERO, WHO_WE_SERVE_SEGMENTS, type WhoWeServeSegment } from '@/config/marketingOutcomes';

const HeroBackground = dynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const SEGMENT_ICONS: Record<WhoWeServeSegment['icon'], LucideIcon> = {
    target: Target,
    zap: Zap,
    award: Award,
    trending: TrendingUp,
    shield: ShieldCheck,
    video: Video,
};

const SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';

export default function WhoWeServePage() {
    const [isLoginOpen, setIsLoginOpen] = useState(false);

    const handleLogin = (user: User) => {
        setIsLoginOpen(false);
        window.location.href = '/dashboard';
    };

    return (
        <div className="min-h-screen page-network-bg text-slate-200 pb-24 lg:pb-0">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <HeroBackground />
            </div>

            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onLogin={handleLogin}
            />

            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <div className="pt-20 relative overflow-hidden">
                <section className="relative min-h-[55vh] flex flex-col items-center justify-center pt-24 pb-16 px-4">
                    <div className="relative z-10 max-w-4xl mx-auto text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-8 ai-badge">
                                <Workflow className="w-3.5 h-3.5 text-teal-400" />
                                <span>{WHO_WE_SERVE_HERO.badge.toUpperCase()}</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tighter leading-[0.95]">
                                {WHO_WE_SERVE_HERO.headline} <br />
                                <span className="hero-metallic-text">{WHO_WE_SERVE_HERO.headlineAccent}</span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                                {WHO_WE_SERVE_HERO.subhead}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href={SIGNUP_HREF}>
                                    <Button className="bg-teal-500 text-slate-950 font-bold px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover">
                                        <span className="relative z-10">Start 14-day trial</span>
                                    </Button>
                                </Link>
                                <Link href="/results">
                                    <Button
                                        variant="outline"
                                        className="px-10 py-5 h-auto text-lg rounded-2xl button-fill-hover border-slate-700"
                                    >
                                        <span className="relative z-10 inline-flex items-center gap-2">
                                            Read workflow stories
                                            <ArrowRight className="w-4 h-4" />
                                        </span>
                                    </Button>
                                </Link>
                            </div>
                        </AnimateIn>
                    </div>
                </section>
            </div>

            <section className="py-16 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 max-w-2xl mx-auto">
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Same problem, different team shape</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Each segment below starts with the business challenge — not a module list. See full before/after stories on{' '}
                            <Link href="/results" className="text-teal-400 hover:text-teal-300 font-semibold">
                                /results
                            </Link>
                            .
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {WHO_WE_SERVE_SEGMENTS.map((segment, index) => {
                            const Icon = SEGMENT_ICONS[segment.icon];
                            return (
                                <AnimateIn key={segment.id} type="stagger" index={index}>
                                    <article className="glass-card rounded-2xl p-6 sm:p-8 border-white/[0.03] h-full flex flex-col">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20">
                                                <Icon className="w-6 h-6 text-teal-400" />
                                            </div>
                                            <h3 className="text-lg font-black text-white tracking-tight">{segment.title}</h3>
                                        </div>

                                        {segment.stackReplaced && (
                                            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                                    Often replaces
                                                </p>
                                                <p className="text-sm font-semibold text-slate-200">{segment.stackReplaced}</p>
                                            </div>
                                        )}

                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Challenge</p>
                                        <p className="text-sm text-slate-400 leading-relaxed mb-5">{segment.challenge}</p>

                                        <p className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">Outcomes</p>
                                        <ul className="space-y-2 flex-grow mb-4">
                                            {segment.outcomes.map((outcome) => (
                                                <li key={outcome} className="flex items-start gap-2 text-sm text-slate-300">
                                                    <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                                    <span>{outcome}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {segment.resultsHref && (
                                            <Link
                                                href={segment.resultsHref}
                                                className="text-sm font-semibold text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 mt-auto"
                                            >
                                                Related story
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        )}
                                    </article>
                                </AnimateIn>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-teal-500/5 to-transparent -z-10" />
                <AnimateIn type="scaleIn">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tighter">
                            See if your workflow fits — <span className="hero-metallic-text">before you pay</span>
                        </h2>
                        <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Move one real client from lead to invoice in a 14-day trial. No card required.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href={SIGNUP_HREF}>
                                <Button className="bg-teal-500 text-slate-950 font-bold px-12 py-5 h-auto text-lg rounded-2xl button-fill-hover">
                                    <span className="relative z-10">Start free trial</span>
                                </Button>
                            </Link>
                            <Link href="/book-demo">
                                <Button
                                    variant="outline"
                                    className="px-12 py-5 h-auto text-lg rounded-2xl button-fill-hover border-slate-700"
                                >
                                    <span className="relative z-10">Book a demo</span>
                                </Button>
                            </Link>
                        </div>
                        <p className="mt-8 text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
                            14-day trial · No credit card · Cancel anytime
                        </p>
                    </div>
                </AnimateIn>
            </section>

            <MarketingFooter />
            <MarketingMobileCtaBar />
        </div>
    );
}
