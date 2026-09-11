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

const feature = getFeature('video-meetings');

export const metadata: Metadata = {
  title: 'AlphaClone Video Meetings | Client Calls With Context',
  description: feature.summary,
  keywords: [
    'AlphaClone video meetings',
    'business video meetings',
    'integrated meeting platform',
    'CRM connected meetings',
    'team collaboration video',
  ],
  alternates: { canonical: absoluteUrl('/video-meetings') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Video Meetings | Client Calls With Context',
    description: feature.summary,
    url: absoluteUrl('/video-meetings'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Video Meetings', path: '/video-meetings' },
]);

export default function VideoMeetingsPage() {
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
