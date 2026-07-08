'use client';

import React, { useEffect, useState } from 'react';
import type { User } from '@/types';
import { useTenant } from '@/contexts/TenantContext';
import { OverviewDashboard } from '../views/ModuleDashboardView';
import {
  NewUserSetupPanel,
  dismissSetupChecklist,
  isNewWorkspaceStats,
  isSetupChecklistDismissed,
} from './NewUserSetupPanel';

interface BusinessHomeProps {
  user: User;
}

const BusinessHome: React.FC<BusinessHomeProps> = ({ user }) => {
  const { currentTenant, getDashboardStats } = useTenant();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [dismissed, setDismissed] = useState(() => isSetupChecklistDismissed(user.id));

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
    <div className="space-y-4 ac-scroll-full" data-tour="business-home">
      {showSetup ? (
        <NewUserSetupPanel
          user={user}
          onDismiss={() => {
            dismissSetupChecklist(user.id);
            setDismissed(true);
          }}
        />
      ) : null}
      <OverviewDashboard />
    </div>
  );
};

export default BusinessHome;
