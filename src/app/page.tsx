import React, { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';

/**
 * AlphaClone Home Page (Server Component)
 * 
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 */
export default async function Home() {
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
          text: 'Alphaclone brings CRM, invoicing, contracts, social media workflows, AI assistance, and video meeting operations into one workspace. Starter plans begin at 15 USD per month.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Alphaclone good for solopreneurs and one-person businesses?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Alphaclone is designed for solo founders and small teams that need CRM, billing, contracts, meetings, and automation in one workspace.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is Alphaclone different from HubSpot or QuickBooks?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'HubSpot and QuickBooks focus on specific business functions. Alphaclone combines CRM, finance, contracts, social media workflows, meetings, and AI-assisted operations in one platform.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need to know how to use AI to use Alphaclone?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. You can describe operational tasks in plain language and use the dashboard controls for review and execution.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Alphaclone compare with HubSpot for small businesses?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Alphaclone includes CRM, pipeline management, contact tracking, and AI-assisted follow-up workflows starting at 15 USD per month, alongside finance, contracts, meetings, and social workflows.',
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
  );
}
