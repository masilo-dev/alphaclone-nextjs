import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import CompanyInfoBlock from '@/components/marketing/CompanyInfoBlock';

export const metadata: Metadata = {
  title: 'Compliance Overview | AlphaClone Systems',
  description:
    'Compliance overview for AlphaClone Systems. Governance posture, legal transparency, privacy coverage, and enterprise trust documentation references.',
  keywords: [
    'AlphaClone compliance',
    'AlphaClone governance',
    'AlphaClone legal',
    'AlphaClone enterprise trust',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/compliance' },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Compliance Overview | AlphaClone Systems',
    description: 'Compliance and governance overview for AlphaClone.',
    url: 'https://alphaclonesystems.com/compliance',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

export default function CompliancePage() {
  return (
    <MarketingLandingShell>
      <main className="min-h-screen bg-[#040A12] text-slate-200">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">Compliance Overview</h1>
        <p className="text-slate-300 mb-8">
          AlphaClone maintains a transparent trust posture through published legal documentation and policy-based operational controls.
        </p>

        <CompanyInfoBlock className="mb-8" />

        <div className="space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Data Governance</h2>
            <p className="text-slate-300">
              Data handling practices are documented in public legal pages and support business-grade operational requirements.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Customer Transparency</h2>
            <p className="text-slate-300">
              Policy pages and support channels are maintained for privacy, terms, cookie usage, deletion, status communication, and security reporting.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Document Access</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/legal" className="text-cyan-300 hover:text-cyan-200">Legal Hub</Link>
              <Link href="/privacy-policy" className="text-cyan-300 hover:text-cyan-200">Privacy Policy</Link>
              <Link href="/terms-of-service" className="text-cyan-300 hover:text-cyan-200">Terms of Service</Link>
              <Link href="/platform-status" className="text-cyan-300 hover:text-cyan-200">Platform Status</Link>
              <Link href="/security-policy" className="text-cyan-300 hover:text-cyan-200">Security Policy</Link>
            </div>
          </div>
        </div>
      </section>
      </main>
    </MarketingLandingShell>
  );
}

