'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Rocket, Shield, Zap, HeartHandshake, Target, TrendingUp, Check, Database, Code, Globe, Layers, Lock, BarChart, Users, MessageSquare } from 'lucide-react';
import PublicNavigation from '../PublicNavigation';
import AnimateIn from '../common/AnimateIn';
import MarketingFooter from '../landing/MarketingFooter';

const EcosystemPage: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);

    const advantages = [
        {
            name: 'Lightning-Fast Delivery',
            description: 'Get your project from concept to launch in record time without sacrificing quality',
            icon: Zap
        },
        {
            name: 'Enterprise-Grade Security',
            description: 'Your data and your clients\' data protected with bank-level security standards',
            icon: Shield
        },
        {
            name: 'Scalable Solutions',
            description: 'Built to grow with your business - from startup to enterprise scale',
            icon: TrendingUp
        },
        {
            name: 'Dedicated Support',
            description: '24/7 support and ongoing maintenance to keep your business running smoothly',
            icon: HeartHandshake
        },
        {
            name: 'Results-Driven',
            description: 'We focus on metrics that matter - conversions, engagement, and ROI',
            icon: Target
        },
        {
            name: 'Future-Proof Technology',
            description: 'Built with cutting-edge technology that stays relevant as trends evolve',
            icon: Rocket
        },
    ];

    const services = [
        {
            title: 'Web Development',
            features: ['Custom Web Applications', 'E-Commerce Platforms', 'Landing Pages & Marketing Sites', 'Progressive Web Apps']
        },
        {
            title: 'Mobile Solutions',
            features: ['iOS & Android Apps', 'Cross-Platform Development', 'App Store Optimization', 'Mobile-First Design']
        },
        {
            title: 'Business Tools',
            features: ['CRM & Project Management', 'Real-Time Collaboration', 'Analytics & Reporting', 'Workflow Automation']
        },
        {
            title: 'Digital Strategy',
            features: ['SEO Optimization', 'Performance Marketing', 'Brand Development', 'Growth Consulting']
        },
    ];

    return (
        <div className="min-h-screen bg-transparent text-white">
            <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <AnimateIn type="fadeIn">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>
                </AnimateIn>

                <div className="text-center mb-20">
                    <AnimateIn type="scaleIn">
                        <Rocket className="w-12 h-12 sm:w-16 sm:h-16 text-teal-400 mx-auto mb-6" />
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.1}>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-marketing-heading mb-6">
                            The Complete Business <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600">Operating System</span>
                        </h1>
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.2}>
                        <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-8">
                            Replace 10+ fragmented tools with one unified platform. Built for agencies, freelancers, and service businesses who need enterprise power without enterprise complexity.
                        </p>
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.3}>
                        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-400" />
                                <span>CRM & Pipeline Management</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-400" />
                                <span>Billing & Invoicing</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-400" />
                                <span>Client Portal</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-400" />
                                <span>Team Collaboration</span>
                            </div>
                        </div>
                    </AnimateIn>
                </div>

                {/* Core Modules */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center">
                            Integrated <span className="text-teal-400">Business Modules</span>
                        </h2>
                        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
                            Every tool you need to run your service business, unified in one platform with real-time data synchronization.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Users, title: 'CRM & Deals', desc: 'Track leads, manage pipelines, close deals faster with AI-powered insights' },
                            { icon: BarChart, title: 'Analytics', desc: 'Real-time business metrics, revenue tracking, and performance dashboards' },
                            { icon: MessageSquare, title: 'Communications', desc: 'Unified inbox for email, SMS, and team messaging in one place' },
                            { icon: Database, title: 'Client Portal', desc: 'Branded client access for projects, invoices, and collaboration' },
                            { icon: Shield, title: 'Contracts & Legal', desc: 'E-signature, contract templates, and compliance management' },
                            { icon: Zap, title: 'Automation', desc: 'Workflow automation, task scheduling, and smart notifications' },
                            { icon: Lock, title: 'Security & Compliance', desc: 'SOC 2 Type II, GDPR compliant, end-to-end encryption' },
                            { icon: Globe, title: 'Integrations', desc: 'Connect Stripe, Slack, Google Workspace, and 50+ tools' },
                        ].map((module, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm p-6 rounded-2xl border border-slate-800/80 hover:border-teal-500/50 transition-all group h-full">
                                    <module.icon className="w-8 h-8 text-teal-400 mb-4 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-lg font-bold mb-2">{module.title}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{module.desc}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </section>

                {/* Technical Stack */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center">
                            Built on <span className="text-teal-400">Modern Infrastructure</span>
                        </h2>
                        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
                            Enterprise-grade architecture designed for performance, reliability, and scale.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <AnimateIn type="fadeLeft">
                            <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                                <Code className="w-10 h-10 text-teal-400 mb-4" />
                                <h3 className="text-xl font-bold mb-4">Frontend Stack</h3>
                                <ul className="space-y-2 text-slate-400">
                                    <li>Next.js 15 with React 18</li>
                                    <li>TypeScript for type safety</li>
                                    <li>TailwindCSS for styling</li>
                                    <li>Framer Motion animations</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                                <Database className="w-10 h-10 text-teal-400 mb-4" />
                                <h3 className="text-xl font-bold mb-4">Backend & Data</h3>
                                <ul className="space-y-2 text-slate-400">
                                    <li>Supabase (PostgreSQL)</li>
                                    <li>Real-time subscriptions</li>
                                    <li>Row-level security</li>
                                    <li>Automated backups</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeRight" delay={0.2}>
                            <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                                <Layers className="w-10 h-10 text-teal-400 mb-4" />
                                <h3 className="text-xl font-bold mb-4">Infrastructure</h3>
                                <ul className="space-y-2 text-slate-400">
                                    <li>Vercel Edge Network</li>
                                    <li>99.99% uptime SLA</li>
                                    <li>Global CDN</li>
                                    <li>Auto-scaling</li>
                                </ul>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Integrations */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center">
                            Core <span className="text-teal-400">Integrations</span>
                        </h2>
                        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
                            Built-in integrations with essential business tools. More integrations coming soon.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
                        {[
                            { name: 'Stripe', desc: 'Payment processing' },
                            { name: 'Supabase', desc: 'Database & Auth' },
                            { name: 'Vercel', desc: 'Hosting & Deploy' },
                            { name: 'Email', desc: 'SMTP & Notifications' }
                        ].map((integration, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-xl border border-slate-800 hover:border-teal-500/50 transition-all text-center group">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl mx-auto mb-4 flex items-center justify-center group-hover:from-slate-700 group-hover:to-slate-800 transition-all">
                                        <span className="text-lg font-black text-teal-400">{integration.name.slice(0, 2)}</span>
                                    </div>
                                    <p className="text-base font-bold text-white mb-1">{integration.name}</p>
                                    <p className="text-xs text-slate-500">{integration.desc}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </section>

                {/* Value Proposition */}
                <section>
                    <AnimateIn type="scaleIn">
                        <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-12 sm:p-16 rounded-3xl text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                            <div className="relative z-10">
                                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
                                    Start Building Smarter Today
                                </h2>
                                <p className="text-xl text-teal-50 mb-10 max-w-2xl mx-auto leading-relaxed">
                                    Join 500+ agencies and service businesses running their entire operation on AlphaClone. Free 14-day trial, no credit card required.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <Link
                                        href="/register"
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-2xl"
                                    >
                                        Start Free Trial
                                        <ArrowRight className="w-5 h-5" />
                                    </Link>
                                    <Link
                                        href="/docs"
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                                    >
                                        View Documentation
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </AnimateIn>
                </section>
            </div>
            <MarketingFooter />
        </div>
    );
};

export default EcosystemPage;
