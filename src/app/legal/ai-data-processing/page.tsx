import type { Metadata } from 'next';
import Link from 'next/link';
import { Cpu, ShieldCheck, Lock, EyeOff, UserCheck, AlertTriangle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI & Data Processing Disclosure | Bonnie AI | AlphaClone Systems',
  description:
    'Detailed disclosure of how Bonnie AI processes customer data, guarantees zero model training on customer IP, and enforces tenant isolation.',
  keywords: [
    'Bonnie AI privacy',
    'AI data disclosure',
    'zero training policy',
    'AI safety',
    'tenant data isolation',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/legal/ai-data-processing' },
  robots: { index: true, follow: true },
};

export default function AiDataProcessingPage() {
  return (
    <div className="min-h-screen bg-[var(--marketing-bg-primary)] text-[var(--marketing-text-primary)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-[var(--ws-text-muted)]">
          <Link href="/legal" className="hover:text-[var(--brand-blue-300)]">
            Legal & Trust Center
          </Link>
          <span>/</span>
          <span className="text-[var(--ws-text-secondary)]">AI & Data Processing</span>
        </nav>

        {/* Title */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-[var(--brand-blue-300)] text-xs font-semibold uppercase tracking-wider mb-4">
            <Cpu className="w-3.5 h-3.5" />
            Bonnie AI Architecture & Transparency
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AI Data Processing & Safety Disclosure
          </h1>
          <p className="mt-4 text-base text-[var(--ws-text-secondary)] leading-relaxed">
            At AlphaClone Systems, we believe that AI automation should enhance business productivity without
            compromising client privacy, trade secrets, or regulatory compliance. This disclosure sets forth our
            uncompromising commitments regarding how Bonnie AI handles your commercial data.
          </p>
        </div>

        {/* Core Guarantees Grid */}
        <div className="grid gap-6 sm:grid-cols-2 mb-12">
          <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <EyeOff className="w-6 h-6 text-[var(--brand-blue-300)]" />
              <h3 className="text-lg font-bold text-white">No Model Training</h3>
            </div>
            <p className="text-sm text-[var(--ws-text-secondary)] leading-relaxed">
              Your business records, customer CRM details, financial invoices, proposals, and proprietary contracts
              are <strong>NEVER used to train, retrain, or improve</strong> foundation AI models (such as Claude or OpenAI).
              All API connections enforce strict zero-data-retention training exclusions.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-6 h-6 text-[var(--brand-blue-300)]" />
              <h3 className="text-lg font-bold text-white">Strict Tenant Isolation</h3>
            </div>
            <p className="text-sm text-[var(--ws-text-secondary)] leading-relaxed">
              Every AI operation is strictly constrained by PostgreSQL Row-Level Security (RLS) to the authenticated
              tenant. Bonnie AI can never access, query, or leak information across organizational boundaries.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="w-6 h-6 text-[var(--brand-blue-300)]" />
              <h3 className="text-lg font-bold text-white">Human-in-the-Loop Controls</h3>
            </div>
            <p className="text-sm text-[var(--ws-text-secondary)] leading-relaxed">
              High-impact business operations—including sending financial invoices, issuing binding client contracts,
              transmitting outreach campaigns, and booking appointments—require explicit user review and confirmation
              prior to execution.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/60 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-6 h-6 text-[var(--brand-blue-300)]" />
              <h3 className="text-lg font-bold text-white">Data Encryption & Ephemerality</h3>
            </div>
            <p className="text-sm text-[var(--ws-text-secondary)] leading-relaxed">
              Data transmitted to LLM API endpoints travels exclusively over TLS 1.3 encrypted channels. Prompts and
              context payloads exist in transit only for the duration of inference generation and are not stored in
              vendor inference pools.
            </p>
          </div>
        </div>

        {/* Deep Dive Sections */}
        <div className="space-y-10 text-[var(--ws-text-secondary)] leading-relaxed text-sm">
          <section className="rounded-2xl border border-[var(--ws-border)]/80 bg-[var(--ws-canvas)] p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">1. How Bonnie AI Works</h2>
            <p>
              Bonnie AI functions as an execution copilot and conversational orchestration engine embedded across
              AlphaClone modules (CRM, Proposals, Billing, Social, Calendar, and Documents). When a user prompts
              Bonnie AI, the application compiles the relevant contextual metadata (e.g. the active client record or
              contract draft) and submits it via enterprise API gateways.
            </p>
            <p>
              The response is streamed back to the client interface where users may edit, refine, approve, or discard
              the generated output.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--ws-border)]/80 bg-[var(--ws-canvas)] p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">2. Supported LLM Infrastructure</h2>
            <p>
              AlphaClone engages vetted enterprise AI infrastructure providers governed by commercial data processing
              agreements:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--ws-text-secondary)] pl-2">
              <li>
                <strong>Anthropic, PBC:</strong> Primary reasoning and natural language drafting. Bound by Anthropic
                Commercial Terms and GDPR Standard Contractual Clauses.
              </li>
              <li>
                <strong>OpenAI, LLC:</strong> Semantic analysis and vector operations under Enterprise API data
                commitments.
              </li>
              <li>
                <strong>DeepSeek Technologies:</strong> Specialized code generation and structured reasoning engines.
              </li>
            </ul>
            <p className="text-xs text-[var(--ws-text-muted)] mt-2">
              For complete subprocessor details, consult our{' '}
              <Link href="/legal/subprocessors" className="text-[var(--brand-blue-300)] hover:underline">
                Subprocessor Directory
              </Link>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--ws-border)]/80 bg-[var(--ws-canvas)] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2 text-[var(--warning-text,var(--warning-500))] font-semibold text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>3. User Responsibility & Professional Verification</span>
            </div>
            <p>
              While Bonnie AI utilizes advanced reasoning capabilities, AI outputs may occasionally contain errors,
              omissions, or hallucinations. Bonnie AI does not provide formal legal, tax, medical, or accounting
              advice. Users must exercise their own independent business judgment and review all legal agreements,
              invoices, and tax filings before binding their enterprise.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--ws-border)]/80 pt-8 text-sm text-[var(--ws-text-muted)]">
          <p>Effective Date: October 1, 2026</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="hover:text-[var(--brand-blue-300)]">
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className="hover:text-[var(--brand-blue-300)]">
              Terms of Service
            </Link>
            <Link href="/legal/ai-disclaimer" className="hover:text-[var(--brand-blue-300)]">
              AI Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
