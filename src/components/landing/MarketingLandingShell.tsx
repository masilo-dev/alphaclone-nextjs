import type { ReactNode } from 'react';
import MarketingShell from '@/components/marketing/system/MarketingShell';

type MarketingLandingShellProps = {
  children: ReactNode;
  className?: string;
};

/** Shared nav + footer shell for indexable product landing pages. */
export default function MarketingLandingShell({ children, className }: MarketingLandingShellProps) {
  return <MarketingShell className={`mkt-public-page ${className || ''}`.trim()}>{children}</MarketingShell>;
}
