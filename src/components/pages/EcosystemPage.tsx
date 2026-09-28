'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Shield, Workflow, Check, Database, Code, Globe, Layers, Lock, BarChart, Users, MessageSquare, Search, SlidersHorizontal } from 'lucide-react';
import AnimateIn from '../common/AnimateIn';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import IntegrationBrandIcon from '@/components/marketing/system/IntegrationBrandIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const EcosystemPage: React.FC = () => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
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
        const matchesQuery = !search || `${item.name} ${item.description} ${t(item.description)} ${categoryLabels[item.category]} ${t(categoryLabels[item.category])}`.toLowerCase().includes(search);
        return matchesCategory && matchesQuery;
    }), [category, query, t]);

    return (
        <div className="min-h-screen marketing-theme bg-white text-slate-950">
            <div className="max-w-7xl mx-auto px-4 py-20 pt-32">
                <AnimateIn type="fadeIn">
                    <Link href="/" className="inline-flex items-center text-teal-700 hover:text-teal-900 font-semibold mb-8">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        {t('Back to Home')}
                    </Link>
                </AnimateIn>

                <div className="text-center mb-20">
                    <AnimateIn type="scaleIn">
                        <Layers className="w-12 h-12 sm:w-16 sm:h-16 text-teal-700 mx-auto mb-6" aria-hidden="true" />
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.1}>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-marketing-heading mb-6 text-slate-950">
                            {t('The Complete Business')} <span className="text-teal-700">{t('Operating System')}</span>
                        </h1>
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.2}>
                        <p className="text-base sm:text-lg md:text-xl text-slate-700 max-w-3xl mx-auto mb-8 font-normal">
                            {t('Bring CRM, billing, projects, contracts, meetings, and analytics into one workspace. Built for agencies, freelancers, and service businesses that want fewer disconnected systems.')}
                        </p>
                    </AnimateIn>
                    <AnimateIn type="fadeUp" delay={0.3}>
                        <div className="flex flex-wrap items-center justify-center gap-4 type-ui text-slate-800 font-medium">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-700" />
                                <span>{t('CRM & Pipeline Management')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-700" />
                                <span>{t('Billing & Invoicing')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-700" />
                                <span>{t('Client Portal')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-teal-700" />
                                <span>{t('One connected workspace')}</span>
                            </div>
                        </div>
                    </AnimateIn>
                </div>

                {/* Core Modules */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center text-slate-950">
                            {t('Integrated')} <span className="text-teal-700">{t('Business Modules')}</span>
                        </h2>
                        <p className="text-slate-700 text-center max-w-2xl mx-auto mb-12">
                            {t('Core workflows for service businesses, unified in one platform with shared operational context.')}
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: Users, title: 'CRM & Deals', desc: 'Track leads, manage pipelines, close deals faster with AI-powered insights' },
                            { icon: BarChart, title: 'Analytics', desc: 'Real-time business metrics, revenue tracking, and performance dashboards' },
                            { icon: MessageSquare, title: 'Communications', desc: 'Email and client conversation context alongside CRM records' },
                            { icon: Database, title: 'Client Portal', desc: 'Client access for projects, invoices, and shared documents' },
                            { icon: Shield, title: 'Contracts & Legal', desc: 'E-signature workflows, contract templates, and approval tracking' },
                            { icon: Workflow, title: 'Automation', desc: 'Workflow automation, task scheduling, and smart notifications' },
                            { icon: Lock, title: 'Security & Compliance', desc: 'Account access controls, audit logging, and GDPR data-rights support' },
                            { icon: Globe, title: 'Integrations', desc: 'Connect core tools such as Stripe, Google Workspace, and email providers' },
                        ].map((module, idx) => (
                            <AnimateIn key={idx} type="stagger" index={idx}>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group h-full">
                                    <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-blue-100 bg-blue-50">
                                        <module.icon className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-950 mb-2">{t(module.title)}</h3>
                                    <p className="type-card-description text-slate-600 leading-relaxed">{t(module.desc)}</p>
                                </div>
                            </AnimateIn>
                        ))}
                    </div>
                </section>

                {/* Technical Stack */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center">
                            {t('Built on')} <span className="text-teal-700">{t('Modern Infrastructure')}</span>
                        </h2>
                        <p className="text-slate-700 text-center max-w-2xl mx-auto mb-12">
                            {t('A secure, scalable foundation without exposing implementation vendors as product features.')}
                        </p>
                    </AnimateIn>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 min-w-0">
                        <AnimateIn type="fadeLeft">
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Code className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">{t('Product experience')}</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>{t('Fast responsive web application')}</li>
                                    <li>{t('Desktop, tablet, mobile, and PWA')}</li>
                                    <li>{t('Accessible interaction patterns')}</li>
                                    <li>{t('Consistent shared design system')}</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeUp" delay={0.1}>
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Database className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">{t('Data foundation')}</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>{t('PostgreSQL business data')}</li>
                                    <li>{t('Workspace-scoped access controls')}</li>
                                    <li>{t('Real-time operational updates')}</li>
                                    <li>{t('Backup and recovery controls')}</li>
                                </ul>
                            </div>
                        </AnimateIn>
                        <AnimateIn type="fadeRight" delay={0.2}>
                            <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                                <Layers className="w-10 h-10 text-blue-600 mb-4" />
                                <h3 className="text-xl font-bold text-slate-950 mb-4">{t('Reliable delivery')}</h3>
                                <ul className="space-y-2 text-slate-600">
                                    <li>{t('Managed application hosting')}</li>
                                    <li>{t('Health and availability monitoring')}</li>
                                    <li>{t('Global CDN')}</li>
                                    <li>{t('Scalable background execution')}</li>
                                </ul>
                            </div>
                        </AnimateIn>
                    </div>
                </section>

                {/* Integrations */}
                <section className="mb-24">
                    <AnimateIn type="fadeUp">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-center text-slate-950">
                            {t('Connect the tools that')} <span className="text-teal-700">{t('run the work')}</span>
                        </h2>
                        <p className="text-slate-700 text-center max-w-2xl mx-auto mb-12">
                            {t('Browse by system or search by the outcome you need. Every status is explicit so a directory listing never feels like a promise of unsupported automation.')}
                        </p>
                    </AnimateIn>
                    <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                            <label className="relative block">
                                <span className="sr-only">{t('Search integrations')}</span>
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search tools or capabilities')} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 type-ui text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                            </label>
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                <label className="sr-only" htmlFor="integration-category">{t('Filter integrations by category')}</label>
                                <select id="integration-category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 min-w-44 rounded-xl border border-slate-300 bg-white px-3 type-ui text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                    <option value="all">{t('All categories')}</option>
                                    {categories.map((item) => <option key={item} value={item}>{t(categoryLabels[item])}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 type-caption text-slate-500">
                            <span>{integrations.length} {t(integrations.length === 1 ? 'connection shown' : 'connections shown')}</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t('Ready to connect')} <span className="ml-2 h-1.5 w-1.5 rounded-full bg-amber-400" /> {t('Beta')} <span className="ml-2 h-1.5 w-1.5 rounded-full bg-slate-500" /> {t('Coming soon')}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {integrations.map((integration, idx) => (
                                <AnimateIn key={integration.id} type="stagger" index={idx}>
                                    <article className="group flex min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <IntegrationBrandIcon id={integration.id} className="h-5 w-5" />
                                            </div>
                                            <span className={`rounded-full border px-2 py-1 type-caption font-bold ${integration.status === 'AVAILABLE' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : integration.status === 'BETA' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{t(integration.statusLabel)}</span>
                                        </div>
                                        <p className="mt-4 text-base font-bold text-slate-950">{integration.name}</p>
                                        <p className="mt-1 type-ui leading-6 text-slate-700">{t(integration.description)}</p>
                                        <p className="mt-3 type-ui leading-6 text-blue-800">{t(capabilityByCategory[integration.category])}</p>
                                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 pt-3 type-ui">
                                            <span className="text-slate-600">{t(categoryLabels[integration.category])}</span>
                                            <Link href={`/ecosystem/${integration.id}`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">{t('View connection details')} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></Link>
                                        </div>
                                    </article>
                                </AnimateIn>
                            ))}
                        </div>
                        {integrations.length === 0 ? <p className="py-10 text-center type-card-description text-slate-400">{t('No connections match that search. Try a different tool or category.')}</p> : null}
                    </div>
                </section>

                {/* Value Proposition */}
                <section>
                    <AnimateIn type="scaleIn">
                        <div className="mkt-dark-banner bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 p-12 sm:p-16 rounded-3xl text-center relative overflow-hidden shadow-2xl">
                            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                            <div className="relative z-10">
                                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6 text-white" style={{ color: '#ffffff' }}>
                                    {t('Start Building Smarter Today')}
                                </h2>
                                <p className="text-xl text-teal-100 mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: '#e6fffa' }}>
                                    {t('Connect CRM, billing, contracts, project, and meeting workflows in one accountable workspace.')}
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                    <PrimaryCTA className="w-full sm:w-auto">{t('Get started')}</PrimaryCTA>
                                    <SecondaryCTA className="w-full sm:w-auto">{t('Book a demo')}</SecondaryCTA>
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
