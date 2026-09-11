import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Service Level Agreement (SLA) | AlphaClone Systems',
  description: 'Service level agreement covering uptime, maintenance, credits, and support for AlphaClone Systems.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/sla' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'uptime', title: 'Uptime commitment' },
  { id: 'definition', title: 'Uptime definition' },
  { id: 'maintenance', title: 'Scheduled maintenance' },
  { id: 'exclusions', title: 'SLA exclusions' },
  { id: 'credits', title: 'Service credits' },
  { id: 'claim', title: 'How to claim a credit' },
  { id: 'status', title: 'Status page' },
  { id: 'remedy', title: 'Limitation and remedy' },
  { id: 'ai', title: 'AI feature availability' },
  { id: 'changes', title: 'Changes to this policy' },
];

export default function Page() {
  return (
    <LegalPageShell
      title="Service Level Agreement"
      lastUpdated="June 9, 2025"
      intro="This SLA describes AlphaClone's uptime commitment, exclusions, and the service credit process for paid plans."
      sections={sections}
      badge="SLA"
    >
      <section id="uptime" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Uptime commitment</h2>
        <p className="text-sm leading-7 text-slate-300">
          AlphaClone targets 99.5% monthly uptime for paid plans.
        </p>
      </section>

      <section id="definition" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Uptime definition</h2>
        <p className="text-sm leading-7 text-slate-300">
          Uptime means the platform is accessible and functional for normal use, excluding scheduled maintenance and
          other exclusions listed below.
        </p>
      </section>

      <section id="maintenance" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Scheduled maintenance</h2>
        <p className="text-sm leading-7 text-slate-300">
          We provide at least 48 hours notice for planned maintenance by email and status page updates, and we normally
          schedule maintenance during off-peak hours.
        </p>
      </section>

      <section id="exclusions" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">SLA exclusions</h2>
        <p className="text-sm leading-7 text-slate-300">
          The SLA does not cover force majeure, third-party API outages, user error, abuse, or failures outside our
          reasonable control.
        </p>
      </section>

      <section id="credits" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Service credits</h2>
        <p className="text-sm leading-7 text-slate-300">
          If monthly uptime falls below 99.5% in a calendar month, affected paid users receive a 10% credit on the next
          invoice.
        </p>
      </section>

      <section id="claim" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">How to claim a credit</h2>
        <p className="text-sm leading-7 text-slate-300">
          Email <a href="mailto:support@alphaclonesystems.com" className="text-teal-300 hover:underline">support@alphaclonesystems.com</a>{' '}
          within 15 days of the incident and include the affected dates and times.
        </p>
      </section>

      <section id="status" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Status page</h2>
        <p className="text-sm leading-7 text-slate-300">
          Service health updates are published at{' '}
          <a href="https://status.alphaclonesystems.com" className="text-teal-300 hover:underline" target="_blank" rel="noreferrer">
            status.alphaclonesystems.com
          </a>.
        </p>
      </section>

      <section id="remedy" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Limitation and remedy</h2>
        <p className="text-sm leading-7 text-slate-300">
          Credits are the sole remedy for downtime covered by this SLA, and we are not liable for consequential
          damages caused by service interruptions.
        </p>
      </section>

      <section id="ai" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">AI feature availability</h2>
        <p className="text-sm leading-7 text-slate-300">
          Bonnie AI depends on Anthropic API availability and is not separately covered by this SLA.
        </p>
      </section>

      <section id="changes" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Changes to this policy</h2>
        <p className="text-sm leading-7 text-slate-300">
          We may update this SLA from time to time. Any material changes will be published on this page.
        </p>
      </section>
    </LegalPageShell>
  );
}
