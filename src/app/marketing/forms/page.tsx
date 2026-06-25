import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingFeaturePage from '@/components/marketing/MarketingFeaturePage';
import { MARKETING_FEATURES, HUBSPOT_COMPARISON } from '@/config/marketingCopy';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

const f = MARKETING_FEATURES.forms;

export const metadata: Metadata = {
  title: `${f.title} | Alphaclone`,
  description: f.description,
  alternates: { canonical: `${SITE_URL}/marketing/forms` },
};

export default function Page() {
  return (
    <MarketingLandingShell>
      <MarketingFeaturePage
        title={f.title}
        description={f.description}
        bullets={f.bullets}
        comparison={HUBSPOT_COMPARISON}
        competitorName="HubSpot"
      />
    </MarketingLandingShell>
  );
}
