'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Route, Shield, Workflow, HeartHandshake, Target, TrendingUp, Check, Database, Code, Globe, Layers, Lock, BarChart, Users, MessageSquare, Search, SlidersHorizontal } from 'lucide-react';
import AnimateIn from '../common/AnimateIn';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import IntegrationBrandIcon from '@/components/marketing/system/IntegrationBrandIcon';

const EcosystemPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const advantages = [
        {
            name: 'Structured Delivery',
            description: 'Move from concept to launch with structured workflows and clear delivery steps',
            icon: Workflow
        },
        {
            name: 'Visible Security Controls',
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
            name: 'Connected Architecture',
            description: 'New supported tools can join the same permission and execution model',
            icon: Route
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

    const categoryLabels: Record<string, string> = {
        communication: 'Communication',
        crm: 'CRM & Sales',
        payments: 'Payments',
        scheduling: 'Scheduling',
        social: 'Social',
        ai: 'AI providers',
        productivity: 'Productivity',
        platform: 'Platform',
    };
    const capabilityByCategory: Record<string, string> = {
        communication: 'Bring business messages and reply context into the workspace where supported.',
        crm: 'Connect customer, contact, deal, and activity context where supported.',
        payments: 'Connect payment and billing context to the business record.',
        scheduling: 'Connect booking, availability, and calendar context.',
        social: 'Connect publishing, page, and lead-capture workflows where available.',
        ai: 'Provide planning, reasoning, or model routing for Bonnie and approved workflows.',
        productivity: 'Connect mail, calendar, and task context to the workspace.',
        platform: 'Support the workspace data, authentication, or real-time foundation.',
    };
    const categories = Array.from(new Set(PUBLIC_INTEGRATIONS.map((item) => item.category)));
    const integrations = useMemo(() => PUBLIC_INTEGRATIONS.filter((item) => {
        const matchesCategory = category === 'all' || item.category === category;
        const search = query.trim().toLowerCase();
        const matchesQuery = !search || `${item.name} ${item.description} ${categoryLabels[item.category]}`.toLowerCase().includes(search);
        return matchesCategory && matchesQuery;
    }), [category, query]);

    return (
        <div className="min-h-screen marketing-theme bg-white text-slate-950">
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <AnimateIn type="fadeIn">
                    <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Home
                    </Link>
                </AnimateIn>

                <div className="text-center mb-20">
                    <AnimateIn type="scaleIn">
                        <Layers className="w-12 h-12 sm:w-16 sm:h-16 text-teal-600 mx-auto mb-6" aria-hidden="true" />
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
                        <div className="flex flex-wrap items-center justify-center gap-4 type-ui text-slate-500">
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
                            { icon: Workflow, title: 'Automation', desc: 'Workflow automation, task scheduling, and smart notifications' },
                            { icon: Lock, title: 'Security & Compliance', desc: 'Role-based access, audit logging, and GDPR data-rights support' },
                            { icon: Globe, title: 'Integrations', desc: 'Connect core tools such as Stripe, Google Workspace, and email providers' },
                        ].map((module, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group h-full">
                                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-blue-50">
                                        <module.icon className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-950 mb-2">{module.title}</h3>
                                    <p className="type-card-description text-slate-600 leading-relaxed">{module.desc}</p>
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
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Code className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">Frontend Stack</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>Next.js 15 with React 18</li>
                                    <li>TypeScript for type safety</li>
                                    <li>TailwindCSS for styling</li>
                                    <li>Framer Motion animations</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Database className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">Backend & Data</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>Supabase (PostgreSQL)</li>
                                    <li>Real-time subscriptions</li>
                                    <li>Row-level security</li>
                                    <li>Automated backups</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeRight" delay={0.2}>
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Layers className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">Infrastructure</h3>
                                <ul className="space-y-2 text-slate-600">
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
                            Connect the tools that <span className="text-teal-400">run the work</span>
                        </h2>
                        <p className="text-slate-400 text-center max-w-2xl mx-auto mb-12">
                            Browse by system or search by the outcome you need. Every status is explicit so a directory listing never feels like a promise of unsupported automation.
                        </p>
                    </AnimateIn>
                    <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                            <label className="relative block">
                                <span className="sr-only">Search integrations</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools or capabilities" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 type-ui text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                            </label>
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                <label className="sr-only" htmlFor="integration-category">Filter integrations by category</label>
                                <select id="integration-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 min-w-44 rounded-xl border border-slate-300 bg-white px-3 type-ui text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                    <option value="all">All categories</option>
                                    {categories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 type-caption text-slate-500">
                            <span>{integrations.length} connection{integrations.length === 1 ? '' : 's'} shown</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready to connect <span className="ml-2 h-1.5 w-1.5 rounded-full bg-amber-400" /> Beta <span className="ml-2 h-1.5 w-1.5 rounded-full bg-slate-500" /> Coming soon</span>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {integrations.map((integration, idx) => (
                                <AnimateIn key={integration.id} type="stagger" index={idx}>
                                    <article className="group flex min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <IntegrationBrandIcon id={integration.id} className="h-5 w-5" />
                                            </div>
                                            <span className={`rounded-full border px-2 py-1 type-caption font-bold ${integration.status === 'AVAILABLE' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : integration.status === 'BETA' ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{integration.statusLabel}</span>
                                        </div>
                                        <p className="mt-4 text-base font-bold text-slate-950">{integration.name}</p>
                                        <p className="mt-1 type-card-description leading-5 text-slate-600">{integration.description}</p>
                                        <p className="mt-3 type-card-description leading-4 text-blue-700">{capabilityByCategory[integration.category]}</p>
                                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 pt-3 type-ui">
                                            <span className="text-slate-600">{categoryLabels[integration.category]}</span>
                                            <Link href={`/ecosystem/${integration.id}`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">View connection details <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
                                        </div>
                                    </article>
                                </AnimateIn>
                            ))}
                        </div>
                        {integrations.length === 0 ? <p className="py-10 text-center type-card-description text-slate-400">No connections match that search. Try a different tool or category.</p> : null}
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
                                    Connect CRM, billing, contracts, project, and meeting workflows in one accountable workspace.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <PrimaryCTA className="w-full sm:w-auto">Get started</PrimaryCTA>
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
