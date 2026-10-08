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
  isSetupChecklistDismissed,
} from './NewUserSetupPanel';
import { WorkspaceGuide } from './WorkspaceGuide';
import { HelpDisclosure } from '@/components/ui/workspace/HelpDisclosure';

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
  const [showMoreContext, setShowMoreContext] = useState(false);
  const { dashboardHomeLayout, loading: prefsLoading } = useWorkspacePreferences();
  const firstGoalId = cachedGoalId || (typeof user.user_metadata?.onboarding_role === 'string' ? user.user_metadata.onboarding_role : '');

  const isCompanion = device.isInstalledMobileCompanion;
  const homeLayout = isCompanion ? 'attention_first' : prefsLoading ? 'operating_system' : dashboardHomeLayout;

  useEffect(() => {
    // Companion Home delegates its summary fetch to AttentionFirstDashboard and
    // deliberately avoids the extra desktop setup/context request path.
    if (!onboardingComplete || !firstGoalId || dismissed || !currentTenant?.id || !user.id) return;
    let active = true;
    void getDashboardStats(currentTenant.id, user.id).then((result) => {
      if (!active) return;
      setStats((result.stats as Record<string, unknown>) ?? null);
      setStatsError(result.error ?? null);
    });
    return () => {
      active = false;
    };
  }, [currentTenant?.id, user.id, getDashboardStats, isCompanion, onboardingComplete, dismissed, firstGoalId]);

  useEffect(() => {
    const syncOnboarding = () => {
      setOnboardingComplete(localStorage.getItem(`onboarding_completed_${user.id}`) === 'true');
      setCachedGoalId(localStorage.getItem(`onboarding_goal_${user.id}`) || '');
    };
    window.addEventListener('alphaclone:onboarding-updated', syncOnboarding);
    syncOnboarding();
    return () => window.removeEventListener('alphaclone:onboarding-updated', syncOnboarding);
  }, [user.id]);

  const showSetup = onboardingComplete && Boolean(firstGoalId) && !dismissed && !statsError && Boolean(currentTenant?.id);
  const checklist = showSetup ? (
    <NewUserSetupPanel user={user} tenantId={currentTenant!.id} stats={stats} onDismiss={() => {
      dismissSetupChecklist(user.id);
      setDismissed(true);
    }} />
  ) : null;
  if (isCompanion) {
    return <div className="ac-companion-home ac-scroll-full pb-24 ac-safe-bottom" data-tour="business-home" data-experience="companion">
      {checklist}<AttentionFirstDashboard />
    </div>;
  }

  return (
    <div className="space-y-3.5 sm:space-y-4 ac-scroll-full pb-20 ac-safe-bottom" data-tour="business-home">
      {checklist}

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
