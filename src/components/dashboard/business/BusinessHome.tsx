'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '@/types';
import { useTenant } from '@/contexts/TenantContext';
import { OperatingSystemHome } from '../OperatingSystemHome';
import { OverviewDashboard } from '../views/ModuleDashboardView';
import { PlatformAdvantageHome } from '../platform-advantage/PlatformAdvantageHome';
import { IntegratedIntelligencePanel } from '../IntegratedIntelligencePanel';
import {
  NewUserSetupPanel,
  dismissSetupChecklist,
  isNewWorkspaceStats,
  isSetupChecklistDismissed,
} from './NewUserSetupPanel';

interface BusinessHomeProps {
  user: User;
}

/**
 * Alphaclone OS home — KPIs, attention, overview charts, modules, Today, Bonnie.
 * Deeper platform context stays behind progressive disclosure.
 */
const BusinessHome: React.FC<BusinessHomeProps> = ({ user }) => {
  const { currentTenant, getDashboardStats } = useTenant();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [dismissed, setDismissed] = useState(() => isSetupChecklistDismissed(user.id));
  const [showMoreContext, setShowMoreContext] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id || !user.id) return;
    let active = true;
    void getDashboardStats(currentTenant.id, user.id).then((result) => {
      if (active) setStats((result.stats as Record<string, unknown>) ?? null);
    });
    return () => {
      active = false;
    };
  }, [currentTenant?.id, user.id, getDashboardStats]);

  const showSetup =
    !dismissed && (isNewWorkspaceStats(stats) || stats === null);

  return (
    <div className="space-y-5 ac-scroll-full pb-24 ac-safe-bottom" data-tour="business-home">
      {showSetup ? (
        <NewUserSetupPanel
          user={user}
          onDismiss={() => {
            dismissSetupChecklist(user.id);
            setDismissed(true);
          }}
        />
      ) : null}

      <OperatingSystemHome />

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setShowMoreContext((v) => !v)}
          className="text-xs font-medium text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-500)] transition-colors underline-offset-2 hover:underline"
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
