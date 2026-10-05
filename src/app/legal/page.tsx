import type { Metadata } from 'next';
import Link from 'next/link';
import CompanyInfoBlock from '@/components/marketing/CompanyInfoBlock';
import { Shield, Lock, FileText, Cpu, Server, Sliders, Database, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Legal, Privacy & Trust Compliance Center | AlphaClone Systems',
  description:
    'Canonical legal agreements, privacy policies, cookie controls, subprocessors directory, and AI compliance governance for AlphaClone Systems.',
  keywords: [
    'AlphaClone legal',
    'AlphaClone privacy',
    'AlphaClone terms',
    'AlphaClone compliance',
    'AlphaClone trust center',
    'AlphaClone subprocessors',
    'cookie preferences',
    'GDPR compliance',
  ],
  alternates: { canonical: 'https://alphaclonesystems.com/legal' },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Legal, Privacy & Trust Compliance Center | AlphaClone Systems',
    description: 'Central legal, privacy, cookie consent, and trust compliance hub for AlphaClone Systems.',
    url: 'https://alphaclonesystems.com/legal',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const coreComplianceHub = [
  {
    title: 'Privacy Policy',
    href: '/legal/privacy',
    description: 'Personal data collection, processing purposes, retention periods, international transfers, and user rights under GDPR, CCPA, and POPIA.',
    icon: Shield,
    badge: 'Core Policy',
  },
  {
    title: 'Terms of Service',
    href: '/legal/terms',
    description: 'Commercial service terms, platform usage rights, intellectual property ownership, subscription tiers, SLA, and liability limitations.',
    icon: FileText,
    badge: 'Commercial',
  },
  {
    title: 'Cookie Policy & Controls',
    href: '/legal/cookies',
    description: 'Comprehensive breakdown of essential, functional, analytics, and marketing cookies with real-time preference management.',
    icon: Sliders,
    badge: 'Consent',
  },
  {
    title: 'Data Processing Agreement (DPA)',
    href: '/legal/dpa',
    description: 'Standard Contractual Clauses (SCCs), technical and organizational measures (TOMs), audit rights, and processor commitments for business clients.',
    icon: Lock,
    badge: 'B2B GDPR',
  },
  {
    title: 'Authorized Subprocessors',
    href: '/legal/subprocessors',
    description: 'Complete directory of third-party cloud infrastructure, database, payment, and AI inference partners with locations and transfer safeguards.',
    icon: Server,
    badge: 'Infrastructure',
  },
  {
    title: 'AI & Data Processing Disclosure',
    href: '/legal/ai-data-processing',
    description: 'Transparency commitments regarding Bonnie AI: zero customer data training, strict tenant RLS boundaries, and human-in-the-loop controls.',
    icon: Cpu,
    badge: 'AI Safety',
  },
  {
    title: 'Data Subject Rights & DSAR',
    href: '/legal/data-request',
    description: 'Submit verified data access, portable data export, rectification, restriction, or account deletion requests under GDPR and CCPA.',
    icon: Database,
    badge: 'Privacy Rights',
  },
  {
    title: 'Acceptable Use Policy',
    href: '/legal/acceptable-use',
    description: 'Prohibited activities, communications safety standards, security boundaries, and enforcement rules across our AI Execution Layer.',
    icon: FileText,
    badge: 'Security',
  },
];

const supportingTrustDocs = [
  { title: 'Refund Policy', href: '/legal/refund', description: 'Monthly & annual subscription refund terms.' },
  { title: 'Platform Status', href: '/platform-status', description: 'Live operational health and incident history.' },
  { title: 'Security Architecture', href: '/security-policy', description: 'Vulnerability disclosures and security controls.' },
  { title: 'Enterprise Compliance Overview', href: '/compliance', description: 'Governance framework for service agencies.' },
  { title: 'Service Level Agreement (SLA)', href: '/sla', description: 'Platform uptime guarantees and support response tiers.' },
  { title: 'California Privacy Choices (CCPA)', href: '/privacy-choices', description: 'Do Not Sell / Share personal information requests.' },
];

export default function LegalHubPage() {
  return (
    <div className="min-h-screen bg-[var(--marketing-bg-primary)] text-[var(--marketing-text-primary)]">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-[var(--brand-blue-300)] text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            Compliance, Privacy & Trust Hub
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Legal & Compliance Center
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[var(--ws-text-secondary)] leading-relaxed">
            AlphaClone Systems LLC provides transparent, legally binding terms and privacy controls designed to
            protect your business, enforce strict data confidentiality, and comply with international regulations.
          </p>
        </div>

        {/* Company Legal Entity Block */}
        <CompanyInfoBlock className="mb-12" />

        {/* Primary Governance Documents */}
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <span>Primary Platform Agreements & Disclosures</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          {coreComplianceHub.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link
                key={doc.href}
                href={doc.href}
                className="group relative rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-canvas)]/70 p-6 transition-all duration-200 hover:border-teal-500/50 hover:bg-[var(--ws-panel)]/60 shadow-lg shadow-black/40 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-2.5 text-[var(--brand-blue-300)] group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] text-[var(--ws-text-secondary)]">
                      {doc.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-[var(--brand-blue-300)] transition-colors">
                    {doc.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--ws-text-muted)] leading-relaxed">
                    {doc.description}
                  </p>
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-blue-300)] group-hover:text-teal-200">
                  <span>View Document</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Supporting Policies & Trust Links */}
        <h2 className="text-xl font-bold text-white mb-4">Supporting Policies & Trust References</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {supportingTrustDocs.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-[var(--ws-border)]/80 bg-[var(--ws-canvas)]/50 p-4 transition-colors hover:border-[var(--ws-border)] hover:bg-[var(--ws-panel)]/40"
            >
              <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-[var(--ws-text-muted)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
