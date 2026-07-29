import type { Metadata } from 'next';
<<<<<<< HEAD
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
=======
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AlphaClone Video Meetings | Built-In Business Meetings',
  description:
    'AlphaClone video meetings provide integrated business conferencing connected to CRM records, projects, and follow-up workflows.',
>>>>>>> origin/main
  keywords: [
    'AlphaClone video meetings',
    'business video meetings',
    'integrated meeting platform',
    'CRM connected meetings',
    'team collaboration video',
  ],
<<<<<<< HEAD
  alternates: { canonical: absoluteUrl('/video-meetings') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Video Meetings | Client Calls With Context',
    description: feature.summary,
    url: absoluteUrl('/video-meetings'),
=======
  alternates: { canonical: 'https://alphaclonesystems.com/video-meetings' },
  openGraph: {
    title: 'AlphaClone Video Meetings',
    description: 'Integrated video meetings linked with CRM and operations.',
    url: 'https://alphaclonesystems.com/video-meetings',
>>>>>>> origin/main
    type: 'website',
  },
  robots: { index: true, follow: true },
};

<<<<<<< HEAD
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
=======
export default function VideoMeetingsPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">AlphaClone Video Meetings</h1>
        <p className="text-slate-300 mb-6">
          Conduct meetings without leaving AlphaClone, with context tied to deals, leads, and project actions.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Video sessions linked to business records</li>
            <li>Operational follow-up actions after meetings</li>
            <li>Unified workspace for scheduling and communication</li>
            <li>Business-grade collaboration without tool fragmentation</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/project-management" className="text-cyan-300 hover:text-cyan-200">Project Management</Link>,{' '}
          <Link href="/crm" className="text-cyan-300 hover:text-cyan-200">CRM</Link>.
        </p>
      </section>
    </main>
  );
}

>>>>>>> origin/main
