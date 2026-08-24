import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export const metadata: Metadata = {
  title: 'Platform Status | AlphaClone Systems',
  description:
    'Official AlphaClone platform status page. Service health, uptime posture, incident communication model, and operational reliability practices.',
  keywords: [
    'AlphaClone status',
    'AlphaClone platform status',
    'AlphaClone uptime',
    'AlphaClone reliability',
    'AlphaClone incident status',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/platform-status' },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Platform Status | AlphaClone Systems',
    description:
      'Service health and reliability information for AlphaClone Systems.',
    url: 'https://alphaclonesystems.com/platform-status',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function PlatformStatusPage() {
  return (
    <MarketingLandingShell>
      <main className="min-h-screen bg-[#040A12] text-slate-200 pt-20">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">Platform Status</h1>
        <p className="text-slate-300 mb-8">
          This page describes current service posture and the way AlphaClone communicates reliability events.
        </p>

        <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-6 mb-6">
          <h2 className="text-xl font-bold text-cyan-200 mb-3">Current Service State</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Core web application: Operational</li>
            <li>Authentication and workspace access: Operational</li>
            <li>Lead and CRM modules: Operational</li>
            <li>Revenue and legal modules: Operational</li>
            <li>Social automation workflows: Operational</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-3">Operational Commitments</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Incidents are logged, triaged, and resolved with internal severity priorities.</li>
            <li>Customer-visible interruptions receive public status updates as needed.</li>
            <li>Post-incident improvements are prioritized in engineering delivery cycles.</li>
            <li>Security-sensitive issues are handled through a dedicated security channel.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Related Legal and Trust Documents</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/legal" className="text-cyan-300 hover:text-cyan-200">Legal Hub</Link>
            <Link href="/privacy-policy" className="text-cyan-300 hover:text-cyan-200">Privacy Policy</Link>
            <Link href="/terms-of-service" className="text-cyan-300 hover:text-cyan-200">Terms of Service</Link>
            <Link href="/cookie-policy" className="text-cyan-300 hover:text-cyan-200">Cookie Policy</Link>
            <Link href="/data-deletion" className="text-cyan-300 hover:text-cyan-200">Data Deletion</Link>
          </div>
        </div>
      </section>
      </main>
    </MarketingLandingShell>
  );
}

