'use client';

import React from 'react';
import PublicNavigation from '@/components/PublicNavigation';
import MarketingFooter from '@/components/landing/MarketingFooter';

type MarketingLandingShellProps = {
  children: React.ReactNode;
};

/** Shared nav + footer shell for indexable product landing pages. */
export default function MarketingLandingShell({ children }: MarketingLandingShellProps) {
  return (
    <div className="marketing-theme">
      <PublicNavigation onLoginClick={() => {}} />
      {children}
      <MarketingFooter />
    </div>
  );
}
