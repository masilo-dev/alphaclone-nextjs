import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AlphaClone CRM | Business CRM Platform',
  description:
    'AlphaClone CRM helps businesses manage pipeline, contacts, and deal execution in one platform with integrated tasks, billing context, AI assistance, and email outreach via Zoho, Outlook, and Gmail.',
  keywords: [
    'AlphaClone CRM',
    'CRM platform',
    'business CRM software',
    'deal pipeline CRM',
    'AlphaClone leads and CRM',
    'email integration',
    'Zoho Mail',
    'Outlook',
    'Gmail',
  ],
  alternates: { canonical: absoluteUrl('/crm') },
  openGraph: {
    title: 'AlphaClone CRM | Business CRM Platform',
    description: 'Manage pipeline, contacts, and deal execution in AlphaClone CRM with integrated email via Zoho, Outlook, and Gmail.',
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
        <main className="min-h-screen bg-[#040A12] text-slate-200">
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-white mb-4">AlphaClone CRM</h1>
            <p className="text-slate-300 mb-6">
              AlphaClone CRM connects lead capture, pipeline progression, and revenue execution in one business workspace. Send emails directly via Zoho Mail, Microsoft Outlook, or Gmail.
            </p>
            <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
              <ul className="space-y-2">
                <li>Centralized contacts and lead history</li>
                <li>Deal stage tracking and revenue forecast alignment</li>
                <li>Task, meeting, and contract visibility within CRM records</li>
                <li>Integrated with lead management and AI agent workflows</li>
                <li>Send emails via Zoho, Outlook, or Gmail</li>
              </ul>
            </div>
            <MarketingRelatedLinks
              links={[
                { label: 'Lead Management', href: '/lead-management' },
                { label: 'Project Management', href: '/project-management' },
                { label: 'AI Agents', href: '/ai-agents' },
              ]}
            />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
