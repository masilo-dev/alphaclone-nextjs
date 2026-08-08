'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Rocket, Shield, Zap, HeartHandshake, Target, TrendingUp, Check, Database, Code, Globe, Layers, Lock, BarChart, Users, MessageSquare } from 'lucide-react';
import AnimateIn from '../common/AnimateIn';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';

const EcosystemPage: React.FC = () => {
    const advantages = [
        {
            name: 'Lightning-Fast Delivery',
            description: 'Move from concept to launch with structured workflows and clear delivery steps',
            icon: Zap
        },
        {
            name: 'Enterprise-Grade Security',
            description: 'Role-based access, audit logging, and policy visibility for business data',
            icon: Shield
        },
        {
            name: 'Scalable Solutions',
            description: 'Built to grow with your business - from startup to enterprise scale',
            icon: TrendingUp
        },
        {
            name: 'Dedicated Support',
            description: 'Support channels for setup, account, and operational questions',
            icon: HeartHandshake
        },
        {
            name: 'Results-Driven',
            description: 'Dashboards focus on operational metrics like pipeline, billing, and delivery status',
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

    const integrations = [
        { name: 'Calendly', desc: 'Scheduling sync', status: 'Available' },
        { name: 'LinkedIn', desc: 'OAuth, posting, lead forms', status: 'Available' },
        { name: 'Facebook', desc: 'Pages, posts, lead capture', status: 'Available' },
        { name: 'DeepSeek API', desc: 'Bonnie planning provider', status: 'Available' },
        { name: 'Claude API', desc: 'AI reasoning fallback', status: 'Available' },
        { name: 'OpenAI API', desc: 'Generation and AI fallback', status: 'Available' },
        { name: 'OpenRouter', desc: 'Optional model routing', status: 'Available' },
        { name: 'Microsoft 365', desc: 'Outlook, calendar, tasks', status: 'Available' },
        { name: 'Stripe', desc: 'Payment processing', status: 'Available' },
        { name: 'WhatsApp', desc: 'Dashboard connection', status: 'Coming soon' },
        { name: 'Instagram', desc: 'Business publishing/inbox', status: 'Coming soon' },
        { name: 'Supabase', desc: 'Database, auth, realtime', status: 'Available' },
    ];

    return (
        <div className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
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
                            Bring CRM, billing, projects, contracts, meetings, and analytics into one workspace. Built for agencies, freelancers, and service businesses that want fewer disconnected systems.
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
                            Core workflows for service businesses, unified in one platform with shared operational context.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Users, title: 'CRM & Deals', desc: 'Track leads, manage pipelines, close deals faster with AI-powered insights' },
                            { icon: BarChart, title: 'Analytics', desc: 'Real-time business metrics, revenue tracking, and performance dashboards' },
                            { icon: MessageSquare, title: 'Communications', desc: 'Unified inbox for email, SMS, and team messaging in one place' },
                            { icon: Database, title: 'Client Portal', desc: 'Branded client access for projects, invoices, and collaboration' },
                            { icon: Shield, title: 'Contracts & Legal', desc: 'E-signature workflows, contract templates, and approval tracking' },
                            { icon: Zap, title: 'Automation', desc: 'Workflow automation, task scheduling, and smart notifications' },
                            { icon: Lock, title: 'Security & Compliance', desc: 'Role-based access, audit logging, and GDPR data-rights support' },
                            { icon: Globe, title: 'Integrations', desc: 'Connect core tools such as Stripe, Google Workspace, and email providers' },
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
                            Modern architecture designed for performance, reliability, and scale.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 min-w-0">
                        <AnimateIn type="fadeLeft">
                            <div className="bg-slate-900/50 p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-800">
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
                            <div className="bg-slate-900/50 p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-800">
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
                            <div className="bg-slate-900/50 p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-800">
                                <Layers className="w-10 h-10 text-teal-400 mb-4" />
                                <h3 className="text-xl font-bold mb-4">Infrastructure</h3>
                                <ul className="space-y-2 text-slate-400">
                                    <li>Railway deployment</li>
                                    <li>Managed app hosting</li>
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
                            Built-in integrations and AI provider connections, managed from one workspace.
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto min-w-0 px-1">
                        {integrations.map((integration, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-slate-900/50 backdrop-blur-sm p-5 rounded-xl border border-slate-800 hover:border-teal-500/50 transition-all text-center group">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl mx-auto mb-4 flex items-center justify-center group-hover:from-slate-700 group-hover:to-slate-800 transition-all">
                                        <span className="text-lg font-black text-teal-400">{integration.name.slice(0, 2)}</span>
                                    </div>
                                    <p className="text-base font-bold text-white mb-1">{integration.name}</p>
                                    <p className="text-xs text-slate-500">{integration.desc}</p>
                                    <span className={`mt-3 inline-flex rounded px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                                        integration.status === 'Coming soon'
                                            ? 'border border-amber-500/20 bg-amber-500/10 text-amber-200'
                                            : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                    }`}>
                                        {integration.status}
                                    </span>
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
                                    Start a 14-day trial and test the CRM, billing, contracts, project, and meeting workflows in one workspace. No credit card required.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <PrimaryCTA className="w-full sm:w-auto">Start Free Trial</PrimaryCTA>
                                    <SecondaryCTA className="w-full sm:w-auto">Book a demo</SecondaryCTA>
                                </div>
                            </div>
                        </div>
                    </AnimateIn>
                </section>
            </div>
        </div>
    );
};

export default EcosystemPage;
