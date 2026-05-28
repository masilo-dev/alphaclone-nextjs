'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Shield, Zap, Globe, MessageSquare, Star,
    ChevronDown, Users, Brain, FileText, DollarSign,
    Video, Calendar, Mail, BarChart3, Lock, X
} from 'lucide-react';
import dynamic from 'next/dynamic';
import PublicNavigation from '@/components/PublicNavigation';
import AnimateIn from '@/components/common/AnimateIn';
import MarketingFooter from '@/components/landing/MarketingFooter';

const HeroBackground = dynamic(() => import('@/components/landing/HeroBackground'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-950" />,
});

const plans = [
    {
        name: 'AlphaClone Platform',
        price: '15',
        users: 'Unlimited',
        desc: 'One complete platform plan for CRM, projects, social, finance, and operations.',
        highlight: true,
        color: 'teal',
        features: [
            'Unlimited team members',
            'Unified CRM Pipeline',
            'Automated Invoicing & P&L',
            'Contract Engine',
            'Unlimited Task & Project Boards',
            'Secure document storage',
            'Unified Gmail Integration',
            'Lead finder and outreach workspace',
            'Social publishing and scheduling',
            'Native 1-hour video meetings built into AlphaClone',
            'Email support',
        ],
        notIncluded: [],
        cta: 'Start 14-Day Free Trial',
        ctaLink: '/auth/login?register=true&type=freelancer&plan=starter',
    },
];

const replacedTools = [
    { icon: Brain, name: 'HubSpot CRM', cost: '$50/mo', replaced: 'CRM & Deals module' },
    { icon: Video, name: 'Zoom Pro', cost: '$15/mo', replaced: 'Native 1-hour video meetings' },
    { icon: FileText, name: 'DocuSign', cost: '$25/mo', replaced: 'Contract Engine' },
    { icon: DollarSign, name: 'Financial Software', cost: '$30/mo', replaced: 'Financial Suite' },
    { icon: Mail, name: 'Mailchimp', cost: '$20/mo', replaced: 'Comms & Email module' },
    { icon: Calendar, name: 'Calendly Pro', cost: '$12/mo', replaced: 'Calendar integration' },
    { icon: BarChart3, name: 'Asana', cost: '$25/mo', replaced: 'Task Management module' },
    { icon: Lock, name: 'PandaDoc', cost: '$49/mo', replaced: 'Contract Engine (e-sign)' },
    { icon: Globe, name: 'Intercom', cost: '$74/mo', replaced: 'AI Growth Agent' },
];

const faqs = [
    {
        q: 'Why did we build AlphaClone instead of another separate tool?',
        a: 'We built AlphaClone because small businesses were forced to run core operations across disconnected tools for CRM, email, contracts, billing, meetings, and reporting. That creates daily friction, duplicated work, and missed follow-ups. AlphaClone is designed as one native system so your team can operate from a single workspace.',
    },
    {
        q: 'How much money does software sprawl usually cost per year?',
        a: 'Most teams replace 7 to 9 subscriptions after moving to AlphaClone. Typical combined spend for those tools ranges from about $300 to $380 per month, which is roughly $3,600 to $4,560 per year. At $15 per month, AlphaClone is often a significant annual cost reduction.',
    },
    {
        q: 'What is included in the $15 plan?',
        a: 'The plan includes your full operating stack: CRM pipeline, outreach workflows, contracts, invoicing and finance views, native 1-hour video meetings, projects, documents, and core automations. You do not need separate plans to activate these core workflows.',
    },
    {
        q: 'Do I need a credit card to start?',
        a: 'No. You can start your 14-day trial without entering card details. You can test your full workflow first, then decide whether to activate paid billing.',
    },
    {
        q: 'Will my team struggle to switch from multiple tools?',
        a: 'The transition is designed to be practical. You can import contacts and client data, run outreach, and handle meetings and operations from one dashboard. Most teams are productive quickly because the system reduces handoffs rather than adding new complexity.',
    },
    {
        q: 'Is this really one connected system, or just bundled features?',
        a: 'It is one connected system. CRM records, communications, meetings, tasks, and financial operations share the same data layer, which removes duplicate entry and keeps your business context consistent across the platform.',
    },
    {
        q: 'What happens to my data if I cancel?',
        a: 'Your data is retained for 90 days after cancellation so you can export records or reactivate. After that retention window, data is permanently removed according to policy.',
    },
    {
        q: 'Is my business data secure?',
        a: 'Yes. AlphaClone uses enterprise-grade controls including encryption in transit and at rest, tenant isolation, role-based access, and audit logging to protect business data.',
    },
];

