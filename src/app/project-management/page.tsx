import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AlphaClone Project Management | Tasks and Delivery',
  description:
    'AlphaClone project management helps teams plan execution, track tasks, monitor due dates, and deliver client work with operational visibility.',
  keywords: [
    'AlphaClone project management',
    'project management platform',
    'task scheduler',
    'team delivery software',
    'business task management',
  ],
  alternates: { canonical: absoluteUrl('/project-management') },
  openGraph: {
    title: 'AlphaClone Project Management',
    description: 'Manage tasks, milestones, and delivery workflows in AlphaClone.',
    url: absoluteUrl('/project-management'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

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
            <MarketingRelatedLinks
              links={[
                { label: 'CRM', href: '/crm' },
                { label: 'Video Meetings', href: '/video-meetings' },
              ]}
            />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
