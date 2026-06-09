import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Terms of Service | AlphaClone Systems',
  description: 'Terms of service for AlphaClone Systems LLC.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/terms' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'acceptance', title: 'Acceptance' },
  { id: 'service', title: 'Service description' },
  { id: 'account', title: 'Account responsibilities' },
  { id: 'billing', title: 'Subscription and billing' },
  { id: 'use', title: 'Acceptable use' },
  { id: 'ai', title: 'AI features' },
  { id: 'ip', title: 'Intellectual property' },
  { id: 'liability', title: 'Liability and termination' },
  { id: 'law', title: 'Disputes and contact' },
];

export default function Page() {
  return (
    <LegalPageShell
      title="Terms of Service"
      lastUpdated="June 9, 2025"
      intro="These terms govern use of the AlphaClone platform, including subscriptions, AI tools, and third-party integrations."
      sections={sections}
      badge="Terms"
    >
      <section id="acceptance" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Acceptance</h2>
        <p className="text-sm leading-7 text-slate-300">By using AlphaClone Systems LLC services, you agree to these terms and any linked policies.</p>
      </section>
      <section id="service" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Service description</h2>
        <p className="text-sm leading-7 text-slate-300">AlphaClone is a multi-tenant SaaS platform with CRM, invoicing, contracts, project management, social media, email marketing, and AI automation modules, including the Bonnie AI agent.</p>
      </section>
      <section id="account" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Account responsibilities</h2>
        <p className="text-sm leading-7 text-slate-300">You are responsible for your account security, the accuracy of the information you provide, and actions taken by people you allow into your workspace.</p>
      </section>
      <section id="billing" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Subscription and billing</h2>
        <p className="text-sm leading-7 text-slate-300">Plans start at $15 per month and renew automatically unless canceled. Billing is handled through Stripe and may change with prior notice.</p>
      </section>
      <section id="use" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Acceptable use</h2>
        <p className="text-sm leading-7 text-slate-300">Do not scrape the platform, abuse AI features, send spam through our email infrastructure, share credentials, or use the service for illegal or harmful activity.</p>
      </section>
      <section id="ai" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">AI features</h2>
        <p className="text-sm leading-7 text-slate-300">AI-generated output is not guaranteed to be accurate. You are responsible for reviewing it before use or sending it to others.</p>
      </section>
      <section id="ip" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Intellectual property</h2>
        <p className="text-sm leading-7 text-slate-300">AlphaClone owns the platform and its branding. You own your data and content, subject to the limited rights needed for us to operate the service.</p>
      </section>
      <section id="liability" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Liability and termination</h2>
        <p className="text-sm leading-7 text-slate-300">We may suspend or terminate accounts for violations. To the fullest extent allowed by Wyoming law, liability is limited and third-party outages are not our responsibility.</p>
      </section>
      <section id="law" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Disputes and contact</h2>
        <p className="text-sm leading-7 text-slate-300">These terms are governed by Wyoming law. Contact legal@alphaclonesystems.com for questions or disputes.</p>
      </section>
    </LegalPageShell>
  );
}
