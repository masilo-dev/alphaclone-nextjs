import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import MarketingProductCta from '@/components/marketing/MarketingProductCta';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AlphaClone Video Meetings | Built-In Business Meetings',
  description:
    'AlphaClone video meetings provide integrated business conferencing connected to CRM records, projects, and follow-up workflows. No video demo required.',
  keywords: [
    'AlphaClone video meetings',
    'business video meetings',
    'integrated meeting platform',
    'CRM connected meetings',
    'team collaboration video',
  ],
  alternates: { canonical: absoluteUrl('/video-meetings') },
  openGraph: {
    title: 'AlphaClone Video Meetings',
    description: 'Integrated video meetings linked with CRM and operations.',
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
            <MarketingRelatedLinks
              links={[
                { label: 'Project Management', href: '/project-management' },
                { label: 'CRM', href: '/crm' },
              ]}
            />
            <MarketingProductCta />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
