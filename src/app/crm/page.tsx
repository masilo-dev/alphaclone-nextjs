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

const feature = getFeature('crm');

export const metadata: Metadata = {
  title: 'AlphaClone CRM | Connected Client Records',
  description: feature.summary,
  keywords: [
    'AlphaClone CRM',
    'CRM platform',
    'business CRM software',
    'deal pipeline CRM',
    'client records',
  ],
  alternates: { canonical: absoluteUrl('/crm') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone CRM | Connected Client Records',
    description: feature.summary,
    url: absoluteUrl('/crm'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'CRM', path: '/crm' },
]);

export default function CrmPage() {
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
