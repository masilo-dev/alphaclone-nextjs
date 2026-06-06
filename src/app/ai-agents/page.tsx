import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AlphaClone AI Agents | Business Automation Agents',
  description:
    'AlphaClone AI agents execute business workflows across CRM, lead operations, project delivery, and communication tasks with policy controls.',
  keywords: [
    'AlphaClone AI agents',
    'business AI agents',
    'AI workflow automation',
    'autonomous business agents',
    'AlphaClone AI automation',
  ],
  alternates: { canonical: absoluteUrl('/ai-agents') },
  openGraph: {
    title: 'AlphaClone AI Agents',
    description: 'Automate business workflows with AlphaClone AI agents.',
    url: absoluteUrl('/ai-agents'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'AI Agents', path: '/ai-agents' },
]);

export default function AiAgentsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MarketingLandingShell>
        <main className="min-h-screen bg-[#040A12] text-slate-200">
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-white mb-4">AlphaClone AI Agents</h1>
            <p className="text-slate-300 mb-6">
              Run automation agents for lead qualification, follow-up preparation, and operational execution inside one platform.
            </p>
            <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
              <ul className="space-y-2">
                <li>Agent-assisted lead workflows and routing</li>
                <li>Task generation with due-date awareness</li>
                <li>Workflow execution from conversational commands</li>
                <li>Controlled automation with approval and policy gating</li>
              </ul>
            </div>
            <MarketingRelatedLinks
              links={[
                { label: 'Claude and Manus Integrations', href: '/claude-manus-integrations' },
                { label: 'Lead Management', href: '/lead-management' },
              ]}
            />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
