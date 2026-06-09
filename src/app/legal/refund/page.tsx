import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Refund Policy | AlphaClone Systems',
  description: 'Refund and cancellation policy for AlphaClone Systems LLC.',
  alternates: { canonical: 'https://alphaclonesystems.com/legal/refund' },
  robots: { index: true, follow: true },
};

const sections = [
  { id: 'billing-model', title: 'Subscription model' },
  { id: 'trial', title: 'Free trial' },
  { id: 'monthly', title: 'Monthly plans' },
  { id: 'annual', title: 'Annual plans' },
  { id: 'exceptions', title: 'Always-refund exceptions' },
  { id: 'request', title: 'How to request a refund' },
  { id: 'processing', title: 'Processing time' },
  { id: 'chargebacks', title: 'Chargebacks' },
  { id: 'cancellation', title: 'Account cancellation' },
  { id: 'changes', title: 'Changes to this policy' },
];

export default function Page() {
  return (
    <LegalPageShell
      title="Refund Policy"
      lastUpdated="June 9, 2025"
      intro="This policy explains when refunds are available, how billing works, and how to request a refund."
      sections={sections}
      badge="Refunds"
    >
      <section id="billing-model" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Subscription model</h2>
        <p className="text-sm leading-7 text-slate-300">
          AlphaClone subscriptions are billed monthly or annually through Stripe and renew automatically until canceled.
        </p>
      </section>

      <section id="trial" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Free trial</h2>
        <p className="text-sm leading-7 text-slate-300">
          If a free trial is offered, you will not be charged until the trial ends. You can cancel anytime before the
          trial expiration to avoid the first charge.
        </p>
      </section>

      <section id="monthly" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Monthly plans</h2>
        <p className="text-sm leading-7 text-slate-300">
          Monthly subscriptions are non-refundable for partial months. To avoid the next renewal charge, cancel before
          the next billing cycle begins.
        </p>
      </section>

      <section id="annual" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Annual plans</h2>
        <p className="text-sm leading-7 text-slate-300">
          Annual plans are eligible for a pro-rated refund if requested within 14 days of purchase. Requests made after
          the 14-day window are not refundable.
        </p>
      </section>

      <section id="exceptions" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Always-refund exceptions</h2>
        <p className="text-sm leading-7 text-slate-300">
          We always refund duplicate charges, verified billing errors, and charges that occur after a cancellation has
          been confirmed.
        </p>
      </section>

      <section id="request" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">How to request a refund</h2>
        <p className="text-sm leading-7 text-slate-300">
          Email <a href="mailto:billing@alphaclonesystems.com" className="text-teal-300 hover:underline">billing@alphaclonesystems.com</a>{' '}
          with the subject <span className="font-mono text-teal-300">Refund Request - [your email]</span> within the
          eligible window.
        </p>
      </section>

      <section id="processing" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Processing time</h2>
        <p className="text-sm leading-7 text-slate-300">
          Approved refunds are processed within 5 to 10 business days back to the original payment method through Stripe.
        </p>
      </section>

      <section id="chargebacks" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Chargebacks</h2>
        <p className="text-sm leading-7 text-slate-300">
          Please contact us before filing a dispute. Unresolved chargebacks may result in account suspension while we
          review the billing history.
        </p>
      </section>

      <section id="cancellation" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Account cancellation</h2>
        <p className="text-sm leading-7 text-slate-300">
          After cancellation, account data is retained for 30 days to support recovery and legal obligations, then
          permanently deleted.
        </p>
      </section>

      <section id="changes" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Changes to this policy</h2>
        <p className="text-sm leading-7 text-slate-300">
          We may update this policy when our billing practices, plans, or legal obligations change. Material updates
          will be reflected on this page.
        </p>
      </section>
    </LegalPageShell>
  );
}
