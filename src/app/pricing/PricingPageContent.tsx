'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Shield, Zap, Globe, MessageSquare, Star,
    ChevronDown, ArrowRight, Users, Brain, FileText, DollarSign,
    Video, Calendar, Mail, BarChart3, Lock, X, Minus
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
        name: 'Solo Professional',
        price: '15',
        users: '1',
        desc: 'The complete Unified OS for solo operators and independent professionals.',
        highlight: false,
        color: 'slate',
        features: [
            '1 Professional Seat',
            'Unified CRM Pipeline',
            'Automated Invoicing & P&L',
            'Contract Engine (3 high-perf templates)',
            'Unlimited Task & Project Boards',
            '5GB Secure Evidence Storage',
            'Unified Gmail Integration',
            'Solo Video Suite',
            'Standard Support (48h response)',
        ],
        notIncluded: [
            'AI Growth Agent',
            'Team Collaboration Suite',
            'White-label branding',
            'Dedicated database instance',
            'Priority engineer support',
        ],
        cta: 'Launch Solo OS',
        ctaLink: '/auth/login?register=true&type=freelancer&plan=starter',
    },
    {
        name: 'Scaling Agency',
        price: '45',
        users: '25',
        desc: 'Everything to scale your agency and growing team to the next level.',
        highlight: true,
        color: 'teal',
        features: [
            'Up to 25 team members',
            'Unlimited CRM pipelines & contacts',
            'AI Growth Agent (automated outreach)',
            'Full financial suite (invoices, quotes, expenses, P&L)',
            'Unlimited contract templates & e-signing',
            'Full task & project management + Kanban',
            '25GB secure document storage',
            'Gmail, Calendly & calendar integration',
            'HD video meetings (unlimited participants)',
            'Customer portal access',
            'Priority support (4h response)',
        ],
        notIncluded: [
            'White-label branding',
            'Dedicated database instance',
        ],
        cta: 'Start Free Trial',
        ctaLink: '/auth/login?register=true&type=business&plan=pro',
    },
    {
        name: 'Enterprise',
        price: '80',
        users: '∞',
        desc: 'Unlimited scale, custom infrastructure, and a dedicated team.',
        highlight: false,
        color: 'blue',
        features: [
            'Unlimited team members',
            'Everything in Professional',
            'White-label branding (your logo, your domain)',
            'Dedicated database instance (isolated data)',
            'Custom API access & webhook integrations',
            '100GB secure document storage',
            'Custom contract workflows',
            'Advanced analytics & custom reporting',
            '24/7 dedicated engineer support',
            'Onboarding & implementation assistance',
            'Custom SLA agreement',
        ],
        notIncluded: [],
        cta: 'Contact Sales',
        ctaLink: '/contact',
    },
];

const comparisonRows = [
    { feature: 'Team Members', starter: '5', pro: '25', enterprise: 'Unlimited' },
    { feature: 'CRM Pipelines', starter: '1', pro: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'AI Growth Agent', starter: false, pro: true, enterprise: true },
    { feature: 'Financial Suite', starter: 'Basic', pro: 'Full', enterprise: 'Full + Custom' },
    { feature: 'Contract Templates', starter: '3', pro: 'Unlimited', enterprise: 'Unlimited + Custom' },
    { feature: 'Document Storage', starter: '5 GB', pro: '25 GB', enterprise: '100 GB' },
    { feature: 'Video Meetings', starter: '10 participants', pro: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'Gmail Integration', starter: true, pro: true, enterprise: true },
    { feature: 'Calendly Integration', starter: false, pro: true, enterprise: true },
    { feature: 'White-Label Branding', starter: false, pro: false, enterprise: true },
    { feature: 'Dedicated Database', starter: false, pro: false, enterprise: true },
    { feature: 'API Access', starter: false, pro: false, enterprise: true },
    { feature: 'Support Response', starter: '48 hours', pro: '4 hours', enterprise: '24/7 dedicated' },
];

const replacedTools = [
    { icon: Brain, name: 'HubSpot CRM', cost: '$50/mo', replaced: 'CRM & Deals module' },
    { icon: Video, name: 'Zoom Pro', cost: '$15/mo', replaced: 'Video Meetings module' },
    { icon: FileText, name: 'DocuSign', cost: '$25/mo', replaced: 'Contract Engine' },
    { icon: DollarSign, name: 'QuickBooks', cost: '$30/mo', replaced: 'Financial Suite' },
    { icon: Mail, name: 'Mailchimp', cost: '$20/mo', replaced: 'Comms & Email module' },
    { icon: Calendar, name: 'Calendly Pro', cost: '$12/mo', replaced: 'Calendar integration' },
    { icon: BarChart3, name: 'Asana', cost: '$25/mo', replaced: 'Task Management module' },
    { icon: Lock, name: 'PandaDoc', cost: '$49/mo', replaced: 'Contract Engine (e-sign)' },
    { icon: Globe, name: 'Intercom', cost: '$74/mo', replaced: 'AI Growth Agent' },
];

