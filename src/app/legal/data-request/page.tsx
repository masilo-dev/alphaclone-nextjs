import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import DataRequestForm from './DataRequestForm';

export const metadata: Metadata = {
  title: 'Data Requests | AlphaClone Systems',
  description: 'Request access, correction, export, or deletion of your AlphaClone data.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/data-request' },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <LegalPageShell
      title="Your Data Rights"
      lastUpdated="June 9, 2025"
      intro="You can request access, correction, export, or deletion of your personal data."
      sections={[
        { id: 'request-form', title: 'Request form' },
        { id: 'notice', title: 'Processing notice' },
      ]}
      badge="Rights"
    >
      <section id="request-form" className="scroll-mt-28">
        <DataRequestForm />
      </section>

      <section id="notice" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Processing notice</h2>
        <p className="text-sm leading-7 text-slate-300">We send a confirmation email after submission and notify legal@alphaclonesystems.com. Requests are stored in our data_requests table for tracking and audit purposes.</p>
        <p className="text-sm leading-7 text-slate-300">We process all requests within 30 days.</p>
      </section>
    </LegalPageShell>
  );
}
