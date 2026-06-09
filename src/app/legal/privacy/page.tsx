import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy | AlphaClone Systems',
  description: 'Privacy policy for AlphaClone Systems LLC.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/privacy' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'who-we-are', title: 'Who we are' },
  { id: 'data-we-collect', title: 'Data we collect' },
  { id: 'how-we-use-data', title: 'How we use data' },
  { id: 'third-parties', title: 'Third-party services' },
  { id: 'storage', title: 'Storage and security' },
  { id: 'rights', title: 'Your rights' },
  { id: 'retention', title: 'Retention and children' },
  { id: 'changes', title: 'Changes and contact' },
];

export default function Page() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      lastUpdated="June 9, 2025"
      intro="This policy explains what AlphaClone Systems LLC collects, how we use it, and the choices available to you."
      sections={sections}
      badge="Privacy"
    >
      <section id="who-we-are" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Who we are</h2>
        <p className="text-sm leading-7 text-slate-300">
          AlphaClone Systems LLC operates the AlphaClone platform at alphaclonesystems.com. This policy covers the data
          we handle when you use the service, contact us, or connect third-party integrations.
        </p>
      </section>
      <section id="data-we-collect" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Data we collect</h2>
        <p className="text-sm leading-7 text-slate-300">We collect account data such as your name, email address, and company details, along with usage data, cookies and similar identifiers, and billing metadata from Stripe. We do not store card numbers.</p>
      </section>
      <section id="how-we-use-data" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">How we use data</h2>
        <p className="text-sm leading-7 text-slate-300">We use data to deliver the service, provide support, send transactional email through providers such as Brevo and Zoho, improve the product, and comply with legal obligations.</p>
      </section>
      <section id="third-parties" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Third-party services</h2>
        <p className="text-sm leading-7 text-slate-300">We use services such as Anthropic Claude API, Supabase, Stripe, Brevo, Twilio, Vercel, Google OAuth, Microsoft OAuth, Facebook/Meta OAuth, and LinkedIn OAuth to provide the platform.</p>
      </section>
      <section id="storage" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Storage and security</h2>
        <p className="text-sm leading-7 text-slate-300">Data is stored in Supabase cloud infrastructure with encryption at rest and access controls. We keep logs only as long as needed and apply tenant-level access controls throughout the platform.</p>
      </section>
      <section id="rights" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Your rights</h2>
        <p className="text-sm leading-7 text-slate-300">You can ask for access, correction, export, or deletion by contacting legal@alphaclonesystems.com. We process data rights requests within 30 days.</p>
      </section>
      <section id="retention" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Retention and children</h2>
        <p className="text-sm leading-7 text-slate-300">We retain active account data until you request deletion. Operational logs are purged after 90 days. The service is not directed at children under 13.</p>
      </section>
      <section id="changes" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Changes and contact</h2>
        <p className="text-sm leading-7 text-slate-300">We may update this policy from time to time. Contact legal@alphaclonesystems.com with any questions about privacy or your data rights.</p>
      </section>
    </LegalPageShell>
  );
}
