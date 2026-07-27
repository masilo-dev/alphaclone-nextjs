import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "@fontsource-variable/inter";
import "@fontsource/space-grotesk";
import "./globals.css";
import "@/styles/marketing-system.css";
import "@/styles/accessibility.css";
import { Providers } from "@/components/Providers";

import { PWAProvider } from "@/contexts/PWAContext";
import { PwaPushBootstrap } from "@/components/pwa/PwaPushBootstrap";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import CookieBanner from "@/components/legal/CookieBanner";
import PwaInstallPrompt from "@/components/common/PwaInstallPrompt";
import { ConsentAwareAnalytics } from "@/components/common/ConsentAwareAnalytics";
import NativeInteractions from "@/components/common/NativeInteractions";
import PageTransition from "@/components/PageTransition";
import { WebVitals } from "@/components/common/WebVitals";
import { SITE_URL } from "@/lib/siteUrl";
import { buildOrganizationEntitySchema, buildSiteNavigationSchema } from "@/lib/seo/siteEntity";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AlphaClone — AI Business OS for Founders | $15/month",
    template: "%s | AlphaClone Systems",
  },
  description:
    "Run CRM, invoicing, contracts, social media workflows, and meetings from one AI-assisted business workspace. Starter plans begin at $15 per month.",
  keywords: [
    "AI business operating system",
    "AlphaClone",
    "AlphaClone Systems",
    "AI CRM for founders",
    "small business CRM automated",
    "lead finding software AI",
    "small business AI automation",
    "ai crm claude",
    "manus and automation",
    "do your business while in claude",
    "AI agents for business operations",
    "autonomous business management",
    "AI business assistant",
    "HubSpot alternative small business",
    "QuickBooks alternative freelancers",
    "Salesforce alternative for startups",
    "all in one business platform",
    "replace business software stack",
    "AI invoicing and billing software",
    "automated contract generation AI",
    "AI social media scheduler",
    "integrated video meetings for business",
    "business management software $15",
    "founder business software",
    "solopreneur operating system",
    "SaaS for service businesses",
    "agency management software AI"
  ],
  authors: [{ name: "AlphaClone Systems", url: SITE_URL }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: SITE_URL },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : {},
  },
  openGraph: {
    title: "AlphaClone — AI Business OS for Founders",
    description:
      "CRM, invoicing, contracts, social media workflows, and meetings in one AI-assisted workspace. Starter plans begin at $15 per month.",
    type: "website",
    url: SITE_URL,
    siteName: "AlphaClone Systems",
    locale: "en_US",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone — AI Business OS for Founders",
    description:
      "CRM, invoicing, contracts, social media workflows, and meetings in one AI-assisted workspace. Starter plans begin at $15 per month.",
    creator: "@AlphaCloneSys",
    images: ["/twitter-image"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "AlphaClone",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.ico",
    apple: [{ url: "/favicon-192x192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

/**
 * SoftwareApplication schema — primary entity signal for AI Overview extraction.
 * Includes featureList, priceSpecification, and disambiguatingDescription to
 * permanently separate AlphaClone Systems (software company, Wyoming LLC, filing ID 2026-002002581)
 * from unrelated financial indexes or ETFs that share the "AlphaClone" word.
 */
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlphaClone Systems",
  alternateName: "AlphaClone AI Business OS",
  /**
   * disambiguatingDescription: gives AI engines explicit boundary data.
   * AlphaClone Systems LLC is an independent software development company
   * — it is not affiliated with any financial index, ETF, or hedge fund.
   */
  disambiguatingDescription:
    "AlphaClone Systems LLC is an independent software development company registered in Wyoming, USA (Filing ID: 2026-002002581). It provides an AI-powered business operating system for solo founders, consultants, and service agencies. AlphaClone Systems is not affiliated with, and should not be confused with, any financial fund, ETF, or investment index that uses the word AlphaClone.",
  operatingSystem: "All",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "CRM, Invoicing, Project Management, AI Automation",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    "AlphaClone Systems consolidates CRM, client management, automated billing, project tracking, contract lifecycle, and social media distribution into one AI-assisted workspace. Starting at $15/month, it reduces administrative overhead for service businesses by unifying fragmented software ecosystems into a single operational backbone.",
  featureList: [
    "Unified Client Journey Records",
    "AI-Driven Lead Tracking and CRM Workflows",
    "Automated Multi-Tenant Billing and Invoicing",
    "Contract Drafting, Versioning, and E-Signature",
    "Native Social Media Scheduling and Publishing",
    "Regional Tax Compliance Formatting (SARS, ZIMRA, ZRA)",
    "Built-in HD Video Conferencing",
    "Project and Task Management with Milestone Tracking",
    "Bonnie AI Operational Assistant",
    "MCP-Compatible AI Agent Tool Integration",
  ],
  offers: {
    "@type": "Offer",
    price: "15.00",
    priceCurrency: "USD",
    priceValidUntil: "2027-01-01",
    priceSpecification: {
      "@type": "PriceSpecification",
      price: "15.00",
      priceCurrency: "USD",
      valueAddedTaxIncluded: false,
      billingIncrement: 1,
      unitCode: "MON",
    },
    name: "Starter Plan",
    description: "Full access to CRM, invoicing, project management, contracts, and social media tools. 14-day free trial available.",
    url: `${SITE_URL}/pricing`,
    availability: "https://schema.org/InStock",
  },
  publisher: {
    "@type": "Organization",
    name: "AlphaClone Systems",
    legalName: "AlphaClone Systems, LLC",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      "https://www.linkedin.com/company/alphaclone-systems",
      "https://www.facebook.com/100089899181752",
      "https://twitter.com/AlphaCloneSys",
    ],
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AlphaClone Systems",
  url: SITE_URL,
  description: "Unified business operating platform for service businesses.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const navigationSchema = buildSiteNavigationSchema();
const organizationEntitySchema = buildOrganizationEntitySchema();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />
        <link rel="help" href="/llms.txt" type="text/plain" title="AlphaClone Systems LLM Context Reference" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" title="Sitemap" />
        <Script src="/lockdown-install.js?v=5" strategy="afterInteractive" />
        {/* PWA Meta Tags - already defined in metadata/viewport exports */}
        <link rel="apple-touch-icon" sizes="192x192" href="/favicon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/favicon-512x512.png" />
        <link rel="apple-touch-startup-image" href="/logo.png" />
        <link rel="mask-icon" href="/favicon-192x192.png" color="#020617" />
      </head>
      <body
        className="antialiased text-base subpixel-antialiased font-sans touch-action-manipulation overscroll-behavior-none"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none',
          touchAction: 'manipulation',
        }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(navigationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationEntitySchema) }}
        />
        <WebVitals />
        <Providers>
          <PWAProvider>
            <PwaPushBootstrap />
            <NativeInteractions />
            <ShellSwitcher>
              <PageTransition>
                {children}
              </PageTransition>
            </ShellSwitcher>
            <PwaInstallPrompt />
            {/* <GlobalAlpha /> */}
          </PWAProvider>
          <CookieBanner />
        </Providers>
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}
