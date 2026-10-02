'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Workflow,
  Check,
  Database,
  Code,
  Globe,
  Layers,
  Lock,
  BarChart,
  Users,
  MessageSquare,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import AnimateIn from '../common/AnimateIn';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';
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

  const integrations = useMemo(
    () =>
      PUBLIC_INTEGRATIONS.filter((item) => {
        const matchesCategory = category === 'all' || item.category === category;
        const search = query.trim().toLowerCase();
        const matchesQuery =
          !search ||
          `${item.name} ${item.description} ${t(item.description)} ${categoryLabels[item.category]} ${t(categoryLabels[item.category])}`
            .toLowerCase()
            .includes(search);
        return matchesCategory && matchesQuery;
      }),
    [category, query, t]
  );

  return (
    <div className="min-h-screen bg-white text-[#07152f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <AnimateIn type="fadeIn">
          <Link
            href="/"
            className="inline-flex items-center text-[#52627b] hover:text-[#0878f9] font-medium mb-8 type-ui transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('Back to Home')}
          </Link>
        </AnimateIn>

        {/* Hero Section */}
        <div className="text-center mb-16 sm:mb-20 max-w-4xl mx-auto">
          <AnimateIn type="scaleIn">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#edf6ff] border border-[#d0e4ff] text-[#075fc7] type-caption font-bold uppercase tracking-wider mb-6">
              <Layers className="w-3.5 h-3.5 text-[#0878f9]" />
              <span>{t('Ecosystem & Integrations')}</span>
            </div>
          </AnimateIn>

          <AnimateIn type="fadeUp" delay={0.1}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-marketing-heading mb-6 text-[#07152f] tracking-tight leading-tight">
              {t('The Complete Business')}{' '}
              <span className="text-[#0878f9]">{t('Operating System')}</span>
            </h1>
          </AnimateIn>

          <AnimateIn type="fadeUp" delay={0.2}>
            <p className="text-base sm:text-lg md:text-xl text-[#52627b] max-w-3xl mx-auto mb-8 font-normal leading-relaxed">
              {t(
                'Bring CRM, billing, projects, contracts, meetings, and analytics into one workspace. Built for agencies, freelancers, and service businesses that want fewer disconnected systems.'
              )}
            </p>
          </AnimateIn>

          <AnimateIn type="fadeUp" delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 type-ui text-[#33445e] font-medium">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#0878f9]" />
                <span>{t('CRM & Pipeline Management')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#0878f9]" />
                <span>{t('Billing & Invoicing')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#0878f9]" />
                <span>{t('Client Portal')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#0878f9]" />
                <span>{t('One connected workspace')}</span>
              </div>
            </div>
          </AnimateIn>
        </div>

        {/* Core Capabilities */}
        <section className="mb-20 sm:mb-24">
          <AnimateIn type="fadeUp">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-3 text-[#07152f] tracking-tight">
                {t('Integrated')} <span className="text-[#0878f9]">{t('Business Modules')}</span>
              </h2>
              <p className="text-[#52627b] leading-relaxed">
                {t('Core workflows for service businesses, unified in one platform with shared operational context.')}
              </p>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Users,
                title: 'CRM & Deals',
                desc: 'Track leads, manage pipelines, close deals faster with AI-powered insights',
              },
              {
                icon: BarChart,
                title: 'Analytics',
                desc: 'Real-time business metrics, revenue tracking, and performance dashboards',
              },
              {
                icon: MessageSquare,
                title: 'Communications',
                desc: 'Email and client conversation context alongside CRM records',
              },
              {
                icon: Database,
                title: 'Client Portal',
                desc: 'Client access for projects, invoices, and shared documents',
              },
              {
                icon: Shield,
                title: 'Contracts & Legal',
                desc: 'E-signature workflows, contract templates, and approval tracking',
              },
              {
                icon: Workflow,
                title: 'Automation',
                desc: 'Workflow automation, task scheduling, and smart notifications',
              },
              {
                icon: Lock,
                title: 'Security & Compliance',
                desc: 'Account access controls, audit logging, and GDPR data-rights support',
              },
              {
                icon: Globe,
                title: 'Integrations',
                desc: 'Connect core tools such as Stripe, Google Workspace, and email providers',
              },
            ].map((module, idx) => (
              <AnimateIn key={idx} type="stagger" index={idx}>
                <div className="bg-white p-6 rounded-2xl border border-[#dfe6ef] shadow-sm hover:border-[#b0cde8] hover:shadow-md transition-all group h-full flex flex-col">
                  <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-[#d0e4ff] bg-[#edf6ff]">
                    <module.icon className="w-5 h-5 text-[#0878f9] group-hover:scale-105 transition-transform" />
                  </div>
                  <h3 className="text-base font-bold text-[#07152f] mb-2 font-marketing-heading">{t(module.title)}</h3>
                  <p className="type-card-description text-[#52627b] leading-relaxed flex-grow">{t(module.desc)}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </section>

        {/* Technical Stack */}
        <section className="mb-20 sm:mb-24">
          <AnimateIn type="fadeUp">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-3 text-[#07152f] tracking-tight">
                {t('Built on')} <span className="text-[#0878f9]">{t('Modern Infrastructure')}</span>
              </h2>
              <p className="text-[#52627b] leading-relaxed">
                {t('A secure, scalable foundation without exposing implementation vendors as product features.')}
              </p>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AnimateIn type="fadeLeft">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#dfe6ef] shadow-sm h-full">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d0e4ff] bg-[#edf6ff] mb-4">
                  <Code className="w-5 h-5 text-[#0878f9]" />
                </div>
                <h3 className="text-lg font-bold text-[#07152f] mb-4 font-marketing-heading">{t('Product experience')}</h3>
                <ul className="space-y-2.5 text-[#52627b] type-card-description">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Fast responsive web application')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Desktop, tablet, mobile, and PWA')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Accessible interaction patterns')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Consistent shared design system')}
                  </li>
                </ul>
              </div>
            </AnimateIn>

            <AnimateIn type="fadeUp" delay={0.1}>
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#dfe6ef] shadow-sm h-full">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d0e4ff] bg-[#edf6ff] mb-4">
                  <Database className="w-5 h-5 text-[#0878f9]" />
                </div>
                <h3 className="text-lg font-bold text-[#07152f] mb-4 font-marketing-heading">{t('Data foundation')}</h3>
                <ul className="space-y-2.5 text-[#52627b] type-card-description">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('PostgreSQL business data')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Workspace-scoped access controls')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Real-time operational updates')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Backup and recovery controls')}
                  </li>
                </ul>
              </div>
            </AnimateIn>

            <AnimateIn type="fadeRight" delay={0.2}>
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#dfe6ef] shadow-sm h-full">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d0e4ff] bg-[#edf6ff] mb-4">
                  <Layers className="w-5 h-5 text-[#0878f9]" />
                </div>
                <h3 className="text-lg font-bold text-[#07152f] mb-4 font-marketing-heading">{t('Reliable delivery')}</h3>
                <ul className="space-y-2.5 text-[#52627b] type-card-description">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Managed application hosting')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Health and availability monitoring')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Global CDN')}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#0878f9] shrink-0" /> {t('Scalable background execution')}
                  </li>
                </ul>
              </div>
            </AnimateIn>
          </div>
        </section>

        {/* Integrations Directory */}
        <section className="mb-20 sm:mb-24">
          <AnimateIn type="fadeUp">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-3 text-[#07152f] tracking-tight">
                {t('Connect the tools that')} <span className="text-[#0878f9]">{t('run the work')}</span>
              </h2>
              <p className="text-[#52627b] leading-relaxed">
                {t(
                  'Browse by system or search by the outcome you need. Every status is explicit so a directory listing never feels like a promise of unsupported automation.'
                )}
              </p>
            </div>
          </AnimateIn>

          <div className="mx-auto max-w-6xl rounded-2xl border border-[#dfe6ef] bg-[#f7f9fc] p-4 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="relative block">
                <span className="sr-only">{t('Search integrations')}</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76849a]"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('Search tools or capabilities')}
                  className="h-11 w-full rounded-xl border border-[#cfd9e6] bg-white pl-10 pr-3 type-ui text-[#07152f] outline-none transition focus:border-[#0878f9] focus:ring-2 focus:ring-[#0878f9]/20"
                />
              </label>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#76849a]" aria-hidden="true" />
                <label className="sr-only" htmlFor="integration-category">
                  {t('Filter integrations by category')}
                </label>
                <select
                  id="integration-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-11 min-w-44 rounded-xl border border-[#cfd9e6] bg-white px-3 type-ui text-[#07152f] outline-none focus:border-[#0878f9] focus:ring-2 focus:ring-[#0878f9]/20"
                >
                  <option value="all">{t('All categories')}</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {t(categoryLabels[item])}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 type-caption text-[#52627b]">
              <span>
                {integrations.length}{' '}
                {t(integrations.length === 1 ? 'connection shown' : 'connections shown')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t('Ready to connect')}
                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-amber-500" /> {t('Beta')}
                <span className="ml-2 h-1.5 w-1.5 rounded-full bg-slate-400" /> {t('Coming soon')}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration, idx) => (
                <AnimateIn key={integration.id} type="stagger" index={idx}>
                  <article className="group flex min-h-[210px] flex-col rounded-xl border border-[#dfe6ef] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b0cde8] hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#dfe6ef] bg-white shadow-sm">
                        <IntegrationBrandIcon id={integration.id} className="h-5 w-5" />
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 type-caption font-semibold ${
                          integration.status === 'AVAILABLE'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : integration.status === 'BETA'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t(integration.statusLabel)}
                      </span>
                    </div>
                    <p className="mt-4 text-base font-bold text-[#07152f] font-marketing-heading">{integration.name}</p>
                    <p className="mt-1 type-ui leading-6 text-[#52627b]">{t(integration.description)}</p>
                    <p className="mt-3 type-ui leading-6 text-[#075fc7] font-medium">
                      {t(capabilityByCategory[integration.category])}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#dfe6ef] pt-3 type-ui">
                      <span className="text-[#76849a]">{t(categoryLabels[integration.category])}</span>
                      <Link
                        href={`/ecosystem/${integration.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#0878f9] hover:text-[#075fc7] transition-colors"
                      >
                        {t('View connection details')}
                        <ArrowRight
                          className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  </article>
                </AnimateIn>
              ))}
            </div>

            {integrations.length === 0 ? (
              <p className="py-10 text-center type-card-description text-[#76849a]">
                {t('No connections match that search. Try a different tool or category.')}
              </p>
            ) : null}
          </div>
        </section>

        {/* Refined Closing Callout */}
        <section>
          <AnimateIn type="scaleIn">
            <div className="bg-[#07152f] text-white p-10 sm:p-14 rounded-3xl text-center relative overflow-hidden border border-[#102443] shadow-xl">
              <div className="relative z-10 max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-blue-200 type-caption font-bold uppercase tracking-wider mb-4">
                  {t('Unified Business OS')}
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-marketing-heading mb-4 text-white">
                  {t('Start Building Smarter Today')}
                </h2>
                <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
                  {t('Connect CRM, billing, contracts, project, and meeting workflows in one accountable workspace.')}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto mkt-btn-large">
                    {t('Get started')} <ArrowRight className="h-4 w-4 ml-1" />
                  </PrimaryCTA>
                  <SecondaryCTA href="/#workflow" className="w-full sm:w-auto mkt-btn-large">
                    {t('Book a demo')}
                  </SecondaryCTA>
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
