'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import CalComEmbed from '@/components/marketing/system/CalComEmbed';
import { getBookingConfig, resolvePlatformBookingUrl } from '@/lib/marketing/booking';
import { MARKETING_PRICING } from '@/config/pricingPlans';
import { TRIAL_HREF } from '@/lib/marketing/cta';

export default function BookDemoContent() {
  const config = getBookingConfig('demo');
  const bookingUrl = resolvePlatformBookingUrl(config.bookingUrl);

  return (
    <div className="marketing-theme min-h-screen text-white">
      <section className="pt-24 pb-6 sm:pt-28 sm:pb-10 px-4">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-teal-400 hover:text-teal-300 transition-colors mb-5 sm:mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to AlphaClone
          </Link>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-8 lg:gap-10 items-start">
            <div className="order-2 lg:order-1">
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
                Free Live Walkthrough
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight mb-3 sm:mb-4">
                See AlphaClone in <span className="text-teal-400">action.</span>
              </h1>
              <p className="text-base text-slate-400 mb-5 sm:mb-6 leading-relaxed">
                15 minutes with the team — live product walkthrough, tailored to your business.
              </p>

              <ul className="space-y-2.5 mb-5 sm:mb-6">
                {[
                  { icon: Clock, text: '15 minutes — no pitch decks' },
                  { icon: CheckCircle2, text: 'Demo tailored to your workflow' },
                  { icon: CheckCircle2, text: '14-day trial link on the call' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                    <Icon className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>

              <div className="hidden sm:grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: 'Plans', value: MARKETING_PRICING.startingPriceLine },
                  { label: 'Free trial', value: '14 days' },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3.5 bg-slate-900/60 border border-slate-700/50 rounded-xl text-center"
                  >
                    <p className="text-lg font-black text-white">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-sm text-slate-500">
                Prefer to explore first?{' '}
                <Link href={TRIAL_HREF} className="text-teal-400 hover:text-teal-300 font-medium transition-colors">
                  Start free trial →
                </Link>
              </p>
            </div>

            <div id="book-demo-calendar" className="order-1 lg:order-2 scroll-mt-24">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-400" />
                  <h2 className="text-base font-bold text-white">Pick a time</h2>
                </div>
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-400 transition-colors"
                >
                  New tab
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <CalComEmbed bookingUrl={bookingUrl} variant="page" />

              <p className="text-center text-xs text-slate-600 mt-3">
                Times shown in your local timezone
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <nav
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-6"
            aria-label="Explore AlphaClone"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-4">
              Explore the platform
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
              {[
                { href: '/services', label: 'Services & platform overview' },
                { href: '/pricing', label: 'Pricing plans' },
                { href: '/about', label: 'About AlphaClone' },
                { href: '/crm', label: 'CRM & pipeline' },
                { href: '/ai-agents', label: 'Bonnie AI agents' },
                { href: '/ecosystem', label: 'Integrations' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-slate-300 hover:text-teal-400 transition-colors">
                    {label} →
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </div>
  );
}
