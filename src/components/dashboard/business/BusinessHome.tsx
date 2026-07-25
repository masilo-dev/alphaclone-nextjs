'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '@/types';
import { useTenant } from '@/contexts/TenantContext';
import { AttentionFirstDashboard } from '../AttentionFirstDashboard';
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
 * Home answers: What needs attention? What did Bonnie do? What's next?
 * Attention-first leads; secondary panels sit below the first viewport.
 * Phone: vertical priority feed — no miniature desktop grid.
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
    <div
      className="space-y-4 ac-scroll-full pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6"
      data-tour="business-home"
    >
      {showSetup ? (
        <NewUserSetupPanel
          user={user}
          onDismiss={() => {
            dismissSetupChecklist(user.id);
            setDismissed(true);
          }}
        />
      ) : null}

      <AttentionFirstDashboard />

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowMoreContext((v) => !v)}
          className="min-h-11 px-3 text-[12px] font-medium text-[var(--ws-text-tertiary)] hover:text-teal-300 transition-colors"
          aria-expanded={showMoreContext}
        >
          {showMoreContext ? 'Hide extra workspace context' : 'Show platform insights & overview'}
        </button>
      </div>

      {showMoreContext ? (
        <div className="space-y-4 animate-fade-in">
          <PlatformAdvantageHome />
          <IntegratedIntelligencePanel />
          <div className="hidden md:block">
            <OverviewDashboard />
          </div>
          <div className="md:hidden rounded-[var(--ws-radius-lg)] border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4">
            <p className="text-[13px] text-[var(--ws-text-primary,#fff)] font-medium">Business overview</p>
            <p className="text-[12px] text-[var(--ws-text-tertiary)] mt-1">
              Full charts stay on larger screens. Use Customers, Work, or Inbox below to continue.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BusinessHome;
