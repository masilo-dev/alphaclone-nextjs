import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import ReliabilityPage from '@/components/pages/ReliabilityPage';
import { buildMarketingMetadata } from '@/lib/seo/metadata';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Reliability & Control | Trust Center',
  description:
    'How AlphaClone handles approvals, retries, integration limits, and honest boundaries. You direct; AlphaClone executes with visible results.',
  pathname: EXECUTION_LAYER.reliabilityPath,
  keywords: [
    'AlphaClone reliability',
    'workflow approval controls',
    'business automation trust',
    'integration limitations',
  ],
});

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Reliability', path: EXECUTION_LAYER.reliabilityPath },
]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <MarketingLandingShell>
        <ReliabilityPage />
      </MarketingLandingShell>
    </>
  );
}
