import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security Policy | AlphaClone Systems',
  description:
    'Security policy for AlphaClone Systems. Covers secure development posture, access controls, incident handling process, and vulnerability reporting contact.',
  keywords: [
    'AlphaClone security',
    'AlphaClone security policy',
    'AlphaClone vulnerability disclosure',
    'AlphaClone data security',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/security-policy' },
  openGraph: {
    title: 'Security Policy | AlphaClone Systems',
    description: 'Security and vulnerability reporting information for AlphaClone.',
    url: 'https://alphaclonesystems.com/security-policy',
    type: 'article',
  },
  robots: { index: true, follow: true },
};

export default function SecurityPolicyPage() {
  return (
    <main className="min-h-screen bg-[#040A12] text-slate-200">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-black text-white mb-4">Security Policy</h1>
        <p className="text-slate-300 mb-8">
          AlphaClone applies a security-first engineering model for platform services, customer data, and production operations.
        </p>

        <div className="space-y-4 text-sm text-slate-300">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Secure Development</h2>
            <p>
              Changes are reviewed before release. Security-sensitive components are monitored and remediated through prioritized engineering workflows.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Access and Data Controls</h2>
            <p>
              Tenant isolation, authentication controls, and policy-driven access checks are used across customer-facing systems.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Incident Response</h2>
            <p>
              Security events are triaged by severity and routed for containment, investigation, and corrective action.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-[#081228]/90 p-5">
            <h2 className="text-lg font-bold text-cyan-200 mb-2">Report a Security Issue</h2>
            <p>
              Send vulnerability reports to{' '}
              <a href="mailto:security@alphaclonesystems.com" className="text-cyan-300 hover:text-cyan-200">
                security@alphaclonesystems.com
              </a>
              .
            </p>
            <p className="mt-2">
              For legal references, visit the <Link href="/legal" className="text-cyan-300 hover:text-cyan-200">Legal and Trust Center</Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

