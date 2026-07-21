import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import DpaActions from './DpaActions';

export const metadata: Metadata = {
  title: 'Data Processing Agreement (DPA) | AlphaClone Systems',
  description: 'Data processing agreement for Alphaclone Systems, LLC, including Art. 28 language and subprocessors.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/dpa' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'overview', title: 'Overview' },
  { id: 'parties', title: 'Parties' },
  { id: 'subject', title: 'Subject matter' },
  { id: 'data-types', title: 'Types of data' },
  { id: 'processor', title: 'Processor obligations' },
  { id: 'subprocessors', title: 'Sub-processors' },
  { id: 'transfers', title: 'International transfers' },
  { id: 'security', title: 'Security measures' },
  { id: 'rights', title: 'Data subject rights' },
  { id: 'breach', title: 'Breach notification' },
  { id: 'governing-law', title: 'Governing law' },
  { id: 'signature', title: 'Signatures' },
];

const subprocessors = ['Supabase', 'Railway', 'Anthropic', 'Stripe', 'Brevo', 'Twilio', 'Cloudflare'];

export default function Page() {
  return (
    <LegalPageShell
      title="Data Processing Agreement"
      lastUpdated="June 9, 2025"
      intro="This DPA applies to EU and UK business customers who need a GDPR / UK GDPR data processing agreement."
      sections={sections}
      badge="DPA"
    >
      <section id="overview" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Overview</h2>
        <p className="text-sm leading-7 text-slate-300">
          A DPA sets out how AlphaClone processes personal data on behalf of a customer when the customer acts as the
          controller and AlphaClone acts as the processor.
        </p>
        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 text-sm text-slate-300">
          A signed PDF version is available from the download button above, and this page is print-friendly for browser PDF export.
        </div>
        <DpaActions />
      </section>

      <section id="parties" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Parties</h2>
        <p className="text-sm leading-7 text-slate-300">
          Alphaclone Systems, LLC acts as the Processor. The customer acts as the Controller.
        </p>
      </section>

      <section id="subject" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Subject matter</h2>
        <p className="text-sm leading-7 text-slate-300">
          The subject matter is the processing of personal data through the AlphaClone platform in connection with SaaS
          services described in the Terms of Service.
        </p>
      </section>

      <section id="data-types" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Types of data</h2>
        <p className="text-sm leading-7 text-slate-300">
          Processed data may include names, email addresses, company information, usage data, and any data the customer
          uploads to the platform.
        </p>
      </section>

      <section id="processor" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Processor obligations</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-slate-300">
          <li>Process only on documented instructions from the Controller.</li>
          <li>Keep personnel under confidentiality obligations.</li>
          <li>Implement appropriate technical and organizational security measures.</li>
          <li>Use sub-processors only under written terms and remain responsible for them.</li>
          <li>Assist with data subject rights requests, deletion, and return or deletion on termination.</li>
          <li>Provide reasonable audit assistance when requested.</li>
        </ul>
      </section>

      <section id="subprocessors" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Sub-processors</h2>
        <p className="text-sm leading-7 text-slate-300">AlphaClone currently relies on the following sub-processors:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {subprocessors.map((item) => (
            <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="transfers" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">International transfers</h2>
        <p className="text-sm leading-7 text-slate-300">
          Personal data may be transferred to the United States and protected by Standard Contractual Clauses where
          required.
        </p>
      </section>

      <section id="security" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Security measures</h2>
        <p className="text-sm leading-7 text-slate-300">
          Security includes encryption at rest and in transit, access controls, least-privilege access, logging, and
          regular security reviews.
        </p>
      </section>

      <section id="rights" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Data subject rights</h2>
        <p className="text-sm leading-7 text-slate-300">
          The Processor will assist the Controller with data subject requests within 72 hours of receiving the request
          or instruction.
        </p>
      </section>

      <section id="breach" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Breach notification</h2>
        <p className="text-sm leading-7 text-slate-300">
          If AlphaClone becomes aware of a personal data breach, it will notify the Controller within 72 hours.
        </p>
      </section>

      <section id="governing-law" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Governing law</h2>
        <p className="text-sm leading-7 text-slate-300">
          This DPA is governed by the laws of Wyoming, USA, while still acknowledging GDPR and UK GDPR compliance
          requirements.
        </p>
      </section>

      <section id="signature" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Signatures</h2>
        <p className="text-sm leading-7 text-slate-300">
          Controller: customer authorized signatory.
        </p>
        <p className="text-sm leading-7 text-slate-300">
          Processor: Alphaclone Systems, LLC, signed by Bornface Masilo.
        </p>
      </section>
    </LegalPageShell>
  );
}
