import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import CookieConsent from "@/components/common/CookieConsent";
import { ConsentAwareAnalytics } from "@/components/common/ConsentAwareAnalytics";
import NativeInteractions from "@/components/common/NativeInteractions";
import PageTransition from "@/components/PageTransition";
import { WebVitals } from "@/components/common/WebVitals";
import PrismBackground from "@/components/common/PrismBackground";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Alphaclone — AI Business OS for Founders | $15/month",
    template: "%s | AlphaClone Systems",
  },
  description:
    "Run your entire business from one AI platform. CRM, invoicing, contracts, social media, and meetings in plain English. Replace 10+ tools for $15 per month.",
  keywords: [
    "AI business operating system",
    "Alphaclone",
    "AlphaClone Systems",
    "AI CRM for founders",
    "small business CRM automated",
    "lead management software AI",
    "small business AI automation",
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
      "Replace 10+ tools with one AI platform. CRM, invoicing, contracts, social media, and meetings for $15 per month.",
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
      "Replace 10+ tools with one AI platform. CRM, invoicing, contracts, social media, and meetings. $15 per month.",
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
  maximumScale: 5,
  userScalable: true,
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

const navigationSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Primary Site Navigation",
  itemListElement: [
    { "@type": "SiteNavigationElement", position: 1, name: "About", url: `${SITE_URL}/about` },
    { "@type": "SiteNavigationElement", position: 2, name: "Documentation", url: `${SITE_URL}/docs` },
    { "@type": "SiteNavigationElement", position: 3, name: "Pricing", url: `${SITE_URL}/pricing` },
    { "@type": "SiteNavigationElement", position: 4, name: "Contact", url: `${SITE_URL}/contact` },
    { "@type": "SiteNavigationElement", position: 5, name: "Login", url: `${SITE_URL}/login` },
    { "@type": "SiteNavigationElement", position: 6, name: "Start Free Trial", url: `${SITE_URL}/register` },
  ],
};

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
        <Script src="/lockdown-install.js?v=5" strategy="afterInteractive" />
      </head>
      <body
        className="antialiased text-base subpixel-antialiased font-sans"
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
          <CookieConsent />
        </Providers>
        <ConsentAwareAnalytics />
      </body>
    </html>
  );
}
