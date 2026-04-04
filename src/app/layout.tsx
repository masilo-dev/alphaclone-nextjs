import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAProvider } from "@/contexts/PWAContext";
import ShellSwitcher from "@/components/shells/ShellSwitcher";
import { Analytics } from "@vercel/analytics/next";
import CookieConsent from "@/components/common/CookieConsent";
import NativeInteractions from "@/components/common/NativeInteractions";
import PageTransition from "@/components/PageTransition";
// import GlobalAlpha from "@/components/alpha/GlobalAlpha";
import { WebVitals } from "@/components/common/WebVitals";
import PrismBackground from "@/components/common/PrismBackground";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "optional",
  weight: ["400", "500", "600", "700", "800", "900"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://alphaclone.tech"),
  title: {
    default: "AlphaClone | The Unified Business OS & Operations Platform",
    template: "%s | AlphaClone Systems",
  },
  description:
    "AlphaClone: Enterprise-grade Business OS engineered for service providers. Unified platform combining CRM, billing, contracts, scheduling, and intelligent automation—built on proven operational frameworks and behavioral engineering principles.",
  keywords: [
    "Business Operating System",
    "Enterprise Business OS",
    "Unified Operations Platform",
    "Service Business CRM",
    "Technical Execution Platform",
    "Engineering-Driven Business Software",
    "Behavioral Engineering Tools",
    "Neuroscience-Based Workflow Optimization",
    "Cognitive Load Reduction Software",
    "Decision Architecture Platform",
    "Systems Engineering for Business",
    "Operational Excellence Software",
    "Business Process Engineering",
    "Unified Business Intelligence",
    "Technical Operations Management",
    "AlphaClone Systems",
    "Professional Services Automation",
    "Client Operations Engineering",
    "Business Workflow Architecture",
    "Performance Engineering Platform",
  ],
  authors: [{ name: "AlphaClone Systems", url: "https://alphaclone.tech" }],
  creator: "AlphaClone Systems",
  publisher: "AlphaClone Systems",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: "https://alphaclone.tech" },
  openGraph: {
    title: "AlphaClone Systems | Unified Business Operating Platform",
    description:
      "AlphaClone unifies CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations in one platform for service businesses.",
    type: "website",
    url: "https://alphaclone.tech",
    siteName: "AlphaClone Systems",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaClone Systems | Unified Business Operating Platform",
    description:
      "CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations in one platform.",
    creator: "@AlphaCloneSys",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AlphaClone Systems",
  operatingSystem: "Web-based",
  applicationCategory: "BusinessApplication",
  url: "https://alphaclone.tech",
  logo: "https://alphaclone.tech/favicon.ico",
  description:
    "Unified business operating platform for service businesses with CRM, billing, contracts, scheduling, messaging, documents, meetings, and operations.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "15",
    highPrice: "80",
    offerCount: "3",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "125",
  },
  publisher: {
    "@type": "Organization",
    name: "AlphaClone Systems",
    url: "https://alphaclone.tech",
    logo: "https://alphaclone.tech/favicon.ico",
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AlphaClone Systems",
  url: "https://alphaclone.tech",
  description: "Unified business operating platform for service businesses.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://alphaclone.tech/docs?query={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const navigationSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Primary Site Navigation",
  itemListElement: [
    { "@type": "SiteNavigationElement", position: 1, name: "About", url: "https://alphaclone.tech/about" },
    { "@type": "SiteNavigationElement", position: 2, name: "Documentation", url: "https://alphaclone.tech/docs" },
    { "@type": "SiteNavigationElement", position: 3, name: "Pricing", url: "https://alphaclone.tech/pricing" },
    { "@type": "SiteNavigationElement", position: 4, name: "Contact", url: "https://alphaclone.tech/contact" },
    { "@type": "SiteNavigationElement", position: 5, name: "Login", url: "https://alphaclone.tech/auth/login" },
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
        <Script src="/lockdown-install.js" strategy="beforeInteractive" as="script" />
      </head>
      <body
        className={`${inter.variable} antialiased text-base subpixel-antialiased font-sans`}
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
        <Analytics />
      </body>
    </html>
  );
}
