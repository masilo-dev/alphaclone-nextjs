import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import CompanyInfoBlock from '@/components/marketing/CompanyInfoBlock';
import { MarketingContainer, MarketingSection } from '@/components/marketing/system/LayoutPrimitives';

export const metadata: Metadata = {
  title: 'Compliance Overview | AlphaClone Systems',
  description:
    'Compliance overview for AlphaClone Systems. Governance posture, legal transparency, privacy coverage, and enterprise trust documentation references.',
  keywords: [
    'AlphaClone compliance',
    'AlphaClone governance',
    'AlphaClone legal',
    'AlphaClone enterprise trust',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/compliance' },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Compliance Overview | AlphaClone Systems',
    description: 'Compliance and governance overview for AlphaClone.',
    url: 'https://alphaclonesystems.com/compliance',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

export default function CompliancePage() {
  return (
    <MarketingLandingShell>
      <MarketingSection>
        <MarketingContainer className="max-w-4xl">
          <h1>Compliance Overview</h1>
          <p className="mt-4 mb-8 text-[var(--marketing-text-secondary)]">
            AlphaClone maintains a transparent trust posture through published legal documentation
            and policy-based operational controls.
          </p>

          <CompanyInfoBlock className="mb-8" />

          <div className="space-y-4 text-sm">
            <div className="mkt-surface p-5">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Data Governance
              </h2>
              <p className="text-[var(--marketing-text-secondary)]">
                Data handling practices are documented in public legal pages and support
                business-grade operational requirements.
              </p>
            </div>
            <div className="mkt-surface p-5">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Customer Transparency
              </h2>
              <p className="text-[var(--marketing-text-secondary)]">
                Policy pages and support channels are maintained for privacy, terms, cookie usage,
                deletion, status communication, and security reporting.
              </p>
            </div>
            <div className="mkt-surface p-5 border-[rgba(20,184,166,0.28)]">
              <h2 className="text-lg font-bold text-[var(--marketing-text-primary)] mb-2">
                Document Access
              </h2>
              <div className="flex flex-wrap gap-4">
                <Link href="/legal" className="text-[var(--marketing-accent-hover)] hover:underline">
                  Legal Hub
                </Link>
                <Link
                  href="/privacy-policy"
                  className="text-[var(--marketing-accent-hover)] hover:underline"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms-of-service"
                  className="text-[var(--marketing-accent-hover)] hover:underline"
                >
                  Terms of Service
                </Link>
                <Link
                  href="/platform-status"
                  className="text-[var(--marketing-accent-hover)] hover:underline"
                >
                  Platform Status
                </Link>
                <Link
                  href="/security-policy"
                  className="text-[var(--marketing-accent-hover)] hover:underline"
                >
                  Security Policy
                </Link>
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingLandingShell>
  );
}