const faqs = [
    {
        q: 'Do I need a credit card to start the free trial?',
        a: 'No. You can sign up and access all features of your chosen plan for 14 days without providing any payment information. At the end of the trial, you\'ll be prompted to enter payment details to continue.',
    },
    {
        q: 'Can I switch plans at any time?',
        a: 'Yes. You can upgrade or downgrade from Settings → Billing at any time. Upgrades are prorated and take effect immediately. Downgrades take effect at the start of the next billing cycle.',
    },
    {
        q: 'What happens to my data if I cancel?',
        a: 'Your data is securely retained for 90 days after cancellation. During that window, you can export everything (CSV, JSON, PDF) or reactivate your subscription to regain full access. After 90 days, data is permanently deleted per our Privacy Policy.',
    },
    {
        q: 'Can I add more users than my plan allows?',
        a: 'Starter and Professional plans have user caps. If you need more, you can upgrade to the next tier at any time. Enterprise has no user limit.',
    },
    {
        q: 'Does AlphaClone really replace all those tools?',
        a: 'Yes. AlphaClone is an integrated Business OS — not a collection of loosely connected features. Every module (CRM, Finance, Contracts, Video, Tasks) shares the same data layer, so information flows across the platform without copy-pasting or re-entering data. Most customers retire 7–9 separate subscriptions within 30 days of switching.',
    },
    {
        q: 'Is my business data secure?',
        a: 'Enterprise-grade security is standard across all plans: AES-256 encryption at rest, TLS 1.3 in transit, row-level security (multi-tenant data isolation), bcrypt password hashing, RBAC permissions, and continuous audit logging.',
    },
    {
        q: 'How does the AI Growth Agent work?',
        a: 'The AI Growth Agent (available on Professional and Enterprise plans) automatically identifies prospective leads from public business directories, drafts personalized outreach messages, and manages multi-step follow-up sequences on your behalf — all while you focus on closing deals. You review and approve outreach templates before activation.',
    },
];

function Cell({ value }: { value: string | boolean }) {
    if (value === true) return <CheckCircle2 className="w-5 h-5 text-teal-400 mx-auto" />;
    if (value === false) return <Minus className="w-4 h-4 text-slate-700 mx-auto" />;
    return <span className="text-xs text-slate-300 text-center block">{value}</span>;
}

export default function PricingPageContent() {
    const [, setIsLoginOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [showComparison, setShowComparison] = useState(false);

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
                        { '@type': 'Question', name: 'How much does AlphaClone cost?', acceptedAnswer: { '@type': 'Answer', text: 'AlphaClone offers three plans: Starter at $15/month (up to 5 users), Professional at $45/month (up to 25 users, includes AI Growth Agent), and Enterprise at $80/month (unlimited users, white-label, dedicated support). All plans include a 14-day free trial with no credit card required.' } },
                        { '@type': 'Question', name: 'Is there a free trial for AlphaClone?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. All AlphaClone plans include a 14-day free trial with full access to all features in that plan. No credit card is required to start.' } },
                        { '@type': 'Question', name: 'Can I cancel AlphaClone at any time?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. You can cancel at any time from Settings > Billing. Cancellation takes effect at the end of the current billing period. Your data is retained for 90 days after cancellation.' } },
                        { '@type': 'Question', name: 'Does AlphaClone replace HubSpot, Zoom, DocuSign, and QuickBooks?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. AlphaClone replaces HubSpot (CRM), Zoom (video meetings), DocuSign (contracts), QuickBooks (financial management), Mailchimp (email), and several other tools for a fraction of the combined cost.' } },
                    ]
                })
            }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclone.tech' },
                        { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://alphaclone.tech/pricing' },
                    ]
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
                            Eliminate the "SaaS Tax". Replace $330+/mo of fragmented <br className="hidden md:block" />
                            tools with one high-performance Business OS.
                        </p>
                        <div className="flex items-center justify-center gap-6 text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                            <span>• Zero Setup Fees</span>
                            <span>• Unlimited Data</span>
                            <span>• Cancel Anytime</span>
                        </div>
                    </div>
                </section>

                <div className="max-w-7xl mx-auto px-4 pb-24 relative z-20">

                {/* Plan Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
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
                                    <div className="absolute top-0 right-0 bg-teal-500 text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-widest">
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
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">AlphaClone Professional</p>
                            <p className="text-3xl font-black text-teal-400">$45<span className="text-lg text-slate-500">/mo</span></p>
                        </div>
                        <div className="px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                            <p className="text-xs text-teal-300 font-bold">Save ~$280+/month</p>
                            <p className="text-xs text-slate-500">$3,360+ per year</p>
                        </div>
                    </div>
                </div>

                {/* Full comparison table */}
                <div className="mb-20">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-white mb-3">Full Feature Comparison</h2>
                        <button
                            onClick={() => setShowComparison(!showComparison)}
                            className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
                        >
                            {showComparison ? 'Collapse' : 'Expand full table'}
                            <ChevronDown className={`w-4 h-4 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    <AnimatePresence>
                        {showComparison && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                                <th className="text-left py-4 px-6 text-slate-400 text-sm font-semibold">Feature</th>
                                                <th className="py-4 px-4 text-center text-white font-bold text-sm">Starter<br /><span className="text-teal-400 font-black">$15</span></th>
                                                <th className="py-4 px-4 text-center text-teal-400 font-bold text-sm bg-teal-500/5">Professional<br /><span className="font-black">$45</span></th>
                                                <th className="py-4 px-4 text-center text-blue-400 font-bold text-sm">Enterprise<br /><span className="font-black">$80</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {comparisonRows.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-900/30 transition-colors">
                                                    <td className="py-3 px-6 text-sm text-slate-300">{row.feature}</td>
                                                    <td className="py-3 px-4 text-center"><Cell value={row.starter} /></td>
                                                    <td className="py-3 px-4 text-center bg-teal-500/3"><Cell value={row.pro} /></td>
                                                    <td className="py-3 px-4 text-center"><Cell value={row.enterprise} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            href="/auth/login?register=true&type=business&plan=pro"
                            className="cta-primary px-12 py-5 rounded-2xl text-lg w-full sm:w-auto text-center"
                        >
                            Start Solo OS
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
