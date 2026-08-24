import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import CompanyInfoBlock from '@/components/marketing/CompanyInfoBlock';
import { MarketingContainer, MarketingSection } from '@/components/marketing/system/LayoutPrimitives';

export const metadata: Metadata = {
  title: 'Security Policy | AlphaClone Systems',
  description:
    'Security policy for AlphaClone Systems. Covers secure development posture, access controls, incident handling process, and vulnerability reporting contact.',
  keywords: [
    'AlphaClone security',
    'AlphaClone security policy',
    'AlphaClone vulnerability disclosure',
    'AlphaClone data security',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/security-policy' },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Security Policy | AlphaClone Systems',
    description: 'Security and vulnerability reporting information for AlphaClone.',
    url: 'https://alphaclonesystems.com/security-policy',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

export default function SecurityPolicyPage() {
  return (
    <MarketingLandingShell>
      <MarketingSection>
        <MarketingContainer className="max-w-4xl">
          <h1>Security Policy</h1>
          <p className="mt-4 mb-8 text-[var(--marketing-text-secondary)]">
            AlphaClone applies a security-first engineering model for platform services, customer
            data, and production operations.
          </p>

          <CompanyInfoBlock className="mb-8" compact />

          <div className="space-y-4 text-sm text-[var(--marketing-text-secondary)]">
            <div className="mkt-surface p-5">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Secure Development
              </h2>
              <p>
                Changes are reviewed before release. Security-sensitive components are monitored and
                remediated through prioritized engineering workflows.
              </p>
            </div>
            <div className="mkt-surface p-5">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Access and Data Controls
              </h2>
              <p>
                Tenant isolation, authentication controls, and policy-driven access checks are used
                across customer-facing systems.
              </p>
            </div>
            <div className="mkt-surface p-5">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Incident Response
              </h2>
              <p>
                Security events are triaged by severity and routed for containment, investigation,
                and corrective action.
              </p>
            </div>
            <div className="mkt-surface p-5 border-[rgba(20,184,166,0.28)]">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Report a Security Issue
              </h2>
              <p>
                Send vulnerability reports to{' '}
                <a
                  href="mailto:security@alphaclonesystems.com"
                  className="text-[var(--marketing-accent-hover)] hover:underline"
                >
                  security@alphaclonesystems.com
                </a>
                .
              </p>
              <p className="mt-2">
                For legal references, visit the{' '}
                <Link href="/legal" className="text-[var(--marketing-accent-hover)] hover:underline">
                  Legal and Trust Center
                </Link>
                .
              </p>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingLandingShell>
  );
}
