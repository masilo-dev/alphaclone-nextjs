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

const feature = getFeature('project-management');

export const metadata: Metadata = {
  title: 'AlphaClone Project Management | Delivery Connected to CRM',
  description: feature.summary,
=======
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AlphaClone Project Management | Tasks and Delivery',
  description:
    'AlphaClone project management helps teams plan execution, track tasks, monitor due dates, and deliver client work with operational visibility.',
>>>>>>> origin/main
  keywords: [
    'AlphaClone project management',
    'project management platform',
    'task scheduler',
    'team delivery software',
    'business task management',
  ],
<<<<<<< HEAD
  alternates: { canonical: absoluteUrl('/project-management') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Project Management | Delivery Connected to CRM',
    description: feature.summary,
    url: absoluteUrl('/project-management'),
=======
  alternates: { canonical: 'https://alphaclonesystems.com/project-management' },
  openGraph: {
    title: 'AlphaClone Project Management',
    description: 'Manage tasks, milestones, and delivery workflows in AlphaClone.',
    url: 'https://alphaclonesystems.com/project-management',
>>>>>>> origin/main
    type: 'website',
  },
  robots: { index: true, follow: true },
};

<<<<<<< HEAD
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Project Management', path: '/project-management' },
]);

export default function ProjectManagementPage() {
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
export default function ProjectManagementPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">AlphaClone Project Management</h1>
        <p className="text-slate-300 mb-6">
          Coordinate projects with business context from CRM, billing, and communication flows.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Task scheduling and due-date intelligence</li>
            <li>Milestone tracking and workload visibility</li>
            <li>Delivery alignment with deals, contracts, and invoices</li>
            <li>Unified workspace for execution teams</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/crm" className="text-cyan-300 hover:text-cyan-200">CRM</Link>,{' '}
          <Link href="/video-meetings" className="text-cyan-300 hover:text-cyan-200">Video Meetings</Link>.
        </p>
      </section>
    </main>
  );
}

>>>>>>> origin/main
