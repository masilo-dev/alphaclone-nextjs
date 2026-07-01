import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingRelatedLinks from '@/components/landing/MarketingRelatedLinks';
import MarketingProductCta from '@/components/marketing/MarketingProductCta';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AlphaClone Lead Management | Capture and Convert Leads',
  description:
    'AlphaClone lead management supports discovery, qualification, enrichment, outreach control, and conversion tracking for business teams. Integrated with Zoho, Outlook, and Gmail for email outreach.',
  keywords: [
    'AlphaClone leads',
    'lead management platform',
    'lead qualification software',
    'lead pipeline automation',
    'AlphaClone CRM leads',
    'email outreach',
    'Zoho Mail',
    'Outlook',
    'Gmail',
  ],
  alternates: { canonical: absoluteUrl('/lead-management') },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'AlphaClone Lead Management',
    description: 'Capture, qualify, and convert leads using AlphaClone with integrated email outreach via Zoho, Outlook, and Gmail.',
    url: absoluteUrl('/lead-management'),
    type: 'website',
  },
  robots: { index: true, follow: true },
};

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
        <main className="min-h-screen bg-[#040A12] text-slate-200">
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h1 className="text-4xl font-black text-white mb-4">AlphaClone Lead Management</h1>
            <p className="text-slate-300 mb-6">
              Build a repeatable lead engine with qualification logic, source tracking, and controlled outreach pathways. Send emails directly via Zoho Mail, Microsoft Outlook, or Gmail.
            </p>
            <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 text-sm text-slate-300">
              <ul className="space-y-2">
                <li>Lead discovery and enrichment workflows</li>
                <li>Trust and confidence scoring support</li>
                <li>Manual approval or policy-gated outreach automation</li>
                <li>Conversion into CRM opportunities and tasks</li>
                <li>Send emails via Zoho, Outlook, or Gmail</li>
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/login?next=/dashboard/leads/campaigns"
                className="inline-flex items-center justify-center rounded-xl bg-teal-500 hover:bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors"
              >
                Sign in to open Lead Finder
              </Link>
              <Link
                href="/auth/login?register=true&type=business&plan=starter&next=/dashboard/leads/campaigns"
                className="inline-flex items-center justify-center rounded-xl border border-teal-500/40 px-5 py-3 text-sm font-semibold text-teal-300 hover:bg-teal-500/10 transition-colors"
              >
                Start free trial
              </Link>
            </div>
            <MarketingRelatedLinks
              links={[
                { label: 'CRM', href: '/crm' },
                { label: 'AI Agents', href: '/ai-agents' },
              ]}
            />
            <MarketingProductCta />
          </section>
        </main>
      </MarketingLandingShell>
    </>
  );
}
