import type { ReactNode } from 'react';
import MarketingFooter from './MarketingFooter';
import MarketingHeader from './MarketingHeader';

type MarketingShellProps = {
  children: ReactNode;
  className?: string;
};

export default function MarketingShell({ children, className = '' }: MarketingShellProps) {
  return (
    <div
      className={`marketing-theme min-h-screen bg-[var(--marketing-bg-primary)] text-[var(--marketing-text-primary)] ${className}`.trim()}
    >
      <MarketingHeader />
      <main id="main-content" className="pt-14">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
