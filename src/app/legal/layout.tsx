import type { ReactNode } from 'react';
import LegalMarketingShell from '@/components/legal/LegalMarketingShell';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalMarketingShell>{children}</LegalMarketingShell>;
}
