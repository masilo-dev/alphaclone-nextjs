'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    CheckCircle2, Shield, Zap, Globe, MessageSquare,
    Brain, FileText, DollarSign,
    Video, Calendar, Mail, BarChart3, Lock
} from 'lucide-react';
import dynamic from 'next/dynamic';
import PublicNavigation from '@/components/PublicNavigation';
import AnimateIn from '@/components/common/AnimateIn';
import MarketingFooter from '@/components/landing/MarketingFooter';
import MarketingMobileCtaBar from '@/components/marketing/MarketingMobileCtaBar';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import { PUBLIC_PRICING_PLANS, PRICING_FROM } from '@/config/pricingPlans';
import { PRICING_OUTCOME_HERO } from '@/config/marketingOutcomes';

const HeroBackground = dynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const plans = PUBLIC_PRICING_PLANS;

const replacedTools = [
    { icon: Brain, name: 'CRM software', replaced: 'CRM & Deals module' },
    { icon: Video, name: 'Video meetings', replaced: 'Native 1-hour video meetings' },
    { icon: FileText, name: 'E-signature tools', replaced: 'Contract Engine' },
    { icon: DollarSign, name: 'Financial software', replaced: 'Financial Suite' },
    { icon: Mail, name: 'Email campaign tools', replaced: 'Comms & Email module' },
    { icon: Calendar, name: 'Scheduling tools', replaced: 'Calendar integration' },
    { icon: BarChart3, name: 'Task management tools', replaced: 'Task Management module' },
    { icon: Lock, name: 'Proposal tools', replaced: 'Contract Engine (e-sign)' },
    { icon: Globe, name: 'Lead operations tools', replaced: 'AI Growth Agent' },
];

const faqs = [
    {
        question: 'Why did we build AlphaClone instead of another separate tool?',
        answer:
            'We built AlphaClone because small businesses were forced to run core operations across disconnected tools for CRM, email, contracts, billing, meetings, and reporting. That creates daily friction, duplicated work, and missed follow-ups. AlphaClone is designed as one native system so your team can operate from a single workspace.',
    },
    {
        question: 'How much money does software sprawl usually cost per year?',
        answer:
            'Costs vary by stack. AlphaClone is priced to consolidate common workflows like CRM, finance, contracts, meetings, projects, and outreach into one $15/month starter workspace.',
    },
    {
        question: 'What is included, and how do the plans differ?',
        answer:
            'Every plan includes the full operating stack: CRM pipeline, outreach, contracts, invoicing and finance, native 1-hour video meetings, projects, documents, and core automations. Starter ($15/mo) covers up to 25 team members and 25GB storage. Pro ($45/mo) unlocks unlimited members, the Bonnie AI sales assistant, API access, and a custom domain. Enterprise ($80/mo) adds 500GB storage, advanced AI limits, and priority infrastructure.',
    },
    {
        question: 'Do I need a credit card to start?',
        answer:
            'No. You can start your 14-day trial without entering card details. You can test your full workflow first, then decide whether to activate paid billing.',
    },
    {
        question: 'Will my team struggle to switch from multiple tools?',
        answer:
            'The transition is designed to be practical. You can import contacts and client data, run outreach, and handle meetings and operations from one dashboard.',
    },
    {
        question: 'Is this really one connected system, or just bundled features?',
        answer:
            'It is one connected system. CRM records, communications, meetings, tasks, and financial operations share the same data layer, which removes duplicate entry and keeps your business context consistent across the platform.',
    },
    {
        question: 'What happens to my data if I cancel?',
        answer:
            'Your data is retained for 90 days after cancellation so you can export records or reactivate. After that retention window, data is permanently removed according to policy.',
    },
    {
        question: 'Is my business data secure?',
        answer:
            'AlphaClone uses controls including encryption in transit and at rest, tenant isolation, role-based access, and audit logging to protect business data.',
    },
];

