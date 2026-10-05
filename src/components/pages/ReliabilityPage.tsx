'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle, RefreshCw, Shield, Wrench, ArrowRight } from 'lucide-react';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { PUBLIC_INTEGRATIONS } from '@/config/integrations';
import { useLanguage } from '@/contexts/LanguageContext';

const comingSoon = PUBLIC_INTEGRATIONS.filter((i) => i.status === 'COMING_SOON');
const beta = PUBLIC_INTEGRATIONS.filter((i) => i.status === 'BETA');

export default function ReliabilityPage() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-white text-[var(--marketing-ink)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center text-[var(--marketing-muted)] hover:text-[var(--marketing-link)] mb-8 type-ui font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('Back to home')}
        </Link>

        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-blue-50)] border border-[var(--brand-blue-100)] text-[var(--marketing-link-hover)] type-caption font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-[var(--marketing-link)]" />
            {t('Trust & Control')}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-marketing-heading text-[var(--marketing-ink)] mb-6 leading-tight tracking-tight">
          {t('Reliability, recovery, and honest limits')}
        </h1>
        <p className="text-lg text-[var(--marketing-muted)] leading-relaxed mb-12 max-w-3xl">
          {t(EXECUTION_LAYER.primaryLine)}{' '}
          {t('That only works if you can see what ran, what failed, and what still needs your decision.')}
        </p>

        <section className="space-y-5 mb-14">
          <div className="flex gap-4 rounded-2xl border border-[var(--marketing-border)] bg-white p-6 sm:p-7 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--brand-blue-100)] bg-[var(--brand-blue-50)] text-[var(--marketing-link)] shrink-0 mt-0.5">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-marketing-heading text-[var(--marketing-ink)] mb-1.5">
                {t('Approval before impact')}
              </h2>
              <p className="type-card-description text-[var(--marketing-muted)] leading-relaxed">
                {t(
                  'Client-facing sends, charges, and high-risk actions can require explicit approval. You choose where automation stops and review begins.'
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-[var(--marketing-border)] bg-white p-6 sm:p-7 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--brand-blue-100)] bg-[var(--brand-blue-50)] text-[var(--marketing-link)] shrink-0 mt-0.5">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-marketing-heading text-[var(--marketing-ink)] mb-1.5">
                {t('Retries and visibility')}
              </h2>
              <p className="type-card-description text-[var(--marketing-muted)] leading-relaxed">
                {t(
                  'Background jobs and automations use retry logic for transient failures. Platform status and health endpoints support operational transparency — see'
                )}{' '}
                <Link href="/platform-status" className="text-[var(--marketing-link)] font-medium hover:underline">
                  {t('platform status')}
                </Link>{' '}
                {t('for current availability.')}
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl border border-[var(--marketing-border)] bg-white p-6 sm:p-7 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--brand-blue-100)] bg-[var(--brand-blue-50)] text-[var(--marketing-link)] shrink-0 mt-0.5">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-marketing-heading text-[var(--marketing-ink)] mb-1.5">
                {t('Provider and integration limits')}
              </h2>
              <p className="type-card-description text-[var(--marketing-muted)] leading-relaxed">
                {t(
                  'Email deliverability, social APIs, and payment providers impose their own limits. AlphaClone surfaces readiness checks before execution where supported — success still depends on connected accounts and external services.'
                )}
              </p>
            </div>
          </div>
        </section>

        {(comingSoon.length > 0 || beta.length > 0) && (
          <section className="mb-14 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <h2 className="text-lg font-bold font-marketing-heading text-amber-950">
                {t('Current product limits (public catalog)')}
              </h2>
            </div>
            {beta.length > 0 && (
              <p className="type-card-description text-amber-900 mb-2">
                <strong className="font-semibold">{t('Beta:')}</strong> {beta.map((i) => i.name).join(', ')}
              </p>
            )}
            {comingSoon.length > 0 && (
              <p className="type-card-description text-amber-900">
                <strong className="font-semibold">{t('Coming soon:')}</strong> {comingSoon.map((i) => i.name).join(', ')} —{' '}
                {t('not marketed as fully available until status changes in our')}{' '}
                <Link href="/ecosystem" className="text-[var(--marketing-link-hover)] font-medium hover:underline">
                  {t('integrations overview')}
                </Link>
                .
              </p>
            )}
          </section>
        )}

        <section className="mb-12 rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] p-6 sm:p-8">
          <p className="type-ui text-[var(--marketing-muted)] leading-relaxed mb-0">
            {t(
              'We do not guarantee revenue, lead volume, or unattended operation of your entire business. Security and data handling practices are described in our'
            )}{' '}
            <Link href="/security-policy" className="text-[var(--marketing-link)] font-medium hover:underline">
              {t('security policy')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy-policy" className="text-[var(--marketing-link)] font-medium hover:underline">
              {t('privacy policy')}
            </Link>
            .
          </p>
        </section>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <PrimaryCTA href={DEMO_HREF} className="w-full sm:w-auto">
            {t(EXECUTION_LAYER.primaryCta)} <ArrowRight className="h-4 w-4 ml-1" />
          </PrimaryCTA>
          <SecondaryCTA href="/#workflow" className="w-full sm:w-auto">
            {t('See how execution works')}
          </SecondaryCTA>
        </div>
      </div>
    </div>
  );
}
