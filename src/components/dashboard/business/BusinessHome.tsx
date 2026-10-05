'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '@/types';
import { useTenant } from '@/contexts/TenantContext';
import { OperatingSystemHome } from '../OperatingSystemHome';
import { AttentionFirstDashboard } from '../AttentionFirstDashboard';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';
import { OverviewDashboard } from '../views/ModuleDashboardView';
import { PlatformAdvantageHome } from '../platform-advantage/PlatformAdvantageHome';
import { IntegratedIntelligencePanel } from '../IntegratedIntelligencePanel';
import {
  NewUserSetupPanel,
  dismissSetupChecklist,
  isNewWorkspaceStats,
  isSetupChecklistDismissed,
} from './NewUserSetupPanel';
import { WorkspaceGuide } from './WorkspaceGuide';
import { HelpDisclosure } from '@/components/ui/workspace/HelpDisclosure';
import Link from 'next/link';

const FIRST_GOAL_LINKS: Record<string, { title: string; href: string }> = {
  get_customers: { title: 'Continue finding customers', href: '/dashboard/leads/campaigns' },
  post_to_social: { title: 'Continue your social post', href: '/dashboard/business/social/compose' },
  send_promotions: { title: 'Continue your email campaign', href: '/dashboard/business/campaigns' },
  manage_customers: { title: 'Add a customer or enquiry', href: '/dashboard/crm/workspace?quickAdd=true' },
  create_invoices: { title: 'Create a draft invoice', href: '/dashboard/business/billing/manage?create=true' },
  manage_projects: { title: 'Create a project', href: '/dashboard/business/projects/manage?create=true' },
};

interface BusinessHomeProps {
  user: User;
}

/**
 * Alphaclone OS home. Installed mobile/tablet PWA intentionally uses the
 * attention-first business briefing only; desktop keeps the complete OS home.
 */
const BusinessHome: React.FC<BusinessHomeProps> = ({ user }) => {
  const { currentTenant, getDashboardStats } = useTenant();
  const device = useDeviceExperience();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => isSetupChecklistDismissed(user.id));
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`onboarding_completed_${user.id}`) === 'true';
  });
  const [cachedGoalId, setCachedGoalId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`onboarding_goal_${user.id}`) || '';
  });
  const [goalDismissed, setGoalDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`onboarding_goal_dismissed_${user.id}`) === 'true';
  });
  const [showMoreContext, setShowMoreContext] = useState(false);
  const { dashboardHomeLayout, loading: prefsLoading } = useWorkspacePreferences();
  const firstGoalId = cachedGoalId || (typeof user.user_metadata?.onboarding_role === 'string' ? user.user_metadata.onboarding_role : '');
  const firstGoal = FIRST_GOAL_LINKS[firstGoalId];

  const isCompanion = device.isInstalledMobileCompanion;
  const homeLayout = isCompanion ? 'attention_first' : prefsLoading ? 'operating_system' : dashboardHomeLayout;

  useEffect(() => {
    // Companion Home delegates its summary fetch to AttentionFirstDashboard and
    // deliberately avoids the extra desktop setup/context request path.
    if (isCompanion || onboardingComplete || dismissed || !currentTenant?.id || !user.id) return;
    let active = true;
    void getDashboardStats(currentTenant.id, user.id).then((result) => {
      if (!active) return;
      setStats((result.stats as Record<string, unknown>) ?? null);
      setStatsError(result.error ?? null);
    });
    return () => {
      active = false;
    };
  }, [currentTenant?.id, user.id, getDashboardStats, isCompanion, onboardingComplete, dismissed]);

  useEffect(() => {
    const syncOnboarding = () => {
      setOnboardingComplete(localStorage.getItem(`onboarding_completed_${user.id}`) === 'true');
      setCachedGoalId(localStorage.getItem(`onboarding_goal_${user.id}`) || '');
    };
    window.addEventListener('alphaclone:onboarding-updated', syncOnboarding);
    syncOnboarding();
    return () => window.removeEventListener('alphaclone:onboarding-updated', syncOnboarding);
  }, [user.id]);

  if (isCompanion) {
    return (
      <div className="ac-companion-home ac-scroll-full pb-24 ac-safe-bottom" data-tour="business-home" data-experience="companion">
        <AttentionFirstDashboard />
      </div>
    );
  }

  // The outcome picker is the canonical first-use guide. Do not layer the old
  // generic checklist on top once a user has intentionally chosen a direction.
  const showSetup = !onboardingComplete && !dismissed && !statsError && stats !== null && isNewWorkspaceStats(stats);

  return (
    <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="business-home">
      {onboardingComplete && firstGoal && !goalDismissed ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4" aria-label="Your chosen first task">
          <div>
            <h2 className="type-ui font-semibold text-[var(--ws-text-primary)]">Your chosen first task</h2>
            <p className="type-caption text-[var(--ws-text-secondary)]">Pick up where you started whenever you are ready.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={firstGoal.href} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--ac-accent)] px-4 type-ui font-semibold text-[var(--ws-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac-accent)]">{firstGoal.title}</Link>
            <button type="button" className="min-h-11 rounded-xl px-3 type-ui text-[var(--ws-text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => {
              localStorage.setItem(`onboarding_goal_dismissed_${user.id}`, 'true');
              setGoalDismissed(true);
            }}>Dismiss</button>
          </div>
        </section>
      ) : null}
      {showSetup ? (
        <NewUserSetupPanel
          user={user}
          onDismiss={() => {
            dismissSetupChecklist(user.id);
            setDismissed(true);
          }}
        />
      ) : null}

      {homeLayout === 'attention_first' ? <AttentionFirstDashboard /> : <OperatingSystemHome />}

      <div className="flex justify-end">
        <HelpDisclosure title="Workspace Map & Guide" label="Workspace map">
          <div className="pt-2">
            <WorkspaceGuide user={user} />
          </div>
        </HelpDisclosure>
      </div>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setShowMoreContext((v) => !v)}
          className="type-caption font-medium text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-500)] transition-colors underline-offset-2 hover:underline"
        >
          {showMoreContext ? 'Hide extra workspace context' : 'Show platform insights & overview'}
        </button>
      </div>

      {showMoreContext ? (
        <div className="space-y-4 animate-fade-in">
          <PlatformAdvantageHome />
          <IntegratedIntelligencePanel />
          <OverviewDashboard />
        </div>
      ) : null}
    </div>
  );
};

export default BusinessHome;
