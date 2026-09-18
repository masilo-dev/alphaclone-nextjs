'use client';

import React, { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, Mail, Send, Users } from 'lucide-react';
import CampaignBuilderShell from '@/components/dashboard/business/CampaignBuilder';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import CRMWorkspaceBridge from '../crm/CRMWorkspaceBridge';

interface EmailCampaignsPageProps {
  userId: string;
}

const CAMPAIGN_STEPS = [
  {
    number: 1,
    title: 'Name your message and sender',
    description: 'Add a private label, subject line, and the business email customers can reply to.',
    Icon: Mail,
  },
  {
    number: 2,
    title: 'Choose who you are contacting',
    description: 'Pick a small group, all suitable contacts, or safely import a list.',
    Icon: Users,
  },
  {
    number: 3,
    title: 'Write what you want to say',
    description: 'Start from a plain-language template, edit it, and preview it.',
    Icon: Mail,
  },
  {
    number: 4,
    title: 'Review, then send or schedule',
    description: 'Confirm the audience, message, sender, and timing before delivery.',
    Icon: Send,
  },
] as const;

/**
 * Campaign creation is owned by CampaignBuilder. This page only explains the
 * actual four-step path and preserves campaign deep links; it does not create a
 * competing, local-only checklist.
 */
export default function EmailCampaignsPage({ userId }: EmailCampaignsPageProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const initialCampaignId = useMemo(() => {
    const fromQuery = searchParams?.get('campaign') || searchParams?.get('campaignId');
    const fromPath = pathname?.match(/\/marketing\/campaigns\/([0-9a-f-]{36})/i)?.[1];
    return fromQuery || fromPath || null;
  }, [pathname, searchParams]);

  return (
    <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/business/campaigns">
      <div className="space-y-4">
        <CRMWorkspaceBridge active="outreach" compact />
        <section aria-labelledby="campaign-setup-heading" className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4 shadow-lg shadow-black/10 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[var(--ac-accent-muted)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ac-accent)]">Simple campaign setup</p>
              <h1 id="campaign-setup-heading" className="mt-3 text-2xl font-semibold tracking-tight text-white">Send a clear message in four steps</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ws-text-secondary)]">
                AlphaClone keeps delivery safeguards in place while showing only what you need at each step. Your campaign stays a draft until you review and choose to send or schedule it.
              </p>
            </div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ws-border)] bg-[var(--ws-surface-secondary,#111827)] px-3 py-2 text-xs text-[var(--ws-text-tertiary)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--success-text,#6FE0AD)]" aria-hidden="true" />
              You can go back without losing your draft.
            </p>
          </div>

          <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CAMPAIGN_STEPS.map(({ number, title, description, Icon }) => (
              <li key={number} className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-surface-secondary,#111827)] p-4 transition-colors hover:border-[var(--ac-accent)]/50">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ac-accent-muted)] text-xs font-semibold text-[var(--ac-accent)]">{number}</span>
                  <Icon className="ml-auto h-4 w-4 text-[var(--ac-accent)]" aria-hidden="true" />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-white">{title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ws-text-secondary)]">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <CampaignBuilderShell userId={userId} initialCampaignId={initialCampaignId} />
      </div>
    </ModuleOverviewChrome>
  );
}
