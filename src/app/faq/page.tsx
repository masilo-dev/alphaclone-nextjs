import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/siteUrl';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import { FAQ_BUYER_ITEMS, FAQ_ITEMS, FAQ_PRODUCT_ITEMS } from '@/config/faqItems';

export const metadata: Metadata = {
  title: 'FAQ | AlphaClone Systems',
  description:
    'Answers about outcomes, fit, and trust for service businesses — plus features, integrations, and comparisons to HubSpot, QuickBooks, and Salesforce.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'FAQ | AlphaClone Systems',
    description:
      'Why teams use AlphaClone to connect leads, delivery, and billing — and how it compares to fragmented SaaS stacks.',
    url: `${SITE_URL}/faq`,
    type: 'website',
  },
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <MarketingLandingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <main className="max-w-3xl mx-auto px-4 py-16 space-y-14">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Frequently asked questions</h1>
          <p className="text-slate-400 leading-relaxed">
            Start with why teams switch — then drill into features and comparisons if you are evaluating tools.
          </p>
        </div>

        <section id="outcomes" className="scroll-mt-24">
          <h2 className="text-xl font-bold text-white mb-1">Why teams use AlphaClone</h2>
          <p className="text-sm text-slate-500 mb-6">
            Outcomes, fit, setup, and trust — the questions buyers ask first.
          </p>
          <MarketingFaqAccordion items={FAQ_BUYER_ITEMS} />
          <p className="mt-6 text-sm text-slate-400">
            See workflow stories by team type on{' '}
            <Link href="/results" className="text-teal-400 hover:text-teal-300 font-semibold">
              /results
            </Link>
            .
          </p>
        </section>

        <section id="features" className="scroll-mt-24 pt-4 border-t border-slate-800">
          <h2 className="text-xl font-bold text-white mb-1">Features & comparisons</h2>
          <p className="text-sm text-slate-500 mb-6">
            Integrations, modules, and how AlphaClone maps to tools you may already use.
          </p>
          <MarketingFaqAccordion items={FAQ_PRODUCT_ITEMS} />
        </section>

        <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-6 text-center">
          <p className="text-sm text-slate-300 mb-4">
            Still deciding? Run your own lead-to-invoice test in a free 14-day trial.
          </p>
          <Link
            href="/auth/login?register=true&type=business&plan=starter"
            className="inline-flex px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </main>
    </MarketingLandingShell>
  );
}
