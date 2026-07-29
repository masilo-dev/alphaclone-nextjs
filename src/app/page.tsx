import React, { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';

/**
 * AlphaClone Home Page (Server Component)
 *
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 * FAQ structured data lives on /faq only (canonical FAQPage schema).
 */
export default async function Home() {
<<<<<<< HEAD
  return (
    <Suspense
      fallback={
        <div className="marketing-theme min-h-screen text-[var(--marketing-text-primary)] flex items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-xs sm:max-w-lg md:max-w-3xl" aria-hidden="true">
            <div className="h-8 sm:h-10 w-3/4 sm:w-64 rounded-md bg-[var(--marketing-surface)] mb-4 sm:mb-5" />
            <div className="h-4 sm:h-5 w-full rounded bg-[var(--marketing-surface)] mb-2 sm:mb-3" />
            <div className="h-4 sm:h-5 w-4/5 sm:w-5/6 rounded bg-[var(--marketing-surface)] mb-6 sm:mb-10" />
            <div className="h-9 sm:h-11 w-32 sm:w-40 rounded-md bg-[var(--marketing-accent-soft)]" />
          </div>
        </div>
      }
    >
      <HomeClient initialProjects={[]} />
    </Suspense>
=======
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AlphaClone Systems',
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'sales@alphaclonesystems.com',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@alphaclonesystems.com',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'security',
        email: 'security@alphaclonesystems.com',
      },
    ],
    sameAs: [],
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AlphaClone Systems',
    url: siteUrl,
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What tools does Alphaclone replace?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Alphaclone replaces your CRM, invoicing software, contract and e-signature tool, social media scheduler, AI writing assistant, and video meeting platform in one place for 15 USD per month.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Alphaclone good for solopreneurs and one-person businesses?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Alphaclone is designed for solo founders and small teams that need enterprise capabilities without enterprise pricing or complexity.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is Alphaclone different from HubSpot or QuickBooks?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'HubSpot and QuickBooks focus on single functions. Alphaclone combines CRM, finance, contracts, social media, meetings, and AI in one platform controlled through natural language.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need to know how to use AI to use Alphaclone?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. You describe what you need in plain language and Alphaclone executes it.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the best affordable alternative to HubSpot for small businesses?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Alphaclone provides CRM, pipeline management, contact tracking, and AI-powered follow-ups starting at 15 USD per month with broader built-in functionality.',
        },
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#020D1A] text-slate-100 flex items-center justify-center px-6">
            <div className="w-full max-w-3xl">
              <div className="h-10 w-64 rounded-md bg-slate-800/70 mb-5" />
              <div className="h-5 w-full rounded bg-slate-800/60 mb-3" />
              <div className="h-5 w-5/6 rounded bg-slate-800/60 mb-10" />
              <div className="h-11 w-40 rounded-md bg-teal-500/30" />
            </div>
          </div>
        }
      >
        <HomeClient initialProjects={[]} />
      </Suspense>
    </main>
>>>>>>> origin/main
  );
}