export default function PricingPageContent() {
    const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

    return (
        <div className="min-h-screen page-network-bg marketing-theme text-slate-200 selection:bg-teal-500/30 pb-24 lg:pb-0">
            {/* Persistent full-page animated network background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <HeroBackground />
            </div>
            {/* JSON-LD Schemas */}
            <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'FAQPage',
                    mainEntity: [
                        { '@type': 'Question', name: 'How much does AlphaClone cost?', acceptedAnswer: { '@type': 'Answer', text: 'AlphaClone starts at $15/month (Starter), with Pro at $45/month and Enterprise at $80/month. Every plan includes a 14-day free trial without a credit card.' } },
                        { '@type': 'Question', name: 'How much can software sprawl cost per year?', acceptedAnswer: { '@type': 'Answer', text: 'Costs vary by stack. AlphaClone consolidates common workflows like CRM, finance, contracts, meetings, projects, and outreach into one $15/month starter workspace.' } },
                        { '@type': 'Question', name: 'Does AlphaClone include built-in video meetings?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. AlphaClone includes native built-in 1-hour video meetings as part of the platform.' } },
                        { '@type': 'Question', name: 'Why was AlphaClone built?', acceptedAnswer: { '@type': 'Answer', text: 'AlphaClone was built to reduce fragmented business software by connecting CRM, communication, finance, contracts, and operations in one workspace.' } },
                    ]
                })
            }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclonesystems.com' },
                        { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://alphaclonesystems.com/pricing' },
                    ]
                })
            }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    'name': 'AlphaClone Business OS',
                    'image': 'https://alphaclonesystems.com/favicon.ico',
                    'description': 'Unified business operating platform for service businesses with CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations.',
                    'brand': {
                        '@type': 'Brand',
                        'name': 'AlphaClone'
                    },
                    'offers': {
                        '@type': 'AggregateOffer',
                        'priceCurrency': 'USD',
                        'lowPrice': '15.00',
                        'highPrice': '80.00',
                        'offerCount': 3,
                        'url': 'https://alphaclonesystems.com/pricing',
                        'priceValidUntil': '2027-12-31',
                        'availability': 'https://schema.org/InStock'
                    }
                })
            }} />


            <PublicNavigation onLoginClick={() => {}} />

            <main className="relative overflow-hidden">
                {/* Pricing Hero Section */}
                <section className="relative min-h-[60vh] flex flex-col items-center justify-center pt-20">

                    
                    <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-8 ai-badge">
                                <Zap className="w-3.5 h-3.5 fill-teal-400" />
                                <span>{PRICING_OUTCOME_HERO.badge.toUpperCase()}</span>
                            </div>
                        </AnimateIn>
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-[0.9]">
                            {PRICING_OUTCOME_HERO.headline} <br />
                            <span className="hero-metallic-text">{PRICING_OUTCOME_HERO.headlineAccent}</span>
                        </h1>
                        <p className="text-slate-400 text-xl sm:text-2xl max-w-3xl mx-auto mb-6 font-medium tracking-tight leading-relaxed">
                            {PRICING_OUTCOME_HERO.subhead}
                        </p>
                        <p className="text-slate-500 text-base max-w-2xl mx-auto mb-6">
                            Plans from ${PRICING_FROM}/month · every tier includes CRM, billing, contracts, meetings, and core automations.
                        </p>
                        <div className="flex items-center justify-center gap-6 text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">
                            <span>• Zero Setup Fees</span>
                            <span>• 14-Day Free Trial</span>
                            <span>• Cancel Anytime</span>
                        </div>
                    </div>
                </section>

                <div className="max-w-7xl mx-auto px-4 pb-24 relative z-20">

                <MarketingPricingToggle
                    value={billingPeriod}
                    onChange={setBillingPeriod}
                    className="mb-10 flex justify-center"
                />

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-6xl mx-auto items-stretch">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -6 }}
                            className={`p-px rounded-3xl ${plan.highlight
                                ? 'bg-gradient-to-b from-teal-500/60 via-teal-500/10 to-transparent shadow-2xl shadow-teal-500/15 md:-mt-4'
                                : 'bg-gradient-to-b from-white/8 to-transparent'
                                }`}
                        >
                            <div className="bg-slate-950 rounded-[calc(1.5rem-1px)] p-8 h-full flex flex-col relative overflow-hidden">
                                {plan.badge && (
                                    <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-xs font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
                                        {plan.badge}
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h2 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-teal-400' : 'text-white'}`}>{plan.name}</h2>
                                    <p className="text-slate-500 text-xs leading-relaxed">{plan.tagline}</p>
                                </div>

                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-5xl font-black text-white">
                                        ${billingPeriod === 'monthly' ? plan.price : plan.yearly}
                                    </span>
                                    <span className="text-slate-600 font-bold text-xs uppercase tracking-wider">
                                        / {billingPeriod === 'monthly' ? 'month' : 'year'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mb-8">
                                    {billingPeriod === 'monthly'
                                        ? `or $${plan.yearly}/year — save ${Math.round((1 - plan.yearly / (plan.price * 12)) * 100)}%`
                                        : `$${Math.round(plan.yearly / 12)}/mo equivalent · save ${Math.round((1 - plan.yearly / (plan.price * 12)) * 100)}% vs monthly`}
                                </p>

                                <ul className="space-y-3 mb-8 flex-grow">
                                    {plan.features.map(feat => {
                                        const isHeader = feat.endsWith('plus:');
                                        return (
                                            <li key={feat} className={`flex items-start gap-2.5 text-sm ${isHeader ? 'text-slate-400 font-semibold' : 'text-slate-300'}`}>
                                                {!isHeader && <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-teal-400' : 'text-slate-500'}`} />}
                                                {feat}
                                            </li>
                                        );
                                    })}
                                </ul>

                                <Link
                                    href={plan.ctaLink}
                                    className={`block text-center py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${plan.highlight
                                        ? 'cta-primary'
                                        : 'cta-secondary'
                                        }`}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Trust indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-12 border-y border-slate-800 mb-20">
                    {[
                        { icon: Shield, label: 'Encrypted Data', sub: 'Security controls on all plans' },
                        { icon: Zap, label: 'Guided Setup', sub: 'Onboarding guide included' },
                        { icon: Globe, label: 'Global Access', sub: 'Works from any device, anywhere' },
                        { icon: MessageSquare, label: '14-Day Free Trial', sub: 'No credit card required' },
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center text-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 flex items-center justify-center">
                                <item.icon className="w-5 h-5 text-teal-400" />
                            </div>
                            <p className="text-sm font-bold text-white">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Value: Tools Replaced */}
                <div className="mb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-3">What AlphaClone Consolidates</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">AlphaClone brings common operating workflows into one workspace, so teams can reduce tool switching and keep business context connected.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        {replacedTools.map((tool, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                                    <tool.icon className="w-5 h-5 text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">{tool.name}</p>
                                    <p className="text-slate-500 text-xs">{tool.replaced}</p>
                                </div>
                                <span className="text-red-400 text-xs font-bold flex-shrink-0">Separate tool</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Separate stack</p>
                            <p className="text-3xl font-black text-red-400">Varies<span className="text-lg text-slate-500"> by team</span></p>
                        </div>
                        <div className="text-slate-600 text-2xl font-bold">vs</div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">AlphaClone Platform</p>
                            <p className="text-3xl font-black text-teal-400">from $15<span className="text-lg text-slate-500">/mo</span></p>
                        </div>
                        <div className="px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                            <p className="text-xs text-teal-300 font-bold">Consolidate common workflows</p>
                            <p className="text-xs text-slate-500">Compare against your current stack</p>
                        </div>
                    </div>
                </div>

                {/* FAQ */}
                <div className="max-w-3xl mx-auto mb-20">
                    <h2 className="font-marketing-heading text-3xl font-bold text-white text-center mb-10">
                        Frequently Asked Questions
                    </h2>
                    <MarketingFaqAccordion items={faqs} />
                </div>

                <div className="text-center p-16 relative overflow-hidden rounded-3xl border border-white/[0.05] bg-slate-950">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-blue-500/5 -z-10" />
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter">Ready to run clients on <span className="hero-metallic-text">one system?</span></h2>
                    <p className="text-slate-400 text-xl mb-12 max-w-xl mx-auto font-medium">
                        Start a 14-day trial. Move a real lead through pipeline, delivery, and billing — then decide.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                        <Link
                            href="/auth/login?register=true&type=business&plan=starter"
                            className="cta-primary px-12 py-5 rounded-2xl text-lg w-full sm:w-auto text-center"
                        >
                            Start 14-day free trial
                        </Link>
                        <Link
                            href="/contact"
                            className="cta-secondary px-12 py-5 rounded-2xl text-lg w-full sm:w-auto text-center"
                        >
                            Contact Sales
                        </Link>
                    </div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-8">Security controls • Public policies • GDPR data rights support</p>
                </div>
                <p className="text-xs text-slate-600 mt-8 text-center pb-8">No credit card required · Cancel anytime · 14-day free trial</p>
                </div>
            </main>
            <MarketingFooter />
            <MarketingMobileCtaBar />
        </div>
    );
}
