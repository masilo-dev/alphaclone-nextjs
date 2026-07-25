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
    <div className="space-y-3 sm:space-y-4 ac-scroll-full pb-24 md:pb-8 ac-safe-bottom" data-tour="business-home">
      {showSetup ? (
        <NewUserSetupPanel
          user={user}
          onDismiss={() => {
            dismissSetupChecklist(user.id);
            setDismissed(true);
          }}
        />
      ) : null}

      {/* Priority 1–3: attention, next actions, upcoming — always first viewport */}
      <AttentionFirstDashboard />

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setShowMoreContext((v) => !v)}
          className="min-h-11 px-3 text-xs font-medium text-slate-400 hover:text-teal-300 transition-colors underline-offset-2 hover:underline"
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
          <div className="md:hidden rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-4">
            <p className="text-sm text-slate-300 font-medium">Business overview</p>
            <p className="text-xs text-slate-500 mt-1">
              Full charts stay on larger screens. Use Customers, Work, or Inbox below to continue.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BusinessHome;
