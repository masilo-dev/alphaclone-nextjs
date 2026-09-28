'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, RefreshCw, Shield, Wrench } from 'lucide-react';
import { PrimaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import { useLanguage } from '@/contexts/LanguageContext';

const comingSoon = PUBLIC_INTEGRATIONS.filter((i) => i.status === 'COMING_SOON');
const beta = PUBLIC_INTEGRATIONS.filter((i) => i.status === 'BETA');

export default function ReliabilityPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen page-network-bg marketing-theme bg-transparent text-white">
      <div className="max-w-4xl mx-auto px-4 py-20 pt-32">
        <Link href="/" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 type-ui">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('Back to home')}
        </Link>

        <p className="type-caption font-semibold uppercase tracking-widest text-teal-400 mb-3">{t('Trust & control')}</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-marketing-heading mb-6 leading-tight">
          {t('Reliability, recovery, and honest limits')}
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed mb-10">
          {t(EXECUTION_LAYER.primaryLine)} {t('That only works if you can see what ran, what failed, and what still needs your decision.')}
        </p>

        <section className="space-y-6 mb-14">
          <div className="flex gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-6">
            <Shield className="h-6 w-6 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-white mb-2">{t('Approval before impact')}</h2>
              <p className="type-card-description text-slate-400 leading-relaxed">
                {t('Client-facing sends, charges, and high-risk actions can require explicit approval. You choose where automation stops and review begins.')}
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-6">
            <RefreshCw className="h-6 w-6 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-white mb-2">{t('Retries and visibility')}</h2>
              <p className="type-card-description text-slate-400 leading-relaxed">
                {t('Background jobs and automations use retry logic for transient failures. Platform status and health endpoints support operational transparency — see')}{' '}
                <Link href="/platform-status" className="text-teal-400 hover:underline">
                  {t('platform status')}
                </Link>{' '}
                {t('for current availability.')}
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 p-6">
            <Wrench className="h-6 w-6 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-white mb-2">{t('Provider and integration limits')}</h2>
              <p className="type-card-description text-slate-400 leading-relaxed">
                {t('Email deliverability, social APIs, and payment providers impose their own limits. AlphaClone surfaces readiness checks before execution where supported — success still depends on connected accounts and external services.')}
              </p>
            </div>
          </div>
        </section>

        {(comingSoon.length > 0 || beta.length > 0) && (
          <section className="mb-14 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <h2 className="font-bold text-white">{t('Current product limits (public catalog)')}</h2>
            </div>
            {beta.length > 0 && (
              <p className="type-card-description text-slate-300 mb-2">
                <strong className="text-amber-200">{t('Beta:')}</strong> {beta.map((i) => i.name).join(', ')}
              </p>
            )}
            {comingSoon.length > 0 && (
              <p className="type-card-description text-slate-300">
                <strong className="text-amber-200">{t('Coming soon:')}</strong> {comingSoon.map((i) => i.name).join(', ')} — {t('not marketed as fully available until status changes in our')}{' '}
                <Link href="/ecosystem" className="text-teal-400 hover:underline">
                  {t('integrations overview')}
                </Link>
                .
              </p>
            )}
          </section>
        )}

        <section className="mb-10 type-ui text-slate-500 leading-relaxed">
          <p>
            {t('We do not guarantee revenue, lead volume, or unattended operation of your entire business. Security and data handling practices are described in our')}{' '}
            <Link href="/security-policy" className="text-teal-400 hover:underline">
              {t('security policy')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy-policy" className="text-teal-400 hover:underline">
              {t('privacy policy')}
            </Link>
            .
          </p>
        </section>

        <PrimaryCTA href={DEMO_HREF}>{t(EXECUTION_LAYER.primaryCta)}</PrimaryCTA>
      </div>
    </div>
  );
}
