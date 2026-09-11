import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import HowItWorksPage from '@/components/pages/HowItWorksPage';
import { buildMarketingMetadata } from '@/lib/seo/metadata';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'How It Works | Decide, Approve, Execute, Verify',
  description: EXECUTION_LAYER.explanatoryLine,
  pathname: EXECUTION_LAYER.howItWorksPath,
  keywords: [
    'business execution layer',
    'workflow automation with approval',
    'AlphaClone how it works',
    'AI business execution',
  ],
});

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'How It Works', path: EXECUTION_LAYER.howItWorksPath },
]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <MarketingLandingShell>
        <HowItWorksPage />
      </MarketingLandingShell>
    </>
  );
}