export default function PricingPageContent() {
    const [, setIsLoginOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <div className="min-h-screen page-network-bg text-slate-200 selection:bg-teal-500/30">
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
                        { '@type': 'Question', name: 'How much does AlphaClone cost?', acceptedAnswer: { '@type': 'Answer', text: 'AlphaClone has one public price of $15 per month and includes a 14-day free trial without a credit card.' } },
                        { '@type': 'Question', name: 'How much can software sprawl cost per year?', acceptedAnswer: { '@type': 'Answer', text: 'Many businesses spend about $300 to $380 per month across multiple tools, which can equal $3,600 to $4,560 per year.' } },
                        { '@type': 'Question', name: 'Does AlphaClone include built-in video meetings?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. AlphaClone includes native built-in 1-hour video meetings as part of the platform.' } },
                        { '@type': 'Question', name: 'Why was AlphaClone built?', acceptedAnswer: { '@type': 'Answer', text: 'AlphaClone was built to replace fragmented business software with one connected operating system for CRM, communication, finance, contracts, and operations.' } },
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
                        '@type': 'Offer',
                        'price': '15.00',
                        'priceCurrency': 'USD',
                        'url': 'https://alphaclonesystems.com/pricing',
                        'priceValidUntil': '2027-12-31',
                        'availability': 'https://schema.org/InStock'
                    }
                })
            }} />


            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <main className="relative overflow-hidden">
                {/* Pricing Hero Section */}
                <section className="relative min-h-[60vh] flex flex-col items-center justify-center pt-20">

                    
                    <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="inline-flex items-center gap-2 mb-8 ai-badge">
                                <Zap className="w-3.5 h-3.5 fill-teal-400" />
                                <span>THE UNIFIED OPERATING ENGINE</span>
                            </div>
                        </AnimateIn>
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-[0.9]">
                            Operational <br />
                            <span className="hero-metallic-text">Authority.</span>
                        </h1>
                        <p className="text-slate-400 text-2xl max-w-3xl mx-auto mb-6 font-medium tracking-tight">
                            One clear plan. One clear price. <br className="hidden md:block" />
                            Use the full AlphaClone platform for $15/month.
                        </p>
                        <div className="flex items-center justify-center gap-6 text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">
                            <span>• Zero Setup Fees</span>
                            <span>• Single Pricing</span>
                            <span>• Cancel Anytime</span>
                        </div>
                    </div>
                </section>

                <div className="max-w-7xl mx-auto px-4 pb-24 relative z-20">

                {/* Plan Cards */}
                <div className="grid grid-cols-1 gap-6 mb-16 max-w-2xl mx-auto">
                    {plans.map((plan, i) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ y: -6 }}
                            className={`p-px rounded-3xl ${plan.highlight
                                ? 'bg-gradient-to-b from-teal-500/60 via-teal-500/10 to-transparent shadow-2xl shadow-teal-500/15'
                                : 'bg-gradient-to-b from-white/8 to-transparent'
                                }`}
                        >
                            <div className="bg-slate-950 rounded-[calc(1.5rem-1px)] p-8 h-full flex flex-col relative overflow-hidden">
                                {plan.highlight && (
                                    <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-xs font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
                                        Most Popular
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h2 className={`text-xl font-bold mb-1 ${plan.highlight ? 'text-teal-400' : 'text-white'}`}>{plan.name}</h2>
                                    <p className="text-slate-500 text-xs leading-relaxed">{plan.desc}</p>
                                </div>

                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-5xl font-black text-white">${plan.price}</span>
                                    <span className="text-slate-600 font-bold text-xs uppercase tracking-wider">/ month</span>
                                </div>
                                <p className="text-xs text-slate-600 mb-8">
                                    <Users className="inline w-3 h-3 mr-1" /> Up to {plan.users} team members
                                </p>

                                <ul className="space-y-3 mb-8 flex-grow">
                                    {plan.features.map(feat => (
                                        <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-300">
                                            <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-teal-400' : 'text-slate-500'}`} />
                                            {feat}
                                        </li>
                                    ))}
                                    {plan.notIncluded.map(feat => (
                                        <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                                            <X className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-800" />
                                            {feat}
                                        </li>
                                    ))}
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
                        { icon: Shield, label: 'AES-256 Encryption', sub: 'Enterprise security on all plans' },
                        { icon: Zap, label: '< 30 Min Setup', sub: 'Onboarding guide included' },
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
                        <h2 className="text-3xl font-bold text-white mb-3">What AlphaClone Replaces</h2>
                        <p className="text-slate-400 max-w-xl mx-auto">The average AlphaClone customer retired <strong className="text-white">7–9 separate subscriptions</strong> within 30 days of switching. Here's what you'd pay for those tools individually:</p>
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
                                <span className="text-red-400 text-sm font-bold flex-shrink-0">{tool.cost}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Combined market cost</p>
                            <p className="text-3xl font-black text-red-400">$300–$380<span className="text-lg text-slate-500">/mo</span></p>
                        </div>
                        <div className="text-slate-600 text-2xl font-bold">vs</div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">AlphaClone Platform</p>
                            <p className="text-3xl font-black text-teal-400">$15<span className="text-lg text-slate-500">/mo</span></p>
                        </div>
                        <div className="px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                            <p className="text-xs text-teal-300 font-bold">Save up to ~$360/month</p>
                            <p className="text-xs text-slate-500">Up to ~$4,320 per year</p>
                        </div>
                    </div>
                </div>

                {/* FAQ */}
                <div className="max-w-3xl mx-auto mb-20">
                    <h2 className="text-3xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <div key={i} className="rounded-2xl border border-slate-800 overflow-hidden">
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-900/50 transition-colors"
                                >
                                    <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openFaq === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-slate-800/50 pt-4">
                                                {faq.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-center p-16 relative overflow-hidden rounded-3xl border border-white/[0.05] bg-slate-950">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-blue-500/5 -z-10" />
                    <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tighter">Ready to Deploy Your <span className="hero-metallic-text">OS?</span></h2>
                    <p className="text-slate-400 text-xl mb-12 max-w-xl mx-auto font-medium">
                        Join 500+ high-performance businesses. Deploy your 14-day free trial in under 60 seconds.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                        <Link
                            href="/auth/login?register=true&type=business&plan=starter"
                            className="cta-primary px-12 py-5 rounded-2xl text-lg w-full sm:w-auto text-center"
                        >
                            Start for $15/month
                        </Link>
                        <Link
                            href="/contact"
                            className="cta-secondary px-12 py-5 rounded-2xl text-lg w-full sm:w-auto text-center"
                        >
                            Contact Sales
                        </Link>
                    </div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-8">Secure • ISO/IEC 27001 Compliant Architecture • GDPR Ready</p>
                </div>
                <p className="text-xs text-slate-600 mt-8 text-center pb-8">No credit card required · Cancel anytime · 14-day free trial</p>
                </div>
            </main>
            <MarketingFooter />
        </div>
    );
}

