import type { ReactNode } from 'react';
import MarketingShell from '@/components/marketing/system/MarketingShell';
import LegalNav from '@/components/legal/LegalNav';

/** Unified legal/trust shell using the shared marketing header and footer. */
export default function LegalMarketingShell({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <div className="flex min-h-[calc(100vh-5rem)] flex-col">
        <LegalNav />
        <div className="flex-1">{children}</div>
      </div>
    </MarketingShell>
  );
}
