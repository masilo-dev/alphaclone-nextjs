'use client';

import React from 'react';
import Link from 'next/link';
import {
    Globe, ArrowRight, Building2, Clock, CircuitBoard
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';
import AnimateIn from '../common/AnimateIn';
import MarketingFooter from '../landing/MarketingFooter';

const AboutPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const stats = [
        { label: 'Businesses Served', value: '500+', sub: 'and growing every week' },
        { label: 'Tools Replaced Per Client', value: '8+', sub: 'on average' },
        { label: 'Monthly SaaS Costs Saved', value: '$280', sub: 'per client, on average' },
        { label: 'Hours Saved Per Week', value: '15+', sub: 'per business owner' },
        { label: 'Customer Satisfaction', value: '97%', sub: 'based on support surveys' },
        { label: 'Uptime Guarantee', value: '99.9%', sub: 'SLA for all plans' },
    ];

    const timeline = [
        {
            year: '2022',
            title: 'Identifying the Operational Gap',
            desc: 'We saw service businesses struggling with software fragmentation: CRM, invoicing, scheduling, contracts, and communication all lived in separate tools that did not share context.',
        },
        {
            year: '2023',
            title: 'The Unified Platform',
            desc: 'We launched AlphaClone as a centralized business platform so teams could manage client relationships, delivery work, and core operations in one place.',
        },
        {
            year: '2024',
            title: 'The AI Growth Agent',
            desc: 'We introduced AI support for lead discovery, qualification, and outreach preparation so sales work could be handled more consistently and with less manual effort.',
        },
        {
            year: '2025-26',
            title: 'The Complete Business OS',
            desc: 'AlphaClone expanded into a fuller operating layer with contracts, accounting, meetings, automations, and connected workflows designed for professional service teams.',
        },
    ];

    const values = [
        {
            title: 'Obsessed with Real Business Outcomes',
            desc: "We do not measure success by feature count. We measure it by whether the product makes a business more organized, more profitable, and easier to run.",
        },
        {
            title: 'Radical Simplicity',
            desc: 'Powerful systems should still feel straightforward. If a business owner needs a manual to complete a common task, the product has failed that user.',
        },
        {
            title: 'Built for the Non-Technical Majority',
            desc: 'Most business owners are not software engineers. We build around their workflows instead of asking them to think like an IT department.',
        },
        {
            title: 'Data Privacy as a Default',
            desc: 'Client records, contracts, and financial data are sensitive business assets. We treat privacy, permissions, and auditability as product requirements.',
        },
        {
            title: 'AI That Serves, Not Replaces',
            desc: 'AI should reduce repetitive work and support better decisions. It should not add noise or remove human judgment from important business actions.',
        },
        {
            title: 'One Platform, Zero Silos',
            desc: 'Client work breaks down when CRM, invoicing, meetings, and delivery tools do not share context. We design the platform as one connected system.',
        },
    ];

    const whySection = [
        {
            headline: 'You stop losing information between tools',
            body: "When the CRM, inbox, project workspace, invoices, and contracts are disconnected, details get lost. AlphaClone is designed to keep those records tied to the same client and the same workflow.",
        },
        {
            headline: 'You stop paying for overlapping software',
            body: 'Many teams pay for multiple tools that cover the same basic jobs: communication, scheduling, storage, billing, and task management. A unified platform reduces that overlap.',
        },
        {
            headline: 'Your client experience becomes more consistent',
            body: 'Branded invoices, contracts, meetings, and delivery updates coming from one system creates a more professional and more trustworthy experience for clients.',
        },
        {
            headline: 'AI can handle repetitive growth work in the background',
            body: 'The Growth Agent is meant to support prospecting, qualification, and outreach preparation so teams spend more time on qualified conversations and less time on repetitive admin.',
        },
        {
            headline: 'Decision-making gets faster',
            body: 'When revenue, pipeline activity, project delivery, and client communication live in one platform, teams can answer operational questions without piecing together reports from several systems.',
        },
    ];

    return (
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <div className="pt-20">
                <section className="bg-gradient-to-b from-slate-900/60 to-transparent border-b border-slate-800/50 py-20">
                    <div className="max-w-4xl mx-auto px-4 text-center">
                        <AnimateIn type="fadeIn" delay={0}>
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Building2 className="w-5 h-5 text-teal-400" />
                                <span className="text-teal-400 text-sm font-semibold tracking-widest uppercase">About AlphaClone</span>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                                We Built the Business Platform We Wanted to Use
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
                                AlphaClone exists to help service businesses run CRM, billing, scheduling, contracts, communication, and delivery from one connected system instead of a patchwork of separate apps.
                            </p>
                        </AnimateIn>
                    </div>
                </section>

                <section className="py-16 bg-transparent">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            {stats.map((stat, idx) => (
                                <AnimateIn key={idx} type="stagger" index={idx}>
                                    <div className="text-center p-6 bg-white/[0.04] backdrop-blur-sm rounded-xl border border-slate-700/60 h-full">
                                        <div className="text-3xl font-bold text-teal-400 mb-1">{stat.value}</div>
                                        <div className="font-semibold text-white text-sm mb-1">{stat.label}</div>
                                        <div className="text-slate-500 text-xs">{stat.sub}</div>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-24 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/60 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 blur-[120px] -z-10" />
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <AnimateIn type="fadeLeft">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Globe className="w-6 h-6 text-teal-400" />
                                        <h2 className="text-3xl font-bold">Our Mission</h2>
                                    </div>
                                </AnimateIn>
                                <AnimateIn type="fadeUp" delay={0.1}>
                                    <div className="space-y-6 text-slate-300 leading-relaxed text-lg">
                                        <p>
                                            <strong className="text-white text-2xl block mb-4">To give smaller teams the operational quality of much larger companies.</strong>
                                            Most service businesses do not fail because they lack effort. They fail because their systems are fragmented, their data is scattered, and too much of the day is spent on manual coordination.
                                        </p>
                                        <p>
                                            We built AlphaClone to reduce that friction. The product is meant to help teams keep client work, internal operations, and revenue workflows connected.
                                        </p>
                                    </div>
                                </AnimateIn>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {[
                                    { title: 'Built for service businesses', desc: 'CRM, invoicing, scheduling, contracts, and communication in one operating layer.' },
                                    { title: 'Designed to reduce tool sprawl', desc: 'Less copying, less context switching, and fewer handoffs between disconnected apps.' },
                                    { title: 'Practical automation', desc: 'AI and workflows should remove repetitive work without making the product harder to run.' },
                                    { title: 'Clear ownership of data', desc: 'Permissions, activity history, and shared records stay tied to the same operating system.' }
                                ].map((item, i) => (
                                    <AnimateIn key={i} type="stagger" index={i}>
                                        <div className="p-6 rounded-2xl bg-white/[0.04] border border-slate-700/50 backdrop-blur-sm">
                                            <div className="text-xs font-semibold tracking-[0.22em] uppercase text-teal-400 mb-3">
                                                0{i + 1}
                                            </div>
                                            <h3 className="text-white font-bold mb-2">{item.title}</h3>
                                            <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                        </div>
                                    </AnimateIn>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-16 bg-transparent">
                    <div className="max-w-4xl mx-auto px-4">
                        <AnimateIn type="fadeLeft">
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold">Why This Matters for Business Owners</h2>
                            </div>
                        </AnimateIn>
                        <div className="space-y-8">
                            {whySection.map((point, i) => (
                                <AnimateIn key={i} type="fadeUp" delay={i * 0.07}>
                                    <div className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                        <div className="border-l-2 border-teal-500/50 pl-4">
                                            <h3 className="text-lg font-bold text-white mb-3">{point.headline}</h3>
                                            <p className="text-slate-400 leading-relaxed">{point.body}</p>
                                        </div>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/60">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex items-center gap-3 mb-12">
                            <Clock className="w-6 h-6 text-blue-400" />
                            <h2 className="text-3xl font-bold">Our Story</h2>
                        </div>
                        <div className="space-y-8">
                            {timeline.map((item, i) => (
                                <div key={i} className="flex gap-6">
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        <div className="w-12 h-12 rounded-full bg-teal-500/10 border-2 border-teal-500/30 flex items-center justify-center">
                                            <span className="text-teal-400 font-bold text-xs">{item.year}</span>
                                        </div>
                                        {i < timeline.length - 1 && (
                                            <div className="w-px flex-1 bg-slate-800 mt-2" />
                                        )}
                                    </div>
                                    <div className="pb-8">
                                        <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                                        <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-16 bg-transparent">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold mb-4">What We Believe In</h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                These are the operating principles behind our product decisions, support work, and roadmap.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {values.map((value, idx) => (
                                <div key={idx} className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 hover:border-teal-500/30 transition-colors">
                                    <div className="text-xs font-semibold tracking-[0.22em] uppercase text-teal-400 mb-3">
                                        Principle {idx + 1}
                                    </div>
                                    <h3 className="text-lg font-bold mb-3">{value.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{value.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/60">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex items-center gap-3 mb-8">
                            <CircuitBoard className="w-6 h-6 text-violet-400" />
                            <h2 className="text-3xl font-bold">Our Technology Philosophy</h2>
                        </div>
                        <div className="space-y-6 text-slate-400 leading-relaxed">
                            <p>
                                AlphaClone is built on a modern web stack designed for reliability, structured data, and fast iteration. The platform supports multi-tenant business workflows without forcing teams into several disconnected systems.
                            </p>
                            <p>
                                The AI features are focused on practical business tasks such as lead qualification, drafting support, and workflow assistance. The goal is to remove repetitive work, not generate noise.
                            </p>
                            <p>
                                Our security model is based on authenticated requests, explicit access rules, and traceable system activity. That gives teams clearer visibility into who can do what inside the platform.
                            </p>
                            <p>
                                We ship based on direct product feedback from businesses using the platform. That keeps the roadmap tied to operational value instead of surface-level feature inflation.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="py-24">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <AnimateIn type="scaleIn">
                            <h2 className="text-3xl font-bold mb-6">Join the Businesses Running Smarter</h2>
                            <p className="text-slate-400 text-lg mb-10">
                                Start your free trial and see how a connected operating platform can simplify client work, revenue workflows, and team operations.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Link href="/register">
                                    <Button className="text-lg px-10 py-4 h-auto bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl shadow-teal-500/20">
                                        Start Free Trial
                                    </Button>
                                </Link>
                                <Link href="/services">
                                    <Button variant="outline" className="text-lg px-10 py-4 h-auto border-slate-700 hover:bg-slate-800">
                                        View All Services
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </AnimateIn>
                    </div>
                </section>
            </div>
            <MarketingFooter />
        </div>
    );
};

export default AboutPage;
