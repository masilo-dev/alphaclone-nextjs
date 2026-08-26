'use client';

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Shield } from 'lucide-react';
import { LEGACY_ACCESS_DEADLINE_ISO } from '@/lib/entitlements/entitlementContext';

export const LegacyAccessBanner: React.FC = () => {
  const { currentTenant, isLoading } = useTenant();

  if (isLoading || !currentTenant) return null;

  const legacyUntil = currentTenant.legacy_access_until
    ? new Date(currentTenant.legacy_access_until)
    : null;
  const deadline = legacyUntil ?? new Date(LEGACY_ACCESS_DEADLINE_ISO);
  const now = Date.now();

  if (deadline.getTime() < now) return null;

  const formatted = deadline.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="border-b border-violet-500/20 bg-violet-600/10 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-3 text-sm font-medium text-violet-100">
        <Shield className="h-4 w-4 shrink-0 text-violet-300" />
        <span>Legacy access active until {formatted} — no daily action limits during this period.</span>
      </div>
    </div>
  );
};
