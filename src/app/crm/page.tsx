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

const feature = getFeature('crm');

export const metadata: Metadata = {
  title: 'AlphaClone CRM | Connected Client Records',
  description: feature.summary,
=======
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AlphaClone CRM | Business CRM Platform',
  description:
    'AlphaClone CRM helps businesses manage pipeline, contacts, and deal execution in one platform with integrated tasks, billing context, and AI assistance.',
>>>>>>> origin/main
  keywords: [
    'AlphaClone CRM',
    'CRM platform',
    'business CRM software',
    'deal pipeline CRM',
<<<<<<< HEAD
    'client records',
  ],
  alternates: { canonical: absoluteUrl('/crm') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone CRM | Connected Client Records',
    description: feature.summary,
    url: absoluteUrl('/crm'),
=======
    'AlphaClone leads and CRM',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/crm' },
  openGraph: {
    title: 'AlphaClone CRM | Business CRM Platform',
    description: 'Manage pipeline, contacts, and deal execution in AlphaClone CRM.',
    url: 'https://alphaclonesystems.com/crm',
>>>>>>> origin/main
    type: 'website',
  },
  robots: { index: true, follow: true },
};

<<<<<<< HEAD
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
=======
export default function CrmPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">AlphaClone CRM</h1>
        <p className="text-slate-300 mb-6">
          AlphaClone CRM connects lead capture, pipeline progression, and revenue execution in one business workspace.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Centralized contacts and lead history</li>
            <li>Deal stage tracking and revenue forecast alignment</li>
            <li>Task, meeting, and contract visibility within CRM records</li>
            <li>Integrated with lead management and AI agent workflows</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/lead-management" className="text-cyan-300 hover:text-cyan-200">Lead Management</Link>,{' '}
          <Link href="/project-management" className="text-cyan-300 hover:text-cyan-200">Project Management</Link>,{' '}
          <Link href="/ai-agents" className="text-cyan-300 hover:text-cyan-200">AI Agents</Link>.
        </p>
      </section>
    </main>
  );
}

>>>>>>> origin/main
