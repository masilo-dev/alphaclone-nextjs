import type { ReactNode } from 'react';
import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';
import { MarketingBackground } from './atmosphere';

type MarketingShellProps = {
  children: ReactNode;
  className?: string;
};

export default function MarketingShell({ children, className = '' }: MarketingShellProps) {
  return (
    <div className={`marketing-theme mkt-shell min-h-screen text-[var(--marketing-text-primary)] ${className}`.trim()}>
      <MarketingBackground />
      <MarketingHeader />
      <main id="main-content" className="mkt-shell-content pt-14">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
