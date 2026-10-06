import type { ReactNode } from 'react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export default function IntegrationDetailLayout({ children }: { children: ReactNode }) {
  return <MarketingLandingShell>{children}</MarketingLandingShell>;
}
