import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import ProductPageTemplate from '@/components/marketing/system/ProductPageTemplate';
import {
  MARKETING_PRODUCT_FEATURES,
  type MarketingProductFeature,
} from '@/lib/marketing/productFeatures';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

function getFeature(slug: string): MarketingProductFeature {
  const feature = MARKETING_PRODUCT_FEATURES.find((item) => item.slug === slug);
  if (!feature) {
    throw new Error(`Missing ${slug} marketing feature content.`);
  }
  return feature;
}

const feature = getFeature('lead-management');

export const metadata: Metadata = {
  title: 'AlphaClone Lead Management | Capture and Route Leads',
  description: feature.summary,
  keywords: [
    'AlphaClone leads',
    'lead management platform',
    'lead qualification software',
    'lead pipeline automation',
    'AlphaClone CRM leads',
  ],
  alternates: { canonical: absoluteUrl('/lead-management') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Lead Management | Capture and Route Leads',
    description: feature.summary,
    url: absoluteUrl('/lead-management'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Lead Management', path: '/lead-management' },
]);

export default function LeadManagementPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MarketingLandingShell>
        <ProductPageTemplate feature={feature} />
      </MarketingLandingShell>
    </>
  );
}
