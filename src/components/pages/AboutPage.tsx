'use client';

import React from 'react';
import Link from 'next/link';
import {
    Target, Users, Award, TrendingUp, Zap, Shield, Globe,
    Check, ArrowRight, Heart, Lightbulb, Building2,
    Clock, Star, BarChart3, CircuitBoard, Lock, Layers
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import PublicNavigation from '../PublicNavigation';
import AnimateIn from '../common/AnimateIn';

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
            desc: 'We saw countless service businesses struggling with software fragmentation—paying for a CRM, invoicing tools, scheduling systems, and document signers, none of which talked to each other. Information was constantly falling through the cracks.',
        },
        {
            year: '2023',
            title: 'The Unified Platform',
            desc: 'We launched AlphaClone as a centralized Business Operating System. By consolidating client management, financials, and project delivery into a single dashboard, our early users eliminated redundant subscriptions and saved an average of 15 hours per week in administrative overhead.',
        },
        {
            year: '2024',
            title: 'The AI Growth Agent',
            desc: 'We introduced the AI Growth Agent, transforming AlphaClone from a management tool into a growth engine. Small businesses gained the capability to automatically discover, qualify, and engage leads 24/7 without needing a dedicated sales team.',
        },
        {
            year: '2025–26',
            title: 'The Complete Business OS',
            desc: 'With advanced contract drafting, enterprise-grade accounting, HD video meetings, and powerful automation now standard, AlphaClone provides professional service teams the exact same operational infrastructure as Fortune 500 companies—starting at just $15/month.',
        },
    ];

    const values = [
        {
            icon: Target,
            title: 'Obsessed with Real Business Outcomes',
            desc: "We don't measure success by feature count or interface polish. We measure it by whether using AlphaClone actually makes your business more profitable, more organized, and less stressful. Every decision we make is filtered through this lens.",
        },
        {
            icon: Lightbulb,
            title: 'Radical Simplicity',
            desc: 'The hardest engineering challenge is building something powerful that is also easy to use. We invest enormous effort in making complex functionality feel simple and intuitive. If a business owner needs to read a manual to use a feature, we\'ve failed.',
        },
        {
            icon: Heart,
            title: 'Built for the Non-Technical Majority',
            desc: 'The vast majority of business owners are not software engineers. They have expertise in their craft — law, design, marketing, consulting, finance — not in configuring SaaS tools. We build for them, in their language, around their actual workflows.',
        },
        {
            icon: Lock,
            title: 'Data Privacy as a Default',
            desc: 'Your business data — your clients, your contracts, your financials — is more sensitive than most people treat it. We protect it with enterprise-grade encryption, strict access controls, and transparent data governance. We never sell your data.',
        },
        {
            icon: CircuitBoard,
            title: 'AI That Serves, Not Replaces',
            desc: 'We believe AI should amplify human capability, not replace human judgment. Our AI Growth Agent finds leads and starts conversations, but you close the deal. Our contract AI drafts, but you review. The AI does the repetitive work; you do the high-value work.',
        },
        {
            icon: Layers,
            title: 'One Platform, Zero Silos',
            desc: 'The reason most business tools fail small businesses is that they operate in isolation. An invoice tool doesn\'t know about your CRM. Your calendar doesn\'t know about your tasks. AlphaClone is designed from the ground up as a unified system where everything is connected.',
        },
    ];

    const whySection = [
        {
            title: 'Why AlphaClone is a Game Changer for Non-Technical Business Owners',
            points: [
                {
                    headline: 'You stop losing information between tools',
                    body: "When you use 6 different apps, information falls through the cracks constantly. A client emails you about a contract change, but that email doesn't appear in your project management tool. An invoice is overdue, but the person chasing it doesn't know the client relationship history. With AlphaClone, everything is connected. The email, the invoice, the contract, the project, and the CRM record are all one unified picture.",
                },
                {
                    headline: 'You stop paying for the same feature in multiple places',
                    body: "You're paying for calendar features in Notion, Calendly, and Google Calendar. You're paying for document storage in Dropbox, Notion, and Google Drive. You're paying for communication tools in Slack, Gmail, and Zoom. AlphaClone consolidates all of this into tools that are actually connected to each other — so you're not duplicating functionality across subscriptions.",
                },
                {
                    headline: 'Your business looks more professional immediately',
                    body: "When you send a branded invoice, a professionally drafted contract, and schedule a meeting through your branded booking page — all from the same platform — it projects a level of operational sophistication that your competitors using cobbled-together free tools simply cannot match. Clients notice. It builds trust.",
                },
                {
                    headline: "The AI works while you sleep",
                    body: "The single biggest leverage point in the AlphaClone platform for most business owners is the Growth Agent. While you're delivering work for existing clients, the AI is identifying new prospects, qualifying them, and managing initial outreach. You wake up to warm leads in your CRM that are ready for a real conversation — not cold calls you have to make yourself.",
                },
                {
                    headline: 'You make faster, smarter decisions',
                    body: "When all your business data lives in one place, you can actually see the health of your business at a glance. Which clients generate the most revenue? Which deals are stuck in the pipeline? What's your average invoice payment time? These questions were previously hard to answer without hours of spreadsheet work. With AlphaClone, they're answered in real time on your dashboard.",
                },
            ],
        },
    ];

    return (
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />

            <div className="pt-20">
                {/* Hero */}
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
                                We Built the Business OS We Wished{' '}
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-400">
                                    Existed
                                </span>
                            </h1>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.2}>
                            <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto">
                                AlphaClone Systems was built to solve the frustration of software fragmentation. Service businesses were paying for 9 different subscriptions and spending more time managing tools than clients. We built the complete platform that does it all—bringing enterprise-grade CRM, invoicing, lead generation, and operations into one unified dashboard.
                            </p>
                        </AnimateIn>
                    </div>
                </section>

                {/* Stats */}
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

                {/* The Mission */}
                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/60">
                    <div className="max-w-4xl mx-auto px-4">
                        <AnimateIn type="fadeLeft">
                            <div className="flex items-center gap-3 mb-6">
                                <Globe className="w-6 h-6 text-teal-400" />
                                <h2 className="text-3xl font-bold">Our Mission</h2>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <div className="space-y-6 text-slate-300 leading-relaxed">
                                <p className="text-xl">
                                    <strong className="text-white">To give every business owner — regardless of technical skill, team size, or budget — access to the same operational infrastructure as a Fortune 500 company.</strong>
                                </p>
                                <p>
                                    Enterprise companies have entire IT departments managing their CRM systems, finance software, communication platforms, security tools, and automation workflows. They spend hundreds of thousands of dollars annually to maintain this infrastructure. The outputs of that investment — organized client relationships, efficient financial reporting, automated lead generation, and secure data management — give enterprise businesses an enormous competitive advantage over smaller competitors.
                                </p>
                                <p>
                                    AlphaClone eliminates that competitive advantage gap. We've taken the same capabilities that previously required a dedicated IT team and an enterprise budget, and packaged them into a single, unified platform that a business owner with zero technical background can set up in 30 minutes. Starting at $15/month.
                                </p>
                                <p>
                                    The result is that a freelance marketing consultant, a boutique law firm, a growing design agency, and a business coaching practice can now operate with the same efficiency, professionalism, and data intelligence as a company 10 times their size. That's the change we're making in the world.
                                </p>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Why AlphaClone is a Game Changer */}
                <section className="py-16 bg-transparent">
                    <div className="max-w-4xl mx-auto px-4">
                        <AnimateIn type="fadeLeft">
                            <div className="flex items-center gap-3 mb-8">
                                <Zap className="w-6 h-6 text-amber-400" />
                                <h2 className="text-3xl font-bold">{whySection[0].title}</h2>
                            </div>
                        </AnimateIn>
                        <div className="space-y-8">
                            {whySection[0].points.map((point, i) => (
                                <AnimateIn key={i} type="fadeUp" delay={i * 0.07}>
                                    <div className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60">
                                        <div className="flex items-start gap-4 mb-3 group/item">
                                            <div className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:bg-teal-500/20 transition-colors">
                                                <Check className="w-3 h-3 text-teal-400" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white">{point.headline}</h3>
                                        </div>
                                        <p className="text-slate-400 leading-relaxed pl-9">{point.body}</p>
                                    </div>
                                </AnimateIn>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Our Story Timeline */}
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

                {/* Values */}
                <section className="py-16 bg-transparent">
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold mb-4">What We Believe In</h2>
                            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                                These aren't mission statement buzzwords — they're the principles that dictate every product decision, support interaction, and partnership we make.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {values.map((value, idx) => (
                                <div key={idx} className="p-6 rounded-xl bg-white/[0.04] backdrop-blur-sm border border-slate-700/60 hover:border-teal-500/30 transition-colors">
                                    <value.icon className="w-8 h-8 text-teal-400 mb-4" />
                                    <h3 className="text-lg font-bold mb-3">{value.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{value.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Technology Philosophy */}
                <section className="py-16 bg-white/[0.02] backdrop-blur-sm border-y border-slate-800/60">
                    <div className="max-w-4xl mx-auto px-4">
                        <div className="flex items-center gap-3 mb-8">
                            <CircuitBoard className="w-6 h-6 text-violet-400" />
                            <h2 className="text-3xl font-bold">Our Technology Philosophy</h2>
                        </div>
                        <div className="space-y-6 text-slate-400 leading-relaxed">
                            <p>
                                AlphaClone is built on modern, enterprise-grade technology — the same stack used by companies like Vercel, Linear, and Notion. Our backend runs on Supabase, providing PostgreSQL-grade data reliability with real-time capabilities. Our infrastructure is deployed globally via serverless edge networks, ensuring sub-100ms response times regardless of where your team is located.
                            </p>
                            <p>
                                The AI features are built on top of purpose-trained models fine-tuned specifically for business contexts. We don't use generic AI responses — our Growth Agent, contract drafting, and analytics are all specialized for the actual patterns and language of professional service businesses.
                            </p>
                            <p>
                                Our security architecture is designed around the principle of zero-trust — every request is authenticated, every action is logged, and access is granted based on explicit permissions rather than assumed trust. This means your data remains yours, always, with a complete audit trail of who accessed what and when.
                            </p>
                            <p>
                                We build in public, update frequently, and ship features based on direct feedback from the businesses using the platform. Our development cycle is measured in days, not quarters — which means when a feature gets requested repeatedly by users, it typically appears in the product within weeks.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-20">
                    <div className="max-w-3xl mx-auto px-4 text-center">
                        <AnimateIn type="scaleIn">
                            <h2 className="text-3xl font-bold mb-6">Join the Businesses Running Smarter</h2>
                            <p className="text-slate-400 text-lg mb-10">
                                Start your free trial today. See in 30 minutes why hundreds of business owners have replaced their entire SaaS stack with AlphaClone.
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
        </div>
    );
};

export default AboutPage;
