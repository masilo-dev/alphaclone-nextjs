'use client';

import {
    CheckCircle2,
    Target,
    Workflow,
    Award,
    TrendingUp,
    ShieldCheck,
    Video,
    ArrowRight,
    type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import AnimateIn from '@/components/common/AnimateIn';
import { WHO_WE_SERVE_HERO, WHO_WE_SERVE_SEGMENTS, type WhoWeServeSegment } from '@/config/marketingOutcomes';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';

const SEGMENT_ICONS: Record<WhoWeServeSegment['icon'], LucideIcon> = {
    target: Target,
    zap: Workflow,
    award: Award,
    trending: TrendingUp,
    shield: ShieldCheck,
    video: Video,
};

export default function WhoWeServePage() {
    return (
        <div className="min-h-screen bg-white text-[#07152f]">
            <div className="relative overflow-hidden">
                <section className="relative flex flex-col items-center justify-center pt-16 pb-14 px-4 sm:px-6">
                    <div className="relative z-10 max-w-4xl mx-auto text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-[#edf6ff] border border-[#d0e4ff] text-[#075fc7] type-caption font-bold uppercase tracking-wider">
                                <Workflow className="w-3.5 h-3.5 text-[#0878f9]" />
                                <span>{WHO_WE_SERVE_HERO.badge.toUpperCase()}</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-marketing-heading tracking-tight text-[#07152f] mb-6 leading-tight">
                                {WHO_WE_SERVE_HERO.headline} <br />
                                <span className="text-[#0878f9]">{WHO_WE_SERVE_HERO.headlineAccent}</span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-lg sm:text-xl text-[#52627b] mb-8 max-w-2xl mx-auto leading-relaxed">
                                {WHO_WE_SERVE_HERO.subhead}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <PrimaryCTA className="w-full sm:w-auto">Get started</PrimaryCTA>
                                <SecondaryCTA className="w-full sm:w-auto">Book a demo</SecondaryCTA>
                            </div>
                        </AnimateIn>
                    </div>
                </section>
            </div>

            <section className="py-14 px-4 sm:px-6 bg-[#f7f9fc] border-y border-[#dfe6ef]">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 max-w-2xl mx-auto">
                        <h2 className="text-2xl sm:text-3xl font-bold font-marketing-heading text-[#07152f] mb-3 tracking-tight">Same problem, different team shape</h2>
                        <p className="text-[#52627b] type-card-description leading-relaxed">
                            Each segment below starts with the business challenge — not a module list. See full before/after stories on{' '}
                            <Link href="/results" className="text-[#075fc7] hover:text-[#0878f9] font-semibold underline underline-offset-2">
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
                                    <article className="bg-white rounded-2xl p-6 sm:p-8 border border-[#dfe6ef] shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-12 h-12 bg-[#edf6ff] rounded-xl flex items-center justify-center border border-[#d0e4ff]">
                                                <Icon className="w-6 h-6 text-[#0878f9]" />
                                            </div>
                                            <h3 className="text-lg font-bold font-marketing-heading text-[#07152f] tracking-tight">{segment.title}</h3>
                                        </div>

                                        {segment.stackReplaced && (
                                            <div className="p-3 rounded-xl bg-[#f7f9fc] border border-[#e2e8f0] mb-4">
                                                <p className="type-caption font-bold text-[#76849a] uppercase tracking-wider mb-1">
                                                    Often replaces
                                                </p>
                                                <p className="type-card-description font-semibold text-[#102443]">{segment.stackReplaced}</p>
                                            </div>
                                        )}

                                        <p className="type-caption font-bold uppercase tracking-wider text-[#76849a] mb-2">Challenge</p>
                                        <p className="type-card-description text-[#52627b] leading-relaxed mb-5">{segment.challenge}</p>

                                        <p className="type-caption font-bold uppercase tracking-wider text-[#075fc7] mb-2">Outcomes</p>
                                        <ul className="space-y-2 flex-grow mb-4">
                                            {segment.outcomes.map((outcome) => (
                                                <li key={outcome} className="flex items-start gap-2 type-ui text-[#33445e]">
                                                    <CheckCircle2 className="w-4 h-4 text-[#0878f9] mt-0.5 flex-shrink-0" />
                                                    <span>{outcome}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {segment.resultsHref && (
                                            <Link
                                                href={segment.resultsHref}
                                                className="type-ui font-semibold text-[#075fc7] hover:text-[#0878f9] inline-flex items-center gap-1 mt-auto"
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

            <section className="py-20 px-4 sm:px-6 bg-white">
                <AnimateIn type="scaleIn">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl sm:text-4xl font-bold font-marketing-heading text-[#07152f] mb-4 tracking-tight">
                            See if your workflow fits — <span className="text-[#0878f9]">before you pay</span>
                        </h2>
                        <p className="text-base sm:text-lg text-[#52627b] mb-8 max-w-2xl mx-auto leading-relaxed">
                            Move one real client from lead to invoice in one connected execution workflow.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <PrimaryCTA className="w-full sm:w-auto">Get started</PrimaryCTA>
                            <SecondaryCTA className="w-full sm:w-auto">Book a demo</SecondaryCTA>
                        </div>
                        <p className="mt-6 type-caption font-bold text-[#76849a] uppercase tracking-caps">
                            Starter $15 · Pro $45 · Enterprise $80
                        </p>
                    </div>
                </AnimateIn>
            </section>

        </div>
    );
}
