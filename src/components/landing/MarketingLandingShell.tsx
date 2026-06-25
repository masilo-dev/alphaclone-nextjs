'use client';

import React from 'react';
import PublicNavigation from '@/components/PublicNavigation';
import MarketingFooter from '@/components/landing/MarketingFooter';
import MarketingMobileCtaBar from '@/components/marketing/MarketingMobileCtaBar';

type MarketingLandingShellProps = {
  children: React.ReactNode;
};

/** Shared nav + footer shell for indexable product landing pages. */
export default function MarketingLandingShell({ children }: MarketingLandingShellProps) {
  return (
    <div className="marketing-theme pb-24 lg:pb-0">
      <PublicNavigation onLoginClick={() => {}} />
      {children}
      <MarketingFooter />
      <MarketingMobileCtaBar />
    </div>
  );
}
