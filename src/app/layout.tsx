import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import CookieBanner from "@/components/legal/CookieBanner";
import { ConsentAwareAnalytics } from "@/components/common/ConsentAwareAnalytics";
import NativeInteractions from "@/components/common/NativeInteractions";
import PageTransition from "@/components/PageTransition";
import { WebVitals } from "@/components/common/WebVitals";
import PrismBackground from "@/components/common/PrismBackground";
import { SITE_URL } from "@/lib/siteUrl";
import { buildOrganizationEntitySchema, buildSiteNavigationSchema } from "@/lib/seo/siteEntity";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Alphaclone — AI Business OS for Founders | $15/month",
    template: "%s | AlphaClone Systems",
  },
  description:
    "Run CRM, invoicing, contracts, social media workflows, and meetings from one AI-assisted business workspace. Starter plans begin at $15 per month.",
  keywords: [
    "AI business operating system",
    "Alphaclone",
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
  openGraph: {
    title: "Alphaclone — AI Business OS for Founders",
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
    title: "Alphaclone — AI Business OS for Founders",
    description:
      "CRM, invoicing, contracts, social media workflows, and meetings in one AI-assisted workspace. Starter plans begin at $15 per month.",
    creator: "@AlphaCloneSys",
    images: ["/twitter-image"],
  },
  manifest: "/manifest.json",
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};


const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlphaClone Systems",
  operatingSystem: "Web-based",
  applicationCategory: "BusinessApplication",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  description:
    "Unified business operating platform for service businesses with CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "15",
    highPrice: "80",
    offerCount: "3",
  },
  publisher: {
    "@type": "Organization",
    name: "AlphaClone Systems",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
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
    target: `${SITE_URL}/docs?query={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const navigationSchema = buildSiteNavigationSchema();
const organizationEntitySchema = buildOrganizationEntitySchema();

import Script from "next/script";

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
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
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
          <PrismBackground />
          <PWAProvider>
            <NativeInteractions />
            <ShellSwitcher>
              <PageTransition>
                {children}
              </PageTransition>
            </ShellSwitcher>
            {/* <GlobalAlpha /> */}
          </PWAProvider>
          <CookieBanner />
        </Providers>
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}
