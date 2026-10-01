import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ExternalLink, Server, Mail, CheckCircle2 } from 'lucide-react';
import { PLATFORM_SUBPROCESSORS } from '@/config/subprocessors';

export const metadata: Metadata = {
  title: 'Subprocessors & Infrastructure Partners | AlphaClone Systems',
  description:
    'Comprehensive directory of authorized third-party subprocessors utilized by AlphaClone Systems to deliver our AI Business OS and cloud infrastructure.',
  keywords: [
    'AlphaClone subprocessors',
    'GDPR subprocessors',
    'data processing agreement',
    'cloud infrastructure',
    'security vendors',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/legal/subprocessors' },
  robots: { index: true, follow: true },
};

export default function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-[var(--marketing-bg-primary)] text-[var(--marketing-text-primary)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/legal" className="hover:text-teal-300">
            Legal & Trust Center
          </Link>
          <span>/</span>
          <span className="text-slate-200">Subprocessors</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            GDPR Article 28 Compliance
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Authorized Subprocessors
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-300 leading-relaxed">
            AlphaClone Systems LLC engages third-party infrastructure and service providers
            (&quot;Subprocessors&quot;) to perform various functions necessary for providing our AI Business
            Execution Layer. All subprocessors are vetted for security, compliance, and confidentiality, and are
            bound by Data Processing Agreements with Standard Contractual Clauses (SCCs).
          </p>
        </div>

        {/* Change Notification Notice */}
        <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Subprocessor Change Notification:</strong> In accordance with our{' '}
              <Link href="/legal/dpa" className="text-teal-300 hover:underline">
                Data Processing Agreement
              </Link>
              , AlphaClone will provide customers with at least 14 days prior notice before engaging any new
              subprocessor. To subscribe to email alerts for subprocessor updates, submit a notice request to{' '}
              <a href="mailto:privacy@alphaclonesystems.com" className="text-teal-300 hover:underline">
                privacy@alphaclonesystems.com
              </a>
              .
            </div>
          </div>
        </div>

        {/* Subprocessors Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl">
          <table className="w-full text-left text-sm text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th scope="col" className="px-6 py-4">Subprocessor</th>
                <th scope="col" className="px-6 py-4">Purpose & Processing Role</th>
                <th scope="col" className="px-6 py-4">Data Processed</th>
                <th scope="col" className="px-6 py-4">Location</th>
                <th scope="col" className="px-6 py-4">Transfer Safeguard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {PLATFORM_SUBPROCESSORS.map((sp) => (
                <tr key={sp.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <span>{sp.name}</span>
                      <a
                        href={sp.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-teal-300"
                        aria-label={`Visit ${sp.name} website`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <span className="block text-xs font-normal text-slate-400 mt-0.5">
                      {sp.corporateEntity}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs leading-relaxed text-slate-300">
                    {sp.purpose}
                  </td>
                  <td className="px-6 py-4 max-w-xs text-xs text-slate-400 leading-relaxed">
                    {sp.dataProcessed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{sp.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-teal-300">
                    {sp.safeguard}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Support Notice */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80 pt-8 text-sm text-slate-400">
          <p>Last audited and published: October 1, 2026</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/dpa" className="hover:text-teal-300">
              Data Processing Agreement
            </Link>
            <Link href="/legal/privacy" className="hover:text-teal-300">
              Privacy Policy
            </Link>
            <a
              href="mailto:privacy@alphaclonesystems.com"
              className="inline-flex items-center gap-1 text-teal-300 hover:underline"
            >
              <Mail className="w-4 h-4" />
              Contact Privacy Team
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
