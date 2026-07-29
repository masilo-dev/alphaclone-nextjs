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

const feature = getFeature('lead-management');

export const metadata: Metadata = {
  title: 'AlphaClone Lead Management | Capture and Route Leads',
  description: feature.summary,
=======
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AlphaClone Lead Management | Capture and Convert Leads',
  description:
    'AlphaClone lead management supports discovery, qualification, enrichment, outreach control, and conversion tracking for business teams.',
>>>>>>> origin/main
  keywords: [
    'AlphaClone leads',
    'lead management platform',
    'lead qualification software',
    'lead pipeline automation',
    'AlphaClone CRM leads',
  ],
<<<<<<< HEAD
  alternates: { canonical: absoluteUrl('/lead-management') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Lead Management | Capture and Route Leads',
    description: feature.summary,
    url: absoluteUrl('/lead-management'),
=======
  alternates: { canonical: 'https://alphaclonesystems.com/lead-management' },
  openGraph: {
    title: 'AlphaClone Lead Management',
    description: 'Capture, qualify, and convert leads using AlphaClone.',
    url: 'https://alphaclonesystems.com/lead-management',
>>>>>>> origin/main
    type: 'website',
  },
  robots: { index: true, follow: true },
};

<<<<<<< HEAD
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
=======
export default function LeadManagementPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">AlphaClone Lead Management</h1>
        <p className="text-slate-300 mb-6">
          Build a repeatable lead engine with qualification logic, source tracking, and controlled outreach pathways.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Lead discovery and enrichment workflows</li>
            <li>Trust and confidence scoring support</li>
            <li>Manual approval or policy-gated outreach automation</li>
            <li>Conversion into CRM opportunities and tasks</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/crm" className="text-cyan-300 hover:text-cyan-200">CRM</Link>,{' '}
          <Link href="/ai-agents" className="text-cyan-300 hover:text-cyan-200">AI Agents</Link>.
        </p>
      </section>
    </main>
  );
}

>>>>>>> origin/main
