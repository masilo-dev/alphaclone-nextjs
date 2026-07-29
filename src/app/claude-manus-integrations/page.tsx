import type { Metadata } from 'next';
<<<<<<< HEAD
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';
=======
import Link from 'next/link';
>>>>>>> origin/main

export const metadata: Metadata = {
  title: 'AlphaClone Claude and Manus Integrations',
  description:
<<<<<<< HEAD
    'Use Claude and Manus integrations with AlphaClone to support AI-assisted CRM, lead research, project execution, and business workflow automation. Also supports DeepSeek V3/R1.',
=======
    'Use Claude and Manus integrations with AlphaClone to support AI-assisted CRM, lead research, project execution, and business workflow automation.',
>>>>>>> origin/main
  keywords: [
    'AlphaClone Claude integration',
    'AlphaClone Manus integration',
    'Claude MCP integration',
    'Manus MCP integration',
    'AI integrations for CRM',
<<<<<<< HEAD
    'DeepSeek',
  ],
  alternates: { canonical: absoluteUrl('/claude-manus-integrations') },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Claude and Manus Integrations',
    description: 'Connect Claude, Manus, and DeepSeek workflows to AlphaClone business operations.',
    url: absoluteUrl('/claude-manus-integrations'),
=======
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/claude-manus-integrations' },
  openGraph: {
    title: 'AlphaClone Claude and Manus Integrations',
    description: 'Connect Claude and Manus workflows to AlphaClone business operations.',
    url: 'https://alphaclonesystems.com/claude-manus-integrations',
>>>>>>> origin/main
    type: 'website',
  },
  robots: { index: true, follow: true },
};

<<<<<<< HEAD
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Claude and Manus Integrations', path: '/claude-manus-integrations' },
]);

export default function ClaudeManusIntegrationsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <MarketingLandingShell>
        <main className="min-h-screen bg-[#040A12] text-slate-200">
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-white mb-4">Claude and Manus Integrations</h1>
            <p className="text-slate-300 mb-6">
              AlphaClone supports AI integration patterns that help businesses execute CRM, lead, and project workflows with assisted intelligence. Also supports DeepSeek V3/R1.
            </p>
            <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
              <ul className="space-y-2">
                <li>Integration-ready workspace model for AI assistants</li>
                <li>Lead research and qualification support workflows</li>
                <li>Drafting and automation support across revenue operations</li>
                <li>Business-controlled execution with platform policies</li>
                <li>DeepSeek V3/R1 support for intelligent reasoning</li>
              </ul>
            </div>
            <MarketingRelatedLinks
              links={[
                { label: 'AI Agents', href: '/ai-agents' },
                { label: 'Lead Management', href: '/lead-management' },
              ]}
            />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
=======
export default function ClaudeManusIntegrationsPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">Claude and Manus Integrations</h1>
        <p className="text-slate-300 mb-6">
          AlphaClone supports AI integration patterns that help businesses execute CRM, lead, and project workflows with assisted intelligence.
        </p>
        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
          <ul className="space-y-2">
            <li>Integration-ready workspace model for AI assistants</li>
            <li>Lead research and qualification support workflows</li>
            <li>Drafting and automation support across revenue operations</li>
            <li>Business-controlled execution with platform policies</li>
          </ul>
        </div>
        <p className="mt-6 text-sm">
          Related pages: <Link href="/ai-agents" className="text-cyan-300 hover:text-cyan-200">AI Agents</Link>,{' '}
          <Link href="/lead-management" className="text-cyan-300 hover:text-cyan-200">Lead Management</Link>.
        </p>
      </section>
    </main>
  );
}

>>>>>>> origin/main
