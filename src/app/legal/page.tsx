import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export const metadata: Metadata = {
  title: 'Legal Documents | AlphaClone Systems',
  description:
    'Legal and trust document center for AlphaClone Systems. Access privacy policy, terms of service, cookie policy, data deletion information, platform status, and security references.',
  keywords: [
    'AlphaClone legal',
    'AlphaClone policy',
    'AlphaClone privacy',
    'AlphaClone terms',
    'AlphaClone compliance',
    'AlphaClone trust center',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/legal' },
  openGraph: {
    title: 'Legal Documents | AlphaClone Systems',
    description: 'Central legal and trust document hub for AlphaClone Systems.',
    url: 'https://alphaclonesystems.com/legal',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const legalPages = [
  {
    title: 'Privacy Policy',
    href: '/privacy-policy',
    description: 'Data collection, processing, retention, and user rights.',
  },
  {
    title: 'Terms of Service',
    href: '/terms-of-service',
    description: 'Commercial terms, usage boundaries, and platform responsibilities.',
  },
  {
    title: 'Cookie Policy',
    href: '/cookie-policy',
    description: 'Cookie categories, usage purpose, and preference controls.',
  },
  {
    title: 'Acceptable Use',
    href: '/legal/acceptable-use',
    description: 'Rules for safe and lawful platform use.',
  },
  {
    title: 'Data Requests',
    href: '/legal/data-request',
    description: 'Access, correction, export, or deletion requests.',
  },
  {
    title: 'Refund Policy',
    href: '/legal/refund',
    description: 'Monthly and annual plan refund rules and exceptions.',
  },
  {
    title: 'AI Disclaimer',
    href: '/legal/ai-disclaimer',
    description: 'How to use Bonnie AI safely and responsibly.',
  },
  {
    title: 'Platform Status',
    href: '/platform-status',
    description: 'Service health communication and operational reliability posture.',
  },
  {
    title: 'Security Policy',
    href: '/security-policy',
    description: 'Security principles, vulnerability reporting channel, and safeguards.',
  },
  {
    title: 'Compliance Overview',
    href: '/compliance',
    description: 'Governance and compliance model for business and enterprise use.',
  },
  {
    title: 'Service Level Agreement',
    href: '/sla',
    description: 'Commitment to platform uptime and support response times.',
  },
  {
    title: 'Data Processing Agreement',
    href: '/dpa',
    description: 'Legal framework for data processing, SCCs, sub-processor table, and audit rights.',
  },
  {
    title: 'Privacy Choices (CCPA)',
    href: '/privacy-choices',
    description: 'California privacy rights — Do Not Sell, opt-out, and CCPA/CPRA rights requests.',
  },
];

export default function LegalHubPage() {
  return (
    <MarketingLandingShell>
      <main className="min-h-screen bg-[#040A12] text-slate-200 pt-20">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">Legal and Trust Center</h1>
        <p className="text-slate-300 mb-8">
          All official AlphaClone legal and trust documents are listed here for customers, partners, and search indexing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {legalPages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-5 hover:border-cyan-400/40 transition-colors"
            >
              <h2 className="text-lg font-bold text-cyan-200 mb-2">{page.title}</h2>
              <p className="text-sm text-slate-300">{page.description}</p>
            </Link>
          ))}
        </div>
      </section>
      </main>
    </MarketingLandingShell>
  );
}
