import type { Metadata } from 'next';
<<<<<<< HEAD
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
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'FAQ | AlphaClone Systems',
    description:
      'Why teams use AlphaClone to connect leads, delivery, and billing — and how it compares to fragmented SaaS stacks.',
=======
import { SITE_URL } from '@/lib/siteUrl';

const faqItems = [
  {
    question: 'What tools does Alphaclone replace?',
    answer:
      'Alphaclone replaces your CRM, invoicing software, contract and e-signature tool, social media scheduler, AI writing assistant, and video meeting platform in one place for 15 USD per month.',
  },
  {
    question: 'Is Alphaclone good for solopreneurs and one-person businesses?',
    answer:
      'Yes. Alphaclone is designed specifically for solo founders and small teams who need enterprise-level capabilities without enterprise-level pricing or complexity.',
  },
  {
    question: 'How is Alphaclone different from HubSpot or QuickBooks?',
    answer:
      'HubSpot and QuickBooks are single-function tools. Alphaclone is a complete business operating system with CRM, finance, contracts, social media, meetings, and AI in one platform.',
  },
  {
    question: 'Do I need to know how to use AI to use Alphaclone?',
    answer: 'No. You describe what you need in plain language and Alphaclone executes it.',
  },
  {
    question: 'What is the best affordable alternative to HubSpot for small businesses?',
    answer:
      'Alphaclone offers CRM, pipeline management, contact tracking, and AI-powered follow-ups starting at 15 USD per month with broader built-in functionality.',
  },
];

export const metadata: Metadata = {
  title: 'FAQ | Alphaclone',
  description:
    'Frequently asked questions about Alphaclone pricing, features, and how it replaces CRM, invoicing, contracts, social media, and meetings.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: 'FAQ | Alphaclone',
    description:
      'Answers about Alphaclone as an AI business operating system for founders and small teams.',
>>>>>>> origin/main
    url: `${SITE_URL}/faq`,
    type: 'website',
  },
};

export default function FaqPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
<<<<<<< HEAD
    mainEntity: FAQ_ITEMS.map((item) => ({
=======
    mainEntity: faqItems.map((item) => ({
>>>>>>> origin/main
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
<<<<<<< HEAD
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
=======
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6">Frequently Asked Questions</h1>
        <p className="text-slate-300 mb-10 text-base md:text-lg">
          Everything you need to know about Alphaclone as an AI business operating system.
        </p>
        <div className="space-y-6">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-xl font-bold text-white mb-2">{item.question}</h2>
              <p className="text-slate-300 leading-relaxed">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
>>>>>>> origin/main
  );
}
