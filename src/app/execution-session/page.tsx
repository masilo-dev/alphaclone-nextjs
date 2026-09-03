import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import ExecutionSessionPage from '@/components/pages/ExecutionSessionPage';
import { buildMarketingMetadata } from '@/lib/seo/metadata';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';

export const metadata: Metadata = buildMarketingMetadata({
  title: 'Execution Session | Map One Workflow',
  description:
    'Bring one repetitive workflow to an AlphaClone Execution Session. We map the process, assess fit, and demonstrate controlled execution with your approval.',
  pathname: EXECUTION_LAYER.executionSessionPath,
  keywords: [
    'business workflow assessment',
    'AlphaClone demo',
    'execution layer consultation',
    'small business automation fit',
  ],
});

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Execution Session', path: EXECUTION_LAYER.executionSessionPath },
]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <MarketingLandingShell>
        <ExecutionSessionPage />
      </MarketingLandingShell>
    </>
  );
}
