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
import { useLanguage } from '@/contexts/LanguageContext';

const SEGMENT_ICONS: Record<WhoWeServeSegment['icon'], LucideIcon> = {
    target: Target,
    zap: Workflow,
    award: Award,
    trending: TrendingUp,
    shield: ShieldCheck,
    video: Video,
};

export default function WhoWeServePage() {
    const { t } = useLanguage();
    return (
        <div className="min-h-screen bg-white text-[var(--marketing-ink)]">
            <div className="relative overflow-hidden">
                <section className="relative flex flex-col items-center justify-center pt-16 pb-14 px-4 sm:px-6">
                    <div className="relative z-10 max-w-4xl mx-auto text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-[var(--brand-blue-50)] border border-[var(--brand-blue-100)] text-[var(--marketing-link-hover)] type-caption font-bold uppercase tracking-wider">
                                <Workflow className="w-3.5 h-3.5 text-[var(--marketing-link)]" />
                                <span>{t(WHO_WE_SERVE_HERO.badge).toUpperCase()}</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-marketing-heading tracking-tight text-[var(--marketing-ink)] mb-6 leading-tight">
                                {t(WHO_WE_SERVE_HERO.headline)} <br />
                                <span className="text-[var(--marketing-link)]">{t(WHO_WE_SERVE_HERO.headlineAccent)}</span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-lg sm:text-xl text-[var(--marketing-muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
                                {t(WHO_WE_SERVE_HERO.subhead)}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <PrimaryCTA className="w-full sm:w-auto">{t('Get started')}</PrimaryCTA>
                                <SecondaryCTA className="w-full sm:w-auto">{t('Book a demo')}</SecondaryCTA>
                            </div>
                        </AnimateIn>
                    </div>
                </section>
            </div>

            <section className="py-14 px-4 sm:px-6 bg-[var(--marketing-bg-secondary)] border-y border-[var(--marketing-border)]">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 max-w-2xl mx-auto">
                        <h2 className="text-2xl sm:text-3xl font-bold font-marketing-heading text-[var(--marketing-ink)] mb-3 tracking-tight">{t('Same problem, different team shape')}</h2>
                        <p className="text-[var(--marketing-muted)] type-card-description leading-relaxed">
                            {t('Each segment below starts with the business challenge — not a module list. See full before/after stories on')}{' '}
                            <Link href="/results" className="text-[var(--marketing-link-hover)] hover:text-[var(--marketing-link)] font-semibold underline underline-offset-2">
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
                                    <article className="bg-white rounded-2xl p-6 sm:p-8 border border-[var(--marketing-border)] shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-12 h-12 bg-[var(--brand-blue-50)] rounded-xl flex items-center justify-center border border-[var(--brand-blue-100)]">
                                                <Icon className="w-6 h-6 text-[var(--marketing-link)]" />
                                            </div>
                                            <h3 className="text-lg font-bold font-marketing-heading text-[var(--marketing-ink)] tracking-tight">{t(segment.title)}</h3>
                                        </div>

                                        {segment.stackReplaced && (
                                            <div className="p-3 rounded-xl bg-[var(--marketing-bg-secondary)] border border-[var(--ws-border)] mb-4">
                                                <p className="type-caption font-bold text-[var(--marketing-muted-strong)] uppercase tracking-wider mb-1">
                                                {t('Often replaces')}
                                                </p>
                                                <p className="type-card-description font-semibold text-[var(--marketing-ink-secondary)]">{t(segment.stackReplaced)}</p>
                                            </div>
                                        )}

                                        <p className="type-caption font-bold uppercase tracking-wider text-[var(--marketing-muted-strong)] mb-2">{t('Challenge')}</p>
                                        <p className="type-card-description text-[var(--marketing-muted)] leading-relaxed mb-5">{t(segment.challenge)}</p>

                                        <p className="type-caption font-bold uppercase tracking-wider text-[var(--marketing-link-hover)] mb-2">{t('Outcomes')}</p>
                                        <ul className="space-y-2 flex-grow mb-4">
                                            {segment.outcomes.map((outcome) => (
                                                <li key={outcome} className="flex items-start gap-2 type-ui text-[var(--marketing-text-secondary)]">
                                                    <CheckCircle2 className="w-4 h-4 text-[var(--marketing-link)] mt-0.5 flex-shrink-0" />
                                                    <span>{t(outcome)}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        {segment.resultsHref && (
                                            <Link
                                                href={segment.resultsHref}
                                                className="type-ui font-semibold text-[var(--marketing-link-hover)] hover:text-[var(--marketing-link)] inline-flex items-center gap-1 mt-auto"
                                            >
                                                {t('Related story')}
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
                        <h2 className="text-3xl sm:text-4xl font-bold font-marketing-heading text-[var(--marketing-ink)] mb-4 tracking-tight">
                            {t('See if your workflow fits')} — <span className="text-[var(--marketing-link)]">{t('before you pay')}</span>
                        </h2>
                        <p className="text-base sm:text-lg text-[var(--marketing-muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
                            {t('Move one real client from lead to invoice in one connected execution workflow.')}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <PrimaryCTA className="w-full sm:w-auto">{t('Get started')}</PrimaryCTA>
                            <SecondaryCTA className="w-full sm:w-auto">{t('Book a demo')}</SecondaryCTA>
                        </div>
                        <p className="mt-6 type-caption font-bold text-[var(--marketing-muted-strong)] uppercase tracking-caps">
                            Starter $15 · Pro $45 · Enterprise $85
                        </p>
                    </div>
                </AnimateIn>
            </section>

        </div>
    );
}
